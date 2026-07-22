/**
 * lhptl-excel-parser.ts
 * Deterministik Excel parser untuk LHPTL — menggantikan AI extraction sepenuhnya.
 * Membaca 3 file: LK tahun berjalan, TK tahun berjalan, LK tahun sebelumnya.
 * Output: ExtractedLhptlData yang langsung dipakai oleh lhptl-rules.ts (jalankanRules).
 */

import * as XLSX from 'xlsx'
import { type ExtractedLhptlData } from './lhptl-rules'

// ─── helpers ─────────────────────────────────────────────────────────────────

type WS = XLSX.WorkSheet

function getSheet(wb: XLSX.WorkBook, name: string): WS | null {
  return wb.Sheets[name] ?? null
}

/** Baca seluruh isi sheet sebagai array-of-arrays (values only). */
function rows(ws: WS | null): unknown[][] {
  if (!ws) return []
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true })
  return data as unknown[][]
}

/** Ambil nilai cell tunggal dari sheet, lax (return null jika tidak ada). */
function cellVal(ws: WS | null, addr: string): unknown {
  if (!ws) return null
  const cell = ws[addr]
  return cell ? cell.v : null
}

function toNum(v: unknown): number | null {
  if (v == null || v === '' || v === false) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toStr(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v).trim()
}

function fmtDate(v: unknown): string {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().split('T')[0]
  // Excel serial date number
  if (typeof v === 'number') {
    try {
      const d = new Date((v - 25569) * 86400 * 1000)
      return d.toISOString().split('T')[0]
    } catch { return String(v) }
  }
  return String(v).trim()
}

/** Hitung hari kerja (Sen–Jum) antara dua tanggal. */
function hariKerja(d1: Date, d2: Date): number {
  let count = 0
  const cur = new Date(d1)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(d2)
  end.setHours(0, 0, 0, 0)
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function toDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}

/** Cari baris dalam sheet berdasarkan substring di kolom tertentu, return nilai di kolom lain. */
function findRowValue(ws: WS | null, labelSubstr: string, labelCol: number, valueCol: number): unknown {
  for (const row of rows(ws)) {
    const label = toStr(row[labelCol]).toLowerCase()
    if (label.includes(labelSubstr.toLowerCase())) {
      return row[valueCol] ?? null
    }
  }
  return null
}

/** Ambil semua baris data (melewati header), mulai dari baris pertama yang kolom[nomor_col] adalah angka/string positif. */
function dataRows(ws: WS | null, nomColIdx: number = 2, minDataRow = 9): unknown[][] {
  const all = rows(ws)
  const result: unknown[][] = []
  for (let i = minDataRow; i < all.length; i++) {
    const row = all[i]
    const nomor = toStr(row[nomColIdx])
    if (!nomor || nomor === '' || isNaN(Number(nomor))) continue
    result.push(row)
  }
  return result
}

// ─── PP01 — informasi umum ───────────────────────────────────────────────────

function parsePP01(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PP01')
  return {
    alamat: (() => {
      const gedung = toStr(findRowValue(ws, 'Nama Gedung', 1, 3))
      const jalan = toStr(findRowValue(ws, 'Nama Jalan', 1, 3))
      const kel = toStr(findRowValue(ws, 'Kelurahan', 1, 3))
      const kec = toStr(findRowValue(ws, 'Kecamatan', 1, 3))
      const kota = toStr(findRowValue(ws, 'Kabupaten/Kota', 1, 3))
      const prov = toStr(findRowValue(ws, 'Provinsi', 1, 3))
      const pos = toStr(findRowValue(ws, 'Kode Pos', 1, 3))
      return [gedung, jalan, kel ? `Kel. ${kel.trim()}` : '', kec ? `Kec. ${kec.trim()}` : '', kota ? `${kota.trim()}, ${prov.trim()} ${pos}` : ''].filter(Boolean).join(', ')
    })(),
    izin_usaha: (() => {
      const nomor = toStr(findRowValue(ws, 'Nomor Izin Usaha', 1, 3))
      const tgl = toStr(findRowValue(ws, 'Tanggal Izin usaha', 1, 3))
      return nomor ? `${nomor} tanggal ${tgl}` : null
    })(),
    jumlah_kantor_cabang: toNum(findRowValue(ws, 'Jumlah Kantor Selain Kantor Pusat', 1, 3)),
    jumlah_pegawai: toNum(findRowValue(ws, 'termasuk pengurus', 1, 3)),
    jumlah_rekanan_perorangan: toNum(findRowValue(ws, 'Perorangan', 1, 3)),
    jumlah_rekanan_badan_hukum: toNum(findRowValue(ws, 'Badan Hukum', 1, 3)),
    kap_nama: toStr(findRowValue(ws, 'Kantor Akuntan Publik', 1, 3)) || null,
    akuntan_publik_nama: toStr(findRowValue(ws, 'Akuntan Publik', 1, 3)) || null,
    nomor_izin_akuntan: toStr(findRowValue(ws, 'Surat Tanda Terdaftar', 1, 3)) || null,
    opini_audit: toStr(findRowValue(ws, 'Opini', 1, 3)) || null,
  }
}

// ─── PP02 — pemegang saham ───────────────────────────────────────────────────

function parsePP02(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PP02')
  const dr = dataRows(ws, 1, 9)
  return dr
    .filter(r => toStr(r[3]).trim() !== '')
    .map(r => ({
      nama: toStr(r[3]),
      nilai_rp: toNum(r[4]) ?? 0,
      persentase: (() => {
        const p = toNum(r[5])
        return p != null ? (p < 1 ? p * 100 : p) : 0
      })(),
    }))
}

// ─── PP03 — direksi/komisaris ────────────────────────────────────────────────

function parsePP03(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PP03')
  const dr = dataRows(ws, 1, 9)
  const list = dr
    .filter(r => toStr(r[3]).trim() !== '')
    .map(r => ({
      nama: toStr(r[3]),
      jabatan: toStr(r[4]),
      surat_persetujuan_ojk: toStr(r[7]) || '',
    }))

  const komisaris = list.filter(r => r.jabatan.toLowerCase().includes('komisaris'))
  const direktur = list.filter(r => r.jabatan.toLowerCase().includes('direkt'))
  const adaKosong = list.some(r => !r.surat_persetujuan_ojk)

  return {
    direksi_komisaris: list,
    jumlah_komisaris: komisaris.length,
    jumlah_direktur: direktur.length,
    surat_persetujuan_ojk_kosong: adaKosong,
  }
}

// ─── PP04 — tenaga ahli & pialang ────────────────────────────────────────────

