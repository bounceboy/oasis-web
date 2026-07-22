// Pure calculation functions — no server imports, safe for client components
import type { TemplateData, JenisUsaha } from './psak-template-structure'

export type { JenisUsaha }

export interface DataKeuangan {
  total_aset?: number
  total_liabilitas?: number
  total_ekuitas?: number
  kas?: number
  investasi_total?: number
  liabilitas_kontrak_asuransi?: number
  aset_kontrak_reasuransi?: number
  fvoci_reserve?: number
  pendapatan_asuransi?: number
  beban_jasa_asuransi?: number
  beban_underwriting?: number
  klaim_dan_manfaat?: number
  insurance_service_result?: number
  hasil_investasi?: number
  profit_tahun_berjalan?: number
  csm_penutup?: number
  csm_pembuka?: number
  csm_release?: number
  lrc?: number
  lic?: number
  loss_component?: number
  risk_adjustment?: number
  risk_adjustment_pembuka?: number
  cession_ratio?: number
  ecl_total?: number
  ecl_base?: number
  stage2_3_exposure?: number
  stage_total_exposure?: number
  arus_kas_operasi?: number
  kas_akhir?: number
  periode?: string
  unit?: string
}

export interface RasioKeuangan {
  roe?: number
  roa?: number
  leverage?: number
  liquidity?: number
  claim_ratio?: number
  csm_equity?: number
  ecl_coverage?: number
  stage2_3_ratio?: number
  ocf_profit?: number
  cession_ratio?: number
  investment_yield?: number
  reserve_leverage?: number
  expense_ratio?: number
  combined_ratio?: number
  reins_asset_equity?: number
  csm_growth?: number
  csm_release_ratio?: number
  ra_change?: number
  loss_component_weight?: number
  ism_margin?: number
  investment_ratio?: number
  fvoci_equity?: number
}

export interface ScorecardItem {
  metric: string
  nilai: number | null
  threshold: string
  pass: boolean | null
  poin: number
  keterangan: string
}

const THRESHOLD = {
  liquidity_min: 0.05,
  leverage_max: 3,
  roe_min: 0.05,
  claim_ratio_max: 0.70,
  ecl_coverage_min: 0.002,
  stage2_3_ratio_max: 0.10,
  ocf_profit_min: 0.80,
  csm_equity_min: 0.05,
  investment_yield_min: 0.04,
  cession_ratio_max: 0.70,
  expense_ratio_max: 0.30,
  combined_ratio_max: 1.00,
  reins_asset_equity_max: 2.0,
  csm_growth_min: 1.0,
  csm_release_ratio_min: 0.05,
  ra_change_max: 1.20,
  loss_component_weight_max: 0.05,
  ism_margin_min: 0.05,
  investment_ratio_min: 0.60,
  fvoci_equity_max: 0.50,
}

