/**
 * lhptl-rules.ts
 * Rules engine deterministik untuk LHPTL (44 rules dari LHPTL_aturan_kesimpulan.json).
 * Input: ExtractedLhptlData (hasil AI extraction)
 * Output: HasilPengawasan[] — list temuan bernomor
 */

export interface HasilPengawasan {
  nomor: number
  catatan: string
  kategori: string
  tipe: 'pelanggaran' | 'perlu_perhatian' | 'informasional'
  acuan_peraturan: string
}

// Data yang diekstrak AI dari Excel — field-field yang dibutuhkan rules
export interface ExtractedLhptlData {
  // Identitas
  nama_perusahaan: string
  jenis_entitas: 'pialang_asuransi' | 'pialang_reasuransi'
  periode: string

  // PP01
  jumlah_rekanan_perorangan: number | null
  jumlah_rekanan_badan_hukum: number | null
  beban_komisi_lk02: number | null           // dari LK02 — beban komisi tahun berjalan

  // PP02
  pemegang_saham: Array<{ nama: string; nilai_rp: number; persentase: number }>
  pemegang_saham_prev: Array<{ nama: string; nilai_rp: number; persentase: number }>

  // PP03
  jumlah_komisaris: number | null
  jumlah_direktur: number | null
  direksi_komisaris: Array<{ nama: string; jabatan: string; surat_persetujuan_ojk: string }>
  direksi_komisaris_prev: Array<{ nama: string; jabatan: string }>
  surat_persetujuan_ojk_kosong: boolean

  // PP04
  tenaga_ahli_pialang: Array<{ nama: string; jabatan: string; nomor_registrasi: string; surat_pengadministrasian_ojk: string }>
  tenaga_ahli_pialang_prev: Array<{ nama: string; jabatan: string }>
  jumlah_tenaga_ahli: number | null
  jumlah_pialang: number | null
  ada_jabatan_tenaga_ahli_kosong: boolean
  ada_jabatan_pialang_kosong: boolean
  ada_nomor_registrasi_kosong: boolean
  ada_surat_pengadministrasian_ojk_kosong: boolean

  // PK01
  ada_bank_bpr: boolean
  nama_bank_bpr: string[]

  // PK09
  aset_lain_lain: Array<{ nama: string; nilai: number }> | null
  total_aset_lain: number | null

  // PK10
  piutang_aging_lewat_30_sudah_bayar: Array<{ nilai: number }> | null
  total_utang_premi: number | null

  // PK11
  utang_klaim: Array<{ nama_tertanggung: string; nama_penanggung: string; nilai: number; tanggal: string }> | null

  // PK14
  utang_lain_lain: Array<{ nama: string; nilai: number }> | null
  total_utang_lain: number | null

  // LK01/LK02 — keuangan
  jumlah_ekuitas: number | null
  beban_komisi_prev: number | null           // beban komisi tahun sebelumnya

  // LR01
  lr01_data: Array<{ lini_usaha: string; premi: number; pendapatan_langsung: number; pendapatan_tidak_langsung: number; lokasi: string }> | null

  // LR03
  pendapatan_lain_lain: Array<{ nama: string; nilai: number }> | null
  total_pendapatan_lain: number | null
  pendapatan_jasa_keperantaraan: number | null

  // LR07
  top10_penerima_komisi: Array<{ nama: string; nomor_perjanjian: string; jumlah: number; persentase: number }> | null
  total_beban_komisi: number | null
  ada_komisi_tanpa_perjanjian: Array<{ nama: string }> | null

  // OP01
  nilai_pertanggungan_op01: number | null
  pendapatan_lk02: number | null
  pendapatan_lainnya_lk02: number | null

  // OP02
  klaim_terlambat_penerusan: Array<{ tanggal_terima: string; tanggal_penerusan: string }> | null
  klaim_terlambat_tanggapan: Array<{ tanggal_terima: string; tanggal_tanggapan: string }> | null
  klaim_terlambat_dokumen: Array<{ tanggal_dokumen_lengkap: string; tanggal_penerusan: string }> | null

  // OP06
  rasio_kecukupan_dana_premi_ditahan: number | null
  rasio_biaya_diklat: number | null

  // FKRT
  jumlah_rapat_direksi: number | null
  jumlah_rapat_komisaris: number | null
  deskripsi_rapat: string | null

  // HKKS, HKKM, HKGD, HKDR
  hubungan_keluarga_komisaris: Array<{ nama: string; jabatan: string; status_komisaris: string; status_direksi: string; status_ps: string }> | null
  hubungan_keuangan_komisaris: Array<{ nama: string; jabatan: string; status_komisaris: string; status_direksi: string; status_ps: string }> | null
  hubungan_keluarga_direksi: Array<{ nama: string; jabatan: string; status_komisaris: string; status_direksi: string; status_ps: string }> | null
  hubungan_keuangan_direksi: Array<{ nama: string; jabatan: string; status_komisaris: string; status_direksi: string; status_ps: string }> | null

