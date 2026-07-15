import { NextRequest, NextResponse, after } from 'next/server'
export const maxDuration = 300
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractExcelSheets, type SheetText } from '@/lib/xlsx-extractor'
import { ekstrakDataLhptl, analisisLhptl } from '@/lib/lhptl'

const MAX_FILE_SIZE = 20_971_520 // 20 MB

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const fileGcg = formData.get('fileGcg') as File | null
  const namaEntitas = (formData.get('namaEntitas') as string | null)?.trim()
  const jenisEntitas = (formData.get('jenisEntitas') as string | null) as 'pialang_asuransi' | 'pialang_reasuransi' | null
  const periode = (formData.get('periode') as string | null)?.trim()

  if (!file) return NextResponse.json({ error: 'File laporan keuangan tidak ditemukan' }, { status: 400 })
  if (!fileGcg) return NextResponse.json({ error: 'File laporan GCG tidak ditemukan' }, { status: 400 })
  if (!namaEntitas || !jenisEntitas || !periode)
    return NextResponse.json({ error: 'namaEntitas, jenisEntitas, dan periode wajib diisi' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File laporan keuangan melebihi 20 MB' }, { status: 413 })
  if (fileGcg.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File laporan GCG melebihi 20 MB' }, { status: 413 })
  if (!file.name.toLowerCase().match(/\.(xlsx|xlsm|xls)$/))
    return NextResponse.json({ error: 'File laporan keuangan harus berformat Excel (.xlsx/.xlsm/.xls)' }, { status: 400 })
  if (!fileGcg.name.toLowerCase().match(/\.(xlsx|xlsm|xls)$/))
    return NextResponse.json({ error: 'File laporan GCG harus berformat Excel (.xlsx/.xlsm/.xls)' }, { status: 400 })

  // Buat session dulu
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'lhptl', nama_entitas: namaEntitas, jenis_usaha: jenisEntitas, status: 'processing' })
    .select('id')
    .single()

  if (sessionErr || !session) return NextResponse.json({ error: 'Gagal membuat session' }, { status: 500 })
  const sessionId = session.id

  // ─── Background job ──────────────────────────────────────────────────────────
  // Parse Excel dulu (cepat), lalu analisis AI jalan via after() agar tetap hidup
  // setelah response terkirim (wajib di Vercel serverless).
  const buf = Buffer.from(await file.arrayBuffer())
  const sheetsLapkeu = extractExcelSheets(buf)

  const bufGcg = Buffer.from(await fileGcg.arrayBuffer())
  const sheetsGcg = extractExcelSheets(bufGcg).map(s => ({ ...s, name: `GCG_${s.name}` }))

  const sheets = [...sheetsLapkeu, ...sheetsGcg]

  after(async () => {
    await runLhptlAnalysis(sessionId, sheets, namaEntitas, jenisEntitas, periode).catch(err => {
      console.error(`[LHPTL ${sessionId}] Background job error:`, err)
    })
  })

  // Return sessionId segera (status: processing)
  return NextResponse.json({
    sessionId,
    status: 'processing',
    message: 'Analisis dimulai. Polling untuk melihat progres.',
  })
}

async function runLhptlAnalysis(
  sessionId: string,
  sheets: SheetText[],
  namaEntitas: string,
  jenisEntitas: 'pialang_asuransi' | 'pialang_reasuransi',
  periode: string
) {
  try {
    // AI extraction
    const extracted = await ekstrakDataLhptl(sheets, namaEntitas, jenisEntitas, periode)

    // Rules + AI kesimpulan
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
      .update({ status: 'selesai', hasil: hasilData })
      .eq('id', sessionId)
  } catch (err) {
    await db().from('offsite_sessions').update({ status: 'error' }).eq('id', sessionId)
    throw err
  }
}
