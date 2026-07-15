// OASIS Local — semua generasi teks lewat Ollama di laptop (bukan cloud).
// Nama fungsi callOpenRouter dipertahankan agar modul lain (psak117, lhptl, kyic, renbis)
// tidak perlu diubah sama sekali.
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b'

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

export async function callOpenRouter(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature: 0.2,
        // Konteks besar penting: prompt ekstraksi bisa 100k+ karakter.
        // 32768 token ≈ batas aman qwen2.5:7b; naikkan jika RAM cukup.
        num_ctx: 32768,
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ollama error ${res.status}: ${err} — pastikan Ollama berjalan (ollama serve) dan model ${MODEL} sudah di-pull`)
  }

  const data = await res.json()
  return data.message?.content || 'Tidak ada hasil.'
}
