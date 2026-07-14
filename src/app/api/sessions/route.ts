import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const modul = req.nextUrl.searchParams.get('modul')
  if (!modul) return NextResponse.json({ error: 'modul wajib diisi' }, { status: 400 })

  const { data, error } = await db()
    .from('offsite_sessions')
    .select('id, modul, nama_entitas, status, created_at, hasil')
    .eq('user_id', user.id)
    .eq('modul', modul)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
