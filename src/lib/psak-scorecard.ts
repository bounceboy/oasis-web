// Pure calculation functions — no server imports, safe for client components
import type { TemplateData, JenisUsaha } from './psak-template-structure'

export type { JenisUsaha }

export interface RasioItem {
  metric: string
  formula: string
  nilai: number | null
  format: 'pct' | 'x' | 'num'
}

export interface RasioGroup {
  title: string
  jiwaOnly?: boolean
  items: RasioItem[]
}

export function buildRasioGroups(td: TemplateData, jenis: JenisUsaha): RasioGroup[] {
  const val = td.values
  const cy = (key: string): number | null => val[key]?.CY ?? null

  function sum(...keys: string[]): number | null {
    const nums = keys.map(k => cy(k)).filter((x): x is number => x != null)
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null
  }

  function ratio(num: number | null, den: number | null): number | null {
    if (num == null || den == null || den === 0) return null
    return num / den
  }

  // ── Computed aggregates ───────────────────────────────────────────────────
  const totalAset = sum(
    'SFP_CASH', 'SFP_MM', 'SFP_FVTPL', 'SFP_FVOCI_DEBT', 'SFP_FVOCI_EQ',
    'SFP_AC', 'SFP_INVPROP', 'SFP_RECEIV', 'SFP_UNDERWRITING_OTHER',
    'SFP_REINS_ASSET', 'SFP_ACQASSET', 'SFP_PPE', 'SFP_INTANG',
    'SFP_TAX_ASSET', 'SFP_OTHER',
  )

  const totalLiab = sum(
    'SFP_INS_LIAB', 'SFP_REINS_LIAB', 'SFP_INVEST_LIAB', 'SFP_PAYABLES',
    'SFP_TAX_LIAB', 'SFP_LEASE_DEBT', 'SFP_OTHER_LIAB', 'SFP_FUNDS',
  )

  const totalEkuitas = sum(
    'SFP_SHARECAP', 'SFP_APIC', 'SFP_RETAINED',
    'SFP_FVOCI_RES', 'SFP_IFOCI_RES', 'SFP_OTHER_RES',
  )

  const investasiTotal = sum(
    'SFP_MM', 'SFP_FVTPL', 'SFP_FVOCI_DEBT', 'SFP_FVOCI_EQ', 'SFP_AC', 'SFP_INVPROP',
  )

  const plKeys = [
    'PL_INS_REV', 'PL_INS_EXP', 'PL_REINS_NET', 'PL_INV_RES', 'PL_IF_FIN',
    'PL_REINS_FIN', 'PL_IMPAIR', 'PL_FEE_OTHER', 'PL_OPEX', 'PL_OTHER_NONOP', 'PL_TAX',
  ]
  const plVals = plKeys.map(k => cy(k)).filter((x): x is number => x != null)
  const profit = plVals.length >= 4 ? plVals.reduce((a, b) => a + b, 0) : null

  // ISR = Insurance Revenue + Service Expense + Net Reins
  const isr = (() => {
    const rev = cy('PL_INS_REV')
    if (rev == null) return null
    return (cy('PL_INS_REV') ?? 0) + (cy('PL_INS_EXP') ?? 0) + (cy('PL_REINS_NET') ?? 0)
  })()

  const insRev = cy('PL_INS_REV')
  const kas = cy('SFP_CASH')
  const insLiab = cy('SFP_INS_LIAB') ?? cy('I17_INS_LIAB')
  const reinsAsset = cy('SFP_REINS_ASSET') ?? cy('I17_REINS_ASSET')
  const fvociRes = cy('SFP_FVOCI_RES') ?? cy('I9_FVOCI_RES')

  const gwp = cy('I17_GWP')
  const nwp = cy('I17_NWP')
  const retensi = ratio(nwp, gwp)
  const cessi = retensi != null ? 1 - retensi : null

  const lrc = cy('I17_LRC')
  const lic = cy('I17_LIC')
  const lossComp = cy('I17_LOSS_COMP')
  const ra = cy('I17_RA')
  const ocr = cy('I17_OCR')
  const ibnr = cy('I17_IBNR')
  const cedRes = cy('I17_CEDED_RES')

  const s1exp = cy('I9_S1_EXP')
  const s2exp = cy('I9_S2_EXP')
  const s3exp = cy('I9_S3_EXP')
  const totalExp = sum('I9_S1_EXP', 'I9_S2_EXP', 'I9_S3_EXP')
  const stage23 = sum('I9_S2_EXP', 'I9_S3_EXP')
  const totalAllow = sum('I9_S1_ALLOW', 'I9_S2_ALLOW', 'I9_S3_ALLOW')

  const fvtpl9 = cy('I9_FVTPL')
  const fvociDebt9 = cy('I9_FVOCI_DEBT')
  const fvociEq9 = cy('I9_FVOCI_EQ')
  const ac9 = cy('I9_AC')
  const inv9Total = sum('I9_FVTPL', 'I9_FVOCI_DEBT', 'I9_FVOCI_EQ', 'I9_AC', 'I9_LOANS')

  const csmOpen = cy('I17_CSM_OPEN')
  const csmClose = cy('I17_CSM_CLOSE')
  const csmRelease = cy('I17_CSM_RELEASE')
  const raOpen = cy('I17_RA_OPEN')
  const aclCF = cy('I17_ACQ_CF')
  const uwExp = cy('I17_UW_EXP')

  function item(metric: string, formula: string, nilai: number | null, format: 'pct' | 'x' | 'num'): RasioItem {
    return { metric, formula, nilai, format }
  }

  // ── Groups ────────────────────────────────────────────────────────────────
  const groups: RasioGroup[] = [

    {
      title: 'Keuangan Umum',
      items: [
        item('ROE', 'Profit / Ekuitas', ratio(profit, totalEkuitas), 'pct'),
        item('ROA', 'Profit / Total Aset', ratio(profit, totalAset), 'pct'),
        item('Leverage', 'Total Liabilitas / Ekuitas', ratio(totalLiab, totalEkuitas), 'x'),
        item('Likuiditas (Kas)', 'Kas / Total Liabilitas', ratio(kas, totalLiab), 'pct'),
        item('Investasi / Total Aset', 'Total Investasi / Total Aset', ratio(investasiTotal, totalAset), 'pct'),
        item('Liab. Kontrak Asuransi / Total Aset', 'Liab. Kontrak Asuransi / Total Aset', ratio(insLiab, totalAset), 'pct'),
        item('Aset Reasuransi / Ekuitas', 'Aset Kontrak Reasuransi / Ekuitas', ratio(reinsAsset, totalEkuitas), 'x'),
        item('FVOCI Reserve / Ekuitas', 'Cadangan FVOCI / Ekuitas', ratio(fvociRes, totalEkuitas), 'pct'),
      ],
    },

    {
      title: 'PSAK 117 — Kinerja Underwriting',
      items: [
        item('ISR Margin', 'ISR / Insurance Revenue', ratio(isr, insRev), 'pct'),
        item('Expense Ratio', '|Akuisisi + UW| / Insurance Revenue',
          (aclCF != null || uwExp != null) && insRev
            ? Math.abs((aclCF ?? 0) + (uwExp ?? 0)) / insRev
            : null,
          'pct',
        ),
        item('Retensi', 'NWP / GWP', retensi, 'pct'),
        item('Cessi', '1 − NWP/GWP', cessi, 'pct'),
        item('Investment Yield', 'Hasil Investasi / Total Investasi', ratio(cy('PL_INV_RES'), investasiTotal), 'pct'),
        item('OCF / Profit', 'Arus Kas Operasi / Profit', ratio(cy('CF_OP'), profit), 'pct'),
        item('Gross Claims / Insurance Revenue', 'Gross Claims / Insurance Revenue',
          ratio(cy('I17_GROSS_CLAIMS'), insRev), 'pct'),
        item('Reins Recovery / Insurance Revenue', 'Reins Recoveries / Insurance Revenue',
          ratio(cy('I17_REINS_RECOV'), insRev), 'pct'),
      ],
    },

    {
      title: 'PSAK 117 — Struktur Liabilitas',
      items: [
        item('LRC / Liab. Kontrak Asuransi', 'LRC / Total Liab. Kontrak', ratio(lrc, insLiab), 'pct'),
        item('LIC / Liab. Kontrak Asuransi', 'LIC / Total Liab. Kontrak', ratio(lic, insLiab), 'pct'),
        item('Loss Component / Liab. Kontrak', 'Loss Component / Total Liab. Kontrak',
          lossComp != null && insLiab ? Math.abs(lossComp) / insLiab : null, 'pct'),
        item('Risk Adjustment / LIC', 'RA / LIC', ratio(ra, lic), 'pct'),
        item('IBNR / (OCR + IBNR)', 'IBNR / (OCR + IBNR)',
          (ocr != null || ibnr != null)
            ? ratio(ibnr, (ocr ?? 0) + (ibnr ?? 0))
            : null,
          'pct',
        ),
        item('Ceded Reserves / Liab. Kontrak', 'Ceded Share / Total Liab. Kontrak', ratio(cedRes, insLiab), 'pct'),
      ],
    },

    {
      title: 'PSAK 117 — CSM (Asuransi Jiwa)',
      jiwaOnly: true,
      items: [
        item('CSM Akhir / Ekuitas', 'CSM Close / Ekuitas', ratio(csmClose, totalEkuitas), 'pct'),
        item('CSM Growth', 'CSM Akhir / CSM Awal', ratio(csmClose, csmOpen), 'x'),
        item('CSM Release Ratio', 'CSM Release / CSM Awal', ratio(csmRelease, csmOpen), 'pct'),
        item('RA Change', 'RA Akhir / RA Awal', ratio(ra, raOpen), 'x'),
      ],
    },

    {
      title: 'PSAK 109 — Kualitas Aset Keuangan',
      items: [
        item('FVTPL / Total Investasi', 'FVTPL / Total Investasi (I9)',
          ratio(fvtpl9, inv9Total ?? investasiTotal), 'pct'),
        item('FVOCI / Total Investasi', '(FVOCI Debt + Equity) / Total Investasi',
          (fvociDebt9 != null || fvociEq9 != null)
            ? ratio((fvociDebt9 ?? 0) + (fvociEq9 ?? 0), inv9Total ?? investasiTotal)
            : null,
          'pct',
        ),
        item('AC / Total Investasi', 'Amortised Cost / Total Investasi',
          ratio(ac9, inv9Total ?? investasiTotal), 'pct'),
        item('ECL Coverage', 'Total ECL Allowance / Total Gross Exposure',
          ratio(totalAllow, totalExp), 'pct'),
        item('Stage 2+3 Ratio', '(Stage 2 + Stage 3 Exp) / Total Exp',
          ratio(stage23, totalExp), 'pct'),
        item('Write-off Ratio', 'Write-offs / Total Exposure',
          ratio(cy('I9_WRITEOFF'), totalExp), 'pct'),
      ],
    },

  ]

  // Filter jiwaOnly groups based on jenis
  return groups.filter(g => !g.jiwaOnly || jenis === 'Jiwa')
}

