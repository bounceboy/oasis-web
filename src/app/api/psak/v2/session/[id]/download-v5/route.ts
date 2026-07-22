import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { V5_UMUM_MAPPING, type TemplateData } from '@/lib/psak-template-structure'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

export const maxDuration = 60

function fillV5(templatePath: string, data: TemplateData, mapping: Record<string, { sheet: string; row: number }>): Buffer {
  const templateBuf = fs.readFileSync(templatePath)
  const wb = XLSX.read(templateBuf, { type: 'buffer', cellStyles: true })

  const setupSheet = wb.Sheets['Setup']
  if (setupSheet) {
    setupSheet['B2'] = { t: 's', v: data.metadata.nama_entitas }
    setupSheet['B3'] = { t: 's', v: data.metadata.periode || '' }
    setupSheet['B4'] = { t: 's', v: data.metadata.jenis_usaha }
  }

  for (const [key, val] of Object.entries(data.values || {})) {
    const loc = mapping[key]
    if (!loc) continue

    const ws = wb.Sheets[loc.sheet]
    if (!ws) continue

    // V5 Raw_ sheets: col C = CY, D = PY, E = PPY (same layout)
    if (val.CY != null) ws[`C${loc.row}`] = { t: 'n', v: val.CY }
    if (val.PY != null) ws[`D${loc.row}`] = { t: 'n', v: val.PY }
    if (val.PPY != null) ws[`E${loc.row}`] = { t: 'n', v: val.PPY }
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: sess } = await db()
    .from('psak_session')
    .select('nama_entitas, jenis_usaha, template_data, status, user_id')
    .eq('id', id)
    .single()

  if (!sess) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
  if (sess.user_id !== user.id && !['admin', 'superadmin'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!sess.template_data) return NextResponse.json({ error: 'Data template belum tersedia' }, { status: 400 })

  const jenis = sess.jenis_usaha as 'Jiwa' | 'Umum'
  const v5File = jenis === 'Jiwa' ? 'v5_jiwa.xlsx' : 'v5_umum.xlsx'
  const v5Path = path.join(process.cwd(), 'public', 'templates', v5File)

  const filled = fillV5(v5Path, sess.template_data as unknown as TemplateData, V5_UMUM_MAPPING)

  const fileName = `V5_PSAK_${sess.nama_entitas.replace(/[^a-zA-Z0-9]/g, '_')}_${jenis}.xlsx`

  return new NextResponse(filled as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
