import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/onsite/sessions/[kode] — detail session + stats
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kode: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kode } = await params
  const upperKode = kode.toUpperCase()

  const [sessionRes, dokRes, wawRes, temuanRes] = await Promise.all([
    db().from('onsite_sessions').select('*').eq('kode', upperKode).single(),
    db().from('onsite_dokumen').select('*').eq('kode', upperKode).order('created_at', { ascending: false }),
    db().from('onsite_wawancara').select('*').eq('kode', upperKode).order('created_at', { ascending: false }),
    db().from('onsite_temuan').select('*').eq('kode', upperKode).order('created_at', { ascending: false }),
  ])

  if (sessionRes.error || !sessionRes.data)
    return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })

  const temuan = temuanRes.data ?? []
  return NextResponse.json({
    session: sessionRes.data,
    dokumen: dokRes.data ?? [],
    wawancara: wawRes.data ?? [],
    temuan,
    stats: {
      dokumen: (dokRes.data ?? []).length,
      wawancara: (wawRes.data ?? []).length,
      temuan: temuan.length,
      kritis: temuan.filter(t => t.urgensi === 'kritis').length,
      dikonfirmasi: temuan.filter(t => t.status === 'dikonfirmasi').length,
    },
  })
}
