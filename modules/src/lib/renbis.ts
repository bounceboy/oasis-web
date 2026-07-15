/**
 * renbis.ts
 * Modul Evaluasi Rencana Bisnis (Renbis):
 * 1. Ekstrak teks PDF Renbis
 * 2. AI call 1 — isi kolom "Isian" KK per baris (berbasis PDF)
 * 3. AI call 2 — analisis + kesimpulan (row 39-40), grounded ke POJK Renbis
 * 4. Generate .docx KK yang sudah terisi
 */

import { callOpenRouter } from '@/lib/claude'
import { searchRelevantPojk } from '@/lib/pojk-search'

export interface KkRow {
  no: string
  hal: string
  keterangan: string
  isian: string          // diisi AI
}

export interface RenbisHasil {
  nama_perusahaan: string
  tahun: string
  kk_rows: KkRow[]
  analisis: string
  kesimpulan: string
}

// ─── KK Template (struktur tetap dari KK Renbis) ────────────────────────────

export const KK_TEMPLATE: Omit<KkRow, 'isian'>[] = [
  // Bagian 1 — Administratif
  { no: '1', hal: 'Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: 'Nomor surat Perusahaan' },
  { no: '',  hal: 'Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: 'Tanggal surat Perusahaan' },
  { no: '',  hal: 'Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: 'Batas waktu penyampaian telah sesuai ketentuan' },
  { no: '',  hal: 'Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: 'Nomor surat OJK' },
  { no: '',  hal: 'Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: 'Tanggal surat OJK' },
  { no: '',  hal: 'Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: 'Frekuensi telah sesuai ketentuan' },
  { no: '',  hal: 'Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: 'Disertai dengan media berupa compact disc (CD) atau media penyimpanan data elektronik lainnya' },
  // Bagian 2 — Penelitian
  { no: '2', hal: 'Penelitian atas Penyampaian/Penyesuaian/Perubahan Rencana Bisnis', keterangan: '' },
  { no: '',  hal: 'Persetujuan Dewan Komisaris', keterangan: 'Nama dan jabatan Dewan Komisaris yang menyetujui Rencana Bisnis' },
  { no: '',  hal: 'Cakupan Rencana Bisnis', keterangan: 'Catatan pengawas atas kelengkapan cakupan Rencana Bisnis' },
  // Checklist cakupan
  { no: '',  hal: 'Ringkasan Eksekutif', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Evaluasi atas pelaksanaan rencana bisnis periode sebelumnya', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Visi, misi dan strategi', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana kegiatan usaha', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pengembangan atau perluasan kegiatan usaha', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana komposisi investasi', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana permodalan', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pendanaan', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pengembangan/perubahan jaringan kantor', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pengembangan organisasi', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pemenuhan SDM', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pendidikan dan pelatihan SDM', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana penggunaan Tenaga Kerja Asing (TKA)', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pemanfaatan tenaga kerja alih daya', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pengembangan IT', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana produk', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana literasi', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana inklusi', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Proyeksi keuangan', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Asumsi yang digunakan', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana pengalihan portofolio pertanggungan', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana perubahan bidang usaha perasuransian', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana perubahan kegiatan usaha tidak syariah menjadi syariah', keterangan: 'Ada/Tidak Ada' },
  { no: '',  hal: 'Rencana aksi keuangan berkelanjutan', keterangan: 'Ada/Tidak Ada' },
  // Bagian 3 — Analisis
  { no: '3', hal: 'Tingkat Kesehatan Tahun Sebelumnya', keterangan: 'Catatan pengawas mengenai kondisi kesehatan perusahaan' },
  { no: '4', hal: 'Analisis Rencana Bisnis', keterangan: 'Analisis pengawas mengenai kewajaran Rencana Bisnis (target, asumsi, proyeksi keuangan, strategi)' },
  { no: '5', hal: 'Kesimpulan', keterangan: 'Kesimpulan pengawas: penyampaian tepat/tidak tepat waktu; cakupan lengkap/tidak lengkap; kewajaran rencana bisnis' },
]

// ─── Step 1: AI ekstrak & isi KK ────────────────────────────────────────────

export async function isiKkRenbis(
  teksRenbis: string,
  namaPerusahaan: string,
  tahun: string,
  pojkContext: string
): Promise<{ kk_rows: KkRow[]; analisis: string; kesimpulan: string }> {

  const templateJson = KK_TEMPLATE.map((r, i) => ({
    index: i,
    hal: r.hal,
    keterangan: r.keterangan,
  }))

  const system = `Anda adalah pengawas OJK yang mengisi Kertas Kerja (KK) Evaluasi Rencana Bisnis perusahaan asuransi.
Tugas: isi kolom "isian" untuk setiap baris KK berdasarkan isi dokumen Rencana Bisnis yang diberikan.

REFERENSI POJK RENBIS (SATU-SATUNYA SUMBER REGULASI YANG BOLEH DIGUNAKAN):
${pojkContext}

BATASAN KETAT — WAJIB DIPATUHI:
- HANYA gunakan informasi yang SECARA EKSPLISIT ADA dalam teks Rencana Bisnis yang diberikan.
- Jika informasi tidak ditemukan dalam dokumen, isi dengan "Tidak ditemukan dalam dokumen".
- DILARANG KERAS menyebut pasal, ketentuan, atau angka yang tidak ada dalam REFERENSI POJK di atas.
- Untuk baris checklist (Ada/Tidak Ada): jawab "Ada" jika bagian tersebut ditemukan, "Tidak Ada" jika tidak ditemukan. Sertakan 1-2 kalimat ringkas isinya jika Ada.
- Untuk baris analisis (no 4): analisis kewajaran target, asumsi, dan proyeksi secara objektif berdasarkan isi dokumen saja.
- Untuk baris kesimpulan (no 5): simpulkan penyampaian, kelengkapan, dan kewajaran.`

  const user = `Perusahaan: ${namaPerusahaan}, Tahun Rencana Bisnis: ${tahun}

TEKS RENCANA BISNIS:
${teksRenbis.slice(0, 120000)}

TEMPLATE KK (isi field "isian" untuk setiap baris):
${JSON.stringify(templateJson, null, 2)}

Output HARUS berupa JSON valid:
{
  "rows": [
    { "index": 0, "isian": "..." },
    { "index": 1, "isian": "..." },
    ...
  ]
}`

  const raw = await callOpenRouter(system, user, 8000)
  const greedyMatch = raw.match(/\{[\s\S]*\}/)
  const jsonStr = greedyMatch ? greedyMatch[0] : raw.match(/\{[\s\S]*/)?.at(0)
  if (!jsonStr) throw new Error('AI tidak mengembalikan JSON untuk KK Renbis')

  let parsed: { rows: { index: number; isian: string }[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    // repair truncated JSON
    const repaired = repairJson(jsonStr)
    parsed = JSON.parse(repaired)
  }

  const isianMap = new Map(parsed.rows.map((r) => [r.index, r.isian]))

  const kk_rows: KkRow[] = KK_TEMPLATE.map((tmpl, i) => ({
    ...tmpl,
    isian: isianMap.get(i) ?? 'Tidak ditemukan dalam dokumen',
  }))

  // Ambil analisis dan kesimpulan dari baris terakhir
  const analisis = kk_rows[kk_rows.length - 2]?.isian ?? ''
  const kesimpulan = kk_rows[kk_rows.length - 1]?.isian ?? ''

  return { kk_rows, analisis, kesimpulan }
}

function repairJson(s: string): string {
  s = s.trimEnd().replace(/[,\s]+$/, '')
  const stack: string[] = []
  let inStr = false, escape = false
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
  return s + stack.reverse().join('')
}

// ─── Step 2: Generate .docx ──────────────────────────────────────────────────

export async function generateRenbisDocx(
  namaPerusahaan: string,
  tahun: string,
  kkRows: KkRow[]
): Promise<Buffer> {
  const {
    Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
    WidthType, BorderStyle, AlignmentType, HeadingLevel,
  } = await import('docx')

  const border = { style: BorderStyle.SINGLE, size: 1, color: '000000' }
  const allBorders = { top: border, bottom: border, left: border, right: border }

  function cell(text: string, bold = false, width?: number, shading?: string) {
    return new TableCell({
      borders: allBorders,
      shading: shading ? { fill: shading, type: 'clear' } : undefined,
      width: width ? { size: width, type: WidthType.DXA } : undefined,
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold, size: 20, font: 'Arial' })],
          spacing: { before: 40, after: 40 },
        }),
      ],
    })
  }

  // Header rows
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('No.', true, 500, 'D9D9D9'),
      cell('Hal', true, 3000, 'D9D9D9'),
      cell('Keterangan', true, 4000, 'D9D9D9'),
      cell('Isian', true, 4000, 'D9D9D9'),
    ],
  })

  const dataRows = kkRows.map((row) => {
    const isSectionHeader = row.no !== '' && row.keterangan === ''
    const bg = isSectionHeader ? 'EBF3FB' : undefined
    return new TableRow({
      children: [
        cell(row.no, isSectionHeader, 500, bg),
        cell(row.hal, isSectionHeader, 3000, bg),
        cell(row.keterangan, false, 4000, bg),
        cell(row.isian, false, 4000),
      ],
    })
  })

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'KERTAS KERJA EVALUASI', bold: true, size: 24, font: 'Arial' })],
          spacing: { after: 0 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `PENELITIAN ATAS PENYAMPAIAN RENCANA BISNIS TAHUN ${tahun}`, bold: true, size: 24, font: 'Arial' })],
          spacing: { after: 0 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: namaPerusahaan.toUpperCase(), bold: true, size: 24, font: 'Arial' })],
          spacing: { after: 200 },
        }),
        table,
        new Paragraph({ text: '', spacing: { before: 400 } }),
        // TTD section
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ['Nama', 'Jabatan', 'Paraf', 'Tanggal'].map((h) =>
                new TableCell({ borders: allBorders, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: 'Arial' })] })] })
              ),
            }),
            ...Array(3).fill(null).map(() => new TableRow({
              children: Array(4).fill(null).map(() =>
                new TableCell({ borders: allBorders, children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })] })
              ),
            })),
          ],
        }),
      ],
    }],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
