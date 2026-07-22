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
  if (ext === 'pptx') {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(buf)
    const slides = zip.getEntries()
      .filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
      .map(e => e.getData().toString('utf-8').replace(/<[^>]+>/g, ' '))
    return slides.join('\n')
  }
  return buf.toString('utf-8').slice(0, 50000)
}

async function runAnalysis(wawId: string, kode: string, departemen: string, fokus: string, teks: string, namaFile: string) {
  try {
    const pojkRef = await searchRelevantPojk(`${departemen} wawancara pemeriksaan asuransi ${fokus}`)
    const instruksi = fokus ? `Fokus khusus dari pengawas: ${fokus}` : 'Analisis catatan wawancara ini secara menyeluruh untuk mengidentifikasi potensi temuan.'

    const prompt = `Anda adalah pengawas OJK yang menganalisis catatan/bahan tayang wawancara pemeriksaan onsite.
Departemen yang diwawancara: ${departemen}
${instruksi}

=== REFERENSI POJK ===
${pojkRef}

=== FILE: ${namaFile} ===
${teks.slice(0, 20000)}

Tugas Anda:
1. Buat ringkasan singkat isi wawancara/paparan (2-3 kalimat)
2. Identifikasi temuan RISK-BASED: kelemahan kontrol internal, risiko operasional, tata kelola, praktik yang berisiko — TANPA harus mengacu ke pasal POJK (pasal_terkait boleh kosong [])
3. Identifikasi temuan COMPLIANCE: pelanggaran atau potensi pelanggaran ketentuan POJK dari referensi di atas — WAJIB cantumkan pasal_terkait

Kluster: A=Risiko Asuransi, B=SDM & Kelembagaan, C=Pemasaran & Keagenan, D=Keuangan, E=Tata Kelola (GCG), F=APU-PPT, G=Investasi, H=MRTI (TI)

Balas HANYA dalam JSON:
{"ringkasan":"...","risk_based":${TEMUAN_SCHEMA},"compliance":${TEMUAN_SCHEMA}}`

    type TemuanItem = { judul: string; uraian: string; urgensi: string; sifat: string; kluster: string; pasal_terkait: string[]; rekomendasi: string }
    const aiResp = await callOpenRouter('Anda adalah pengawas OJK yang menganalisis catatan/bahan tayang wawancara pemeriksaan onsite. Balas HANYA dalam format JSON yang diminta.', prompt, 4000)
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

    if (toInsert.length > 0) {
      await db().from('onsite_temuan').insert(
        toInsert.map(t => ({
          kode, judul: t.judul, uraian: t.uraian, urgensi: t.urgensi, sifat: t.sifat,
          kluster: t.kluster, kluster_nama: KLUSTER[t.kluster] ?? '',
          pasal_terkait: t.pasal_terkait ?? [], rekomendasi: t.rekomendasi,
          tipe_analisis: t.tipe_analisis,
          sumber_tipe: 'wawancara', sumber_id: wawId, sumber_nama: namaFile, status: 'draft',
        }))
      )
    }
    await db().from('onsite_wawancara').update({ status: 'done', ringkasan }).eq('id', wawId)
  } catch (err) {
    console.error('[onsite/wawancara] AI error:', err)
    await db().from('onsite_wawancara').update({ status: 'error', ringkasan: 'Analisis gagal — coba upload ulang.' }).eq('id', wawId)
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData  = await req.formData()
  const kode      = (formData.get('kode') as string)?.toUpperCase().trim()
  const departemen = (formData.get('departemen') as string)?.trim()
  const fokus     = (formData.get('fokus') as string)?.trim() ?? ''
  const file      = formData.get('file') as File | null

  if (!kode || !departemen || !file)
    return NextResponse.json({ error: 'kode, departemen, dan file wajib diisi' }, { status: 400 })

  const { data: session } = await db().from('onsite_sessions').select('kode').eq('kode', kode).single()
  if (!session) return NextResponse.json({ error: 'Kode pemeriksaan tidak valid' }, { status: 404 })

  const { data: wawRec, error: insErr } = await db()
    .from('onsite_wawancara')
    .insert({ kode, departemen, nama_file: file.name, fokus, status: 'analyzing', created_by: user.id })
    .select()
    .single()
  if (insErr || !wawRec) return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 })

  const buf = Buffer.from(await file.arrayBuffer())
  let teks: string
  try {
    teks = await extractText(buf, file.name)
  } catch {
    await db().from('onsite_wawancara').update({ status: 'error' }).eq('id', wawRec.id)
    return NextResponse.json({ error: 'Gagal mengekstrak teks file' }, { status: 422 })
  }

  // Proses AI di background — respons langsung kembali
  after(async () => {
    await runAnalysis(wawRec.id, kode, departemen, fokus, teks, file.name)
  })

  return NextResponse.json({ id: wawRec.id, analyzing: true })
}
