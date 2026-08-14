/**
 * LHPTL DOCX generator — Node.js port of scripts/lhptl/generate.py
 * Uses pizzip + @xmldom/xmldom for pure Node.js XML manipulation.
 * Works on Vercel (no Python subprocess needed).
 */

import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'
// Use 'any' for xmldom types to avoid conflict with browser DOM types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom') as {
  DOMParser: new () => { parseFromString(xml: string, mime: string): XmlDoc }
  XMLSerializer: new () => { serializeToString(doc: XmlDoc): string }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlDoc = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlEl = any

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const NA = '[HARAP DIISI PENGAWAS]'

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtRupiah(n: number | null | undefined): string {
  if (n == null) return '-'
  try {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  } catch {
    return String(n)
  }
}

function fmtPct(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '-'
  try {
    return `${Number(n).toFixed(decimals)}%`
  } catch {
    return String(n)
  }
}

function terbilangTotal(nPer: number | null | undefined, nBh: number | null | undefined): string {
  const total = (nPer ?? 0) + (nBh ?? 0)
  if (total === 0) return NA
  return `${total}, terdiri dari ${nPer ?? 0} perorangan dan ${nBh ?? 0} badan hukum`
}

function formatTanggal(d: Date): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Get all <w:p> elements that are direct children of <w:body> */
function getBodyParagraphs(doc: XmlDoc): XmlEl[] {
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  if (!body) return []
  const result: XmlEl[] = []
  for (let i = 0; i < body.childNodes.length; i++) {
    const n = body.childNodes[i] as Element
    if (n.localName === 'p' && n.namespaceURI === W) result.push(n)
  }
  return result
}

/** Get all <w:tbl> elements in document */
function getTables(doc: XmlDoc): XmlEl[] {
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  if (!body) return []
  const result: XmlEl[] = []
  const els = doc.getElementsByTagNameNS(W, 'tbl')
  for (let i = 0; i < els.length; i++) result.push(els[i] as Element)
  return result
}

/** Get text content of a paragraph (including tabs from <w:tab>) */
function getParaText(para: XmlEl): string {
  const parts: string[] = []
  const runs = para.getElementsByTagNameNS(W, 'r')
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i] as Element
    for (let j = 0; j < r.childNodes.length; j++) {
      const child = r.childNodes[j] as Element
      if (child.localName === 't') parts.push(child.textContent || '')
      else if (child.localName === 'tab') parts.push('\t')
    }
  }
  return parts.join('')
}

/** Clone an element deeply */
function cloneEl(el: XmlEl): XmlEl {
  return el.cloneNode(true) as Element
}

/**
 * Replace the entire text content of a paragraph.
 * Keeps formatting of first run; removes extra runs.
 */
function replaceFullPara(para: XmlEl, newText: string, doc: XmlDoc): void {
  const runs = Array.from(para.getElementsByTagNameNS(W, 'r')) as Element[]

  if (runs.length === 0) {
    const r = doc.createElementNS(W, 'w:r')
    const t = doc.createElementNS(W, 'w:t')
    t.textContent = newText
    r.appendChild(t)
    para.appendChild(r)
    return
  }

  const r0 = runs[0]
  // Remove all w:t and w:tab children from first run
  const toRemove: XmlEl[] = []
  for (let i = 0; i < r0.childNodes.length; i++) {
    const child = r0.childNodes[i] as Element
    if (child.localName === 't' || child.localName === 'tab') toRemove.push(child)
  }
  toRemove.forEach(c => r0.removeChild(c))

  const t = doc.createElementNS(W, 'w:t')
  t.textContent = newText
  if (newText && (newText[0] === ' ' || newText[newText.length - 1] === ' ')) {
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
  }
  r0.appendChild(t)

  // Remove remaining runs
  for (let i = 1; i < runs.length; i++) {
    if (runs[i].parentNode) runs[i].parentNode!.removeChild(runs[i])
  }
}