  // RJBT
  rangkap_jabatan: Array<{ nama: string; posisi: string; perusahaan_lain: string; bidang_usaha: string }> | null

  // TPKP (RUPS)
  rups: Array<{ tanggal: string; keputusan: string }> | null

  // PP07
  pihak_afiliasi: string[]
  nama_di_pk_sheets: string[]

  // ── Section A: Informasi Umum (identitas & profil) ──────────────────────
  alamat: string | null
  izin_usaha: string | null
  kantor_cabang: string | null
  jumlah_pegawai: number | null
  kap_nama: string | null
  akuntan_publik_nama: string | null
  nomor_izin_akuntan: string | null
  nomor_registrasi_akuntan: string | null
  opini_audit: string | null
  tka: string | null
  polis_indemnitas: Array<{ nomor_polis: string; penanggung: string; nilai_pertanggungan: number; masa_berlaku: string }> | null
  sanksi: Array<{ nomor_tanggal: string; jenis: string; penyebab: string }> | null

  // ── Section B: Financial Highlight (neraca + laba rugi + rasio, 2 tahun) ─
  neraca_laba_rugi: Array<{ label: string; nilai_ini: number | null; nilai_lalu: number | null }> | null
  rasio_keuangan_tabel: Array<{ label: string; nilai_ini: number | null; nilai_lalu: number | null }> | null
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '-'
  return new Intl.NumberFormat('id-ID').format(n)
}

function pct(num: number, denom: number): string {
  if (!denom) return '0'
  return ((num / denom) * 100).toFixed(1)
}

