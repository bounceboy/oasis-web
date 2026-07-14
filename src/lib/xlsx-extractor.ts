/**
 * xlsx-extractor.ts
 * Baca Excel Form Laporan Keuangan Pialang Asuransi, kembalikan teks per sheet.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')

export interface SheetText {
  name: string
  text: string        // tabel sebagai TSV-like text
  rows: string[][]    // raw rows
}

// Sheet yang relevan untuk rules engine LHPTL
const RELEVANT_SHEETS = [
  'Data Umum',
  'PP01', 'PP02', 'PP03', 'PP04', 'PP05', 'PP06', 'PP07',
  'LK01', 'LK02', 'LK03', 'LK04',
  'PK01', 'PK02', 'PK03', 'PK04', 'PK05', 'PK06',
  'PK07', 'PK08', 'PK09', 'PK10', 'PK11', 'PK12', 'PK13', 'PK14',
  'LR01', 'LR02', 'LR03', 'LR04', 'LR05', 'LR06', 'LR07', 'LR08',
  'OP1', 'OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06',
  'FKRT', 'HKKS', 'HKKM', 'HKGD', 'HKDR', 'RJBT', 'TPKP',
]

export function extractExcelSheets(buffer: Buffer): SheetText[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: true })
  const results: SheetText[] = []

  for (const sheetName of wb.SheetNames) {
    // Lewati sheet teknis / non-data
    if (
      !RELEVANT_SHEETS.includes(sheetName) &&
      !sheetName.startsWith('PP') &&
      !sheetName.startsWith('PK') &&
      !sheetName.startsWith('LK') &&
      !sheetName.startsWith('LR') &&
      !sheetName.startsWith('OP') &&
      !['FKRT','HKKS','HKKM','HKGD','HKDR','RJBT','TPKP','Data Umum'].includes(sheetName)
    ) continue

    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    // Konversi ke array of arrays
    const aoa: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: false,
    })

    // Filter baris kosong total
    const rows = aoa
      .map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c).trim())))
      .filter((r) => r.some((c) => c !== ''))

    if (rows.length === 0) continue

    // Batasi 200 baris per sheet agar tidak overflow prompt
    const limited = rows.slice(0, 200)

    // Buat teks tabel (pipe-separated)
    const text = limited.map((r) => r.filter((c) => c !== '').join(' | ')).join('\n')

    results.push({ name: sheetName, text, rows: limited })
  }

  return results
}

export function sheetsToPromptText(sheets: SheetText[]): string {
  return sheets
    .map((s) => `=== SHEET: ${s.name} ===\n${s.text}`)
    .join('\n\n')
}
