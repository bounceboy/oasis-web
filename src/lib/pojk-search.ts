import { db } from '@/lib/db'

export async function searchRelevantPojk(query: string, limit = 10): Promise<string> {
  const { data, error } = await db()
    .from('pojk_chunks')
    .select('pasal, content, pojk_id, source')
    .textSearch('fts', query.split(' ').slice(0, 5).join(' | '), {
      type: 'plain',
      config: 'simple',
    })
    .limit(limit)

  if (error || !data?.length) {
    const { data: fallback } = await db()
      .from('pojk_chunks')
      .select('pasal, content, pojk_id')
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
