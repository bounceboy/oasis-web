import { callOpenRouter } from '@/lib/claude'

export type JenisUsaha = 'Jiwa' | 'Umum'

export interface DataKeuangan {
  // SFP
  total_aset?: number
  total_liabilitas?: number
  total_ekuitas?: number
  kas?: number
  investasi_total?: number
  liabilitas_kontrak_asuransi?: number
  aset_kontrak_reasuransi?: number
  fvoci_reserve?: number            // OCI reserve FVOCI (Jiwa)
  // P/L
  pendapatan_asuransi?: number
  beban_jasa_asuransi?: number
  beban_underwriting?: number       // underwriting expenses saja (Umum)
  klaim_dan_manfaat?: number
  insurance_service_result?: number // ISR = pendapatan - beban jasa asuransi (Jiwa)
  hasil_investasi?: number
  profit_tahun_berjalan?: number
  total_comprehensive_income?: number
  // IFRS 17
  csm_penutup?: number
  csm_pembuka?: number
  csm_release?: number              // CSM direlease ke P/L tahun ini
  lrc?: number
  lic?: number
  loss_component?: number
  risk_adjustment?: number          // RA penutup (tahun ini)
  risk_adjustment_pembuka?: number  // RA pembuka (tahun lalu)
  cession_ratio?: number
  // IFRS 9
  ecl_total?: number
  ecl_base?: number
  stage2_3_exposure?: number
  stage_total_exposure?: number
  // CF
  arus_kas_operasi?: number
  kas_akhir?: number
  // Meta
  periode?: string
  mata_uang?: string
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
  // Indikator baru PSAK 117 (Umum)
  expense_ratio?: number        // beban_underwriting / pendapatan_asuransi
  combined_ratio?: number       // claim_ratio + expense_ratio
  reins_asset_equity?: number   // aset_kontrak_reasuransi / total_ekuitas
  // Indikator baru PSAK 117 (kedua jenis)
  csm_growth?: number           // csm_penutup / csm_pembuka
  csm_release_ratio?: number    // csm_release / csm_pembuka
  ra_change?: number            // risk_adjustment / risk_adjustment_pembuka
  loss_component_weight?: number // loss_component / liabilitas_kontrak_asuransi
  // Indikator baru PSAK 117 (Jiwa)
  ism_margin?: number           // insurance_service_result / pendapatan_asuransi
  investment_ratio?: number     // investasi_total / total_aset
  fvoci_equity?: number         // fvoci_reserve / total_ekuitas
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
  roa_min: 0.01,
  roe_min: 0.05,
  claim_ratio_max: 0.70,
  ecl_coverage_min: 0.002,
  stage2_3_ratio_max: 0.10,
  ocf_profit_min: 0.80,
  reserve_leverage_max: 3,
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

  // Indikator baru (Umum)
  if (d.beban_underwriting != null && d.pendapatan_asuransi)
    r.expense_ratio = Math.abs(d.beban_underwriting) / d.pendapatan_asuransi

  if (r.claim_ratio != null && r.expense_ratio != null)
    r.combined_ratio = r.claim_ratio + r.expense_ratio

  if (d.aset_kontrak_reasuransi != null && d.total_ekuitas)
    r.reins_asset_equity = d.aset_kontrak_reasuransi / d.total_ekuitas

  // Indikator baru (kedua jenis)
  if (d.csm_penutup != null && d.csm_pembuka && d.csm_pembuka > 0)
    r.csm_growth = d.csm_penutup / d.csm_pembuka

  if (d.csm_release != null && d.csm_pembuka && d.csm_pembuka > 0)
    r.csm_release_ratio = d.csm_release / d.csm_pembuka

  if (d.risk_adjustment != null && d.risk_adjustment_pembuka && d.risk_adjustment_pembuka > 0)
    r.ra_change = d.risk_adjustment / d.risk_adjustment_pembuka

  if (d.loss_component != null && d.liabilitas_kontrak_asuransi)
    r.loss_component_weight = Math.abs(d.loss_component) / d.liabilitas_kontrak_asuransi

