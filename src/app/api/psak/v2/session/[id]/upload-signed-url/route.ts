import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { fileName } = await req.json()
  if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400 })

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Hanya file PDF yang diterima' }, { status: 422 })
  }

  const storagePath = `lk/${id}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data, error } = await adminClient.storage
    .from('psak-uploads')
    .createSignedUploadUrl(storagePath, { upsert: true })

  if (error || !data) return NextResponse.json({ error: 'Gagal membuat upload URL' }, { status: 500 })

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath, token: data.token })
}
