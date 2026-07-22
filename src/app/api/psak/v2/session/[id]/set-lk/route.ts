import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// Setelah upload langsung ke storage via signed URL, client memanggil ini untuk menyimpan path
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { storagePath, fileName } = await req.json()
  if (!storagePath) return NextResponse.json({ error: 'storagePath required' }, { status: 400 })

  const { error } = await db()
    .from('psak_session')
    .update({ lk_storage_path: storagePath, lk_file_name: fileName, status: 'idle', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
