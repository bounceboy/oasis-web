import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Username-based registration — email tidak dipakai user
// Disimpan sebagai username@oasis.internal secara internal
export async function POST(req: NextRequest) {
  const { username, password, nama_lengkap, direktorat_id, departemen_id, nip } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
  }

  if (username.length < 3) {
    return NextResponse.json({ error: 'Username minimal 3 karakter' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const admin = createAdminClient()
  const internalEmail = `${username.toLowerCase().trim()}@oasis.internal`

  // Cek username sudah dipakai
  const { data: existing } = await admin
    .from('oasis_profiles')
    .select('id')
    .eq('username', username.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
  }

  // Buat user di Supabase Auth (email dikonfirmasi otomatis, tanpa kirim email)
  const { data, error } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username, nama_lengkap },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Upsert profile (trigger sudah buat row, kita update dengan data lengkap)
  await admin.from('oasis_profiles').upsert({
    id: data.user.id,
    username: username.toLowerCase().trim(),
    nama_lengkap: nama_lengkap ?? '',
    nip: nip ?? '',
    direktorat_id: direktorat_id || null,
    departemen_id: departemen_id || null,
    role: 'pemeriksa',
    status: 'pending',  // Admin harus aktivasi dulu
  })

  return NextResponse.json({ ok: true })
}
