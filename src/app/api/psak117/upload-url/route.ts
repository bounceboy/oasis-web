import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

const BUCKET = 'psak117-uploads'

// Generate signed upload URL agar file besar diupload langsung dari browser
// ke Supabase Storage (bypass limit 4.5MB body request Vercel serverless).
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileName } = await req.json()
  if (!fileName || typeof fileName !== 'string') {
    return NextResponse.json({ error: 'fileName wajib diisi' }, { status: 400 })
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${user.id}/${Date.now()}-${safeName}`

  const { data, error } = await db()
    .storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Gagal membuat signed upload URL' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl })
}
