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
  "nama_di_pk_sheets": [string]
}

Catatan ekstraksi:
- pemegang_saham_prev: data pemegang saham TAHUN SEBELUMNYA (cari kolom/header "tahun lalu" atau "sebelumnya" atau periode n-1)
- direksi_komisaris_prev & tenaga_ahli_pialang_prev: sama, tahun sebelumnya
- beban_komisi_prev: beban komisi tahun sebelumnya dari LK02
- piutang_aging_lewat_30_sudah_bayar: PK10, baris di mana aging > 30 hari DAN status pembayaran tertanggung = sudah bayar
- klaim_terlambat_*: OP02, hitung selisih hari kerja (Senin-Jumat) — >1 hari kerja untuk penerusan/dokumen, >3 hari kerja untuk tanggapan tertanggung
- rasio_kecukupan_dana_premi_ditahan & rasio_biaya_diklat: bisa ada di sheet OP06 atau Data Umum atau dihitung dari sheet lain
- pihak_afiliasi: daftar nama dari PP07
- nama_di_pk_sheets: semua nama/entitas yang muncul di sheet PK01, PK03, PK09, PK10 (kolom nama_penanggung)`

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

export async function generateLhptlDocx(
  namaEntitas: string,
  jenisEntitas: string,
  periode: string,
  hasil: HasilPengawasan[],
  kesimpulan: string,
  tindak_lanjut: string
): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, WidthType, BorderStyle,
  } = await import('docx')

  const pelanggaran = hasil.filter((h) => h.tipe === 'pelanggaran')
  const perhatian = hasil.filter((h) => h.tipe === 'perlu_perhatian')

  // ─ Helpers ─────────────────────────────────────────────────────────────
  const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) =>
    new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } })

  const body = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, size: 24 })], spacing: { after: 100 } })

  const bold = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, bold: true, size: 24 })], spacing: { after: 60 } })

  // ─ Tabel Hasil Pengawasan ──────────────────────────────────────────────
  const tipeLabel = (t: HasilPengawasan['tipe']) => {
    if (t === 'pelanggaran') return 'Indikasi Pelanggaran'
    if (t === 'perlu_perhatian') return 'Perlu Perhatian'
    return ''
  }

  const borderNone = { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' }
  const cellBorder = { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone }

  const hasilRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'No', bold: true })] })], width: { size: 5, type: WidthType.PERCENTAGE }, borders: cellBorder }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Hasil Pengawasan', bold: true })] })], width: { size: 75, type: WidthType.PERCENTAGE }, borders: cellBorder }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Indikasi Pelanggaran', bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE }, borders: cellBorder }),
      ],
      tableHeader: true,
    }),
    ...hasil.map(
      (h) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(h.nomor) })] })], borders: cellBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h.catatan })] })], borders: cellBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tipeLabel(h.tipe) })] })], borders: cellBorder }),
          ],
        })
    ),
  ]

  // ─ Tindak Lanjut — parse poin bernomor ────────────────────────────────
  const tindakPoin = tindak_lanjut
    .split(/\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const tindakRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'No', bold: true })] })], width: { size: 5, type: WidthType.PERCENTAGE }, borders: cellBorder }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tindakan Pengawasan', bold: true })] })], width: { size: 75, type: WidthType.PERCENTAGE }, borders: cellBorder }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Target Penyelesaian', bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE }, borders: cellBorder }),
      ],
      tableHeader: true,
    }),
    ...tindakPoin.map(
      (poin, i) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1) })] })], borders: cellBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: poin })] })], borders: cellBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '' })] })], borders: cellBorder }),
          ],
        })
    ),
  ]

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Judul
          new Paragraph({
            children: [new TextRun({ text: 'LAPORAN HASIL PENGAWASAN TIDAK LANGSUNG', bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: namaEntitas, bold: true, size: 26 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // Ringkasan
          bold(`Periode: ${periode}`),
          bold(`Jenis Entitas: ${jenisEntitas}`),
          new Paragraph({ text: '', spacing: { after: 100 } }),
          bold(`Ringkasan Temuan: ${hasil.length} item (${pelanggaran.length} pelanggaran, ${perhatian.length} perlu perhatian)`),
          new Paragraph({ text: '', spacing: { after: 200 } }),

          // Hasil Pengawasan
          heading('HASIL PENGAWASAN TIDAK LANGSUNG'),
          new Table({ rows: hasilRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
          new Paragraph({ text: '', spacing: { after: 300 } }),

          // Kesimpulan
          heading('KESIMPULAN PENGAWASAN TIDAK LANGSUNG'),
          ...kesimpulan.split('\n').filter(Boolean).map((p) => body(p)),
          new Paragraph({ text: '', spacing: { after: 300 } }),

          // Tindak Lanjut
          heading('TINDAK LANJUT HASIL PENGAWASAN TIDAK LANGSUNG'),
          new Table({ rows: tindakRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
          new Paragraph({ text: '', spacing: { after: 400 } }),

          // TTD
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
        ],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
