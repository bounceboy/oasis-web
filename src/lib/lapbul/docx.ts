/**
 * Laporan Word analisis lapbul penjaminan (dibangun di browser dengan pustaka `docx`).
 * Format: Bookman Old Style, header tabel C6D9F1, logo OJK di sampul, bagian I–VII + lampiran jejak sumber.
 */
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, PageBreak, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} from 'docx'
import type { LapbulData } from './parse'
import { type Analysis, type Der, type Params, type Ref, LINGKUP, STAT, fmtVal, idn, refLabel, rpF, sheetTitle } from './engine'

const FONT = 'Bookman Old Style'
const HDR = 'C6D9F1'
const FILL = { ok: 'E2F0D9', bad: 'F8D7DA', warn: 'FFF2CC', na: 'EDEDED' } as const
const CM = 567 // twip per cm

type Cellish = string | { t: string; b?: boolean; a?: 'c' | 'r'; fill?: string; hl?: boolean }

const run = (text: string, o: { size?: number; bold?: boolean; italic?: boolean; color?: string; hl?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: Math.round((o.size ?? 10) * 2), bold: o.bold, italics: o.italic, color: o.color, highlight: o.hl ? 'yellow' : undefined })

function para(text: string, o: { size?: number; bold?: boolean; italic?: boolean; align?: 'c' | 'j'; before?: number; after?: number; hl?: boolean; keep?: boolean; heading?: boolean } = {}) {
  const lines = text.split('\n')
  return new Paragraph({
    outlineLevel: o.heading ? 0 : undefined,
    alignment: o.align === 'c' ? AlignmentType.CENTER : o.align === 'j' ? AlignmentType.JUSTIFIED : undefined,
    spacing: { before: (o.before ?? 0) * 20, after: (o.after ?? 4) * 20 },
    keepNext: o.keep,
    children: lines.flatMap((l, i) => (i ? [new TextRun({ break: 1 }), run(l, o)] : [run(l, o)])),
  })
}
const heading = (t: string) => para(t, { size: 12, bold: true, before: 14, after: 6, keep: true, heading: true })

function table(headers: string[], rows: Cellish[][], widths: number[], size = 8.5, numCols: number[] = []) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const mk = (v: Cellish, i: number, head = false) => {
    const o = typeof v === 'string' ? { t: v } : v
    const align = head || o.a === 'c' ? AlignmentType.CENTER : o.a === 'r' || numCols.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT
    const lines = String(o.t ?? '').split('\n')
    return new TableCell({
      width: { size: Math.round(widths[i] * CM), type: WidthType.DXA }, borders,
      shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: HDR } : o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      margins: { top: 30, bottom: 30, left: 70, right: 70 },
      children: [new Paragraph({ alignment: align, spacing: { before: 20, after: 20 }, children: lines.flatMap((l, j) => (j ? [new TextRun({ break: 1 }), run(l, { size, bold: head || o.b, hl: o.hl })] : [run(l, { size, bold: head || o.b, hl: o.hl })])) })],
    })
  }
  return [
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: Math.round(widths.reduce((a, b) => a + b, 0) * CM), type: WidthType.DXA },
      columnWidths: widths.map(w => Math.round(w * CM)),
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => mk(h, i, true)) }),
        ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((v, i) => mk(v, i)) })),
      ],
    }),
    para('', { after: 2 }),
  ]
}
const stCell = (st: keyof typeof FILL, txt: string): Cellish => ({ t: txt, b: true, a: 'c', fill: FILL[st] })

export interface ReportInput { L: LapbulData; A: Analysis; P: Params; namaEntitas: string; logo?: ArrayBuffer | Uint8Array | null; dibaca: string }