function parsePP04(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PP04')
  const dr = dataRows(ws, 2, 9)
  const list = dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({
      nama: toStr(r[4]),
      jabatan: toStr(r[6]),
      nomor_registrasi: toStr(r[9]) || '',
      surat_pengadministrasian_ojk: toStr(r[10]) || '',
    }))

  const tenagaAhli = list.filter(r => r.jabatan.toLowerCase().includes('tenaga ahli'))
  const pialang = list.filter(r => r.jabatan.toLowerCase().includes('pialang'))

  return {
    tenaga_ahli_pialang: list,
    jumlah_tenaga_ahli: tenagaAhli.length,
    jumlah_pialang: pialang.length,
    ada_jabatan_tenaga_ahli_kosong: tenagaAhli.length === 0,
    ada_jabatan_pialang_kosong: pialang.length === 0,
    ada_nomor_registrasi_kosong: list.some(r => !r.nomor_registrasi || r.nomor_registrasi === 'Tidak ada nomor registrasi'),
    ada_surat_pengadministrasian_ojk_kosong: list.some(r => !r.surat_pengadministrasian_ojk),
  }
}

// ─── PP06 — kantor cabang ────────────────────────────────────────────────────

function parsePP06(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PP06')
  const dr = dataRows(ws, 2, 9)
  return dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => `${toStr(r[3])}, ${toStr(r[7])}`.trim())
}

// ─── PP07 — pihak afiliasi ───────────────────────────────────────────────────

function parsePP07(wb: XLSX.WorkBook): string[] {
  const ws = getSheet(wb, 'PP07')
  const dr = dataRows(ws, 2, 8)
  return dr
    .map(r => toStr(r[4]).trim())
    .filter(Boolean)
}

// ─── PK01 — kas & setara kas (cek BPR) ──────────────────────────────────────

function parsePK01(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PK01')
  const dr = dataRows(ws, 2, 9)
  const bprRows = dr.filter(r => toStr(r[6]).toLowerCase().includes('bpr'))
  return {
    ada_bank_bpr: bprRows.length > 0,
    nama_bank_bpr: bprRows.map(r => toStr(r[5])),
  }
}

// ─── PK09 — aset lain ────────────────────────────────────────────────────────

function parsePK09(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PK09')
  const dr = dataRows(ws, 2, 9)
  const items = dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({ nama: toStr(r[4]), nilai: toNum(r[6]) ?? 0 }))
  const total = items.reduce((s, x) => s + x.nilai, 0)
  const lainLain = items.filter(r => {
    const n = r.nama.toLowerCase()
    return n.includes('lain') || n.includes('other')
  })
  return { aset_lain_lain: lainLain.length > 0 ? lainLain : null, total_aset_lain: total }
}

// ─── PK10 — utang premi (aging piutang) ──────────────────────────────────────

function parsePK10(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PK10')
  const dr = dataRows(ws, 2, 9)
  const items = dr.filter(r => toStr(r[4]).trim() !== '')
  const total = items.reduce((s, r) => s + (toNum(r[9]) ?? 0), 0)

  // aging >30 dan status sudah bayar — rule pk10_aging_piutang_lewat_30_hari_sudah_bayar
  const lewat30SudahBayar = items.filter(r => {
    const aging = toStr(r[8]).toLowerCase()
    const status = toStr(r[7]).toLowerCase()
    const sudahBayar = status.includes('sudah')
    const lewat30 = aging.includes('> 30') || aging.includes('>30') || aging.includes('90') || aging.includes('30 -')
    return sudahBayar && lewat30
  }).map(r => ({ nilai: toNum(r[9]) ?? 0 }))

  return {
    piutang_aging_lewat_30_sudah_bayar: lewat30SudahBayar.length > 0 ? lewat30SudahBayar : null,
    total_utang_premi: total,
  }
}

// ─── PK11 — utang klaim ──────────────────────────────────────────────────────

function parsePK11(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PK11')
  const dr = dataRows(ws, 2, 9)
  const items = dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({
      nama_tertanggung: toStr(r[4]),
      nama_penanggung: toStr(r[5]),
      nilai: toNum(r[8]) ?? 0,
      tanggal: fmtDate(r[7]),
    }))
  return items.length > 0 ? items : null
}

// ─── PK14 — utang lain ───────────────────────────────────────────────────────

function parsePK14(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'PK14')
  const dr = dataRows(ws, 2, 9)
  const items = dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({ nama: toStr(r[4]), nilai: toNum(r[5]) ?? 0 }))
  const total = items.reduce((s, x) => s + x.nilai, 0)
  const lainLain = items.filter(r => {
    const n = r.nama.toLowerCase()
    return n.includes('lain') || n.includes('other')
  })
  return { utang_lain_lain: lainLain.length > 0 ? lainLain : null, total_utang_lain: total }
}

// ─── LK01 — laporan posisi keuangan ─────────────────────────────────────────

function parseLK01(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'LK01')
  return {
    jumlah_aset: toNum(findRowValue(ws, 'Jumlah Aset', 1, 5)),
    kas_setara_kas: toNum(findRowValue(ws, 'Kas dan Setara Kas', 1, 5)),
    rekening_premi: toNum(findRowValue(ws, 'Rekening Premi', 1, 5)),
    rekening_operasional: toNum(findRowValue(ws, 'Rekening Operasional', 1, 5)),
    investasi: toNum(findRowValue(ws, 'Investasi', 1, 5)),
    piutang_premi: toNum(findRowValue(ws, 'Piutang Premi', 1, 5)),
    aset_tetap: toNum(findRowValue(ws, 'Aset Tetap', 1, 5)),
    aset_lain: toNum(findRowValue(ws, 'Aset Lain', 1, 5)),
    jumlah_liabilitas: toNum(findRowValue(ws, 'Jumlah Liabilitas', 1, 5)),
    utang_premi: toNum(findRowValue(ws, 'Utang Premi', 1, 5)),
    utang_klaim: toNum(findRowValue(ws, 'Utang Klaim', 1, 5)),
    utang_komisi: toNum(findRowValue(ws, 'Utang Komisi', 1, 5)),
    utang_pajak: toNum(findRowValue(ws, 'Utang Pajak', 1, 5)),
    utang_lain: toNum(findRowValue(ws, 'Utang Lain', 1, 5)),
    liabilitas_lain: toNum(findRowValue(ws, 'Liabilitas Lain', 1, 5)),
    jumlah_ekuitas: toNum(findRowValue(ws, 'Jumlah Ekuitas', 1, 5)),
    modal_disetor: toNum(findRowValue(ws, 'Modal Disetor', 1, 5)),
    tambahan_modal: toNum(findRowValue(ws, 'Tambahan Modal Disetor', 1, 5)),
    laba_ditahan: toNum(findRowValue(ws, 'Laba Ditahan', 1, 5)),
    laba_tahun_berjalan: toNum(findRowValue(ws, 'Laba Tahun Berjalan', 1, 5)),
    ekuitas_lainnya: toNum(findRowValue(ws, 'Ekuitas Lainnya', 1, 5)),
    piutang_jasa: toNum(findRowValue(ws, 'Piutang Jasa Keperantaraan', 1, 5)),
    piutang_klaim_aset: toNum(findRowValue(ws, 'Piutang Klaim', 1, 5)),
  }
}

