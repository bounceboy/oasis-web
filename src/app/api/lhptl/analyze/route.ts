import { NextRequest, NextResponse, after } from 'next/server'
export const maxDuration = 300
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractExcelSheets, type SheetText } from '@/lib/xlsx-extractor'
import { ekstrakDataLhptl, analisisLhptl } from '@/lib/lhptl'

const BUCKET = 'lhptl-uploads'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { pathLapkeu, fileName, pathGcg, fileNameGcg, pathLapkeuPrev, fileNameLapkeuPrev, namaEntitas: namaEntitasRaw, jenisEntitas, periode: periodeRaw } = body

  const namaEntitas = (namaEntitasRaw as string | undefined)?.trim()
  const periode = (periodeRaw as string | undefined)?.trim()

  if (!pathLapkeu || !fileName) return NextResponse.json({ error: 'File laporan keuangan tidak ditemukan' }, { status: 400 })
  if (!pathGcg || !fileNameGcg) return NextResponse.json({ error: 'File laporan GCG tidak ditemukan' }, { status: 400 })
  if (!pathLapkeuPrev || !fileNameLapkeuPrev) return NextResponse.json({ error: 'File laporan keuangan tahun sebelumnya tidak ditemukan' }, { status: 400 })
  if (!namaEntitas || !jenisEntitas || !periode)
    return NextResponse.json({ error: 'namaEntitas, jenisEntitas, dan periode wajib diisi' }, { status: 400 })
  if (!(fileName as string).toLowerCase().match(/\.(xlsx|xlsm|xls)$/))
    return NextResponse.json({ error: 'File laporan keuangan harus berformat Excel (.xlsx/.xlsm/.xls)' }, { status: 400 })
  if (!(fileNameGcg as string).toLowerCase().match(/\.(xlsx|xlsm|xls)$/))
    return NextResponse.json({ error: 'File laporan GCG harus berformat Excel (.xlsx/.xlsm/.xls)' }, { status: 400 })
  if (!(fileNameLapkeuPrev as string).toLowerCase().match(/\.(xlsx|xlsm|xls)$/))
    return NextResponse.json({ error: 'File laporan keuangan tahun sebelumnya harus berformat Excel (.xlsx/.xlsm/.xls)' }, { status: 400 })

  // Buat session dulu
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'lhptl', nama_entitas: namaEntitas, jenis_usaha: jenisEntitas, status: 'processing' })
    .select('id')
    .single()

  if (sessionErr || !session) return NextResponse.json({ error: 'Gagal membuat session' }, { status: 500 })
  const sessionId = session.id

  after(async () => {
    await runLhptlAnalysis(sessionId, pathLapkeu, pathGcg, pathLapkeuPrev, namaEntitas, jenisEntitas, periode).catch(err => {
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

async function downloadSheets(path: string, prefix: string): Promise<SheetText[]> {
  const { data, error } = await db().storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Gagal mengunduh file dari storage (${path}): ${error?.message ?? 'unknown'}`)
  const buf = Buffer.from(await data.arrayBuffer())
  return extractExcelSheets(buf).map(s => ({ ...s, name: prefix ? `${prefix}${s.name}` : s.name }))
}

async function runLhptlAnalysis(
  sessionId: string,
  pathLapkeu: string,
  pathGcg: string,
  pathLapkeuPrev: string,
  namaEntitas: string,
  jenisEntitas: 'pialang_asuransi' | 'pialang_reasuransi',
  periode: string
) {
  const paths = [pathLapkeu, pathGcg, pathLapkeuPrev]

  try {
    const sheetsLapkeu = await downloadSheets(pathLapkeu, '')
    const sheetsGcg = await downloadSheets(pathGcg, 'GCG_')
    const sheetsLapkeuPrev = await downloadSheets(pathLapkeuPrev, 'PREV_')
    const sheets = [...sheetsLapkeu, ...sheetsGcg, ...sheetsLapkeuPrev]

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
      raw: extracted,
    }

    // Simpan ke session
    await db()
      .from('offsite_sessions')
      .update({ status: 'selesai', hasil: hasilData })
      .eq('id', sessionId)
  } catch (err) {
    await db().from('offsite_sessions').update({ status: 'error' }).eq('id', sessionId)
    throw err
  } finally {
    // Bersihkan file upload sementara di storage
    await db().storage.from(BUCKET).remove(paths).catch(() => {})
  }
}
