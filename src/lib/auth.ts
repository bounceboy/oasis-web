import { getSession, type SessionUser } from '@/lib/session'

export async function getUser(): Promise<SessionUser | null> {
  return getSession()
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSession()
  if (!user || user.role !== 'admin') return null
  return user
}
