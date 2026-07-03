import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyzeCompliance, analyzeRisk } from '@/lib/claude'
import { demaskText, detectLeaks } from '@/lib/masking'
import { searchRelevantPojk } from '@/lib/pojk-search'
import type { MaskingVault } from '@/types'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sessionId, maskedText, vault, namaEntitas, jenisUsaha } = body as {
    sessionId: string
    maskedText: string
    vault: MaskingVault
    namaEntitas: string
    jenisUsaha: string
  }

  if (!maskedText || !vault || !sessionId) {
    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
  }

  await db()
    .from('pemeriksaan_sessions')
    .update({ status: 'processing' })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  try {
    const pojkContext = await searchRelevantPojk(
      `${jenisUsaha} ${maskedText.slice(0, 500)}`
    )

    const complianceRaw = await analyzeCompliance({
      maskedText,
      pojkContext,
      namaEntitas,
      jenisUsaha,
    })

    const riskRaw = await analyzeRisk({
      maskedText,
      pojkContext,
      namaEntitas,
      jenisUsaha,
      complianceResult: complianceRaw,
    })

    const complianceFinal = demaskText(complianceRaw, vault)
    const riskFinal = demaskText(riskRaw, vault)

    const leaks = [
      ...detectLeaks(complianceFinal, vault),
      ...detectLeaks(riskFinal, vault),
    ]

    await db()
      .from('pemeriksaan_sessions')
      .update({
        status: 'selesai',
        hasil_compliance: complianceFinal,
        hasil_risk: riskFinal,
        pojk_context_used: pojkContext.slice(0, 5000),
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    return NextResponse.json({
      compliance: complianceFinal,
      risk: riskFinal,
      pojkContext,
      leaks,
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
