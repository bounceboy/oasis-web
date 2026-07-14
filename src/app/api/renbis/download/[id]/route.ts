import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateRenbisDocx, KkRow } from '@/lib/renbis'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let query = db()
    .from('offsite_sessions')
    .select('nama_entitas, hasil, status')
    .eq('id', id)
    .eq('modul', 'renbis')

  if (user.role === 'pemeriksa') {
    query = query.eq('user_id', user.id) as typeof query
  }

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  if (!data.hasil) return NextResponse.json({ error: 'Data hasil tidak tersedia' }, { status: 400 })

  const hasil = data.hasil as {
    nama_perusahaan: string
    tahun: string
    kk_rows: KkRow[]
  }

  const buf = await generateRenbisDocx(
    hasil.nama_perusahaan || data.nama_entitas,
    hasil.tahun,
    hasil.kk_rows
  )

  const filename = `KK_Renbis_${(data.nama_entitas ?? 'Entitas').replace(/\s+/g, '_')}_${hasil.tahun}.docx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
