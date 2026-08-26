import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'waw-uploads'
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kode, namaFile } = await req.json()
  if (!kode || !namaFile) return NextResponse.json({ error: 'kode dan namaFile wajib' }, { status: 400 })

  const storagePath = `${kode}/${Date.now()}_${namaFile.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data)
    return NextResponse.json({ error: 'Gagal membuat upload URL' }, { status: 500 })

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath, token: data.token })
}
