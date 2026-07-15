import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let query = db()
    .from('offsite_sessions')
    .select('id, status, nama_entitas, hasil')
    .eq('id', id)
    .eq('modul', 'kyic')

  if (user.role === 'pemeriksa') {
    query = query.eq('user_id', user.id) as typeof query
  }

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  // Jangan kembalikan docx_b64 di endpoint ini (besar)
  if (data.hasil && typeof data.hasil === 'object') {
    const { docx_b64: _, ...rest } = data.hasil as Record<string, unknown>
    return NextResponse.json({ ...data, hasil: rest })
  }

  return NextResponse.json(data)
}
