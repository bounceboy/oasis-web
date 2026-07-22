// Parser untuk Excel OJK PSAK 117 (format LUPSAJAK)
// Membaca sheet-sheet spesifik dan memetakan ke template_data fields

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')

type FieldValues = { CY: number | null; PY: number | null; PPY: number | null }
type ParsedFields = Partial<Record<string, FieldValues>>

function makeField(cy: number | null, py: number | null = null): FieldValues {
  return { CY: cy, PY: py, PPY: null }
}

/**
 * Scan satu sheet untuk mencari nilai berdasarkan keyword di kolom A (atau B).
 * Mengembalikan peta label → { rowIndex, numericValues[] }
 */
function scanSheet(ws: Record<string, unknown>): Array<{ label: string; row: number; vals: (number | null)[] }> {
  const range = ws['!ref'] as string | undefined
  if (!range) return []

  const decoded = XLSX.utils.decode_range(range)
  const maxRow = decoded.e.r
  const maxCol = Math.min(decoded.e.c, 15) // max 16 kolom

  const rows: Array<{ label: string; row: number; vals: (number | null)[] }> = []

  for (let r = 0; r <= maxRow; r++) {
    // Cek kolom A dan B untuk label teks
    let label = ''
    for (const col of [0, 1]) {
      const addr = XLSX.utils.encode_cell({ r, c: col })
      const cell = ws[addr] as { v?: unknown } | undefined
      if (cell && typeof cell.v === 'string' && cell.v.trim().length > 0) {
        label = cell.v.trim()
        break
      }
    }
    if (!label) continue

    // Ambil nilai numerik dari kolom C ke kanan (atau kolom B+ jika A kosong)
    const vals: (number | null)[] = []
    for (let c = 2; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr] as { v?: unknown } | undefined
      if (cell && typeof cell.v === 'number') {
        vals.push(cell.v)
      } else {
        vals.push(null)
      }
    }

    // Hanya simpan baris yang punya setidaknya satu nilai numerik
    if (vals.some(v => v !== null)) {
      rows.push({ label, row: r, vals })
    }
  }

  return rows
}

/** Cari nilai pertama yang cocok dengan salah satu keyword */
function findValue(
  rows: Array<{ label: string; row: number; vals: (number | null)[] }>,
  keywords: string[],
  colOffset = 0, // offset dari kolom pertama nilai (0 = CY, 1 = PY)
): number | null {
  const keywordsLower = keywords.map(k => k.toLowerCase())
  for (const row of rows) {
    const labelLower = row.label.toLowerCase()
    if (keywordsLower.some(k => labelLower.includes(k))) {
      const val = row.vals[colOffset] ?? null
      if (val !== null && !isNaN(val)) return val
      // Coba kolom berikutnya jika null
      for (let i = 0; i < row.vals.length; i++) {
        if (row.vals[i] !== null && !isNaN(row.vals[i]!)) return row.vals[i]
      }
    }
  }
  return null
}

/** Cari baris dengan keyword, ambil CY (col 0) dan PY (col 1) */
function findFieldCyPy(
  rows: Array<{ label: string; row: number; vals: (number | null)[] }>,
  keywords: string[],
): FieldValues {
  const keywordsLower = keywords.map(k => k.toLowerCase())
  for (const row of rows) {
    const labelLower = row.label.toLowerCase()
    if (keywordsLower.some(k => labelLower.includes(k))) {
      const cy = row.vals[0] ?? null
      const py = row.vals[1] ?? null
      // Kalau keduanya null, coba ambil yang ada
      if (cy !== null || py !== null) {
        return { CY: cy, PY: py, PPY: null }
      }
    }
  }
  return { CY: null, PY: null, PPY: null }
}

/**
 * Parse OJK PSAK 117 Excel template.
 * Mengembalikan partial record yang bisa di-merge ke template_data.values.
 */
