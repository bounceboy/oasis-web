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

async function runAnalysis(dokId: string, kode: string, departemen: string, fokus: string, teks: string, namaFile: string, jenisUsaha = '') {
  try {
    const pojkRef = await searchRelevantPojk(`${departemen} pemeriksaan asuransi ${fokus}`, 10, jenisUsaha)
    const instruksi = fokus ? `Fokus khusus dari pengawas: ${fokus}` : 'Lakukan analisis menyeluruh atas dokumen ini.'

    const prompt = `Anda adalah pengawas OJK senior yang melakukan pemeriksaan onsite perusahaan asuransi.
Jenis Usaha: ${jenisUsaha || 'Perusahaan Asuransi'}
Departemen: ${departemen}
${instruksi}

=== REFERENSI POJK ===
${pojkRef}

=== DOKUMEN: ${namaFile} ===
${teks.slice(0, 18000)}

=== TUGAS ===
Analisis dokumen di atas dan hasilkan JSON dengan struktur PERSIS seperti contoh di bawah.

PENTING:
- risk_based: temuan kelemahan tata kelola, kontrol internal, risiko operasional (pasal_terkait boleh kosong array)
- compliance: pelanggaran POJK yang ada di referensi (pasal_terkait WAJIB diisi)
- Setiap kategori minimal 1 temuan jika ada indikasi masalah
- kluster pilih dari: A(Risiko Asuransi) B(SDM) C(Pemasaran) D(Keuangan) E(GCG) F(APU-PPT) G(Investasi) H(TI)
- urgensi: "kritis" atau "signifikan" atau "perlu_perhatian"
- sifat: "pelanggaran_ketentuan" atau "potensi_pelanggaran" atau "perlu_perbaikan"

Balas HANYA dengan JSON (tanpa teks lain, tanpa markdown):
{
  "ringkasan": "Ringkasan 2-3 kalimat dokumen.",
  "risk_based": [
    {
      "judul": "Judul singkat temuan",
      "uraian": "Penjelasan detail temuan dan dampaknya",
      "kutipan": "Kutipan langsung teks dari dokumen yang menjadi dasar temuan ini (1-3 kalimat)",
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
      "uraian": "Penjelasan pelanggaran dan dasar hukumnya",
      "kutipan": "Kutipan langsung teks dari dokumen yang menjadi dasar temuan ini (1-3 kalimat)",
      "urgensi": "kritis",
      "sifat": "pelanggaran_ketentuan",
      "kluster": "E",
      "pasal_terkait": ["Pasal X POJK No. Y/POJK.XX/YYYY"],
      "rekomendasi": "Rekomendasi konkret"
    }
  ]
}`

    type TemuanItem = { judul: string; uraian: string; kutipan?: string; urgensi: string; sifat: string; kluster: string; pasal_terkait: string[]; rekomendasi: string }
    const aiResp = await callOpenRouter(
      'Anda adalah pengawas OJK senior. Balas HANYA dengan JSON valid tanpa markdown, tanpa teks tambahan.',
      prompt,
      6000
    )
    console.log('[onsite/dokumen] raw (200):', aiResp.slice(0, 200))

    // Robust JSON extraction: coba berbagai pola
    let json: { ringkasan?: string; risk_based?: TemuanItem[]; compliance?: TemuanItem[] } = {}
    const cleaned = aiResp.replace(/^```[a-z]*\n?/gm, '').replace(/^```$/gm, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try { json = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }
    }
    if (!json.ringkasan) {
      // Fallback: coba parse seluruh cleaned string
      try { json = JSON.parse(cleaned) } catch { /* ignore */ }
    }

    console.log('[onsite/dokumen] risk=', Array.isArray(json.risk_based) ? json.risk_based.length : 'N/A', 'compliance=', Array.isArray(json.compliance) ? json.compliance.length : 'N/A')

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
        kode, judul: t.judul, uraian: t.uraian, kutipan: t.kutipan ?? '', urgensi: t.urgensi, sifat: t.sifat,
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

  const { data: session } = await db().from('onsite_sessions').select('kode, jenis_usaha').eq('kode', kode).single()
  if (!session) return NextResponse.json({ error: 'Kode pemeriksaan tidak valid' }, { status: 404 })
  const jenisUsaha: string = session.jenis_usaha ?? ''

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
    await runAnalysis(dokRec.id, kode, departemen, fokus, teks, file.name, jenisUsaha)
  })

  return NextResponse.json({ id: dokRec.id, analyzing: true })
}
