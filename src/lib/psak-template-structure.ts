// Definisi struktur template PSAK (Umum & Jiwa)
// Digunakan untuk memandu AI saat ekstraksi dan untuk mengisi Excel

export type JenisUsaha = 'Jiwa' | 'Umum'

// Field keys per sheet — sama antara Template dan V5
export const SFP_FIELDS = [
  { key: 'SFP_CASH',              label_id: 'Kas dan setara kas',                           label_en: 'Cash and bank' },
  { key: 'SFP_MM',                label_id: 'Penempatan jangka pendek / pasar uang',        label_en: 'Short-term deposits / placements' },
  { key: 'SFP_FVTPL',            label_id: 'Investasi pada FVTPL',                          label_en: 'Investments at FVTPL' },
  { key: 'SFP_FVOCI_DEBT',       label_id: 'Investasi utang pada FVOCI',                    label_en: 'Debt investments at FVOCI' },
  { key: 'SFP_FVOCI_EQ',         label_id: 'Investasi ekuitas pada FVOCI',                  label_en: 'Equity investments at FVOCI' },
  { key: 'SFP_AC',               label_id: 'Investasi pada biaya perolehan diamortisasi',   label_en: 'Investments at amortised cost' },
  { key: 'SFP_INVPROP',          label_id: 'Properti investasi',                            label_en: 'Investment property' },
  { key: 'SFP_RECEIV',           label_id: 'Piutang premi, klaim, reasuransi, dan lain-lain', label_en: 'Premium/reinsurance/other receivables' },
  { key: 'SFP_UNDERWRITING_OTHER', label_id: 'Aset klaim / salvage / subrogasi',            label_en: 'Underwriting other assets / salvage / subrogation' },
  { key: 'SFP_REINS_ASSET',      label_id: 'Aset kontrak reasuransi',                       label_en: 'Reinsurance contract assets' },
  { key: 'SFP_ACQASSET',         label_id: 'Aset akuisisi asuransi / DAC',                  label_en: 'Acquisition cash flow asset / DAC' },
  { key: 'SFP_PPE',              label_id: 'Aset tetap, ROU, dan properti sendiri',         label_en: 'Fixed assets and ROU assets' },
  { key: 'SFP_INTANG',           label_id: 'Aset takberwujud',                              label_en: 'Intangible assets' },
  { key: 'SFP_TAX_ASSET',        label_id: 'Aset pajak kini / deferred tax asset',          label_en: 'Tax asset' },
  { key: 'SFP_OTHER',            label_id: 'Aset lain-lain',                                label_en: 'Other assets' },
  { key: 'SFP_INS_LIAB',         label_id: 'Liabilitas kontrak asuransi',                   label_en: 'Insurance contract liabilities' },
  { key: 'SFP_REINS_LIAB',       label_id: 'Liabilitas kontrak reasuransi',                 label_en: 'Reinsurance contract liabilities' },
  { key: 'SFP_INVEST_LIAB',      label_id: 'Liabilitas komponen investasi',                 label_en: 'Investment/deposit liabilities' },
  { key: 'SFP_PAYABLES',         label_id: 'Utang klaim, reasuransi, komisi, dan broker',   label_en: 'Claims/commission/broker/reinsurance payables' },
  { key: 'SFP_TAX_LIAB',         label_id: 'Utang pajak kini / deferred tax liability',     label_en: 'Tax liabilities' },
  { key: 'SFP_LEASE_DEBT',       label_id: 'Liabilitas sewa dan pinjaman',                  label_en: 'Lease and borrowing liabilities' },
  { key: 'SFP_OTHER_LIAB',       label_id: 'Liabilitas lain-lain',                          label_en: 'Other liabilities' },
  { key: 'SFP_FUNDS',            label_id: 'Dana tabarru / dana peserta (syariah)',          label_en: "Tabarru' / participant fund (if any)" },
  { key: 'SFP_SHARECAP',         label_id: 'Modal saham',                                   label_en: 'Share capital' },
  { key: 'SFP_APIC',             label_id: 'Tambahan modal disetor',                        label_en: 'Additional paid-in capital' },
  { key: 'SFP_RETAINED',         label_id: 'Saldo laba',                                    label_en: 'Retained earnings' },
  { key: 'SFP_FVOCI_RES',        label_id: 'Cadangan FVOCI / fair value reserve',           label_en: 'FVOCI reserve' },
  { key: 'SFP_IFOCI_RES',        label_id: 'Cadangan insurance finance OCI',                label_en: 'Insurance finance OCI reserve' },
  { key: 'SFP_OTHER_RES',        label_id: 'Cadangan OCI dan cadangan lain-lain',           label_en: 'Other OCI / other reserves' },
]