// ─── LK02 — laporan laba rugi ────────────────────────────────────────────────

function parseLK02(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'LK02')
  return {
    pendapatan_jasa_keperantaraan: toNum(findRowValue(ws, 'Pendapatan Jasa Keperantaraan Langsung', 1, 5)),
    pendapatan_tidak_langsung: toNum(findRowValue(ws, 'Pendapatan Jasa Keperantaraan Tidak Langsung', 1, 5)),
    pendapatan_lainnya: toNum(findRowValue(ws, 'Pendapatan Lainnya', 1, 5)),
    jumlah_pendapatan: toNum(findRowValue(ws, 'Jumlah Pendapatan', 1, 5)),
    beban_pegawai: toNum(findRowValue(ws, 'Beban Pegawai dan Pengurus', 1, 5)),
    beban_diklat: toNum(findRowValue(ws, 'Beban Pendidikan dan Latihan', 1, 5)),
    beban_pemasaran: toNum(findRowValue(ws, 'Beban Pemasaran', 1, 5)),
    beban_komisi: toNum(findRowValue(ws, 'Beban Komisi', 1, 5)),
    beban_operasional_lain: toNum(findRowValue(ws, 'Beban Operasional Lain', 1, 5)),
    beban_non_operasional: toNum(findRowValue(ws, 'Beban Non Operasional', 1, 5)),
    jumlah_beban: toNum(findRowValue(ws, 'Jumlah Beban', 1, 5)),
    beban_pajak: toNum(findRowValue(ws, 'Beban Pajak', 1, 5)),
    laba_setelah_pajak: toNum(findRowValue(ws, 'Laba (Rugi) Setelah Pajak', 1, 5)),
    laba_komprehensif: toNum(findRowValue(ws, 'Laba (Rugi) Komprehensif', 1, 5)),
    beban_operasional_total: toNum(findRowValue(ws, 'Beban Operasional', 1, 5)),
  }
}

// ─── LR01 — rincian pendapatan per lini ──────────────────────────────────────

function parseLR01(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'LR01')
  const dr = dataRows(ws, 2, 10)
  return dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({
      lini_usaha: toStr(r[4]),
      premi: toNum(r[8]) ?? 0,
      pendapatan_langsung: toNum(r[9]) ?? 0,
      pendapatan_tidak_langsung: toNum(r[10]) ?? 0,
      lokasi: toStr(r[7]),
    }))
}

// ─── LR03 — pendapatan lainnya ───────────────────────────────────────────────

function parseLR03(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'LR03')
  const dr = dataRows(ws, 2, 9)
  const items = dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({ nama: toStr(r[4]), nilai: toNum(r[5]) ?? 0 }))
  const total = items.reduce((s, x) => s + x.nilai, 0)
  const lainLain = items.filter(r => {
    const n = r.nama.toLowerCase()
    return n.includes('lain') || n.includes('other')
  })
  return { items, total, lainLain: lainLain.length > 0 ? lainLain : null }
}

// ─── LR07 — beban komisi per penerima ────────────────────────────────────────

function parseLR07(wb: XLSX.WorkBook, totalBebanKomisi: number | null) {
  const ws = getSheet(wb, 'LR07')
  const dr = dataRows(ws, 2, 9)
  const raw = dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({
      nama: toStr(r[4]),
      nomor_perjanjian: toStr(r[5]),
      jumlah: toNum(r[8]) ?? 0,
    }))

  // Aggregate per nama+nomor_perjanjian
  const agg = new Map<string, { nama: string; nomor_perjanjian: string; jumlah: number }>()
  for (const r of raw) {
    const key = `${r.nama}__${r.nomor_perjanjian}`
    const ex = agg.get(key)
    if (ex) ex.jumlah += r.jumlah
    else agg.set(key, { ...r })
  }

  const sorted = [...agg.values()].sort((a, b) => b.jumlah - a.jumlah)
  const total = totalBebanKomisi ?? sorted.reduce((s, x) => s + x.jumlah, 0)

  const top10 = sorted.slice(0, 10).map(r => ({
    nama: r.nama,
    nomor_perjanjian: r.nomor_perjanjian,
    jumlah: r.jumlah,
    persentase: total > 0 ? Math.round((r.jumlah / total) * 1000) / 10 : 0,
  }))

  const tanpaPerjanjian = sorted
    .filter(r => !r.nomor_perjanjian)
    .map(r => ({ nama: r.nama }))

  return { top10, tanpaPerjanjian, total_beban_komisi: total }
}

// ─── OP01 — polis indemnitas profesi ─────────────────────────────────────────

function parseOP01(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'OP01')
  const dr = dataRows(ws, 2, 9)
  const polis = dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({
      nomor_polis: toStr(r[5]),
      penanggung: toStr(r[4]),
      nilai_pertanggungan: toNum(r[6]) ?? 0,
      masa_berlaku: `${fmtDate(r[9])} s.d. ${fmtDate(r[10])}`,
    }))

  const totalNilai = polis.reduce((s, p) => s + p.nilai_pertanggungan, 0)
  return { polis, nilai_pertanggungan: totalNilai }
}

// ─── OP02 — penanganan klaim dalam proses ────────────────────────────────────