  // Indikator baru (Jiwa)
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

  function item(
    metric: string,
    nilai: number | undefined,
    threshold: string,
    pass: boolean | null,
    keterangan: string
  ): ScorecardItem {
    return { metric, nilai: nilai ?? null, threshold, pass, poin: pass === true ? 1 : 0, keterangan }
  }

  items.push(item('ROE', rasio.roe,
    `>= ${(THRESHOLD.roe_min * 100).toFixed(0)}%`,
    rasio.roe != null ? rasio.roe >= THRESHOLD.roe_min : null,
    rasio.roe != null ? (rasio.roe >= THRESHOLD.roe_min ? 'Memenuhi' : 'Di bawah minimum') : 'Data tidak tersedia'
  ))

  items.push(item('Kas / Liabilitas (Likuiditas)', rasio.liquidity,
    `>= ${(THRESHOLD.liquidity_min * 100).toFixed(0)}%`,
    rasio.liquidity != null ? rasio.liquidity >= THRESHOLD.liquidity_min : null,
    rasio.liquidity != null ? (rasio.liquidity >= THRESHOLD.liquidity_min ? 'Memenuhi' : 'Perlu perhatian') : 'Data tidak tersedia'
  ))

  items.push(item('Liabilitas / Ekuitas (Leverage)', rasio.leverage,
    `<= ${THRESHOLD.leverage_max}x`,
    rasio.leverage != null ? rasio.leverage <= THRESHOLD.leverage_max : null,
    rasio.leverage != null ? (rasio.leverage <= THRESHOLD.leverage_max ? 'Memenuhi' : 'Leverage tinggi') : 'Data tidak tersedia'
  ))

  items.push(item('Claim Ratio', rasio.claim_ratio,
    `<= ${(THRESHOLD.claim_ratio_max * 100).toFixed(0)}%`,
    rasio.claim_ratio != null ? rasio.claim_ratio <= THRESHOLD.claim_ratio_max : null,
    rasio.claim_ratio != null ? (rasio.claim_ratio <= THRESHOLD.claim_ratio_max ? 'Memenuhi' : 'Klaim tinggi') : 'Data tidak tersedia'
  ))

  if (jenis === 'Umum') {
    items.push(item('Expense Ratio', rasio.expense_ratio,
      `<= ${(THRESHOLD.expense_ratio_max * 100).toFixed(0)}%`,
      rasio.expense_ratio != null ? rasio.expense_ratio <= THRESHOLD.expense_ratio_max : null,
      rasio.expense_ratio != null ? (rasio.expense_ratio <= THRESHOLD.expense_ratio_max ? 'Memenuhi' : 'Beban usaha tinggi') : 'Data tidak tersedia'
    ))

    items.push(item('Combined Ratio', rasio.combined_ratio,
      `<= ${(THRESHOLD.combined_ratio_max * 100).toFixed(0)}%`,
      rasio.combined_ratio != null ? rasio.combined_ratio <= THRESHOLD.combined_ratio_max : null,
      rasio.combined_ratio != null ? (rasio.combined_ratio <= THRESHOLD.combined_ratio_max ? 'Memenuhi' : 'Operasi underwriting merugi') : 'Data tidak tersedia'
    ))

    items.push(item('Aset Reasuransi / Ekuitas', rasio.reins_asset_equity,
      `<= ${THRESHOLD.reins_asset_equity_max}x`,
      rasio.reins_asset_equity != null ? rasio.reins_asset_equity <= THRESHOLD.reins_asset_equity_max : null,
      rasio.reins_asset_equity != null ? (rasio.reins_asset_equity <= THRESHOLD.reins_asset_equity_max ? 'Memenuhi' : 'Dependensi reasuransi tinggi') : 'Data tidak tersedia'
    ))
  }

