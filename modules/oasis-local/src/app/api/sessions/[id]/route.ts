import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: session, error } = await db()
    .from('offsite_sessions')
    .select('id, status, user_id, hasil')
    .eq('id', id)
    .single()

  if (error || !session) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  if (user.role === 'pemeriksa' && session.user_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ status: session.status, hasil: session.hasil })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: existing } = await db()
    .from('offsite_sessions')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  if (user.role === 'pemeriksa' && existing.user_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await db().from('offsite_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { hasil } = body as { hasil: unknown }

  if (!hasil) return NextResponse.json({ error: 'hasil wajib diisi' }, { status: 400 })

  // Pastikan session milik user ini (pemeriksa hanya bisa edit miliknya)
  const { data: existing } = await db()
    .from('offsite_sessions')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  if (user.role === 'pemeriksa' && existing.user_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await db()
    .from('offsite_sessions')
    .update({ status: 'selesai', hasil })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
