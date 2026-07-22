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

    const prompt = `Anda adalah pengawas OJK senior yang menganalisis catatan/bahan tayang wawancara pemeriksaan onsite.
Departemen yang diwawancara: ${departemen}
${instruksi}

=== REFERENSI POJK ===
${pojkRef}

=== FILE: ${namaFile} ===
${teks.slice(0, 18000)}

=== TUGAS ===
Analisis isi wawancara/paparan di atas dan hasilkan JSON dengan struktur PERSIS seperti contoh di bawah.

PENTING:
- risk_based: temuan kelemahan tata kelola, kontrol internal, risiko operasional dari wawancara (pasal_terkait boleh kosong)
- compliance: pelanggaran POJK yang terindikasi dari wawancara (pasal_terkait WAJIB diisi)
- kluster: A(Risiko Asuransi) B(SDM) C(Pemasaran) D(Keuangan) E(GCG) F(APU-PPT) G(Investasi) H(TI)
- urgensi: "kritis" atau "signifikan" atau "perlu_perhatian"
- sifat: "pelanggaran_ketentuan" atau "potensi_pelanggaran" atau "perlu_perbaikan"

Balas HANYA dengan JSON (tanpa teks lain, tanpa markdown):
{
  "ringkasan": "Ringkasan 2-3 kalimat isi wawancara.",
  "risk_based": [
    {
      "judul": "Judul singkat temuan",
      "uraian": "Penjelasan detail temuan dari wawancara",
      "urgensi": "signifikan",
      "sifat": "perlu_perbaikan",
      "kluster": "E",
      "pasal_terkait": [],
      "rekomendasi": "Rekomendasi konkret"
    }
  ],
  "compliance": [
    {
      "judul": "Judul singkat temuan",
      "uraian": "Penjelasan pelanggaran",
      "urgensi": "kritis",
      "sifat": "pelanggaran_ketentuan",
      "kluster": "E",
      "pasal_terkait": ["Pasal X POJK No. Y"],
      "rekomendasi": "Rekomendasi konkret"
    }
  ]
}`

    type TemuanItem = { judul: string; uraian: string; urgensi: string; sifat: string; kluster: string; pasal_terkait: string[]; rekomendasi: string }
    const aiResp = await callOpenRouter(
      'Anda adalah pengawas OJK senior. Balas HANYA dengan JSON valid tanpa markdown, tanpa teks tambahan.',
      prompt,
      6000
    )

    let json: { ringkasan?: string; risk_based?: TemuanItem[]; compliance?: TemuanItem[] } = {}
    const cleaned = aiResp.replace(/^```[a-z]*\n?/gm, '').replace(/^```$/gm, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try { json = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }
    }
    if (!json.ringkasan) {
      try { json = JSON.parse(cleaned) } catch { /* ignore */ }
    }

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
