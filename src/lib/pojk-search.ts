import { createClient } from '@/lib/supabase/server'

export async function searchRelevantPojk(query: string, limit = 10): Promise<string> {
  const supabase = await createClient()

  // Full-text search via kolom fts yang sudah ada (generated, config 'simple')
  const { data, error } = await supabase
    .from('pojk_chunks')
    .select('pasal, content, pojk_id, source')
    .textSearch('fts', query.split(' ').slice(0, 5).join(' | '), {
      type: 'plain',
      config: 'simple',
    })
    .limit(limit)

  if (error || !data?.length) {
    // Fallback: ambil chunks umum jika search gagal
    const { data: fallback } = await supabase
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
