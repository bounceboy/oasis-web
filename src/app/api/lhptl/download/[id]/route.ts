import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateLhptlDocx } from '@/lib/lhptl'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let query = db()
    .from('offsite_sessions')
    .select('nama_entitas, jenis_usaha, hasil, status')
    .eq('id', id)

  if (user.role === 'pemeriksa') {
    query = query.eq('user_id', user.id) as typeof query
  }

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  if (!data.hasil) return NextResponse.json({ error: 'Data hasil tidak tersedia' }, { status: 400 })

  const hasil = data.hasil as {
    nama_perusahaan: string
    jenis_entitas: string
    periode: string
    hasil_pengawasan: Parameters<typeof generateLhptlDocx>[3]
    kesimpulan: string
    tindak_lanjut: string
    raw?: Parameters<typeof generateLhptlDocx>[6]
  }

  const buf = await generateLhptlDocx(
    hasil.nama_perusahaan || data.nama_entitas,
    hasil.jenis_entitas || data.jenis_usaha,
    hasil.periode,
    hasil.hasil_pengawasan,
    hasil.kesimpulan,
    hasil.tindak_lanjut,
    hasil.raw
  )

  const filename = `LHPTL_${(data.nama_entitas ?? 'Entitas').replace(/\s+/g, '_')}_${hasil.periode ?? ''}.docx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
