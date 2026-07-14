import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // 5 menit — AI analysis butuh waktu
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { searchRelevantPojk } from '@/lib/pojk-search'
import { isiKkRenbis } from '@/lib/renbis'
import { extractPdfPages } from '@/lib/pdf-chunker'

const MAX_FILE_SIZE = 52_428_800 // 50 MB

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const namaEntitas = (formData.get('namaEntitas') as string | null)?.trim()
  const tahun = (formData.get('tahun') as string | null)?.trim()

  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  if (!namaEntitas || !tahun)
    return NextResponse.json({ error: 'namaEntitas dan tahun wajib diisi' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File melebihi 50 MB' }, { status: 413 })
  if (!file.name.toLowerCase().endsWith('.pdf'))
    return NextResponse.json({ error: 'Hanya file PDF yang diterima' }, { status: 400 })

  // Buat session
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'renbis', nama_entitas: namaEntitas, jenis_usaha: 'asuransi', status: 'processing' })
    .select('id')
    .single()

  if (sessionErr || !session) return NextResponse.json({ error: 'Gagal membuat session' }, { status: 500 })
  const sessionId = session.id

  try {
    // 1. Ekstrak teks dari PDF
    const buf = Buffer.from(await file.arrayBuffer())
    const pages = await extractPdfPages(buf)
    const teks = pages.map((p) => p.text).join('\n\n')

    // 2. Ambil konteks POJK Renbis
    const pojkContext = await searchRelevantPojk('rencana bisnis perusahaan asuransi penyampaian', 10)

    // 3. AI isi KK
    const { kk_rows, analisis, kesimpulan } = await isiKkRenbis(teks, namaEntitas, tahun, pojkContext)

    const hasilData = {
      nama_perusahaan: namaEntitas,
      tahun,
      kk_rows,
      analisis,
      kesimpulan,
    }

    const { error: updateErr } = await db()
      .from('offsite_sessions')
      .update({ status: 'done', hasil: hasilData })
      .eq('id', sessionId)

    if (updateErr) console.error('[renbis] gagal update session:', updateErr.message)

    return NextResponse.json({ ...hasilData, sessionId })
  } catch (err) {
    await db().from('offsite_sessions').update({ status: 'error' }).eq('id', sessionId)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

