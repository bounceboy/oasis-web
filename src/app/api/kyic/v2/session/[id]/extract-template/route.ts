import { NextRequest, NextResponse, after } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KYIC_BAB_IDS = [
  { id: 'kepemilikan',      label: 'Kepemilikan dan Struktur Kelompok Usaha' },
  { id: 'kegiatan_bisnis',  label: 'Kegiatan Bisnis Utama' },
  { id: 'kegiatan_penunjang', label: 'Kegiatan Penunjang' },
  { id: 'rencana_bisnis',   label: 'Rencana Bisnis' },
  { id: 'tingkat_kesehatan', label: 'Tingkat Kesehatan' },
  { id: 'kinerja_keuangan', label: 'Kinerja Keuangan' },
  { id: 'organisasi_mr_spi', label: 'Organisasi, Manajemen Risiko, dan SPI' },
  { id: 'status_pengawasan', label: 'Status Pengawasan dan Kepatuhan' },
  { id: 'fokus_pengawasan', label: 'Penetapan Fokus Pengawasan' },
]

async function doExtract(sessionId: string, storagePath: string) {
  try {
    // Unduh PDF dari storage
    const { data, error } = await adminClient.storage.from('ky-uploads').download(storagePath)
    if (error || !data) throw new Error('Gagal mengunduh PDF')

    const buf = Buffer.from(await data.arrayBuffer())
    const base64 = buf.toString('base64')

    const prompt = `Dokumen ini adalah KYIC (Know Your Insurance Company) perusahaan asuransi Indonesia periode sebelumnya (T-1/baseline).

Ekstrak isi dari masing-masing bagian berikut dan kembalikan sebagai JSON.
Untuk setiap bagian, tulis SEMUA informasi, angka, tabel, dan narasi yang ada — jangan diringkas.
Kalau bagian tidak ditemukan atau kosong, isi dengan string kosong "".

Kembalikan HANYA JSON valid (tanpa markdown) dengan format berikut:
{
  "kepemilikan": "seluruh teks dari bagian Kepemilikan dan Struktur Kelompok Usaha",
  "kegiatan_bisnis": "seluruh teks dari bagian Kegiatan Bisnis Utama",
  "kegiatan_penunjang": "seluruh teks dari bagian Kegiatan Penunjang",
  "rencana_bisnis": "seluruh teks dari bagian Rencana Bisnis",
  "tingkat_kesehatan": "seluruh teks dari bagian Tingkat Kesehatan",
  "kinerja_keuangan": "seluruh teks dari bagian Kinerja Keuangan",
  "organisasi_mr_spi": "seluruh teks dari bagian Organisasi, Manajemen Risiko, dan SPI",
  "status_pengawasan": "seluruh teks dari bagian Status Pengawasan dan Kepatuhan / Isu Kepatuhan",
  "fokus_pengawasan": "seluruh teks dari bagian Penetapan Fokus Pengawasan"
}

Perhatikan: bagian-bagian ini mungkin diberi label berbeda (mis. "BAB 1", "A.", "I.", dll.) — temukan berdasarkan kontennya.`

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
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 200)}`)
    }

    const aiData = await res.json()
    const rawText: string = aiData.content?.[0]?.text || ''

    // Parse JSON hasil ekstraksi
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Respons AI tidak mengandung JSON valid')

    let sections: Record<string, string> = {}
    try {
      sections = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Gagal parse JSON dari respons AI')
    }

    // Trim tiap section (max 8000 chars)
    const trimmed: Record<string, string> = {}
    for (const bab of KYIC_BAB_IDS) {
      const text = sections[bab.id] ?? ''
      trimmed[bab.id] = text.slice(0, 8000)
    }

    await db()
      .from('ky_session')
      .update({ template_sections: trimmed, updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    console.log(`[kyic] extract-template selesai, ${Object.values(trimmed).filter(v => v.length > 50).length}/9 BAB terisi`)
  } catch (err) {
    console.error('[kyic] extract-template gagal:', err)
    // Simpan error marker supaya UI tahu extraction gagal
    await db()
      .from('ky_session')
      .update({ template_sections: { _error: 'Gagal membaca PDF T-1' }, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  }
}

// POST — trigger ekstraksi template T-1 dari PDF (background)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: session } = await db()
    .from('ky_session')
    .select('template_storage_path')
    .eq('id', id)
    .single()

  const storagePath = (session as Record<string, unknown>)?.template_storage_path as string | null
  if (!storagePath) return NextResponse.json({ error: 'PDF template belum diupload' }, { status: 400 })

  after(() => doExtract(id, storagePath))

  return NextResponse.json({ ok: true, extracting: true })
}
