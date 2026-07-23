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


/** Field SFP yang sama untuk Umum dan Jiwa */
function parseSFP(sfp: Array<{ label: string; cols: (number | null)[] }>, result: ParsedFields) {
  const kas = getField(sfp, ['kas dan setara kas'], 4)
  if (kas.CY != null) result['SFP_CASH'] = kas

  const reinsAsset = getField(sfp, ['aset kontrak reasuransi'], 4)
  if (reinsAsset.CY != null) result['SFP_REINS_ASSET'] = reinsAsset

  const insLiab = getField(sfp, ['liabilitas kontrak asuransi'], 4)
  if (insLiab.CY != null) result['SFP_INS_LIAB'] = insLiab

  const reinsLiab = getField(sfp, ['liabilitas kontrak reasuransi'], 4)
  if (reinsLiab.CY != null) result['SFP_REINS_LIAB'] = reinsLiab

  const modal = getVal(sfp, ['modal disetor', 'modal saham'], 4)
  if (modal != null) result['SFP_SHARECAP'] = makeField(modal)

  const laba = getVal(sfp, ['akumulasi laba ditahan', 'saldo laba', 'laba ditahan', 'retained earning'], 4)
  if (laba != null) result['SFP_RETAINED'] = makeField(laba)

  const oci = getVal(sfp, ['akumulasi other comprehensive income', 'cadangan oci', 'akumulasi oci', 'other comprehensive income'], 4)
  if (oci != null) result['SFP_FVOCI_RES'] = makeField(oci)

  const totalAset = getVal(sfp, ['jumlah aset', 'total aset', 'total asset'], 4)
  if (totalAset != null) result['SFP_TOTAL_ASSET'] = makeField(totalAset)
}

/** Field P&L yang sama untuk Umum dan Jiwa */
function parseLRG(lrg: Array<{ label: string; cols: (number | null)[] }>, result: ParsedFields) {
  const insRev = getField(lrg, ['pendapatan jasa asuransi'], 4)
  if (insRev.CY != null) result['PL_INS_REV'] = insRev

  const insExp = getField(lrg, ['beban jasa asuransi'], 4)
  if (insExp.CY != null) result['PL_INS_EXP'] = insExp

  const reinsNet = getField(lrg, ['pendapatan (beban) dari kontrak reasuransi', 'hasil neto kontrak reasuransi', 'neto reasuransi'], 4)
  if (reinsNet.CY != null) result['PL_REINS_NET'] = reinsNet

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

/** Field Arus Kas yang sama untuk Umum dan Jiwa */
function parseAKS(aks: Array<{ label: string; cols: (number | null)[] }>, result: ParsedFields) {
  const cfOp = getField(aks, ['jumlah arus kas bersih dari aktivitas operasi', 'total arus kas operasi', 'net cash from operating'], 4)
  if (cfOp.CY != null) result['CF_OP'] = cfOp

  const cfInv = getField(aks, ['jumlah arus kas bersih dari aktivitas investasi', 'net cash from investing'], 4)
  if (cfInv.CY != null) result['CF_INV'] = cfInv

  const cfFin = getField(aks, ['jumlah arus kas bersih dari aktivitas pendanaan', 'net cash from financing'], 4)
  if (cfFin.CY != null) result['CF_FIN'] = cfFin
}

/** CSM Roll Forward — sama untuk Umum dan Jiwa */
function parseCRF(crf: Array<{ label: string; cols: (number | null)[] }>, result: ParsedFields) {
  const csmOpen = getField(crf, ['csm awal periode', 'saldo awal csm', 'opening csm', 'csm awal'], 4)
  if (csmOpen.CY != null) result['I17_CSM_OPEN'] = csmOpen

  const csmRelease = getField(crf, ['amortisasi csm', 'csm release', 'dirilis ke laporan'], 4)
  if (csmRelease.CY != null) result['I17_CSM_RELEASE'] = csmRelease

  const csmClose = getField(crf, ['csm akhir periode', 'saldo akhir csm', 'closing csm', 'csm akhir'], 4)
  if (csmClose.CY != null) result['I17_CSM_CLOSE'] = csmClose
}

/**
 * Rekonsiliasi kontrak asuransi — satu sheet (PAA atau GMM/VFA).
 * col4=LRC diluar LC, col5=LC, col6=LIC Estimasi, col7=RA
 * Kembalikan nilai mentah supaya bisa dijumlah lintas sheet.
 */
function extractSAGPValues(rows: Array<{ label: string; cols: (number | null)[] }>): {
  lrc: number | null; lc: number | null; lic: number | null; ra: number | null; raOpen: number | null
} {
  const closing = findRow(rows, ['saldo bersih kontrak asuransi (saldo akhir)', 'liabilitas kontrak asuransi (saldo akhir)'])
  const opening = findRow(rows, ['saldo bersih kontrak asuransi', 'liabilitas kontrak asuransi (saldo awal)'])

  const n = (v: number | null | undefined) => (v != null && !isNaN(v) ? v : null)

  return {
    lrc:    closing ? n(closing.cols[4]) : null,
    lc:     closing ? n(closing.cols[5]) : null,
    lic:    closing ? n(closing.cols[6]) : null,
    ra:     closing ? n(closing.cols[7]) : null,
    raOpen: opening ? n(opening.cols[7]) : null,
  }
}

/** Jumlah dua nilai nullable: null jika keduanya null, angka jika salah satu ada */
function addNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null
  return (a ?? 0) + (b ?? 0)
}