  if (jenis === 'Jiwa') {
    items.push(item('CSM / Ekuitas', rasio.csm_equity,
      `>= ${(THRESHOLD.csm_equity_min * 100).toFixed(0)}%`,
      rasio.csm_equity != null ? rasio.csm_equity >= THRESHOLD.csm_equity_min : null,
      rasio.csm_equity != null ? (rasio.csm_equity >= THRESHOLD.csm_equity_min ? 'Memenuhi' : 'Buffer CSM tipis') : 'Data tidak tersedia'
    ))

    items.push(item('ISR Margin (Jiwa)', rasio.ism_margin,
      `>= ${(THRESHOLD.ism_margin_min * 100).toFixed(0)}%`,
      rasio.ism_margin != null ? rasio.ism_margin >= THRESHOLD.ism_margin_min : null,
      rasio.ism_margin != null ? (rasio.ism_margin >= THRESHOLD.ism_margin_min ? 'Memenuhi' : 'Margin jasa asuransi tipis') : 'Data tidak tersedia'
    ))

    items.push(item('Investasi / Total Aset (Jiwa)', rasio.investment_ratio,
      `>= ${(THRESHOLD.investment_ratio_min * 100).toFixed(0)}%`,
      rasio.investment_ratio != null ? rasio.investment_ratio >= THRESHOLD.investment_ratio_min : null,
      rasio.investment_ratio != null ? (rasio.investment_ratio >= THRESHOLD.investment_ratio_min ? 'Memenuhi' : 'Porsi investasi rendah') : 'Data tidak tersedia'
    ))

    items.push(item('FVOCI Reserve / Ekuitas (Jiwa)', rasio.fvoci_equity,
      `<= ${(THRESHOLD.fvoci_equity_max * 100).toFixed(0)}%`,
      rasio.fvoci_equity != null ? rasio.fvoci_equity <= THRESHOLD.fvoci_equity_max : null,
      rasio.fvoci_equity != null ? (rasio.fvoci_equity <= THRESHOLD.fvoci_equity_max ? 'Memenuhi' : 'Risiko OCI volatilitas tinggi') : 'Data tidak tersedia'
    ))
  }

  // Indikator PSAK 117 (kedua jenis)
  items.push(item('CSM Growth', rasio.csm_growth,
    `>= ${(THRESHOLD.csm_growth_min * 100).toFixed(0)}%`,
    rasio.csm_growth != null ? rasio.csm_growth >= THRESHOLD.csm_growth_min : null,
    rasio.csm_growth != null ? (rasio.csm_growth >= THRESHOLD.csm_growth_min ? 'CSM tumbuh / stabil' : 'CSM menyusut — portoflio mengecil') : 'Data tidak tersedia'
  ))

  items.push(item('CSM Release Ratio', rasio.csm_release_ratio,
    `>= ${(THRESHOLD.csm_release_ratio_min * 100).toFixed(0)}%`,
    rasio.csm_release_ratio != null ? rasio.csm_release_ratio >= THRESHOLD.csm_release_ratio_min : null,
    rasio.csm_release_ratio != null ? (rasio.csm_release_ratio >= THRESHOLD.csm_release_ratio_min ? 'Memenuhi' : 'Amortisasi CSM sangat lambat') : 'Data tidak tersedia'
  ))

  items.push(item('Perubahan RA (RA t/RA t-1)', rasio.ra_change,
    `<= ${THRESHOLD.ra_change_max}x`,
    rasio.ra_change != null ? rasio.ra_change <= THRESHOLD.ra_change_max : null,
    rasio.ra_change != null ? (rasio.ra_change <= THRESHOLD.ra_change_max ? 'Memenuhi' : 'Risk Adjustment meningkat signifikan') : 'Data tidak tersedia'
  ))

  items.push(item('Loss Component Weight', rasio.loss_component_weight,
    `<= ${(THRESHOLD.loss_component_weight_max * 100).toFixed(0)}%`,
    rasio.loss_component_weight != null ? rasio.loss_component_weight <= THRESHOLD.loss_component_weight_max : null,
    rasio.loss_component_weight != null ? (rasio.loss_component_weight <= THRESHOLD.loss_component_weight_max ? 'Memenuhi' : 'Proporsi kontrak onerosa tinggi') : 'Data tidak tersedia'
  ))

