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

export async function callOpenRouter(systemPrompt: string, userPrompt: string, maxTokens = 4000, apiKey = ''): Promise<string> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY || ''
  if (!key) throw new Error('Anthropic API key tidak ditemukan. Pastikan API key diisi saat login.')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  return (data.content?.[0]?.text as string) || 'Tidak ada hasil.'
}