export const PL_FIELDS = [
  { key: 'PL_INS_REV',           label_id: 'Insurance revenue / pendapatan asuransi',       label_en: 'Insurance revenue' },
  { key: 'PL_INS_EXP',           label_id: 'Insurance service expense / beban jasa asuransi', label_en: 'Insurance service expense' },
  { key: 'PL_REINS_NET',         label_id: 'Hasil neto kontrak reasuransi',                 label_en: 'Net reinsurance result' },
  { key: 'PL_INV_RES',           label_id: 'Hasil investasi / investment result',            label_en: 'Investment result' },
  { key: 'PL_IF_FIN',            label_id: 'Insurance finance income/(expense) - kontrak diterbitkan', label_en: 'Insurance finance result - issued' },
  { key: 'PL_REINS_FIN',         label_id: 'Insurance finance income/(expense) - reasuransi', label_en: 'Insurance finance result - reinsurance' },
  { key: 'PL_IMPAIR',            label_id: 'Impairment / ECL pada aset keuangan',           label_en: 'Impairment / ECL on financial assets' },
  { key: 'PL_FEE_OTHER',         label_id: 'Fee, brokerage, dan pendapatan lain-lain',      label_en: 'Fees / brokerage / other income' },
  { key: 'PL_OPEX',              label_id: 'Beban operasional di luar beban jasa asuransi', label_en: 'Operating expenses outside service expense' },
  { key: 'PL_OTHER_NONOP',       label_id: 'Item non-operasional lain-lain',                label_en: 'Other non-operating items' },
  { key: 'PL_TAX',               label_id: 'Beban pajak penghasilan',                       label_en: 'Income tax expense' },
  { key: 'OCI_FVOCI',            label_id: 'OCI - pergerakan cadangan FVOCI',               label_en: 'FVOCI reserve movement' },
  { key: 'OCI_IFOCI',            label_id: 'OCI - insurance finance OCI',                   label_en: 'Insurance finance OCI' },
  { key: 'OCI_OTHER',            label_id: 'OCI - lain-lain',                               label_en: 'Other OCI' },
]

export const CF_FIELDS = [
  { key: 'CF_OP',  label_id: 'Arus kas neto dari aktivitas operasi',  label_en: 'Net cash from/(used in) operating activities' },
  { key: 'CF_INV', label_id: 'Arus kas neto dari aktivitas investasi', label_en: 'Net cash from/(used in) investing activities' },
  { key: 'CF_FIN', label_id: 'Arus kas neto dari aktivitas pendanaan', label_en: 'Net cash from/(used in) financing activities' },
  { key: 'CF_BEG', label_id: 'Kas dan setara kas awal tahun',          label_en: 'Cash and cash equivalents at beginning of year' },
  { key: 'CF_END', label_id: 'Kas dan setara kas akhir tahun',         label_en: 'Cash and cash equivalents at end of year' },
]

