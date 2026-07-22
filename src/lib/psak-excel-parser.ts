// Parser untuk Excel OJK PSAK 117 (format LUPSAJAK)
// Struktur: label di kolom C (index 2), nilai di kolom E (index 4) dst.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')

type FieldValues = { CY: number | null; PY: number | null; PPY: number | null }
type ParsedFields = Partial<Record<string, FieldValues>>

function makeField(cy: number | null, py: number | null = null): FieldValues {
  return { CY: cy, PY: py, PPY: null }
}

/** Baca sheet jadi array of rows: { label, vals[0..n] } */
function readSheet(ws: Record<string, unknown>): Array<{ label: string; cols: (number | null)[] }> {
  const range = ws['!ref'] as string | undefined
  if (!range) return []
  const decoded = XLSX.utils.decode_range(range)
  const maxRow = decoded.e.r
  const maxCol = Math.min(decoded.e.c, 15)

  const rows: Array<{ label: string; cols: (number | null)[] }> = []

  for (let r = 0; r <= maxRow; r++) {
    // Label ada di kolom C (index 2)
    const labelAddr = XLSX.utils.encode_cell({ r, c: 2 })
    const labelCell = ws[labelAddr] as { v?: unknown } | undefined
    const label = typeof labelCell?.v === 'string' ? labelCell.v.trim() : ''
    if (!label) continue

    // Baca nilai dari semua kolom (0..maxCol)
    const cols: (number | null)[] = []
    for (let c = 0; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr] as { v?: unknown } | undefined
      cols.push(typeof cell?.v === 'number' ? cell.v : null)
    }

    rows.push({ label, cols })
  }

  return rows
}

/** Cari baris pertama yang labelnya mengandung salah satu keyword (case-insensitive) */
function findRow(
  rows: Array<{ label: string; cols: (number | null)[] }>,
  keywords: string[],
): { label: string; cols: (number | null)[] } | null {
  const kl = keywords.map(k => k.toLowerCase())
  for (const row of rows) {
    const ll = row.label.toLowerCase()
    if (kl.some(k => ll.includes(k))) return row
  }
  return null
}

/** Ambil nilai di kolom tertentu dari baris yang cocok keyword */
function getVal(
  rows: Array<{ label: string; cols: (number | null)[] }>,
  keywords: string[],
  colIndex: number = 4, // default kolom E (0-based)
): number | null {
  const row = findRow(rows, keywords)
  if (!row) return null
  const v = row.cols[colIndex]
  return v !== null && !isNaN(v) ? v : null
}

/** Sama seperti getVal tapi kembalikan CY + PY (jika ada kolom PY) */
function getField(
  rows: Array<{ label: string; cols: (number | null)[] }>,
  keywords: string[],
  colCY: number = 4,
  colPY?: number,
): FieldValues {
  const row = findRow(rows, keywords)
  if (!row) return { CY: null, PY: null, PPY: null }
  const cy = row.cols[colCY]
  const py = colPY != null ? (row.cols[colPY] ?? null) : null
  return { CY: cy !== null && !isNaN(cy) ? cy : null, PY: py !== null && !isNaN(py!) ? py : null, PPY: null }
}

/**
 * Parse OJK PSAK 117 Excel template.
 * Mengembalikan partial record yang bisa di-merge ke template_data.values.
 */
