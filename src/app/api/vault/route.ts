import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MaskingVault, MaskingEntity } from '@/types'

// Simpan vault masking ke Supabase (terenkripsi via RLS + service role)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, vault, entities } = await req.json() as {
    sessionId: string
    vault: MaskingVault
    entities: MaskingEntity[]
  }

  const { error } = await supabase
    .from('masking_vaults')
    .upsert({
      session_id: sessionId,
      user_id: user.id,
      vault_data: vault,
      entities_summary: entities.map((e) => ({
        token: e.token,
        category: e.category,
        // Simpan original terenkripsi — RLS pastikan hanya user ini yang bisa akses
        original: e.original,
      })),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  const { data, error } = await supabase
    .from('masking_vaults')
    .select('vault_data, entities_summary')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