export const IFRS17_FIELDS = [
  { key: 'I17_INS_REV',      label_id: 'Insurance revenue total',                          label_en: 'Insurance revenue total' },
  { key: 'I17_GROSS_CLAIMS', label_id: 'Gross claims incurred',                            label_en: 'Gross claims incurred' },
  { key: 'I17_REINS_RECOV',  label_id: 'Reinsurance recoveries terkait klaim',             label_en: 'Reinsurance recoveries / gains related to claims' },
  { key: 'I17_ACQ_CF',       label_id: 'Amortisasi arus kas akuisisi / komisi',            label_en: 'Acquisition cash flow amortisation / commissions' },
  { key: 'I17_UW_EXP',       label_id: 'Biaya underwriting lainnya',                      label_en: 'Other directly attributable underwriting expenses' },
  { key: 'I17_ONEROUS',      label_id: 'Kerugian kontrak merugi dan pembalikannya',        label_en: 'Losses on onerous contracts and reversals' },
  { key: 'I17_IF_FIN',       label_id: 'Insurance finance expense - kontrak diterbitkan', label_en: 'Insurance finance income/(expense) - contracts issued' },
  { key: 'I17_REINS_FIN',    label_id: 'Insurance finance expense - reasuransi',           label_en: 'Insurance finance income/(expense) - reinsurance held' },
  { key: 'I17_INS_LIAB',     label_id: 'Liabilitas kontrak asuransi (neraca)',             label_en: 'Insurance contract liabilities' },
  { key: 'I17_REINS_ASSET',  label_id: 'Aset kontrak reasuransi (neraca)',                 label_en: 'Reinsurance contract assets' },
  { key: 'I17_REINS_LIAB',   label_id: 'Liabilitas kontrak reasuransi (neraca)',           label_en: 'Reinsurance contract liabilities' },
  { key: 'I17_LRC',          label_id: 'LRC ekskl. loss component',                        label_en: 'Liability for remaining coverage (LRC) excl. loss component' },
  { key: 'I17_LIC',          label_id: 'Liability for incurred claims (LIC)',              label_en: 'Liability for incurred claims (LIC)' },
  { key: 'I17_LOSS_COMP',    label_id: 'Loss component / komponen kerugian',               label_en: 'Loss component' },
  { key: 'I17_RA',           label_id: 'Risk adjustment for non-financial risk',            label_en: 'Risk adjustment for non-financial risk' },
  { key: 'I17_OCR',          label_id: 'Outstanding claims reserve / case reserve',        label_en: 'Outstanding claims reserve / case reserve' },
  { key: 'I17_IBNR',         label_id: 'IBNR reserve',                                    label_en: 'IBNR reserve' },
  { key: 'I17_DAC',          label_id: 'Acquisition cash flow asset / DAC',               label_en: 'Acquisition cash flow asset / DAC' },
  { key: 'I17_CEDED_RES',    label_id: 'Ceded share of reserves / reinsurance recoverables', label_en: 'Ceded share of reserves / reinsurance recoverables on LIC' },
  { key: 'I17_GWP',          label_id: 'Gross written premium / GWP (management metric)', label_en: 'Gross written premium / GWP equivalent' },
  { key: 'I17_NWP',          label_id: 'Net written premium / NWP (management metric)',   label_en: 'Net written premium / NWP equivalent' },
  { key: 'I17_CSM_RELEASE',  label_id: 'CSM yang dirilis ke P/L (rekonsiliasi CSM)',      label_en: 'CSM released to P/L during the year' },
  { key: 'I17_ISR',          label_id: 'Hasil jasa asuransi / insurance service result (dari LUPLRG)', label_en: 'Insurance service result (direct from P&L)' },
  // Jiwa only
  { key: 'I17_CSM_OPEN',     label_id: 'CSM saldo awal',                                  label_en: 'CSM opening balance' },
  { key: 'I17_CSM_CLOSE',    label_id: 'CSM saldo akhir',                                 label_en: 'CSM closing balance' },
  { key: 'I17_RA_OPEN',      label_id: 'Risk adjustment saldo awal',                      label_en: 'RA opening balance' },
  { key: 'I17_PAA',          label_id: 'Nilai kontrak PAA',                               label_en: 'PAA contract liabilities' },
  { key: 'I17_VFA',          label_id: 'Nilai kontrak VFA',                               label_en: 'VFA contract liabilities' },
]

