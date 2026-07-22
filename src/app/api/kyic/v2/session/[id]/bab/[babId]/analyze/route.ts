import { NextRequest, NextResponse, after } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { callOpenRouter } from '@/lib/claude'
import { searchRelevantPojk } from '@/lib/pojk-search'
import { searchSedk } from '@/lib/sedk-search'
import { BabId, KYIC_BABS_MAP } from '@/lib/kyic-sections'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Unduh PDF dari storage dan ekstrak teks khusus untuk satu BAB via Anthropic Vision
async function extractBabFromPdf(storagePath: string, babNomor: number, babJudul: string): Promise<string> {
  const { data, error } = await adminClient.storage.from('ky-uploads').download(storagePath)
  if (error || !data) throw new Error('Gagal mengunduh PDF template dari storage')

  const buf = Buffer.from(await data.arrayBuffer())
  const base64 = buf.toString('base64')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          {
            type: 'text',
            text: `Dokumen ini adalah KYIC (Know Your Insurance Company) perusahaan asuransi Indonesia periode sebelumnya (T-1).

Fokus HANYA pada BAB ${babNomor} — "${babJudul}".

Ekstrak selengkap mungkin semua informasi, angka, tabel, dan narasi dari bagian tersebut.
Jangan ringkas — tulis semua kontennya apa adanya sebagai plain text.
Abaikan bagian lain yang tidak relevan dengan BAB ${babNomor}.`,
          },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic PDF OCR error ${res.status}: ${err.slice(0, 200)}`)
  }
  const data2 = await res.json()
  return (data2.content?.[0]?.text as string) || ''
}

async function runBabAnalysis(
  sessionId: string,
  babId: BabId,
  analisisId: string,
  jenisUsaha: string,
  templateText: string,
  dokumenTeks: string,
  catatanPengawas: string,
  prevResults: Record<string, string>,
) {
  const bab = KYIC_BABS_MAP[babId]
  if (!bab) return

  try {
    const pojkRef = await searchRelevantPojk(`${bab.judul} perusahaan asuransi`, 8, jenisUsaha)
    const sedkRef = await searchSedk(`${bab.judul} pengawasan asuransi berbasis risiko`, 6)

    // Untuk BAB 9, sertakan ringkasan hasil bab sebelumnya
    const prevSummary = Object.entries(prevResults).length > 0
      ? `=== RINGKASAN ANALISIS BAB SEBELUMNYA ===\n${Object.entries(prevResults).map(([k, v]) => `[${k}]\n${v}`).join('\n\n')}\n`
      : ''

    const prompt = `Anda adalah pengawas OJK senior yang menyusun KYIC (Know Your Insurance Company) untuk perusahaan asuransi.
Jenis Usaha: ${jenisUsaha || 'Perusahaan Asuransi'}
BAB yang dianalisis: BAB ${bab.nomor} — ${bab.judul}

Sub-sections yang perlu diisi:
${bab.sub_sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

=== KYIC PERIODE T-1 (BASELINE) ===
${templateText.slice(0, 8000)}

=== DOKUMEN PENDUKUNG PERIODE INI ===
${dokumenTeks ? dokumenTeks.slice(0, 15000) : '(Tidak ada dokumen pendukung — analisis berdasarkan KYIC T-1 dan catatan pengawas)'}

=== CATATAN PENGAWAS ===
${catatanPengawas || '(Tidak ada catatan)'}

${prevSummary}

=== REFERENSI REGULASI (POJK) ===
${pojkRef}

=== REFERENSI SEDK (STANDAR PENGAWASAN) ===
${sedkRef}

=== INSTRUKSI ANALISIS ===
${bab.prompt_instruction}

BATASAN KETAT:
- Hanya gunakan fakta yang ada dalam dokumen/catatan yang diberikan
- Jangan mengarang angka, threshold, atau ketentuan yang tidak ada di referensi
- Bandingkan kondisi saat ini vs periode T-1 untuk setiap aspek
- Gunakan bahasa formal pengawas OJK Indonesia

Balas HANYA dengan JSON (tanpa markdown):
{
  "ringkasan": "Ringkasan 2-3 kalimat kondisi BAB ini",
  "sub_sections": {
    "${bab.sub_sections[0]}": "Narasi analisis untuk sub-section ini",
    ...semua sub-sections lainnya
  },
  "perubahan_vs_T1": "Perubahan signifikan vs periode lalu (membaik/memburuk/stabil)",
  "findings": [
    {"judul": "...", "uraian": "...", "urgensi": "tinggi|sedang|rendah"}
  ],
  "rekomendasi": "Rekomendasi konkret untuk pengawas",
  "draft_teks": "Draft teks narasi untuk dimasukkan ke dokumen KYIC final (2-4 paragraf)"
}`

    const aiResp = await callOpenRouter(
      'Anda adalah pengawas OJK senior. Balas HANYA dengan JSON valid tanpa markdown.',
      prompt,
      6000
    )

    let hasil: Record<string, unknown> = {}
    const cleaned = aiResp.replace(/^```[a-z]*\n?/gm, '').replace(/^```$/gm, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { hasil = JSON.parse(match[0]) } catch { /* ignore */ }
    }
    if (!hasil.ringkasan) {
      try { hasil = JSON.parse(cleaned) } catch { /* ignore */ }
    }

    console.log(`[kyic/v2] bab=${babId} analisis selesai, findings=${Array.isArray(hasil.findings) ? hasil.findings.length : 0}`)

    await db()
      .from('ky_analisis')
      .update({ status: 'done', hasil_json: hasil, analyzed_at: new Date().toISOString() })
      .eq('id', analisisId)

  } catch (err) {
    console.error(`[kyic/v2] bab=${babId} error:`, err)
    await db()
      .from('ky_analisis')
      .update({ status: 'error', hasil_json: { error: 'Analisis gagal — coba lagi.' } })
      .eq('id', analisisId)
  }
}

// POST — trigger analisis untuk satu BAB
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; babId: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId, babId } = await params

  if (!KYIC_BABS_MAP[babId as BabId])
    return NextResponse.json({ error: 'BAB tidak valid' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const catatanPengawas: string = body.catatan_pengawas ?? ''

  // Ambil data session
  const { data: session, error: sessErr } = await db()
    .from('ky_session')
    .select('id, jenis_usaha, template_text, template_sections, template_storage_path')
    .eq('id', sessionId)
    .single()

  if (sessErr || !session)
    return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

  // Ambil dokumen pendukung untuk bab ini
  const { data: dokList } = await db()
    .from('ky_dokumen')
    .select('nama_file, teks_ekstrak')
    .eq('session_id', sessionId)
    .eq('bab_id', babId)

  const dokumenTeks = (dokList ?? [])
    .map(d => `=== ${d.nama_file} ===\n${d.teks_ekstrak ?? ''}`)
    .join('\n\n')
    .slice(0, 25000)

  // Ambil hasil analisis bab lain (untuk BAB 9 dan konteks)
  const { data: prevAnalisis } = await db()
    .from('ky_analisis')
    .select('bab_id, hasil_json')
    .eq('session_id', sessionId)
    .eq('status', 'done')
    .neq('bab_id', babId)

  const prevResults: Record<string, string> = {}
  for (const a of prevAnalisis ?? []) {
    const h = a.hasil_json as Record<string, unknown> | null
    if (h?.ringkasan) prevResults[a.bab_id] = String(h.ringkasan)
  }

  // Upsert record analisis dengan status 'analyzing'
  const { data: analisisRec, error: upsertErr } = await db()
    .from('ky_analisis')
    .upsert(
      {
        session_id: sessionId,
        bab_id: babId,
        status: 'analyzing',
        catatan_pengawas: catatanPengawas,
        analyzed_at: null,
      },
      { onConflict: 'session_id,bab_id' }
    )
    .select('id')
    .single()

  if (upsertErr || !analisisRec)
    return NextResponse.json({ error: 'Gagal menyimpan status analisis' }, { status: 500 })

  // Simpan catatan pengawas ke dokumen record juga
  if (catatanPengawas) {
    await db()
      .from('ky_analisis')
      .update({ catatan_pengawas: catatanPengawas })
      .eq('id', analisisRec.id)
  }

  // Tentukan template text untuk BAB ini:
  // 1. Kalau docx → pakai template_sections[babId] (sudah di-parse per-BAB)
  // 2. Kalau PDF scan (template_storage_path ada) → OCR per-BAB via Anthropic saat after()
  const sections = (session.template_sections ?? {}) as Record<string, string>
  const storagePath: string | null = (session as Record<string, unknown>).template_storage_path as string | null
  const babInfo = KYIC_BABS_MAP[babId as BabId]
  const templateTextFromSections = sections[babId] ?? session.template_text ?? ''

  after(async () => {
    let templateText = templateTextFromSections

    // PDF scan: ekstrak teks BAB ini dari Anthropic dulu
    if (storagePath && !templateText.trim()) {
      try {
        templateText = await extractBabFromPdf(storagePath, babInfo?.nomor ?? 0, babInfo?.judul ?? babId)
      } catch (err) {
        console.error(`[kyic/v2] OCR bab=${babId} gagal:`, err)
        templateText = '(Gagal membaca PDF T-1 untuk BAB ini)'
      }
    }

    await runBabAnalysis(
      sessionId,
      babId as BabId,
      analisisRec.id,
      session.jenis_usaha ?? '',
      templateText,
      dokumenTeks,
      catatanPengawas,
      prevResults,
    )
  })

  return NextResponse.json({ id: analisisRec.id, analyzing: true })
}
