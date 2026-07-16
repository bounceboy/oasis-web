/**
 * lhptl.ts
 * Koordinasi modul LHPTL:
 * 1. AI extraction dari raw sheet text → ExtractedLhptlData
 * 2. Jalankan 44 rules → HasilPengawasan[]
 * 3. AI generate KESIMPULAN + TINDAK LANJUT
 * 4. Generate .docx
 */

import { callOpenRouter } from '@/lib/claude'
import { type SheetText } from '@/lib/xlsx-extractor'
import { jalankanRules, type ExtractedLhptlData, type HasilPengawasan } from '@/lib/lhptl-rules'

export type { HasilPengawasan }

export interface LhptlHasil {
  nama_perusahaan: string
  jenis_entitas: string
  periode: string
  hasil_pengawasan: HasilPengawasan[]
  kesimpulan: string
  tindak_lanjut: string
  ringkasan: {
    total: number
    pelanggaran: number
    perlu_perhatian: number
    informasional: number
  }
}

// Repair JSON yang terpotong karena max_tokens tercapai
function parseJsonSafe(raw: string): unknown {
  // Coba parse langsung
  try { return JSON.parse(raw) } catch (_) { /* truncated */ }

  // Coba tutup bracket/brace yang terbuka
  let s = raw.trimEnd()
  // Hapus trailing koma/karakter tanggung
  s = s.replace(/[,\s]+$/, '')

  // Hitung dan tutup bracket yang belum ditutup
  const stack: string[] = []
  let inStr = false
  let escape = false
  for (const ch of s) {
    if (escape) { escape = false; continue }
    if (ch === '\\' && inStr) { escape = true; continue }
    if (ch === '"' && !escape) { inStr = !inStr; continue }
    if (!inStr) {
      if (ch === '{') stack.push('}')
      else if (ch === '[') stack.push(']')
      else if (ch === '}' || ch === ']') stack.pop()
    }
  }
  // Tutup semua yang terbuka
  s += stack.reverse().join('')

  try { return JSON.parse(s) } catch (e) {
    throw new Error(`JSON tidak dapat diparsing: ${e instanceof Error ? e.message : e}`)
  }
}

// ─── Step 1: AI extraction ────────────────────────────────────────────────────

