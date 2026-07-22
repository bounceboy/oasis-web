import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET — list sesi PSAK milik user
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db()
    .from('psak_session')
    .select('id, nama_entitas, jenis_usaha, periode, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — buat sesi baru
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nama_entitas, jenis_usaha, periode } = await req.json()
  if (!nama_entitas || !jenis_usaha) {
    return NextResponse.json({ error: 'nama_entitas dan jenis_usaha wajib diisi' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('psak_session')
    .insert({ user_id: user.id, nama_entitas, jenis_usaha, periode: periode || null, status: 'idle' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