function parseOP02(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'OP02')
  const dr = dataRows(ws, 2, 9)

  const terlambatPenerusan: Array<{ tanggal_terima: string; tanggal_penerusan: string }> = []
  const terlambatTanggapan: Array<{ tanggal_terima: string; tanggal_tanggapan: string }> = []
  const terlambatDokumen: Array<{ tanggal_dokumen_lengkap: string; tanggal_penerusan: string }> = []

  for (const r of dr) {
    if (!toStr(r[4]).trim()) continue

    const tglTerima = toDate(r[10])
    const tglPenerusan = toDate(r[11])
    const tglTanggapan = toDate(r[12])
    const tglDokumenLengkap = toDate(r[13])
    const tglPenerusanDokumen = toDate(r[14])

    // Rule: penerusan laporan > 1 hari kerja
    if (tglTerima && tglPenerusan) {
      const hk = hariKerja(tglTerima, tglPenerusan)
      if (hk > 1) {
        terlambatPenerusan.push({
          tanggal_terima: fmtDate(tglTerima),
          tanggal_penerusan: fmtDate(tglPenerusan),
        })
      }
    }

    // Rule: tanggapan tertanggung > 3 hari kerja
    if (tglTerima && tglTanggapan) {
      const hk = hariKerja(tglTerima, tglTanggapan)
      if (hk > 3) {
        terlambatTanggapan.push({
          tanggal_terima: fmtDate(tglTerima),
          tanggal_tanggapan: fmtDate(tglTanggapan),
        })
      }
    }

    // Rule: penerusan dokumen lengkap > 1 hari kerja
    if (tglDokumenLengkap && tglPenerusanDokumen) {
      const hk = hariKerja(tglDokumenLengkap, tglPenerusanDokumen)
      if (hk > 1) {
        terlambatDokumen.push({
          tanggal_dokumen_lengkap: fmtDate(tglDokumenLengkap),
          tanggal_penerusan: fmtDate(tglPenerusanDokumen),
        })
      }
    }
  }

  return {
    klaim_terlambat_penerusan: terlambatPenerusan.length > 0 ? terlambatPenerusan : null,
    klaim_terlambat_tanggapan: terlambatTanggapan.length > 0 ? terlambatTanggapan : null,
    klaim_terlambat_dokumen: terlambatDokumen.length > 0 ? terlambatDokumen : null,
  }
}

// ─── OP06 — rasio keuangan ────────────────────────────────────────────────────

function parseOP06(wb: XLSX.WorkBook) {
  const ws = getSheet(wb, 'OP06')
  // Rasio kecukupan dana atas premi ditahan (row: rasio a:b, label 'Rasio Kecukupan')
  const rasioKecukupan = toNum(findRowValue(ws, 'Rasio (a:b)', 2, 4)) // baris ke-3 Rasio (a:b) = kecukupan dana premi ditahan

  // Lebih akurat: cari dari semua row dengan label kecukupan
  let rasioKecukupanDana: number | null = null
  let rasioBebanDiklat: number | null = null
  let roa: number | null = null
  let roe: number | null = null
  let bopo: number | null = null
  let rasioPremiDitahan: number | null = null
  let rasioKomisi: number | null = null

  let section = ''
  for (const row of rows(ws)) {
    const label = toStr(row[1]).toLowerCase()
    if (label.includes('return on asset') || label.includes('roa')) section = 'roa'
    else if (label.includes('return on equity') || label.includes('roe')) section = 'roe'
    else if (label.includes('bopo')) section = 'bopo'
    else if (label.includes('rasio premi ditahan') && !label.includes('kecukupan') && !label.includes('ekuitas')) section = 'premi_ditahan'
    else if (label.includes('kecukupan dana')) section = 'kecukupan_dana'
    else if (label.includes('beban komisi')) section = 'komisi'
    else if (label.includes('biaya diklat') || label.includes('beban diklat') || label.includes('rasio biaya diklat')) section = 'diklat'

    if (label.includes('rasio (a:b)') || label.includes('rasio (b:a)') || label.includes('rasio(a:b)') || (label.includes('c.') && label.includes('rasio'))) {
      const v = toNum(row[3])
      if (v == null) continue
      // Convert decimal to percentage if abs < 5 (rasio seperti 0.108 = 10.8%)
      const vPct = Math.abs(v) < 5 ? v * 100 : v
      if (section === 'roa') roa = Math.round(vPct * 100) / 100
      else if (section === 'roe') roe = Math.round(vPct * 100) / 100
      else if (section === 'bopo') bopo = Math.round(vPct * 100) / 100
      else if (section === 'premi_ditahan') rasioPremiDitahan = Math.round(vPct * 100) / 100
      else if (section === 'kecukupan_dana') rasioKecukupanDana = Math.round(vPct * 100) / 100
      else if (section === 'komisi') rasioKomisi = Math.round(vPct * 100) / 100
      else if (section === 'diklat') {
        // Rasio diklat = b:a, dalam persen
        rasioBebanDiklat = Math.round(vPct * 100) / 100
      }
    }

    // Kewajiban diklat row — tidak dipakai langsung tapi untuk verifikasi
    void rasioKecukupan
  }

  return { rasioKecukupanDana, rasioBebanDiklat, roa, roe, bopo, rasioPremiDitahan, rasioKomisi }
}

// ─── FKRT — frekuensi rapat ──────────────────────────────────────────────────