/**
 * For KV paragraphs: replace the last <w:t> text, keeping ': ' prefix.
 */
function setLastWtValue(para: XmlEl, newValue: string): void {
  const runs = para.getElementsByTagNameNS(W, 'r')
  let lastT: XmlEl | null = null
  for (let i = 0; i < runs.length; i++) {
    const ts = runs[i].getElementsByTagNameNS(W, 't')
    for (let j = 0; j < ts.length; j++) lastT = ts[j] as Element
  }
  if (!lastT) return

  const existing = lastT.textContent || ''
  const colonIdx = existing.indexOf(': ')
  let prefix: string
  if (colonIdx !== -1) {
    prefix = existing.slice(0, colonIdx + 2)
  } else {
    const ci = existing.indexOf(':')
    prefix = ci !== -1 ? existing.slice(0, ci + 1) + ' ' : ''
  }
  lastT.textContent = prefix + newValue
  if (newValue && (newValue[0] === ' ' || newValue[newValue.length - 1] === ' ')) {
    lastT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
  }
}

// ── Table helpers ─────────────────────────────────────────────────────────────

/** Get all <w:tr> rows of a table */
function getTableRows(tbl: XmlEl): XmlEl[] {
  const result: XmlEl[] = []
  for (let i = 0; i < tbl.childNodes.length; i++) {
    const n = tbl.childNodes[i] as Element
    if (n.localName === 'tr') result.push(n)
  }
  return result
}

/** Remove rows beyond `keep` from table */
function clearDataRows(tbl: XmlEl, keep = 1): void {
  const rows = getTableRows(tbl)
  for (let i = keep; i < rows.length; i++) {
    tbl.removeChild(rows[i])
  }
}

/** Get rPr (run properties) from first run of a cell */
function getCellRPr(tc: XmlEl): XmlEl | null {
  const rs = tc.getElementsByTagNameNS(W, 'r')
  if (rs.length === 0) return null
  const rPrs = rs[0].getElementsByTagNameNS(W, 'rPr')
  return rPrs.length > 0 ? (rPrs[0] as Element) : null
}

/** Returns true if text looks like a number (should be right-aligned) */
function isNumericValue(text: string): boolean {
  const t = text.trim()
  // Matches: digits with dot-separators, optional leading minus, percentages, bare '-'
  return t === '-' || /^-?[\d.,%]+$/.test(t)
}

/** Create a paragraph element for a table cell (data rows: auto-align, no bold) */
function makeCellPara(doc: XmlDoc, text: string, rPrSrc: XmlEl | null = null, align?: 'left' | 'right' | 'center'): XmlEl {
  const p = doc.createElementNS(W, 'w:p')
  const pPr = doc.createElementNS(W, 'w:pPr')
  const pStyle = doc.createElementNS(W, 'w:pStyle')
  pStyle.setAttributeNS(W, 'w:val', 'TableParagraph')
  pPr.appendChild(pStyle)
  // Auto-detect alignment: numeric values → right, text → left
  const resolvedAlign = align ?? (isNumericValue(text) ? 'right' : 'left')
  const jc = doc.createElementNS(W, 'w:jc')
  jc.setAttributeNS(W, 'w:val', resolvedAlign)
  pPr.appendChild(jc)
  p.appendChild(pPr)

  const r = doc.createElementNS(W, 'w:r')
  if (rPrSrc) {
    const rPrClone = cloneEl(rPrSrc)
    // Remove bold and color (keep only font name/size)
    for (const tag of ['b', 'bCs', 'color', 'highlight']) {
      const els = rPrClone.getElementsByTagNameNS(W, tag)
      for (let i = els.length - 1; i >= 0; i--) {
        if (els[i].parentNode === rPrClone) rPrClone.removeChild(els[i])
      }
    }
    r.appendChild(rPrClone)
  }
  const t = doc.createElementNS(W, 'w:t')
  t.textContent = text || ''
  if (text && (text[0] === ' ' || text[text.length - 1] === ' ')) {
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
  }
  r.appendChild(t)
  p.appendChild(r)
  return p
}

