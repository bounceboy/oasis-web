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
  [/kepemilikan/i,                        'kepemilikan'],
  [/kegiatan.*bisnis|bisnis.*utama/i,     'kegiatan_bisnis'],
  [/kegiatan.*penunjang|penunjang/i,      'kegiatan_penunjang'],
  [/rencana.*bisnis/i,                    'rencana_bisnis'],
  [/tingkat.*kesehatan/i,                 'tingkat_kesehatan'],
  [/kinerja.*keuangan/i,                  'kinerja_keuangan'],
  [/organisasi.*manajemen|manajemen.*risiko.*spi/i, 'organisasi_mr_spi'],
  [/status.*pengawasan|kepatuhan.*isu/i,  'status_pengawasan'],
  [/penetapan.*fokus|fokus.*pengawasan/i, 'fokus_pengawasan'],
]

function parseSectionsFromDocx(buf: Buffer): Record<BabId, string> {
  const zip = new AdmZip(buf)
  const xml = zip.readAsText('word/document.xml')

  // Extract paragraphs with their heading style
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

    // Extract plain text from paragraph
    let paraText = ''
    let m
    const textRe = new RegExp(textRegex.source, 'g')
    while ((m = textRe.exec(para)) !== null) {
      paraText += m[1]
    }
    paraText = paraText.trim()
    if (!paraText) continue

    if (isHeading1) {
      // Save previous section
      if (currentBab && currentLines.length > 0) {
        sections[currentBab] = currentLines.join('\n')
      }
      // Find matching bab
      currentBab = null
      for (const [pattern, babId] of HEADING_TO_BAB) {
        if (pattern.test(paraText)) {
          currentBab = babId
          break
        }
      }
      currentLines = []
    } else if (currentBab) {
      currentLines.push(paraText)
    }
  }
  // Save last section
  if (currentBab && currentLines.length > 0) {
    sections[currentBab] = currentLines.join('\n')
  }

  return sections as unknown as Record<BabId, string>
}

function parseSectionsFromText(fullText: string): Record<BabId, string> {
  const sections: Record<string, string> = {}
  let currentBab: BabId | null = null
  let currentLines: string[] = []

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Short line, all-caps or title-case heading
    const isHeadingLike = line.length < 80 && (line === line.toUpperCase() || /^[A-Z][a-z]/.test(line))

    if (isHeadingLike) {
      let matched: BabId | null = null
      for (const [pattern, babId] of HEADING_TO_BAB) {
        if (pattern.test(line)) { matched = babId; break }
      }
      if (matched) {
        if (currentBab && currentLines.length > 0) {
          sections[currentBab] = currentLines.join('\n')
        }
        currentBab = matched
        currentLines = []
        continue
      }
    }

    if (currentBab) currentLines.push(line)
  }
  if (currentBab && currentLines.length > 0) {
    sections[currentBab] = currentLines.join('\n')
  }

  return sections as unknown as Record<BabId, string>
}

async function parseAndSave(id: string, buf: Buffer, fileName: string) {
  const ext = fileName.toLowerCase().split('.').pop()
  let fullText = ''
  let templateSections: Record<BabId, string> = {} as Record<BabId, string>

  if (ext === 'pdf') {
    const pdfParse = require('pdf-parse/lib/pdf-parse')
    fullText = (await pdfParse(buf)).text
    templateSections = parseSectionsFromText(fullText)
  } else if (ext === 'docx' || ext === 'doc') {
    templateSections = parseSectionsFromDocx(buf)
    const zip = new AdmZip(buf)
    const xml = zip.readAsText('word/document.xml')
    fullText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const filledSections = Object.values(templateSections).filter(v => v.length > 50).length
    if (filledSections < 3) {
      templateSections = parseSectionsFromText(fullText)
    }
  } else {
    throw new Error('Format tidak didukung (gunakan .docx atau .pdf)')
  }

  const trimmedSections: Record<string, string> = {}
  for (const [babId, text] of Object.entries(templateSections)) {
    trimmedSections[babId] = text.slice(0, 8000)
  }

  const { error } = await db()
    .from('ky_session')
    .update({
      template_text: fullText.slice(0, 60000),
      template_nama: fileName,
      template_sections: trimmedSections,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  const parsedCount = Object.values(trimmedSections).filter(v => v.length > 50).length
  return { ok: true, chars: fullText.length, sections_parsed: parsedCount }
}

// POST — upload KYIC T-1, parse per-BAB, simpan ke template_text + template_sections
// Supports two modes:
//   1. FormData with 'file' — for small files (< ~4MB)
//   2. JSON { storagePath, fileName } — for large files uploaded directly to Supabase Storage
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const contentType = req.headers.get('content-type') ?? ''

  let buf: Buffer
  let fileName: string

  if (contentType.includes('application/json')) {
    // Large file path: download from Supabase Storage
    const { storagePath, fileName: fn } = await req.json()
    if (!storagePath || !fn) return NextResponse.json({ error: 'storagePath dan fileName diperlukan' }, { status: 400 })
    fileName = fn

    const { data, error } = await adminClient.storage.from('ky-uploads').download(storagePath)
    if (error || !data) return NextResponse.json({ error: 'Gagal mengambil file dari storage' }, { status: 500 })
    buf = Buffer.from(await data.arrayBuffer())

    // Cleanup storage after download
    adminClient.storage.from('ky-uploads').remove([storagePath]).catch(() => {})
  } else {
    // Small file path: direct FormData upload
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    buf = Buffer.from(await file.arrayBuffer())
    fileName = file.name
  }

  const ext = fileName.toLowerCase().split('.').pop()
  if (!['pdf', 'docx', 'doc'].includes(ext ?? ''))
    return NextResponse.json({ error: 'Format tidak didukung (gunakan .docx atau .pdf)' }, { status: 422 })

  try {
    const result = await parseAndSave(id, buf, fileName)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Gagal memproses file template'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
