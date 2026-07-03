import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, COOKIE_NAME, COOKIE_OPTIONS, type SessionUser } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('oasis_users')
    .select('id, username, nama_lengkap, role, status, direktorat_id, departemen_id, password_hash, oasis_direktorat(kode)')
    .eq('username', username.toLowerCase().trim())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
  }

  const { data: pwCheck } = await db()
    .rpc('verify_password', { input_password: password, hash: data.password_hash })

  if (!pwCheck) {
    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
  }

  if (data.status === 'suspended') {
    return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' }, { status: 403 })
  }

  await db().from('oasis_users').update({ last_login: new Date().toISOString() }).eq('id', data.id)

  // Use direktorat KODE (e.g. "DPSS") as direktorat_id in session — the OASIS app needs the code
  const direktoratKode = data.oasis_direktorat?.kode ?? null

  const user: SessionUser = {
    id: data.id,
    username: data.username,
    nama_lengkap: data.nama_lengkap,
    role: data.role,
    direktorat_id: direktoratKode,
    departemen_id: data.departemen_id,
    status: data.status,
  }

  const token = await createSession(user)
  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)
  return res
}
