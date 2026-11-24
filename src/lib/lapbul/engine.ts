/**
 * Mesin analisis lapbul penjaminan: angka turunan, pengujian ketentuan POJK 11/2025,
 * konsistensi antar lembar, dan hitung ulang cadangan klaim (Pasal 30).
 * Setiap angka membawa referensi ke sel lapbul (jejak sumber) atau ke rumus turunan.
 */
import type { LapbulData } from './parse'

// ───────────────────────── format angka ─────────────────────────
export const idn = (x: number | null | undefined, d = 2) => {
  if (x === null || x === undefined || !isFinite(x)) return '—'
  const s = Math.abs(x).toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (x < 0 ? '-' : '') + s
}
export const rpF = (n: number) => (isFinite(n) ? 'Rp' + idn(Math.round(n), 0) : '—')
export const rpS = (n: number) => {
  if (!isFinite(n)) return '—'
  const a = Math.abs(n)
  const s = a >= 1e12 ? idn(n / 1e12, 2) + ' T' : a >= 1e9 ? idn(n / 1e9, 1) + ' M' : a >= 1e6 ? idn(n / 1e6, 1) + ' jt' : idn(n, 0)
  return 'Rp' + s
}
export type Unit = 'Rp' | '%' | '×' | ''
export const fmtVal = (v: number | string, unit: Unit) => {
  if (typeof v === 'string') return v
  if (unit === 'Rp') return rpF(v)
  if (unit === '%') return idn(v, 2) + '%'
  if (unit === '×') return idn(v, 2) + '×'
  return idn(v, Number.isInteger(v) ? 0 : 2)
}

// ───────────────────────── tipe ─────────────────────────
export type SRef = { t: 's'; sheet: string; k: string; h: string; addr: string; r: number; u: string; v: number | string; file: string }
export type DRef = { t: 'd'; id: string }
export type Ref = SRef | DRef
export interface Der { id: string; label: string; unit: Unit; value: number; formula: string; inputs: Ref[] }
export type Status = 'ok' | 'bad' | 'warn' | 'na'
export interface Test { id: string; grp: string; pasal: string; judul: string; aturan: string; nilai: string; batas: string; status: Status; calc: string; refs: Ref[]; note: string }
export interface Check { id: string; judul: string; status: 'ok' | 'warn' | 'na'; ket: string; selisih: string; refs: Ref[]; dampak: string }
export type Lingkup = 'kabkota' | 'provinsi' | 'nasional' | 'ulang'
export type Skenario = 'berjalan' | 'periode'
export interface Params { lingkup: Lingkup; porsi: number; skenario: Skenario; tglTerima: string }
export const DEFAULT_PARAMS: Params = { lingkup: 'nasional', porsi: 100, skenario: 'berjalan', tglTerima: '' }

export const LINGKUP: Record<Lingkup, { label: string; min: number }> = {
  kabkota: { label: 'Kabupaten/kota', min: 50e9 },
  provinsi: { label: 'Provinsi', min: 100e9 },
  nasional: { label: 'Nasional', min: 250e9 },
  ulang: { label: 'Penjaminan ulang', min: 500e9 },
}
export const STAT: Record<Status, string> = { ok: 'Memenuhi', bad: 'Tidak memenuhi', warn: 'Perlu klarifikasi', na: 'Tidak dapat diuji' }

export const SHEET_TITLE: Record<string, string> = {
  '0000': 'Profil Perusahaan Penjaminan', '1000': 'Ikhtisar Laporan Bulanan', '1100': 'Laporan Posisi Keuangan', '1200': 'Laporan Laba Rugi Komprehensif',
  '2100A1': 'Rincian Investasi Deposito (Lancar)', '2100A2': 'Rincian Investasi Deposito (Tidak Lancar)',
  '2100B1': 'Rincian Investasi Surat Berharga (Lancar)', '2100B2': 'Rincian Investasi Surat Berharga (Tidak Lancar)', '2100B3': 'Rekapitulasi Investasi SBN',
  '2100C1': 'Rincian Investasi Tanah dan Bangunan (Lancar)', '2100C2': 'Rincian Investasi Tanah dan Bangunan (Tidak Lancar)',
  '2100D1': 'Rincian Penyertaan Langsung (Lancar)', '2100D2': 'Rincian Penyertaan Langsung (Tidak Lancar)',
  '3400A': 'Klaim per Sektor Ekonomi (Penjaminan Kredit)', '3400B': 'Klaim per Sektor Ekonomi (Selain Kredit)',
  '3500A': 'Klaim per Status (Penjaminan Kredit)', '3500B': 'Klaim per Status (Selain Kredit)',
  '5100': 'Daftar Kinerja Operasional', '6100': 'Laporan Piutang Subrogasi', '7100': 'Laporan Gearing Ratio',
}
export const sheetTitle = (L: LapbulData, id: string) => L.sheets[id]?.title || SHEET_TITLE[id] || id

const BANK: Record<string, string> = {
  '002': 'BRI', '008': 'Bank Mandiri', '009': 'BNI', '200': 'BTN', '014': 'BCA', '011': 'Bank Danamon', '013': 'Bank Permata', '016': 'Maybank Indonesia',
  '022': 'CIMB Niaga', '028': 'OCBC', '110': 'Bank BJB', '111': 'Bank DKI', '112': 'BPD DIY', '113': 'Bank Jateng', '114': 'Bank Jatim', '116': 'Bank Aceh',
  '117': 'Bank Sumut', '118': 'Bank Nagari', '119': 'Bank Riau Kepri', '120': 'Bank Sumsel Babel', '121': 'Bank Lampung', '122': 'Bank Kalsel', '123': 'Bank Kalbar',
  '124': 'Bank Kaltimtara', '125': 'Bank Kalteng', '126': 'Bank Sulselbar', '127': 'Bank SulutGo', '128': 'Bank NTB Syariah', '129': 'Bank BPD Bali', '130': 'Bank NTT',
  '131': 'Bank Maluku Malut', '132': 'Bank Papua', '147': 'Bank Muamalat', '426': 'Bank Mega', '441': 'KB Bank', '451': 'Bank Syariah Indonesia',
}
export const namaBank = (sandi: string) => (BANK[sandi] ? `${BANK[sandi]} (sandi ${sandi})` : `Sandi bank ${sandi}`)

// ───────────────────────── akses data ─────────────────────────
const nv = (r: SRef | null) => (r && typeof r.v === 'number' ? r.v : NaN)
const fin = (...x: number[]) => x.every(v => isFinite(v))