export function templateDataToDataKeuangan(td: TemplateData): DataKeuangan {
  const val = td.values
  const cy = (key: string): number | null => val[key]?.CY ?? null

  function sumKeys(...keys: string[]): number | null {
    const nums = keys.map(k => cy(k)).filter((x): x is number => x != null)
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null
  }

  const totalAset = sumKeys('SFP_CASH', 'SFP_MM', 'SFP_FVTPL', 'SFP_FVOCI_DEBT', 'SFP_FVOCI_EQ',
    'SFP_AC', 'SFP_INVPROP', 'SFP_RECEIV', 'SFP_UNDERWRITING_OTHER', 'SFP_REINS_ASSET',
    'SFP_ACQASSET', 'SFP_PPE', 'SFP_INTANG', 'SFP_TAX_ASSET', 'SFP_OTHER')

  const totalLiab = sumKeys('SFP_INS_LIAB', 'SFP_REINS_LIAB', 'SFP_INVEST_LIAB', 'SFP_PAYABLES',
    'SFP_TAX_LIAB', 'SFP_LEASE_DEBT', 'SFP_OTHER_LIAB', 'SFP_FUNDS')

  const totalEkuitas = sumKeys('SFP_SHARECAP', 'SFP_APIC', 'SFP_RETAINED', 'SFP_FVOCI_RES',
    'SFP_IFOCI_RES', 'SFP_OTHER_RES')

  // Profit = sum of all P/L lines (incl. expenses as negative)
  const plKeys = ['PL_INS_REV', 'PL_INS_EXP', 'PL_REINS_NET', 'PL_INV_RES', 'PL_IF_FIN',
    'PL_REINS_FIN', 'PL_IMPAIR', 'PL_FEE_OTHER', 'PL_OPEX', 'PL_OTHER_NONOP', 'PL_TAX']
  const plVals = plKeys.map(k => cy(k)).filter((x): x is number => x != null)
  const profit = plVals.length >= 4 ? plVals.reduce((a, b) => a + b, 0) : null

  // ISR = Revenue + Service Expense + Net Reins
  const isr = (() => {
    const rev = cy('PL_INS_REV'); const exp = cy('PL_INS_EXP'); const rein = cy('PL_REINS_NET')
    if (rev == null) return null
    return (rev ?? 0) + (exp ?? 0) + (rein ?? 0)
  })()

  // Cession ratio from GWP/NWP
  const cession = (() => {
    const nwp = cy('I17_NWP'); const gwp = cy('I17_GWP')
    if (nwp == null || gwp == null || gwp === 0) return null
    return Math.max(0, 1 - nwp / gwp)
  })()

  return {
    total_aset: totalAset ?? undefined,
    total_liabilitas: totalLiab ?? undefined,
    total_ekuitas: totalEkuitas ?? undefined,
    kas: cy('SFP_CASH') ?? undefined,
    investasi_total: sumKeys('SFP_MM', 'SFP_FVTPL', 'SFP_FVOCI_DEBT', 'SFP_FVOCI_EQ', 'SFP_AC', 'SFP_INVPROP') ?? undefined,
    liabilitas_kontrak_asuransi: (cy('SFP_INS_LIAB') ?? cy('I17_INS_LIAB')) ?? undefined,
    aset_kontrak_reasuransi: (cy('SFP_REINS_ASSET') ?? cy('I17_REINS_ASSET')) ?? undefined,
    fvoci_reserve: (cy('SFP_FVOCI_RES') ?? cy('I9_FVOCI_RES')) ?? undefined,
    pendapatan_asuransi: cy('PL_INS_REV') ?? undefined,
    beban_jasa_asuransi: cy('PL_INS_EXP') ?? undefined,
    beban_underwriting: sumKeys('I17_ACQ_CF', 'I17_UW_EXP') ?? undefined,
    klaim_dan_manfaat: cy('I17_GROSS_CLAIMS') ?? undefined,
    insurance_service_result: isr ?? undefined,
    hasil_investasi: cy('PL_INV_RES') ?? undefined,
    profit_tahun_berjalan: profit ?? undefined,
    csm_penutup: cy('I17_CSM_CLOSE') ?? undefined,
    csm_pembuka: cy('I17_CSM_OPEN') ?? undefined,
    csm_release: undefined,
    lrc: cy('I17_LRC') ?? undefined,
    lic: cy('I17_LIC') ?? undefined,
    loss_component: cy('I17_LOSS_COMP') ?? undefined,
    risk_adjustment: cy('I17_RA') ?? undefined,
    risk_adjustment_pembuka: cy('I17_RA_OPEN') ?? undefined,
    cession_ratio: cession ?? undefined,
    ecl_total: sumKeys('I9_S1_ALLOW', 'I9_S2_ALLOW', 'I9_S3_ALLOW') ?? undefined,
    ecl_base: sumKeys('I9_S1_EXP', 'I9_S2_EXP', 'I9_S3_EXP') ?? undefined,
    stage2_3_exposure: sumKeys('I9_S2_EXP', 'I9_S3_EXP') ?? undefined,
    stage_total_exposure: sumKeys('I9_S1_EXP', 'I9_S2_EXP', 'I9_S3_EXP') ?? undefined,
    arus_kas_operasi: cy('CF_OP') ?? undefined,
    kas_akhir: cy('CF_END') ?? undefined,
    periode: td.metadata.periode,
    unit: td.metadata.unit,
  }
}

