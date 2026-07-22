import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/kyic/v2/session — list semua sesi KY user
export async function GET(_req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = db()
    .from('ky_session')
    .select('id, kode, nama_entitas, jenis_usaha, periode, status, created_at, updated_at')
    .order('created_at', { ascending: false })

  const { data, error } = user.role === 'pemeriksa'
    ? await query.eq('created_by', user.id)
    : await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/kyic/v2/session — buat sesi KY baru
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { nama_entitas, jenis_usaha, periode, kode } = body

  if (!nama_entitas || !jenis_usaha || !periode || !kode)
    return NextResponse.json({ error: 'nama_entitas, jenis_usaha, periode, kode wajib diisi' }, { status: 400 })

  const { data, error } = await db()
    .from('ky_session')
    .insert({ kode: kode.toUpperCase(), nama_entitas, jenis_usaha, periode, status: 'draft', created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
