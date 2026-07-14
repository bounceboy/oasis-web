import { db } from '@/lib/db'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return res.data[0].embedding
}

export async function searchSedk(query: string, matchCount = 6): Promise<string> {
  const embedding = await embedQuery(query)
  const { data, error } = await db().rpc('search_sedk', {
    query_embedding: embedding,
    match_count: matchCount,
  })
  if (error || !data?.length) return 'Tidak ada referensi SEDK relevan.'
  return (data as Array<{ source: string; pasal: string | null; content: string }>)
    .map((c) => `[${c.source}${c.pasal ? ' — ' + c.pasal : ''}]\n${c.content}`)
    .join('\n\n---\n\n')
}

export async function searchPsak117(query: string, matchCount = 6, filterBab?: string): Promise<string> {
  const embedding = await embedQuery(query)
  const rpcParams: Record<string, unknown> = { query_embedding: embedding, match_count: matchCount }
  if (filterBab) rpcParams.filter_bab = filterBab
  const { data, error } = await db().rpc('search_psak117', rpcParams)
  if (error || !data?.length) return 'Tidak ada referensi Petunjuk Teknis PSAK 117 relevan.'
  return (data as Array<{ bab: string | null; bab_title: string | null; seksi: string | null; content: string }>)
    .map((c) => `[Petunjuk Teknis PSAK 117${c.bab ? ' — ' + c.bab : ''}${c.bab_title ? ': ' + c.bab_title : ''}${c.seksi ? ' §' + c.seksi : ''}]\n${c.content}`)
    .join('\n\n---\n\n')
}

export async function searchReferences(query: string, matchCount = 8): Promise<string> {
  const embedding = await embedQuery(query)
  const { data, error } = await db().rpc('search_references', {
    query_embedding: embedding,
    match_count: matchCount,
    doc_types: ['sedk', 'pdk'],
  })
  if (error || !data?.length) return 'Tidak ada referensi relevan.'
  return (data as Array<{ doc_type: string; source: string; pasal: string | null; content: string }>)
    .map((c) => `[${c.doc_type.toUpperCase()} — ${c.source}${c.pasal ? ' — ' + c.pasal : ''}]\n${c.content}`)
    .join('\n\n---\n\n')
}