export const IFRS9_FIELDS = [
  { key: 'I9_FVTPL',         label_id: 'FVTPL carrying amount',                           label_en: 'FVTPL carrying amount' },
  { key: 'I9_FVOCI_DEBT',    label_id: 'FVOCI debt instruments carrying amount',           label_en: 'FVOCI debt instruments carrying amount' },
  { key: 'I9_FVOCI_EQ',      label_id: 'FVOCI equity instruments carrying amount',         label_en: 'FVOCI equity instruments carrying amount' },
  { key: 'I9_AC',            label_id: 'Amortised cost debt instruments carrying amount',  label_en: 'Amortised cost debt instruments carrying amount' },
  { key: 'I9_LOANS',         label_id: 'Loans and receivables carrying amount',            label_en: 'Loans and receivables carrying amount' },
  { key: 'I9_S1_EXP',        label_id: 'Stage 1 gross exposure',                          label_en: 'Stage 1 gross exposure' },
  { key: 'I9_S2_EXP',        label_id: 'Stage 2 gross exposure',                          label_en: 'Stage 2 gross exposure' },
  { key: 'I9_S3_EXP',        label_id: 'Stage 3 gross exposure',                          label_en: 'Stage 3 gross exposure' },
  { key: 'I9_S1_ALLOW',      label_id: 'Stage 1 allowance / cadangan ECL',                label_en: 'Stage 1 allowance' },
  { key: 'I9_S2_ALLOW',      label_id: 'Stage 2 allowance / cadangan ECL',                label_en: 'Stage 2 allowance' },
  { key: 'I9_S3_ALLOW',      label_id: 'Stage 3 allowance / cadangan ECL',                label_en: 'Stage 3 allowance' },
  { key: 'I9_IMPAIRED',      label_id: 'Credit-impaired exposure',                        label_en: 'Credit-impaired exposure' },
  { key: 'I9_WRITEOFF',      label_id: 'Write-offs during year',                          label_en: 'Write-offs during year' },
  { key: 'I9_FVOCI_RES',     label_id: 'FVOCI reserve closing',                           label_en: 'FVOCI reserve closing' },
  { key: 'I9_FV_PL',         label_id: 'Fair value gain/(loss) FVTPL dalam P/L',          label_en: 'Fair value gain/(loss) on FVTPL recognised in P/L' },
  { key: 'I9_INV_INC',       label_id: 'Investment income on financial assets',            label_en: 'Investment income on financial assets' },
  { key: 'I9_AVG_ASSETS',    label_id: 'Average investment assets',                       label_en: 'Average investment assets' },
]

