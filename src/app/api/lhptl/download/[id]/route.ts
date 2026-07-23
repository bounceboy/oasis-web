import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

const SCRIPT = path.join(process.cwd(), 'scripts', 'lhptl', 'generate.py')

function runPythonGenerator(payload: object): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] })

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    py.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    py.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))

    py.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString('utf-8')
        reject(new Error(`generate.py exited ${code}: ${stderr}`))
      } else {
        resolve(Buffer.concat(chunks))
      }
    })

    py.on('error', reject)
    py.stdin.write(JSON.stringify(payload))
    py.stdin.end()
  })
}

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
    nama_perusahaan?: string
    jenis_entitas?: string
    periode?: string
    hasil_pengawasan?: unknown[]
    kesimpulan?: string
    tindak_lanjut?: string
    raw?: Record<string, unknown>
  }

  const payload = {
    nama_perusahaan: hasil.nama_perusahaan || data.nama_entitas,
    jenis_entitas: hasil.jenis_entitas || data.jenis_usaha,
    periode: hasil.periode,
    hasil_pengawasan: hasil.hasil_pengawasan ?? [],
    kesimpulan: hasil.kesimpulan ?? '',
    tindak_lanjut: hasil.tindak_lanjut ?? '',
    raw: hasil.raw ?? {},
  }

  let buf: Buffer
  try {
    buf = await runPythonGenerator(payload)
  } catch (err) {
    console.error('[LHPTL download] Python error:', err)
    return NextResponse.json({ error: 'Gagal generate dokumen' }, { status: 500 })
  }

  const filename = `LHPTL_${(data.nama_entitas ?? 'Entitas').replace(/\s+/g, '_')}_${hasil.periode ?? ''}.docx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