export function buildReportDoc({ L, A, P, namaEntitas, logo, dibaca }: ReportInput): Document {
  const D = A.D
  const short = (r: Ref) => refLabel(r, D)
  // jejak sumber: kumpulkan seluruh referensi (rekursif untuk angka turunan)
  const used = new Map<string, { lembar: string; kode: string; uraian: string; nilai: string }>()
  const visit = (r: Ref, depth = 0) => {
    if (r.t === 's') {
      const id = `${r.sheet}|${r.addr}`
      if (!used.has(id)) used.set(id, { lembar: `LBPPNJK-${r.sheet}`, kode: `${r.k} · sel ${r.addr}`, uraian: [r.u, r.h].filter(Boolean).join(' — '), nilai: typeof r.v === 'number' ? idn(r.v, Number.isInteger(r.v) ? 0 : 2) : r.v })
    } else {
      const d: Der | undefined = D[r.id]
      const id = 'd|' + r.id
      if (!d || used.has(id)) return
      used.set(id, { lembar: '(dihitung)', kode: 'ƒ', uraian: `${d.label}\nRumus: ${d.formula}`, nilai: fmtVal(d.value, d.unit) })
      if (depth < 4) d.inputs.slice(0, 120).forEach(x => visit(x, depth + 1))
    }
  }
  A.tests.forEach(t => t.refs.forEach(r => visit(r)))
  A.checks.forEach(c => c.refs.forEach(r => visit(r)))
  A.scn.forEach(s => s.steps.forEach(st => st.refs.forEach(r => visit(r))))

  const c = A.sum, n = A.tests.length
  const gagal = A.checks.filter(x => x.status === 'warn')
  const posisi = L.posisi || '—'
  const body: (Paragraph | Table)[] = []

  // ---- sampul ----
  body.push(para(''), para(''))
  if (logo) body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 265, height: 187 } })] }))
  body.push(para(''), para(''), para(''))
  body.push(para('Laporan Analisis', { size: 14, bold: true, align: 'c', after: 2 }))
  body.push(para('Laporan Bulanan Perusahaan Penjaminan', { size: 14, bold: true, align: 'c', after: 14 }))
  body.push(para(namaEntitas, { size: 13, bold: true, align: 'c', after: 6 }))
  body.push(para(`Posisi laporan ${posisi}`, { size: 11, align: 'c', after: 2 }))
  body.push(para(`Lapbul dibaca ${dibaca}`, { size: 11, align: 'c', after: 26 }))
  body.push(para('Draf analisis OASIS untuk diverifikasi pengawas. Seluruh angka dibaca langsung dari berkas lapbul dengan aturan tetap.', { size: 9.5, italic: true, align: 'c', after: 60 }))
  body.push(para('[Nama Departemen Pengawasan]', { size: 11, align: 'c', hl: true, after: 2 }))
  body.push(para(String(new Date().getFullYear()), { size: 11, align: 'c' }))
  body.push(new Paragraph({ children: [new PageBreak()] }))

  // ---- I ----
  body.push(heading('I. Ringkasan'))
  body.push(para(`Lapbul ${namaEntitas} posisi ${posisi} dibaca dan diuji terhadap ${n} ketentuan yang dipetakan. Hasilnya: ${c.ok} ketentuan terpenuhi, ${c.bad} tidak terpenuhi, ${c.warn} perlu klarifikasi, dan ${c.na} tidak dapat diuji karena datanya tidak tersedia di lapbul. Pemeriksaan konsistensi antar lembar menemukan ${gagal.length} selisih dari ${A.checks.length} pemeriksaan.`, { align: 'j', after: 6 }))
  body.push(...table(['Memenuhi', 'Tidak memenuhi', 'Perlu klarifikasi', 'Tidak dapat diuji'],
    [[stCell('ok', String(c.ok)), stCell('bad', String(c.bad)), stCell('warn', String(c.warn)), stCell('na', String(c.na))]], [4.25, 4.25, 4.25, 4.25], 10))
  const tm = A.tests.filter(t => t.status === 'bad' || t.status === 'warn')
  if (tm.length || gagal.length) {
    body.push(para('Temuan utama', { size: 10.5, bold: true, before: 4, after: 3 }))
    tm.forEach(t => body.push(para(`• ${t.judul}: ${t.nilai} (batas ${t.batas}), ${STAT[t.status].toLowerCase()} [${t.pasal}].`, { size: 9.5, after: 2 })))
    gagal.forEach(x => body.push(para(`• Konsistensi antar lembar: ${x.judul}. ${x.ket}`, { size: 9.5, after: 2 })))
  }
  body.push(para(`Pengaturan analisis: lingkup wilayah ${LINGKUP[P.lingkup].label.toLowerCase()}; porsi ditanggung sendiri ${idn(P.porsi, 0)}%; IBNR ${A.ibnr.metode === 'tepat' ? 'dihitung dari lapbul tiga bulan sebelumnya' : 'pendekatan rata-rata bulanan'}.`, { size: 9, italic: true, before: 4, after: 4 }))

  // ---- II ----
  body.push(heading('II. Dasar ketentuan yang diuji'))
  body.push(...table(['No', 'Ketentuan', 'Pokok', 'Isi ketentuan (ringkas)'], A.tests.map((t, i) => [String(i + 1), t.pasal, t.judul, t.aturan]), [0.9, 3.6, 3.6, 8.9], 8))

  // ---- III ----
  body.push(heading('III. Data sumber yang dibaca'))
  body.push(para(`Sumber: berkas ${L.file} (format APOLO, LBPPNJK) posisi ${posisi}. Lembar yang dibaca:`, { after: 4 }))
  body.push(...table(['No', 'Lembar', 'Judul lembar', 'Baris'], A.sheetsRead.map((x, i) => [String(i + 1), 'LBPPNJK-' + x.id, x.title, String(x.rows)]), [1.0, 3.4, 10.8, 1.8], 8.5, [3]))

  // ---- IV ----
  body.push(heading('IV. Hasil pengujian ketentuan'))
  body.push(...table(['No', 'Ketentuan', 'Nilai', 'Batas', 'Status', 'Perhitungan dan catatan', 'Sumber'],
    A.tests.map((t, i) => [String(i + 1), `${t.judul}\n${t.pasal}`, t.nilai, t.batas, stCell(t.status, STAT[t.status]), [t.calc, t.note].filter(Boolean).join(' '), t.refs.map(short).join('; ') || '—']),
    [0.8, 3.4, 2.0, 2.0, 1.9, 4.5, 2.4], 7.5))

  // ---- V ----
  body.push(heading('V. Anomali konsistensi antar lembar'))
  body.push(para(`${A.checks.length} pemeriksaan dilakukan; ${gagal.length} menunjukkan selisih.`, { after: 4 }))
  body.push(...table(['No', 'Pemeriksaan', 'Keterangan', 'Selisih', 'Hasil', 'Sumber'],
    A.checks.map((x, i) => [String(i + 1), x.judul, x.ket, x.selisih, stCell(x.status === 'ok' ? 'ok' : x.status === 'warn' ? 'warn' : 'na', x.status === 'ok' ? 'Sejalan' : x.status === 'warn' ? 'Selisih' : 'Tidak dapat diuji'), x.refs.map(short).join('; ')]),
    [0.8, 4.0, 5.2, 2.0, 1.7, 3.3], 7.5))
  gagal.filter(x => x.dampak).forEach(x => body.push(para(`• ${x.judul}: ${x.dampak}`, { size: 9.5, after: 2 })))

  // ---- VI ----
  body.push(heading('VI. Hitung ulang'))
  body.push(para('A. Cadangan klaim (POJK 11/2025 Pasal 30 ayat 1–4)', { size: 10.5, bold: true, after: 3, keep: true }))
  body.push(para(`Pasal 30 membandingkan cadangan klaim menurut SAK dengan pembanding yang dihitung dari klaim dilaporkan. "Klaim yang dilaporkan" dapat dibaca dua cara, sehingga keduanya ditampilkan. Porsi ditanggung sendiri diasumsikan ${idn(P.porsi, 0)}% karena lapbul tidak memisahkan bagian penjaminan ulang. ${A.ibnr.ket}`, { size: 9.5, align: 'j', after: 4 }))
  const [a, b] = A.scn
  body.push(...table(['No', 'Langkah', 'Pembacaan 1: ' + a.label, 'Pembacaan 2: ' + b.label, 'Sumber'],
    a.steps.map((s, i) => [s.no, s.label + (s.dasar ? `\n${s.dasar}` : ''), rpF(s.value), [2, 4, 5, 6, 7].includes(i) ? rpF(b.steps[i].value) : '(sama)', s.refs.map(short).join('; ')]),
    [0.8, 5.6, 3.5, 3.5, 3.6], 7.5, [2, 3]))
  for (const sc of A.scn) body.push(para(`Pembacaan "${sc.label}": ` + (sc.ok ? `cadangan klaim memadai (lebih besar ${rpF(sc.selisih)})` : `indikasi kekurangan cadangan klaim sebesar ${rpF(-sc.selisih)}`) + '.', { size: 9.5, after: 2 }))
  if (a.ok !== b.ok) body.push(para('Kesimpulan berbeda pada kedua pembacaan, sehingga ketentuan ini ditandai "Perlu klarifikasi". Pengawas perlu menetapkan pembacaan yang dipakai.', { size: 9.5, italic: true, after: 4 }))
  body.push(para('B. Rasio: dilaporkan perusahaan vs hitung ulang', { size: 10.5, bold: true, before: 6, after: 3, keep: true }))
  body.push(...table(['Rasio', 'Dilaporkan', 'Hitung ulang', 'Hasil', 'Sumber'],
    A.ratios.map(r => [r.nama, r.dilaporkan ? fmtVal(r.dilaporkan.v, r.unit) : '—', r.hitung, r.same === null ? '—' : r.same ? 'sama' : 'berbeda', r.dilaporkan ? `${r.dilaporkan.sheet} › ${r.dilaporkan.addr}` : '—']),
    [5.2, 2.6, 2.6, 2.0, 4.6], 8.5, [1, 2]))

  // ---- VII ----
  body.push(heading('VII. Keterbatasan data dan hal yang perlu dikonfirmasi'))
  A.tests.filter(t => t.status === 'na').forEach(t => body.push(para(`• ${t.judul} (${t.pasal}): ${t.note}`, { size: 9.5, after: 2 })))
  body.push(para('• Cadangan klaim: lapbul tidak memisahkan nilai penjaminan yang ditanggung sendiri dari bruto; hasil bersifat indikatif.', { size: 9.5, after: 2 }))
  body.push(para('• Perhitungan ECL menurut PSAK 109 tidak dicakup (membutuhkan data umur dan kolektibilitas di luar lapbul).', { size: 9.5, after: 2 }))
  body.push(para('• Seluruh angka bersumber dari berkas lapbul; pengawas perlu memverifikasi ke berkas asli sebelum dipakai.', { size: 9.5, after: 6 }))
  body.push(para('Catatan pengawas:', { bold: true, after: 2 }))
  for (let i = 0; i < 3; i++) body.push(para('[Diisi pengawas]', { hl: true, after: 2 }))

  // ---- Lampiran ----
  body.push(new Paragraph({ children: [new PageBreak()] }))
  body.push(heading('Lampiran. Jejak sumber setiap angka'))
  body.push(para('Setiap angka pada laporan ini dapat ditelusuri ke lembar, kode komponen, dan alamat sel berikut. Angka bertanda ƒ adalah hasil perhitungan ulang dengan rumus tetap.', { size: 9.5, after: 4 }))
  body.push(...table(['No', 'Lembar', 'Kode · sel', 'Uraian', 'Nilai'], [...used.values()].map((x, i) => [String(i + 1), x.lembar, x.kode, x.uraian, x.nilai]), [0.8, 2.6, 3.4, 6.4, 3.8], 7, [4]))

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{
      properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { left: 2 * CM, right: 2 * CM, top: 2 * CM, bottom: Math.round(1.8 * CM) } } },
      headers: { default: new Header({ children: [para(`OASIS · Draf analisis lapbul penjaminan · ${namaEntitas} · ${posisi}`, { size: 8, italic: true })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 })] })] }) },
      children: body,
    }],
  })
}

export const reportFileName = (nama: string, L: LapbulData) =>
  `Analisis_Lapbul_${nama.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${(L.posisiISO || 'posisi').slice(0, 7)}.docx`

export { sheetTitle }
