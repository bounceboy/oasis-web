/**
 * Definisi 9 BAB KYIC: label, sub-sections, hints dokumen pendukung, dan prompt instructions.
 */

export type BabId =
  | 'kepemilikan'
  | 'kegiatan_bisnis'
  | 'kegiatan_penunjang'
  | 'rencana_bisnis'
  | 'tingkat_kesehatan'
  | 'kinerja_keuangan'
  | 'organisasi_mr_spi'
  | 'status_pengawasan'
  | 'fokus_pengawasan'

export interface DocHint {
  nama: string
  keterangan: string
  prioritas: 'tinggi' | 'sedang' | 'opsional'
}

export interface KyicBab {
  id: BabId
  nomor: number
  judul: string
  deskripsi: string
  sub_sections: string[]
  doc_hints: DocHint[]
  prompt_instruction: string
}

export const KYIC_BABS: KyicBab[] = [
  {
    id: 'kepemilikan',
    nomor: 1,
    judul: 'Kepemilikan & Struktur Kelompok Usaha',
    deskripsi: 'Profil perusahaan, struktur kepemilikan saham, dan hubungan dengan kelompok usaha.',
    sub_sections: [
      'Profil & Sejarah Perusahaan',
      'Visi & Misi',
      'Tipe & Struktur Kepemilikan',
      'Daftar Pemegang Saham',
      'Profil Pemegang Saham & Ultimate Shareholder',
      'Bagan Struktur Grup',
    ],
    doc_hints: [
      { nama: 'Akta Pendirian & Perubahan Terakhir', keterangan: 'Untuk verifikasi struktur kepemilikan dan perubahan pemegang saham', prioritas: 'tinggi' },
      { nama: 'Risalah RUPS / RUPSLB Terakhir', keterangan: 'Keputusan pemegang saham terkait permodalan dan perubahan struktur', prioritas: 'tinggi' },
      { nama: 'Daftar Pemegang Saham Terbaru', keterangan: 'Komposisi saham per tanggal penilaian', prioritas: 'tinggi' },
      { nama: 'Profil Ultimate Shareholder', keterangan: 'Annual report / laporan keuangan pemegang saham pengendali', prioritas: 'sedang' },
      { nama: 'Bagan Struktur Kepemilikan', keterangan: 'Visualisasi hubungan dengan entitas lain dalam kelompok usaha', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis struktur kepemilikan perusahaan. Fokus pada:
1. Apakah ada perubahan kepemilikan signifikan vs periode lalu?
2. Risiko konsentrasi kepemilikan (majority shareholder tunggal?)
3. Kualitas dan track record ultimate shareholder
4. Komitmen pemegang saham terhadap keberlangsungan perusahaan (bukti konkret seperti injeksi modal, qardh, dll)
5. Potensi conflict of interest atau transaksi afiliasi yang perlu diawasi`,
  },
  {
    id: 'kegiatan_bisnis',
    nomor: 2,
    judul: 'Kegiatan & Bisnis Utama',
    deskripsi: 'Jenis usaha, lini produk, data kontribusi dan klaim per produk.',
    sub_sections: [
      'Jenis Usaha & Izin yang Dimiliki',
      'Produk yang Dipasarkan',
      'Data Kontribusi per Produk (5 Tahun)',
      'Data Klaim Bruto per Produk (5 Tahun)',
      'Rasio Klaim per Produk',
    ],
    doc_hints: [
      { nama: 'Laporan Produksi Bulanan/Tahunan', keterangan: 'Data premi/kontribusi bruto per lini produk per tahun', prioritas: 'tinggi' },
      { nama: 'Laporan Klaim per Produk', keterangan: 'Tren klaim bruto dan rasio klaim per lini usaha', prioritas: 'tinggi' },
      { nama: 'Brosur / Ilustrasi Produk Terbaru', keterangan: 'Untuk verifikasi fitur produk dan kesesuaian dengan izin', prioritas: 'sedang' },
      { nama: 'Laporan Reasuransi', keterangan: 'Treaty reasuransi, retensi, dan recovery klaim dari reasuradur', prioritas: 'sedang' },
      { nama: 'Statistik Pertumbuhan Polis', keterangan: 'Jumlah polis in-force, new business, dan lapse rate', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis kegiatan dan bisnis utama perusahaan. Fokus pada:
1. Tren kontribusi bruto per lini usaha — tumbuh, stagnan, atau menurun?
2. Rasio klaim per produk — apakah ada lini yang claims ratio >100%?
3. Konsentrasi produk — apakah terlalu bergantung pada satu produk/segmen?
4. Kesesuaian produk yang dipasarkan dengan izin usaha yang dimiliki
5. Efektivitas program reasuransi dalam memitigasi risiko klaim besar`,
  },
  {
    id: 'kegiatan_penunjang',
    nomor: 3,
    judul: 'Kegiatan Penunjang',
    deskripsi: 'Struktur organisasi, SDM, kelengkapan komite, dan kerjasama pihak ketiga.',
    sub_sections: [
      'Struktur Organisasi',
      'Sumber Daya Manusia',
      'Komite di Bawah Direksi (MR, Investasi, dll)',
      'Komite di Bawah Komisaris (Audit, Pemantau Risiko, Tata Kelola)',
      'Jaringan Kantor',
      'Kerjasama Pihak Ketiga (Reasuransi, Vendor, dll)',
    ],
    doc_hints: [
      { nama: 'Struktur Organisasi Terbaru', keterangan: 'Org chart per tanggal penilaian, termasuk jabatan yang kosong', prioritas: 'tinggi' },
      { nama: 'SK Pengangkatan Anggota Komite', keterangan: 'Komite Audit, Pemantau Risiko, Investasi, Manajemen Risiko, Tata Kelola', prioritas: 'tinggi' },
      { nama: 'Daftar SDM per Divisi', keterangan: 'Jumlah karyawan, tingkat pendidikan, jabatan, dan turnover', prioritas: 'sedang' },
      { nama: 'Daftar Perjanjian Kerjasama (PKS) Pihak Ketiga', keterangan: 'Semua PKS aktif: reasuransi, IT, outsourcing, agen, bancassurance', prioritas: 'sedang' },
      { nama: 'Notulen Rapat Komite Terakhir', keterangan: 'Bukti efektivitas komite — frekuensi rapat, agenda, dan tindak lanjut', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis kegiatan penunjang perusahaan. Fokus pada:
1. Kelengkapan komite wajib (Audit, Pemantau Risiko, MR, Tata Kelola, Investasi) — sesuai POJK?
2. Kecukupan kuantitas dan kualitas SDM untuk skala bisnis perusahaan
3. Jabatan kunci yang kosong atau dirangkap (perangkapan jabatan)
4. Risiko ketergantungan pada pihak ketiga — terutama core system IT dan reasuradur
5. Kualitas reasuradur (rating, status pengawasan) — apakah ada reasuradur bermasalah?`,
  },
  {
    id: 'rencana_bisnis',
    nomor: 4,
    judul: 'Rencana Bisnis',
    deskripsi: 'Proyeksi keuangan, rencana permodalan, rencana pengembangan produk, SDM, dan TI.',
    sub_sections: [
      'Proyeksi Keuangan Tahun Berikutnya (Dana Perusahaan, Dana Tabarru, DIP)',
      'Rencana Penambahan SDM',
      'Rencana Pengembangan Teknologi Informasi',
      'Rencana Pengembangan & Pemasaran Produk',
      'Rencana Permodalan',
    ],
    doc_hints: [
      { nama: 'Rencana Bisnis Perusahaan (RBB/RB)', keterangan: 'Dokumen resmi rencana bisnis yang disampaikan ke OJK', prioritas: 'tinggi' },
      { nama: 'Realisasi Rencana Bisnis Tahun Lalu', keterangan: 'Untuk menilai track record pencapaian target', prioritas: 'tinggi' },
      { nama: 'Surat Komitmen Pemegang Saham', keterangan: 'Komitmen tertulis terkait rencana penambahan modal', prioritas: 'sedang' },
      { nama: 'Rencana Pengembangan Produk', keterangan: 'Produk baru yang sedang/akan dikembangkan', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis rencana bisnis perusahaan. Fokus pada:
1. Realistis/ambisius-nya proyeksi keuangan — bandingkan dengan tren historis
2. Rencana permodalan: apakah ada komitmen konkret dan timeline yang jelas untuk memenuhi ekuitas minimum?
3. Track record pencapaian rencana bisnis tahun lalu (realisasi vs target)
4. Kesesuaian rencana bisnis dengan kondisi perusahaan dan arahan pengawas
5. Feasibility rencana pengembangan produk dan TI mengingat kondisi keuangan`,
  },
  {
    id: 'tingkat_kesehatan',
    nomor: 5,
    judul: 'Tingkat Kesehatan',
    deskripsi: 'Penilaian profil risiko (9 jenis), GCG, rentabilitas, permodalan, dan peringkat komposit.',
    sub_sections: [
      'Peringkat Komposit Akhir',
      'Profil Risiko: Risiko Strategis',
      'Profil Risiko: Risiko Operasional',
      'Profil Risiko: Risiko Asuransi',
      'Profil Risiko: Risiko Kredit',
      'Profil Risiko: Risiko Pasar',
      'Profil Risiko: Risiko Likuiditas',
      'Profil Risiko: Risiko Hukum',
      'Profil Risiko: Risiko Kepatuhan',
      'Profil Risiko: Risiko Reputasi',
      'Peringkat GCG',
      'Peringkat Rentabilitas',
      'Peringkat Permodalan',
    ],
    doc_hints: [
      { nama: 'Update Tingkat Kesehatan (UTK) Terakhir', keterangan: 'Dokumen UTK periode sebelumnya sebagai baseline perbandingan', prioritas: 'tinggi' },
      { nama: 'Laporan Hasil Pemeriksaan Langsung (LHPL)', keterangan: 'Temuan pemeriksaan yang relevan untuk penilaian risiko', prioritas: 'tinggi' },
      { nama: 'Laporan Profil Risiko Perusahaan', keterangan: 'Self-assessment profil risiko yang disampaikan perusahaan', prioritas: 'sedang' },
      { nama: 'Laporan GCG Tahunan', keterangan: 'Self-assessment tata kelola perusahaan', prioritas: 'sedang' },
      { nama: 'Risk Register Perusahaan', keterangan: 'Daftar risiko yang diidentifikasi dan mitigasinya', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis dan tetapkan peringkat tingkat kesehatan. Fokus pada:
1. Penetapan rating Inheren, KPMR, dan Net Risk untuk setiap jenis risiko (skala 1-5, berikan justifikasi)
2. Perubahan peringkat vs periode T-1 — apa yang membaik/memburuk?
3. Penetapan peringkat GCG berdasarkan fakta tata kelola perusahaan
4. Penetapan peringkat Rentabilitas berdasarkan tren laba dan rasio keuangan
5. Penetapan peringkat Permodalan berdasarkan RBC, ekuitas vs minimum, dan tren
6. Justifikasi peringkat komposit akhir (rata-rata tertimbang semua komponen)
Format output: JSON dengan risk_matrix, gcg, rentabilitas, permodalan, peringkat_komposit, dan narasi per komponen.`,
  },
  {
    id: 'kinerja_keuangan',
    nomor: 6,
    judul: 'Kinerja Keuangan',
    deskripsi: 'Analisis indikator keuangan utama 5 tahun: aset, liabilitas, ekuitas, investasi, RBC, RKI, likuiditas.',
    sub_sections: [
      'Tren Aset & Liabilitas (5 Tahun)',
      'Tren Ekuitas Dana Perusahaan',
      'Portofolio & Hasil Investasi',
      'RBC Dana Tabarru & Dana Perusahaan',
      'RKI (Rasio Kecukupan Investasi)',
      'Rasio Likuiditas',
      'Kontribusi Bruto & Beban Klaim',
      'Laba/Rugi Perusahaan',
    ],
    doc_hints: [
      { nama: 'Laporan Keuangan SAP (Statutory)', keterangan: 'Lapkeu SAP terbaru — Dana Perusahaan, Dana Tabarru, Dana Investasi Peserta', prioritas: 'tinggi' },
      { nama: 'Catatan Atas Laporan Keuangan (CALK)', keterangan: 'Detail pos-pos signifikan, kebijakan akuntansi, contingencies', prioritas: 'tinggi' },
      { nama: 'Laporan Opini Auditor (KAP)', keterangan: 'Opini audit dan temuan material (Disclaimer, WDP, WTP)', prioritas: 'tinggi' },
      { nama: 'Laporan Perhitungan RBC', keterangan: 'Detail perhitungan Risk Based Capital dan komponennya', prioritas: 'sedang' },
      { nama: 'Portofolio Investasi Rinci', keterangan: 'Komposisi investasi per instrumen, counterparty, dan kualitas', prioritas: 'sedang' },
      { nama: 'Laporan Reasuransi (Bordereau)', keterangan: 'Data klaim ceded, premi ceded, dan recovery aktual', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis kinerja keuangan perusahaan. Fokus pada:
1. Tren 5 tahun aset, liabilitas, ekuitas — apakah ada deteriorasi?
2. Analisis RBC Dana Tabarru (ambang batas 100% untuk intensif) dan Dana Perusahaan
3. Kecukupan investasi (RKI) dan kualitas portofolio investasi
4. Tren kontribusi vs klaim — apakah underwriting profitable?
5. Analisis ekuitas vs ketentuan minimum POJK dan timeline pemenuhannya
6. Hal-hal material dalam opini auditor yang perlu diperhatikan`,
  },
  {
    id: 'organisasi_mr_spi',
    nomor: 7,
    judul: 'Organisasi, Manajemen Risiko & SPI',
    deskripsi: 'Framework manajemen risiko, sistem pengendalian internal, dan hasil audit eksternal.',
    sub_sections: [
      'Struktur Tata Kelola Organisasi',
      'Framework & Kebijakan Manajemen Risiko',
      'Implementasi Manajemen Risiko',
      'Lingkungan Pengendalian Internal',
      'Penilaian Risiko Internal',
      'Kegiatan Pengendalian',
      'Hasil Audit Eksternal (KAP)',
    ],
    doc_hints: [
      { nama: 'Kebijakan & Prosedur Manajemen Risiko', keterangan: 'Dokumen framework MR yang berlaku — apakah up-to-date?', prioritas: 'tinggi' },
      { nama: 'Laporan Audit Internal Terakhir', keterangan: 'Temuan internal audit dan status tindak lanjut', prioritas: 'tinggi' },
      { nama: 'Laporan Auditor Eksternal (KAP)', keterangan: 'Opini, management letter, dan temuan signifikan', prioritas: 'tinggi' },
      { nama: 'Hasil Self-Assessment GCG', keterangan: 'Penilaian mandiri tata kelola perusahaan', prioritas: 'sedang' },
      { nama: 'Laporan Dewan Komisaris Tahunan', keterangan: 'Pengawasan komisaris terhadap direksi dan manajemen', prioritas: 'sedang' },
      { nama: 'Risk Register / Risk Dashboard', keterangan: 'Daftar risiko, level, dan status mitigasi terkini', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis organisasi, manajemen risiko, dan sistem pengendalian internal. Fokus pada:
1. Kematangan framework manajemen risiko — apakah hanya formalitas atau terimplementasi?
2. Temuan signifikan audit internal dan status penyelesaiannya
3. Implikasi opini auditor eksternal (khusus jika Disclaimer atau WDP)
4. Kelemahan pengendalian internal yang kritis
5. Efektivitas fungsi pengawasan Dewan Komisaris
6. Apakah terdapat bukti financial engineering atau manipulasi data?`,
  },
  {
    id: 'status_pengawasan',
    nomor: 8,
    judul: 'Status Pengawasan, Kepatuhan & Isu Hukum',
    deskripsi: 'Status pengawasan OJK, indikator kepatuhan, Supervisory Concern, analisis akar, dan Supervisory Action.',
    sub_sections: [
      'Status Pengawasan (Normal/Intensif/Khusus)',
      'Indikator Kepatuhan (RBC, RKI, Rasio Likuiditas, TKS)',
      'Isu Hukum & Sengketa',
      'Supervisory Concern',
      'Analisis Akar Permasalahan',
      'Supervisory Action',
      'Progress Report Tindak Lanjut Sebelumnya',
    ],
    doc_hints: [
      { nama: 'Surat OJK Terkini (Surat Pengawasan)', keterangan: 'Surat pengawasan, peringatan, atau penetapan status pengawasan', prioritas: 'tinggi' },
      { nama: 'Laporan Pemeriksaan Terkini (LHPL/LHP)', keterangan: 'Temuan pemeriksaan langsung atau tidak langsung terakhir', prioritas: 'tinggi' },
      { nama: 'Tanggapan Perusahaan atas Temuan', keterangan: 'Respon dan tindak lanjut perusahaan atas temuan OJK', prioritas: 'tinggi' },
      { nama: 'Laporan Realisasi Rencana Tindak (Action Plan)', keterangan: 'Status pelaksanaan rencana tindak yang telah disepakati', prioritas: 'sedang' },
      { nama: 'Dokumen Sengketa / Perkara Hukum', keterangan: 'Gugatan, arbitrase, atau kasus hukum yang sedang berjalan', prioritas: 'sedang' },
      { nama: 'Laporan Pengaduan Nasabah', keterangan: 'Volume, tipe, dan penyelesaian pengaduan nasabah', prioritas: 'opsional' },
    ],
    prompt_instruction: `Analisis status pengawasan, kepatuhan, dan isu hukum. Fokus pada:
1. Ringkasan status pengawasan saat ini dan dasar penetapannya
2. Kepatuhan terhadap indikator kunci (RBC, RKI, rasio likuiditas) — mana yang melanggar?
3. Supervisory Concern: apa isu-isu utama yang menjadi perhatian pengawas?
4. Analisis akar permasalahan — apa penyebab fundamental dari masalah yang ada?
5. Supervisory Action: tindakan pengawasan apa yang telah dan akan diambil?
6. Progress tindak lanjut dari pengawasan sebelumnya — ada yang belum diselesaikan?`,
  },
  {
    id: 'fokus_pengawasan',
    nomor: 9,
    judul: 'Penetapan Fokus Pengawasan',
    deskripsi: 'Fokus pengawasan utama dan lainnya untuk periode berikutnya berdasarkan seluruh analisis.',
    sub_sections: [
      'Fokus Pengawasan Utama',
      'Fokus Pengawasan Lainnya',
    ],
    doc_hints: [
      { nama: 'Ringkasan Seluruh Analisis Sebelumnya', keterangan: 'Hasil analisis BAB 1-8 menjadi input utama untuk BAB ini', prioritas: 'tinggi' },
      { nama: 'Rencana Pengawasan Periode Ini', keterangan: 'Work plan atau rencana pengawasan yang sudah disusun', prioritas: 'sedang' },
    ],
    prompt_instruction: `Berdasarkan seluruh analisis BAB 1-8, tetapkan fokus pengawasan untuk periode berikutnya. Fokus pada:
1. Identifikasi 2-3 fokus pengawasan UTAMA yang paling kritis (dengan justifikasi)
2. Fokus pengawasan lainnya (sekunder) yang tetap perlu dipantau
3. Tindakan konkret yang perlu dilakukan pengawas dalam periode berikutnya
4. Milestones yang harus dipantau (deadline ekuitas minimum, komitmen pemegang saham, dll)
5. Recommendation untuk eskalasi atau de-eskalasi status pengawasan`,
  },
]

export const KYIC_BABS_MAP = Object.fromEntries(KYIC_BABS.map(b => [b.id, b])) as Record<BabId, KyicBab>
