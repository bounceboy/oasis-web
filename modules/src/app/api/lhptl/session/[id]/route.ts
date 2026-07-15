import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let query = db()
    .from('offsite_sessions')
    .select('id, modul, nama_entitas, jenis_usaha, status, hasil, created_at')
    .eq('id', id)

  if (user.role === 'pemeriksa') {
    query = query.eq('user_id', user.id) as typeof query
  }

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  return NextResponse.json({ ...data.hasil, sessionId: data.id, status: data.status })
}
