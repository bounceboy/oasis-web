import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, COOKIE_NAME, COOKIE_OPTIONS, type SessionUser } from '@/lib/session'

// Mapping direktorat kode → username di oasis_users
const DIREKTORAT_USERNAME: Record<string, string> = {
  DPSS: 'dpss',
  DAJI: 'daji',
  DASR: 'dasr',
  DPJP: 'dpjp',
  DPDP: 'dpdp',
  PENJAMINAN: 'penjaminan',
  DEMO: 'demo',
}

export async function POST(req: NextRequest) {
  const { direktorat, api_key } = await req.json()

  if (!direktorat || !api_key) {
    return NextResponse.json({ error: 'Direktorat dan API key wajib diisi' }, { status: 400 })
  }

  // Validasi format API key Anthropic
  if (!api_key.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'Format API key tidak valid. Harus diawali sk-ant-' }, { status: 400 })
  }

  const username = DIREKTORAT_USERNAME[direktorat.toUpperCase()]
  if (!username) {
    return NextResponse.json({ error: 'Direktorat tidak dikenali' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('oasis_users')
    .select('id, username, nama_lengkap, role, status, direktorat_id, departemen_id, oasis_direktorat(kode)')
    .eq('username', username)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Akun direktorat tidak ditemukan' }, { status: 401 })
  }

  if (data.status === 'suspended') {
    return NextResponse.json({ error: 'Akun direktorat ini dinonaktifkan.' }, { status: 403 })
  }

  await db().from('oasis_users').update({ last_login: new Date().toISOString() }).eq('id', data.id)

  // Log API key yang digunakan (simpan hash 8 char terakhir saja untuk privacy)
  const keyMask = '****' + api_key.slice(-8)
  await db().from('login_log').insert({
    direktorat: direktorat.toUpperCase(),
    api_key_mask: keyMask,
    api_key_prefix: api_key.slice(0, 20),
  }).select()

  const direktoratKode = (data.oasis_direktorat as { kode: string } | null)?.kode ?? direktorat.toUpperCase()

  // DPSS otomatis jadi admin
  const effectiveRole = direktorat.toUpperCase() === 'DPSS' ? 'admin' : (data.role as 'admin' | 'supervisor' | 'pemeriksa')

  const user: SessionUser = {
    id: data.id,
    username: data.username,
    nama_lengkap: data.nama_lengkap,
    role: effectiveRole,
    direktorat_id: direktoratKode,
    departemen_id: data.departemen_id,
    status: data.status,
    api_key,
  }

  const token = await createSession(user)
  const res = NextResponse.json({ ok: true, role: effectiveRole, direktorat: direktoratKode })
  res.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)
  return res
}
