import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Pastikan session milik user (kecuali admin)
  if (user.role !== 'admin') {
    const { data } = await db().from('ky_session').select('created_by').eq('id', id).single()
    if (!data || data.created_by !== user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await db().from('ky_session').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
