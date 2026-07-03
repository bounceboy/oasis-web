import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
  }

  const supabase = await createClient()
  const internalEmail = `${username.toLowerCase().trim()}@oasis.internal`

  const { data, error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  })

  if (error) {
    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
  }

  // Cek status akun
  const { data: profile } = await supabase
    .from('oasis_profiles')
    .select('status, nama_lengkap, role')
    .eq('id', data.user.id)
    .single()

  if (profile?.status === 'suspended') {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' }, { status: 403 })
  }

  if (profile?.status === 'pending') {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Akun Anda sedang menunggu aktivasi dari administrator.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true, role: profile?.role })
}
