import { NextRequest, NextResponse, after } from 'next/server'
export const maxDuration = 300
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { callOpenRouter } from '@/lib/claude'
import { searchRelevantPojk } from '@/lib/pojk-search'

const KLUSTER: Record<string, string> = {
  A: 'Risiko Asuransi', B: 'SDM & Kelembagaan', C: 'Pemasaran & Keagenan',
  D: 'Keuangan', E: 'Tata Kelola (GCG)', F: 'APU-PPT', G: 'Investasi', H: 'MRTI (TI)',
}

const TEMUAN_SCHEMA = `[{"judul":"...","uraian":"...","urgensi":"kritis|signifikan|perlu_perhatian","sifat":"pelanggaran_ketentuan|potensi_pelanggaran|perlu_perbaikan","kluster":"A|B|C|D|E|F|G|H","pasal_terkait":["..."],"rekomendasi":"..."}]`

async function extractText(buf: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse')
    return (await pdfParse(buf)).text
  }
  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth')
    return (await mammoth.extractRawText({ buffer: buf })).value
  }
  return buf.toString('utf-8').slice(0, 50000)
}

async function runAnalysis(dokId: string, kode: string, departemen: string, fokus: string, teks: string, namaFile: string) {
  try {
    const pojkRef = await searchRelevantPojk(`${departemen} pemeriksaan asuransi ${fokus}`)
    const instruksi = fokus ? `Fokus khusus dari pengawas: ${fokus}` : 'Lakukan analisis menyeluruh atas dokumen ini.'

    const prompt = `Anda adalah pengawas OJK yang sedang melakukan pemeriksaan onsite perusahaan asuransi.
Departemen yang diperiksa: ${departemen}
${instruksi}

=== REFERENSI POJK ===
${pojkRef}

=== DOKUMEN: ${namaFile} ===
${teks.slice(0, 20000)}

Kluster: A=Risiko Asuransi, B=SDM & Kelembagaan, C=Pemasaran & Keagenan, D=Keuangan, E=Tata Kelola (GCG), F=APU-PPT, G=Investasi, H=MRTI (TI)

Tugas Anda:
1. Buat ringkasan singkat dokumen (2-3 kalimat)
2. Identifikasi temuan RISK-BASED: kelemahan kontrol internal, risiko operasional, tata kelola, praktik berisiko — TANPA harus mengacu ke pasal POJK (pasal_terkait boleh kosong [])
3. Identifikasi temuan COMPLIANCE: pelanggaran atau potensi pelanggaran ketentuan POJK dari referensi di atas — WAJIB cantumkan pasal_terkait

Balas HANYA dalam JSON:
{"ringkasan":"...","risk_based":${TEMUAN_SCHEMA},"compliance":${TEMUAN_SCHEMA}}`

    type TemuanItem = { judul: string; uraian: string; urgensi: string; sifat: string; kluster: string; pasal_terkait: string[]; rekomendasi: string }
    const aiResp = await callOpenRouter('Anda adalah pengawas OJK yang menganalisis dokumen pemeriksaan onsite. Balas HANYA dalam format JSON yang diminta.', prompt, 4000)
    const jsonMatch = aiResp.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const json = JSON.parse(jsonMatch[0])
    const ringkasan: string = json.ringkasan ?? ''
    const riskList: TemuanItem[] = Array.isArray(json.risk_based) ? json.risk_based : []
    const complianceList: TemuanItem[] = Array.isArray(json.compliance) ? json.compliance : []

    const toInsert = [
      ...riskList.map(t => ({ ...t, tipe_analisis: 'risk_based' })),
      ...complianceList.map(t => ({ ...t, tipe_analisis: 'compliance' })),
    ]

    console.log(`[onsite/dokumen] risk=${riskList.length} compliance=${complianceList.length} total=${toInsert.length}`)
    if (toInsert.length > 0) {
      const rows = toInsert.map(t => ({
        kode, judul: t.judul, uraian: t.uraian, urgensi: t.urgensi, sifat: t.sifat,
        kluster: t.kluster, kluster_nama: KLUSTER[t.kluster] ?? '',
        pasal_terkait: t.pasal_terkait ?? [], rekomendasi: t.rekomendasi,
        tipe_analisis: t.tipe_analisis,
        sumber_tipe: 'dokumen', sumber_id: dokId, sumber_nama: namaFile, status: 'draft',
      }))
      const { error: insErr } = await db().from('onsite_temuan').insert(rows)
      if (insErr) console.error('[onsite/dokumen] temuan insert error:', JSON.stringify(insErr))
    }
    await db().from('onsite_dokumen').update({ status: 'done', ringkasan }).eq('id', dokId)
  } catch (err) {
    console.error('[onsite/dokumen] AI error:', err)
    await db().from('onsite_dokumen').update({ status: 'error', ringkasan: 'Analisis gagal — coba upload ulang.' }).eq('id', dokId)
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const kode       = (formData.get('kode') as string)?.toUpperCase().trim()
  const departemen = (formData.get('departemen') as string)?.trim()
  const fokus      = (formData.get('fokus') as string)?.trim() ?? ''
  const file       = formData.get('file') as File | null

  if (!kode || !departemen || !file)
    return NextResponse.json({ error: 'kode, departemen, dan file wajib diisi' }, { status: 400 })

  const { data: session } = await db().from('onsite_sessions').select('kode').eq('kode', kode).single()
  if (!session) return NextResponse.json({ error: 'Kode pemeriksaan tidak valid' }, { status: 404 })

  const { data: dokRec, error: insErr } = await db()
    .from('onsite_dokumen')
    .insert({ kode, departemen, nama_file: file.name, fokus, status: 'analyzing', created_by: user.id })
    .select()
    .single()
  if (insErr || !dokRec) return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 })

  const buf = Buffer.from(await file.arrayBuffer())
  let teks: string
  try {
    teks = await extractText(buf, file.name)
  } catch {
    await db().from('onsite_dokumen').update({ status: 'error' }).eq('id', dokRec.id)
    return NextResponse.json({ error: 'Gagal mengekstrak teks dokumen' }, { status: 422 })
  }

  // Proses AI di background — respons langsung kembali
  after(async () => {
    await runAnalysis(dokRec.id, kode, departemen, fokus, teks, file.name)
  })

  return NextResponse.json({ id: dokRec.id, analyzing: true })
}
