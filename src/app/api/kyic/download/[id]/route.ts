import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let query = db()
    .from('offsite_sessions')
    .select('nama_entitas, hasil, status')
    .eq('id', id)
    .eq('modul', 'kyic')

  if (user.role === 'pemeriksa') {
    query = query.eq('user_id', user.id) as typeof query
  }

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  if (data.status !== 'done') return NextResponse.json({ error: 'Analisis belum selesai' }, { status: 400 })

  const hasil = data.hasil as { docx_b64?: string; periode?: string; nama_perusahaan?: string }
  if (!hasil?.docx_b64) return NextResponse.json({ error: 'File tidak tersedia' }, { status: 404 })

  const buf = Buffer.from(hasil.docx_b64, 'base64')
  const nama = (hasil.nama_perusahaan || data.nama_entitas || 'Perusahaan').replace(/\s+/g, '_')
  const periode = (hasil.periode || '').replace(/\s+/g, '_')
  const filename = `KYIC_${nama}_${periode}.docx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
