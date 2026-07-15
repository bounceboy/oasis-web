import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null

function _db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return _client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db(): any {
  return _db()
}