// Mapping: field key → {sheet, row} untuk Template (Umum)
// Sheet index berbasis 1 dalam workbook
export const TEMPLATE_UMUM_MAPPING: Record<string, { sheet: string; row: number }> = {
  // Input_SFP rows 3-35 (col C=CY, D=PY1, E=PY2)
  SFP_CASH: { sheet: 'Input_SFP', row: 3 },
  SFP_MM: { sheet: 'Input_SFP', row: 4 },
  SFP_FVTPL: { sheet: 'Input_SFP', row: 5 },
  SFP_FVOCI_DEBT: { sheet: 'Input_SFP', row: 6 },
  SFP_FVOCI_EQ: { sheet: 'Input_SFP', row: 7 },
  SFP_AC: { sheet: 'Input_SFP', row: 8 },
  SFP_INVPROP: { sheet: 'Input_SFP', row: 9 },
  SFP_RECEIV: { sheet: 'Input_SFP', row: 10 },
  SFP_UNDERWRITING_OTHER: { sheet: 'Input_SFP', row: 11 },
  SFP_REINS_ASSET: { sheet: 'Input_SFP', row: 12 },
  SFP_ACQASSET: { sheet: 'Input_SFP', row: 13 },
  SFP_PPE: { sheet: 'Input_SFP', row: 14 },
  SFP_INTANG: { sheet: 'Input_SFP', row: 15 },
  SFP_TAX_ASSET: { sheet: 'Input_SFP', row: 16 },
  SFP_OTHER: { sheet: 'Input_SFP', row: 17 },
  SFP_INS_LIAB: { sheet: 'Input_SFP', row: 19 },
  SFP_REINS_LIAB: { sheet: 'Input_SFP', row: 20 },
  SFP_INVEST_LIAB: { sheet: 'Input_SFP', row: 21 },
  SFP_PAYABLES: { sheet: 'Input_SFP', row: 22 },
  SFP_TAX_LIAB: { sheet: 'Input_SFP', row: 23 },
  SFP_LEASE_DEBT: { sheet: 'Input_SFP', row: 24 },
  SFP_OTHER_LIAB: { sheet: 'Input_SFP', row: 25 },
  SFP_FUNDS: { sheet: 'Input_SFP', row: 27 },
  SFP_SHARECAP: { sheet: 'Input_SFP', row: 28 },
  SFP_APIC: { sheet: 'Input_SFP', row: 29 },
  SFP_RETAINED: { sheet: 'Input_SFP', row: 30 },
  SFP_FVOCI_RES: { sheet: 'Input_SFP', row: 31 },
  SFP_IFOCI_RES: { sheet: 'Input_SFP', row: 32 },
  SFP_OTHER_RES: { sheet: 'Input_SFP', row: 33 },
  // Input_PL_OCI rows 3-22
  PL_INS_REV: { sheet: 'Input_PL_OCI', row: 3 },
  PL_INS_EXP: { sheet: 'Input_PL_OCI', row: 4 },
  PL_REINS_NET: { sheet: 'Input_PL_OCI', row: 5 },
  PL_INV_RES: { sheet: 'Input_PL_OCI', row: 7 },
  PL_IF_FIN: { sheet: 'Input_PL_OCI', row: 8 },
  PL_REINS_FIN: { sheet: 'Input_PL_OCI', row: 9 },
  PL_IMPAIR: { sheet: 'Input_PL_OCI', row: 10 },
  PL_FEE_OTHER: { sheet: 'Input_PL_OCI', row: 11 },
  PL_OPEX: { sheet: 'Input_PL_OCI', row: 12 },
  PL_OTHER_NONOP: { sheet: 'Input_PL_OCI', row: 13 },
  PL_TAX: { sheet: 'Input_PL_OCI', row: 15 },
  OCI_FVOCI: { sheet: 'Input_PL_OCI', row: 17 },
  OCI_IFOCI: { sheet: 'Input_PL_OCI', row: 18 },
  OCI_OTHER: { sheet: 'Input_PL_OCI', row: 19 },
  // Input_CF rows 3-8
  CF_OP: { sheet: 'Input_CF', row: 3 },
  CF_INV: { sheet: 'Input_CF', row: 4 },
  CF_FIN: { sheet: 'Input_CF', row: 5 },
  CF_BEG: { sheet: 'Input_CF', row: 7 },
  CF_END: { sheet: 'Input_CF', row: 8 },
  // Input_IFRS17_Detail rows 3-32
  I17_INS_REV: { sheet: 'Input_IFRS17_Detail', row: 3 },
  I17_GROSS_CLAIMS: { sheet: 'Input_IFRS17_Detail', row: 4 },
  I17_REINS_RECOV: { sheet: 'Input_IFRS17_Detail', row: 5 },
  I17_ACQ_CF: { sheet: 'Input_IFRS17_Detail', row: 6 },
  I17_UW_EXP: { sheet: 'Input_IFRS17_Detail', row: 7 },
  I17_ONEROUS: { sheet: 'Input_IFRS17_Detail', row: 8 },
  I17_IF_FIN: { sheet: 'Input_IFRS17_Detail', row: 10 },
  I17_REINS_FIN: { sheet: 'Input_IFRS17_Detail', row: 11 },
  I17_INS_LIAB: { sheet: 'Input_IFRS17_Detail', row: 13 },
  I17_REINS_ASSET: { sheet: 'Input_IFRS17_Detail', row: 14 },
  I17_REINS_LIAB: { sheet: 'Input_IFRS17_Detail', row: 15 },
  I17_LRC: { sheet: 'Input_IFRS17_Detail', row: 16 },
  I17_LIC: { sheet: 'Input_IFRS17_Detail', row: 17 },
  I17_LOSS_COMP: { sheet: 'Input_IFRS17_Detail', row: 18 },
  I17_RA: { sheet: 'Input_IFRS17_Detail', row: 19 },
  I17_OCR: { sheet: 'Input_IFRS17_Detail', row: 20 },
  I17_IBNR: { sheet: 'Input_IFRS17_Detail', row: 21 },
  I17_DAC: { sheet: 'Input_IFRS17_Detail', row: 22 },
  I17_CEDED_RES: { sheet: 'Input_IFRS17_Detail', row: 23 },
  I17_GWP: { sheet: 'Input_IFRS17_Detail', row: 24 },
  I17_NWP: { sheet: 'Input_IFRS17_Detail', row: 25 },
  I17_CSM_RELEASE: { sheet: 'Input_IFRS17_Detail', row: 26 },
  // Input_IFRS9_Detail rows 3-26
  I9_FVTPL: { sheet: 'Input_IFRS9_Detail', row: 3 },
  I9_FVOCI_DEBT: { sheet: 'Input_IFRS9_Detail', row: 4 },
  I9_FVOCI_EQ: { sheet: 'Input_IFRS9_Detail', row: 5 },
  I9_AC: { sheet: 'Input_IFRS9_Detail', row: 6 },
  I9_LOANS: { sheet: 'Input_IFRS9_Detail', row: 7 },
  I9_S1_EXP: { sheet: 'Input_IFRS9_Detail', row: 9 },
  I9_S2_EXP: { sheet: 'Input_IFRS9_Detail', row: 10 },
  I9_S3_EXP: { sheet: 'Input_IFRS9_Detail', row: 11 },
  I9_S1_ALLOW: { sheet: 'Input_IFRS9_Detail', row: 12 },
  I9_S2_ALLOW: { sheet: 'Input_IFRS9_Detail', row: 13 },
  I9_S3_ALLOW: { sheet: 'Input_IFRS9_Detail', row: 14 },
  I9_IMPAIRED: { sheet: 'Input_IFRS9_Detail', row: 18 },
  I9_WRITEOFF: { sheet: 'Input_IFRS9_Detail', row: 19 },
  I9_FVOCI_RES: { sheet: 'Input_IFRS9_Detail', row: 21 },
  I9_FV_PL: { sheet: 'Input_IFRS9_Detail', row: 22 },
  I9_INV_INC: { sheet: 'Input_IFRS9_Detail', row: 23 },
  I9_AVG_ASSETS: { sheet: 'Input_IFRS9_Detail', row: 24 },
}

