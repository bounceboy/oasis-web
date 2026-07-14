import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractExcelSheets } from '@/lib/xlsx-extractor'
import { ekstrakDataLhptl, analisisLhptl } from '@/lib/lhptl'

const MAX_FILE_SIZE = 20_971_520 // 20 MB

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const namaEntitas = (formData.get('namaEntitas') as string | null)?.trim()
  const jenisEntitas = (formData.get('jenisEntitas') as string | null) as 'pialang_asuransi' | 'pialang_reasuransi' | null
  const periode = (formData.get('periode') as string | null)?.trim()

  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  if (!namaEntitas || !jenisEntitas || !periode)
    return NextResponse.json({ error: 'namaEntitas, jenisEntitas, dan periode wajib diisi' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File melebihi 20 MB' }, { status: 413 })
  if (!file.name.toLowerCase().match(/\.(xlsx|xlsm|xls)$/))
    return NextResponse.json({ error: 'Hanya file Excel (.xlsx/.xlsm/.xls) yang diterima' }, { status: 400 })

  // Buat session dulu
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'lhptl', nama_entitas: namaEntitas, jenis_usaha: jenisEntitas, status: 'processing' })
    .select('id')
    .single()

  if (sessionErr || !session) return NextResponse.json({ error: 'Gagal membuat session' }, { status: 500 })
  const sessionId = session.id

  try {
    // 1. Parse Excel
    const buf = Buffer.from(await file.arrayBuffer())
    const sheets = extractExcelSheets(buf)

    // 2. AI extraction
    const extracted = await ekstrakDataLhptl(sheets, namaEntitas, jenisEntitas, periode)

    // 3. Rules + AI kesimpulan
    const { hasil, kesimpulan, tindak_lanjut } = await analisisLhptl(extracted)

    const ringkasan = {
      total: hasil.length,
      pelanggaran: hasil.filter((h) => h.tipe === 'pelanggaran').length,
      perlu_perhatian: hasil.filter((h) => h.tipe === 'perlu_perhatian').length,
      informasional: hasil.filter((h) => h.tipe === 'informasional').length,
    }

    const hasilData = {
      nama_perusahaan: extracted.nama_perusahaan,
      jenis_entitas: jenisEntitas,
      periode,
      hasil_pengawasan: hasil,
      kesimpulan,
      tindak_lanjut,
      ringkasan,
    }

    // Simpan ke session
    await db()
      .from('offsite_sessions')
      .update({ status: 'done', hasil: hasilData })
      .eq('id', sessionId)

    return NextResponse.json({ ...hasilData, sessionId })
  } catch (err) {
    await db().from('offsite_sessions').update({ status: 'error' }).eq('id', sessionId)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
