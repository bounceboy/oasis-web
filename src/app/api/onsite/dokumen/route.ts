import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { callOpenRouter } from '@/lib/claude'
import { searchRelevantPojk } from '@/lib/pojk-search'

const KLUSTER: Record<string, string> = {
  A: 'Risiko Asuransi',
  B: 'SDM & Kelembagaan',
  C: 'Pemasaran & Keagenan',
  D: 'Keuangan',
  E: 'Tata Kelola (GCG)',
  F: 'APU-PPT',
  G: 'Investasi',
  H: 'MRTI (TI)',
}

async function extractText(buf: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse')
    const result = await pdfParse(buf)
    return result.text
  }
  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value
  }
  if (ext === 'txt') {
    return buf.toString('utf-8')
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
  const file       = formData.get('file') as File | null

  if (!kode || !departemen || !file)
    return NextResponse.json({ error: 'kode, departemen, dan file wajib diisi' }, { status: 400 })

  // Validasi session
  const { data: session } = await db().from('onsite_sessions').select('kode').eq('kode', kode).single()
  if (!session) return NextResponse.json({ error: 'Kode pemeriksaan tidak valid' }, { status: 404 })

  // Simpan record dulu
  const { data: dokRec, error: insErr } = await db()
    .from('onsite_dokumen')
    .insert({ kode, departemen, nama_file: file.name, fokus, status: 'analyzing', created_by: user.id })
    .select()
    .single()
  if (insErr || !dokRec) return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 })

  // Ekstrak teks
  const buf = Buffer.from(await file.arrayBuffer())
  let teks: string
  try {
    teks = await extractText(buf, file.name)
  } catch {
    await db().from('onsite_dokumen').update({ status: 'error' }).eq('id', dokRec.id)
    return NextResponse.json({ error: 'Gagal mengekstrak teks dokumen' }, { status: 422 })
  }

  // RAG POJK
  const pojkRef = await searchRelevantPojk(`${departemen} pemeriksaan asuransi ${fokus}`)

  // AI analysis
  const instruksi = fokus
    ? `Fokus khusus dari pengawas: ${fokus}`
    : 'Lakukan analisis menyeluruh atas dokumen ini.'

  const TEMUAN_SCHEMA = `[
    {
      "judul": "...",
      "uraian": "...",
      "urgensi": "kritis|signifikan|perlu_perhatian",
      "sifat": "pelanggaran_ketentuan|potensi_pelanggaran|perlu_perbaikan",
      "kluster": "A|B|C|D|E|F|G|H",
      "pasal_terkait": ["..."],
      "rekomendasi": "..."
    }
  ]`

  const prompt = `Anda adalah pengawas OJK yang sedang melakukan pemeriksaan onsite perusahaan asuransi.
Departemen yang diperiksa: ${departemen}
${instruksi}

=== REFERENSI POJK ===
${pojkRef}

=== DOKUMEN: ${file.name} ===
${teks.slice(0, 20000)}

Kluster: A=Risiko Asuransi, B=SDM & Kelembagaan, C=Pemasaran & Keagenan, D=Keuangan, E=Tata Kelola (GCG), F=APU-PPT, G=Investasi, H=MRTI (TI)

Tugas Anda:
1. Buat ringkasan singkat dokumen (2-3 kalimat)
2. Identifikasi temuan RISK-BASED: kelemahan kontrol internal, risiko operasional, tata kelola, praktik berisiko — TANPA harus mengacu ke pasal POJK (pasal_terkait boleh kosong [])
3. Identifikasi temuan COMPLIANCE: pelanggaran atau potensi pelanggaran ketentuan POJK dari referensi di atas — WAJIB cantumkan pasal_terkait

Balas HANYA dalam JSON:
{
  "ringkasan": "...",
  "risk_based": ${TEMUAN_SCHEMA},
  "compliance": ${TEMUAN_SCHEMA}
}`

  type TemuanItem = {
    judul: string; uraian: string; urgensi: string; sifat: string
    kluster: string; pasal_terkait: string[]; rekomendasi: string
  }
  let ringkasan = ''
  let riskList: TemuanItem[] = []
  let complianceList: TemuanItem[] = []

  try {
    const aiResp = await callOpenRouter('Anda adalah pengawas OJK yang menganalisis dokumen pemeriksaan onsite. Balas HANYA dalam format JSON yang diminta.', prompt, 4000)
    const jsonMatch = aiResp.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')
    const json = JSON.parse(jsonMatch[0])
    ringkasan = json.ringkasan ?? ''
    riskList = json.risk_based ?? []
    complianceList = json.compliance ?? []
  } catch {
    ringkasan = 'Analisis selesai.'
  }

  const toInsert = [
    ...riskList.map(t => ({ ...t, tipe_analisis: 'risk_based' })),
    ...complianceList.map(t => ({ ...t, tipe_analisis: 'compliance' })),
  ]

  // Simpan temuan
  if (toInsert.length > 0) {
    const rows = toInsert.map(t => ({
      kode,
      judul: t.judul,
      uraian: t.uraian,
      urgensi: t.urgensi,
      sifat: t.sifat,
      kluster: t.kluster,
      kluster_nama: KLUSTER[t.kluster] ?? '',
      pasal_terkait: t.pasal_terkait ?? [],
      rekomendasi: t.rekomendasi,
      tipe_analisis: t.tipe_analisis,
      sumber_tipe: 'dokumen',
      sumber_id: dokRec.id,
      sumber_nama: file.name,
      status: 'draft',
    }))
    await db().from('onsite_temuan').insert(rows)
  }

  // Update dokumen status
  await db().from('onsite_dokumen').update({ status: 'done', ringkasan }).eq('id', dokRec.id)

  return NextResponse.json({ id: dokRec.id, ringkasan, jumlah_temuan: toInsert.length })
}
