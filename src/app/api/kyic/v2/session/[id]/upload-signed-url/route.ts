import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
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

  const ext = fileName.toLowerCase().split('.').pop()
  if (!['pdf', 'docx', 'doc'].includes(ext ?? ''))
    return NextResponse.json({ error: 'Format tidak didukung (gunakan .docx atau .pdf)' }, { status: 422 })

  const storagePath = `templates/${id}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { data, error } = await adminClient.storage
    .from('ky-uploads')
    .createSignedUploadUrl(storagePath, { upsert: true })

  if (error || !data)
    return NextResponse.json({ error: 'Gagal membuat upload URL' }, { status: 500 })

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath, token: data.token })
}