/** Strip red background shading from a cloned data row */
function stripRowShading(tr: XmlEl): void {
  // Remove shading from trPr (row-level)
  const trPrs = tr.getElementsByTagNameNS(W, 'trPr')
  for (let i = 0; i < trPrs.length; i++) {
    const shds = trPrs[i].getElementsByTagNameNS(W, 'shd')
    for (let j = shds.length - 1; j >= 0; j--) {
      if (shds[j].parentNode === trPrs[i]) trPrs[i].removeChild(shds[j])
    }
  }
  // Remove shading from each tcPr (cell-level)
  const tcPrs = tr.getElementsByTagNameNS(W, 'tcPr')
  for (let i = 0; i < tcPrs.length; i++) {
    const shds = tcPrs[i].getElementsByTagNameNS(W, 'shd')
    for (let j = shds.length - 1; j >= 0; j--) {
      if (shds[j].parentNode === tcPrs[i]) {
        // Replace with white/auto shading
        const shd = shds[j]
        shd.setAttributeNS(W, 'w:val', 'clear')
        shd.setAttributeNS(W, 'w:color', 'auto')
        shd.setAttributeNS(W, 'w:fill', 'auto')
      }
    }
  }
}

/** Add a data row to a table by cloning header row format */
function addDataRow(doc: XmlDoc, tbl: XmlEl, values: string[], headerRowIdx = 0, alignments?: ('left' | 'right' | 'center' | undefined)[]): void {
  const rows = getTableRows(tbl)
  if (rows.length === 0) return
  const srcRow = rows[Math.min(headerRowIdx, rows.length - 1)]

  // Get rPr from each cell of the header row
  const srcCells: XmlEl[] = []
  for (let i = 0; i < srcRow.childNodes.length; i++) {
    const n = srcRow.childNodes[i] as Element
    if (n.localName === 'tc') srcCells.push(n)
  }
  const rPrList = srcCells.map(tc => getCellRPr(tc))

  // Clone the header row and strip red background
  const newTr = cloneEl(srcRow)
  stripRowShading(newTr)

  // Get all tc in new row
  const newCells: XmlEl[] = []
  for (let i = 0; i < newTr.childNodes.length; i++) {
    const n = newTr.childNodes[i] as Element
    if (n.localName === 'tc') newCells.push(n)
  }

  // Fill each cell
  for (let i = 0; i < newCells.length; i++) {
    const tc = newCells[i]
    // Remove all paragraphs
    const ps = Array.from(tc.getElementsByTagNameNS(W, 'p')) as Element[]
    ps.forEach(p => { if (p.parentNode === tc) tc.removeChild(p) })

    const val = i < values.length ? values[i] : ''
    const colAlign = alignments?.[i]
    tc.appendChild(makeCellPara(doc, val, rPrList[i] ?? null, colAlign))
  }

  tbl.appendChild(newTr)
}

/** Update text of a header cell */
function updateHeaderCell(doc: XmlDoc, tbl: XmlEl, rowIdx: number, colIdx: number, text: string): void {
  const rows = getTableRows(tbl)
  if (rowIdx >= rows.length) return
  const cells: XmlEl[] = []
  for (let i = 0; i < rows[rowIdx].childNodes.length; i++) {
    const n = rows[rowIdx].childNodes[i] as Element
    if (n.localName === 'tc') cells.push(n)
  }
  if (colIdx >= cells.length) return
  const ps = cells[colIdx].getElementsByTagNameNS(W, 'p')
  if (ps.length > 0) replaceFullPara(ps[0] as Element, text, doc)
}

// ── Main generator ────────────────────────────────────────────────────────────

export interface LhptlPayload {
  nama_perusahaan?: string
  jenis_entitas?: string
  periode?: string
  hasil_pengawasan?: { nomor?: number; catatan?: string; tipe?: string }[]
  kesimpulan?: string
  tindak_lanjut?: string
  raw?: Record<string, unknown>
}