/**
 * Gabungkan PAA (LUPSAP/LJPSAP) + GMM (LUPSAGP/LJPSAGP) lalu tulis ke result.
 * Perusahaan bisa pakai PAA saja, GMM saja, atau keduanya — nilai dijumlah.
 */
function parseSAGP(
  agp: Array<{ label: string; cols: (number | null)[] }> | null,
  sap: Array<{ label: string; cols: (number | null)[] }> | null,
  result: ParsedFields,
) {
  const gmm = agp ? extractSAGPValues(agp) : { lrc: null, lc: null, lic: null, ra: null, raOpen: null }
  const paa = sap ? extractSAGPValues(sap) : { lrc: null, lc: null, lic: null, ra: null, raOpen: null }

  const lrc    = addNullable(gmm.lrc, paa.lrc)
  const lc     = addNullable(gmm.lc, paa.lc)
  const ra     = addNullable(gmm.ra, paa.ra)
  const raOpen = addNullable(gmm.raOpen, paa.raOpen)

  // LIC = Estimasi Arus Kas Mendatang (col6) + Penyesuaian Risiko/RA (col7)
  // dari kolom Liabilitas Klaim, baris Saldo Bersih Kontrak Asuransi (Saldo Akhir)
  // gabungkan dari LUPSAP (PAA) + LUPSAGP (GMM/VFA)
  const licEstimasi = addNullable(gmm.lic, paa.lic)
  const lic = addNullable(licEstimasi, ra)

  if (lrc    != null) result['I17_LRC']      = makeField(lrc)
  if (lc     != null) result['I17_LOSS_COMP'] = makeField(lc)
  if (ra     != null) result['I17_RA']        = makeField(ra)
  if (raOpen != null) result['I17_RA_OPEN']   = makeField(raOpen)
  if (lic    != null) result['I17_LIC']       = makeField(lic)

  // Akuisisi & onerous dari GMM saja (PAA tidak punya kolom ini)
  if (agp) {
    const acqCF = getField(agp, ['amortisasi arus kas akuisisi', 'arus kas akuisisi', 'beban akuisisi'], 4)
    if (acqCF.CY != null) result['I17_ACQ_CF'] = acqCF

    const onerous = getField(agp, ['kerugian dari kontrak merugi', 'onerous'], 4)
    if (onerous.CY != null) result['I17_ONEROUS'] = onerous
  }
}

/** LIC dari maturity buckets — fallback jika parseSAGP tidak menghasilkan LIC */
function parseAKD(akd: Array<{ label: string; cols: (number | null)[] }>, result: ParsedFields) {
  const lic = getField(akd, ['total', 'jumlah'], 4)
  if (lic.CY != null && result['I17_LIC'] == null) result['I17_LIC'] = lic
}

