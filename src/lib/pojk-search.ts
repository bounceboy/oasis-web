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

function formatChunks(chunks: { pasal: string; content: string; pojk_id?: string; source?: string }[]): string {
  if (!chunks.length) return 'Tidak ada referensi POJK yang relevan ditemukan.'

  return chunks
    .map((c) => `[${c.source || c.pojk_id} - ${c.pasal}]\n${c.content}`)
    .join('\n\n---\n\n')
}