function parseFKRT(wbTk: XLSX.WorkBook) {
  const ws = getSheet(wbTk, 'FKRT')
  const dr = dataRows(ws, 2, 9)

  // Hitung rapat per orang per jabatan per bulan (unique meeting per bulan)
  const rapatDireksi = new Set<string>()
  const rapatKomisaris = new Set<string>()
  const rapatPerBulan = new Map<string, number>()

  for (const r of dr) {
    const bulan = toStr(r[4]).trim()
    const jabatan = toStr(r[6]).toLowerCase()
    const jumlah = toNum(r[10]) ?? 0
    if (!bulan || jumlah === 0) continue

    const isDir = jabatan.includes('direkt')
    const isKom = jabatan.includes('komisaris')
    const key = `${bulan}__${jabatan}`

    if (isDir && !rapatDireksi.has(key)) {
      rapatDireksi.add(key)
      // Count unique months for direksi
    }
    if (isKom && !rapatKomisaris.has(key)) {
      rapatKomisaris.add(key)
    }

    // Count unique meetings per month across all members
    const monthKey = `${bulan}__${isDir ? 'dir' : 'kom'}`
    if (!rapatPerBulan.has(monthKey)) rapatPerBulan.set(monthKey, 0)
    rapatPerBulan.set(monthKey, (rapatPerBulan.get(monthKey) ?? 0) + 1)
  }

  // Count unique months with direksi meetings and komisaris meetings
  const monthsDir = new Set<string>()
  const monthsKom = new Set<string>()
  const monthCounts = new Map<string, number>()

  for (const r of dr) {
    const bulan = toStr(r[4]).trim()
    const jabatan = toStr(r[6]).toLowerCase()
    const jumlah = toNum(r[10]) ?? 0
    if (!bulan || jumlah === 0) continue

    if (jabatan.includes('direkt')) monthsDir.add(bulan)
    if (jabatan.includes('komisaris')) monthsKom.add(bulan)
    if (!monthCounts.has(bulan)) monthCounts.set(bulan, 0)
  }

  // Build description: "Total X kali rapat: Bulan1 (Y kali); Bulan2 (Z kali); ..."
  const monthOrder = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const countByMonth = new Map<string, number>()
  for (const r of dr) {
    const bulan = toStr(r[4]).trim()
    const jumlah = toNum(r[10]) ?? 0
    if (!bulan || jumlah === 0) continue
    // Count per month as 1 rapat (not per person)
    if (!countByMonth.has(bulan)) countByMonth.set(bulan, 0)
    countByMonth.set(bulan, (countByMonth.get(bulan) ?? 0) + 1)
  }

  // Better: count unique bulan+resume pairs (distinct meetings)
  const meetingSet = new Set<string>()
  for (const r of dr) {
    const bulan = toStr(r[4]).trim()
    const resume = toStr(r[12]).trim()
    if (!bulan) continue
    meetingSet.add(`${bulan}__${resume}`)
  }

  const uniqueMonthsDir = monthsDir.size
  const uniqueMonthsKom = monthsKom.size

  // Count distinct dir rapat per month
  const dirRapatPerMonth = new Map<string, Set<string>>()
  const komRapatPerMonth = new Map<string, Set<string>>()
  for (const r of dr) {
    const bulan = toStr(r[4]).trim()
    const jabatan = toStr(r[6]).toLowerCase()
    const resume = toStr(r[12]).trim()
    if (!bulan) continue
    if (jabatan.includes('direkt')) {
      if (!dirRapatPerMonth.has(bulan)) dirRapatPerMonth.set(bulan, new Set())
      dirRapatPerMonth.get(bulan)!.add(resume)
    }
    if (jabatan.includes('komisaris')) {
      if (!komRapatPerMonth.has(bulan)) komRapatPerMonth.set(bulan, new Set())
      komRapatPerMonth.get(bulan)!.add(resume)
    }
  }

  const jumlahRapatDireksi = uniqueMonthsDir
  const jumlahRapatKomisaris = uniqueMonthsKom

  // Build deskripsi rapat
  const allMonths = [...new Set([...monthsDir, ...monthsKom])]
  allMonths.sort((a, b) => (monthOrder.indexOf(a) - monthOrder.indexOf(b)) || a.localeCompare(b))
  const parts = allMonths.map(m => `${m} (1 kali)`)
  const total = allMonths.length
  const deskripsi = `Total ${total} kali rapat: ${parts.join('; ')}.`

  return { jumlahRapatDireksi, jumlahRapatKomisaris, deskripsi }
}

// ─── HKKS / HKKM / HKGD / HKDR — hubungan keluarga & keuangan ───────────────

type HubunganEntry = { nama: string; jabatan: string; status_komisaris: string; status_direksi: string; status_ps: string }

function parseHubungan(wbTk: XLSX.WorkBook, sheetName: string): HubunganEntry[] | null {
  const ws = getSheet(wbTk, sheetName)
  const dr = dataRows(ws, 2, 9)
  const items = dr
    .filter(r => toStr(r[4]).trim() !== '' && toStr(r[4]).trim().toUpperCase() !== 'TIDAK ADA')
    .map(r => ({
      nama: toStr(r[4]),
      jabatan: toStr(r[5]),
      status_komisaris: toStr(r[6]) || '-',
      status_direksi: toStr(r[8]) || '-',
      status_ps: toStr(r[10]) || '-',
    }))
  return items.length > 0 ? items : null
}

// ─── RJBT — rangkap jabatan ──────────────────────────────────────────────────

function parseRJBT(wbTk: XLSX.WorkBook) {
  const ws = getSheet(wbTk, 'RJBT')
  const dr = dataRows(ws, 2, 8)
  const items = dr
    .filter(r => toStr(r[4]).trim() !== '' && toStr(r[4]).trim().toUpperCase() !== 'TIDAK ADA')
    .map(r => ({
      nama: toStr(r[4]),
      posisi: toStr(r[5]),
      perusahaan_lain: toStr(r[7]),
      bidang_usaha: toStr(r[8]),
    }))
  return items.length > 0 ? items : null
}

// ─── TPKP — RUPS ─────────────────────────────────────────────────────────────

function parseTPKP(wbTk: XLSX.WorkBook) {
  const ws = getSheet(wbTk, 'TPKP')
  const dr = dataRows(ws, 2, 8)
  const items = dr
    .filter(r => r[4] !== null && toStr(r[4]).trim() !== '')
    .map(r => ({
      tanggal: fmtDate(r[4]),
      keputusan: toStr(r[7]),
    }))
  return items.length > 0 ? items : null
}

// ─── PP03 prev year (dari wbPrev LK) ─────────────────────────────────────────

function parsePP03Prev(wbPrev: XLSX.WorkBook) {
  const ws = getSheet(wbPrev, 'PP03')
  if (!ws) return []
  const dr = dataRows(ws, 1, 9)
  return dr
    .filter(r => toStr(r[3]).trim() !== '')
    .map(r => ({ nama: toStr(r[3]), jabatan: toStr(r[4]) }))
}

function parsePP04Prev(wbPrev: XLSX.WorkBook) {
  const ws = getSheet(wbPrev, 'PP04')
  if (!ws) return []
  const dr = dataRows(ws, 2, 9)
  return dr
    .filter(r => toStr(r[4]).trim() !== '')
    .map(r => ({ nama: toStr(r[4]), jabatan: toStr(r[6]) }))
}

function parsePP02Prev(wbPrev: XLSX.WorkBook) {
  const ws = getSheet(wbPrev, 'PP02')
  if (!ws) return []
  const dr = dataRows(ws, 1, 9)
  return dr
    .filter(r => toStr(r[3]).trim() !== '')
    .map(r => ({
      nama: toStr(r[3]),
      nilai_rp: toNum(r[4]) ?? 0,
      persentase: (() => {
        const p = toNum(r[5])
        return p != null ? (p < 1 ? p * 100 : p) : 0
      })(),
    }))
}

function parseLK02Prev(wbPrev: XLSX.WorkBook) {
  const ws = getSheet(wbPrev, 'LK02')
  if (!ws) return { beban_komisi: null }
  return {
    beban_komisi: toNum(findRowValue(ws, 'Beban Komisi', 2, 6)),
  }
}

// ─── Neraca & L/R tabel (untuk section B financial highlight) ────────────────

