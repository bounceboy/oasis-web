import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseOjkExcel } from '@/lib/psak-excel-parser'

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

  let buf: Buffer
  let fileName = 'excel.xlsx'
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File Excel tidak ditemukan dalam request' }, { status: 400 })

    const allowedExts = ['.xlsx', '.xls', '.xlsm']
    if (!allowedExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return NextResponse.json({ error: 'File harus berformat Excel (.xlsx / .xls)' }, { status: 400 })
    }

    fileName = file.name
    buf = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Gagal membaca file Excel' }, { status: 400 })
  }

  let excelFields: ReturnType<typeof parseOjkExcel>
  try {
    excelFields = parseOjkExcel(buf)
  } catch (err) {
    console.error('[psak] excel parse error:', err)
    return NextResponse.json({
      error: 'Gagal membaca Excel — pastikan format sesuai template OJK PSAK 117 (sheet: LUPSPK, LUPLRG, dll)',
    }, { status: 400 })
  }

  const fieldCount = Object.values(excelFields).filter(v => v?.CY !== null || v?.PY !== null).length
  if (fieldCount === 0) {
    return NextResponse.json({
      error: 'Tidak ada data terbaca dari Excel — cek nama sheet: LUPSPK, LUPLRG, LUPAKS, LUPCRF, LUPSAGP, LUPAKD, LUPSKV',
    }, { status: 400 })
  }

  // Simpan excel_override ke dalam template_data (belum merge — merge terjadi saat extract PDF)
  const existing = (sess.template_data as Record<string, unknown> | null) ?? {}
  const updated = {
    ...existing,
    _excel_override: excelFields,
    _excel_file_name: fileName,
    _excel_field_count: fieldCount,
  }

  const { error: updateErr } = await db()
    .from('psak_session')
    .update({ template_data: updated, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  console.log(`[psak] excel staged: ${fieldCount} field dari "${fileName}" untuk sesi ${id}`)
  return NextResponse.json({ ok: true, fieldsStaged: fieldCount, fileName })
}