function accessor(L: LapbulData) {
  const row = (sh: string, k: string) => L.sheets[sh]?.rows.find(r => r.k === k)
  const cell = (sh: string, k: string, h?: RegExp): SRef | null => {
    const r = row(sh, k)
    if (!r) return null
    const c = r.cells.find(c => typeof c.v === 'number' && (!h || h.test(c.h)))
    if (!c) return null
    return { t: 's', sheet: sh, k, h: c.h, addr: c.addr, r: r.r, u: r.u, v: c.v, file: L.file }
  }
  /** Baris rincian (bukan total) beserta sel yang diminta. */
  const detail = (sh: string, filter?: (cells: { h: string; v: number | string }[]) => boolean) =>
    (L.sheets[sh]?.rows || []).filter(r => !/0000$/.test(r.k) && (!filter || filter(r.cells)))
  const toRef = (sh: string, r: { k: string; u: string; r: number; cells: { c: number; addr: string; h: string; v: number | string }[] }, h: RegExp): SRef | null => {
    const c = r.cells.find(c => typeof c.v === 'number' && h.test(c.h))
    return c ? { t: 's', sheet: sh, k: r.k, h: c.h, addr: c.addr, r: r.r, u: r.u, v: c.v, file: L.file } : null
  }
  return { row, cell, detail, toRef }
}

const sumRefs = (refs: (SRef | null)[]) => {
  const ok = refs.filter((r): r is SRef => !!r && typeof r.v === 'number')
  return { value: ok.length ? ok.reduce((a, r) => a + (r.v as number), 0) : NaN, refs: ok }
}

// ───────────────────────── IBNR ─────────────────────────
export interface IbnrInfo { metode: 'tepat' | 'pendekatan' | 'tidak'; ket: string }
function monthOf(iso: string) { const m = iso.match(/^(\d{4})-(\d{2})/); return m ? { y: +m[1], m: +m[2] } : null }

// ───────────────────────── analisis ─────────────────────────
export interface Analysis {
  D: Record<string, Der>; tests: Test[]; checks: Check[]; sum: Record<Status, number>; ibnr: IbnrInfo
  scn: { sk: Skenario; label: string; ok: boolean; selisih: number; steps: { no: string; label: string; value: number; dasar: string; refs: Ref[] }[] }[]
  ratios: { nama: string; dilaporkan: SRef | null; hitung: string; unit: Unit; same: boolean | null }[]
  sheetsRead: { id: string; title: string; rows: number }[]
}

