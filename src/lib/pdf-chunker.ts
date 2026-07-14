/**
 * pdf-chunker.ts
 * Server-side PDF processing: ekstrak teks per halaman + page classifier.
 * Dipakai oleh semua modul offsite (PSAK 117, LHPTL, KYNBFI, Renbis, dll.)
 */

export interface PageChunk {
  page: number
  text: string
  charCount: number
}

export interface PageClassifierConfig {
  /** Keyword yang menandakan halaman ini relevan untuk modul */
  includeKeywords: string[]
  /** Keyword yang jika ADA membuat halaman ini di-skip (mis. EN pages) */
  excludeKeywords?: string[]
  /**
   * Keyword prioritas tinggi: halaman yang mengandung salah satu keyword ini
   * mendapat skor 4x (bukan 2x) walaupun ada angka. Berguna untuk tabel
   * data kritis (Stage ECL, CSM roll-forward) yang harus selalu diprioritaskan.
   */
  highPriorityKeywords?: string[]
  /** Minimum karakter agar halaman dianggap berisi konten bermakna */
  minChars?: number
  /** Jumlah maks karakter dari halaman terpilih yang dikirim ke AI */
  maxTotalChars?: number
}

/**
 * Ekstrak teks per halaman dari Buffer PDF menggunakan pdf-parse.
 * Catatan: pdf-parse memberi teks halaman-per-halaman via pagerender callback.
 */
export async function extractPdfPages(buffer: Buffer): Promise<PageChunk[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')

  const pages: PageChunk[] = []
  let currentPage = 0

  const options = {
    pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => {
      currentPage++
      return pageData.getTextContent().then((textContent) => {
        // Rekonstruksi teks dengan memperhatikan posisi vertikal (y) untuk urutan baris
        type Item = { str: string; x: number; y: number }
        const items: Item[] = textContent.items.map((item) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
        }))

        // Sort by y descending (atas ke bawah), lalu x ascending (kiri ke kanan)
        items.sort((a, b) => {
          const yDiff = b.y - a.y
          if (Math.abs(yDiff) > 3) return yDiff
          return a.x - b.x
        })

        // Gabungkan dengan newline saat y berubah signifikan
        let text = ''
        let lastY = -Infinity
        for (const item of items) {
          if (Math.abs(item.y - lastY) > 3 && text.length > 0) {
            text += '\n'
          }
          text += item.str
          lastY = item.y
        }

        text = text.trim()
        if (text.length > 30) {
          pages.push({ page: currentPage, text, charCount: text.length })
        }
        return text
      })
    },
  }

  await pdfParse(buffer, options)
  return pages
}

/**
 * Pilih halaman relevan berdasarkan config modul.
 * Return: teks halaman terpilih digabung, dengan header nomor halaman.
 *
 * Strategi dua layer:
 * 1. Halaman wajib (mustIncludeFirstN): selalu sertakan N halaman pertama
 *    (laporan keuangan utama: neraca, laba rugi, arus kas biasanya di awal)
 * 2. Halaman CALK: dipilih berdasarkan keyword scoring dari sisa dokumen
 */
