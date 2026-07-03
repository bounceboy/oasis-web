import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'oasis-secret-key-change-in-production'
)
const COOKIE = 'oasis_session'
const TTL = 60 * 60 * 8 // 8 jam

export type SessionUser = {
  id: string
  username: string
  nama_lengkap: string
  role: 'admin' | 'supervisor' | 'pemeriksa'
  direktorat_id: string | null
  departemen_id: string | null
  status: string
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(SECRET)
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export const COOKIE_NAME = COOKIE
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: TTL,
  path: '/',
}
