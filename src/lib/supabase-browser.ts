import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null

// Client-side Supabase client (anon key) — hanya dipakai untuk upload file
// langsung ke Storage lewat signed URL. Tidak dipakai untuk auth/DB — app ini
// pakai session JWT custom sendiri (lihat src/lib/auth.ts).
export function supabaseBrowser() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}
