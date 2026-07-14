import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 300
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { searchRelevantPojk } from '@/lib/pojk-search'
import { searchSedk, searchPsak117 } from '@/lib/sedk-search'
import {
  ekstrakDataKeuangan,
  hitungRasio,
  buildScorecard,
  hitungSkor,
  analisaCompliance,
  petakanRisiko,
  type JenisUsaha,
} from '@/lib/psak117'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { teksLapkeu, namaEntitas, jenisUsaha, periode } = body as {
    teksLapkeu: string
    namaEntitas: string
    jenisUsaha: JenisUsaha
    periode: string
  }

  if (!teksLapkeu || !namaEntitas || !jenisUsaha) {
    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
  }

  // Buat session
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({
      user_id: user.id,
      modul: 'psak117',
      nama_entitas: namaEntitas,
      jenis_usaha: jenisUsaha,
      status: 'processing',
    })
    .select('id')
    .single()

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Gagal membuat sesi' }, { status: 500 })
  }

  const sessionId = session.id

  try {
    // Step 1: Ekstrak data keuangan dari PDF text
    const dataKeuangan = await ekstrakDataKeuangan(teksLapkeu, namaEntitas, jenisUsaha)
    if (periode) dataKeuangan.periode = periode

    // Step 2: Hitung rasio & scorecard
    const rasio = hitungRasio(dataKeuangan)
    const scorecard = buildScorecard(rasio, jenisUsaha)
    const { skor, total, rating } = hitungSkor(scorecard)

    // Step 3: Cari referensi POJK, SEDK, dan Petunjuk Teknis PSAK 117 secara paralel
    const pojkQuery = `tingkat solvabilitas kesehatan keuangan asuransi ${jenisUsaha} PSAK 117`
    const sedkQuery = `risiko asuransi PSAK 117 IFRS 17 ${jenisUsaha} CSM liabilitas kontrak`
    const psak117Query = `pengukuran liabilitas kontrak asuransi CSM arus kas pemenuhan ${jenisUsaha}`
    const [pojkContext, sedkContext, psak117Context] = await Promise.all([
      searchPojkKesehatan(pojkQuery),
      searchSedk(sedkQuery),
      searchPsak117(psak117Query, 5),
    ])

    // Step 4: Analisis AI — compliance pakai POJK + Petunjuk Teknis, risiko pakai SEDK
    const combinedPojkContext = `${pojkContext}\n\n---\n\n${psak117Context}`
    const [compliance, pemetaanRisiko] = await Promise.all([
      analisaCompliance(dataKeuangan, rasio, scorecard, combinedPojkContext, namaEntitas, jenisUsaha),
      petakanRisiko(dataKeuangan, rasio, sedkContext, namaEntitas, jenisUsaha),
    ])

    const hasil = {
      metadata: { namaEntitas, jenisUsaha, periode: dataKeuangan.periode },
      data_keuangan: dataKeuangan,
      rasio,
      scorecard,
      skor: { nilai: skor, total, rating },
      compliance,
      pemetaan_risiko: pemetaanRisiko,
      referensi: {
        pojk: pojkContext.slice(0, 2000),
        sedk: sedkContext.slice(0, 2000),
        psak117: psak117Context.slice(0, 2000),
      },
    }

    await db()
      .from('offsite_sessions')
      .update({ status: 'selesai', hasil })
      .eq('id', sessionId)

    return NextResponse.json({ sessionId, ...hasil })
  } catch (err) {
    await db()
      .from('offsite_sessions')
      .update({ status: 'error' })
      .eq('id', sessionId)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analisis gagal' },
      { status: 500 }
    )
  }
}

async function searchPojkKesehatan(query: string): Promise<string> {
  const { data } = await db()
    .from('pojk_chunks')
    .select('source, pasal, content')
    .in('source', ['POJK No. 26 Tahun 2025', 'POJK No. 5 Tahun 2023', 'POJK No. 69 Tahun 2016'])
    .textSearch('fts', query.split(' ').slice(0, 6).join(' | '), { type: 'plain', config: 'simple' })
    .limit(8)

  if (!data?.length) return searchRelevantPojk(query, 6)

  return (data as Array<{ source: string; pasal: string; content: string }>)
    .map((c) => `[${c.source} — ${c.pasal}]\n${c.content}`)
    .join('\n\n---\n\n')
}
