import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import AdmZip from 'adm-zip'
import { BabId } from '@/lib/kyic-sections'

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

// POST — upload KYIC T-1, parse per-BAB, simpan ke template_text + template_sections
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const ext = file.name.toLowerCase().split('.').pop()

  let fullText = ''
  let templateSections: Record<BabId, string> = {} as Record<BabId, string>

  try {
    if (ext === 'pdf') {
      const pdfParse = require('pdf-parse/lib/pdf-parse')
      fullText = (await pdfParse(buf)).text
      templateSections = parseSectionsFromText(fullText)
    } else if (ext === 'docx' || ext === 'doc') {
      // Parse sections via heading styles (lebih akurat untuk docx)
      templateSections = parseSectionsFromDocx(buf)
      // Fallback: kalau hasil parsing kosong, coba dari text
      const zip = new AdmZip(buf)
      const xml = zip.readAsText('word/document.xml')
      fullText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const filledSections = Object.values(templateSections).filter(v => v.length > 50).length
      if (filledSections < 3) {
        templateSections = parseSectionsFromText(fullText)
      }
    } else {
      return NextResponse.json({ error: 'Format tidak didukung (gunakan .docx atau .pdf)' }, { status: 422 })
    }
  } catch {
    return NextResponse.json({ error: 'Gagal membaca file template' }, { status: 422 })
  }

  // Trim tiap section agar tidak terlalu besar
  const trimmedSections: Record<string, string> = {}
  for (const [babId, text] of Object.entries(templateSections)) {
    trimmedSections[babId] = text.slice(0, 8000)
  }

  const { error } = await db()
    .from('ky_session')
    .update({
      template_text: fullText.slice(0, 60000),
      template_nama: file.name,
      template_sections: trimmedSections,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const parsedCount = Object.values(trimmedSections).filter(v => v.length > 50).length

  return NextResponse.json({ ok: true, chars: fullText.length, sections_parsed: parsedCount, sections: Object.fromEntries(Object.entries(trimmedSections).map(([k,v]) => [k, v.length])) })
}
