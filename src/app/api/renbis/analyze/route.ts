import { NextRequest, NextResponse, after } from 'next/server'

export const maxDuration = 300 // 5 menit — AI analysis butuh waktu
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { searchRelevantPojk } from '@/lib/pojk-search'
import { isiKkRenbis } from '@/lib/renbis'
import { extractPdfPages } from '@/lib/pdf-chunker'

const BUCKET = 'renbis-uploads'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { path, fileName, namaEntitas: namaEntitasRaw, tahun: tahunRaw } = body

  const namaEntitas = (namaEntitasRaw as string | undefined)?.trim()
  const tahun = (tahunRaw as string | undefined)?.trim()

  if (!path || !fileName) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  if (!namaEntitas || !tahun)
    return NextResponse.json({ error: 'namaEntitas dan tahun wajib diisi' }, { status: 400 })
  if (!(fileName as string).toLowerCase().endsWith('.pdf'))
    return NextResponse.json({ error: 'Hanya file PDF yang diterima' }, { status: 400 })

  // Buat session
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'renbis', nama_entitas: namaEntitas, jenis_usaha: 'asuransi', status: 'processing' })
    .select('id')
    .single()

  if (sessionErr || !session) return NextResponse.json({ error: 'Gagal membuat session' }, { status: 500 })
  const sessionId = session.id

  // ─── Background job ──────────────────────────────────────────────────────────
  // after() menjaga job tetap hidup setelah response terkirim (wajib di Vercel serverless).
  after(async () => {
    await runRenbisAnalysis(sessionId, path, namaEntitas, tahun).catch(err => {
      console.error(`[Renbis ${sessionId}] Background job error:`, err)
    })
  })

  // Return sessionId segera (status: processing)
  return NextResponse.json({
    sessionId,
    status: 'processing',
    message: 'Analisis dimulai. Polling untuk melihat progres.',
  })
}

async function runRenbisAnalysis(
  sessionId: string,
  path: string,
  namaEntitas: string,
  tahun: string
) {
  try {
    // 0. Download file dari storage
    const { data, error: downloadErr } = await db().storage.from(BUCKET).download(path)
    if (downloadErr || !data) throw new Error(`Gagal mengunduh file dari storage (${path}): ${downloadErr?.message ?? 'unknown'}`)
    const buf = Buffer.from(await data.arrayBuffer())

    // 1. Ekstrak teks dari PDF
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
      .update({ status: 'selesai', hasil: hasilData })
      .eq('id', sessionId)

    if (updateErr) console.error('[renbis] gagal update session:', updateErr.message)
  } catch (err) {
    await db().from('offsite_sessions').update({ status: 'error' }).eq('id', sessionId)
    throw err
  } finally {
    // Bersihkan file upload sementara di storage (best-effort)
    await db().storage.from(BUCKET).remove([path]).catch(() => {})
  }
}