  items.push(item('ECL Coverage', rasio.ecl_coverage,
    `>= ${(THRESHOLD.ecl_coverage_min * 100).toFixed(2)}%`,
    rasio.ecl_coverage != null ? rasio.ecl_coverage >= THRESHOLD.ecl_coverage_min : null,
    rasio.ecl_coverage != null ? (rasio.ecl_coverage >= THRESHOLD.ecl_coverage_min ? 'Memenuhi' : 'Penyisihan ECL kurang') : 'Data tidak tersedia'
  ))

  items.push(item('Stage 2+3 Ratio', rasio.stage2_3_ratio,
    `<= ${(THRESHOLD.stage2_3_ratio_max * 100).toFixed(0)}%`,
    rasio.stage2_3_ratio != null ? rasio.stage2_3_ratio <= THRESHOLD.stage2_3_ratio_max : null,
    rasio.stage2_3_ratio != null ? (rasio.stage2_3_ratio <= THRESHOLD.stage2_3_ratio_max ? 'Memenuhi' : 'Kualitas aset turun') : 'Data tidak tersedia'
  ))

  items.push(item('OCF / Profit (Kualitas Laba)', rasio.ocf_profit,
    `>= ${(THRESHOLD.ocf_profit_min * 100).toFixed(0)}%`,
    rasio.ocf_profit != null ? rasio.ocf_profit >= THRESHOLD.ocf_profit_min : null,
    rasio.ocf_profit != null ? (rasio.ocf_profit >= THRESHOLD.ocf_profit_min ? 'Memenuhi' : 'Kualitas laba lemah') : 'Data tidak tersedia'
  ))

  return items
}

export function hitungSkor(scorecard: ScorecardItem[]): { skor: number; total: number; rating: string } {
  const valid = scorecard.filter((s) => s.pass !== null)
  const skor = valid.reduce((acc, s) => acc + s.poin, 0)
  const total = valid.length
  const pct = total > 0 ? skor / total : 0
  const rating = pct >= 0.875 ? 'Baik' : pct >= 0.625 ? 'Cukup' : pct >= 0.375 ? 'Kurang' : 'Buruk'
  return { skor, total, rating }
}

// ─── AI Prompts ──────────────────────────────────────────────────────────────

const PSAK117_KNOWLEDGE = `
PSAK 117 / IFRS 17 — Komponen Utama:
- Insurance contract liabilities = LRC (Liability for Remaining Coverage) + LIC (Liability for Incurred Claims)
- LRC = CSM (Contractual Service Margin) + RA (Risk Adjustment) + PAA (Premium Allocation Approach) jika berlaku
- CSM = unearned profit yang akan diakui seiring jasa diberikan
- Loss Component: kontrak onerosa — LRC negatif, langsung ke P/L
- Insurance Revenue = amortisasi CSM + RA release + experience adjustment (bukan premi diterima)
- Insurance Finance Income/Expense: perubahan nilai kontrak akibat waktu/diskonto
- IFRS 9 berlaku bersamaan: aset keuangan diklasifikasi FVTPL/FVOCI/AC, ECL 3-stage
`

