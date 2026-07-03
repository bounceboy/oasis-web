const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-sonnet-4-5'

type AnalyzeParams = {
  maskedText: string
  pojkContext: string
  namaEntitas: string // sudah dimasking
  jenisUsaha: string
}

export async function analyzeCompliance({
  maskedText,
  pojkContext,
  namaEntitas,
  jenisUsaha,
}: AnalyzeParams): Promise<string> {
  const systemPrompt = `Anda adalah analis pemeriksaan OJK yang berpengalaman.
Tugas Anda: lakukan pemeriksaan kepatuhan (compliance check) dokumen perusahaan asuransi terhadap regulasi POJK yang berlaku.

REFERENSI POJK RELEVAN:
${pojkContext}

INSTRUKSI:
- Identifikasi potensi pelanggaran atau ketidaksesuaian dengan POJK
- Sebutkan nomor POJK dan pasal spesifik untuk setiap temuan
- Gunakan format terstruktur: Temuan, Pasal Terkait, Rekomendasi
- Hanya rujuk pasal yang ada di REFERENSI POJK di atas
- Token seperti [PERSON_001] atau [COMPANY_001] adalah data yang disembunyikan untuk privasi — abaikan saja dalam analisis`

  const userPrompt = `Periksa dokumen berikut dari ${namaEntitas} (${jenisUsaha}):

${maskedText.slice(0, 30000)}`

  return callOpenRouter(systemPrompt, userPrompt)
}

export async function analyzeRisk({
  maskedText,
  pojkContext,
  namaEntitas,
  jenisUsaha,
  complianceResult,
}: AnalyzeParams & { complianceResult: string }): Promise<string> {
  const systemPrompt = `Anda adalah analis risiko OJK yang berpengalaman.
Tugas Anda: lakukan penilaian risiko (risk-based assessment) berdasarkan dokumen dan temuan compliance.

REFERENSI POJK RELEVAN:
${pojkContext}

HASIL COMPLIANCE CHECK (gunakan sebagai konteks):
${complianceResult.slice(0, 3000)}

INSTRUKSI:
- Identifikasi risiko utama: operasional, pasar, kredit, hukum, reputasi
- Nilai tingkat risiko: Tinggi / Sedang / Rendah untuk setiap kategori
- Berikan rekomendasi mitigasi konkret
- Token seperti [PERSON_001] adalah data yang disembunyikan — abaikan dalam analisis`

  const userPrompt = `Dokumen: ${namaEntitas} (${jenisUsaha})

${maskedText.slice(0, 25000)}`

  return callOpenRouter(systemPrompt, userPrompt)
}

async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://oasis-ojk.vercel.app',
      'X-Title': 'OASIS OJK',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'Tidak ada hasil.'
}
