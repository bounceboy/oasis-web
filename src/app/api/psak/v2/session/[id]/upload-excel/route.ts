import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseOjkExcel, mergeExcelIntoTemplateData } from '@/lib/psak-excel-parser'

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: sess } = await db()
    .from('psak_session')
    .select('user_id, template_data, status')
    .eq('id', id)
    .single()

  if (!sess) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
  if (sess.user_id !== user.id && !['admin', 'superadmin'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Baca file dari multipart form
  let buf: Buffer
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File Excel tidak ditemukan dalam request' }, { status: 400 })

    const allowedExts = ['.xlsx', '.xls', '.xlsm']
    const hasValidExt = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      return NextResponse.json({ error: 'File harus berformat Excel (.xlsx / .xls)' }, { status: 400 })
    }

    buf = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Gagal membaca file Excel' }, { status: 400 })
  }

  // Parse Excel
  let excelFields: ReturnType<typeof parseOjkExcel>
  try {
    excelFields = parseOjkExcel(buf)
  } catch (err) {
    console.error('[psak] excel parse error:', err)
    return NextResponse.json({ error: 'Gagal membaca Excel — pastikan format sesuai template OJK PSAK 117' }, { status: 400 })
  }

  const fieldCount = Object.values(excelFields).filter(v => v?.CY !== null || v?.PY !== null).length
  if (fieldCount === 0) {
    return NextResponse.json({ error: 'Tidak ada data yang berhasil dibaca dari Excel — cek nama sheet (LUPSPK, LUPLRG, LUPAKS, LUPCRF, LUPSAGP, LUPAKD, LUPSKV)' }, { status: 400 })
  }

  // Merge ke template_data
  const currentTemplateData = sess.template_data as {
    values: Record<string, { CY: number | null; PY: number | null; PPY: number | null }>
    metadata: Record<string, unknown>
  } | null

  const baseData = currentTemplateData ?? {
    metadata: { nama_entitas: '', jenis_usaha: 'Umum', periode: '', mata_uang: 'IDR', unit: 'juta' },
    values: {},
  }

  const merged = mergeExcelIntoTemplateData(baseData, excelFields)

  // Tentukan status: kalau sebelumnya idle/error tapi sekarang ada data, upgrade ke template_ready
  const newStatus =
    sess.status === 'idle' || sess.status === 'error'
      ? 'template_ready'
      : sess.status

  const { error: updateErr } = await db()
    .from('psak_session')
    .update({
      template_data: merged,
      status: newStatus,
      error_msg: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  console.log(`[psak] excel merged: ${fieldCount} field dari Excel untuk sesi ${id}`)
  return NextResponse.json({ ok: true, fieldsImported: fieldCount })
}
