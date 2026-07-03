import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Redirect ke login jika belum login
  if (!user && pathname !== '/login' && !pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect ke dashboard jika sudah login dan akses /login
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Proteksi route /admin — cek role di database
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('oasis_profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Cek status akun suspended
  if (user && !pathname.startsWith('/api') && pathname !== '/login') {
    const { data: profile } = await supabase
      .from('oasis_profiles')
      .select('status')
      .eq('id', user.id)
      .single()

    if (profile?.status === 'suspended') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=suspended', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
