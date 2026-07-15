import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'oasis-secret-key-change-in-production'
)
const COOKIE = 'oasis_session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Route publik — tidak perlu auth
  if (
    pathname === '/app' || pathname.startsWith('/app/') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' || pathname === '/register'
  ) {
    return NextResponse.next()
  }

  // Verifikasi JWT
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

  // Root → redirect ke dashboard jika login, login jika belum
  if (pathname === '/') {
    return NextResponse.redirect(new URL(user ? '/dashboard' : '/login', request.url))
  }

  // Belum login → ke /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
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