/**
 * ECL Stage I dari sheet LUPSB / LJPSB.
 * Cari kolom "Penyisihan Akhir Periode Berjalan (Termasuk ECL)" dari header rows,
 * lalu baca nilai dari baris "Total Tahap I".
 */
function parseSB(ws: Record<string, unknown>, result: ParsedFields) {
  const range = ws['!ref'] as string | undefined
  if (!range) return
  const decoded = XLSX.utils.decode_range(range)
  const maxRow = decoded.e.r
  const maxCol = Math.min(decoded.e.c, 20)

  // Cari kolom "Penyisihan Akhir Periode Berjalan (Termasuk ECL)" dari baris header (baris 0-5)
  let eclCol: number | null = null
  for (let r = 0; r <= Math.min(maxRow, 5); r++) {
    for (let c = 0; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr] as { v?: unknown } | undefined
      if (typeof cell?.v === 'string') {
        const v = cell.v.toLowerCase()
        if (v.includes('penyisihan akhir') || (v.includes('termasuk') && v.includes('ecl'))) {
          eclCol = c
          break
        }
      }
    }
    if (eclCol != null) break
  }

  // Fallback: scan header untuk kolom yang mengandung "ecl" saja
  if (eclCol == null) {
    for (let r = 0; r <= Math.min(maxRow, 5); r++) {
      for (let c = 0; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr] as { v?: unknown } | undefined
        if (typeof cell?.v === 'string' && cell.v.toLowerCase().includes('ecl')) {
          eclCol = c
          break
        }
      }
      if (eclCol != null) break
    }
  }

  if (eclCol == null) return

  // Cari baris "Total Tahap I" / "Tahap I"
  for (let r = 0; r <= maxRow; r++) {
    const labelAddr = XLSX.utils.encode_cell({ r, c: 2 })
    const labelCell = ws[labelAddr] as { v?: unknown } | undefined
    const label = typeof labelCell?.v === 'string' ? labelCell.v.toLowerCase().trim() : ''
    if (label.includes('tahap i') && (label.includes('total') || label.startsWith('tahap'))) {
      const valAddr = XLSX.utils.encode_cell({ r, c: eclCol })
      const valCell = ws[valAddr] as { v?: unknown } | undefined
      if (typeof valCell?.v === 'number' && !isNaN(valCell.v)) {
        result['I9_S1_ALLOW'] = makeField(Math.abs(valCell.v))
        return
      }
    }
  }
}

/**
 * Parse OJK PSAK 117 Excel template.
 * jenis harus sesuai dengan jenis_usaha sesi (Umum → LUP sheets, Jiwa → LJP sheets).
 */
