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

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const kode       = (formData.get('kode') as string)?.toUpperCase().trim()
  const departemen = (formData.get('departemen') as string)?.trim()
  const fokus      = (formData.get('fokus') as string)?.trim() ?? ''
  const files      = formData.getAll('file') as File[]

  if (!kode || !departemen || files.length === 0)
    return NextResponse.json({ error: 'kode, departemen, dan file wajib diisi' }, { status: 400 })

  const { data: session } = await db().from('onsite_sessions').select('kode, jenis_usaha').eq('kode', kode).single()
  if (!session) return NextResponse.json({ error: 'Kode pemeriksaan tidak valid' }, { status: 404 })
  const jenisUsaha: string = session.jenis_usaha ?? ''

  const namaGabungan = files.length === 1 ? files[0].name : `Gabungan (${files.length} file)`

  const { data: dokRec, error: insErr } = await db()
    .from('onsite_dokumen')
    .insert({ kode, departemen, nama_file: namaGabungan, fokus, status: 'analyzing', created_by: user.id })
    .select()
    .single()
  if (insErr || !dokRec) return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 })

  // Ekstrak teks semua file sebelum background
  const teksGabungan: string[] = []
  for (const file of files) {
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const teks = await extractText(buf, file.name)
      teksGabungan.push(`=== ${file.name} ===\n${teks}`)
    } catch {
      teksGabungan.push(`=== ${file.name} ===\n[Gagal mengekstrak teks]`)
    }
  }

  const kombinasiTeks = teksGabungan.join('\n\n').slice(0, 30000)

  after(async () => {
    try {
      const pojkRef = await searchRelevantPojk(`${departemen} pemeriksaan asuransi ${fokus}`, 10, jenisUsaha)
      const instruksi = fokus ? `Fokus khusus dari pengawas: ${fokus}` : 'Lakukan analisis menyeluruh atas semua dokumen ini secara terpadu.'

      const prompt = `Anda adalah pengawas OJK senior yang melakukan pemeriksaan onsite perusahaan asuransi.
Jenis Usaha: ${jenisUsaha || 'Perusahaan Asuransi'}
Departemen: ${departemen}
${instruksi}
File dianalisis (${files.length}): ${files.map(f => f.name).join(', ')}

=== REFERENSI POJK ===
${pojkRef}

=== ISI DOKUMEN-DOKUMEN ===
${kombinasiTeks}

=== TUGAS ===
Analisis TERPADU semua dokumen dan hasilkan JSON dengan struktur PERSIS seperti contoh di bawah.

PENTING:
- risk_based: temuan lintas dokumen tentang kelemahan tata kelola, kontrol internal, risiko (pasal_terkait boleh kosong)
- compliance: pelanggaran POJK yang terindikasi (pasal_terkait WAJIB diisi)
- kluster: A(Risiko Asuransi) B(SDM) C(Pemasaran) D(Keuangan) E(GCG) F(APU-PPT) G(Investasi) H(TI)
- urgensi: "kritis" atau "signifikan" atau "perlu_perhatian"
- sifat: "pelanggaran_ketentuan" atau "potensi_pelanggaran" atau "perlu_perbaikan"

Balas HANYA dengan JSON (tanpa teks lain, tanpa markdown):
{
  "ringkasan": "Ringkasan terpadu 2-4 kalimat dari semua dokumen.",
  "risk_based": [
    {
      "judul": "Judul singkat temuan",
      "uraian": "Penjelasan detail dan dampak",
      "kutipan": "Kutipan langsung teks dari dokumen yang menjadi dasar temuan ini (1-3 kalimat), sebutkan nama file-nya",
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
      "kutipan": "Kutipan langsung teks dari dokumen yang menjadi dasar temuan ini (1-3 kalimat), sebutkan nama file-nya",
      "urgensi": "kritis",
      "sifat": "pelanggaran_ketentuan",
      "kluster": "E",
      "pasal_terkait": ["Pasal X POJK No. Y"],
      "rekomendasi": "Rekomendasi konkret"
    }
  ]
}`

      type TemuanItem = { judul: string; uraian: string; kutipan?: string; urgensi: string; sifat: string; kluster: string; pasal_terkait: string[]; rekomendasi: string }
      const aiResp = await callOpenRouter(
        'Anda adalah pengawas OJK senior. Balas HANYA dengan JSON valid tanpa markdown, tanpa teks tambahan.',
        prompt,
        8000
      )
      console.log('[onsite/gabungan] raw (200):', aiResp.slice(0, 200))

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

      console.log(`[onsite/gabungan] risk=${riskList.length} compliance=${complianceList.length} total=${toInsert.length}`)
      if (toInsert.length > 0) {
        const rows = toInsert.map(t => ({
          kode, judul: t.judul, uraian: t.uraian, kutipan: t.kutipan ?? '', urgensi: t.urgensi, sifat: t.sifat,
          kluster: t.kluster, kluster_nama: KLUSTER[t.kluster] ?? '',
          pasal_terkait: t.pasal_terkait ?? [], rekomendasi: t.rekomendasi,
          tipe_analisis: t.tipe_analisis,
          sumber_tipe: 'dokumen', sumber_id: dokRec.id, sumber_nama: namaGabungan, status: 'draft',
        }))
        const { error: insErr } = await db().from('onsite_temuan').insert(rows)
        if (insErr) console.error('[onsite/gabungan] temuan insert error:', JSON.stringify(insErr))
      }
      await db().from('onsite_dokumen').update({ status: 'done', ringkasan }).eq('id', dokRec.id)
    } catch (err) {
      console.error('[onsite/dokumen/gabungan] AI error:', err)
      await db().from('onsite_dokumen').update({ status: 'error', ringkasan: 'Analisis gabungan gagal — coba upload ulang.' }).eq('id', dokRec.id)
    }
  })

  return NextResponse.json({ id: dokRec.id, analyzing: true })
}