function buildNeracaLR(
  lk01: ReturnType<typeof parseLK01>,
  lk02: ReturnType<typeof parseLK02>,
  lk01Prev: ReturnType<typeof parseLK01>,
  lk02Prev: ReturnType<typeof parseLK02>,
): Array<{ label: string; nilai_ini: number | null; nilai_lalu: number | null }> {
  return [
    { label: 'Jumlah Aset', nilai_ini: lk01.jumlah_aset, nilai_lalu: lk01Prev.jumlah_aset },
    { label: 'Kas dan Setara Kas', nilai_ini: lk01.kas_setara_kas, nilai_lalu: lk01Prev.kas_setara_kas },
    { label: 'Rekening Premi', nilai_ini: lk01.rekening_premi, nilai_lalu: lk01Prev.rekening_premi },
    { label: 'Rekening Operasional', nilai_ini: lk01.rekening_operasional, nilai_lalu: lk01Prev.rekening_operasional },
    { label: 'Investasi', nilai_ini: lk01.investasi, nilai_lalu: lk01Prev.investasi },
    { label: 'Piutang Premi', nilai_ini: lk01.piutang_premi, nilai_lalu: lk01Prev.piutang_premi },
    { label: 'Piutang Jasa Keperantaraan', nilai_ini: lk01.piutang_jasa, nilai_lalu: lk01Prev.piutang_jasa },
    { label: 'Piutang Klaim', nilai_ini: lk01.piutang_klaim_aset, nilai_lalu: lk01Prev.piutang_klaim_aset },
    { label: 'Piutang Konsultasi', nilai_ini: 0, nilai_lalu: 0 },
    { label: 'Piutang Jasa Penanganan Klaim', nilai_ini: 0, nilai_lalu: 0 },
    { label: 'Aset Tetap', nilai_ini: lk01.aset_tetap, nilai_lalu: lk01Prev.aset_tetap },
    { label: 'Aset Lain', nilai_ini: lk01.aset_lain, nilai_lalu: lk01Prev.aset_lain },
    { label: 'Jumlah Liabilitas', nilai_ini: lk01.jumlah_liabilitas, nilai_lalu: lk01Prev.jumlah_liabilitas },
    { label: 'Utang Premi', nilai_ini: lk01.utang_premi, nilai_lalu: lk01Prev.utang_premi },
    { label: 'Utang Klaim', nilai_ini: lk01.utang_klaim, nilai_lalu: lk01Prev.utang_klaim },
    { label: 'Utang Komisi', nilai_ini: lk01.utang_komisi, nilai_lalu: lk01Prev.utang_komisi },
    { label: 'Utang Pajak', nilai_ini: lk01.utang_pajak, nilai_lalu: lk01Prev.utang_pajak },
    { label: 'Utang Lain', nilai_ini: lk01.utang_lain, nilai_lalu: lk01Prev.utang_lain },
    { label: 'Liabilitas Lain', nilai_ini: lk01.liabilitas_lain, nilai_lalu: lk01Prev.liabilitas_lain },
    { label: 'Jumlah Ekuitas', nilai_ini: lk01.jumlah_ekuitas, nilai_lalu: lk01Prev.jumlah_ekuitas },
    { label: 'Modal Disetor', nilai_ini: lk01.modal_disetor, nilai_lalu: lk01Prev.modal_disetor },
    { label: 'Tambahan Modal Disetor', nilai_ini: lk01.tambahan_modal, nilai_lalu: lk01Prev.tambahan_modal },
    { label: 'Laba Ditahan', nilai_ini: lk01.laba_ditahan, nilai_lalu: lk01Prev.laba_ditahan },
    { label: 'Laba Tahun Berjalan', nilai_ini: lk01.laba_tahun_berjalan, nilai_lalu: lk01Prev.laba_tahun_berjalan },
    { label: 'Ekuitas Lainnya', nilai_ini: lk01.ekuitas_lainnya, nilai_lalu: lk01Prev.ekuitas_lainnya },
    { label: 'Jumlah Pendapatan', nilai_ini: lk02.jumlah_pendapatan, nilai_lalu: lk02Prev.jumlah_pendapatan },
    { label: 'Pendapatan Jasa Keperantaraan', nilai_ini: lk02.pendapatan_jasa_keperantaraan, nilai_lalu: lk02Prev.pendapatan_jasa_keperantaraan },
    { label: 'Pendapatan Jasa Keperantaraan Langsung', nilai_ini: lk02.pendapatan_jasa_keperantaraan, nilai_lalu: lk02Prev.pendapatan_jasa_keperantaraan },
    { label: 'Pendapatan Jasa Keperantaraan Tidak Langsung', nilai_ini: lk02.pendapatan_tidak_langsung, nilai_lalu: lk02Prev.pendapatan_tidak_langsung },
    { label: '-/- Pendapatan Jasa Keperantaaran Perusahaan Lain – Member Cobroking', nilai_ini: 0, nilai_lalu: 0 },
    { label: 'Pendapatan Jasa Konsultasi', nilai_ini: 0, nilai_lalu: 0 },
    { label: 'Pendapatan Jasa Penanganan Klaim', nilai_ini: 0, nilai_lalu: 0 },
    { label: 'Pendapatan Lainnya', nilai_ini: lk02.pendapatan_lainnya, nilai_lalu: lk02Prev.pendapatan_lainnya },
    { label: 'Jumlah Beban', nilai_ini: lk02.jumlah_beban, nilai_lalu: lk02Prev.jumlah_beban },
    { label: 'Beban Operasional', nilai_ini: lk02.beban_operasional_total, nilai_lalu: lk02Prev.beban_operasional_total },
    { label: 'Beban Pegawai dan Pengurus', nilai_ini: lk02.beban_pegawai, nilai_lalu: lk02Prev.beban_pegawai },
    { label: 'Beban Pelatihan dan Pendidikan', nilai_ini: lk02.beban_diklat, nilai_lalu: lk02Prev.beban_diklat },
    { label: 'Beban Pemasaran', nilai_ini: lk02.beban_pemasaran, nilai_lalu: lk02Prev.beban_pemasaran },
    { label: 'Beban Komisi', nilai_ini: lk02.beban_komisi, nilai_lalu: lk02Prev.beban_komisi },
    { label: 'Beban Operasional Lain', nilai_ini: lk02.beban_operasional_lain, nilai_lalu: lk02Prev.beban_operasional_lain },
    { label: 'Beban Non Operasional', nilai_ini: lk02.beban_non_operasional, nilai_lalu: lk02Prev.beban_non_operasional },
    { label: 'Beban Pajak', nilai_ini: lk02.beban_pajak, nilai_lalu: lk02Prev.beban_pajak },
    { label: 'Laba (Rugi) Komprehensif', nilai_ini: lk02.laba_komprehensif, nilai_lalu: lk02Prev.laba_komprehensif },
  ]
}

