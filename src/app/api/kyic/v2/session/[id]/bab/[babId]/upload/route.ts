import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { BabId, KYIC_BABS_MAP } from '@/lib/kyic-sections'

export const maxDuration = 60

// POST — upload dokumen pendukung untuk bab tertentu
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; babId: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId, babId } = await params

  if (!KYIC_BABS_MAP[babId as BabId])
    return NextResponse.json({ error: 'BAB tidak valid' }, { status: 400 })

  const formData = await req.formData()
  const files = formData.getAll('file') as File[]
  if (!files.length) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

  const inserted: { id: string; nama_file: string }[] = []

  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = file.name.toLowerCase().split('.').pop() ?? ''

    let teks = ''
    try {
      if (ext === 'pdf') {
        const pdfParse = require('pdf-parse/lib/pdf-parse')
        teks = (await pdfParse(buf)).text
      } else if (['docx', 'doc'].includes(ext)) {
        const mammoth = await import('mammoth')
        teks = (await mammoth.extractRawText({ buffer: buf })).value
      } else if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(buf, { type: 'buffer' })
        teks = wb.SheetNames.map(s => XLSX.utils.sheet_to_csv(wb.Sheets[s])).join('\n\n')
      } else if (['pptx'].includes(ext)) {
        const AdmZip = (await import('adm-zip')).default
        const zip = new AdmZip(buf)
        const slides = zip.getEntries()
          .filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
          .map(e => e.getData().toString('utf-8').replace(/<[^>]+>/g, ' '))
        teks = slides.join('\n')
      } else {
        teks = buf.toString('utf-8').slice(0, 30000)
      }
    } catch {
      teks = `[Gagal membaca file: ${file.name}]`
    }

    const { data, error } = await db()
      .from('ky_dokumen')
      .insert({
        session_id: sessionId,
        bab_id: babId,
        nama_file: file.name,
        teks_ekstrak: teks.slice(0, 50000),
        uploaded_by: user.id,
      })
      .select('id, nama_file')
      .single()

    if (!error && data) inserted.push(data)
  }

  return NextResponse.json({ inserted })
}

// DELETE — hapus dokumen pendukung
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; babId: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { babId } = await params
  const { dokId } = await req.json()
  if (!dokId) return NextResponse.json({ error: 'dokId diperlukan' }, { status: 400 })

  const { error } = await db()
    .from('ky_dokumen')
    .delete()
    .eq('id', dokId)
    .eq('bab_id', babId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
