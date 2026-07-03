import { createClient } from '@/lib/supabase/server'
import type { OasisProfile } from '@/types'

export async function getProfile(): Promise<OasisProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('oasis_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return { ...data, email: user.email }
}

export async function requireAdmin() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') {
    return null
  }
  return profile
}

export async function requireRole(...roles: string[]) {
  const profile = await getProfile()
  if (!profile || !roles.includes(profile.role)) return null
  return profile
}