export function parseOjkExcel(buffer: Buffer): ParsedFields {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const result: ParsedFields = {}

  // ── LUPSPK — Laporan Posisi Keuangan ─────────────────────────────────────
  const sfpSheet = wb.Sheets['LUPSPK'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPSPK') || n.toUpperCase().includes('SPK')) ?? '']
  if (sfpSheet) {
    const rows = scanSheet(sfpSheet)

    const kas = findFieldCyPy(rows, ['kas dan setara kas', 'kas dan bank', 'cash and bank', 'cash'])
    if (kas.CY != null || kas.PY != null) result['SFP_CASH'] = kas

    const fvtpl = findFieldCyPy(rows, ['fvtpl', 'nilai wajar melalui laba rugi', 'fair value through profit'])
    if (fvtpl.CY != null || fvtpl.PY != null) result['SFP_FVTPL'] = fvtpl

    const fvociDebt = findFieldCyPy(rows, ['fvoci utang', 'fvoci - utang', 'fvoci - debt', 'nilai wajar melalui penghasilan komprehensif lain - utang', 'instrumen utang'])
    if (fvociDebt.CY != null || fvociDebt.PY != null) result['SFP_FVOCI_DEBT'] = fvociDebt

    const fvociEq = findFieldCyPy(rows, ['fvoci ekuitas', 'fvoci - ekuitas', 'instrumen ekuitas', 'equity fvoci'])
    if (fvociEq.CY != null || fvociEq.PY != null) result['SFP_FVOCI_EQ'] = fvociEq

    const ac = findFieldCyPy(rows, ['biaya perolehan diamortisasi', 'amortised cost', 'amortized cost'])
    if (ac.CY != null || ac.PY != null) result['SFP_AC'] = ac

    const invProp = findFieldCyPy(rows, ['properti investasi', 'investment property'])
    if (invProp.CY != null || invProp.PY != null) result['SFP_INVPROP'] = invProp

    const reinsAsset = findFieldCyPy(rows, ['aset kontrak reasuransi', 'aset reasuransi', 'reinsurance contract asset'])
    if (reinsAsset.CY != null || reinsAsset.PY != null) result['SFP_REINS_ASSET'] = reinsAsset

    const insLiab = findFieldCyPy(rows, ['liabilitas kontrak asuransi', 'insurance contract liabilit'])
    if (insLiab.CY != null || insLiab.PY != null) result['SFP_INS_LIAB'] = insLiab

    const reinsLiab = findFieldCyPy(rows, ['liabilitas kontrak reasuransi', 'reinsurance contract liabilit'])
    if (reinsLiab.CY != null || reinsLiab.PY != null) result['SFP_REINS_LIAB'] = reinsLiab

    const sharecap = findFieldCyPy(rows, ['modal saham', 'modal ditempatkan', 'share capital'])
    if (sharecap.CY != null || sharecap.PY != null) result['SFP_SHARECAP'] = sharecap

    const retained = findFieldCyPy(rows, ['saldo laba', 'retained earnings', 'laba ditahan'])
    if (retained.CY != null || retained.PY != null) result['SFP_RETAINED'] = retained

    const fvociRes = findFieldCyPy(rows, ['cadangan fvoci', 'penghasilan komprehensif lain - fvoci', 'fvoci reserve', 'cadangan nilai wajar'])
    if (fvociRes.CY != null || fvociRes.PY != null) result['SFP_FVOCI_RES'] = fvociRes

    const ifociRes = findFieldCyPy(rows, ['insurance finance oci', 'cadangan insurance finance', 'cadangan keuangan asuransi'])
    if (ifociRes.CY != null || ifociRes.PY != null) result['SFP_IFOCI_RES'] = ifociRes
  }

  // ── LUPLRG — Laporan Laba Rugi ───────────────────────────────────────────
  const plSheet = wb.Sheets['LUPLRG'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPLRG') || n.toUpperCase().includes('LRG')) ?? '']
  if (plSheet) {
    const rows = scanSheet(plSheet)

    const insRev = findFieldCyPy(rows, ['pendapatan jasa asuransi', 'insurance revenue', 'pendapatan asuransi'])
    if (insRev.CY != null || insRev.PY != null) result['PL_INS_REV'] = insRev

    const insExp = findFieldCyPy(rows, ['beban jasa asuransi', 'insurance service expense', 'beban layanan asuransi'])
    if (insExp.CY != null || insExp.PY != null) result['PL_INS_EXP'] = insExp

    const reinsNet = findFieldCyPy(rows, ['hasil neto kontrak reasuransi', 'net reinsurance result', 'neto reasuransi'])
    if (reinsNet.CY != null || reinsNet.PY != null) result['PL_REINS_NET'] = reinsNet

    // ISR langsung dari laporan laba rugi
    const isr = findFieldCyPy(rows, ['hasil jasa asuransi bersih', 'hasil jasa asuransi', 'insurance service result', 'hasil underwriting'])
    if (isr.CY != null || isr.PY != null) result['I17_ISR'] = isr

    const invRes = findFieldCyPy(rows, ['hasil investasi', 'pendapatan investasi', 'investment income', 'investment result'])
    if (invRes.CY != null || invRes.PY != null) result['PL_INV_RES'] = invRes

    const ifFin = findFieldCyPy(rows, ['biaya keuangan asuransi', 'insurance finance', 'if finance'])
    if (ifFin.CY != null || ifFin.PY != null) result['PL_IF_FIN'] = ifFin

    const impair = findFieldCyPy(rows, ['kerugian penurunan nilai', 'ecl', 'expected credit loss', 'impairment'])
    if (impair.CY != null || impair.PY != null) result['PL_IMPAIR'] = impair

    const opex = findFieldCyPy(rows, ['beban operasional', 'beban umum dan administrasi', 'general and administrative', 'operating expense'])
    if (opex.CY != null || opex.PY != null) result['PL_OPEX'] = opex

    const tax = findFieldCyPy(rows, ['beban pajak', 'income tax', 'pajak penghasilan'])
    if (tax.CY != null || tax.PY != null) result['PL_TAX'] = tax
  }

  // ── LUPAKS — Laporan Arus Kas ─────────────────────────────────────────────
  const cfSheet = wb.Sheets['LUPAKS'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPAKS') || n.toUpperCase().includes('AKS')) ?? '']
  if (cfSheet) {
    const rows = scanSheet(cfSheet)

    const cfOp = findFieldCyPy(rows, [
      'jumlah arus kas bersih dari aktivitas operasi',
      'net cash from operating',
      'arus kas neto dari aktivitas operasi',
      'aktivitas operasi',
    ])
    if (cfOp.CY != null || cfOp.PY != null) result['CF_OP'] = cfOp

    const cfInv = findFieldCyPy(rows, [
      'jumlah arus kas bersih dari aktivitas investasi',
      'net cash from investing',
      'arus kas neto dari aktivitas investasi',
    ])
    if (cfInv.CY != null || cfInv.PY != null) result['CF_INV'] = cfInv

    const cfFin = findFieldCyPy(rows, [
      'jumlah arus kas bersih dari aktivitas pendanaan',
      'net cash from financing',
      'arus kas neto dari aktivitas pendanaan',
    ])
    if (cfFin.CY != null || cfFin.PY != null) result['CF_FIN'] = cfFin

    const cfEnd = findFieldCyPy(rows, ['kas dan setara kas akhir', 'cash at end', 'saldo akhir kas'])
    if (cfEnd.CY != null || cfEnd.PY != null) result['CF_END'] = cfEnd

    const cfBeg = findFieldCyPy(rows, ['kas dan setara kas awal', 'cash at beginning', 'saldo awal kas'])
    if (cfBeg.CY != null || cfBeg.PY != null) result['CF_BEG'] = cfBeg
  }

  // ── LUPCRF — CSM Roll Forward ──────────────────────────────────────────────
  const csmSheet = wb.Sheets['LUPCRF'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPCRF') || n.toUpperCase().includes('CRF')) ?? '']
  if (csmSheet) {
    const rows = scanSheet(csmSheet)

    const csmOpen = findFieldCyPy(rows, ['saldo awal', 'opening balance', 'csm awal', 'saldo csm awal'])
    if (csmOpen.CY != null || csmOpen.PY != null) result['I17_CSM_OPEN'] = csmOpen

    const csmRelease = findFieldCyPy(rows, ['amortisasi', 'csm release', 'dirilis ke laporan laba rugi', 'release to p&l', 'margin yang dirilis'])
    if (csmRelease.CY != null || csmRelease.PY != null) result['I17_CSM_RELEASE'] = csmRelease

    const csmClose = findFieldCyPy(rows, ['saldo akhir', 'closing balance', 'csm akhir', 'saldo csm akhir'])
    if (csmClose.CY != null || csmClose.PY != null) result['I17_CSM_CLOSE'] = csmClose
  }

  // ── LUPSAGP — GMM Reconciliation (LRC, Loss Component, RA) ──────────────
  const agpSheet = wb.Sheets['LUPSAGP'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPSAGP') || n.toUpperCase().includes('SAGP')) ?? '']
  if (agpSheet) {
    const rows = scanSheet(agpSheet)

    // LRC (diluar loss component)
    const lrc = findFieldCyPy(rows, [
      'saldo bersih diluar loss component',
      'saldo akhir diluar loss component',
      'lrc diluar komponen kerugian',
      'liabilitas sisa masa pertanggungan diluar',
    ])
    if (lrc.CY != null || lrc.PY != null) result['I17_LRC'] = lrc

    // Loss component
    const lossComp = findFieldCyPy(rows, ['loss component', 'komponen kerugian', 'kerugian kontrak merugi'])
    if (lossComp.CY != null || lossComp.PY != null) result['I17_LOSS_COMP'] = lossComp

    // RA: cari section penyesuaian risiko dan ambil saldo awal/akhir
    // Cari baris "Penyesuaian Risiko" atau "Risk Adjustment" sebagai header
    const raRowIdx = rows.findIndex(r =>
      r.label.toLowerCase().includes('penyesuaian risiko') ||
      r.label.toLowerCase().includes('risk adjustment')
    )

    if (raRowIdx >= 0) {
      // Setelah header RA, cari saldo awal dan saldo akhir
      const raSection = rows.slice(raRowIdx, raRowIdx + 15)
      const raOpen = findFieldCyPy(raSection, ['saldo awal', 'opening', 'awal'])
      if (raOpen.CY != null || raOpen.PY != null) result['I17_RA_OPEN'] = raOpen

      const raClose = findFieldCyPy(raSection, ['saldo akhir', 'closing', 'akhir'])
      if (raClose.CY != null || raClose.PY != null) result['I17_RA'] = raClose
    }
  }

  // ── LUPAKD — LIC Detail ───────────────────────────────────────────────────
  const licSheet = wb.Sheets['LUPAKD'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPAKD') || n.toUpperCase().includes('AKD')) ?? '']
  if (licSheet) {
    const rows = scanSheet(licSheet)

    const lic = findFieldCyPy(rows, ['total', 'jumlah', 'liabilitas atas kejadian klaim', 'lic'])
    if (lic.CY != null || lic.PY != null) result['I17_LIC'] = lic
  }

  // ── LUPSKV — Investment Summary (ECL Stage 1) ────────────────────────────
  const skvSheet = wb.Sheets['LUPSKV'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPSKV') || n.toUpperCase().includes('SKV')) ?? '']
  if (skvSheet) {
    const rows = scanSheet(skvSheet)

    // Total ECL Stage 1 allowance (cari baris "Total" di akhir tabel yang punya nilai ECL)
    const totalRow = findFieldCyPy(rows, ['total', 'jumlah'])
    // Cari kolom ECL — biasanya setelah kolom nilai tercatat (carrying amount)
    // Strategy: cari header row dengan "tahap i" atau "stage 1" atau "ecl"
    const headerRow = rows.find(r =>
      r.label.toLowerCase().includes('tahap i') ||
      r.label.toLowerCase().includes('stage 1') ||
      r.label.toLowerCase().includes('cadangan') ||
      r.label.toLowerCase().includes('allowance')
    )

    if (headerRow) {
      // Nilai ECL Stage 1 total ada di baris total tabel SKV
      // Gunakan nilai dari baris "total" — biasanya kolom terakhir yang berisi ECL
      const eclVal = findValue(rows, ['total', 'jumlah'], 0)
      if (eclVal !== null) {
        result['I9_S1_ALLOW'] = makeField(eclVal)
      }
    } else if (totalRow.CY !== null) {
      // Fallback: gunakan nilai total pertama yang ditemukan
      result['I9_S1_ALLOW'] = totalRow
    }

    // Cari nilai FVTPL, FVOCI, AC dari LUPSKV jika belum ada dari LUPSPK
    if (!result['I9_FVTPL']) {
      const fvtpl = findFieldCyPy(rows, ['fvtpl', 'nilai wajar melalui laba rugi'])
      if (fvtpl.CY != null) result['I9_FVTPL'] = fvtpl
    }
    if (!result['I9_FVOCI_DEBT']) {
      const fvociDebt = findFieldCyPy(rows, ['fvoci - utang', 'instrumen utang fvoci', 'utang fvoci'])
      if (fvociDebt.CY != null) result['I9_FVOCI_DEBT'] = fvociDebt
    }
    if (!result['I9_AC']) {
      const ac = findFieldCyPy(rows, ['biaya perolehan diamortisasi', 'amortised cost'])
      if (ac.CY != null) result['I9_AC'] = ac
    }
  }

  // ── LUPSB — ECL Breakdown (Stage 1 cadangan per jenis aset) ──────────────
  const sbSheet = wb.Sheets['LUPSB'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPSB')) ?? '']
  if (sbSheet && !result['I9_S1_ALLOW']) {
    const rows = scanSheet(sbSheet)
    const s1Allow = findFieldCyPy(rows, ['total', 'jumlah', 'tahap i', 'stage 1'])
    if (s1Allow.CY != null || s1Allow.PY != null) result['I9_S1_ALLOW'] = s1Allow
  }

  // ── LUPSCO — Claims (gross claims / klaim dan manfaat) ────────────────────
  const scoSheet = wb.Sheets['LUPSCO'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPSCO') || n.toUpperCase().includes('SCO')) ?? '']
  if (scoSheet) {
    const rows = scanSheet(scoSheet)
    const claims = findFieldCyPy(rows, ['klaim dan manfaat', 'klaim bruto', 'gross claims', 'total klaim'])
    if (claims.CY != null || claims.PY != null) result['I17_GROSS_CLAIMS'] = claims
  }

  // ── LUPPKL — OCI (FVOCI reserve) ──────────────────────────────────────────
  const pklSheet = wb.Sheets['LUPPKL'] ?? wb.Sheets[wb.SheetNames.find((n: string) => n.toUpperCase().includes('LUPPKL') || n.toUpperCase().includes('PKL')) ?? '']
  if (pklSheet) {
    const rows = scanSheet(pklSheet)
    const fvociOci = findFieldCyPy(rows, ['fvoci', 'oci - fvoci', 'perubahan nilai wajar', 'cadangan fvoci'])
    if (fvociOci.CY != null || fvociOci.PY != null) result['OCI_FVOCI'] = fvociOci
  }

  return result
}

/**
 * Merge hasil parse Excel ke template_data yang sudah ada.
 * Nilai dari Excel menimpa nilai yang mungkin sudah ada dari PDF ekstraksi.
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
