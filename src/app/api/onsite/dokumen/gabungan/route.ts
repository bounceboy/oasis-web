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

  const { data: session } = await db().from('onsite_sessions').select('kode').eq('kode', kode).single()
  if (!session) return NextResponse.json({ error: 'Kode pemeriksaan tidak valid' }, { status: 404 })

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
      const pojkRef = await searchRelevantPojk(`${departemen} pemeriksaan asuransi ${fokus}`)
      const instruksi = fokus ? `Fokus khusus dari pengawas: ${fokus}` : 'Lakukan analisis menyeluruh atas semua dokumen ini secara terpadu.'

      const prompt = `Anda adalah pengawas OJK yang sedang melakukan pemeriksaan onsite perusahaan asuransi.
Departemen yang diperiksa: ${departemen}
${instruksi}
Jumlah file: ${files.length} (${files.map(f => f.name).join(', ')})

=== REFERENSI POJK ===
${pojkRef}

=== ISI DOKUMEN-DOKUMEN ===
${kombinasiTeks}

Kluster: A=Risiko Asuransi, B=SDM & Kelembagaan, C=Pemasaran & Keagenan, D=Keuangan, E=Tata Kelola (GCG), F=APU-PPT, G=Investasi, H=MRTI (TI)

Tugas Anda (analisis TERPADU dari semua dokumen):
1. Buat ringkasan singkat mencakup gambaran keseluruhan dari semua dokumen (2-4 kalimat)
2. Identifikasi temuan RISK-BASED lintas dokumen: pola kelemahan, risiko operasional, tata kelola — (pasal_terkait boleh kosong [])
3. Identifikasi temuan COMPLIANCE: pelanggaran atau potensi pelanggaran ketentuan POJK — WAJIB cantumkan pasal_terkait

Balas HANYA dalam JSON:
{"ringkasan":"...","risk_based":${TEMUAN_SCHEMA},"compliance":${TEMUAN_SCHEMA}}`

      type TemuanItem = { judul: string; uraian: string; urgensi: string; sifat: string; kluster: string; pasal_terkait: string[]; rekomendasi: string }
      const aiResp = await callOpenRouter('Anda adalah pengawas OJK yang menganalisis dokumen pemeriksaan onsite. Balas HANYA dalam format JSON yang diminta.', prompt, 6000)
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

      console.log(`[onsite/gabungan] risk=${riskList.length} compliance=${complianceList.length} total=${toInsert.length}`)
      if (toInsert.length > 0) {
        const rows = toInsert.map(t => ({
          kode, judul: t.judul, uraian: t.uraian, urgensi: t.urgensi, sifat: t.sifat,
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