export function parseOjkExcel(buffer: Buffer): ParsedFields {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const result: ParsedFields = {}

  const sheet = (name: string) => {
    if (wb.Sheets[name]) return readSheet(wb.Sheets[name])
    // fallback: cari sheet dengan nama yang mengandung name
    const found = wb.SheetNames.find((n: string) => n.toUpperCase().includes(name))
    return found ? readSheet(wb.Sheets[found]) : null
  }

  // ── LUPSPK — Laporan Posisi Keuangan ─────────────────────────────────────
  // Struktur: label col C (2), nilai col E (4), PY col F (5) jika ada
  const sfp = sheet('LUPSPK')
  if (sfp) {
    const kas = getField(sfp, ['kas dan setara kas'], 4)
    if (kas.CY != null) result['SFP_CASH'] = kas

    // LUPSPK hanya punya "Investasi" total — breakdown per klasifikasi ambil dari LUPSKV
    const reinsAsset = getField(sfp, ['aset kontrak reasuransi'], 4)
    if (reinsAsset.CY != null) result['SFP_REINS_ASSET'] = reinsAsset

    const insLiab = getField(sfp, ['liabilitas kontrak asuransi'], 4)
    if (insLiab.CY != null) result['SFP_INS_LIAB'] = insLiab

    const reinsLiab = getField(sfp, ['liabilitas kontrak reasuransi'], 4)
    if (reinsLiab.CY != null) result['SFP_REINS_LIAB'] = reinsLiab

    // Ekuitas: modal disetor + laba ditahan + OCI
    const modal = getVal(sfp, ['modal disetor', 'modal saham'], 4)
    if (modal != null) result['SFP_SHARECAP'] = makeField(modal)

    const laba = getVal(sfp, ['akumulasi laba ditahan', 'saldo laba', 'laba ditahan', 'retained earning'], 4)
    if (laba != null) result['SFP_RETAINED'] = makeField(laba)

    const oci = getVal(sfp, ['akumulasi other comprehensive income', 'cadangan oci', 'akumulasi oci', 'other comprehensive income'], 4)
    if (oci != null) result['SFP_FVOCI_RES'] = makeField(oci)
  }

  // ── LUPSKV — Ringkasan Investasi (breakdown FVTPL/FVOCI/AC + ECL) ─────────
  // Struktur multi-kolom:
  //   col E (4) = Amortized Cost (AC)
  //   col F (5) = FVTPL
  //   col G (6) = FVOCI
  //   col H (7) = ECL Tahap I
  //   col I (8) = ECL Tahap II
  //   col J (9) = ECL Tahap III
  const skv = sheet('LUPSKV')
  if (skv) {
    const totalRow = findRow(skv, ['total', 'jumlah'])
    if (totalRow) {
      const ac = totalRow.cols[4]
      const fvtpl = totalRow.cols[5]
      const fvoci = totalRow.cols[6]
      const eclS1 = totalRow.cols[7] // negatif = cadangan ECL

      if (ac != null && !isNaN(ac)) {
        result['I9_AC'] = makeField(ac)
        result['SFP_AC'] = makeField(ac)
      }
      if (fvtpl != null && !isNaN(fvtpl)) {
        result['I9_FVTPL'] = makeField(fvtpl)
        result['SFP_FVTPL'] = makeField(fvtpl)
      }
      if (fvoci != null && !isNaN(fvoci)) {
        // Asuransi Umum: FVOCI biasanya campuran debt + equity, simpan sebagai FVOCI_DEBT
        result['I9_FVOCI_DEBT'] = makeField(fvoci)
        result['SFP_FVOCI_DEBT'] = makeField(fvoci)
      }
      if (eclS1 != null && !isNaN(eclS1)) {
        // Nilai bisa negatif (cadangan), simpan absolute value
        result['I9_S1_ALLOW'] = makeField(Math.abs(eclS1))
      }
    }
  }

  // ── LUPLRG — Laporan Laba Rugi ───────────────────────────────────────────
  // label col C (2), nilai col E (4)
  const lrg = sheet('LUPLRG')
  if (lrg) {
    const insRev = getField(lrg, ['pendapatan jasa asuransi'], 4)
    if (insRev.CY != null) result['PL_INS_REV'] = insRev

    const insExp = getField(lrg, ['beban jasa asuransi'], 4)
    if (insExp.CY != null) result['PL_INS_EXP'] = insExp

    const reinsNet = getField(lrg, ['pendapatan (beban) dari kontrak reasuransi', 'hasil neto kontrak reasuransi', 'neto reasuransi'], 4)
    if (reinsNet.CY != null) result['PL_REINS_NET'] = reinsNet

    // ISR langsung dari P&L
    const isr = getField(lrg, ['hasil jasa asuransi bersih', 'hasil jasa asuransi', 'insurance service result'], 4)
    if (isr.CY != null) result['I17_ISR'] = isr

    const invIncome = getField(lrg, ['pendapatan investasi'], 4)
    if (invIncome.CY != null) result['PL_INV_RES'] = invIncome

    const ifFin = getField(lrg, ['pendapatan (beban) keuangan dari kontrak asuransi', 'biaya keuangan asuransi', 'insurance finance income'], 4)
    if (ifFin.CY != null) result['PL_IF_FIN'] = ifFin

    const reinsFin = getField(lrg, ['pendapatan (beban) keuangan dari kontrak reasuransi'], 4)
    if (reinsFin.CY != null) result['PL_REINS_FIN'] = reinsFin

    const opex = getField(lrg, ['beban umum & administrasi', 'beban operasional', 'beban umum dan administrasi'], 4)
    if (opex.CY != null) result['PL_OPEX'] = opex

    const otherInc = getField(lrg, ['pendapatan (beban) lainnya', 'pendapatan lain-lain', 'beban lain'], 4)
    if (otherInc.CY != null) result['PL_OTHER_NONOP'] = otherInc

    const tax = getField(lrg, ['beban pajak', 'pajak penghasilan', 'income tax'], 4)
    if (tax.CY != null) result['PL_TAX'] = tax
  }

  // ── LUPAKS — Laporan Arus Kas ─────────────────────────────────────────────
  const aks = sheet('LUPAKS')
  if (aks) {
    const cfOp = getField(aks, ['jumlah arus kas bersih dari aktivitas operasi', 'total arus kas operasi', 'net cash from operating'], 4)
    if (cfOp.CY != null) result['CF_OP'] = cfOp

    const cfInv = getField(aks, ['jumlah arus kas bersih dari aktivitas investasi', 'net cash from investing'], 4)
    if (cfInv.CY != null) result['CF_INV'] = cfInv

    const cfFin = getField(aks, ['jumlah arus kas bersih dari aktivitas pendanaan', 'net cash from financing'], 4)
    if (cfFin.CY != null) result['CF_FIN'] = cfFin

    const cfEnd = getField(aks, ['kas dan setara kas akhir', 'saldo kas akhir', 'cash at end'], 4)
    if (cfEnd.CY != null) result['CF_END'] = cfEnd

    const cfBeg = getField(aks, ['kas dan setara kas awal', 'saldo kas awal', 'cash at beginning'], 4)
    if (cfBeg.CY != null) result['CF_BEG'] = cfBeg
  }

  // ── LUPCRF — CSM Roll Forward ─────────────────────────────────────────────
  const crf = sheet('LUPCRF')
  if (crf) {
    const csmOpen = getField(crf, ['csm awal periode', 'saldo awal csm', 'opening csm', 'csm awal'], 4)
    if (csmOpen.CY != null) result['I17_CSM_OPEN'] = csmOpen

    const csmRelease = getField(crf, ['amortisasi csm', 'csm release', 'dirilis ke laporan'], 4)
    if (csmRelease.CY != null) result['I17_CSM_RELEASE'] = csmRelease

    const csmClose = getField(crf, ['csm akhir periode', 'saldo akhir csm', 'closing csm', 'csm akhir'], 4)
    if (csmClose.CY != null) result['I17_CSM_CLOSE'] = csmClose
  }

  // ── LUPSAGP — Rekonsiliasi GMM: LRC, Loss Component, RA ─────────────────
  // Struktur multi-kolom:
  //   col E (4) = LRC diluar Loss Component
  //   col F (5) = Loss Component (termasuk)
  //   col G (6) = LIC Estimasi Arus Kas
  //   col H (7) = Penyesuaian Risiko (RA)
  //   col J (9) = Total
  const agp = sheet('LUPSAGP')
  if (agp) {
    // Saldo Akhir row = "Liabilitas Kontrak Asuransi (Saldo Akhir)" atau "Saldo Bersih Kontrak Asuransi (Saldo Akhir)"
    const closing = findRow(agp, ['saldo bersih kontrak asuransi (saldo akhir)', 'liabilitas kontrak asuransi (saldo akhir)'])
    if (closing) {
      const lrc = closing.cols[4]    // LRC diluar loss component
      const lc = closing.cols[5]     // Loss component
      const ra = closing.cols[7]     // RA saldo akhir

      if (lrc != null && !isNaN(lrc)) result['I17_LRC'] = makeField(lrc)
      if (lc != null && !isNaN(lc)) result['I17_LOSS_COMP'] = makeField(lc)
      if (ra != null && !isNaN(ra)) result['I17_RA'] = makeField(ra)
    }

    // RA Saldo Awal = dari row opening (Saldo Bersih atau Liabilitas Awal), col H
    const opening = findRow(agp, ['saldo bersih kontrak asuransi', 'liabilitas kontrak asuransi (saldo awal)'])
    if (opening) {
      const raOpen = opening.cols[7] // RA saldo awal
      if (raOpen != null && !isNaN(raOpen)) result['I17_RA_OPEN'] = makeField(raOpen)
    }

    // LIC total: ambil dari baris saldo akhir col G (LIC = Estimasi Arus Kas Mendatang)
    // Tapi LIC yang lebih akurat dari LUPAKD
  }

  // ── LUPAKD — Rincian LIC (total dari maturity buckets) ───────────────────
  const akd = sheet('LUPAKD')
  if (akd) {
    const lic = getField(akd, ['total', 'jumlah'], 4)
    if (lic.CY != null) result['I17_LIC'] = lic
  }

  // ── LUPSCO — Klaim dan Manfaat ────────────────────────────────────────────
  const sco = sheet('LUPSCO')
  if (sco) {
    const claims = getField(sco, ['klaim dan manfaat', 'klaim bruto', 'total klaim', 'gross claims'], 4)
    if (claims.CY != null) result['I17_GROSS_CLAIMS'] = claims
  }

  // ── LUPSAGP — Akuisisi & UW Expense untuk Expense Ratio ──────────────────
  if (agp) {
    const acqCF = getField(agp, ['amortisasi arus kas akuisisi', 'arus kas akuisisi', 'beban akuisisi'], 4)
    if (acqCF.CY != null) result['I17_ACQ_CF'] = acqCF

    const onerous = getField(agp, ['kerugian dari kontrak merugi', 'onerous'], 4)
    if (onerous.CY != null) result['I17_ONEROUS'] = onerous
  }

  // ── LUPPKL — OCI movements ───────────────────────────────────────────────
  const pkl = sheet('LUPPKL')
  if (pkl) {
    const ociTotal = getField(pkl, ['total', 'jumlah', 'fvoci', 'perubahan nilai wajar'], 4)
    if (ociTotal.CY != null) result['OCI_FVOCI'] = ociTotal
  }

  return result
}

/**
 * Merge hasil parse Excel ke template_data yang sudah ada.
 * Nilai dari Excel menimpa nilai PDF (Excel lebih akurat untuk data struktural).
 */
export function mergeExcelIntoTemplateData(
  templateData: { values: Record<string, FieldValues>; metadata: Record<string, unknown> },
  excelFields: ParsedFields,
): typeof templateData {
  const merged = { ...templateData, values: { ...templateData.values } }
  for (const [key, fieldVal] of Object.entries(excelFields)) {
    if (fieldVal && (fieldVal.CY !== null || fieldVal.PY !== null)) {
      merged.values[key] = {
        CY: fieldVal.CY ?? merged.values[key]?.CY ?? null,
        PY: fieldVal.PY ?? merged.values[key]?.PY ?? null,
        PPY: merged.values[key]?.PPY ?? null,
      }
    }
  }
  return merged
}
