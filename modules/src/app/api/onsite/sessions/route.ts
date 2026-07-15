import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/onsite/sessions?kode=XXX — validasi kode (semua user yg login)
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const kode = req.nextUrl.searchParams.get('kode')?.toUpperCase().trim()
  if (!kode) return NextResponse.json({ error: 'kode wajib diisi' }, { status: 400 })

  const { data, error } = await db()
    .from('onsite_sessions')
    .select('kode, nama_entitas, jenis_usaha, created_at')
    .eq('kode', kode)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Kode pemeriksaan tidak ditemukan' }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/onsite/sessions — buat session baru (admin saja)
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kode, nama_entitas, jenis_usaha } = await req.json()
  if (!kode || !nama_entitas) return NextResponse.json({ error: 'kode dan nama_entitas wajib diisi' }, { status: 400 })

  const { data, error } = await db()
    .from('onsite_sessions')
    .insert({ kode: kode.toUpperCase().trim(), nama_entitas, jenis_usaha: jenis_usaha ?? 'Asuransi Jiwa', created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
