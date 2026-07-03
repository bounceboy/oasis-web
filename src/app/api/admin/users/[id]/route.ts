import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const [{ data: userProfile }, { data: authUser }] = await Promise.all([
    admin.from('oasis_profiles').select('*').eq('id', id).single(),
    admin.auth.admin.getUserById(id),
  ])

  if (!userProfile) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  return NextResponse.json({ ...userProfile, email: authUser.user?.email })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('oasis_profiles')
    .update({
      nama_lengkap: body.nama_lengkap,
      role: body.role,
      direktorat: body.direktorat,
      departemen: body.departemen,
      nip: body.nip,
      status: body.status,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Jangan hapus diri sendiri
  if (id === profile.id) {
    return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