export function parseOjkExcel(buffer: Buffer, jenis: 'Umum' | 'Jiwa' = 'Umum'): ParsedFields {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const result: ParsedFields = {}

  const sheet = (name: string) => {
    if (wb.Sheets[name]) return readSheet(wb.Sheets[name])
    const found = (wb.SheetNames as string[]).find((n: string) => n.toUpperCase().includes(name))
    return found ? readSheet(wb.Sheets[found]) : null
  }

  if (jenis === 'Jiwa') {
    // ── Format Jiwa: prefix LJP ──────────────────────────────────────────────

    const sfp = sheet('LJPSPK')
    if (sfp) parseSFP(sfp, result)

    const lrg = sheet('LJPLRG')
    if (lrg) parseLRG(lrg, result)

    const aks = sheet('LJPAKS')
    if (aks) parseAKS(aks, result)

    const crf = sheet('LJPCRF')
    if (crf) parseCRF(crf, result)

    // PAA = LJPSAP, GMM/VFA = LJPSAGP — jumlah keduanya
    parseSAGP(sheet('LJPSAGP'), sheet('LJPSAP'), result)

    const akd = sheet('LJPAKD')
    if (akd) parseAKD(akd, result)

    // LJPSKV: col4=AC, col5=FVTPL, col6=FVOCI, col7=Gross Stage I (bukan allowance ECL)
    const skv = sheet('LJPSKV')
    if (skv) {
      const totalRow = findRow(skv, ['total', 'jumlah'])
      if (totalRow) {
        const ac = totalRow.cols[4]
        const fvtpl = totalRow.cols[5]
        const fvoci = totalRow.cols[6]
        // col7 = gross exposure Stage I, BUKAN ECL allowance — jangan dipakai sbg I9_S1_ALLOW
        if (ac != null && !isNaN(ac)) { result['I9_AC'] = makeField(ac); result['SFP_AC'] = makeField(ac) }
        if (fvtpl != null && !isNaN(fvtpl)) { result['I9_FVTPL'] = makeField(fvtpl); result['SFP_FVTPL'] = makeField(fvtpl) }
        if (fvoci != null && !isNaN(fvoci)) { result['I9_FVOCI_DEBT'] = makeField(fvoci); result['SFP_FVOCI_DEBT'] = makeField(fvoci) }
      }
    }

    const pkl = sheet('LJPPKL')
    if (pkl) {
      const ociTotal = getField(pkl, ['total', 'jumlah', 'fvoci', 'perubahan nilai wajar'], 4)
      if (ociTotal.CY != null) result['OCI_FVOCI'] = ociTotal
    }

    // ECL Stage I dari LJPSB — Penyisihan Akhir Periode (Termasuk ECL), baris Total Tahap I
    const sbJiwa = wb.Sheets['LJPSB'] ?? wb.Sheets[(wb.SheetNames as string[]).find((n: string) => n.toUpperCase().includes('LJPSB')) ?? '']
    if (sbJiwa) parseSB(sbJiwa, result)

  } else {
    // ── Format Umum: prefix LUP ──────────────────────────────────────────────

    const sfp = sheet('LUPSPK')
    if (sfp) parseSFP(sfp, result)

    const lrg = sheet('LUPLRG')
    if (lrg) parseLRG(lrg, result)

    const aks = sheet('LUPAKS')
    if (aks) parseAKS(aks, result)

    const crf = sheet('LUPCRF')
    if (crf) parseCRF(crf, result)

    // PAA = LUPSAP, GMM/VFA = LUPSAGP — jumlah keduanya
    parseSAGP(sheet('LUPSAGP'), sheet('LUPSAP'), result)

    const akd = sheet('LUPAKD')
    if (akd) parseAKD(akd, result)

    // LUPSKV: col4=AC, col5=FVTPL, col6=FVOCI (col7 bukan ECL allowance — diambil dari LUPSB)
    const skv = sheet('LUPSKV')
    if (skv) {
      const totalRow = findRow(skv, ['total', 'jumlah'])
      if (totalRow) {
        const ac = totalRow.cols[4]
        const fvtpl = totalRow.cols[5]
        const fvoci = totalRow.cols[6]
        if (ac != null && !isNaN(ac)) { result['I9_AC'] = makeField(ac); result['SFP_AC'] = makeField(ac) }
        if (fvtpl != null && !isNaN(fvtpl)) { result['I9_FVTPL'] = makeField(fvtpl); result['SFP_FVTPL'] = makeField(fvtpl) }
        if (fvoci != null && !isNaN(fvoci)) { result['I9_FVOCI_DEBT'] = makeField(fvoci); result['SFP_FVOCI_DEBT'] = makeField(fvoci) }
      }
    }

    // ECL Stage I dari LUPSB — Penyisihan Akhir Periode (Termasuk ECL), baris Total Tahap I
    const sbUmum = wb.Sheets['LUPSB'] ?? wb.Sheets[(wb.SheetNames as string[]).find((n: string) => n.toUpperCase().includes('LUPSB')) ?? '']
    if (sbUmum) parseSB(sbUmum, result)

    const sco = sheet('LUPSCO')
    if (sco) {
      const claims = getField(sco, ['klaim dan manfaat', 'klaim bruto', 'total klaim', 'gross claims'], 4)
      if (claims.CY != null) result['I17_GROSS_CLAIMS'] = claims
    }

    const pkl = sheet('LUPPKL')
    if (pkl) {
      const ociTotal = getField(pkl, ['total', 'jumlah', 'fvoci', 'perubahan nilai wajar'], 4)
      if (ociTotal.CY != null) result['OCI_FVOCI'] = ociTotal
    }
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
