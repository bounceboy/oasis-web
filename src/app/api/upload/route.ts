import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const namaEntitas = formData.get('namaEntitas') as string
  const jenisUsaha = formData.get('jenisUsaha') as string
  const jenisPemeriksaan = formData.get('jenisPemeriksaan') as string

  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

  const { data: session, error } = await db()
    .from('pemeriksaan_sessions')
    .insert({
      user_id: user.id,
      direktorat_id: user.direktorat_id,
      nama_entitas: namaEntitas,
      jenis_usaha: jenisUsaha,
      jenis_pemeriksaan: jenisPemeriksaan,
      dokumen_nama: file.name,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessionId: session.id })
}
