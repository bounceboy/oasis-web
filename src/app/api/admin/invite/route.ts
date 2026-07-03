import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const profile = await requireAdmin()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, nama_lengkap, role, direktorat, departemen, nip } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })

  const admin = createAdminClient()

  // Invite user via Supabase Auth
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nama_lengkap, role, direktorat, departemen, nip },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upsert profile dengan data yang diberikan
  await admin.from('oasis_profiles').upsert({
    id: data.user.id,
    nama_lengkap: nama_lengkap ?? '',
    role: role ?? 'pemeriksa',
    direktorat: direktorat ?? '',
    departemen: departemen ?? '',
    nip: nip ?? '',
    status: 'pending',
  })

  return NextResponse.json({ ok: true, userId: data.user.id })
}