export function hitungRasio(d: DataKeuangan): RasioKeuangan {
  const r: RasioKeuangan = {}

  if (d.profit_tahun_berjalan != null && d.total_ekuitas)
    r.roe = d.profit_tahun_berjalan / d.total_ekuitas
  if (d.profit_tahun_berjalan != null && d.total_aset)
    r.roa = d.profit_tahun_berjalan / d.total_aset
  if (d.total_liabilitas != null && d.total_ekuitas)
    r.leverage = d.total_liabilitas / d.total_ekuitas
  if (d.kas != null && d.total_liabilitas)
    r.liquidity = d.kas / d.total_liabilitas
  if (d.klaim_dan_manfaat != null && d.pendapatan_asuransi)
    r.claim_ratio = Math.abs(d.klaim_dan_manfaat) / d.pendapatan_asuransi
  if (d.csm_penutup != null && d.total_ekuitas)
    r.csm_equity = d.csm_penutup / d.total_ekuitas
  if (d.ecl_total != null && d.ecl_base)
    r.ecl_coverage = d.ecl_total / d.ecl_base
  if (d.stage2_3_exposure != null && d.stage_total_exposure)
    r.stage2_3_ratio = d.stage2_3_exposure / d.stage_total_exposure
  if (d.arus_kas_operasi != null && d.profit_tahun_berjalan)
    r.ocf_profit = d.arus_kas_operasi / d.profit_tahun_berjalan
  if (d.cession_ratio != null)
    r.cession_ratio = d.cession_ratio
  if (d.hasil_investasi != null && d.investasi_total)
    r.investment_yield = d.hasil_investasi / d.investasi_total
  if (d.liabilitas_kontrak_asuransi != null && d.total_ekuitas)
    r.reserve_leverage = d.liabilitas_kontrak_asuransi / d.total_ekuitas
  if (d.beban_underwriting != null && d.pendapatan_asuransi)
    r.expense_ratio = Math.abs(d.beban_underwriting) / d.pendapatan_asuransi
  if (r.claim_ratio != null && r.expense_ratio != null)
    r.combined_ratio = r.claim_ratio + r.expense_ratio
  if (d.aset_kontrak_reasuransi != null && d.total_ekuitas)
    r.reins_asset_equity = d.aset_kontrak_reasuransi / d.total_ekuitas
  if (d.csm_penutup != null && d.csm_pembuka && d.csm_pembuka > 0)
    r.csm_growth = d.csm_penutup / d.csm_pembuka
  if (d.csm_release != null && d.csm_pembuka && d.csm_pembuka > 0)
    r.csm_release_ratio = d.csm_release / d.csm_pembuka
  if (d.risk_adjustment != null && d.risk_adjustment_pembuka && d.risk_adjustment_pembuka > 0)
    r.ra_change = d.risk_adjustment / d.risk_adjustment_pembuka
  if (d.loss_component != null && d.liabilitas_kontrak_asuransi)
    r.loss_component_weight = Math.abs(d.loss_component) / d.liabilitas_kontrak_asuransi
  if (d.insurance_service_result != null && d.pendapatan_asuransi)
    r.ism_margin = d.insurance_service_result / d.pendapatan_asuransi
  if (d.investasi_total != null && d.total_aset)
    r.investment_ratio = d.investasi_total / d.total_aset
  if (d.fvoci_reserve != null && d.total_ekuitas)
    r.fvoci_equity = d.fvoci_reserve / d.total_ekuitas

  return r
}