// ─── nama di PK sheets (untuk rule pp07) ─────────────────────────────────────

function collectNamaDiPKSheets(wb: XLSX.WorkBook): string[] {
  const result = new Set<string>()

  // PK01: nama bank
  for (const r of dataRows(getSheet(wb, 'PK01'), 2, 9)) {
    const v = toStr(r[5]).toLowerCase().trim()
    if (v) result.add(v)
  }
  // PK03: nama instrumen investasi
  const ws03 = getSheet(wb, 'PK03')
  if (ws03) {
    for (const r of dataRows(ws03, 2, 9)) {
      const v = toStr(r[4]).toLowerCase().trim()
      if (v) result.add(v)
    }
  }
  // PK09: nama aset lain
  for (const r of dataRows(getSheet(wb, 'PK09'), 2, 9)) {
    const v = toStr(r[4]).toLowerCase().trim()
    if (v) result.add(v)
  }
  // PK10: nama penanggung
  for (const r of dataRows(getSheet(wb, 'PK10'), 2, 9)) {
    const v = toStr(r[5]).toLowerCase().trim()
    if (v) result.add(v)
  }

  return [...result]
}

// ─── LK02 prev (from wbPrev) ─────────────────────────────────────────────────

function parseLK01Prev(wbPrev: XLSX.WorkBook): ReturnType<typeof parseLK01> {
  const ws = getSheet(wbPrev, 'LK01')
  if (!ws) return parseLK01({ Sheets: {}, SheetNames: [] } as unknown as XLSX.WorkBook)
  return parseLK01(wbPrev)
}