export function jalankanRules(raw: ExtractedLhptlData): HasilPengawasan[] {
  // Normalize: pastikan semua field array non-nullable tidak null (AI kadang return null)
  const d: ExtractedLhptlData = {
    ...raw,
    pemegang_saham: raw.pemegang_saham ?? [],
    pemegang_saham_prev: raw.pemegang_saham_prev ?? [],
    direksi_komisaris: raw.direksi_komisaris ?? [],
    direksi_komisaris_prev: raw.direksi_komisaris_prev ?? [],
    tenaga_ahli_pialang: raw.tenaga_ahli_pialang ?? [],
    tenaga_ahli_pialang_prev: raw.tenaga_ahli_pialang_prev ?? [],
    nama_bank_bpr: raw.nama_bank_bpr ?? [],
    pihak_afiliasi: raw.pihak_afiliasi ?? [],
    nama_di_pk_sheets: raw.nama_di_pk_sheets ?? [],
  }

  const hasil: HasilPengawasan[] = []
  let nomor = 1

  function push(catatan: string, kategori: string, tipe: HasilPengawasan['tipe'], acuan: string) {
    hasil.push({ nomor: nomor++, catatan, kategori, tipe, acuan_peraturan: acuan })
  }

  // ─── PP03 ─────────────────────────────────────────────────────────────────

  // Selalu tampilkan jumlah komisaris & direktur
  if (d.jumlah_komisaris != null && d.jumlah_direktur != null) {
    push(
      `Perusahaan tercatat memiliki ${d.jumlah_komisaris} komisaris dan ${d.jumlah_direktur} direktur.`,
      'tata_kelola', 'informasional',
      'POJK 24/2023 Pasal 25'
    )
  }

  if (d.jumlah_komisaris != null && d.jumlah_komisaris < 2) {
    push(
      `Jumlah komisaris tercatat ${d.jumlah_komisaris}, tidak memenuhi syarat minimal 2 (dua) orang.`,
      'tata_kelola', 'pelanggaran',
      'POJK 24/2023 Pasal 25 ayat (1)'
    )
  }

  if (d.jumlah_direktur != null && d.jumlah_direktur < 2) {
    push(
      `Jumlah direktur tercatat ${d.jumlah_direktur}, tidak memenuhi syarat minimal 2 (dua) orang.`,
      'tata_kelola', 'pelanggaran',
      'POJK 24/2023 Pasal 25 ayat (1)'
    )
  }

  if (d.jumlah_komisaris != null && d.jumlah_direktur != null && d.jumlah_komisaris > d.jumlah_direktur) {
    push(
      `Jumlah komisaris (${d.jumlah_komisaris}) lebih banyak dari jumlah direktur (${d.jumlah_direktur}).`,
      'tata_kelola', 'pelanggaran',
      'POJK 24/2023 Pasal 25 ayat (2)'
    )
  }

  if (d.surat_persetujuan_ojk_kosong) {
    push(
      'Kolom surat persetujuan OJK tidak diisi.',
      'tata_kelola', 'perlu_perhatian',
      'POJK 24/2023 Pasal 16-17'
    )
  }

  // Perubahan YoY pengurus
  if (d.direksi_komisaris_prev.length > 0) {
    const prevNames = new Set(d.direksi_komisaris_prev.map((x) => x.nama + '|' + x.jabatan))
    const curNames = new Set(d.direksi_komisaris.map((x) => x.nama + '|' + x.jabatan))
    const masuk = d.direksi_komisaris.filter((x) => !prevNames.has(x.nama + '|' + x.jabatan))
    const keluar = d.direksi_komisaris_prev.filter((x) => !curNames.has(x.nama + '|' + x.jabatan))
    const perubahan = [
      ...masuk.map((x) => `${x.nama} masuk sebagai ${x.jabatan}`),
      ...keluar.map((x) => `${x.nama} tidak lagi menjabat ${x.jabatan}`),
    ]
    if (perubahan.length > 0) {
      push(
        `Terdapat perubahan susunan Direksi/Dewan Komisaris dibanding tahun sebelumnya: ${perubahan.join('; ')}.`,
        'tata_kelola', 'informasional',
        'Informasional'
      )
    }
  }

  // ─── PP02 ─────────────────────────────────────────────────────────────────

  if (d.pemegang_saham_prev.length > 0) {
    const prevMap = new Map(d.pemegang_saham_prev.map((x) => [x.nama, x.nilai_rp]))
    const curNames = new Set(d.pemegang_saham.map((x) => x.nama))
    const perubahan: string[] = []
    for (const ps of d.pemegang_saham) {
      const prev = prevMap.get(ps.nama)
      if (prev == null) perubahan.push(`${ps.nama} (baru, Rp${fmt(ps.nilai_rp)})`)
      else if (prev !== ps.nilai_rp) perubahan.push(`${ps.nama} berubah dari Rp${fmt(prev)} menjadi Rp${fmt(ps.nilai_rp)}`)
    }
    for (const ps of d.pemegang_saham_prev) {
      if (!curNames.has(ps.nama)) perubahan.push(`${ps.nama} tidak lagi tercatat`)
    }
    if (perubahan.length > 0) {
      push(
        `Terdapat perubahan susunan pemegang saham dibanding tahun sebelumnya: ${perubahan.join('; ')}.`,
        'tata_kelola', 'informasional',
        'Informasional'
      )
    }
  }

  // ─── PP04 ─────────────────────────────────────────────────────────────────

  if (d.jumlah_tenaga_ahli != null && d.jumlah_pialang != null) {
    push(
      `Perusahaan tercatat memiliki ${d.jumlah_tenaga_ahli} tenaga ahli dan ${d.jumlah_pialang} pialang asuransi/reasuransi.`,
      'tata_kelola', 'informasional',
      'Informasional'
    )
  }

  if (d.ada_jabatan_tenaga_ahli_kosong) {
    push('Jabatan tenaga ahli tidak tercatat lengkap.', 'tata_kelola', 'perlu_perhatian', 'POJK 24/2023 Pasal 50 ayat (1)')
  }
  if (d.ada_jabatan_pialang_kosong) {
    push('Jabatan pialang asuransi/reasuransi tidak tercatat lengkap.', 'tata_kelola', 'perlu_perhatian', 'POJK 24/2023 Pasal 36 ayat (1)')
  }
  if (d.ada_nomor_registrasi_kosong) {
    push('Kolom nomor registrasi tidak diisi.', 'tata_kelola', 'perlu_perhatian', 'POJK 24/2023 Pasal 38-39')
  }
  if (d.ada_surat_pengadministrasian_ojk_kosong) {
    push('Kolom surat pengadministrasian OJK tidak diisi.', 'tata_kelola', 'perlu_perhatian', 'POJK 24/2023 Pasal 38-39')
  }

  // Perubahan YoY tenaga ahli/pialang
  if (d.tenaga_ahli_pialang_prev.length > 0) {
    const prevNames = new Set(d.tenaga_ahli_pialang_prev.map((x) => x.nama + '|' + x.jabatan))
    const curNames = new Set(d.tenaga_ahli_pialang.map((x) => x.nama + '|' + x.jabatan))
    const masuk = d.tenaga_ahli_pialang.filter((x) => !prevNames.has(x.nama + '|' + x.jabatan))
    const keluar = d.tenaga_ahli_pialang_prev.filter((x) => !curNames.has(x.nama + '|' + x.jabatan))
    // Perubahan jabatan: nama sama tapi jabatan berbeda
    const perubahan: string[] = []
    const curByName = new Map(d.tenaga_ahli_pialang.map((x) => [x.nama, x.jabatan]))
    const prevByName = new Map(d.tenaga_ahli_pialang_prev.map((x) => [x.nama, x.jabatan]))
    for (const [nama, jabatanCur] of curByName) {
      const jabatanPrev = prevByName.get(nama)
      if (jabatanPrev && jabatanPrev !== jabatanCur) {
        perubahan.push(`perubahan jabatan: ${nama} (dari ${jabatanPrev} menjadi ${jabatanCur})`)
      }
    }
    for (const x of masuk) {
      if (!prevByName.has(x.nama)) perubahan.push(`${x.nama} bergabung sebagai ${x.jabatan}`)
    }
    for (const x of keluar) {
      if (!curByName.has(x.nama)) perubahan.push(`${x.nama} tidak lagi tercatat`)
    }
    if (perubahan.length > 0) {
      push(
        `Terdapat perubahan susunan tenaga ahli/pialang dibanding tahun sebelumnya: ${perubahan.join('; ')}.`,
        'tata_kelola', 'informasional',
        'Informasional'
      )
    }
  }

  // ─── PP01 ─────────────────────────────────────────────────────────────────

  const rekanan = (d.jumlah_rekanan_perorangan ?? 0) + (d.jumlah_rekanan_badan_hukum ?? 0)
  if (rekanan > 0 && (d.beban_komisi_lk02 ?? 0) === 0) {
    push(
      `Terdapat rekanan dalam perolehan bisnis (${d.jumlah_rekanan_perorangan} perorangan, ${d.jumlah_rekanan_badan_hukum} badan hukum), namun beban komisi tercatat nihil. Terdapat kemungkinan perusahaan melakukan pencatatan pendapatan secara nett.`,
      'kualitas_pendapatan', 'perlu_perhatian',
      'Prinsip akuntansi gross vs net'
    )
  }

  // ─── PK01 ─────────────────────────────────────────────────────────────────

  if (d.ada_bank_bpr) {
    push(
      `Terdapat penempatan pada bank yang berstatus BPR${d.nama_bank_bpr.length ? ': ' + d.nama_bank_bpr.join(', ') : ''}.`,
      'kualitas_aset', 'pelanggaran',
      'POJK 70/2016 Pasal 19-20'
    )
  }

  // ─── PK09 ─────────────────────────────────────────────────────────────────

  if (d.aset_lain_lain === null) {
    push('Data sheet PK09 (Kualitas Aset — Aset Lain-lain) tidak tersedia dalam Excel yang diupload; pemeriksaan atas aset lain-lain tidak dapat dilakukan.', 'kualitas_aset', 'informasional', '-')
  } else if (d.aset_lain_lain && d.aset_lain_lain.length > 0 && d.total_aset_lain) {
    for (const item of d.aset_lain_lain) {
      push(
        `Terdapat aset lainnya/lain-lain senilai Rp${fmt(item.nilai)} (${pct(item.nilai, d.total_aset_lain)}% dari total nilai aset lain).`,
        'kualitas_aset', 'informasional',
        'Prinsip keterbukaan/materialitas PSAK'
      )
    }
  }

  // ─── PK10 ─────────────────────────────────────────────────────────────────

  if (d.piutang_aging_lewat_30_sudah_bayar === null) {
    push('Data sheet PK10 (Kualitas Aset — Aging Piutang Premi) tidak tersedia dalam Excel yang diupload; pemeriksaan atas keterlambatan penerimaan premi tidak dapat dilakukan.', 'kualitas_aset', 'informasional', '-')
  } else if (d.piutang_aging_lewat_30_sudah_bayar.length > 0) {
    const total = d.piutang_aging_lewat_30_sudah_bayar.reduce((s, x) => s + x.nilai, 0)
    push(
      `Terdapat piutang premi dengan aging melebihi 30 hari padahal status tertanggung sudah membayar, senilai Rp${fmt(total)}${d.total_utang_premi ? ' (' + pct(total, d.total_utang_premi) + '% dari total utang premi)' : ''}.`,
      'kualitas_aset', 'perlu_perhatian',
      'POJK 70/2016 Pasal 5 ayat (1)'
    )
  }

  // ─── PK11 ─────────────────────────────────────────────────────────────────

  if (d.utang_klaim === null) {
    push('Data sheet PK11 (Kualitas Liabilitas — Utang Klaim) tidak tersedia dalam Excel yang diupload; pemeriksaan atas posisi utang klaim tidak dapat dilakukan.', 'kualitas_liabilitas', 'informasional', '-')
  } else if (d.utang_klaim.length > 0) {
    for (const uk of d.utang_klaim) {
      push(
        `Perusahaan memiliki utang klaim atas nama tertanggung ${uk.nama_tertanggung} dengan penanggung ${uk.nama_penanggung} sejumlah Rp${fmt(uk.nilai)} yang diterima sejak tanggal ${uk.tanggal}.`,
        'kualitas_liabilitas', 'informasional',
        'Kelengkapan pelaporan rutin'
      )
    }
  }

  // ─── PK14 ─────────────────────────────────────────────────────────────────

  if (d.utang_lain_lain === null) {
    push('Data sheet PK14 (Kualitas Liabilitas — Utang Lain-lain) tidak tersedia dalam Excel yang diupload; pemeriksaan atas utang lain-lain tidak dapat dilakukan.', 'kualitas_liabilitas', 'informasional', '-')
  } else if (d.utang_lain_lain.length > 0 && d.total_utang_lain) {
    for (const item of d.utang_lain_lain) {
      push(
        `Terdapat utang lainnya/lain-lain senilai Rp${fmt(item.nilai)} (${pct(item.nilai, d.total_utang_lain)}% dari total nilai utang lain).`,
        'kualitas_liabilitas', 'informasional',
        'Prinsip keterbukaan/materialitas PSAK'
      )
    }
  }

  // ─── Ekuitas minimum ──────────────────────────────────────────────────────

  if (d.jumlah_ekuitas === null) {
    push('Data ekuitas (sheet LK01/LK02) tidak tersedia dalam Excel yang diupload; pemeriksaan atas pemenuhan ekuitas minimum tidak dapat dilakukan.', 'permodalan', 'informasional', '-')
  } else if (d.jumlah_ekuitas != null) {
    const min = d.jenis_entitas === 'pialang_reasuransi' ? 4_000_000_000 : 3_000_000_000
    const label = d.jenis_entitas === 'pialang_reasuransi' ? 'pialang reasuransi' : 'pialang asuransi'
    if (d.jumlah_ekuitas < min) {
      push(
        `Jumlah Ekuitas Perusahaan sebesar Rp${fmt(d.jumlah_ekuitas)} tidak memenuhi ketentuan ekuitas minimum untuk ${label} sebesar Rp${fmt(min)}.`,
        'permodalan', 'pelanggaran',
        'POJK 24/2023 Pasal 13 ayat (2) huruf a'
      )
    }
  }

  // ─── OP01 — nilai pertanggungan vs pendapatan ─────────────────────────────

  if (d.nilai_pertanggungan_op01 === null) {
    push('Data sheet OP01 (Nilai Pertanggungan) tidak tersedia dalam Excel yang diupload; pemeriksaan konsistensi nilai pertanggungan vs pendapatan tidak dapat dilakukan.', 'konsistensi_data', 'informasional', '-')
  } else if (d.nilai_pertanggungan_op01 != null && d.pendapatan_lk02 != null) {
    const selisih = (d.pendapatan_lk02 ?? 0) - (d.pendapatan_lainnya_lk02 ?? 0)
    if (d.nilai_pertanggungan_op01 < selisih) {
      push(
        `Nilai pertanggungan (Rp${fmt(d.nilai_pertanggungan_op01)}) lebih kecil dari selisih pendapatan dan pendapatan lainnya pada LK02 (Rp${fmt(selisih)}).`,
        'konsistensi_data', 'perlu_perhatian',
        'POJK 24/2023 Pasal 18 ayat (2)'
      )
    }
  }

  // ─── OP02 — standar layanan klaim ─────────────────────────────────────────

  if (d.klaim_terlambat_penerusan === null && d.klaim_terlambat_tanggapan === null && d.klaim_terlambat_dokumen === null) {
    push('Data sheet OP02 (Standar Layanan Klaim) tidak tersedia dalam Excel yang diupload; pemeriksaan atas ketepatan waktu penanganan klaim tidak dapat dilakukan.', 'standar_layanan', 'informasional', '-')
  }

  if (d.klaim_terlambat_penerusan && d.klaim_terlambat_penerusan.length > 0) {
    for (const k of d.klaim_terlambat_penerusan) {
      push(
        `Penerusan laporan klaim melebihi batas 1 (satu) hari kerja sejak tanggal terima laporan (terima: ${k.tanggal_terima}, diteruskan: ${k.tanggal_penerusan}).`,
        'standar_layanan', 'pelanggaran',
        'POJK 70/2016 Pasal 10 ayat (1)'
      )
    }
  }

  if (d.klaim_terlambat_tanggapan && d.klaim_terlambat_tanggapan.length > 0) {
    for (const k of d.klaim_terlambat_tanggapan) {
      push(
        `Tanggapan kepada tertanggung melebihi batas 3 (tiga) hari kerja sejak tanggal terima laporan (terima: ${k.tanggal_terima}, tanggapan: ${k.tanggal_tanggapan}).`,
        'standar_layanan', 'pelanggaran',
        'POJK 70/2016 Pasal 10 ayat (1) huruf b'
      )
    }
  }

  if (d.klaim_terlambat_dokumen && d.klaim_terlambat_dokumen.length > 0) {
    for (const k of d.klaim_terlambat_dokumen) {
      push(
        `Penerusan dokumen klaim lengkap melebihi batas 1 (satu) hari kerja (dokumen lengkap: ${k.tanggal_dokumen_lengkap}, diteruskan: ${k.tanggal_penerusan}).`,
        'standar_layanan', 'pelanggaran',
        'POJK 70/2016 Pasal 10 ayat (1) huruf c'
      )
    }
  }

  // ─── OP06 — rasio keuangan ────────────────────────────────────────────────

  if (d.rasio_kecukupan_dana_premi_ditahan === null && d.rasio_biaya_diklat === null) {
    push('Data sheet OP06 (Rasio Keuangan) tidak tersedia dalam Excel yang diupload; pemeriksaan atas rasio kecukupan dana dan rasio biaya diklat tidak dapat dilakukan.', 'rasio_keuangan', 'informasional', '-')
  }

  if (d.rasio_kecukupan_dana_premi_ditahan != null) {
    const r = d.rasio_kecukupan_dana_premi_ditahan
    if (r > -100 && r < 100) {
      push(
        `Rasio kecukupan dana atas premi ditahan tercatat ${r.toFixed(2)}%, berada di luar rentang sehat (di atas 100% atau di bawah -100%).`,
        'rasio_keuangan', 'perlu_perhatian',
        'Ketentuan teknis OJK'
      )
    }
  }

  if (d.rasio_biaya_diklat != null && d.rasio_biaya_diklat < 3.5) {
    push(
      `Rasio biaya diklat tercatat ${d.rasio_biaya_diklat.toFixed(2)}%, di bawah ketentuan minimal 3,5%.`,
      'rasio_keuangan', 'perlu_perhatian',
      'POJK 34/2024 Pasal 4 ayat (3)'
    )
  }

  // ─── LR01 ─────────────────────────────────────────────────────────────────

  if (d.lr01_data === null) {
    push('Data sheet LR01 (Rincian Premi & Pendapatan per Lini Usaha) tidak tersedia dalam Excel yang diupload; pemeriksaan atas distribusi premi dan pendapatan jasa keperantaraan tidak dapat dilakukan.', 'kualitas_pendapatan', 'informasional', '-')
  } else if (d.lr01_data.length > 0) {
    // Lini premi terbesar
    const totalPremi = d.lr01_data.reduce((s, x) => s + x.premi, 0)
    const totalPend = d.lr01_data.reduce((s, x) => s + x.pendapatan_langsung + x.pendapatan_tidak_langsung, 0)
    const topPremi = [...d.lr01_data].sort((a, b) => b.premi - a.premi)[0]
    const topPend = [...d.lr01_data].sort((a, b) => (b.pendapatan_langsung + b.pendapatan_tidak_langsung) - (a.pendapatan_langsung + a.pendapatan_tidak_langsung))[0]
    if (topPremi && topPend) {
      const pTopPremi = topPremi.pendapatan_langsung + topPremi.pendapatan_tidak_langsung
      const pTopPend = topPend.pendapatan_langsung + topPend.pendapatan_tidak_langsung
      push(
        `Lini usaha dengan jumlah premi terbesar adalah ${topPremi.lini_usaha} sebesar Rp${fmt(topPremi.premi)} (${pct(topPremi.premi, totalPremi)}% dari total premi). Lini usaha dengan pendapatan jasa keperantaraan terbesar adalah ${topPend.lini_usaha} sebesar Rp${fmt(pTopPend)} (${pct(pTopPend, totalPend)}% dari total pendapatan jasa keperantaraan).`,
        'kualitas_pendapatan', 'informasional',
        'Informasional'
      )
    }

    // Penempatan luar negeri
    const ln = d.lr01_data.filter((x) => x.lokasi && x.lokasi.toLowerCase().includes('luar') || x.lokasi?.toLowerCase().includes('asean') || x.lokasi?.toLowerCase().includes('non-asean'))
    if (ln.length > 0) {
      const nilaiLN = ln.reduce((s, x) => s + x.premi, 0)
      const pendLN = ln.reduce((s, x) => s + x.pendapatan_langsung + x.pendapatan_tidak_langsung, 0)
      push(
        `Penempatan reasuransi ke luar negeri mencapai ${pct(nilaiLN, totalPremi)}% dari total premi (Rp${fmt(nilaiLN)} dari total Rp${fmt(totalPremi)}), dengan pendapatan dari penempatan luar negeri sebesar ${pct(pendLN, totalPend)}% dari total pendapatan jasa keperantaraan (Rp${fmt(pendLN)}). Perlu konfirmasi kesesuaian dengan ketentuan Pasal 37 POJK 70/2016.`,
        'kualitas_pendapatan', 'perlu_perhatian',
        'POJK 70/2016 Pasal 37'
      )
    }

    // Pendapatan tidak langsung
    const totalTidakLangsung = d.lr01_data.reduce((s, x) => s + x.pendapatan_tidak_langsung, 0)
    if (totalTidakLangsung > 0) {
      push(
        `Perusahaan memiliki pendapatan jasa keperantaraan tidak langsung (co-broking) sebesar Rp${fmt(totalTidakLangsung)} (${pct(totalTidakLangsung, totalPend)}% dari total pendapatan jasa keperantaraan).`,
        'kualitas_pendapatan', 'informasional',
        'Informasional'
      )
    }
  }

  // ─── LR03 ─────────────────────────────────────────────────────────────────

  if (d.pendapatan_lain_lain === null) {
    push('Data sheet LR03 (Pendapatan Lain-lain) tidak tersedia dalam Excel yang diupload; pemeriksaan atas komposisi pendapatan lain-lain tidak dapat dilakukan.', 'kualitas_pendapatan', 'informasional', '-')
  } else if (d.pendapatan_lain_lain.length > 0 && d.total_pendapatan_lain) {
    for (const item of d.pendapatan_lain_lain) {
      push(
        `Terdapat pendapatan lainnya/lain-lain senilai Rp${fmt(item.nilai)} (${pct(item.nilai, d.total_pendapatan_lain)}% dari total nilai pendapatan lain).`,
        'kualitas_pendapatan', 'informasional',
        'Prinsip keterbukaan/materialitas PSAK'
      )
    }
  }

  if (d.pendapatan_lain_lain && d.pendapatan_jasa_keperantaraan != null) {
    const totalLain = d.pendapatan_lain_lain.reduce((s, x) => s + x.nilai, 0)
    if (totalLain > (d.pendapatan_jasa_keperantaraan ?? 0)) {
      push(
        `Pendapatan lain (Rp${fmt(totalLain)}) tercatat lebih besar dari pendapatan jasa keperantaraan (Rp${fmt(d.pendapatan_jasa_keperantaraan)}), yang merupakan kegiatan usaha utama perusahaan pialang.`,
        'kualitas_pendapatan', 'perlu_perhatian',
        'Indikator analitis (red flag)'
      )
    }
  }

  // ─── LR07 / LK02 — komisi ─────────────────────────────────────────────────

  if (d.top10_penerima_komisi === null) {
    push('Data sheet LR07 (Daftar Penerima Komisi) tidak tersedia dalam Excel yang diupload; pemeriksaan atas distribusi dan kelengkapan perjanjian komisi tidak dapat dilakukan.', 'informasi_komisi', 'informasional', '-')
  } else if (d.top10_penerima_komisi.length > 0) {
    const daftar = d.top10_penerima_komisi
      .slice(0, 10)
      .map((x, i) => `${i + 1}. ${x.nama} (No. Perjanjian: ${x.nomor_perjanjian || '-'}, sebesar Rp${fmt(x.jumlah)}, ${x.persentase.toFixed(1)}% dari total beban komisi)`)
      .join(' ')
    push(
      `${d.top10_penerima_komisi.length > 10 ? '10' : d.top10_penerima_komisi.length} penerima komisi terbesar: ${daftar}${d.top10_penerima_komisi.length > 10 ? ` ...dan ${d.top10_penerima_komisi.length - 10} penerima komisi lainnya.` : ''}`,
      'informasi_komisi', 'informasional',
      'Informasional'
    )
  }

  if (d.ada_komisi_tanpa_perjanjian && d.ada_komisi_tanpa_perjanjian.length > 0) {
    for (const k of d.ada_komisi_tanpa_perjanjian) {
      push(
        `Terdapat penerima komisi (${k.nama}) tanpa nomor perjanjian kerjasama yang tercatat.`,
        'kepatuhan', 'perlu_perhatian',
        'POJK 70/2016 Pasal 52 ayat (2) huruf b'
      )
    }
  }

  // Kenaikan beban komisi >50%
  if (d.beban_komisi_lk02 != null && d.beban_komisi_prev != null && d.beban_komisi_prev !== 0) {
    const kenaikan = ((d.beban_komisi_lk02 - d.beban_komisi_prev) / Math.abs(d.beban_komisi_prev)) * 100
    if (kenaikan > 50) {
      push(
        `Terdapat kenaikan signifikan beban komisi sebesar ${kenaikan.toFixed(2)}% dari Rp${fmt(d.beban_komisi_prev)} pada tahun sebelumnya menjadi Rp${fmt(d.beban_komisi_lk02)} pada tahun berjalan. Perlu pendalaman atas penyebab kenaikan beban komisi yang signifikan tersebut.`,
        'kualitas_pendapatan', 'perlu_perhatian',
        'Indikator analitis (red flag)'
      )
    }
  }

  // ─── FKRT ─────────────────────────────────────────────────────────────────

  if (d.jumlah_rapat_direksi === null && d.jumlah_rapat_komisaris === null) {
    push('Data sheet FKRT (Frekuensi Rapat) tidak tersedia dalam Excel yang diupload; pemeriksaan atas kepatuhan frekuensi rapat Direksi dan Dewan Komisaris tidak dapat dilakukan.', 'tata_kelola', 'informasional', '-')
  } else {
    if (d.deskripsi_rapat) {
      push(
        `Deskripsi frekuensi rapat: ${d.deskripsi_rapat}.`,
        'tata_kelola', 'informasional',
        'Informasional'
      )
    }
    if (d.jumlah_rapat_direksi != null && d.jumlah_rapat_direksi < 12) {
      push(
        `Rapat Direksi tercatat ${d.jumlah_rapat_direksi} kali dalam setahun, di bawah ketentuan minimal 1 (satu) kali per bulan (12 kali per tahun).`,
        'tata_kelola', 'perlu_perhatian',
        'POJK 73/2016 Pasal 15 ayat (1)'
      )
    }
    if (d.jumlah_rapat_komisaris != null && d.jumlah_rapat_komisaris < 12) {
      push(
        `Rapat Dewan Komisaris tercatat ${d.jumlah_rapat_komisaris} kali dalam setahun, di bawah ketentuan minimal 1 (satu) kali per bulan (12 kali per tahun).`,
        'tata_kelola', 'perlu_perhatian',
        'POJK 73/2016 Pasal 26 ayat (1)'
      )
    }
  }

  // ─── HKKS / HKKM / HKGD / HKDR ───────────────────────────────────────────

  if (d.hubungan_keluarga_komisaris === null && d.hubungan_keuangan_komisaris === null) {
    push('Data sheet HKKS/HKKM (Hubungan Keluarga & Keuangan Komisaris) tidak tersedia dalam Excel yang diupload; pemeriksaan atas independensi Dewan Komisaris tidak dapat dilakukan.', 'tata_kelola', 'informasional', '-')
  } else {
    for (const row of d.hubungan_keluarga_komisaris ?? []) {
      push(
        `${row.nama} (${row.jabatan}) memiliki hubungan keluarga dengan Dewan Komisaris lain (status: ${row.status_komisaris}), dengan Direksi (status: ${row.status_direksi}), dan dengan pemegang saham (status: ${row.status_ps}).`,
        'tata_kelola', 'informasional', 'Informasional'
      )
    }
    for (const row of d.hubungan_keuangan_komisaris ?? []) {
      push(
        `${row.nama} (${row.jabatan}) memiliki hubungan keuangan dengan Dewan Komisaris lain (status: ${row.status_komisaris}), dengan Direksi (status: ${row.status_direksi}), dan dengan pemegang saham (status: ${row.status_ps}).`,
        'tata_kelola', 'informasional', 'Informasional'
      )
    }
  }

  if (d.hubungan_keluarga_direksi === null && d.hubungan_keuangan_direksi === null) {
    push('Data sheet HKGD/HKDR (Hubungan Keluarga & Keuangan Direksi) tidak tersedia dalam Excel yang diupload; pemeriksaan atas independensi Direksi tidak dapat dilakukan.', 'tata_kelola', 'informasional', '-')
  } else {
    for (const row of d.hubungan_keluarga_direksi ?? []) {
      push(
        `${row.nama} (${row.jabatan}) memiliki hubungan keluarga dengan Direksi lain (status: ${row.status_direksi}), dengan Dewan Komisaris (status: ${row.status_komisaris}), dan dengan pemegang saham (status: ${row.status_ps}).`,
        'tata_kelola', 'informasional', 'Informasional'
      )
    }
    for (const row of d.hubungan_keuangan_direksi ?? []) {
      push(
        `${row.nama} (${row.jabatan}) memiliki hubungan keuangan dengan Direksi lain (status: ${row.status_direksi}), dengan Dewan Komisaris (status: ${row.status_komisaris}), dan dengan pemegang saham (status: ${row.status_ps}).`,
        'tata_kelola', 'informasional', 'Informasional'
      )
    }
  }

  // ─── RJBT ─────────────────────────────────────────────────────────────────

  if (d.rangkap_jabatan === null) {
    push('Data sheet RJBT (Rangkap Jabatan) tidak tersedia dalam Excel yang diupload; pemeriksaan atas kepatuhan larangan rangkap jabatan tidak dapat dilakukan.', 'tata_kelola', 'informasional', '-')
  } else {
    for (const row of d.rangkap_jabatan) {
      push(
        `${row.nama} menjabat sebagai ${row.posisi} di ${row.perusahaan_lain} yang bergerak di bidang ${row.bidang_usaha}.`,
        'tata_kelola', 'informasional',
        'POJK 24/2023 Pasal 26-27'
      )
    }
  }

  // ─── TPKP (RUPS) ─────────────────────────────────────────────────────────

  if (d.rups === null) {
    push('Data sheet TPKP (Tindak Lanjut Keputusan RUPS) tidak tersedia dalam Excel yang diupload; pemeriksaan atas pelaksanaan keputusan RUPS tidak dapat dilakukan.', 'tata_kelola', 'informasional', '-')
  } else {
    for (const row of d.rups) {
      push(
        `RUPS diselenggarakan pada ${row.tanggal} dengan keputusan: ${row.keputusan}.`,
        'tata_kelola', 'informasional', 'Informasional'
      )
    }
  }

  // ─── PP07 — indikasi penempatan afiliasi ──────────────────────────────────

  if (d.pihak_afiliasi.length > 0 && d.nama_di_pk_sheets.length > 0) {
    const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const afiliasiNorm = d.pihak_afiliasi.map(normalise)
    const pkNorm = d.nama_di_pk_sheets.map(normalise)
    const matches = afiliasiNorm.filter((a) => pkNorm.some((p) => p.includes(a) || a.includes(p)))
    for (const m of matches) {
      const orig = d.pihak_afiliasi.find((a) => normalise(a) === m) ?? m
      push(
        `Terdapat indikasi penempatan/penutupan kekayaan pada afiliasi: nama ${orig} yang tercatat sebagai pihak terafiliasi (PP07) juga ditemukan pada sheet kekayaan (PK01/PK03/PK09/PK10).`,
        'pihak_terafiliasi', 'perlu_perhatian',
        'POJK 70/2016 Pasal 41'
      )
    }
  }

  return hasil
}
