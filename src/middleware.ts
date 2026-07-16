import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'oasis-secret-key-change-in-production'
)
const COOKIE = 'oasis_session'

// Response auth (redirect atau next) TIDAK BOLEH di-cache oleh Vercel Edge Network —
// kalau tidak, redirect ke /login yang terjadi saat belum login bisa "menempel"
// dan terus disajikan ke request berikutnya walau cookie sudah valid.
function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store, must-revalidate')
  return res
}

// TEMPORARY DIAGNOSTIC — remove after use.
async function hashPrefix(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // TEMPORARY DIAGNOSTIC — remove after use.
  if (pathname === '/api/debug-secret') {
    const res = NextResponse.next()
    res.headers.set('x-mw-hash', await hashPrefix(process.env.SESSION_SECRET ?? 'FALLBACK_USED'))
    res.headers.set('x-mw-region', process.env.VERCEL_REGION ?? 'unknown')
    res.headers.set('x-mw-cookie-count', String(request.cookies.getAll().filter((c) => c.name === COOKIE).length))
    res.headers.set('x-mw-cookie-raw', request.headers.get('cookie') ?? '(none)')
    return noStore(res)
  }

  // Route publik — tidak perlu auth
  if (
    pathname === '/app' || pathname.startsWith('/app/') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' || pathname === '/register'
  ) {
    return noStore(NextResponse.next())
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
    return noStore(NextResponse.redirect(new URL(user ? '/dashboard' : '/login', request.url)))
  }

  // Belum login → ke /login
  if (!user) {
    return noStore(NextResponse.redirect(new URL('/login', request.url)))
  }

  // Proteksi /admin — hanya role admin
  if (pathname.startsWith('/admin') && user.role !== 'admin') {
    return noStore(NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  return noStore(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
