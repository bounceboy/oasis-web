import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { prosesKyic } from '@/lib/kyic'

const MAX_TEMPLATE = 20_971_520  // 20 MB
const MAX_DOC      = 52_428_800  // 50 MB per file

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const templateFile     = formData.get('template') as File | null
  const namaEntitas      = (formData.get('namaEntitas') as string | null)?.trim()
  const periode          = (formData.get('periode') as string | null)?.trim()
  const catatanPengawas  = (formData.get('catatanPengawas') as string | null)?.trim() ?? ''

  if (!templateFile || !namaEntitas || !periode)
    return NextResponse.json({ error: 'template, namaEntitas, dan periode wajib diisi' }, { status: 400 })
  if (templateFile.size > MAX_TEMPLATE)
    return NextResponse.json({ error: 'Template melebihi 20 MB' }, { status: 413 })
  if (!templateFile.name.toLowerCase().endsWith('.docx'))
    return NextResponse.json({ error: 'Template harus berformat .docx' }, { status: 400 })

  // Kumpulkan dokumen pendukung (bisa banyak field 'docs[]' atau satu ZIP)
  const dokumenFiles: Array<{ name: string; buf: Buffer; type: string }> = []
  const rawDocs = formData.getAll('docs[]')

  for (const raw of rawDocs) {
    if (!(raw instanceof File)) continue
    if (raw.size > MAX_DOC) continue  // skip file terlalu besar
    const ext = raw.name.toLowerCase().split('.').pop() ?? ''
    if (!['pdf','docx','doc','xlsx','xls','xlsm','png','jpg','jpeg'].includes(ext)) continue
    dokumenFiles.push({ name: raw.name, buf: Buffer.from(await raw.arrayBuffer()), type: raw.type })
  }

  // Kalau ada ZIP, extract
  const zipFile = formData.get('zip') as File | null
  if (zipFile) {
    const { default: AdmZip } = await import('adm-zip')
    const zip = new AdmZip(Buffer.from(await zipFile.arrayBuffer()))
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue
      const ext = entry.name.toLowerCase().split('.').pop() ?? ''
      if (!['pdf','docx','doc','xlsx','xls','xlsm','png','jpg','jpeg'].includes(ext)) continue
      dokumenFiles.push({ name: entry.name, buf: entry.getData(), type: '' })
    }
  }

  // Buat session
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'kyic', nama_entitas: namaEntitas, jenis_usaha: 'asuransi', status: 'processing' })
    .select('id')
    .single()

  if (sessionErr || !session) return NextResponse.json({ error: 'Gagal membuat session' }, { status: 500 })
  const sessionId = session.id

  try {
    const templateBuf = Buffer.from(await templateFile.arrayBuffer())
    const progressLog: string[] = []

    const { docxBuf, hasil } = await prosesKyic(
      templateBuf,
      dokumenFiles,
      (msg) => progressLog.push(msg),
      catatanPengawas
    )

    // Simpan docx ke hasil (base64) + metadata
    const hasilData = {
      ...hasil,
      docx_b64: docxBuf.toString('base64'),
      progress_log: progressLog,
    }

    await db()
      .from('offsite_sessions')
      .update({ status: 'done', hasil: hasilData })
      .eq('id', sessionId)

    // Return tanpa docx_b64 (terlalu besar untuk JSON response)
    const { docx_b64: _, ...hasilTanpaDocx } = hasilData
    return NextResponse.json({ ...hasilTanpaDocx, sessionId })
  } catch (err) {
    await db().from('offsite_sessions').update({ status: 'error' }).eq('id', sessionId)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
