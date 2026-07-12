import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyzeCompliance, analyzeRisk } from '@/lib/claude'
import { searchRelevantPojk } from '@/lib/pojk-search'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sessionId, docText, namaEntitas, jenisUsaha } = body as {
    sessionId: string
    docText: string
    namaEntitas: string
    jenisUsaha: string
  }

  if (!docText || !sessionId) {
    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
  }

  await db()
    .from('pemeriksaan_sessions')
    .update({ status: 'processing' })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  try {
    const pojkContext = await searchRelevantPojk(
      `${jenisUsaha} ${docText.slice(0, 500)}`
    )

    const complianceResult = await analyzeCompliance({
      docText,
      pojkContext,
      namaEntitas,
      jenisUsaha,
    })

    const riskResult = await analyzeRisk({
      docText,
      pojkContext,
      namaEntitas,
      jenisUsaha,
      complianceResult,
    })

    await db()
      .from('pemeriksaan_sessions')
      .update({
        status: 'selesai',
        hasil_compliance: complianceResult,
        hasil_risk: riskResult,
        pojk_context_used: pojkContext.slice(0, 5000),
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    return NextResponse.json({
      compliance: complianceResult,
      risk: riskResult,
      pojkContext,
    })
  } catch (err) {
    await db()
      .from('pemeriksaan_sessions')
      .update({ status: 'error' })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analisis gagal' },
      { status: 500 }
    )
  }
}
