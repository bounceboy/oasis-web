import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { username, password, nama_lengkap, nip, direktorat_id, departemen_id } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
  }
  if (username.length < 3) {
    return NextResponse.json({ error: 'Username minimal 3 karakter' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
  }

  // Hash password via Postgres crypt
  const { data: hashData } = await db().rpc('hash_password', { input_password: password })

  const { error } = await db().from('oasis_users').insert({
    username: username.toLowerCase().trim(),
    password_hash: hashData,
    nama_lengkap: nama_lengkap ?? '',
    nip: nip ?? '',
    direktorat_id: direktorat_id || null,
    departemen_id: departemen_id || null,
    role: 'pemeriksa',
    status: 'active',
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
