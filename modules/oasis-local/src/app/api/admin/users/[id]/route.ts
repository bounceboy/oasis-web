import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: user, error } = await db()
    .from('oasis_users')
    .select('id, username, nama_lengkap, nip, role, status, direktorat_id, departemen_id')
    .eq('id', id)
    .single()

  if (error || !user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {
    nama_lengkap: body.nama_lengkap,
    role: body.role,
    direktorat_id: body.direktorat_id || null,
    departemen_id: body.departemen_id || null,
    nip: body.nip,
    status: body.status,
  }

  if (body.new_password) {
    if (body.new_password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }
    const { data: hash } = await db().rpc('hash_password', { input_password: body.new_password })
    updateData.password_hash = hash
  }

  const { error } = await db().from('oasis_users').update(updateData).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (id === profile.id) {
    return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
  }

  const { error } = await db().from('oasis_users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
