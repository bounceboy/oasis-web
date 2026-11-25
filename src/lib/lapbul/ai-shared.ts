/**
 * Lapisan AI modul Cadangan Klaim: bentuk hasil AI, penyusunan data yang dikirim,
 * dan pemeriksaan angka. Angka dan status tetap berasal dari mesin aturan (engine.ts);
 * AI hanya menafsirkan. Dipakai di klien dan server.
 */
import type { LapbulData } from './parse'
import { type Analysis, type Params, LINGKUP, STAT, fmtVal, idn, rpF, sheetTitle } from './engine'

export interface AiHasil {
  ringkasan: string
  temuan: { judul: string; prioritas: 'tinggi' | 'sedang' | 'rendah'; uraian: string; rujukan: string[] }[]
  anomali: { judul: string; pengamatan: string; dugaan_penyebab: string[]; rujukan: string[] }[]
  pertanyaan: { pertanyaan: string; data_diminta: string; rujukan: string[] }[]
  tindak_lanjut: string[]
}
export interface AiRecord { hasil: AiHasil; model: string; dibuat: string; params: Params; angkaPerluCek: string[] }

/** Lembar ringkas yang dikirim utuh agar AI bisa mencari kejanggalan di luar aturan. */
const SHEETS_AI = ['1000', '1100', '1200', '3500A', '3500B', '5100', '6100', '7100']

const angka = (v: number) => idn(v, Number.isInteger(v) ? 0 : 2)

/** Data untuk AI. Nama perusahaan dan nama berkas sengaja tidak disertakan. */
export function susunDataAi(L: LapbulData, A: Analysis, P: Params): string {
  const out: string[] = []
  out.push(`Posisi laporan: ${L.posisi}`)
  out.push(`Pengaturan: lingkup ${LINGKUP[P.lingkup].label.toLowerCase()}; porsi ditanggung sendiri ${idn(P.porsi, 0)}% (asumsi); ${A.ibnr.ket}`)

  out.push('\n## HASIL PENGUJIAN KETENTUAN (final, dari mesin aturan)')
  for (const t of A.tests) out.push(`[uji:${t.id}] ${t.judul} | ${t.pasal} | status: ${STAT[t.status]} | nilai: ${t.nilai} | batas: ${t.batas}\n  ketentuan: ${t.aturan}\n  hitungan: ${t.calc || '-'}\n  catatan: ${t.note || '-'}`)

  out.push('\n## PEMERIKSAAN KONSISTENSI ANTAR LEMBAR (final)')
  for (const c of A.checks) out.push(`[cek:${c.id}] ${c.judul} | ${c.status === 'ok' ? 'sejalan' : c.status === 'warn' ? 'SELISIH ' + c.selisih : 'tidak dapat diuji'}\n  ${c.ket}`)

  out.push('\n## HITUNG ULANG CADANGAN KLAIM (POJK 11/2025 Pasal 30)')
  for (const s of A.scn) out.push(`Pembacaan "${s.label}": ` + s.steps.map(x => `${x.no}) ${x.label}: ${rpF(x.value)}`).join('; '))

  out.push('\n## ANGKA TURUNAN')
  for (const d of Object.values(A.D)) out.push(`${d.label}: ${fmtVal(d.value, d.unit)}`)

  out.push('\n## ISI LEMBAR LAPBUL (baris bernilai tidak nol). Format: [lembar:kode] uraian | kolom=nilai')
  for (const id of SHEETS_AI) {
    const sh = L.sheets[id]
    if (!sh) continue
    out.push(`### ${id} ${sheetTitle(L, id)}`)
    for (const r of sh.rows) {
      // lembar status klaim punya puluhan kolom: kirim kolom TOTAL saja
      let cells = r.cells.filter(c => typeof c.v === 'number' && c.v !== 0)
      if (id.startsWith('3500')) cells = cells.filter(c => /^total ›/i.test(c.h))
      if (!cells.length) continue
      out.push(`[${id}:${r.k}] ${r.u} | ` + cells.map(c => `${c.h.replace(/^total › /i, '')}=${angka(c.v as number)}`).join('; '))
    }
  }
  return out.join('\n')
}

/** Angka rupiah, persen, dan kali dalam teks AI yang tidak ditemukan pada data yang dikirim. */
export function cekAngka(h: AiHasil, data: string): string[] {
  const teks = [
    h.ringkasan, ...h.temuan.flatMap(t => [t.judul, t.uraian]),
    ...h.anomali.flatMap(a => [a.judul, a.pengamatan, ...a.dugaan_penyebab]),
    ...h.pertanyaan.flatMap(p => [p.pertanyaan, p.data_diminta]), ...h.tindak_lanjut,
  ].join('\n')
  const temu = teks.match(/Rp\s?-?\d[\d.]*(?:,\d+)?(?:\s?(?:triliun|miliar|juta|T\b|M\b|jt\b))?|-?\d+(?:\.\d{3})*(?:,\d+)?\s?(?:%|×)/g) || []
  const tidak = temu.filter(x => {
    const s = x.replace(/\.$/, '').trim()
    if (data.includes(s)) return false
    // angka tanpa "Rp", "%" atau "×" juga cocok bila tertulis di data (mis. isi lembar)
    return !data.includes(s.replace(/^Rp\s?/, '').replace(/\s?(%|×)$/, ''))
  })
  return [...new Set(tidak.map(x => x.replace(/\.$/, '').trim()))]
}
