import { db } from '@/lib/db'
import OpenAI from 'openai'

type Sektor = 'asuransi' | 'dapen' | 'penjaminan'

// Sektor ditentukan dari teks jenis usaha sesi. Selain dana pensiun / penjaminan = asuransi
// (perilaku lama tidak berubah).
function sektorDariJenisUsaha(jenisUsaha: string): Sektor {
  if (/dana pensiun|dapen|dppk|dplk|ppmp|ppip/i.test(jenisUsaha)) return 'dapen'
  if (/penjamin|jamkrida|jamkrindo/i.test(jenisUsaha)) return 'penjaminan'
  return 'asuransi'
}

// Tentukan kategori filter berdasarkan jenis_usaha dari sesi.
// Peraturan 'lintas' (berlaku untuk semua sektor PPDP) berkategori 'keduanya'.
function kategoriFilter(jenisUsaha: string, sektor: Sektor): string[] {
  if (sektor === 'dapen') return ['dapen', 'keduanya']
  if (sektor === 'penjaminan') return ['penjaminan', 'keduanya']
  const isSymariah = /syariah/i.test(jenisUsaha)
  return isSymariah ? ['syariah', 'keduanya'] : ['konvensional', 'keduanya']
}

const sektorBoleh = (sektor: Sektor) => [sektor, 'lintas']

async function embedQuery(text: string): Promise<number[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: text.slice(0, 8000) })
  return res.data[0].embedding
}

type Baris = { pasal: string; content: string; pojk_id?: string; source?: string }

export async function searchRelevantPojk(query: string, limit = 10, jenisUsaha = ''): Promise<string> {
  const sektor = sektorDariJenisUsaha(jenisUsaha)
  const allowed = kategoriFilter(jenisUsaha, sektor)

  // Dana pensiun & penjaminan: pencarian makna (vektor). Pencarian kata kunci lama terlalu longgar untuk
  // sektor baru ini dan bisa mengembalikan pasal yang tidak relevan.
  if (sektor !== 'asuransi') {
    try {
      const embedding = await embedQuery(query)
      const { data, error } = await db().rpc('match_pojk_chunks_kategori', {
        query_embedding: embedding,
        match_count: Math.max(limit, 12),
        filter_kategori: allowed,
        filter_sektor: sektorBoleh(sektor),
        hanya_berlaku: true,
      })
      if (!error && data?.length) return formatChunks(data as Baris[])
      console.error('[pojk-search] pencarian vektor kosong/error:', error?.message)
    } catch (err) {
      console.error('[pojk-search] embedding gagal, pakai kata kunci:', err)
    }
    const { data: fts } = await db()
      .from('pojk_chunks')
      .select('pasal, content, pojk_id, source')
      .textSearch('fts', query.split(' ').slice(0, 5).join(' | '), { type: 'plain', config: 'simple' })
      .in('kategori', allowed)
      .in('sektor', sektorBoleh(sektor))
      .eq('status', 'berlaku')
      .limit(limit)
    return formatChunks((fts ?? []) as Baris[])
  }

  // Asuransi: alur lama, hanya ditambah penyaring sektor & status berlaku.
  const { data, error } = await db()
    .from('pojk_chunks')
    .select('pasal, content, pojk_id, source, kategori')
    .textSearch('fts', query.split(' ').slice(0, 5).join(' | '), {
      type: 'plain',
      config: 'simple',
    })
    .in('kategori', allowed)
    .in('sektor', sektorBoleh(sektor))
    .eq('status', 'berlaku')
    .limit(limit)

  if (error || !data?.length) {
    const { data: fallback } = await db()
      .from('pojk_chunks')
      .select('pasal, content, pojk_id, source, kategori')
      .in('kategori', allowed)
      .in('sektor', sektorBoleh(sektor))
      .eq('status', 'berlaku')
      .limit(5)
    return formatChunks(fallback || [])
  }

  return formatChunks(data)
}

// Referensi khusus modul Renbis: peraturan inti rencana bisnis + SEOJK bentuk laporan (rencana & realisasi) yang sesuai.
// Pencarian kata kunci lama mensyaratkan semua kata ada dalam satu potongan sehingga tabel format lampiran SEOJK
// mengalahkan pasal peraturan inti. Di sini tiap sumber dicari dengan beberapa pertanyaan sasaran (pencarian makna).
const RENBIS_PERTANYAAN = [
  'penyampaian rencana bisnis batas waktu paling lambat persetujuan dewan komisaris',
  'cakupan isi rencana bisnis ringkasan eksekutif visi misi strategi',
  'proyeksi keuangan asumsi rencana permodalan investasi',
  'laporan realisasi rencana bisnis kuantitatif kualitatif',
  'perubahan atau penyesuaian rencana bisnis frekuensi penyampaian',
]

export async function searchReferensiRenbis(namaEntitas: string, jenisUsaha = ''): Promise<string> {
  const syariah = /syariah/i.test(`${namaEntitas} ${jenisUsaha}`)
  const sumber = ['POJK No. 24 Tahun 2019', syariah ? 'SEOJK No. 10 Tahun 2021' : 'SEOJK No. 23 Tahun 2024']
  try {
    const res = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).embeddings.create({
      model: 'text-embedding-3-small',
      input: RENBIS_PERTANYAAN,
    })
    const embeddings = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding)
    const hasil = await Promise.all(
      sumber.flatMap((src) =>
        embeddings.map((emb) =>
          db().rpc('match_pojk_chunks', { query_embedding: emb, match_count: 2, filter_source: src })
        )
      )
    )
    const unik = new Map<string, Baris & { id?: string; similarity?: number }>()
    for (const h of hasil) {
      for (const c of (h.data ?? []) as Array<Baris & { id?: string; similarity?: number }>) {
        const k = c.id ?? `${c.source}|${c.pasal}|${c.content.slice(0, 40)}`
        const lama = unik.get(k)
        if (!lama || (c.similarity ?? 0) > (lama.similarity ?? 0)) unik.set(k, c)
      }
    }
    if (!unik.size) throw new Error('tidak ada hasil')
    // peraturan inti dulu, baru SEOJK
    const urut = [...unik.values()].sort((a, b) => sumber.indexOf(a.source ?? '') - sumber.indexOf(b.source ?? '') || (b.similarity ?? 0) - (a.similarity ?? 0))
    return formatChunks(urut)
  } catch (err) {
    console.error('[pojk-search] referensi Renbis gagal, kembali ke pencarian lama:', err)
    return searchRelevantPojk('rencana bisnis perusahaan asuransi penyampaian', 10, jenisUsaha)
  }
}

function formatChunks(chunks: { pasal: string; content: string; pojk_id?: string; source?: string }[]): string {
  if (!chunks.length) return 'Tidak ada referensi POJK yang relevan ditemukan.'

  return chunks
    .map((c) => `[${c.source || c.pojk_id} - ${c.pasal}]\n${c.content}`)
    .join('\n\n---\n\n')
}