// V5 Raw_ sheet mapping (same keys, different sheets)
export const V5_UMUM_MAPPING: Record<string, { sheet: string; row: number }> = {
  SFP_CASH: { sheet: 'Raw_SFP', row: 3 },
  SFP_MM: { sheet: 'Raw_SFP', row: 4 },
  SFP_FVTPL: { sheet: 'Raw_SFP', row: 5 },
  SFP_FVOCI_DEBT: { sheet: 'Raw_SFP', row: 6 },
  SFP_FVOCI_EQ: { sheet: 'Raw_SFP', row: 7 },
  SFP_AC: { sheet: 'Raw_SFP', row: 8 },
  SFP_INVPROP: { sheet: 'Raw_SFP', row: 9 },
  SFP_RECEIV: { sheet: 'Raw_SFP', row: 10 },
  SFP_UNDERWRITING_OTHER: { sheet: 'Raw_SFP', row: 11 },
  SFP_REINS_ASSET: { sheet: 'Raw_SFP', row: 12 },
  SFP_ACQASSET: { sheet: 'Raw_SFP', row: 13 },
  SFP_PPE: { sheet: 'Raw_SFP', row: 14 },
  SFP_INTANG: { sheet: 'Raw_SFP', row: 15 },
  SFP_TAX_ASSET: { sheet: 'Raw_SFP', row: 16 },
  SFP_OTHER: { sheet: 'Raw_SFP', row: 17 },
  SFP_INS_LIAB: { sheet: 'Raw_SFP', row: 18 },
  SFP_REINS_LIAB: { sheet: 'Raw_SFP', row: 19 },
  SFP_INVEST_LIAB: { sheet: 'Raw_SFP', row: 20 },
  SFP_PAYABLES: { sheet: 'Raw_SFP', row: 21 },
  SFP_TAX_LIAB: { sheet: 'Raw_SFP', row: 22 },
  SFP_LEASE_DEBT: { sheet: 'Raw_SFP', row: 23 },
  SFP_OTHER_LIAB: { sheet: 'Raw_SFP', row: 24 },
  SFP_FUNDS: { sheet: 'Raw_SFP', row: 25 },
  SFP_SHARECAP: { sheet: 'Raw_SFP', row: 26 },
  SFP_APIC: { sheet: 'Raw_SFP', row: 27 },
  SFP_RETAINED: { sheet: 'Raw_SFP', row: 28 },
  SFP_FVOCI_RES: { sheet: 'Raw_SFP', row: 29 },
  SFP_IFOCI_RES: { sheet: 'Raw_SFP', row: 30 },
  SFP_OTHER_RES: { sheet: 'Raw_SFP', row: 31 },
  PL_INS_REV: { sheet: 'Raw_PL_OCI', row: 3 },
  PL_INS_EXP: { sheet: 'Raw_PL_OCI', row: 4 },
  PL_REINS_NET: { sheet: 'Raw_PL_OCI', row: 5 },
  PL_INV_RES: { sheet: 'Raw_PL_OCI', row: 6 },
  PL_IF_FIN: { sheet: 'Raw_PL_OCI', row: 7 },
  PL_REINS_FIN: { sheet: 'Raw_PL_OCI', row: 8 },
  PL_IMPAIR: { sheet: 'Raw_PL_OCI', row: 9 },
  PL_FEE_OTHER: { sheet: 'Raw_PL_OCI', row: 10 },
  PL_OPEX: { sheet: 'Raw_PL_OCI', row: 11 },
  PL_OTHER_NONOP: { sheet: 'Raw_PL_OCI', row: 12 },
  PL_TAX: { sheet: 'Raw_PL_OCI', row: 13 },
  OCI_FVOCI: { sheet: 'Raw_PL_OCI', row: 14 },
  OCI_IFOCI: { sheet: 'Raw_PL_OCI', row: 15 },
  OCI_OTHER: { sheet: 'Raw_PL_OCI', row: 16 },
  CF_OP: { sheet: 'Raw_CF', row: 3 },
  CF_INV: { sheet: 'Raw_CF', row: 4 },
  CF_FIN: { sheet: 'Raw_CF', row: 5 },
  CF_BEG: { sheet: 'Raw_CF', row: 7 },
  CF_END: { sheet: 'Raw_CF', row: 8 },
  I17_INS_REV: { sheet: 'Raw_IFRS17', row: 3 },
  I17_GROSS_CLAIMS: { sheet: 'Raw_IFRS17', row: 4 },
  I17_REINS_RECOV: { sheet: 'Raw_IFRS17', row: 5 },
  I17_ACQ_CF: { sheet: 'Raw_IFRS17', row: 6 },
  I17_UW_EXP: { sheet: 'Raw_IFRS17', row: 7 },
  I17_ONEROUS: { sheet: 'Raw_IFRS17', row: 8 },
  I17_IF_FIN: { sheet: 'Raw_IFRS17', row: 10 },
  I17_REINS_FIN: { sheet: 'Raw_IFRS17', row: 11 },
  I17_INS_LIAB: { sheet: 'Raw_IFRS17', row: 13 },
  I17_REINS_ASSET: { sheet: 'Raw_IFRS17', row: 14 },
  I17_REINS_LIAB: { sheet: 'Raw_IFRS17', row: 15 },
  I17_LRC: { sheet: 'Raw_IFRS17', row: 16 },
  I17_LIC: { sheet: 'Raw_IFRS17', row: 17 },
  I17_LOSS_COMP: { sheet: 'Raw_IFRS17', row: 18 },
  I17_RA: { sheet: 'Raw_IFRS17', row: 19 },
  I17_OCR: { sheet: 'Raw_IFRS17', row: 20 },
  I17_IBNR: { sheet: 'Raw_IFRS17', row: 21 },
  I17_DAC: { sheet: 'Raw_IFRS17', row: 22 },
  I17_CEDED_RES: { sheet: 'Raw_IFRS17', row: 23 },
  I17_GWP: { sheet: 'Raw_IFRS17', row: 24 },
  I17_NWP: { sheet: 'Raw_IFRS17', row: 25 },
  I17_CSM_RELEASE: { sheet: 'Raw_IFRS17', row: 26 },
  I9_FVTPL: { sheet: 'Raw_IFRS9', row: 3 },
  I9_FVOCI_DEBT: { sheet: 'Raw_IFRS9', row: 4 },
  I9_FVOCI_EQ: { sheet: 'Raw_IFRS9', row: 5 },
  I9_AC: { sheet: 'Raw_IFRS9', row: 6 },
  I9_LOANS: { sheet: 'Raw_IFRS9', row: 7 },
  I9_S1_EXP: { sheet: 'Raw_IFRS9', row: 9 },
  I9_S2_EXP: { sheet: 'Raw_IFRS9', row: 10 },
  I9_S3_EXP: { sheet: 'Raw_IFRS9', row: 11 },
  I9_S1_ALLOW: { sheet: 'Raw_IFRS9', row: 12 },
  I9_S2_ALLOW: { sheet: 'Raw_IFRS9', row: 13 },
  I9_S3_ALLOW: { sheet: 'Raw_IFRS9', row: 14 },
  I9_IMPAIRED: { sheet: 'Raw_IFRS9', row: 18 },
  I9_WRITEOFF: { sheet: 'Raw_IFRS9', row: 19 },
  I9_FVOCI_RES: { sheet: 'Raw_IFRS9', row: 21 },
  I9_FV_PL: { sheet: 'Raw_IFRS9', row: 22 },
  I9_INV_INC: { sheet: 'Raw_IFRS9', row: 23 },
  I9_AVG_ASSETS: { sheet: 'Raw_IFRS9', row: 24 },
}

