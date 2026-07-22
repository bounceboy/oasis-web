import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import AdmZip from 'adm-zip'
import { BabId } from '@/lib/kyic-sections'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60

// Mapping Heading1 titles di dokumen KYIC → bab_id
const HEADING_TO_BAB: [RegExp, BabId][] = [
  [/kepemilikan/i,                               'kepemilikan'],
  [/kegiatan.*bisnis|bisnis.*utama/i,            'kegiatan_bisnis'],
  [/kegiatan.*penunjang|penunjang/i,             'kegiatan_penunjang'],
  [/rencana.*bisnis/i,                           'rencana_bisnis'],
  [/tingkat.*kesehatan/i,                        'tingkat_kesehatan'],
  [/kinerja.*keuangan/i,                         'kinerja_keuangan'],
  [/organisasi.*manajemen|manajemen.*risiko.*spi/i, 'organisasi_mr_spi'],
  [/status.*pengawasan|kepatuhan.*isu/i,         'status_pengawasan'],
  [/penetapan.*fokus|fokus.*pengawasan/i,        'fokus_pengawasan'],
]

function parseSectionsFromDocx(buf: Buffer): Record<BabId, string> {
  const zip = new AdmZip(buf)
  const xml = zip.readAsText('word/document.xml')
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g
  const styleRegex = /<w:pStyle w:val="([^"]+)"/
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g

  const sections: Record<string, string> = {}
  let currentBab: BabId | null = null
  let currentLines: string[] = []

  const paras = xml.match(paraRegex) ?? []
  for (const para of paras) {
    const styleMatch = para.match(styleRegex)
    const style = styleMatch?.[1] ?? ''
    const isHeading1 = style === 'Heading1' || style === 'heading1' || style === '1'

    let paraText = ''
    let m
    const textRe = new RegExp(textRegex.source, 'g')
    while ((m = textRe.exec(para)) !== null) paraText += m[1]
    paraText = paraText.trim()
    if (!paraText) continue

    if (isHeading1) {
      if (currentBab && currentLines.length > 0) sections[currentBab] = currentLines.join('\n')
      currentBab = null
      for (const [pattern, babId] of HEADING_TO_BAB) {
        if (pattern.test(paraText)) { currentBab = babId; break }
      }
      currentLines = []
    } else if (currentBab) {
      currentLines.push(paraText)
    }
  }
  if (currentBab && currentLines.length > 0) sections[currentBab] = currentLines.join('\n')
  return sections as unknown as Record<BabId, string>
}

function parseSectionsFromText(fullText: string): Record<BabId, string> {
  const sections: Record<string, string> = {}
  let currentBab: BabId | null = null
  let currentLines: string[] = []

  for (const line of fullText.split('\n').map(l => l.trim()).filter(Boolean)) {
    const isHeadingLike = line.length < 80 && (line === line.toUpperCase() || /^[A-Z][a-z]/.test(line))
    if (isHeadingLike) {
      let matched: BabId | null = null
      for (const [pattern, babId] of HEADING_TO_BAB) {
        if (pattern.test(line)) { matched = babId; break }
      }
      if (matched) {
        if (currentBab && currentLines.length > 0) sections[currentBab] = currentLines.join('\n')
        currentBab = matched
        currentLines = []
        continue
      }
    }
    if (currentBab) currentLines.push(line)
  }
  if (currentBab && currentLines.length > 0) sections[currentBab] = currentLines.join('\n')
  return sections as unknown as Record<BabId, string>
}

// POST — upload KYIC T-1
// - PDF: simpan ke Supabase Storage, OCR dilakukan per-BAB saat analisis
// - docx/doc: extract text langsung, simpan ke template_sections
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const contentType = req.headers.get('content-type') ?? ''

  let buf: Buffer | null = null
  let fileName: string
  let storagePath: string | null = null

  if (contentType.includes('application/json')) {
    // Large file — already uploaded to storage
    const body = await req.json()
    fileName = body.fileName
    storagePath = body.storagePath
    if (!storagePath || !fileName)
      return NextResponse.json({ error: 'storagePath dan fileName diperlukan' }, { status: 400 })
  } else {
    // Small file — FormData
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    fileName = file.name
    buf = Buffer.from(await file.arrayBuffer())
  }

  const ext = fileName.toLowerCase().split('.').pop()
  if (!['pdf', 'docx', 'doc'].includes(ext ?? ''))
    return NextResponse.json({ error: 'Format tidak didukung (gunakan .docx atau .pdf)' }, { status: 422 })

  try {
    if (ext === 'pdf') {
      // PDF — simpan ke storage, OCR dilakukan per-BAB saat analisis (tidak sekarang)
      if (buf && !storagePath) {
        // Small PDF — upload ke storage dulu
        const path = `templates/${id}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: uploadError } = await adminClient.storage
          .from('ky-uploads')
          .upload(path, buf, { contentType: 'application/pdf', upsert: true })
        if (uploadError) throw new Error('Gagal menyimpan PDF ke storage')
        storagePath = path
      }

      const { error } = await db()
        .from('ky_session')
        .update({
          template_nama: fileName,
          template_storage_path: storagePath,
          template_sections: {},
          template_text: '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)

      return NextResponse.json({ ok: true, mode: 'pdf_stored', message: 'PDF tersimpan — teks akan diekstrak per-BAB saat analisis dijalankan' })
    } else {
      // docx/doc — extract text sekarang
      if (!buf) {
        // Kalau dari storage, download dulu
        const { data, error: dlErr } = await adminClient.storage.from('ky-uploads').download(storagePath!)
        if (dlErr || !data) throw new Error('Gagal mengambil file dari storage')
        buf = Buffer.from(await data.arrayBuffer())
        adminClient.storage.from('ky-uploads').remove([storagePath!]).catch(() => {})
      }

      let templateSections = parseSectionsFromDocx(buf)
      const zip = new AdmZip(buf)
      const xml = zip.readAsText('word/document.xml')
      const fullText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const filledSections = Object.values(templateSections).filter(v => v.length > 50).length
      if (filledSections < 3) templateSections = parseSectionsFromText(fullText)

      const trimmedSections: Record<string, string> = {}
      for (const [babId, text] of Object.entries(templateSections)) {
        trimmedSections[babId] = text.slice(0, 8000)
      }

      const { error } = await db()
        .from('ky_session')
        .update({
          template_nama: fileName,
          template_text: fullText.slice(0, 60000),
          template_sections: trimmedSections,
          template_storage_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)

      const parsedCount = Object.values(trimmedSections).filter(v => v.length > 50).length
      return NextResponse.json({ ok: true, mode: 'docx_parsed', sections_parsed: parsedCount })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Gagal memproses file template'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
