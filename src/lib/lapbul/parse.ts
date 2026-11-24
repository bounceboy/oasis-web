/**
 * Parser lapbul perusahaan penjaminan (format APOLO, lembar LBPPNJK-xxxx).
 * Deterministik: membaca berdasarkan kode komponen dan judul kolom, tanpa AI.
 * Setiap nilai menyimpan alamat sel asal agar bisa ditelusuri (jejak sumber).
 */
import type { WorkBook, WorkSheet } from 'xlsx'
import * as XLSX from 'xlsx'

export interface LCell { c: number; addr: string; h: string; v: number | string }
export interface LRow { k: string; u: string; r: number; cells: LCell[] }
export interface LSheet { id: string; title: string; rows: LRow[] }
export interface LapbulData {
  file: string
  entitas: string
  posisi: string        // teks seperti di laporan, mis. "30 Juni 2026"
  posisiISO: string     // 2026-06-30 ('' bila gagal dibaca)
  sheets: Record<string, LSheet>
}

/** Lembar yang dipakai analisis (lainnya tidak disimpan). */
export const SHEETS_USED = [
  '0000', '1000', '1100', '1200', '2100A1', '2100A2', '2100B1', '2100B2', '2100B3',
  '2100C1', '2100C2', '2100D1', '2100D2', '3400A', '3400B', '3500A', '3500B', '5100', '6100', '7100',
]

const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember']

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** Angka format Indonesia ("1.516.900.000.000", "19,38", "126,93%") atau angka biasa. */
export function parseNum(x: unknown): number | null {
  if (typeof x === 'number') return isFinite(x) ? x : null
  let s = norm(x)
  if (!s || /^0\d+$/.test(s)) return null // "002" = sandi, bukan angka
  s = s.replace(/^rp\.?\s*/i, '').replace(/%$/, '').trim()
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  let n: number | null = null
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  else if (/^-?\d+,\d+$/.test(s)) n = parseFloat(s.replace(',', '.'))
  else if (/^-?\d+(\.\d+)?$/.test(s)) n = parseFloat(s)
  if (n === null || !isFinite(n)) return null
  return neg ? -n : n
}

export function parseTanggal(s: string): string {
  const m = norm(s).toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/)
  if (!m) return ''
  const b = BULAN.indexOf(m[2])
  if (b < 0) return ''
  return `${m[3]}-${String(b + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function grid(ws: WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }) as unknown[][]
}

function readSheet(id: string, ws: WorkSheet): { sheet: LSheet; meta: Record<string, string> } {
  const g = grid(ws)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const off = { r: range.s.r, c: range.s.c }
  const meta: Record<string, string> = {}
  let title = ''
  let hdrRow = -1, codeCol = -1
  for (let r = 0; r < g.length; r++) {
    const row = g[r] || []
    for (let c = 0; c < row.length; c++) {
      const t = norm(row[c])
      if (!t) continue
      if (!title && new RegExp('^' + id + '\\s*-').test(t)) title = t.replace(/^\S+\s*-\s*/, '')
      if (/^nama lembaga jasa keuangan$/i.test(t) || /^posisi laporan$/i.test(t)) {
        const rest = row.slice(c + 1).map(norm).filter(v => v && v !== ':')
        if (rest[0]) meta[/^posisi/i.test(t) ? 'posisi' : 'nama'] = rest[0]
      }
      if (hdrRow < 0 && /^kode komponen$/i.test(t)) { hdrRow = r; codeCol = c }
    }
  }
  const rows: LRow[] = []
  if (hdrRow < 0) return { sheet: { id, title, rows }, meta }

  // Judul kolom = judul baris header, didahului judul grup di baris atasnya (bila ada).
  const hdr = g[hdrRow] || [], grp = g[hdrRow - 1] || []
  const width = Math.max(hdr.length, grp.length)
  const head: string[] = []
  let curGrp = ''
  const grpHasAny = grp.some((v, i) => i > codeCol && norm(v))
  for (let c = 0; c < width; c++) {
    if (grpHasAny && norm(grp[c])) curGrp = norm(grp[c])
    const own = norm(hdr[c])
    head[c] = own ? (grpHasAny && curGrp && c >= grp.findIndex((v, i) => i > codeCol && norm(v)) ? `${curGrp} › ${own}` : own) : ''
  }
  // Header dua baris (mis. 7100 / 5100 pakai satu baris; 3500A pakai grup + baris header)

  for (let r = hdrRow + 1; r < g.length; r++) {
    const row = g[r] || []
    const k = norm(row[codeCol])
    if (!/^\d{4}[A-Z]?\d*[0-9]$/.test(k)) continue
    let u = ''
    const cells: LCell[] = []
    for (let c = codeCol + 1; c < row.length; c++) {
      const raw = row[c]
      if (raw === null || raw === undefined || norm(raw) === '') continue
      if (!head[c]) continue // kolom bantu di luar format APOLO diabaikan
      const n = parseNum(raw)
      const v = n === null ? norm(raw) : n
      if (!u && typeof v === 'string' && !/^[A-Z]{2}:e/.test(v) && !/^\d+$/.test(v)) u = v
      cells.push({ c, addr: XLSX.utils.encode_cell({ r: r + off.r, c: c + off.c }), h: head[c], v })
    }
    rows.push({ k, u, r: r + off.r + 1, cells })
  }
  return { sheet: { id, title, rows }, meta }
}

/** Baca workbook lapbul. Lembar rincian surat berharga dipangkas ke baris reksa dana + total. */
export function parseLapbul(wb: WorkBook, fileName: string): LapbulData {
  const sheets: Record<string, LSheet> = {}
  let entitas = '', posisi = ''
  for (const name of wb.SheetNames) {
    const m = name.match(/^LBPPNJK-(\w+)$/)
    if (!m || !SHEETS_USED.includes(m[1])) continue
    const { sheet, meta } = readSheet(m[1], wb.Sheets[name])
    if (/^2100B[12]$/.test(m[1])) {
      sheet.rows = sheet.rows.filter(r => /0000$/.test(r.k) || r.cells.some(c => c.v === 'JI:e11'))
    }
    sheets[m[1]] = sheet
    if (!entitas && meta.nama) entitas = meta.nama
    if (!posisi && meta.posisi) posisi = meta.posisi
  }
  if (!Object.keys(sheets).length) throw new Error('Berkas ini bukan lapbul penjaminan format APOLO (lembar LBPPNJK-xxxx tidak ditemukan).')
  return { file: fileName, entitas, posisi, posisiISO: parseTanggal(posisi), sheets }
}