// ── DataKeuangan helper (used by Data Lengkap tab) ──────────────────────────
export interface DataKeuangan {
  total_aset?: number
  total_liabilitas?: number
  total_ekuitas?: number
  kas?: number
  investasi_total?: number
  liabilitas_kontrak_asuransi?: number
  aset_kontrak_reasuransi?: number
  pendapatan_asuransi?: number
  beban_jasa_asuransi?: number
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
  ecl_total?: number
  ecl_base?: number
  stage2_3_exposure?: number
  stage_total_exposure?: number
  arus_kas_operasi?: number
}

export function templateDataToDataKeuangan(td: TemplateData): DataKeuangan {
  const val = td.values
  const cy = (key: string): number | null => val[key]?.CY ?? null
  function sumKeys(...keys: string[]): number | null {
    const nums = keys.map(k => cy(k)).filter((x): x is number => x != null)
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null
  }
  const totalAset = sumKeys('SFP_CASH','SFP_MM','SFP_FVTPL','SFP_FVOCI_DEBT','SFP_FVOCI_EQ',
    'SFP_AC','SFP_INVPROP','SFP_RECEIV','SFP_UNDERWRITING_OTHER','SFP_REINS_ASSET',
    'SFP_ACQASSET','SFP_PPE','SFP_INTANG','SFP_TAX_ASSET','SFP_OTHER')
  const totalLiab = sumKeys('SFP_INS_LIAB','SFP_REINS_LIAB','SFP_INVEST_LIAB','SFP_PAYABLES',
    'SFP_TAX_LIAB','SFP_LEASE_DEBT','SFP_OTHER_LIAB','SFP_FUNDS')
  const totalEkuitas = sumKeys('SFP_SHARECAP','SFP_APIC','SFP_RETAINED','SFP_FVOCI_RES','SFP_IFOCI_RES','SFP_OTHER_RES')
  const plKeys = ['PL_INS_REV','PL_INS_EXP','PL_REINS_NET','PL_INV_RES','PL_IF_FIN',
    'PL_REINS_FIN','PL_IMPAIR','PL_FEE_OTHER','PL_OPEX','PL_OTHER_NONOP','PL_TAX']
  const plVals = plKeys.map(k => cy(k)).filter((x): x is number => x != null)
  const profit = plVals.length >= 4 ? plVals.reduce((a, b) => a + b, 0) : null
  const isr = (() => {
    const rev = cy('PL_INS_REV'); if (rev == null) return null
    return rev + (cy('PL_INS_EXP') ?? 0) + (cy('PL_REINS_NET') ?? 0)
  })()
  return {
    total_aset: totalAset ?? undefined,
    total_liabilitas: totalLiab ?? undefined,
    total_ekuitas: totalEkuitas ?? undefined,
    kas: cy('SFP_CASH') ?? undefined,
    investasi_total: sumKeys('SFP_MM','SFP_FVTPL','SFP_FVOCI_DEBT','SFP_FVOCI_EQ','SFP_AC','SFP_INVPROP') ?? undefined,
    liabilitas_kontrak_asuransi: (cy('SFP_INS_LIAB') ?? cy('I17_INS_LIAB')) ?? undefined,
    aset_kontrak_reasuransi: (cy('SFP_REINS_ASSET') ?? cy('I17_REINS_ASSET')) ?? undefined,
    pendapatan_asuransi: cy('PL_INS_REV') ?? undefined,
    beban_jasa_asuransi: cy('PL_INS_EXP') ?? undefined,
    klaim_dan_manfaat: cy('I17_GROSS_CLAIMS') ?? undefined,
    insurance_service_result: isr ?? undefined,
    hasil_investasi: cy('PL_INV_RES') ?? undefined,
    profit_tahun_berjalan: profit ?? undefined,
    csm_penutup: cy('I17_CSM_CLOSE') ?? undefined,
    csm_pembuka: cy('I17_CSM_OPEN') ?? undefined,
    csm_release: cy('I17_CSM_RELEASE') ?? undefined,
    lrc: cy('I17_LRC') ?? undefined,
    lic: cy('I17_LIC') ?? undefined,
    loss_component: cy('I17_LOSS_COMP') ?? undefined,
    risk_adjustment: cy('I17_RA') ?? undefined,
    risk_adjustment_pembuka: cy('I17_RA_OPEN') ?? undefined,
    ecl_total: sumKeys('I9_S1_ALLOW','I9_S2_ALLOW','I9_S3_ALLOW') ?? undefined,
    ecl_base: sumKeys('I9_S1_EXP','I9_S2_EXP','I9_S3_EXP') ?? undefined,
    stage2_3_exposure: sumKeys('I9_S2_EXP','I9_S3_EXP') ?? undefined,
    stage_total_exposure: sumKeys('I9_S1_EXP','I9_S2_EXP','I9_S3_EXP') ?? undefined,
    arus_kas_operasi: cy('CF_OP') ?? undefined,
  }
}

export function formatRasio(nilai: number | null, format: 'pct' | 'x' | 'num'): string {
  if (nilai == null) return 'N/A'
  if (format === 'pct') return (nilai * 100).toFixed(2) + '%'
  if (format === 'x') return nilai.toFixed(2) + 'x'
  return nilai.toLocaleString('id-ID')
}
