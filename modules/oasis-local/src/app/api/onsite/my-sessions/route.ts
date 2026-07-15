import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/onsite/my-sessions
// Admin: semua session. User lain: session yang pernah mereka upload dokumen/wawancara.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role === 'admin') {
    const { data, error } = await db()
      .from('onsite_sessions')
      .select('kode, nama_entitas, jenis_usaha, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Non-admin: ambil kode unik dari dokumen/wawancara yang mereka upload
  const [{ data: dok }, { data: waw }] = await Promise.all([
    db().from('onsite_dokumen').select('kode').eq('created_by', user.id),
    db().from('onsite_wawancara').select('kode').eq('created_by', user.id),
  ])

  const kodes = [...new Set([
    ...(dok ?? []).map((d: { kode: string }) => d.kode),
    ...(waw ?? []).map((w: { kode: string }) => w.kode),
  ])]

  if (kodes.length === 0) return NextResponse.json([])

  const { data, error } = await db()
    .from('onsite_sessions')
    .select('kode, nama_entitas, jenis_usaha, created_at')
    .in('kode', kodes)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