export async function ekstrakDataLhptl(
  sheets: SheetText[],
  namaEntitas: string,
  jenisEntitas: 'pialang_asuransi' | 'pialang_reasuransi',
  periode: string
): Promise<ExtractedLhptlData> {
  const sheetText = sheets.map((s) => `=== SHEET: ${s.name} ===\n${s.text}`).join('\n\n')

  const system = `Anda adalah analis keuangan OJK yang mengekstrak data terstruktur dari Form Laporan Keuangan Pialang Asuransi (format Excel, disajikan sebagai tabel teks).

Output HARUS berupa JSON valid saja, tidak ada teks lain. Jika field tidak ditemukan, gunakan null (bukan string "null").
Angka: tanpa titik ribuan, tanpa Rp. Contoh: 1000000 bukan "1.000.000" atau "Rp1.000.000".
Tanggal: format YYYY-MM-DD jika bisa, atau string apa adanya jika tidak jelas.`

  const user = `Perusahaan: ${namaEntitas} (${jenisEntitas}), Periode: ${periode}

DATA EXCEL:
${sheetText.slice(0, 140000)}

Ekstrak ke JSON berikut (isi semua field, null jika tidak ada):
{
  "nama_perusahaan": string,
  "jenis_entitas": "pialang_asuransi"|"pialang_reasuransi",
  "periode": string,
  "jumlah_rekanan_perorangan": number|null,
  "jumlah_rekanan_badan_hukum": number|null,
  "beban_komisi_lk02": number|null,
  "pemegang_saham": [{"nama":string,"nilai_rp":number,"persentase":number}],
  "pemegang_saham_prev": [{"nama":string,"nilai_rp":number,"persentase":number}],
  "jumlah_komisaris": number|null,
  "jumlah_direktur": number|null,
  "direksi_komisaris": [{"nama":string,"jabatan":string,"surat_persetujuan_ojk":string}],
  "direksi_komisaris_prev": [{"nama":string,"jabatan":string}],
  "surat_persetujuan_ojk_kosong": boolean,
  "tenaga_ahli_pialang": [{"nama":string,"jabatan":string,"nomor_registrasi":string,"surat_pengadministrasian_ojk":string}],
  "tenaga_ahli_pialang_prev": [{"nama":string,"jabatan":string}],
  "jumlah_tenaga_ahli": number|null,
  "jumlah_pialang": number|null,
  "ada_jabatan_tenaga_ahli_kosong": boolean,
  "ada_jabatan_pialang_kosong": boolean,
  "ada_nomor_registrasi_kosong": boolean,
  "ada_surat_pengadministrasian_ojk_kosong": boolean,
  "ada_bank_bpr": boolean,
  "nama_bank_bpr": [string],
  "aset_lain_lain": [{"nama":string,"nilai":number}]|null,
  "total_aset_lain": number|null,
  "piutang_aging_lewat_30_sudah_bayar": [{"nilai":number}]|null,
  "total_utang_premi": number|null,
  "utang_klaim": [{"nama_tertanggung":string,"nama_penanggung":string,"nilai":number,"tanggal":string}]|null,
  "utang_lain_lain": [{"nama":string,"nilai":number}]|null,
  "total_utang_lain": number|null,
  "jumlah_ekuitas": number|null,
  "beban_komisi_prev": number|null,
  "lr01_data": [{"lini_usaha":string,"premi":number,"pendapatan_langsung":number,"pendapatan_tidak_langsung":number,"lokasi":string}]|null,
  "pendapatan_lain_lain": [{"nama":string,"nilai":number}]|null,
  "total_pendapatan_lain": number|null,
  "pendapatan_jasa_keperantaraan": number|null,
  "top10_penerima_komisi": [{"nama":string,"nomor_perjanjian":string,"jumlah":number,"persentase":number}]|null,
  "total_beban_komisi": number|null,
  "ada_komisi_tanpa_perjanjian": [{"nama":string}]|null,
  "nilai_pertanggungan_op01": number|null,
  "pendapatan_lk02": number|null,
  "pendapatan_lainnya_lk02": number|null,
  "klaim_terlambat_penerusan": [{"tanggal_terima":string,"tanggal_penerusan":string}]|null,
  "klaim_terlambat_tanggapan": [{"tanggal_terima":string,"tanggal_tanggapan":string}]|null,
  "klaim_terlambat_dokumen": [{"tanggal_dokumen_lengkap":string,"tanggal_penerusan":string}]|null,
  "rasio_kecukupan_dana_premi_ditahan": number|null,
  "rasio_biaya_diklat": number|null,
  "jumlah_rapat_direksi": number|null,
  "jumlah_rapat_komisaris": number|null,
  "deskripsi_rapat": string|null,
  "hubungan_keluarga_komisaris": [{"nama":string,"jabatan":string,"status_komisaris":string,"status_direksi":string,"status_ps":string}]|null,
  "hubungan_keuangan_komisaris": [{"nama":string,"jabatan":string,"status_komisaris":string,"status_direksi":string,"status_ps":string}]|null,
  "hubungan_keluarga_direksi": [{"nama":string,"jabatan":string,"status_komisaris":string,"status_direksi":string,"status_ps":string}]|null,
  "hubungan_keuangan_direksi": [{"nama":string,"jabatan":string,"status_komisaris":string,"status_direksi":string,"status_ps":string}]|null,
  "rangkap_jabatan": [{"nama":string,"posisi":string,"perusahaan_lain":string,"bidang_usaha":string}]|null,
  "rups": [{"tanggal":string,"keputusan":string}]|null,
  "pihak_afiliasi": [string],
  "nama_di_pk_sheets": [string],
  "alamat": string|null,
  "izin_usaha": string|null,
  "kantor_cabang": string|null,
  "jumlah_pegawai": number|null,
  "kap_nama": string|null,
  "akuntan_publik_nama": string|null,
  "nomor_izin_akuntan": string|null,
  "nomor_registrasi_akuntan": string|null,
  "opini_audit": string|null,
  "tka": string|null,
  "polis_indemnitas": [{"nomor_polis":string,"penanggung":string,"nilai_pertanggungan":number,"masa_berlaku":string}]|null,
  "sanksi": [{"nomor_tanggal":string,"jenis":string,"penyebab":string}]|null,
  "neraca_laba_rugi": [{"label":string,"nilai_ini":number|null,"nilai_lalu":number|null}]|null,
  "rasio_keuangan_tabel": [{"label":string,"nilai_ini":number|null,"nilai_lalu":number|null}]|null
}

Catatan ekstraksi:
- pemegang_saham_prev: data pemegang saham TAHUN SEBELUMNYA (cari kolom/header "tahun lalu" atau "sebelumnya" atau periode n-1)
- direksi_komisaris_prev & tenaga_ahli_pialang_prev: sama, tahun sebelumnya
- beban_komisi_prev: beban komisi tahun sebelumnya dari LK02
- piutang_aging_lewat_30_sudah_bayar: PK10, baris di mana aging > 30 hari DAN status pembayaran tertanggung = sudah bayar
- klaim_terlambat_*: OP02, hitung selisih hari kerja (Senin-Jumat) — >1 hari kerja untuk penerusan/dokumen, >3 hari kerja untuk tanggapan tertanggung
- rasio_kecukupan_dana_premi_ditahan & rasio_biaya_diklat: bisa ada di sheet OP06 atau Data Umum atau dihitung dari sheet lain
- pihak_afiliasi: daftar nama dari PP07
- nama_di_pk_sheets: semua nama/entitas yang muncul di sheet PK01, PK03, PK09, PK10 (kolom nama_penanggung)
- alamat, izin_usaha, kantor_cabang, jumlah_pegawai, kap_nama, akuntan_publik_nama, nomor_izin_akuntan, nomor_registrasi_akuntan, opini_audit, tka, polis_indemnitas, sanksi: cari di sheet profil/identitas perusahaan atau sheet GCG (prefix GCG_) jika ada. Jika benar-benar tidak ada, null.
- PENTING: sheet dengan prefix "PREV_" (contoh: PREV_LK01, PREV_LK02) berasal dari laporan keuangan audited TAHUN SEBELUMNYA — dokumen terpisah yang khusus diupload untuk data komparatif. Cocokkan sheet PREV_XXX dengan sheet XXX yang sesuai (tanpa prefix) untuk mengisi SEMUA field *_prev (pemegang_saham_prev, direksi_komisaris_prev, tenaga_ahli_pialang_prev, beban_komisi_prev) dan kolom nilai_lalu pada neraca_laba_rugi/rasio_keuangan_tabel. Jangan campur data PREV_ dengan data tahun berjalan.
- neraca_laba_rugi: ekstrak SEMUA baris neraca (Aset, Liabilitas, Ekuitas) dan laba rugi (Pendapatan, Beban, Laba/Rugi), sebagai list {label, nilai_ini (dari sheet LK01/LK02 tahun berjalan), nilai_lalu (dari sheet PREV_LK01/PREV_LK02 tahun sebelumnya)}
- rasio_keuangan_tabel: ekstrak SEMUA rasio keuangan sebagai persentase, {label, nilai_ini (dari sheet OP06 tahun berjalan), nilai_lalu (dari sheet PREV_OP06 tahun sebelumnya jika ada)}`

  const raw = await callOpenRouter(system, user, 8000)
  // Coba ambil JSON lengkap (sampai } terakhir), fallback ke repair jika terpotong
  const greedyMatch = raw.match(/\{[\s\S]*\}/)
  const jsonStr = greedyMatch ? greedyMatch[0] : raw.match(/\{[\s\S]*/)?.at(0)
  if (!jsonStr) throw new Error('AI tidak mengembalikan JSON untuk ekstraksi LHPTL')

  const extracted = parseJsonSafe(jsonStr) as ExtractedLhptlData
  // Override dengan nilai dari parameter
  extracted.nama_perusahaan = namaEntitas
  extracted.jenis_entitas = jenisEntitas
  extracted.periode = periode
  return extracted
}

// ─── Step 2+3: Rules + AI KESIMPULAN ─────────────────────────────────────────

export async function analisisLhptl(
  data: ExtractedLhptlData
): Promise<{ hasil: HasilPengawasan[]; kesimpulan: string; tindak_lanjut: string }> {
  const hasil = jalankanRules(data)

  const pelanggaran = hasil.filter((h) => h.tipe === 'pelanggaran')
  const perhatian = hasil.filter((h) => h.tipe === 'perlu_perhatian')
  const informasional = hasil.filter((h) => h.tipe === 'informasional')

  const hasilText = hasil
    .map((h) => `${h.nomor}. [${h.tipe.toUpperCase()}] ${h.catatan} (${h.acuan_peraturan})`)
    .join('\n')

  const system = `Anda adalah pengawas OJK yang menyusun Kesimpulan dan Tindak Lanjut pada Laporan Hasil Pengawasan Tidak Langsung (LHPTL) untuk perusahaan pialang asuransi.
Tulis dalam bahasa Indonesia formal yang baku, padat, dan objektif. Jangan mengulang setiap temuan satu per satu — cukup rangkum per aspek (tata kelola, keuangan, operasional, kepatuhan).

BATASAN KETAT — WAJIB DIPATUHI:
- HANYA gunakan fakta, angka, dan acuan regulasi yang SUDAH TERCANTUM EKSPLISIT dalam daftar Hasil Pengawasan di bawah.
- DILARANG KERAS menyebut nomor pasal, threshold persentase, atau ketentuan regulasi yang TIDAK ADA dalam field "acuan_peraturan" pada daftar temuan.
- DILARANG membuat inferensi, asumsi, atau rekomendasi yang melampaui data temuan yang diberikan.
- Jika data tidak tersedia (tercantum "tidak tersedia dalam Excel"), nyatakan keterbatasan tersebut — JANGAN isi dengan asumsi.`

  const user = `Perusahaan: ${data.nama_perusahaan} (${data.jenis_entitas}), Periode: ${data.periode}

HASIL PENGAWASAN (${hasil.length} temuan: ${pelanggaran.length} pelanggaran, ${perhatian.length} perlu perhatian, ${informasional.length} informasional):
${hasilText}

Tulis dua bagian berikut dalam JSON:
{
  "kesimpulan": "...",
  "tindak_lanjut": "..."
}

Pedoman:
- kesimpulan: 3-5 paragraf. Rangkum kondisi tata kelola, kondisi keuangan, kepatuhan operasional, dan penilaian keseluruhan. Sebutkan temuan signifikan secara ringkas.
- tindak_lanjut: Daftar tindakan pengawasan konkret (3-5 poin) berdasarkan temuan. Tiap poin mulai dengan kata kerja. Format: "1. [tindakan]. 2. [tindakan]. dst."`

  const raw = await callOpenRouter(system, user, 2000)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI tidak mengembalikan JSON untuk KESIMPULAN')
  const { kesimpulan, tindak_lanjut } = JSON.parse(match[0])

  return { hasil, kesimpulan, tindak_lanjut }
}

// ─── Step 4: Generate .docx ───────────────────────────────────────────────────

function fmtRupiah(n: number | null | undefined): string {
  if (n == null) return '-'
  return new Intl.NumberFormat('id-ID').format(n)
}

export async function generateLhptlDocx(
  namaEntitas: string,
  jenisEntitas: string,
  periode: string,
  hasil: HasilPengawasan[],
  kesimpulan: string,
  tindak_lanjut: string,
  raw?: ExtractedLhptlData | null
): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, WidthType, BorderStyle,
  } = await import('docx')

  const pelanggaran = hasil.filter((h) => h.tipe === 'pelanggaran')
  const perhatian = hasil.filter((h) => h.tipe === 'perlu_perhatian')

  const NA = '[HARAP DIISI PENGAWAS]'

  // ─ Helpers ─────────────────────────────────────────────────────────────
  const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) =>
    new Paragraph({ text, heading: level, spacing: { before: 240, after: 100 } })

  const body = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, size: 24 })], spacing: { after: 100 } })

  const bold = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, bold: true, size: 24 })], spacing: { after: 60 } })

  const italicNote = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, italics: true, color: '888888', size: 20 })], spacing: { after: 120 } })

  const kv = (label: string, value: string) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${label}\t: `, bold: true, size: 22 }),
        new TextRun({ text: value || NA, size: 22 }),
      ],
      spacing: { after: 40 },
    })

  const borderNone = { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' }
  const cellBorder = { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone }

  const headerRow = (labels: string[], widths: number[]) =>
    new TableRow({
      children: labels.map((label, i) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          borders: cellBorder,
        })
      ),
      tableHeader: true,
    })

  const dataRow = (values: string[], widths: number[]) =>
    new TableRow({
      children: values.map((v, i) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: v || '-', size: 20 })] })],
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          borders: cellBorder,
        })
      ),
    })

  const simpleTable = (headers: string[], widths: number[], rows: string[][], emptyLabel = 'Tidak ada data') =>
    new Table({
      rows: [
        headerRow(headers, widths),
        ...(rows.length > 0
          ? rows.map((r) => dataRow(r, widths))
          : [dataRow([emptyLabel, ...Array(headers.length - 1).fill('')], widths)]),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })

  // ═══ SECTION A: INFORMASI UMUM ═══════════════════════════════════════
  const rekananTotal = (raw?.jumlah_rekanan_perorangan ?? 0) + (raw?.jumlah_rekanan_badan_hukum ?? 0)

  const sectionA = [
    heading('A. INFORMASI UMUM'),
    kv('Nama Perusahaan', namaEntitas),
    kv('Alamat lengkap', raw?.alamat || NA),
    kv('Izin Usaha', raw?.izin_usaha || NA),
    kv('Kantor di Luar KP', raw?.kantor_cabang || 'Tidak ada'),
    kv('Perusahaan Afiliasi', raw?.pihak_afiliasi?.length ? raw.pihak_afiliasi.join(', ') : 'Tidak ada'),
    kv('Jumlah Pegawai', raw?.jumlah_pegawai != null ? `${raw.jumlah_pegawai}, termasuk pengurus dan pegawai` : NA),
    kv('Jumlah Rekanan PB', rekananTotal > 0
      ? `${rekananTotal} (terdiri dari ${raw?.jumlah_rekanan_perorangan ?? 0} perorangan dan ${raw?.jumlah_rekanan_badan_hukum ?? 0} badan hukum)`
      : NA),

    new Paragraph({ text: '', spacing: { after: 80 } }),
    bold(`Penyampaian Laporan Keuangan yang telah diaudit oleh Akuntan Publik Periode ${periode}`),
    kv('Kantor Akuntan Publik', raw?.kap_nama || NA),
    kv('Akuntan Publik', raw?.akuntan_publik_nama || NA),
    kv('Nomor Izin Akuntan', raw?.nomor_izin_akuntan || NA),
    kv('Nomor Registrasi Akuntan', raw?.nomor_registrasi_akuntan || NA),
    kv('Periode Laporan', periode),
    kv('Opini', raw?.opini_audit || NA),

    new Paragraph({ text: '', spacing: { after: 100 } }),
    bold('Pemegang Saham'),
    simpleTable(
      ['Nama', 'Nilai (Rp)', 'Persentase (%)'],
      [50, 30, 20],
      (raw?.pemegang_saham ?? []).map((p) => [p.nama, fmtRupiah(p.nilai_rp), p.persentase != null ? p.persentase.toFixed(2) : '-'])
    ),

    new Paragraph({ text: '', spacing: { after: 100 } }),
    bold('Direksi dan Anggota Dewan Komisaris'),
    simpleTable(
      ['Jabatan', 'Nama', 'Pengadministrasian OJK'],
      [25, 35, 40],
      (raw?.direksi_komisaris ?? []).map((d) => [d.jabatan, d.nama, d.surat_persetujuan_ojk || '-'])
    ),

    new Paragraph({ text: '', spacing: { after: 100 } }),
    bold('Tenaga Ahli dan Pialang'),
    simpleTable(
      ['Jabatan', 'Nama', 'Pengadministrasian OJK'],
      [25, 35, 40],
      (raw?.tenaga_ahli_pialang ?? []).map((t) => [t.jabatan, t.nama, `${t.nomor_registrasi || '-'} ${t.surat_pengadministrasian_ojk ? '(' + t.surat_pengadministrasian_ojk + ')' : ''}`.trim()])
    ),

    new Paragraph({ text: '', spacing: { after: 80 } }),
    kv('Tenaga Kerja Asing', raw?.tka || 'Tidak ada'),

    new Paragraph({ text: '', spacing: { after: 100 } }),
    bold('Polis Profesional Indemnitas'),
    simpleTable(
      ['Nomor Polis', 'Penanggung', 'Nilai Pertanggungan', 'Masa Berlaku'],
      [25, 30, 20, 25],
      (raw?.polis_indemnitas ?? []).map((p) => [p.nomor_polis, p.penanggung, fmtRupiah(p.nilai_pertanggungan), p.masa_berlaku])
    ),

    new Paragraph({ text: '', spacing: { after: 100 } }),
    bold('Sanksi, Teguran dan Pembinaan'),
    simpleTable(
      ['Nomor dan Tanggal Surat', 'Jenis Sanksi/Teguran/Pembinaan', 'Penyebab'],
      [35, 30, 35],
      (raw?.sanksi ?? []).map((s) => [s.nomor_tanggal, s.jenis, s.penyebab]),
      'Tidak ada'
    ),
    new Paragraph({ text: '', spacing: { after: 300 } }),
  ]

  // ═══ SECTION B: FINANCIAL HIGHLIGHT ══════════════════════════════════
  const sectionB = [
    heading('B. FINANCIAL HIGHLIGHT TAHUNAN (AUDITED)'),
    body('Laporan Posisi Keuangan dan Laporan Laba Rugi Komprehensif periode berjalan dan periode sebelumnya sebagai berikut:'),
    simpleTable(
      ['Nama Akun', 'Periode Berjalan (Rp)', 'Periode Sebelumnya (Rp)'],
      [50, 25, 25],
      (raw?.neraca_laba_rugi ?? []).map((r) => [r.label, fmtRupiah(r.nilai_ini), fmtRupiah(r.nilai_lalu)]),
      'Data neraca/laba-rugi tidak tersedia dari dokumen yang diupload'
    ),

    new Paragraph({ text: '', spacing: { after: 200 } }),
    body('Rasio keuangan Perusahaan untuk periode berjalan dan periode sebelumnya adalah sebagai berikut:'),
    simpleTable(
      ['Rasio', 'Periode Berjalan', 'Periode Sebelumnya'],
      [50, 25, 25],
      (raw?.rasio_keuangan_tabel ?? []).map((r) => [r.label, r.nilai_ini != null ? `${r.nilai_ini.toFixed(2)}%` : '-', r.nilai_lalu != null ? `${r.nilai_lalu.toFixed(2)}%` : '-']),
      'Data rasio keuangan tidak tersedia dari dokumen yang diupload'
    ),
    new Paragraph({ text: '', spacing: { after: 300 } }),
  ]

  // ═══ SECTION C: RUANG LINGKUP ═════════════════════════════════════════
  const sectionC = [
    heading('C. RUANG LINGKUP PENGAWASAN TIDAK LANGSUNG'),
    body('Ruang lingkup pelaksanaan pengawasan tidak langsung mencakup hal-hal sebagai berikut:'),
    bold('Aspek Operasional'),
    bold('Aspek Kepatuhan'),
    new Paragraph({ text: '', spacing: { after: 300 } }),
  ]

  // ═══ SECTION D: TIM PENGAWAS ══════════════════════════════════════════
  const sectionD = [
    heading(`D. DAFTAR TIM PENGAWAS ${NA}`),
    body('Susunan tim pengawas adalah sebagai berikut:'),
    simpleTable(['No.', 'Nama', 'NIP', 'Susunan Tim'], [10, 35, 25, 30], []),
    new Paragraph({ text: '', spacing: { after: 300 } }),
  ]

  // ═══ SECTION E: PERIODE PENGAWASAN ════════════════════════════════════
  const periodeText = /^\d{4}$/.test(periode.trim())
    ? `Periode 1 Januari ${periode} s.d 31 Desember ${periode}.`
    : `Periode pengawasan: ${periode}.`
  const sectionE = [
    heading('E. PERIODE PENGAWASAN TIDAK LANGSUNG'),
    body(periodeText),
    new Paragraph({ text: '', spacing: { after: 300 } }),
  ]

  // ═══ SECTION F: HASIL PENGAWASAN ══════════════════════════════════════
  const tipeLabel = (t: HasilPengawasan['tipe']) => {
    if (t === 'pelanggaran') return 'Pelanggaran'
    if (t === 'perlu_perhatian') return 'Perlu Perhatian'
    return ''
  }

  const sectionF = [
    heading('F. HASIL PENGAWASAN TIDAK LANGSUNG'),
    bold(`Ringkasan: ${hasil.length} item (${pelanggaran.length} pelanggaran, ${perhatian.length} perlu perhatian)`),
    new Paragraph({ text: '', spacing: { after: 100 } }),
    simpleTable(
      ['No', 'Hasil Pengawasan', 'Indikasi Pelanggaran'],
      [5, 75, 20],
      hasil.map((h) => [String(h.nomor), h.catatan, tipeLabel(h.tipe)])
    ),
    new Paragraph({ text: '', spacing: { after: 300 } }),
  ]

  // ═══ SECTION G: KESIMPULAN (AI draft, wajib direview) ═════════════════
  const sectionG = [
    heading(`G. KESIMPULAN PENGAWASAN TIDAK LANGSUNG ${NA}`),
    italicNote('── DRAFT AI — WAJIB DITINJAU DAN DIREVISI OLEH PENGAWAS SEBELUM FINAL ──'),
    body('Berdasarkan hasil pengawasan tidak langsung, diperoleh kesimpulan sebagai berikut:'),
    ...kesimpulan.split('\n').filter(Boolean).map((p) => body(p)),
    new Paragraph({ text: '', spacing: { after: 300 } }),
  ]

  // ═══ SECTION H: TINDAK LANJUT (AI draft, wajib direview) ══════════════
  const tindakPoin = tindak_lanjut
    .split(/\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const sectionH = [
    heading(`H. TINDAK LANJUT HASIL PENGAWASAN TIDAK LANGSUNG ${NA}`),
    italicNote('── DRAFT AI — WAJIB DITINJAU DAN DIREVISI OLEH PENGAWAS SEBELUM FINAL ──'),
    body('Berdasarkan kesimpulan dari hasil analisis pengawasan tidak langsung, tindakan pengawasan yang akan dilakukan terhadap Perusahaan adalah sebagai berikut:'),
    simpleTable(
      ['No', 'Tindakan Pengawasan', 'Target Penyelesaian'],
      [5, 75, 20],
      tindakPoin.map((poin, i) => [String(i + 1), poin, ''])
    ),
    new Paragraph({ text: '', spacing: { after: 400 } }),
  ]

  // ═══ TANDA TANGAN ══════════════════════════════════════════════════════
  const sectionTtd = [
    heading('TANDA TANGAN', HeadingLevel.HEADING_3),
    new Table({
      rows: [
        new TableRow({
          children: ['Disiapkan oleh (drafter)', 'Direviu oleh (reviewer)', 'Direviu oleh (reviewer)', 'Disetujui oleh (approval)'].map(
            (label) =>
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: label, size: 20 })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ text: '', spacing: { after: 600 } }),
                  new Paragraph({ children: [new TextRun({ text: 'Nama', size: 20 })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: 'Jabatan', size: 20 })], alignment: AlignmentType.CENTER }),
                ],
                borders: cellBorder,
              })
          ),
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ]

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'LAPORAN HASIL PENGAWASAN TIDAK LANGSUNG', bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: namaEntitas, bold: true, size: 26 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Jenis Entitas: ${jenisEntitas}`, size: 20, color: '888888' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          ...sectionA,
          ...sectionB,
          ...sectionC,
          ...sectionD,
          ...sectionE,
          ...sectionF,
          ...sectionG,
          ...sectionH,
          ...sectionTtd,
        ],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
