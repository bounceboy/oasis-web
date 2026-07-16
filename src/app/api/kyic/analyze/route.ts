import { NextRequest, NextResponse, after } from 'next/server'
export const maxDuration = 300
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { prosesKyic } from '@/lib/kyic'

const BUCKET = 'kyic-uploads'
const ALLOWED_EXT = ['pdf','docx','doc','xlsx','xls','xlsm','png','jpg','jpeg']

type DocPathEntry = { path: string; name: string }

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    templatePath,
    templateName,
    docPaths,
    zipPath,
    zipName,
    namaEntitas: namaEntitasRaw,
    periode: periodeRaw,
    catatanPengawas: catatanPengawasRaw,
  } = body as {
    templatePath?: string
    templateName?: string
    docPaths?: DocPathEntry[]
    zipPath?: string
    zipName?: string
    namaEntitas?: string
    periode?: string
    catatanPengawas?: string
  }

  const namaEntitas = namaEntitasRaw?.trim()
  const periode = periodeRaw?.trim()
  const catatanPengawas = catatanPengawasRaw?.trim() ?? ''

  if (!templatePath || !templateName || !namaEntitas || !periode)
    return NextResponse.json({ error: 'template, namaEntitas, dan periode wajib diisi' }, { status: 400 })
  if (!templateName.toLowerCase().endsWith('.docx'))
    return NextResponse.json({ error: 'Template harus berformat .docx' }, { status: 400 })

  const validDocPaths: DocPathEntry[] = Array.isArray(docPaths)
    ? docPaths.filter((d): d is DocPathEntry => {
        if (!d || typeof d.path !== 'string' || typeof d.name !== 'string') return false
        const ext = d.name.toLowerCase().split('.').pop() ?? ''
        return ALLOWED_EXT.includes(ext)
      })
    : []

  // Kumpulkan semua path yang perlu dibersihkan dari storage setelah selesai
  const allPaths = [templatePath, ...validDocPaths.map(d => d.path)]
  if (zipPath) allPaths.push(zipPath)

  // Buat session
  const { data: session, error: sessionErr } = await db()
    .from('offsite_sessions')
    .insert({ user_id: user.id, modul: 'kyic', nama_entitas: namaEntitas, jenis_usaha: 'asuransi', status: 'processing' })
    .select('id')
    .single()

  if (sessionErr || !session) return NextResponse.json({ error: 'Gagal membuat session' }, { status: 500 })
  const sessionId = session.id

  after(async () => {
    await runKyicAnalysis(sessionId, templatePath, validDocPaths, zipPath, catatanPengawas, allPaths).catch(err => {
      console.error(`[KYIC ${sessionId}] Background job error:`, err)
    })
  })

  // Return sessionId segera (status: processing)
  return NextResponse.json({
    sessionId,
    status: 'processing',
    message: 'Analisis dimulai. Polling untuk melihat progres.',
  })
}

async function runKyicAnalysis(
  sessionId: string,
  templatePath: string,
  docPaths: DocPathEntry[],
  zipPath: string | undefined,
  catatanPengawas: string,
  allPaths: string[]
) {
  try {
    const { data: templateData, error: templateErr } = await db().storage.from(BUCKET).download(templatePath)
    if (templateErr || !templateData) throw new Error(`Gagal mengunduh template dari storage: ${templateErr?.message ?? 'unknown'}`)
    const templateBuf = Buffer.from(await templateData.arrayBuffer())

    const dokumenFiles: Array<{ name: string; buf: Buffer; type: string }> = []

    for (const doc of docPaths) {
      const { data, error } = await db().storage.from(BUCKET).download(doc.path)
      if (error || !data) {
        console.error(`[KYIC ${sessionId}] Gagal mengunduh dokumen ${doc.path}:`, error?.message)
        continue
      }
      dokumenFiles.push({ name: doc.name, buf: Buffer.from(await data.arrayBuffer()), type: '' })
    }

    if (zipPath) {
      const { data, error } = await db().storage.from(BUCKET).download(zipPath)
      if (error || !data) {
        console.error(`[KYIC ${sessionId}] Gagal mengunduh zip ${zipPath}:`, error?.message)
      } else {
        const zipBuf = Buffer.from(await data.arrayBuffer())
        const { default: AdmZip } = await import('adm-zip')
        const zip = new AdmZip(zipBuf)
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue
          const ext = entry.name.toLowerCase().split('.').pop() ?? ''
          if (!ALLOWED_EXT.includes(ext)) continue
          dokumenFiles.push({ name: entry.name, buf: entry.getData(), type: '' })
        }
      }
    }

    const progressLog: string[] = []

    const { docxBuf, hasil } = await prosesKyic(
      templateBuf,
      dokumenFiles,
      (msg) => progressLog.push(msg),
      catatanPengawas
    )

    // Simpan docx ke hasil (base64) + metadata
    const hasilData = {
      ...hasil,
      docx_b64: docxBuf.toString('base64'),
      progress_log: progressLog,
    }

    await db()
      .from('offsite_sessions')
      .update({ status: 'selesai', hasil: hasilData })
      .eq('id', sessionId)
  } catch (err) {
    await db().from('offsite_sessions').update({ status: 'error' }).eq('id', sessionId)
    throw err
  } finally {
    // Bersihkan semua file upload sementara di storage (best-effort)
    await db().storage.from(BUCKET).remove(allPaths).catch(() => {})
  }
}
