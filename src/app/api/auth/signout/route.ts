import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/session'

function signOut(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url))
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return res
}

export async function POST(req: NextRequest) {
  return signOut(req)
}

// Mendukung navigasi lewat <Link> biasa (GET), selain fetch POST dari Navbar
export async function GET(req: NextRequest) {
  return signOut(req)
}