export async function ekstrakDataKeuangan(
  teksLapkeu: string,
  namaEntitas: string,
  jenisUsaha: JenisUsaha
): Promise<DataKeuangan> {
  const system = `Anda adalah analis keuangan senior OJK yang ahli membaca laporan keuangan asuransi PSAK 117.
Tugas: ekstrak data keuangan terstruktur dari teks laporan keuangan audited.

${PSAK117_KNOWLEDGE}

Output HARUS berupa JSON valid saja, tidak ada teks lain. Format:
{
  "total_aset": number|null,
  "total_liabilitas": number|null,
  "total_ekuitas": number|null,
  "kas": number|null,
  "investasi_total": number|null,
  "liabilitas_kontrak_asuransi": number|null,
  "aset_kontrak_reasuransi": number|null,
  "fvoci_reserve": number|null,
  "pendapatan_asuransi": number|null,
  "beban_jasa_asuransi": number|null,
  "beban_underwriting": number|null,
  "klaim_dan_manfaat": number|null,
  "insurance_service_result": number|null,
  "hasil_investasi": number|null,
  "profit_tahun_berjalan": number|null,
  "total_comprehensive_income": number|null,
  "csm_penutup": number|null,
  "csm_pembuka": number|null,
  "csm_release": number|null,
  "lrc": number|null,
  "lic": number|null,
  "loss_component": number|null,
  "risk_adjustment": number|null,
  "risk_adjustment_pembuka": number|null,
  "cession_ratio": number|null,
  "ecl_total": number|null,
  "ecl_base": number|null,
  "stage2_3_exposure": number|null,
  "stage_total_exposure": number|null,
  "arus_kas_operasi": number|null,
  "kas_akhir": number|null,
  "periode": "string",
  "mata_uang": "IDR",
  "unit": "juta Rupiah atau sesuai laporan"
}

Instruksi:
- Gunakan angka sesuai unit laporan (jangan konversi)
- Jika data tidak ada di laporan, tulis null
- Untuk klaim_dan_manfaat: ambil nilai absolut (positif)
- Untuk beban: ambil nilai seperti di laporan (bisa negatif)
- cession_ratio: rasio reasuransi jika disebutkan (0-1), null jika tidak ada
- PENTING: Jika tabel Stage 1/2/3 ada tapi Stage 2 dan Stage 3 menunjukkan "--" atau "-", artinya 0 (nol), bukan null. Isi stage2_3_exposure=0 dan stage_total_exposure=nilai Total di tabel tersebut
- PENTING: ecl_base adalah total nilai bruto aset keuangan atau total eksposur dari tabel ECL (biasanya sama dengan Total di kolom Tahap/Stage 1). ecl_total adalah total cadangan ECL yang dibentuk
- beban_underwriting (Umum): beban komisi + beban akuisisi + beban operasional underwriting, BUKAN total beban jasa asuransi
- csm_release: nilai CSM yang diakui sebagai pendapatan (dirilis ke P/L) selama tahun berjalan; biasanya ada di rekonsiliasi CSM
- risk_adjustment_pembuka: saldo Risk Adjustment awal tahun (periode lalu), dari rekonsiliasi RA di catatan atas lapkeu
- fvoci_reserve (Jiwa): saldo OCI reserve dari investasi FVOCI (unrealized gain/loss after tax), biasanya di ekuitas bagian other comprehensive income
- insurance_service_result (Jiwa): Insurance Service Result = pendapatan asuransi dikurangi beban jasa asuransi (sebelum finance income/expense)`

  // teksLapkeu sudah berupa halaman-halaman relevan yang dipilih server
  // (via /api/upload/pdf dengan PSAK117_PAGE_CONFIG)
  // Langsung gunakan, cap di 120k karakter sebagai safety net
  const user = `Laporan Keuangan: ${namaEntitas} (${jenisUsaha})

${teksLapkeu.slice(0, 160000)}`

  const raw = await callOpenRouter(system, user, 2000)

  // Ekstrak JSON dari respons
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI tidak mengembalikan JSON valid untuk ekstraksi data')

  return JSON.parse(match[0]) as DataKeuangan
}