function parseLK02Prev2(wbPrev: XLSX.WorkBook): ReturnType<typeof parseLK02> {
  const ws = getSheet(wbPrev, 'LK02')
  if (!ws) return parseLK02({ Sheets: {}, SheetNames: [] } as unknown as XLSX.WorkBook)
  return parseLK02(wbPrev)
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function parseLhptlExcel(
  bufLk: Buffer,
  bufTk: Buffer,
  bufLkPrev: Buffer,
  namaEntitas: string,
  jenisEntitas: 'pialang_asuransi' | 'pialang_reasuransi',
  periode: string,
): ExtractedLhptlData {
  const wbLk = XLSX.read(bufLk, { type: 'buffer', cellDates: true })
  const wbTk = XLSX.read(bufTk, { type: 'buffer', cellDates: true })
  const wbLkPrev = XLSX.read(bufLkPrev, { type: 'buffer', cellDates: true })

  // ── parse semua sheet ──────────────────────────────────────────────────────
  const pp01 = parsePP01(wbLk)
  const pp02 = parsePP02(wbLk)
  const pp03 = parsePP03(wbLk)
  const pp04 = parsePP04(wbLk)
  const pp06 = parsePP06(wbLk)
  const pp07 = parsePP07(wbLk)

  const pk01 = parsePK01(wbLk)
  const pk09 = parsePK09(wbLk)
  const pk10 = parsePK10(wbLk)
  const pk11 = parsePK11(wbLk)
  const pk14 = parsePK14(wbLk)

  const lk01 = parseLK01(wbLk)
  const lk02 = parseLK02(wbLk)
  const lr01 = parseLR01(wbLk)
  const lr03 = parseLR03(wbLk)
  const lr07 = parseLR07(wbLk, lk02.beban_komisi)
  const op01 = parseOP01(wbLk)
  const op02 = parseOP02(wbLk)
  const op06 = parseOP06(wbLk)

  const fkrt = parseFKRT(wbTk)
  const hkks = parseHubungan(wbTk, 'HKKS')
  const hkkm = parseHubungan(wbTk, 'HKKM')
  const hkgd = parseHubungan(wbTk, 'HKGD')
  const hkdr = parseHubungan(wbTk, 'HKDR')
  const rjbt = parseRJBT(wbTk)
  const tpkp = parseTPKP(wbTk)

  // prev year
  const pp02Prev = parsePP02Prev(wbLkPrev)
  const pp03Prev = parsePP03Prev(wbLkPrev)
  const pp04Prev = parsePP04Prev(wbLkPrev)
  const lk01Prev = parseLK01Prev(wbLkPrev)
  const lk02Prev = parseLK02Prev2(wbLkPrev)

  const namaDiPk = collectNamaDiPKSheets(wbLk)

  // OP01: kantor cabang deskripsi
  const kantorCabangDesc = pp06.length > 0
    ? pp06.join('; ')
    : null

  // Polis indemnitas
  const polisDesc = op01.polis.length > 0 ? op01.polis : null

  // Sanksi: ambil dari sheet PP yang ada — untuk PT Independen tidak ada sanksi
  // Field sanksi: null (tidak ada sheet khusus, biasanya manual)
  const sanksi = null

  // Rasio keuangan tabel
  const rasioKeuanganTabel: Array<{ label: string; nilai_ini: number | null; nilai_lalu: number | null }> = []
  if (op06.roa != null) {
    const prevRoa = lk01Prev.jumlah_aset && lk02Prev.laba_setelah_pajak
      ? Math.round((lk02Prev.laba_setelah_pajak / lk01Prev.jumlah_aset) * 10000) / 100
      : null
    rasioKeuanganTabel.push({ label: 'ROA', nilai_ini: op06.roa, nilai_lalu: prevRoa })
  }
  if (op06.roe != null) {
    const prevRoe = lk01Prev.jumlah_ekuitas && lk02Prev.laba_setelah_pajak
      ? Math.round((lk02Prev.laba_setelah_pajak / lk01Prev.jumlah_ekuitas) * 10000) / 100
      : null
    rasioKeuanganTabel.push({ label: 'ROE', nilai_ini: op06.roe, nilai_lalu: prevRoe })
  }
  if (op06.bopo != null) rasioKeuanganTabel.push({ label: 'BOPO', nilai_ini: op06.bopo, nilai_lalu: null })
  if (op06.rasioPremiDitahan != null) rasioKeuanganTabel.push({ label: 'Rasio Premi Ditahan', nilai_ini: op06.rasioPremiDitahan, nilai_lalu: null })
  if (op06.rasioKecukupanDana != null) rasioKeuanganTabel.push({ label: 'Rasio Kecukupan Dana atas Premi Ditahan', nilai_ini: op06.rasioKecukupanDana, nilai_lalu: null })
  if (op06.rasioKomisi != null) rasioKeuanganTabel.push({ label: 'Rasio Beban Komisi Terhadap Pendapatan', nilai_ini: op06.rasioKomisi, nilai_lalu: null })
  if (op06.rasioBebanDiklat != null) rasioKeuanganTabel.push({ label: 'Rasio Beban Pendidikan terhadap Beban Pegawai', nilai_ini: op06.rasioBebanDiklat, nilai_lalu: null })

  // Data umum sheet — nama perusahaan, periode (fallback ke parameter jika tidak tersedia)
  const duNamaPerusahaan = namaEntitas
  const duPeriode = periode

  // Izin usaha dari Data Umum (lebih lengkap dari PP01 izin usaha)
  const dataUmumWs = getSheet(wbLk, 'Data Umum')
  const nomizin = toStr(findRowValue(dataUmumWs, 'Nomor Izin', 1, 3) ?? findRowValue(dataUmumWs, 'Kode Auditor', 1, 3))
  const izinUsahaFinal = pp01.izin_usaha ?? (nomizin || null)

  // Nomor registrasi akuntan dari Data Umum
  const nomorIzinAkuntan = toStr(findRowValue(dataUmumWs, 'SK Izin Auditor', 1, 2) ?? null) || pp01.nomor_izin_akuntan
  const nomorRegistrasiAkuntan = toStr(findRowValue(dataUmumWs, 'Kode Auditor', 1, 2) ?? null) || null

  return {
    // Identitas
    nama_perusahaan: duNamaPerusahaan,
    jenis_entitas: jenisEntitas,
    periode: duPeriode,

    // PP01
    jumlah_rekanan_perorangan: pp01.jumlah_rekanan_perorangan,
    jumlah_rekanan_badan_hukum: pp01.jumlah_rekanan_badan_hukum,
    beban_komisi_lk02: lk02.beban_komisi,

    // PP02
    pemegang_saham: pp02,
    pemegang_saham_prev: pp02Prev,

    // PP03
    jumlah_komisaris: pp03.jumlah_komisaris,
    jumlah_direktur: pp03.jumlah_direktur,
    direksi_komisaris: pp03.direksi_komisaris,
    direksi_komisaris_prev: pp03Prev,
    surat_persetujuan_ojk_kosong: pp03.surat_persetujuan_ojk_kosong,

    // PP04
    tenaga_ahli_pialang: pp04.tenaga_ahli_pialang,
    tenaga_ahli_pialang_prev: pp04Prev,
    jumlah_tenaga_ahli: pp04.jumlah_tenaga_ahli,
    jumlah_pialang: pp04.jumlah_pialang,
    ada_jabatan_tenaga_ahli_kosong: pp04.ada_jabatan_tenaga_ahli_kosong,
    ada_jabatan_pialang_kosong: pp04.ada_jabatan_pialang_kosong,
    ada_nomor_registrasi_kosong: pp04.ada_nomor_registrasi_kosong,
    ada_surat_pengadministrasian_ojk_kosong: pp04.ada_surat_pengadministrasian_ojk_kosong,

    // PK01
    ada_bank_bpr: pk01.ada_bank_bpr,
    nama_bank_bpr: pk01.nama_bank_bpr,

    // PK09
    aset_lain_lain: pk09.aset_lain_lain,
    total_aset_lain: pk09.total_aset_lain,

    // PK10
    piutang_aging_lewat_30_sudah_bayar: pk10.piutang_aging_lewat_30_sudah_bayar,
    total_utang_premi: pk10.total_utang_premi,

    // PK11
    utang_klaim: pk11,

    // PK14
    utang_lain_lain: pk14.utang_lain_lain,
    total_utang_lain: pk14.total_utang_lain,

    // LK01/LK02
    jumlah_ekuitas: lk01.jumlah_ekuitas,
    beban_komisi_prev: lk02Prev.beban_komisi ?? parseLK02Prev(wbLkPrev).beban_komisi,

    // LR01
    lr01_data: lr01.length > 0 ? lr01 : null,

    // LR03
    pendapatan_lain_lain: lr03.lainLain,
    total_pendapatan_lain: lr03.total,
    pendapatan_jasa_keperantaraan: lk02.pendapatan_jasa_keperantaraan,

    // LR07
    top10_penerima_komisi: lr07.top10.length > 0 ? lr07.top10 : null,
    total_beban_komisi: lr07.total_beban_komisi,
    ada_komisi_tanpa_perjanjian: lr07.tanpaPerjanjian.length > 0 ? lr07.tanpaPerjanjian : null,

    // OP01
    nilai_pertanggungan_op01: op01.nilai_pertanggungan,
    pendapatan_lk02: lk02.jumlah_pendapatan,
    pendapatan_lainnya_lk02: lk02.pendapatan_lainnya,

    // OP02
    klaim_terlambat_penerusan: op02.klaim_terlambat_penerusan,
    klaim_terlambat_tanggapan: op02.klaim_terlambat_tanggapan,
    klaim_terlambat_dokumen: op02.klaim_terlambat_dokumen,

    // OP06
    rasio_kecukupan_dana_premi_ditahan: op06.rasioKecukupanDana,
    rasio_biaya_diklat: op06.rasioBebanDiklat,

    // FKRT
    jumlah_rapat_direksi: fkrt.jumlahRapatDireksi,
    jumlah_rapat_komisaris: fkrt.jumlahRapatKomisaris,
    deskripsi_rapat: fkrt.deskripsi,

    // HK*
    hubungan_keluarga_komisaris: hkks,
    hubungan_keuangan_komisaris: hkkm,
    hubungan_keluarga_direksi: hkgd,
    hubungan_keuangan_direksi: hkdr,

    // RJBT
    rangkap_jabatan: rjbt,

    // TPKP
    rups: tpkp,

    // PP07
    pihak_afiliasi: pp07,
    nama_di_pk_sheets: namaDiPk,

    // Section A — informasi umum
    alamat: pp01.alamat,
    izin_usaha: izinUsahaFinal,
    kantor_cabang: kantorCabangDesc,
    jumlah_pegawai: pp01.jumlah_pegawai,
    kap_nama: pp01.kap_nama,
    akuntan_publik_nama: pp01.akuntan_publik_nama,
    nomor_izin_akuntan: nomorIzinAkuntan || null,
    nomor_registrasi_akuntan: nomorRegistrasiAkuntan,
    opini_audit: pp01.opini_audit,
    tka: null, // PP05 — kosong
    polis_indemnitas: polisDesc,
    sanksi,

    // Section B — financial highlight
    neraca_laba_rugi: buildNeracaLR(lk01, lk02, lk01Prev, lk02Prev),
    rasio_keuangan_tabel: rasioKeuanganTabel.length > 0 ? rasioKeuanganTabel : null,
  }
}
