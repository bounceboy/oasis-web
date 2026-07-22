import { db } from '@/lib/db'

// Tentukan kategori filter berdasarkan jenis_usaha dari sesi
function kategoriFilter(jenisUsaha: string): string[] {
  const isSymariah = /syariah/i.test(jenisUsaha)
  return isSymariah ? ['syariah', 'keduanya'] : ['konvensional', 'keduanya']
}

export async function searchRelevantPojk(query: string, limit = 10, jenisUsaha = ''): Promise<string> {
  const allowed = kategoriFilter(jenisUsaha)

  const { data, error } = await db()
    .from('pojk_chunks')
    .select('pasal, content, pojk_id, source, kategori')
    .textSearch('fts', query.split(' ').slice(0, 5).join(' | '), {
      type: 'plain',
      config: 'simple',
    })
    .in('kategori', allowed)
    .limit(limit)

  if (error || !data?.length) {
    const { data: fallback } = await db()
      .from('pojk_chunks')
      .select('pasal, content, pojk_id, source, kategori')
      .in('kategori', allowed)
      .limit(5)
    return formatChunks(fallback || [])
  }

  return formatChunks(data)
}

function formatChunks(chunks: { pasal: string; content: string; pojk_id: string; source?: string }[]): string {
  if (!chunks.length) return 'Tidak ada referensi POJK yang relevan ditemukan.'

  return chunks
    .map((c) => `[${c.source || c.pojk_id} - ${c.pasal}]\n${c.content}`)
    .join('\n\n---\n\n')
}
