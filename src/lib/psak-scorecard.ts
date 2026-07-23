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

  function item(metric: string, formula: string, nilai: number | null, format: 'pct' | 'x' | 'num'): RasioItem {
    return { metric, formula, nilai, format }
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
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

  const insLiab = cy('SFP_INS_LIAB') ?? cy('I17_INS_LIAB')
  const reinsAsset = cy('SFP_REINS_ASSET') ?? cy('I17_REINS_ASSET')
  const kas = cy('SFP_CASH')
  const fvociRes = cy('SFP_FVOCI_RES') ?? cy('I9_FVOCI_RES')

  // Profit = sum of all P&L lines (requires at least 4 lines to be meaningful)
  const plKeys = [
    'PL_INS_REV', 'PL_INS_EXP', 'PL_REINS_NET', 'PL_INV_RES', 'PL_IF_FIN',
    'PL_REINS_FIN', 'PL_IMPAIR', 'PL_FEE_OTHER', 'PL_OPEX', 'PL_OTHER_NONOP', 'PL_TAX',
  ]
  const plVals = plKeys.map(k => cy(k)).filter((x): x is number => x != null)
  const profit = plVals.length >= 4 ? plVals.reduce((a, b) => a + b, 0) : null

  // ISR: use direct value from Excel if available, else compute from P&L lines
  const isrDirect = cy('I17_ISR')
  const isrComputed = (() => {
    const rev = cy('PL_INS_REV')
    if (rev == null) return null
    return rev + (cy('PL_INS_EXP') ?? 0) + (cy('PL_REINS_NET') ?? 0)
  })()
  const isr = isrDirect ?? isrComputed
  const insRev = cy('PL_INS_REV')

  // Expense ratio: (acquisition CF amortisation + other UW expenses) / insurance revenue
  const aclCF = cy('I17_ACQ_CF')
  const uwExp = cy('I17_UW_EXP')
  const expenseRatio = (aclCF != null || uwExp != null) && insRev
    ? Math.abs((aclCF ?? 0) + (uwExp ?? 0)) / insRev
    : null

  // Investasi (for Jiwa portofolio indicator)
  const investasiTotal = sum('SFP_MM', 'SFP_FVTPL', 'SFP_FVOCI_DEBT', 'SFP_FVOCI_EQ', 'SFP_AC', 'SFP_INVPROP')
  const inv9Total = sum('I9_FVTPL', 'I9_FVOCI_DEBT', 'I9_FVOCI_EQ', 'I9_AC', 'I9_LOANS')

  // ECL: Stage 1 only (companies rarely fill stage 2+3)
  const eclS1Allow = cy('I9_S1_ALLOW')
  // Denominator = total financial assets with ECL (use I9 totals or investasi total as fallback)
  const eclBase = inv9Total ?? investasiTotal
  const eclCoverage = ratio(eclS1Allow, eclBase)

  // CSM
  const csmOpen = cy('I17_CSM_OPEN')
  const csmClose = cy('I17_CSM_CLOSE')
  const csmRelease = cy('I17_CSM_RELEASE')

  // RA: RA_OPEN = saldo awal, I17_RA = saldo akhir
  const raOpen = cy('I17_RA_OPEN')
  const raClose = cy('I17_RA')
  const perubahanRA = ratio(raClose, raOpen)

  const lossComp = cy('I17_LOSS_COMP')
  const ocf = cy('CF_OP')

  // ── ASURANSI UMUM ─────────────────────────────────────────────────────────
  if (jenis === 'Umum') {
    return [
      {
        title: 'Profitabilitas',
        items: [
          item('ROA', 'Profit / Total Aset', ratio(profit, totalAset), 'pct'),
          item('ROE', 'Profit / Total Ekuitas', ratio(profit, totalEkuitas), 'pct'),
        ],
      },
      {
        title: 'Underwriting',
        items: [
          item('Expense Ratio', '|Biaya Akuisisi + Biaya UW| / Pendapatan Asuransi', expenseRatio, 'pct'),
        ],
      },
      {
        title: 'Reasuransi',
        items: [
          item('Reinsurance Asset / Ekuitas', 'Aset Kontrak Reasuransi / Ekuitas', ratio(reinsAsset, totalEkuitas), 'x'),
        ],
      },
      {
        title: 'Likuiditas',
        items: [
          item('Cash / Total Liabilitas', 'Kas & Setara Kas / Total Liabilitas', ratio(kas, totalLiab), 'pct'),
        ],
      },
      {
        title: 'Arus Kas',
        items: [
          item('OCF / Profit', 'Arus Kas Operasi / Profit', ratio(ocf, profit), 'x'),
        ],
      },
      {
        title: 'IFRS 9 — Kualitas Aset Keuangan',
        items: [
          item('ECL Coverage', 'Cadangan ECL Stage 1 / Total Aset Investasi', eclCoverage, 'pct'),
        ],
      },
      {
        title: 'IFRS 17 — Kinerja & Struktur Kontrak',
        items: [
          item('CSM Growth', 'CSM Saldo Akhir / CSM Saldo Awal', ratio(csmClose, csmOpen), 'x'),
          item('CSM Release', 'CSM Dirilis / CSM Saldo Awal', ratio(csmRelease, csmOpen), 'pct'),
          item('Perubahan RA', 'RA Tahun Ini / RA Tahun Lalu', perubahanRA, 'x'),
          item('Loss Component Weight', 'Loss Component / Liab. Kontrak Asuransi',
            lossComp != null && insLiab ? Math.abs(lossComp) / insLiab : null, 'pct'),
        ],
      },
    ]
  }

  // ── ASURANSI JIWA ─────────────────────────────────────────────────────────
  return [
    {
      title: 'Profitabilitas',
      items: [
        item('ROA', 'Profit / Total Aset', ratio(profit, totalAset), 'pct'),
        item('ROE', 'Profit / Total Ekuitas', ratio(profit, totalEkuitas), 'pct'),
      ],
    },
    {
      title: 'Margin',
      items: [
        item('ISR Margin', 'Insurance Service Result / Pendapatan Asuransi', ratio(isr, insRev), 'pct'),
      ],
    },
    {
      title: 'Likuiditas',
      items: [
        item('Cash / Total Liabilitas', 'Kas & Setara Kas / Total Liabilitas', ratio(kas, totalLiab), 'pct'),
      ],
    },
    {
      title: 'Portofolio Investasi',
      items: [
        item('Aset Investasi / Total Aset',
          '(FVTPL + FVOCI + AC) / Total Aset',
          ratio(inv9Total ?? investasiTotal, totalAset), 'pct'),
      ],
    },
    {
      title: 'IFRS 17 — Struktur Liabilitas & CSM',
      items: [
        item('Liab. Kontrak Asuransi / Ekuitas', 'Liab. Kontrak Asuransi / Ekuitas', ratio(insLiab, totalEkuitas), 'x'),
        item('CSM Growth', 'CSM Saldo Akhir / CSM Saldo Awal', ratio(csmClose, csmOpen), 'x'),
        item('CSM Release', 'CSM Dirilis / CSM Saldo Awal', ratio(csmRelease, csmOpen), 'pct'),
        item('Perubahan RA', 'RA Tahun Ini / RA Tahun Lalu', perubahanRA, 'x'),
      ],
    },
    {
      title: 'IFRS 9 — Kualitas Aset Keuangan',
      items: [
        item('ECL Coverage', 'Cadangan ECL Stage 1 / Total Aset Investasi', eclCoverage, 'pct'),
        item('FVOCI Reserve / Ekuitas', 'Cadangan FVOCI / Ekuitas', ratio(fvociRes, totalEkuitas), 'pct'),
      ],
    },
    {
      title: 'Arus Kas',
      items: [
        item('OCF / Profit', 'Arus Kas Operasi / Profit', ratio(ocf, profit), 'x'),
      ],
    },
  ]
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
  risk_adjustment_perubahan?: number
  ecl_total?: number
  ecl_base?: number
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

  const isrDirect = cy('I17_ISR')
  const isrComputed = (() => {
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
    insurance_service_result: (isrDirect ?? isrComputed) ?? undefined,
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
    risk_adjustment_perubahan: cy('I17_RA_CHANGE') ?? undefined,
    ecl_total: cy('I9_S1_ALLOW') ?? undefined,
    ecl_base: sumKeys('I9_FVTPL','I9_FVOCI_DEBT','I9_FVOCI_EQ','I9_AC','I9_LOANS') ?? undefined,
    arus_kas_operasi: cy('CF_OP') ?? undefined,
  }
}

export function formatRasio(nilai: number | null, format: 'pct' | 'x' | 'num'): string {
  if (nilai == null) return 'N/A'
  if (format === 'pct') return (nilai * 100).toFixed(2) + '%'
  if (format === 'x') return nilai.toFixed(2) + 'x'
  return nilai.toLocaleString('id-ID')
}
