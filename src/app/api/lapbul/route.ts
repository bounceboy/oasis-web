import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

/** Daftar riwayat analisis lapbul milik pengguna (ringkas, tanpa data lapbul). */
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await db()
    .from('offsite_sessions')
    .select('id, nama_entitas, created_at, ringkasan:hasil->ringkasan')
    .eq('user_id', user.id)
    .eq('modul', 'lapbul')
    .eq('status', 'selesai')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** Simpan hasil baca lapbul + pengaturan analisis. Angka dihitung ulang di klien dari data ini. */
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const nama = String(body?.namaEntitas ?? '').trim()
  if (!nama || !body?.main?.sheets || !body?.params) return NextResponse.json({ error: 'Data analisis tidak lengkap' }, { status: 400 })

  const hasil = { main: body.main, prior: Array.isArray(body.prior) ? body.prior : [], params: body.params, ringkasan: body.ringkasan ?? null, ai: body.ai ?? null }
  const id = typeof body.id === 'string' ? body.id : null
  if (id) {
    let q = db().from('offsite_sessions').update({ nama_entitas: nama, hasil, updated_at: new Date().toISOString() }).eq('id', id).eq('modul', 'lapbul')
    if (user.role === 'pemeriksa') q = q.eq('user_id', user.id)
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id })
  }
  const { data, error } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'lapbul', nama_entitas: nama, jenis_usaha: 'penjaminan', status: 'selesai', hasil })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message || 'Gagal menyimpan' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
