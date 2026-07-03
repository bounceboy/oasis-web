import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'oasis-secret-key-change-in-production'
)
const COOKIE = 'oasis_session'

const PUBLIC_PATHS = ['/login', '/register']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static / public
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Verifikasi JWT dari cookie
  const token = request.cookies.get(COOKIE)?.value
  let user: { role?: string } | null = null

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET)
      user = payload as { role?: string }
    } catch {
      user = null
    }
  }

  // Belum login → redirect ke /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Sudah login, coba akses /login atau /register → redirect ke /dashboard
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Proteksi /admin — hanya role admin
  if (pathname.startsWith('/admin') && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