export function analyze(L: LapbulData, prior: LapbulData[], P: Params): Analysis {
  const A = accessor(L)
  const D: Record<string, Der> = {}
  const add = (id: string, o: Omit<Der, 'id'>) => { D[id] = { id, ...o } }
  const dv = (id: string): DRef => ({ t: 'd', id })
  const val = (id: string) => D[id]?.value ?? NaN
  const porsi = P.porsi / 100

  // ---- angka dasar ----
  const totPenj = A.cell('7100', '7100010000', /(^|› )Jumlah$/) || A.cell('1000', '1000100000')
  const prodPenj = A.cell('7100', '7100010000', /Usaha Produktif$/) || A.cell('1000', '1000060000')
  const modal = A.cell('7100', '7100020000') || A.cell('1000', '1000040000')
  const ekuitas = A.cell('1000', '1000040000') || A.cell('1100', '11000302000000')
  const invTot = A.cell('1000', '1000020000')
  const asetL = A.cell('1100', '11000101140000'), liabL = A.cell('1100', '11000201150000')
  const ijpBruto = A.cell('1200', '12000101010000'), ijpBersih = A.cell('1200', '12000101060000'), bebanKlaim = A.cell('1200', '12000201010000')
  const klaimByr1000 = A.cell('1000', '1000160000')

  const cad = sumRefs([A.cell('1100', '11000201020000'), A.cell('1100', '11000202020000')])
  add('cadKlaim', { label: 'Cadangan klaim di neraca (lancar + tidak lancar)', unit: 'Rp', value: cad.value, formula: 'Cadangan klaim lancar + cadangan klaim tidak lancar', inputs: cad.refs })
  const ut = sumRefs([A.cell('1100', '11000201010000'), A.cell('1100', '11000202010000')])
  add('utangKlaim', { label: 'Utang klaim di neraca (lancar + tidak lancar)', unit: 'Rp', value: ut.value, formula: 'Utang klaim lancar + utang klaim tidak lancar', inputs: ut.refs })

  // status klaim (3500A + 3500B, kolom TOTAL)
  const st = (re: RegExp, id: string, label: string) => {
    const s = sumRefs([A.cell('3500A', '3500A10000', re), A.cell('3500B', '3500B10000', re)])
    add(id, { label, unit: 'Rp', value: s.value, formula: 'Baris Total kolom TOTAL lembar 3500A + 3500B', inputs: s.refs })
  }
  st(/^total › klaim diproses/i, 'klDiproses', 'Klaim diproses (seluruh jenis penjaminan)')
  st(/^total › klaim dibayar/i, 'klDibayar', 'Klaim dibayar menurut lembar status klaim')
  st(/^total › klaim disetujui namun/i, 'klBelumBayar', 'Klaim disetujui namun belum dibayar')

  // 3400A/B: jumlah baris sektor ekonomi, kolom Total
  const s34 = (re: RegExp) => sumRefs(['3400A', '3400B'].flatMap(sh => A.detail(sh).map(r => A.toRef(sh, r, re))))
  const nj = s34(/^total › nilai jaminan/i), nk = s34(/^total › nilai klaim/i)
  add('nilaiJaminanKlaim', { label: 'Nilai jaminan atas klaim yang dilaporkan (seluruh sektor)', unit: 'Rp', value: nj.value, formula: `Jumlah kolom Total › Nilai Jaminan pada ${nj.refs.length} baris sektor ekonomi (3400A/B)`, inputs: nj.refs })
  add('nilaiKlaim34', { label: 'Nilai klaim menurut lembar sektor ekonomi', unit: 'Rp', value: nk.value, formula: `Jumlah kolom Total › Nilai Klaim pada ${nk.refs.length} baris sektor ekonomi (3400A/B)`, inputs: nk.refs })

  // ---- rasio ----
  add('gearing', { label: 'Gearing ratio (dihitung ulang)', unit: '×', value: nv(totPenj) / nv(modal), formula: 'Nilai penjaminan yang ditanggung sendiri ÷ Modal sendiri bersih', inputs: [totPenj, modal].filter(Boolean) as SRef[] })
  add('produktif', { label: 'Porsi penjaminan usaha produktif', unit: '%', value: nv(prodPenj) / nv(totPenj) * 100, formula: 'Penjaminan usaha produktif ÷ Total penjaminan ditanggung sendiri × 100', inputs: [prodPenj, totPenj].filter(Boolean) as SRef[] })
  add('likuid', { label: 'Rasio likuiditas (dihitung ulang)', unit: '%', value: nv(asetL) / nv(liabL) * 100, formula: 'Jumlah aset lancar ÷ Jumlah liabilitas lancar × 100', inputs: [asetL, liabL].filter(Boolean) as SRef[] })
  add('klaimIjpBruto', { label: 'Beban klaim terhadap IJP bruto', unit: '%', value: nv(bebanKlaim) / nv(ijpBruto) * 100, formula: 'Beban klaim ÷ IJP bruto × 100', inputs: [bebanKlaim, ijpBruto].filter(Boolean) as SRef[] })
  add('klaimIjpBersih', { label: 'Beban klaim terhadap pendapatan IJP bersih', unit: '%', value: nv(bebanKlaim) / nv(ijpBersih) * 100, formula: 'Beban klaim ÷ Jumlah pendapatan IJP bersih × 100', inputs: [bebanKlaim, ijpBersih].filter(Boolean) as SRef[] })

  // ---- investasi ----
  const inv = nv(invTot)
  const deps = ['2100A1', '2100A2'].flatMap(sh => A.detail(sh).map(r => ({ sh, r })))
  const byBank = new Map<string, SRef[]>()
  for (const { sh, r } of deps) {
    const sandi = r.cells.find(c => /Sandi Bank$/.test(c.h))
    const ref = A.toRef(sh, r, /(^|› )Nilai$/)
    if (!sandi || !ref) continue
    const key = String(sandi.v).padStart(3, '0')
    const cab = r.cells.find(c => /Cabang Bank$/.test(c.h)), bil = r.cells.find(c => /Nomor Bilyet$/.test(c.h))
    ref.u = [namaBank(key), cab?.v, bil ? 'bilyet ' + bil.v : ''].filter(Boolean).join(' · ')
    byBank.set(key, [...(byBank.get(key) || []), ref])
  }
  let depTop = { key: '', v: NaN, refs: [] as SRef[] }
  for (const [key, refs] of byBank) { const s = sumRefs(refs); if (!(s.value <= depTop.v)) depTop = { key, v: s.value, refs: s.refs } }
  const depBanks = [...byBank.entries()].map(([k, refs]) => ({ bank: namaBank(k), v: sumRefs(refs).value })).sort((a, b) => b.v - a.v)
  add('depMax', { label: `Deposito pada satu bank terbesar: ${depTop.key ? namaBank(depTop.key) : '—'}`, unit: '%', value: depTop.v / inv * 100,
    formula: `Jumlah ${depTop.refs.length} bilyet deposito pada bank tersebut ÷ Jumlah investasi × 100`, inputs: [...depTop.refs, ...(invTot ? [invTot] : [])] })

  const rdRows = ['2100B1', '2100B2'].flatMap(sh => A.detail(sh, cs => cs.some(c => c.v === 'JI:e11')).map(r => ({ sh, r })))
  const byMI = new Map<string, SRef[]>()
  for (const { sh, r } of rdRows) {
    const mi = r.cells.find(c => /Manajer Investasi/i.test(c.h))
    const ref = A.toRef(sh, r, /Jumlah Neto$/)
    if (!ref) continue
    const key = mi ? String(mi.v) : '(tanpa nama MI)'
    const nm = r.cells.find(c => /Nama Surat Berharga$/.test(c.h))
    ref.u = [nm?.v, key].filter(Boolean).join(' · ')
    byMI.set(key, [...(byMI.get(key) || []), ref])
  }
  let rdTop = { key: '', v: NaN, refs: [] as SRef[] }
  for (const [key, refs] of byMI) { const s = sumRefs(refs); if (!(s.value <= rdTop.v)) rdTop = { key, v: s.value, refs: s.refs } }
  const rdAll = sumRefs([...byMI.values()].flat())
  add('rdMax', { label: `Reksa dana pada satu manajer investasi terbesar: ${rdTop.key || '—'}`, unit: '%', value: rdTop.refs.length ? rdTop.v / inv * 100 : 0,
    formula: `Jumlah ${rdTop.refs.length} reksa dana yang dikelola manajer investasi tersebut ÷ Jumlah investasi × 100`, inputs: [...rdTop.refs, ...(invTot ? [invTot] : [])] })
  add('rdTot', { label: 'Total reksa dana', unit: '%', value: rdAll.refs.length ? rdAll.value / inv * 100 : 0, formula: `Jumlah ${rdAll.refs.length} reksa dana (jenis JI:e11) ÷ Jumlah investasi × 100`, inputs: [...rdAll.refs, ...(invTot ? [invTot] : [])] })
  const tb = sumRefs([A.cell('2100C1', '2100C10000', /Jumlah Neto$/), A.cell('2100C2', '2100C20000', /Jumlah Neto$/)])
  add('tbPct', { label: 'Tanah dan bangunan', unit: '%', value: tb.value / inv * 100, formula: 'Total tanah dan bangunan (2100C1 + 2100C2) ÷ Jumlah investasi × 100', inputs: [...tb.refs, ...(invTot ? [invTot] : [])] })
  const py = sumRefs([A.cell('2100D1', '2100D10000', /Jumlah Neto$/), A.cell('2100D2', '2100D20000', /Jumlah Neto$/)])
  add('pyPct', { label: 'Penyertaan langsung', unit: '%', value: py.value / inv * 100, formula: 'Total penyertaan langsung (2100D1 + 2100D2) ÷ Jumlah investasi × 100', inputs: [...py.refs, ...(invTot ? [invTot] : [])] })

  // ---- IBNR ----
  const cur = monthOf(L.posisiISO)
  const kb = klaimByr1000 || bebanKlaim
  let ibnr: IbnrInfo = { metode: 'tidak', ket: 'Klaim dibayar tidak ditemukan.' }
  if (kb && cur) {
    const tgt = cur.m - 3
    const pr = tgt >= 1 ? prior.find(p => { const m = monthOf(p.posisiISO); return m && m.y === cur.y && m.m === tgt }) : undefined
    const kbP = pr ? (accessor(pr).cell('1000', '1000160000') || accessor(pr).cell('1200', '12000201010000')) : null
    if (cur.m === 3) {
      add('ibnr', { label: 'IBNR: rata-rata klaim dibayar 3 bulan terakhir', unit: 'Rp', value: nv(kb) / 3, formula: 'Klaim dibayar kumulatif Januari–Maret ÷ 3', inputs: [kb] })
      ibnr = { metode: 'tepat', ket: 'Posisi Maret: kumulatif tahun berjalan sama dengan tiga bulan terakhir.' }
    } else if (kbP) {
      add('ibnr', { label: 'IBNR: rata-rata klaim dibayar 3 bulan terakhir', unit: 'Rp', value: (nv(kb) - nv(kbP)) / 3, formula: `(Klaim dibayar kumulatif ${L.posisi} − kumulatif ${pr!.posisi}) ÷ 3`, inputs: [kb, kbP] })
      ibnr = { metode: 'tepat', ket: `Dihitung dari selisih kumulatif lapbul ${L.posisi} dan ${pr!.posisi}.` }
    } else {
      add('ibnr', { label: 'IBNR (pendekatan): rata-rata klaim dibayar per bulan tahun berjalan', unit: 'Rp', value: nv(kb) / cur.m, formula: `Klaim dibayar kumulatif ÷ ${cur.m} bulan (pendekatan; unggah lapbul posisi bulan ke-${tgt >= 1 ? tgt : 'akhir tahun lalu'} untuk angka tepat)`, inputs: [kb] })
      ibnr = { metode: 'pendekatan', ket: `Lapbul posisi ${tgt >= 1 ? 'tiga bulan sebelumnya' : 'tahun lalu'} tidak diunggah; IBNR memakai rata-rata bulanan tahun berjalan.` }
    }
  } else add('ibnr', { label: 'IBNR', unit: 'Rp', value: NaN, formula: '—', inputs: [] })

  // ---- cadangan klaim Pasal 30 ----
  add('floorA', { label: 'Pembanding (a): 0,01% × nilai penjaminan ditanggung sendiri', unit: 'Rp', value: nv(totPenj) * 0.0001, formula: '0,01% × Nilai penjaminan yang ditanggung sendiri', inputs: totPenj ? [totPenj] : [] })
  add('b1:berjalan', { label: 'Klaim yang masih berjalan (diproses) × porsi ditanggung sendiri', unit: 'Rp', value: val('klDiproses') * porsi, formula: `Klaim diproses × ${idn(P.porsi, 0)}%`, inputs: [dv('klDiproses')] })
  add('b1:periode', { label: 'Nilai jaminan seluruh klaim yang dilaporkan × porsi ditanggung sendiri', unit: 'Rp', value: val('nilaiJaminanKlaim') * porsi, formula: `Nilai jaminan klaim dilaporkan × ${idn(P.porsi, 0)}%`, inputs: [dv('nilaiJaminanKlaim')] })
  for (const sk of ['berjalan', 'periode'] as Skenario[]) {
    const b = val('b1:' + sk) + val('ibnr'), pemb = Math.max(val('floorA'), b), c = val('cadKlaim')
    add('b:' + sk, { label: 'Pembanding (b): klaim dilaporkan + IBNR', unit: 'Rp', value: b, formula: 'Klaim yang dilaporkan + IBNR', inputs: [dv('b1:' + sk), dv('ibnr')] })
    add('pemb:' + sk, { label: 'Hasil ayat (2): yang lebih besar antara (a) dan (b)', unit: 'Rp', value: pemb, formula: 'maks (a ; b)', inputs: [dv('floorA'), dv('b:' + sk)] })
    add('selisih:' + sk, { label: 'Selisih cadangan klaim neraca terhadap pembanding', unit: 'Rp', value: c - pemb, formula: 'Cadangan klaim (neraca) − Hasil ayat (2); negatif berarti kekurangan', inputs: [dv('cadKlaim'), dv('pemb:' + sk)] })
    add('wajib:' + sk, { label: 'Cadangan klaim yang harus dipakai (ayat 4)', unit: 'Rp', value: Math.max(c, pemb), formula: 'maks (Cadangan menurut SAK ; Hasil ayat 2)', inputs: [dv('cadKlaim'), dv('pemb:' + sk)] })
  }

  // ───────────── pengujian ketentuan ─────────────
  const tests: Test[] = []
  const T = (o: Test) => tests.push(o)
  const miss = (what: string) => `Komponen ${what} tidak ditemukan di lapbul.`
  const lk = LINGKUP[P.lingkup]
  const eq = nv(modal)
  T({ id: 'ekuitas', grp: 'Permodalan dan kapasitas', pasal: 'POJK 11/2025 Pasal 43', judul: `Ekuitas minimum (lingkup ${lk.label.toLowerCase()})`,
    aturan: `Perusahaan penjaminan dengan lingkup ${lk.label.toLowerCase()} wajib memiliki ekuitas paling sedikit ${rpF(lk.min)}.`,
    nilai: rpS(eq), batas: '≥ ' + rpS(lk.min), status: !isFinite(eq) ? 'na' : eq >= lk.min ? 'ok' : 'bad', calc: isFinite(eq) ? `Ekuitas ${rpF(eq)} dibandingkan minimum ${rpF(lk.min)}.` : '',
    refs: modal ? [modal] : [], note: isFinite(eq) ? 'Lingkup wilayah dipilih pengawas pada pengaturan analisis (lapbul tidak memuatnya secara eksplisit).' : miss('modal sendiri bersih') })
  const g = val('gearing')
  T({ id: 'gearing', grp: 'Permodalan dan kapasitas', pasal: 'POJK 11/2025 Pasal 39 ayat (3)', judul: 'Gearing ratio', aturan: 'Lembaga penjamin wajib menjaga total gearing ratio paling tinggi 40 kali.',
    nilai: idn(g) + '×', batas: '≤ 40×', status: !isFinite(g) ? 'na' : g <= 40 ? 'ok' : 'bad', calc: isFinite(g) ? `${rpF(nv(totPenj))} ÷ ${rpF(eq)} = ${idn(g)}×` : '', refs: [dv('gearing')],
    note: !isFinite(g) ? miss('nilai penjaminan atau modal sendiri') : g > 32 && g <= 40 ? `Mendekati batas (${idn(g / 40 * 100, 0)}% dari batas).` : '' })
  const pr = val('produktif')
  T({ id: 'produktif', grp: 'Permodalan dan kapasitas', pasal: 'POJK 11/2025 Pasal 40 ayat (1)', judul: 'Penjaminan usaha produktif', aturan: 'Nilai penjaminan bagi usaha produktif wajib paling sedikit 25% dari total nilai penjaminan.',
    nilai: idn(pr) + '%', batas: '≥ 25%', status: !isFinite(pr) ? 'na' : pr >= 25 ? 'ok' : 'bad', calc: isFinite(pr) ? `${rpF(nv(prodPenj))} ÷ ${rpF(nv(totPenj))} = ${idn(pr)}%` : '', refs: [dv('produktif')],
    note: isFinite(pr) ? 'Ayat (2): kewajiban dipenuhi paling lama 2 tahun sejak izin usaha.' : miss('penjaminan usaha produktif') })
  const lq = val('likuid'), lq5 = A.cell('5100', '5100010000')
  T({ id: 'likuid', grp: 'Permodalan dan kapasitas', pasal: 'POJK 11/2025 Pasal 57 ayat (2)', judul: 'Rasio likuiditas', aturan: 'Lembaga penjamin wajib menjaga rasio likuiditas (current ratio) paling rendah 120%.',
    nilai: idn(lq) + '%', batas: '≥ 120%', status: !isFinite(lq) ? 'na' : lq >= 120 ? 'ok' : 'bad', calc: isFinite(lq) ? `${rpF(nv(asetL))} ÷ ${rpF(nv(liabL))} = ${idn(lq)}%` : '',
    refs: [dv('likuid'), ...(lq5 ? [lq5] : [])], note: !isFinite(lq) ? miss('aset/liabilitas lancar') : lq5 ? `Perusahaan melaporkan ${idn(nv(lq5))}% di lembar 5100.` + (Math.abs(nv(lq5) - lq) > 0.5 ? ' Berbeda dari hitung ulang (lihat Anomali).' : '') : '' })
  const dm = val('depMax')
  T({ id: 'deposito', grp: 'Investasi', pasal: 'POJK 11/2025 Pasal 51 ayat (1) huruf a', judul: 'Deposito pada satu bank umum', aturan: 'Deposito pada setiap bank umum dilarang melebihi 30% dari jumlah investasi.',
    nilai: idn(dm) + '%', batas: '≤ 30%', status: !depTop.refs.length ? 'na' : !isFinite(dm) ? 'na' : dm <= 30 ? 'ok' : 'bad',
    calc: depTop.refs.length ? `Terbesar ${namaBank(depTop.key)}: ${rpF(depTop.v)} ÷ ${rpF(inv)} = ${idn(dm)}%. ${depBanks.length} bank: ` + depBanks.slice(0, 5).map(b => `${b.bank} ${idn(b.v / inv * 100)}%`).join('; ') + (depBanks.length > 5 ? '; …' : '') : '',
    refs: [dv('depMax')], note: depTop.refs.length ? 'Dikelompokkan menurut sandi bank. Lapbul tidak membedakan bank umum dan BPR; batas BPR 10% (huruf b) perlu dicek bila ada.' : 'Tidak ada rincian deposito.' })
  const rm = val('rdMax'), rt = val('rdTot')
  T({ id: 'reksadana', grp: 'Investasi', pasal: 'POJK 11/2025 Pasal 51 ayat (6)', judul: 'Reksa dana', aturan: 'Reksa dana dilarang melebihi 5% untuk setiap manajer investasi dan seluruhnya 20% dari jumlah investasi.',
    nilai: `${idn(rm)}% / ${idn(rt)}%`, batas: '≤ 5% / ≤ 20%', status: !isFinite(rt) ? 'na' : rm <= 5 && rt <= 20 ? 'ok' : 'bad',
    calc: rdAll.refs.length ? `${rdAll.refs.length} reksa dana pada ${byMI.size} manajer investasi. Terbesar ${rdTop.key}: ${rpF(rdTop.v)} (${idn(rm)}%). Seluruhnya ${rpF(rdAll.value)} (${idn(rt)}%).` : 'Tidak ada reksa dana pada rincian surat berharga.',
    refs: [dv('rdMax'), dv('rdTot')], note: '' })
  const tp = val('tbPct')
  T({ id: 'tanah', grp: 'Investasi', pasal: 'POJK 11/2025 Pasal 51 ayat (11)', judul: 'Tanah dan bangunan', aturan: 'Investasi tanah dan bangunan dilarang melebihi 5% dari jumlah investasi.',
    nilai: idn(tp) + '%', batas: '≤ 5%', status: !isFinite(tp) ? 'na' : tp <= 5 ? 'ok' : 'bad', calc: isFinite(tp) ? `${rpF(tb.value)} ÷ ${rpF(inv)} = ${idn(tp)}%` : '', refs: [dv('tbPct')], note: isFinite(tp) ? '' : miss('total tanah dan bangunan (2100C)') })
  const pp = val('pyPct')
  T({ id: 'penyertaan', grp: 'Investasi', pasal: 'POJK 11/2025 Pasal 51 ayat (12)', judul: 'Penyertaan langsung', aturan: 'Penyertaan langsung dilarang melebihi 10% dari jumlah investasi.',
    nilai: idn(pp) + '%', batas: '≤ 10%', status: !isFinite(pp) ? 'na' : pp <= 10 ? 'ok' : 'bad', calc: isFinite(pp) ? `${rpF(py.value)} ÷ ${rpF(inv)} = ${idn(pp)}%` : '', refs: [dv('pyPct')], note: isFinite(pp) ? '' : miss('total penyertaan langsung (2100D)') })
  T({ id: 'afiliasi', grp: 'Investasi', pasal: 'POJK 11/2025 Pasal 53 ayat (1)', judul: 'Investasi pada pihak terafiliasi', aturan: 'Investasi pada pihak terafiliasi dilarang melebihi 10% dari jumlah investasi.',
    nilai: '—', batas: '≤ 10%', status: 'na', calc: '', refs: [], note: 'Lapbul tidak memuat penanda pihak terafiliasi. Perlu data tambahan dari perusahaan.' })

  const scnOk = (sk: Skenario) => val('selisih:' + sk) >= 0
  const cadFin = fin(val('cadKlaim'), val('pemb:berjalan'), val('pemb:periode'))
  const stCad: Status = !cadFin ? 'na' : scnOk('berjalan') && scnOk('periode') ? (ibnr.metode === 'pendekatan' ? 'ok' : 'ok') : !scnOk('berjalan') && !scnOk('periode') ? 'bad' : 'warn'
  const sel = P.skenario
  T({ id: 'cadklaim', grp: 'Cadangan dan klaim', pasal: 'POJK 11/2025 Pasal 29 dan Pasal 30 ayat (1)–(4)', judul: 'Cadangan klaim',
    aturan: 'Cadangan klaim dihitung menurut SAK, lalu dibandingkan dengan yang lebih besar antara 0,01% nilai penjaminan ditanggung sendiri dan (100% nilai penjaminan klaim dilaporkan + IBNR). Bila hitungan SAK lebih kecil, dipakai hitungan pembanding.',
    nilai: rpS(val('cadKlaim')), batas: `≥ ${rpS(val('pemb:' + sel))} (pembacaan "${sel === 'berjalan' ? 'klaim berjalan' : 'klaim periode'}")`, status: stCad,
    calc: cadFin ? `Klaim berjalan: pembanding ${rpF(val('pemb:berjalan'))} → ${scnOk('berjalan') ? 'terpenuhi' : 'kurang ' + rpF(-val('selisih:berjalan'))}. Seluruh klaim periode: pembanding ${rpF(val('pemb:periode'))} → ${scnOk('periode') ? 'terpenuhi' : 'kurang ' + rpF(-val('selisih:periode'))}.` : '',
    refs: [dv('cadKlaim'), dv('pemb:berjalan'), dv('pemb:periode')],
    note: !cadFin ? miss('cadangan klaim atau data klaim') : (stCad === 'warn' ? 'Hasil bergantung pada pembacaan "klaim yang dilaporkan". Perlu klarifikasi (lihat Hitung ulang). ' : '') + `Porsi ditanggung sendiri ${idn(P.porsi, 0)}% (asumsi). ` + ibnr.ket })
  const cu = A.cell('1100', '11000301020100')
  T({ id: 'cadumum', grp: 'Cadangan dan klaim', pasal: 'POJK 11/2025 Pasal 31 ayat (1)', judul: 'Cadangan umum', aturan: 'Wajib menyisihkan cadangan umum paling sedikit 25% dari laba bersih pada akhir periode laporan tahunan.',
    nilai: cu ? rpS(nv(cu)) : '—', batas: '≥ 25% laba bersih', status: 'na', calc: '', refs: cu ? [cu] : [], note: 'Penyisihan dilakukan atas laba tahunan; diuji pada laporan tahunan.' })
  T({ id: 'wktklaim', grp: 'Cadangan dan klaim', pasal: 'POJK 11/2025 Pasal 33 ayat (2)–(3)', judul: 'Waktu persetujuan dan pembayaran klaim', aturan: 'Persetujuan atau penolakan klaim dan pembayaran klaim masing-masing paling lama 15 hari kerja.',
    nilai: '—', batas: '≤ 15 hari kerja', status: 'na', calc: '', refs: [], note: 'Lapbul tidak memuat tanggal pengajuan dan pembayaran per klaim.' })
  T({ id: 'retensi', grp: 'Cadangan dan klaim', pasal: 'POJK 11/2025 Pasal 36 dan Pasal 37', judul: 'Retensi sendiri dan pembagian risiko dengan penerima jaminan', aturan: 'Retensi sendiri minimum dan risiko yang ditanggung penerima jaminan paling sedikit 25% dari saldo outstanding.',
    nilai: '—', batas: '—', status: 'na', calc: '', refs: [], note: 'Data per sertifikat penjaminan tidak tercakup di lapbul.' })
  // ketepatan waktu
  let lap: Pick<Test, 'nilai' | 'batas' | 'status' | 'calc' | 'note'> = { nilai: '—', batas: 'Tanggal 10 bulan berikutnya', status: 'na', calc: '', note: 'Isi tanggal lapbul diterima pada pengaturan analisis untuk menguji ketentuan ini.' }
  if (cur) {
    const dl = new Date(Date.UTC(cur.y, cur.m, 10))
    const dlTxt = `${dl.getUTCDate()} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][dl.getUTCMonth()]} ${dl.getUTCFullYear()}`
    lap.batas = '≤ ' + dlTxt
    if (P.tglTerima) {
      const tr = new Date(P.tglTerima + 'T00:00:00Z')
      const late = Math.round((tr.getTime() - dl.getTime()) / 864e5)
      lap = { nilai: P.tglTerima.split('-').reverse().join('-'), batas: '≤ ' + dlTxt, status: late <= 0 ? 'ok' : 'bad', calc: late <= 0 ? 'Disampaikan sebelum atau pada batas waktu.' : `Terlambat ${late} hari kalender.`, note: 'Bila batas jatuh pada hari libur, periksa ketentuan hari kerja berikutnya. Tanggal diterima diisi pengawas.' }
    }
  }
  T({ id: 'lapor', grp: 'Pelaporan', pasal: 'POJK 11/2026 Pasal 9 ayat (1)', judul: 'Ketepatan waktu penyampaian laporan bulanan', aturan: 'Laporan bulanan disampaikan paling lambat tanggal 10 bulan berikutnya.', refs: [], ...lap })

  // ───────────── konsistensi antar lembar ─────────────
  const checks: Check[] = []
  const tol = (a: number, b: number, rel = 1e-6) => Math.abs(a - b) <= Math.max(1, rel * Math.max(Math.abs(a), Math.abs(b)))
  const C = (id: string, judul: string, refs: (SRef | DRef | null)[], vals: number[], unit: Unit, ketFn: () => string, dampak = '', tolFn?: (v: number[]) => boolean) => {
    const R = refs.filter(Boolean) as Ref[]
    const ok = vals.filter(v => isFinite(v))
    if (ok.length < 2) { checks.push({ id, judul, status: 'na', ket: 'Data salah satu lembar tidak tersedia.', selisih: '—', refs: R, dampak: '' }); return }
    const mx = Math.max(...ok), mn = Math.min(...ok)
    const same = tolFn ? tolFn(ok) : tol(mx, mn)
    checks.push({ id, judul, status: same ? 'ok' : 'warn', ket: ketFn(), selisih: same ? '—' : (unit === 'Rp' ? rpF(mx - mn) : idn(mx - mn) + (unit === '%' ? ' pp' : unit)), refs: R, dampak: same ? '' : dampak })
  }
  const r1200 = bebanKlaim, r6100 = A.cell('6100', '6100020100')
  C('c1', 'Klaim dibayar sama di semua lembar', [klaimByr1000, r1200, r6100, dv('klDibayar')], [nv(klaimByr1000), nv(r1200), nv(r6100), val('klDibayar')], 'Rp',
    () => `1000: ${rpF(nv(klaimByr1000))}; 1200 beban klaim: ${rpF(nv(r1200))}; 6100: ${rpF(nv(r6100))}; 3500A/B dibayar: ${rpF(val('klDibayar'))}.`, 'Klaim dibayar seharusnya identik di semua lembar. Perlu konfirmasi sumber selisih (mis. beban klaim bersih penjaminan ulang, atau klaim non-kredit).')
  C('c2', 'Utang klaim di neraca sejalan dengan klaim disetujui namun belum dibayar', [dv('utangKlaim'), dv('klBelumBayar')], [val('utangKlaim'), val('klBelumBayar')], 'Rp',
    () => `Utang klaim ${rpF(val('utangKlaim'))}; disetujui belum dibayar (3500A/B) ${rpF(val('klBelumBayar'))}.`, 'Utang klaim tanpa klaim yang disetujui belum dibayar (atau sebaliknya) menandakan pencatatan tidak sejalan.')
  const sAw = A.cell('6100', '6100010000'), sAn = A.cell('6100', '6100020200'), sAk = A.cell('6100', '6100030000')
  const exp = nv(sAw) + nv(r6100) - nv(sAn)
  C('c3', 'Rekonsiliasi saldo piutang subrogasi (6100)', [sAw, r6100, sAn, sAk], [exp, nv(sAk)], 'Rp', () => `${rpF(nv(sAw))} + ${rpF(nv(r6100))} − ${rpF(nv(sAn))} = ${rpF(exp)}; saldo akhir dilaporkan ${rpF(nv(sAk))}.`)
  const ps1000 = A.cell('1000', '1000170000')
  C('c4', 'Piutang subrogasi: ikhtisar (1000) vs saldo akhir (6100)', [ps1000, sAk], [nv(ps1000), nv(sAk)], 'Rp', () => `1000: ${rpF(nv(ps1000))}; 6100: ${rpF(nv(sAk))}.`)
  const g7 = A.cell('7100', '7100030000'), g5 = A.cell('5100', '5100020000'), g1 = A.cell('1000', '1000110000')
  C('c5', 'Gearing ratio: dilaporkan (1000, 5100, 7100) vs hitung ulang', [g1, g5, g7, dv('gearing')], [nv(g1), nv(g5), nv(g7), g], '×',
    () => `1000: ${idn(nv(g1))}×; 5100: ${idn(nv(g5))}×; 7100: ${idn(nv(g7))}×; hitung ulang ${idn(g)}×.`, '', v => Math.max(...v) - Math.min(...v) < 0.05)
  C('c6', 'Rasio likuiditas: dilaporkan (5100) vs hitung ulang dari neraca', [lq5, dv('likuid')], [nv(lq5), lq], '%', () => `Dilaporkan ${idn(nv(lq5))}%; hitung ulang ${idn(lq)}%.`,
    nv(lq5) >= 120 && lq < 120 ? 'Angka dilaporkan memenuhi batas 120%, tetapi hitung ulang di bawah batas.' : 'Selisih perlu dikonfirmasi.', v => Math.max(...v) - Math.min(...v) < 0.5)
  const k5 = A.cell('5100', '5100030300'), kBr = val('klaimIjpBruto'), kBs = val('klaimIjpBersih')
  const k5v = nv(k5), basis = Math.abs(k5v - kBr) < 0.5 ? 'bruto' : Math.abs(k5v - kBs) < 0.5 ? 'bersih' : ''
  checks.push(isFinite(k5v) && isFinite(kBr) ? {
    id: 'c7', judul: 'Klaim terhadap pendapatan IJP: dilaporkan (5100) vs hitung ulang', status: basis ? 'ok' : 'warn',
    ket: `Dilaporkan ${idn(k5v)}%. Hitung ulang: terhadap IJP bruto ${idn(kBr)}%, terhadap IJP bersih ${idn(kBs)}%.` + (basis ? ` Angka perusahaan memakai IJP ${basis}.` : ''),
    selisih: basis ? '—' : idn(Math.min(Math.abs(k5v - kBr), Math.abs(k5v - kBs))) + ' pp', refs: [k5!, dv('klaimIjpBruto'), dv('klaimIjpBersih')],
    dampak: basis === 'bruto' ? 'Penyebut memakai IJP bruto; bila ketentuan penilaian kesehatan memakai IJP bersih, rasio menjadi ' + idn(kBs) + '%.' : basis ? '' : 'Basis perhitungan perusahaan tidak diketahui; perlu konfirmasi.',
  } : { id: 'c7', judul: 'Klaim terhadap pendapatan IJP: dilaporkan (5100) vs hitung ulang', status: 'na', ket: 'Data salah satu lembar tidak tersedia.', selisih: '—', refs: [], dampak: '' })
  C('c8', 'Nilai klaim per sektor (3400A/B) sama dengan klaim dibayar per status (3500A/B)', [dv('nilaiKlaim34'), dv('klDibayar')], [val('nilaiKlaim34'), val('klDibayar')], 'Rp',
    () => `3400A/B: ${rpF(val('nilaiKlaim34'))}; 3500A/B: ${rpF(val('klDibayar'))}.`, 'Kedua lembar merinci klaim yang sama dari sisi berbeda; selisih perlu dikonfirmasi.')
  const e11 = A.cell('1100', '11000302000000')
  C('c9', 'Ekuitas: ikhtisar (1000), neraca (1100), dan modal sendiri bersih (7100)', [ekuitas, e11, modal], [nv(ekuitas), nv(e11), nv(modal)], 'Rp',
    () => `1000: ${rpF(nv(ekuitas))}; 1100: ${rpF(nv(e11))}; 7100: ${rpF(nv(modal))}.`, 'Bila modal sendiri bersih berbeda dari ekuitas, pastikan pengurang yang dipakai dalam gearing.')
  const tp1000 = A.cell('1000', '1000100000')
  C('c10', 'Total penjaminan: ikhtisar (1000) vs gearing (7100)', [tp1000, totPenj], [nv(tp1000), nv(totPenj)], 'Rp', () => `1000: ${rpF(nv(tp1000))}; 7100: ${rpF(nv(totPenj))}.`)
  const iv11 = sumRefs([A.cell('1100', '11000101020000'), A.cell('1100', '11000102010000')]), iv3 = A.cell('2100B3', '2100B30500')
  C('c11', 'Jumlah investasi: ikhtisar (1000), neraca (1100), rekap SBN (2100B3)', [invTot, ...iv11.refs, iv3], [nv(invTot), iv11.value, nv(iv3)], 'Rp',
    () => `1000: ${rpF(nv(invTot))}; 1100 (lancar + tidak lancar): ${rpF(iv11.value)}; 2100B3: ${rpF(nv(iv3))}.`)
  const rd11 = sumRefs([A.cell('1100', '11000101020700'), A.cell('1100', '11000102010700')])
  C('c12', 'Reksa dana: neraca (1100) vs rincian surat berharga (2100B)', [...rd11.refs, dv('rdTot')], [rd11.value, rdAll.refs.length ? rdAll.value : 0], 'Rp',
    () => `1100: ${rpF(rd11.value)}; rincian 2100B: ${rpF(rdAll.refs.length ? rdAll.value : 0)}.`)
  const l1000 = A.cell('1000', '1000050000'), l1200 = A.cell('1200', '12000500000000')
  C('c13', 'Laba bersih: ikhtisar (1000) vs laba rugi (1200)', [l1000, l1200], [nv(l1000), nv(l1200)], 'Rp', () => `1000: ${rpF(nv(l1000))}; 1200: ${rpF(nv(l1200))}.`)

  const sum: Record<Status, number> = { ok: 0, bad: 0, warn: 0, na: 0 }
  tests.forEach(t => sum[t.status]++)

  const scn = (['berjalan', 'periode'] as Skenario[]).map(sk => ({
    sk, label: sk === 'berjalan' ? 'Klaim yang masih berjalan' : 'Seluruh klaim periode ini', ok: scnOk(sk), selisih: val('selisih:' + sk),
    steps: [
      { no: '1', label: 'Cadangan klaim menurut SAK (neraca)', value: val('cadKlaim'), dasar: 'Pasal 30 ayat (1)', refs: [dv('cadKlaim')] as Ref[] },
      { no: '2', label: 'Pembanding (a): 0,01% × nilai penjaminan ditanggung sendiri', value: val('floorA'), dasar: 'Pasal 30 ayat (2) huruf a', refs: [dv('floorA')] },
      { no: '3', label: sk === 'berjalan' ? 'Klaim yang masih berjalan (diproses) × porsi sendiri' : 'Nilai jaminan seluruh klaim dilaporkan × porsi sendiri', value: val('b1:' + sk), dasar: 'Pasal 30 ayat (2) huruf b', refs: [dv('b1:' + sk)] },
      { no: '4', label: D.ibnr.label, value: val('ibnr'), dasar: 'Pasal 30 ayat (3)', refs: [dv('ibnr')] },
      { no: '5', label: 'Pembanding (b) = langkah 3 + langkah 4', value: val('b:' + sk), dasar: '', refs: [dv('b:' + sk)] },
      { no: '6', label: 'Hasil ayat (2): yang lebih besar antara (a) dan (b)', value: val('pemb:' + sk), dasar: '', refs: [dv('pemb:' + sk)] },
      { no: '7', label: 'Cadangan klaim yang harus dipakai (ayat 4)', value: val('wajib:' + sk), dasar: 'Pasal 30 ayat (4)', refs: [dv('wajib:' + sk)] },
      { no: '8', label: 'Selisih cadangan neraca terhadap pembanding (negatif = kekurangan)', value: val('selisih:' + sk), dasar: '', refs: [dv('selisih:' + sk)] },
    ],
  }))

  const ratio = (nama: string, rep: SRef | null, id: string, unit: Unit, eps: number) => ({
    nama, dilaporkan: rep, hitung: fmtVal(val(id), unit), unit, same: rep && isFinite(val(id)) ? Math.abs(nv(rep) - val(id)) < eps : null,
  })
  const ratios = [
    ratio('Gearing ratio', g5, 'gearing', '×', 0.05),
    ratio('Rasio likuiditas', lq5, 'likuid', '%', 0.5),
    ratio('Klaim terhadap IJP (basis bruto)', k5, 'klaimIjpBruto', '%', 0.5),
    ratio('Klaim terhadap IJP (basis bersih)', k5, 'klaimIjpBersih', '%', 0.5),
  ]
  const sheetsRead = Object.values(L.sheets).map(s => ({ id: s.id, title: sheetTitle(L, s.id), rows: s.rows.length }))
  return { D, tests, checks, sum, ibnr, scn, ratios, sheetsRead }
}