export async function analisaCompliance(
  dataKeuangan: DataKeuangan,
  rasio: RasioKeuangan,
  scorecard: ScorecardItem[],
  pojkContext: string,
  namaEntitas: string,
  jenisUsaha: JenisUsaha
): Promise<string> {
  const gagal = scorecard.filter((s) => s.pass === false).map((s) => s.metric)
  const lolos = scorecard.filter((s) => s.pass === true).map((s) => s.metric)

  const system = `Anda adalah pengawas OJK senior bidang perasuransian.
Tugas: buat analisis kepatuhan laporan keuangan asuransi terhadap regulasi OJK yang berlaku.

REFERENSI REGULASI (SATU-SATUNYA SUMBER YANG BOLEH DIGUNAKAN):
${pojkContext}

${PSAK117_KNOWLEDGE}

INSTRUKSI:
- Fokus pada kepatuhan terhadap ketentuan tingkat solvabilitas, kesehatan keuangan, dan pengelolaan aset-liabilitas
- Sebutkan nomor POJK dan pasal spesifik untuk setiap temuan
- Format: ## [Topik] → Temuan → Pasal Terkait → Rekomendasi
- Gunakan bahasa teknis pengawas yang ringkas dan tegas

BATASAN KETAT — WAJIB DIPATUHI:
- HANYA kutip nomor POJK, pasal, dan ketentuan yang SECARA EKSPLISIT tercantum dalam REFERENSI REGULASI di atas.
- DILARANG KERAS menyebut pasal, ayat, threshold, atau ketentuan yang tidak ada dalam teks referensi yang diberikan.
- Jika data keuangan null atau tidak tersedia, nyatakan "data tidak tersedia" — jangan isi dengan estimasi atau asumsi.`

  const user = `ENTITAS: ${namaEntitas} (${jenisUsaha}) — ${dataKeuangan.periode || ''}

SCORECARD RINGKAS:
- Metrik LULUS (${lolos.length}): ${lolos.join(', ') || 'tidak ada'}
- Metrik TIDAK LULUS (${gagal.length}): ${gagal.join(', ') || 'tidak ada'}

DATA KEUANGAN UTAMA:
- Total Aset: ${fmt(dataKeuangan.total_aset)} ${dataKeuangan.unit || ''}
- Total Liabilitas: ${fmt(dataKeuangan.total_liabilitas)} ${dataKeuangan.unit || ''}
- Ekuitas: ${fmt(dataKeuangan.total_ekuitas)} ${dataKeuangan.unit || ''}
- Profit: ${fmt(dataKeuangan.profit_tahun_berjalan)} ${dataKeuangan.unit || ''}
- Pendapatan Asuransi: ${fmt(dataKeuangan.pendapatan_asuransi)} ${dataKeuangan.unit || ''}
- Liab. Kontrak Asuransi: ${fmt(dataKeuangan.liabilitas_kontrak_asuransi)} ${dataKeuangan.unit || ''}
- CSM Penutup: ${fmt(dataKeuangan.csm_penutup)} ${dataKeuangan.unit || ''}

RASIO:
- ROE: ${pct(rasio.roe)} | ROA: ${pct(rasio.roa)} | Leverage: ${fmtX(rasio.leverage)}
- Claim Ratio: ${pct(rasio.claim_ratio)} | Expense Ratio: ${pct(rasio.expense_ratio)} | Combined Ratio: ${pct(rasio.combined_ratio)}
- CSM/Equity: ${pct(rasio.csm_equity)} | CSM Growth: ${fmtX(rasio.csm_growth)} | CSM Release: ${pct(rasio.csm_release_ratio)}
- Perubahan RA: ${fmtX(rasio.ra_change)} | Loss Component Weight: ${pct(rasio.loss_component_weight)}
- ISR Margin: ${pct(rasio.ism_margin)} | Investasi/Aset: ${pct(rasio.investment_ratio)} | FVOCI/Ekuitas: ${pct(rasio.fvoci_equity)}
- ECL Coverage: ${pct(rasio.ecl_coverage)} | Stage 2+3: ${pct(rasio.stage2_3_ratio)}
- OCF/Profit: ${pct(rasio.ocf_profit)} | Cession Ratio: ${pct(rasio.cession_ratio)} | Reins/Ekuitas: ${fmtX(rasio.reins_asset_equity)}

Buat analisis kepatuhan 3-5 halaman yang komprehensif dan siap digunakan sebagai dasar tindak lanjut pengawasan.`

  return callOpenRouter(system, user, 3000)
}

