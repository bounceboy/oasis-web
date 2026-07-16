import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/session'

// SENGAJA HANYA POST — jangan tambah GET handler di sini. Next.js otomatis
// prefetch semua <Link> yang terlihat di viewport lewat GET request diam-diam;
// kalau signout juga menerima GET, dashboard yang punya <Link> ke endpoint ini
// akan ter-logout sendiri beberapa saat setelah halaman dimuat, sebelum user
// sempat klik apa pun. Logout HARUS dipicu lewat fetch(POST) eksplisit dari JS,
// tidak boleh lewat navigasi <Link>/<a> biasa.
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url))
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return res
}