/** Label pendek untuk chip sumber. */
export function refLabel(r: Ref, D: Record<string, Der>) {
  if (r.t === 's') return `${r.sheet} › ${r.addr}`
  const SHORT: Record<string, string> = {
    floorA: 'Pembanding (a)', ibnr: 'IBNR', 'b1:berjalan': 'Klaim berjalan', 'b1:periode': 'Klaim periode',
    'b:berjalan': 'Pembanding (b) berjalan', 'b:periode': 'Pembanding (b) periode', 'pemb:berjalan': 'Hasil ayat 2 · berjalan', 'pemb:periode': 'Hasil ayat 2 · periode',
    'selisih:berjalan': 'Selisih · berjalan', 'selisih:periode': 'Selisih · periode', 'wajib:berjalan': 'Cadangan wajib · berjalan', 'wajib:periode': 'Cadangan wajib · periode',
    depMax: 'Deposito per bank', rdMax: 'Reksa dana per MI', rdTot: 'Total reksa dana', tbPct: 'Tanah & bangunan', pyPct: 'Penyertaan langsung',
    cadKlaim: 'Cadangan klaim', utangKlaim: 'Utang klaim', klDiproses: 'Klaim diproses', klDibayar: 'Klaim dibayar 3500', klBelumBayar: 'Disetujui belum dibayar',
    nilaiJaminanKlaim: 'Nilai jaminan klaim 3400', nilaiKlaim34: 'Nilai klaim 3400', gearing: 'Gearing', produktif: 'Porsi produktif', likuid: 'Likuiditas',
    klaimIjpBruto: 'Klaim/IJP bruto', klaimIjpBersih: 'Klaim/IJP bersih',
  }
  if (SHORT[r.id]) return 'ƒ ' + SHORT[r.id]
  const d = D[r.id]
  return 'ƒ ' + (d ? d.label.replace(/\s*\(.*?\)\s*/g, ' ').replace(/:.*$/, '').trim().slice(0, 42) : r.id)
}
