import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const [{ data: userProfile }, { data: authUser }] = await Promise.all([
    admin.from('oasis_profiles')
      .select('*, oasis_direktorat(id, kode, nama), oasis_departemen(id, kode, nama)')
      .eq('id', id)
      .single(),
    admin.auth.admin.getUserById(id),
  ])

  if (!userProfile) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  const email = authUser.user?.email ?? ''
  const username = email.replace('@oasis.internal', '')

  return NextResponse.json({ ...userProfile, email, username })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  const updateData: Record<string, unknown> = {
    nama_lengkap: body.nama_lengkap,
    role: body.role,
    direktorat_id: body.direktorat_id || null,
    departemen_id: body.departemen_id || null,
    nip: body.nip,
    status: body.status,
  }

  // Jika ada password baru
  if (body.new_password) {
    if (body.new_password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }
    await admin.auth.admin.updateUserById(id, { password: body.new_password })
  }

  const { error } = await admin.from('oasis_profiles').update(updateData).eq('id', id)
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

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
