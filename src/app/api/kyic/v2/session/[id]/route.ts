import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/kyic/v2/session/[id] — detail sesi + semua analisis per bab
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [sessionRes, analisisRes, dokumenRes] = await Promise.all([
    db().from('ky_session').select('*').eq('id', id).single(),
    db().from('ky_analisis').select('id, bab_id, status, catatan_pengawas, hasil_json, analyzed_at').eq('session_id', id),
    db().from('ky_dokumen').select('id, bab_id, nama_file, uploaded_at').eq('session_id', id),
  ])

  if (sessionRes.error || !sessionRes.data)
    return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

  return NextResponse.json({
    session: sessionRes.data,
    analisis: analisisRes.data ?? [],
    dokumen: dokumenRes.data ?? [],
  })
}

// PATCH /api/kyic/v2/session/[id] — update status atau template_text
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowed = ['status', 'template_text', 'nama_entitas', 'periode']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await db()
    .from('ky_session')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