export function buildScorecard(rasio: RasioKeuangan, jenis: JenisUsaha): ScorecardItem[] {
  const items: ScorecardItem[] = []

  function item(metric: string, nilai: number | undefined, threshold: string, pass: boolean | null, keterangan: string): ScorecardItem {
    return { metric, nilai: nilai ?? null, threshold, pass, poin: pass === true ? 1 : 0, keterangan }
  }

  items.push(item('ROE', rasio.roe, `>= ${(THRESHOLD.roe_min * 100).toFixed(0)}%`,
    rasio.roe != null ? rasio.roe >= THRESHOLD.roe_min : null,
    rasio.roe != null ? (rasio.roe >= THRESHOLD.roe_min ? 'Memenuhi' : 'Di bawah minimum') : 'Data tidak tersedia'))

  items.push(item('Kas / Liabilitas (Likuiditas)', rasio.liquidity, `>= ${(THRESHOLD.liquidity_min * 100).toFixed(0)}%`,
    rasio.liquidity != null ? rasio.liquidity >= THRESHOLD.liquidity_min : null,
    rasio.liquidity != null ? (rasio.liquidity >= THRESHOLD.liquidity_min ? 'Memenuhi' : 'Perlu perhatian') : 'Data tidak tersedia'))

  items.push(item('Liabilitas / Ekuitas (Leverage)', rasio.leverage, `<= ${THRESHOLD.leverage_max}x`,
    rasio.leverage != null ? rasio.leverage <= THRESHOLD.leverage_max : null,
    rasio.leverage != null ? (rasio.leverage <= THRESHOLD.leverage_max ? 'Memenuhi' : 'Leverage tinggi') : 'Data tidak tersedia'))

  items.push(item('Claim Ratio', rasio.claim_ratio, `<= ${(THRESHOLD.claim_ratio_max * 100).toFixed(0)}%`,
    rasio.claim_ratio != null ? rasio.claim_ratio <= THRESHOLD.claim_ratio_max : null,
    rasio.claim_ratio != null ? (rasio.claim_ratio <= THRESHOLD.claim_ratio_max ? 'Memenuhi' : 'Klaim tinggi') : 'Data tidak tersedia'))

  if (jenis === 'Umum') {
    items.push(item('Expense Ratio', rasio.expense_ratio, `<= ${(THRESHOLD.expense_ratio_max * 100).toFixed(0)}%`,
      rasio.expense_ratio != null ? rasio.expense_ratio <= THRESHOLD.expense_ratio_max : null,
      rasio.expense_ratio != null ? (rasio.expense_ratio <= THRESHOLD.expense_ratio_max ? 'Memenuhi' : 'Beban usaha tinggi') : 'Data tidak tersedia'))
    items.push(item('Combined Ratio', rasio.combined_ratio, `<= ${(THRESHOLD.combined_ratio_max * 100).toFixed(0)}%`,
      rasio.combined_ratio != null ? rasio.combined_ratio <= THRESHOLD.combined_ratio_max : null,
      rasio.combined_ratio != null ? (rasio.combined_ratio <= THRESHOLD.combined_ratio_max ? 'Memenuhi' : 'Operasi underwriting merugi') : 'Data tidak tersedia'))
    items.push(item('Aset Reasuransi / Ekuitas', rasio.reins_asset_equity, `<= ${THRESHOLD.reins_asset_equity_max}x`,
      rasio.reins_asset_equity != null ? rasio.reins_asset_equity <= THRESHOLD.reins_asset_equity_max : null,
      rasio.reins_asset_equity != null ? (rasio.reins_asset_equity <= THRESHOLD.reins_asset_equity_max ? 'Memenuhi' : 'Dependensi reasuransi tinggi') : 'Data tidak tersedia'))
  }

  if (jenis === 'Jiwa') {
    items.push(item('CSM / Ekuitas', rasio.csm_equity, `>= ${(THRESHOLD.csm_equity_min * 100).toFixed(0)}%`,
      rasio.csm_equity != null ? rasio.csm_equity >= THRESHOLD.csm_equity_min : null,
      rasio.csm_equity != null ? (rasio.csm_equity >= THRESHOLD.csm_equity_min ? 'Memenuhi' : 'Buffer CSM tipis') : 'Data tidak tersedia'))
    items.push(item('ISR Margin (Jiwa)', rasio.ism_margin, `>= ${(THRESHOLD.ism_margin_min * 100).toFixed(0)}%`,
      rasio.ism_margin != null ? rasio.ism_margin >= THRESHOLD.ism_margin_min : null,
      rasio.ism_margin != null ? (rasio.ism_margin >= THRESHOLD.ism_margin_min ? 'Memenuhi' : 'Margin jasa asuransi tipis') : 'Data tidak tersedia'))
    items.push(item('Investasi / Total Aset (Jiwa)', rasio.investment_ratio, `>= ${(THRESHOLD.investment_ratio_min * 100).toFixed(0)}%`,
      rasio.investment_ratio != null ? rasio.investment_ratio >= THRESHOLD.investment_ratio_min : null,
      rasio.investment_ratio != null ? (rasio.investment_ratio >= THRESHOLD.investment_ratio_min ? 'Memenuhi' : 'Porsi investasi rendah') : 'Data tidak tersedia'))
    items.push(item('FVOCI Reserve / Ekuitas (Jiwa)', rasio.fvoci_equity, `<= ${(THRESHOLD.fvoci_equity_max * 100).toFixed(0)}%`,
      rasio.fvoci_equity != null ? rasio.fvoci_equity <= THRESHOLD.fvoci_equity_max : null,
      rasio.fvoci_equity != null ? (rasio.fvoci_equity <= THRESHOLD.fvoci_equity_max ? 'Memenuhi' : 'Risiko OCI volatilitas tinggi') : 'Data tidak tersedia'))
  }

  items.push(item('CSM Growth', rasio.csm_growth, `>= ${(THRESHOLD.csm_growth_min * 100).toFixed(0)}%`,
    rasio.csm_growth != null ? rasio.csm_growth >= THRESHOLD.csm_growth_min : null,
    rasio.csm_growth != null ? (rasio.csm_growth >= THRESHOLD.csm_growth_min ? 'CSM tumbuh / stabil' : 'CSM menyusut') : 'Data tidak tersedia'))

  items.push(item('CSM Release Ratio', rasio.csm_release_ratio, `>= ${(THRESHOLD.csm_release_ratio_min * 100).toFixed(0)}%`,
    rasio.csm_release_ratio != null ? rasio.csm_release_ratio >= THRESHOLD.csm_release_ratio_min : null,
    rasio.csm_release_ratio != null ? (rasio.csm_release_ratio >= THRESHOLD.csm_release_ratio_min ? 'Memenuhi' : 'Amortisasi CSM sangat lambat') : 'Data tidak tersedia'))

  items.push(item('Perubahan RA (RA t/RA t-1)', rasio.ra_change, `<= ${THRESHOLD.ra_change_max}x`,
    rasio.ra_change != null ? rasio.ra_change <= THRESHOLD.ra_change_max : null,
    rasio.ra_change != null ? (rasio.ra_change <= THRESHOLD.ra_change_max ? 'Memenuhi' : 'Risk Adjustment meningkat signifikan') : 'Data tidak tersedia'))

  items.push(item('Loss Component Weight', rasio.loss_component_weight, `<= ${(THRESHOLD.loss_component_weight_max * 100).toFixed(0)}%`,
    rasio.loss_component_weight != null ? rasio.loss_component_weight <= THRESHOLD.loss_component_weight_max : null,
    rasio.loss_component_weight != null ? (rasio.loss_component_weight <= THRESHOLD.loss_component_weight_max ? 'Memenuhi' : 'Proporsi kontrak onerosa tinggi') : 'Data tidak tersedia'))

  items.push(item('ECL Coverage', rasio.ecl_coverage, `>= ${(THRESHOLD.ecl_coverage_min * 100).toFixed(2)}%`,
    rasio.ecl_coverage != null ? rasio.ecl_coverage >= THRESHOLD.ecl_coverage_min : null,
    rasio.ecl_coverage != null ? (rasio.ecl_coverage >= THRESHOLD.ecl_coverage_min ? 'Memenuhi' : 'Penyisihan ECL kurang') : 'Data tidak tersedia'))

  items.push(item('Stage 2+3 Ratio', rasio.stage2_3_ratio, `<= ${(THRESHOLD.stage2_3_ratio_max * 100).toFixed(0)}%`,
    rasio.stage2_3_ratio != null ? rasio.stage2_3_ratio <= THRESHOLD.stage2_3_ratio_max : null,
    rasio.stage2_3_ratio != null ? (rasio.stage2_3_ratio <= THRESHOLD.stage2_3_ratio_max ? 'Memenuhi' : 'Kualitas aset turun') : 'Data tidak tersedia'))

  items.push(item('OCF / Profit (Kualitas Laba)', rasio.ocf_profit, `>= ${(THRESHOLD.ocf_profit_min * 100).toFixed(0)}%`,
    rasio.ocf_profit != null ? rasio.ocf_profit >= THRESHOLD.ocf_profit_min : null,
    rasio.ocf_profit != null ? (rasio.ocf_profit >= THRESHOLD.ocf_profit_min ? 'Memenuhi' : 'Kualitas laba lemah') : 'Data tidak tersedia'))

  return items
}

export function hitungSkor(scorecard: ScorecardItem[]): { skor: number; total: number; rating: string } {
  const valid = scorecard.filter(s => s.pass !== null)
  const skor = valid.reduce((acc, s) => acc + s.poin, 0)
  const total = valid.length
  const pct = total > 0 ? skor / total : 0
  const rating = pct >= 0.875 ? 'Baik' : pct >= 0.625 ? 'Cukup' : pct >= 0.375 ? 'Kurang' : 'Buruk'
  return { skor, total, rating }
}

export function formatNilai(nilai: number | null, threshold: string): string {
  if (nilai == null) return 'N/A'
  // If threshold contains 'x' or value >= 10, show as multiplier
  if (threshold.includes('x') || Math.abs(nilai) >= 5) return nilai.toFixed(2) + 'x'
  return (nilai * 100).toFixed(2) + '%'
}