export function generateLhptlDocxNode(data: LhptlPayload): Buffer {
  const templatePath = path.join(process.cwd(), 'templates', 'lhptl-template.docx')
  const content = fs.readFileSync(templatePath)
  const zip = new PizZip(content)

  const xmlStr = zip.file('word/document.xml')!.asText()
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlStr, 'text/xml')

  const raw = (data.raw ?? {}) as Record<string, unknown>
  const nama = data.nama_perusahaan || (raw.nama_perusahaan as string) || NA
  const periode = data.periode || (raw.periode as string) || NA
  const kesimpulan = data.kesimpulan || ''
  const tindakLanjut = data.tindak_lanjut || ''
  const nomor = (raw.nomor_lhptl as string) || NA

  // Extract 4-digit year from periode (handles "2025", "31 Desember 2025", etc.)
  const tahunMatch = periode.match(/\d{4}/)
  const tahunIni = tahunMatch ? tahunMatch[0] : periode.trim()
  const tahunLalu = /^\d{4}$/.test(tahunIni) ? String(Number(tahunIni) - 1) : NA

  const rekananStr = terbilangTotal(
    raw.jumlah_rekanan_perorangan as number,
    raw.jumlah_rekanan_badan_hukum as number,
  )
  const pegawaiVal = raw.jumlah_pegawai
  const pegawaiStr = pegawaiVal ? `${pegawaiVal}, termasuk pengurus dan pegawai` : NA

  const afiliasiList = (raw.pihak_afiliasi as string[]) || []
  const afiliasiStr = afiliasiList.length > 0 ? afiliasiList.join(', ') : 'Tidak ada'

  const tglStr = formatTanggal(new Date())

  const periodeKalimat = /^\d{4}$/.test(tahunIni)
    ? `Periode 1 Januari ${tahunIni} s.d 31 Desember ${tahunIni}.`
    : `Periode pengawasan: ${tahunIni}.`

  // ── Paragraphs ──────────────────────────────────────────────────────────────
  const paras = getBodyParagraphs(doc)

  // Para 1: company name
  if (paras[1]) replaceFullPara(paras[1], nama, doc)
  // Para 2: nomor
  if (paras[2]) replaceFullPara(paras[2], `NOMOR ${nomor}`, doc)

  const kvMap: Record<string, string> = {
    'nama perusahaan':             nama,
    'alamat':                      (raw.alamat as string) || NA,
    'izin usaha':                  (raw.izin_usaha as string) || NA,
    'kantor di luar kp':           (raw.kantor_cabang as string) || 'Tidak ada',
    'perusahaan afiliasi':         afiliasiStr,
    'jumlah pegawai':              pegawaiStr,
    'jumlah rekanan pb':           rekananStr,
    'kantor akuntan publik':       (raw.kap_nama as string) || NA,
    'akuntan publik':              (raw.akuntan_publik_nama as string) || NA,
    'nomor izin akuntan':          (raw.nomor_izin_akuntan as string) || NA,
    'nomor registrasi akuntan':    (raw.nomor_registrasi_akuntan as string) || NA,
    'periode laporan':             tahunIni,
    'opini':                       (raw.opini_audit as string) || NA,
  }

  for (const para of paras) {
    const txt = getParaText(para).trim().toLowerCase()

    for (const [label, value] of Object.entries(kvMap)) {
      if (txt.startsWith(label)) {
        setLastWtValue(para, value)
        break
      }
    }

    if (txt.startsWith('tenaga kerja asing')) {
      const tka = (raw.tka as string) || 'Tidak ada'
      replaceFullPara(para, `Tenaga Kerja Asing: ${tka}`, doc)
    }
    if (txt.startsWith('penyampaian laporan keuangan') && (txt.includes('tahun') || txt.includes('periode'))) {
      replaceFullPara(para, `Penyampaian Laporan Keuangan yang telah diaudit oleh Akuntan Publik Tahun ${tahunIni}`, doc)
    }
    if (txt.startsWith('laporan posisi keuangan') && txt.includes('tahun')) {
      replaceFullPara(para,
        `Laporan Posisi Keuangan dan Laporan Laba Rugi Komprehensif Tahun ${tahunIni} dan ${tahunLalu} sebagai berikut:`, doc)
    }
    if (txt.startsWith('rasio keuangan perusahaan') && txt.includes('tahun')) {
      replaceFullPara(para,
        `Rasio keuangan Perusahaan untuk periode Tahun ${tahunIni} dan ${tahunLalu} adalah sebagai berikut:`, doc)
    }
    if (txt.includes('periode 1 januari') || (txt.includes('periode pengawasan') && txt.includes('s.d'))) {
      replaceFullPara(para, periodeKalimat, doc)
    }
    if (txt === '...' || txt === '{{kesimpulan}}') {
      replaceFullPara(para, kesimpulan || NA, doc)
    }
    const fullTxt = getParaText(para)
    if (txt.startsWith('jakarta,') && (fullTxt.includes('{{') || /202[0-9]/.test(fullTxt))) {
      replaceFullPara(para, `Jakarta, ${tglStr}`, doc)
    }
  }

  // ── Tables ──────────────────────────────────────────────────────────────────
  const tables = getTables(doc)

  // Table 0: Pemegang Saham
  if (tables[0]) {
    clearDataRows(tables[0], 1)
    const ps = (raw.pemegang_saham as { nama?: string; nilai_rp?: number; persentase?: number }[]) || []
    if (ps.length > 0) {
      for (const p of ps) {
        addDataRow(doc, tables[0], [
          p.nama || '-',
          fmtRupiah(p.nilai_rp),
          p.persentase != null ? p.persentase.toFixed(2) : '-',
        ])
      }
    } else {
      addDataRow(doc, tables[0], [NA, '-', '-'])
    }
  }

  // Table 1: Direksi & Komisaris
  if (tables[1]) {
    clearDataRows(tables[1], 1)
    const dk = (raw.direksi_komisaris as { jabatan?: string; nama?: string; surat_persetujuan_ojk?: string }[]) || []
    if (dk.length > 0) {
      for (const d of dk) {
        addDataRow(doc, tables[1], [d.jabatan || '-', d.nama || '-', d.surat_persetujuan_ojk || '-'])
      }
    } else {
      addDataRow(doc, tables[1], [NA, NA, NA])
    }
  }

  // Table 2: Tenaga Ahli & Pialang
  if (tables[2]) {
    clearDataRows(tables[2], 1)
    const ta = (raw.tenaga_ahli_pialang as { jabatan?: string; nama?: string; nomor_registrasi?: string; surat_pengadministrasian_ojk?: string }[]) || []
    if (ta.length > 0) {
      for (const t of ta) {
        const ojkInfo = t.surat_pengadministrasian_ojk || ''
        const regNo = t.nomor_registrasi || ''
        const combined = ojkInfo ? `${regNo} (${ojkInfo})` : regNo || '-'
        addDataRow(doc, tables[2], [t.jabatan || '-', t.nama || '-', combined])
      }
    } else {
      addDataRow(doc, tables[2], [NA, NA, NA])
    }
  }

  // Table 3: Polis Indemnitas
  if (tables[3]) {
    clearDataRows(tables[3], 1)
    const pol = (raw.polis_indemnitas as { nomor_polis?: string; penanggung?: string; nilai_pertanggungan?: number; masa_berlaku?: string }[]) || []
    if (pol.length > 0) {
      for (const p of pol) {
        addDataRow(doc, tables[3], [p.nomor_polis || '-', p.penanggung || '-', fmtRupiah(p.nilai_pertanggungan), p.masa_berlaku || '-'])
      }
    } else {
      addDataRow(doc, tables[3], ['-', '-', '-', '-'])
    }
  }

  // Table 4: Sanksi
  if (tables[4]) {
    clearDataRows(tables[4], 1)
    const sanksi = (raw.sanksi as { nomor_tanggal?: string; jenis?: string; penyebab?: string }[]) || []
    if (sanksi.length > 0) {
      for (const s of sanksi) {
        addDataRow(doc, tables[4], ['-', s.nomor_tanggal || '-', s.jenis || '-', s.penyebab || '-'])
      }
    } else {
      addDataRow(doc, tables[4], ['-', '-', '-', '-'])
    }
  }

  // Table 5: Neraca + Laba Rugi
  if (tables[5]) {
    updateHeaderCell(doc, tables[5], 0, 1, `Tahun ${tahunLalu}`)
    updateHeaderCell(doc, tables[5], 0, 2, `Tahun ${tahunIni}`)
    clearDataRows(tables[5], 2)
    const rows = (raw.neraca_laba_rugi as { label?: string; nilai_ini?: number; nilai_lalu?: number }[]) || []
    if (rows.length > 0) {
      for (const r of rows) {
        addDataRow(doc, tables[5], [r.label || '-', fmtRupiah(r.nilai_lalu), fmtRupiah(r.nilai_ini)], 0)
      }
    } else {
      addDataRow(doc, tables[5], ['Data tidak tersedia', '-', '-'], 0)
    }
  }

  // Table 6: Rasio Keuangan
  if (tables[6]) {
    updateHeaderCell(doc, tables[6], 0, 1, `Tahun ${tahunLalu}`)
    updateHeaderCell(doc, tables[6], 0, 2, `Tahun ${tahunIni}`)
    clearDataRows(tables[6], 1)
    const rasio = (raw.rasio_keuangan_tabel as { label?: string; nilai_ini?: number; nilai_lalu?: number }[]) || []
    if (rasio.length > 0) {
      for (const r of rasio) {
        addDataRow(doc, tables[6], [r.label || '-', fmtPct(r.nilai_lalu), fmtPct(r.nilai_ini)])
      }
    } else {
      addDataRow(doc, tables[6], ['Data tidak tersedia', '-', '-'])
    }
  }

  // Table 7: Tim Pengawas — leave as-is

  // Table 8: Hasil Pengawasan
  if (tables[8]) {
    clearDataRows(tables[8], 1)
    const hasil = data.hasil_pengawasan || []
    const tipeLabel: Record<string, string> = { pelanggaran: 'Pelanggaran', perlu_perhatian: 'Perlu Perhatian' }
    if (hasil.length > 0) {
      for (const h of hasil) {
        addDataRow(doc, tables[8], [String(h.nomor ?? ''), h.catatan || '-', tipeLabel[h.tipe || ''] || ''], 0, ['center', 'left', 'left'])
      }
    } else {
      addDataRow(doc, tables[8], ['-', '-', ''], 0, ['center', 'left', 'left'])
    }
  }

  // Table 9: Tindak Lanjut
  if (tables[9]) {
    clearDataRows(tables[9], 1)
    const poinTl = tindakLanjut
      .split(/^\d+\.\s*/m)
      .map(s => s.trim())
      .filter(Boolean)
    const finalPoin = poinTl.length > 0 ? poinTl : tindakLanjut.split('\n').map(s => s.trim()).filter(Boolean)
    if (finalPoin.length > 0) {
      finalPoin.forEach((poin, i) => addDataRow(doc, tables[9], [`${i + 1}.`, poin, ''], 0, ['center', 'left', 'left']))
    } else {
      addDataRow(doc, tables[9], ['1.', '', ''], 0, ['center', 'left', 'left'])
    }
  }

  // ── Serialize back ──────────────────────────────────────────────────────────
  const serializer = new XMLSerializer()
  const newXml = serializer.serializeToString(doc)
  zip.file('word/document.xml', newXml)

  return Buffer.from(zip.generate({ type: 'nodebuffer' }))
}