export async function petakanRisiko(
  dataKeuangan: DataKeuangan,
  rasio: RasioKeuangan,
  sedkContext: string,
  namaEntitas: string,
  jenisUsaha: JenisUsaha
): Promise<string> {
  const system = `Anda adalah analis risiko OJK senior yang menggunakan pendekatan pengawasan berbasis risiko (risk-based supervision).

REFERENSI SEDK — PANDUAN PENGAWASAN BERBASIS RISIKO (SATU-SATUNYA SUMBER YANG BOLEH DIGUNAKAN):
${sedkContext}

${PSAK117_KNOWLEDGE}

INSTRUKSI:
- Identifikasi dan nilai risiko yang muncul akibat penerapan PSAK 117/IFRS 17
- Kategorikan: risiko asuransi, risiko pasar, risiko kredit, risiko likuiditas, risiko operasional
- Nilai tingkat risiko: Tinggi / Sedang / Rendah
- Tunjukkan hubungan langsung antara angka lapkeu dan profil risiko
- Format: ## [Kategori Risiko] → Deskripsi → Indikator dari Lapkeu → Level Risiko → Mitigasi

BATASAN KETAT — WAJIB DIPATUHI:
- HANYA gunakan kerangka risiko, indikator, dan threshold yang SECARA EKSPLISIT tercantum dalam REFERENSI SEDK di atas.
- DILARANG KERAS menyebut panduan, ketentuan, atau angka acuan yang tidak ada dalam teks referensi yang diberikan.
- Jika data keuangan null atau tidak tersedia, nyatakan "data tidak tersedia" — jangan isi dengan estimasi atau asumsi.`

  const user = `ENTITAS: ${namaEntitas} (${jenisUsaha}) — ${dataKeuangan.periode || ''}

DATA KEUANGAN KUNCI:
- Liab. Kontrak Asuransi: ${fmt(dataKeuangan.liabilitas_kontrak_asuransi)} (${pct(rasio.reserve_leverage)} dari ekuitas)
- Loss Component: ${fmt(dataKeuangan.loss_component)} — weight: ${pct(rasio.loss_component_weight)} dari LCA
- CSM Penutup: ${fmt(dataKeuangan.csm_penutup)} | Growth: ${fmtX(rasio.csm_growth)} | Release: ${pct(rasio.csm_release_ratio)}
- Perubahan RA: ${fmtX(rasio.ra_change)}
- LRC: ${fmt(dataKeuangan.lrc)} | LIC: ${fmt(dataKeuangan.lic)}
- Claim Ratio: ${pct(rasio.claim_ratio)} | Expense Ratio: ${pct(rasio.expense_ratio)} | Combined: ${pct(rasio.combined_ratio)}
- ISR Margin: ${pct(rasio.ism_margin)} | Investasi/Aset: ${pct(rasio.investment_ratio)} | FVOCI/Ekuitas: ${pct(rasio.fvoci_equity)}
- Cession Ratio: ${pct(rasio.cession_ratio)} | Reins/Ekuitas: ${fmtX(rasio.reins_asset_equity)}
- ECL Coverage: ${pct(rasio.ecl_coverage)} | Stage 2+3: ${pct(rasio.stage2_3_ratio)}
- Leverage: ${fmtX(rasio.leverage)} | Liquidity: ${pct(rasio.liquidity)}
- OCF/Profit: ${pct(rasio.ocf_profit)}

Buat pemetaan risiko komprehensif berbasis SEDK untuk perusahaan ini.`

  return callOpenRouter(system, user, 3000)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n == null) return 'N/A'
  return n.toLocaleString('id-ID')
}

function pct(n: number | undefined | null): string {
  if (n == null) return 'N/A'
  return (n * 100).toFixed(2) + '%'
}

function fmtX(n: number | undefined | null): string {
  if (n == null) return 'N/A'
  return n.toFixed(2) + 'x'
}
