import type { MaskingEntity, MaskingVault } from '@/types'

const CHUNK_SIZE = 8000
const NIK_REGEX = /\b\d{16}\b/g

// Stopword list untuk kurangi false positive Ollama
const STOPWORDS = new Set([
  'klaim', 'premi', 'polis', 'manfaat', 'pertanggungan', 'asuransi',
  'indonesia', 'ojk', 'pojk', 'direksi', 'komisaris', 'laporan',
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
])

function generateToken(category: string, index: number): string {
  return `[${category}_${String(index).padStart(3, '0')}]`
}

export async function maskDocument(
  text: string,
  ollamaUrl = 'http://localhost:11434'
): Promise<{ maskedText: string; vault: MaskingVault; entities: MaskingEntity[] }> {
  const chunks = []
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE))
  }

  const entityMap = new Map<string, MaskingEntity>() // original -> entity
  let counters: Record<string, number> = { PERSON: 0, COMPANY: 0, PRODUCT: 0, NIK: 0 }

  // Deteksi NIK via regex dulu
  const nikMatches = text.match(NIK_REGEX) || []
  for (const nik of nikMatches) {
    if (!entityMap.has(nik)) {
      const token = generateToken('NIK', ++counters.NIK)
      entityMap.set(nik, { original: nik, token, category: 'NIK' })
    }
  }

  // Deteksi entitas lain via Ollama per chunk
  for (const chunk of chunks) {
    const prompt = `Ekstrak entitas dari teks berikut. Kembalikan JSON array dengan format:
[{"text": "nama entitas", "type": "PERSON|COMPANY|PRODUCT"}]
Hanya kembalikan JSON, tidak ada teks lain.
Abaikan nama kota, nama bulan, nama regulasi, dan kata umum.

Teks:
${chunk.slice(0, 4000)}`

    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1:8b',
          prompt,
          stream: false,
          options: { num_ctx: 8192, temperature: 0 },
        }),
        signal: AbortSignal.timeout(60000),
      })

      if (!res.ok) continue

      const data = await res.json()
      const jsonMatch = data.response?.match(/\[[\s\S]*?\]/)
      if (!jsonMatch) continue

      const extracted = JSON.parse(jsonMatch[0]) as { text: string; type: string }[]
      for (const ent of extracted) {
        const normalized = ent.text.trim()
        if (
          normalized.length < 3 ||
          STOPWORDS.has(normalized.toLowerCase()) ||
          entityMap.has(normalized)
        ) continue

        const cat = ent.type as MaskingEntity['category']
        if (!['PERSON', 'COMPANY', 'PRODUCT'].includes(cat)) continue

        const token = generateToken(cat, ++counters[cat])
        entityMap.set(normalized, { original: normalized, token, category: cat })
      }
    } catch {
      // Lanjut ke chunk berikutnya jika Ollama timeout
    }
  }

  // Bangun vault dan lakukan penggantian
  const vault: MaskingVault = {}
  const entities = Array.from(entityMap.values())

  // Sort panjang descending agar nama panjang diganti duluan
  entities.sort((a, b) => b.original.length - a.original.length)

  let maskedText = text
  for (const ent of entities) {
    vault[ent.token] = ent.original
    maskedText = maskedText.split(ent.original).join(ent.token)
  }

  return { maskedText, vault, entities }
}

export function demaskText(maskedText: string, vault: MaskingVault): string {
  let result = maskedText
  for (const [token, original] of Object.entries(vault)) {
    result = result.split(token).join(original)
  }
  return result
}

export function detectLeaks(text: string, vault: MaskingVault): string[] {
  const leaks: string[] = []
  for (const original of Object.values(vault)) {
    if (text.includes(original)) leaks.push(original)
  }
  return leaks
}