export type TemplateData = {
  metadata: {
    nama_entitas: string
    jenis_usaha: JenisUsaha
    periode: string
    mata_uang: string
    unit: string
  }
  values: Record<string, { CY: number | null; PY: number | null; PPY: number | null }>
}

export function buildExtractionPrompt(jenis: JenisUsaha): string {
  const allFields = [
    ...SFP_FIELDS,
    ...PL_FIELDS,
    ...CF_FIELDS,
    ...IFRS17_FIELDS,
    ...IFRS9_FIELDS,
  ]

  const fieldList = allFields
    .map(f => `  "${f.key}": {"CY": <nilai tahun berjalan atau null>, "PY": <nilai tahun sebelumnya atau null>, "PPY": <nilai 2 tahun sebelumnya atau null>}  // ${f.label_id}`)
    .join(',\n')

  return `Kamu adalah ahli akuntansi IFRS/PSAK asuransi Indonesia. Dokumen ini adalah laporan keuangan audited perusahaan asuransi ${jenis === 'Jiwa' ? 'jiwa' : 'umum'} yang menerapkan PSAK 117 (IFRS 17) dan PSAK 109 (IFRS 9).

Ekstrak semua data keuangan berikut dari laporan ini. Untuk setiap field:
- Cari nilai di laporan posisi keuangan, laporan laba rugi, laporan arus kas, dan catatan atas laporan keuangan (CALK)
- Gunakan nilai dalam satuan JUTAAN RUPIAH (jika laporan dalam ribuan, bagi 1000; jika dalam rupiah penuh, bagi 1.000.000)
- CY = tahun buku terkini, PY = tahun sebelumnya, PPY = dua tahun sebelumnya
- Jika nilai tidak ditemukan, isi null
- Nilai beban/expense yang disajikan sebagai positif di laporan tetap masukkan sebagai positif
- Jangan mengarang angka — hanya isi yang benar-benar ada di dokumen

Kembalikan HANYA JSON valid (tanpa markdown, tanpa penjelasan):
{
  "metadata": {
    "nama_entitas": "<nama perusahaan dari laporan>",
    "jenis_usaha": "${jenis}",
    "periode": "<periode laporan, mis. 31 Desember 2025>",
    "mata_uang": "IDR",
    "unit": "juta"
  },
  "values": {
${fieldList}
  }
}`
}