export function selectRelevantPages(
  pages: PageChunk[],
  config: PageClassifierConfig & { mustIncludeFirstN?: number }
): { selected: PageChunk[]; combinedText: string; totalPages: number } {
  const {
    includeKeywords,
    excludeKeywords = [],
    highPriorityKeywords = [],
    minChars = 100,
    maxTotalChars = 120000,
    mustIncludeFirstN = 25,
  } = config

  const lowerInclude = includeKeywords.map((k) => k.toLowerCase())
  const lowerExclude = excludeKeywords.map((k) => k.toLowerCase())
  const lowerHigh = highPriorityKeywords.map((k) => k.toLowerCase())

  // Layer 1: halaman awal wajib (neraca, laba rugi, arus kas)
  const mustPages = pages
    .filter((p) => p.page <= mustIncludeFirstN && p.charCount >= minChars)

  const mustPageNums = new Set(mustPages.map((p) => p.page))
  let totalChars = mustPages.reduce((s, p) => s + p.charCount, 0)

  // Layer 2: halaman CALK dari sisa dokumen, scoring berdasarkan keyword
  // Bonus: halaman dengan angka ≥4 digit lebih diprioritaskan (tabel numerik > narasi kebijakan)
  // High-priority: halaman dengan highPriorityKeywords + angka mendapat 4x (vs 2x biasa)
  const hasNumbers = (text: string) => /\d{4,}/.test(text)

  const calkCandidates = pages
    .filter((p) => !mustPageNums.has(p.page) && p.charCount >= minChars)
    .map((p) => {
      const lower = p.text.toLowerCase()
      if (lowerExclude.length > 0 && lowerExclude.some((kw) => lower.includes(kw))) {
        return { ...p, score: -1 }
      }
      const kwScore = lowerInclude.filter((kw) => lower.includes(kw)).length
      if (kwScore === 0) return { ...p, score: 0 }
      const isNumeric = hasNumbers(p.text)
      const isHighPriority = lowerHigh.length > 0 && isNumeric && lowerHigh.some((kw) => lower.includes(kw))
      const numericBonus = isHighPriority ? 4 : isNumeric ? 2 : 1
      return { ...p, score: kwScore * numericBonus }
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.page - b.page)

  const calkSelected: PageChunk[] = []
  const maxCalk = maxTotalChars - totalChars
  let calkChars = 0
  for (const p of calkCandidates) {
    if (calkChars + p.charCount > maxCalk) continue
    calkSelected.push(p)
    calkChars += p.charCount
  }

  // Gabung dan sort by page number
  const selected = [...mustPages, ...calkSelected].sort((a, b) => a.page - b.page)

  const combinedText = selected
    .map((p) => `--- Halaman ${p.page} ---\n${p.text}`)
    .join('\n\n')

  return { selected, combinedText, totalPages: pages.length }
}

// ─── Konfigurasi per modul ────────────────────────────────────────────────────

export const PSAK117_PAGE_CONFIG: PageClassifierConfig = {
  includeKeywords: [
    // Laporan utama
    'total aset', 'total liabilitas', 'ekuitas', 'laba', 'pendapatan',
    'beban jasa asuransi', 'klaim', 'investasi', 'arus kas',
    // PSAK 117 / IFRS 17
    'csm', 'margin jasa kontraktual', 'contractual service margin',
    'lrc', 'lic', 'risk adjustment', 'penyesuaian risiko',
    'loss component', 'komponen kerugian',
    'liability for remaining coverage', 'liabilitas atas sisa pertanggungan',
    'gmm', 'bba', 'paa', 'vfa',
    // IFRS 9
    'expected credit loss', 'ecl', 'kerugian kredit ekspektasian',
    'stage 1', 'stage 2', 'stage 3',
    'cadangan kerugian penurunan nilai',
    // General CALK keuangan
    'catatan atas laporan keuangan', 'notes to the financial statements',
  ],
  highPriorityKeywords: [
    // Tabel data kritis — halaman ini mendapat 4x skor agar pasti masuk seleksi
    'stage 1', 'stage 2', 'stage 3',       // tabel ECL 3-stage
    'margin jasa kontraktual', 'csm',       // roll-forward CSM
  ],
  minChars: 150,
  maxTotalChars: 160000,
}

export const LHPTL_PAGE_CONFIG: PageClassifierConfig = {
  includeKeywords: [
    'neraca', 'laporan posisi keuangan', 'laba rugi', 'ekuitas',
    'total aset', 'total liabilitas', 'pendapatan premi',
    'tingkat solvabilitas', 'rbc', 'risk based capital',
    'cadangan teknis', 'premi bruto', 'klaim',
    'kesimpulan', 'temuan', 'rekomendasi',
    'opini auditor', 'pendapat auditor', 'wajar tanpa pengecualian',
  ],
  minChars: 150,
  maxTotalChars: 100000,
}
