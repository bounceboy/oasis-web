import { NextRequest, NextResponse, after } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { type TemplateData } from '@/lib/psak-template-structure'
import { callOpenRouter } from '@/lib/claude'

export const maxDuration = 300

function buildAnalysisPrompt(data: TemplateData): string {
  const v = data.values || {}
  const m = data.metadata
  const isJiwa = m.jenis_usaha === 'Jiwa'

  const cy = (k: string) => v[k]?.CY ?? null
  const py = (k: string) => v[k]?.PY ?? null

  const fmt = (n: number | null | undefined, unit = 'juta') =>
    n == null ? 'N/A' : `Rp${n.toLocaleString('id-ID')} ${unit}`

  const pct = (a: number | null, b: number | null) =>
    a != null && b != null && b !== 0 ? (a / b * 100).toFixed(2) + '%' : 'N/A'

  // SFP
  const kas = cy('SFP_CASH')
  const mm = cy('SFP_MM')
  const fvtpl = cy('I9_FVTPL') ?? cy('SFP_FVTPL')
  const fvociDebt = cy('I9_FVOCI_DEBT') ?? cy('SFP_FVOCI_DEBT')
  const fvociEq = cy('I9_FVOCI_EQ') ?? cy('SFP_FVOCI_EQ')
  const ac = cy('I9_AC') ?? cy('SFP_AC')
  const reinsAsset = cy('SFP_REINS_ASSET') ?? cy('I17_REINS_ASSET')
  const totalInvest = (fvtpl ?? 0) + (fvociDebt ?? 0) + (fvociEq ?? 0) + (ac ?? 0) + (mm ?? 0) + (cy('SFP_INVPROP') ?? 0)
  const insLiab = cy('SFP_INS_LIAB') ?? cy('I17_INS_LIAB')
  const sharecap = cy('SFP_SHARECAP')
  const retained = cy('SFP_RETAINED')
  const fvociRes = cy('SFP_FVOCI_RES') ?? cy('I9_FVOCI_RES')
  const ifociRes = cy('SFP_IFOCI_RES')
  const totalEkuitas = (sharecap ?? 0) + (cy('SFP_APIC') ?? 0) + (retained ?? 0) + (fvociRes ?? 0) + (ifociRes ?? 0) + (cy('SFP_OTHER_RES') ?? 0)
  const totalLiab = (insLiab ?? 0) + (cy('SFP_REINS_LIAB') ?? 0) + (cy('SFP_INVEST_LIAB') ?? 0) + (cy('SFP_PAYABLES') ?? 0) + (cy('SFP_TAX_LIAB') ?? 0) + (cy('SFP_LEASE_DEBT') ?? 0) + (cy('SFP_OTHER_LIAB') ?? 0)
  const totalAset = totalLiab + totalEkuitas

  // P/L
  const insRev = cy('PL_INS_REV')
  const insExp = cy('PL_INS_EXP')
  const reinsNet = cy('PL_REINS_NET')
  const invRes = cy('PL_INV_RES')
  const ifFin = cy('PL_IF_FIN')
  const opex = cy('PL_OPEX')
  const tax = cy('PL_TAX')
  const ociFvoci = cy('OCI_FVOCI')
  const ociIfoci = cy('OCI_IFOCI')
  const cfOp = cy('CF_OP')

  // ISR = revenue + exp (exp biasanya negatif) + reins_net
  const isr = insRev != null ? (insRev ?? 0) + (insExp ?? 0) + (reinsNet ?? 0) : null
  // Profit approx = ISR + inv + ifFin + opex + tax
  const profitApprox = insRev != null ? (insRev ?? 0) + (insExp ?? 0) + (reinsNet ?? 0) + (invRes ?? 0) + (ifFin ?? 0) + (opex ?? 0) + (cy('PL_IMPAIR') ?? 0) + (cy('PL_FEE_OTHER') ?? 0) + (cy('PL_OTHER_NONOP') ?? 0) + (tax ?? 0) : null
  const totalCompIncome = profitApprox != null ? profitApprox + (ociFvoci ?? 0) + (ociIfoci ?? 0) + (cy('OCI_OTHER') ?? 0) : null

  // IFRS17
  const gwp = cy('I17_GWP'); const gwpPY = py('I17_GWP')
  const nwp = cy('I17_NWP')
  const grossClaims = cy('I17_GROSS_CLAIMS')
  const reinsRecov = cy('I17_REINS_RECOV')
  const acqCf = cy('I17_ACQ_CF')
  const uwExp = cy('I17_UW_EXP')
  const onerous = cy('I17_ONEROUS')
  const insLiabDetail = cy('I17_INS_LIAB') ?? insLiab
  const lrc = cy('I17_LRC')
  const lic = cy('I17_LIC')
  const lossComp = cy('I17_LOSS_COMP')
  const ra = cy('I17_RA'); const raOpen = cy('I17_RA_OPEN')
  const ocr = cy('I17_OCR')
  const ibnr = cy('I17_IBNR')
  const cedRes = cy('I17_CEDED_RES')
  const dac = cy('I17_DAC')
  const csmClose = cy('I17_CSM_CLOSE'); const csmOpen = cy('I17_CSM_OPEN')
  const paa = cy('I17_PAA'); const vfa = cy('I17_VFA')

  // IFRS9
  const s1exp = cy('I9_S1_EXP'); const s1allow = cy('I9_S1_ALLOW')
  const s2exp = cy('I9_S2_EXP'); const s2allow = cy('I9_S2_ALLOW')
  const s3exp = cy('I9_S3_EXP'); const s3allow = cy('I9_S3_ALLOW')
  const totalECL = (s1allow ?? 0) + (s2allow ?? 0) + (s3allow ?? 0)
  const totalExp = (s1exp ?? 0) + (s2exp ?? 0) + (s3exp ?? 0)
  const invInc = cy('I9_INV_INC'); const fvPL = cy('I9_FV_PL')
  const writeoff = cy('I9_WRITEOFF')
  const avgAssets = cy('I9_AVG_ASSETS')

  const tahun = m.periode || 'tahun berjalan'
  const perusahaan = m.nama_entitas
  const unit = m.unit || 'juta'

  return `Kamu adalah pengawas asuransi senior OJK yang berpengalaman dan memahami PSAK 117 (IFRS 17), PSAK 109 (IFRS 9), serta regulasi OJK perasuransian Indonesia.

DATA KEUANGAN AUDITED: ${perusahaan} (${isJiwa ? 'Asuransi Jiwa' : 'Asuransi Umum'}) — ${tahun} (dalam ${unit})

=== POSISI KEUANGAN ===
Kas & setara kas: ${fmt(kas)} | Money market: ${fmt(mm)}
Investasi total: ${fmt(totalInvest)} (FVTPL: ${fmt(fvtpl)}, FVOCI debt: ${fmt(fvociDebt)}, FVOCI ekuitas: ${fmt(fvociEq)}, AC: ${fmt(ac)})
Aset kontrak reasuransi: ${fmt(reinsAsset)}
Total aset: ${fmt(totalAset)}
Liabilitas kontrak asuransi: ${fmt(insLiabDetail)}
Total liabilitas: ${fmt(totalLiab)}
Total ekuitas: ${fmt(totalEkuitas)} (FVOCI reserve: ${fmt(fvociRes)}, IFOCI reserve: ${fmt(ifociRes)})

=== LABA RUGI & OCI ===
Insurance revenue (pendapatan jasa asuransi): ${fmt(insRev)}
Insurance service expense (beban jasa asuransi): ${fmt(insExp)}
Net reinsurance result: ${fmt(reinsNet)}
Insurance service result (ISR): ${fmt(isr)}
Hasil investasi: ${fmt(invRes)}
Insurance finance income/(expense): ${fmt(ifFin)}
Beban operasional: ${fmt(opex)}
Beban pajak: ${fmt(tax)}
Laba setelah pajak (estimasi): ${fmt(profitApprox)}
OCI – pergerakan FVOCI: ${fmt(ociFvoci)}
OCI – insurance finance OCI: ${fmt(ociIfoci)}
Total comprehensive income (estimasi): ${fmt(totalCompIncome)}
Arus kas operasi: ${fmt(cfOp)}

=== DETAIL PSAK 117 ===
GWP: ${fmt(gwp)} | GWP tahun lalu: ${fmt(gwpPY)} | NWP: ${fmt(nwp)}
Retention ratio: ${pct(nwp, gwp)}
Gross claims incurred: ${fmt(grossClaims)}
Reinsurance recoveries on claims: ${fmt(reinsRecov)}
Acquisition CF amortisation: ${fmt(acqCf)} | Other UW expenses: ${fmt(uwExp)}
Losses on onerous contracts: ${fmt(onerous)}
LRC (excl. loss component): ${fmt(lrc)}
LIC (Liability for Incurred Claims): ${fmt(lic)}
Loss component: ${fmt(lossComp)}
Risk adjustment (penutup): ${fmt(ra)} | RA pembuka: ${fmt(raOpen)}
OCR (Outstanding Claims Reserve): ${fmt(ocr)}
IBNR reserve: ${fmt(ibnr)}
OCR + IBNR total: ${fmt((ocr ?? 0) + (ibnr ?? 0))}
Ceded reserves (reins recoverables on LIC): ${fmt(cedRes)}
DAC / Acquisition cash flow asset: ${fmt(dac)}
${isJiwa ? `CSM saldo akhir: ${fmt(csmClose)} | CSM saldo awal: ${fmt(csmOpen)}` : ''}
${isJiwa && paa != null ? `PAA liabilities: ${fmt(paa)}` : ''}
${isJiwa && vfa != null ? `VFA liabilities: ${fmt(vfa)}` : ''}

=== DETAIL PSAK 109 ===
FVTPL: ${fmt(fvtpl)} | FVOCI debt: ${fmt(fvociDebt)} | FVOCI ekuitas: ${fmt(fvociEq)} | AC: ${fmt(ac)}
ECL Stage 1 — exposure: ${fmt(s1exp)}, allowance: ${fmt(s1allow)}
ECL Stage 2 — exposure: ${fmt(s2exp)}, allowance: ${fmt(s2allow)}
ECL Stage 3 — exposure: ${fmt(s3exp)}, allowance: ${fmt(s3allow)}
Total ECL: ${fmt(totalECL)} | Total exposure: ${fmt(totalExp)} | Coverage: ${pct(totalECL, totalExp)}
Write-offs: ${fmt(writeoff)}
FVOCI reserve closing: ${fmt(fvociRes)}
Investment income: ${fmt(invInc)} | FV gain/(loss) FVTPL di P/L: ${fmt(fvPL)}
Average investment assets: ${fmt(avgAssets)}
Investment yield (proxy): ${pct(invRes, totalInvest > 0 ? totalInvest : null)}

=== FORMAT OUTPUT YANG WAJIB DIIKUTI (ikuti persis termasuk penomoran) ===

Tulis analisis dengan format berikut (bahasa Indonesia formal, minimal 3 halaman, setiap subseksi minimal 2 paragraf panjang berisi angka konkret dari data di atas):

Analisis PSAK 117 dan PSAK 109 Tahun Buku ${tahun.replace('31 Desember ', '').replace('Desember ', '')}
${perusahaan}

1.    Analisis PSAK 117 – Kontrak Asuransi

a.     Dampak PSAK 117 terhadap Penyajian Kinerja Asuransi
[2-3 paragraf: bandingkan insurance revenue vs pendekatan premi lama, jelaskan insurance service expense, hitung ISR kotor dan bersih setelah reinsurance, interpretasi pengawas atas besarnya beban reasuransi vs manfaat perlindungan risiko]

b.     Analisis Liabilitas Kontrak Asuransi
[2-3 paragraf: struktur LRC, LIC, loss component, risk adjustment dalam total liabilitas kontrak asuransi; interpretasi proporsi LRC vs LIC; implikasi pengawasan terkait kecukupan cadangan, kecepatan penyelesaian klaim, recoverability reasuransi]

c.     Outstanding Claims Reserve, IBNR, dan Risk Adjustment
[2-3 paragraf: nilai OCR dan IBNR, total cadangan klaim, rasio RA terhadap LIC, makna fullfilment cash flows dalam PSAK 117, relevansi untuk pengawasan kecukupan cadangan]

d.     Kontrak Merugi dan Loss Component
[2-3 paragraf: nilai loss component absolut dan relatif terhadap total LCA, sinyal pricing/klaim, implikasi pengawasan per lini usaha]

${isJiwa ? `e.     Contractual Service Margin (CSM) dan Pergerakannya
[2-3 paragraf: saldo awal dan akhir CSM, pertumbuhan CSM, makna CSM sebagai unearned profit, relevansi untuk prospek profitabilitas jangka panjang, PAA/VFA jika relevan]` : `e.     Reasuransi dalam PSAK 117
[2-3 paragraf: nilai aset kontrak reasuransi, pemulihan klaim dari reasuradur, alokasi premi reasuransi, beban kontrak reasuransi neto, rekomendasi pengawasan: credit quality reasuradur, aging, recoverability, ketergantungan reasuransi]`}

2.    Analisis PSAK 109 – Instrumen Keuangan

a.     Komposisi Portofolio Investasi
[2-3 paragraf: rincian FVTPL, FVOCI debt, FVOCI ekuitas, AC; persentase terhadap total aset; implikasi paparan volatilitas laba vs OCI; risiko pasar, kredit, dan likuiditas]

b.     Kinerja Investasi dan Yield
[2-3 paragraf: nilai hasil investasi, rincian komponen (bunga, dividen, gain), proxy yield, analisis kecukupan yield terhadap struktur portofolio, peringatan atas ketergantungan investasi untuk menutup tekanan underwriting]

c.     FVOCI dan Dampak terhadap Ekuitas
[2-3 paragraf: nilai OCI FVOCI (positif/negatif), dampak terhadap laba komprehensif vs laba bersih, volatilitas ekuitas, rekomendasi manajemen risiko pasar dan stress testing]

d.     ECL dan Kualitas Kredit
[2-3 paragraf: nilai ECL per stage, coverage ratio, makna portofolio di Stage 1 vs potensi migrasi Stage 2/3, write-offs, rekomendasi review kualitas kredit dan kebijakan pemantauan]

3.    Kesimpulan Supervisory dan Fokus Tindak Lanjut

[1-2 paragraf pembuka: ringkasan profil keuangan keseluruhan, area positif dan area perhatian utama]

Secara supervisory judgement, terdapat beberapa concern:

1. [concern pertama — gunakan data konkret]
2. [concern kedua]
3. [concern ketiga]
4. [concern keempat]
5. [concern kelima]

Dengan demikian, rekomendasi pengawasan adalah memantau analisis tambahan yang mencakup:
a.     [rekomendasi a]
b.     [rekomendasi b]
c.     [rekomendasi c]
d.     [rekomendasi d]
e.     [rekomendasi e]
f.      [rekomendasi f]

[1 paragraf penutup: pentingnya langkah-langkah tersebut untuk memastikan kualitas keuangan yang sesungguhnya]

PENTING: Jangan gunakan tanda ## atau ** atau tanda markdown lain. Gunakan hanya penomoran 1. / a. / b. persis seperti format di atas. Setiap subseksi harus menyebutkan angka konkret dari data yang diberikan.`
}

async function doAnalyze(sessionId: string) {
  try {
    const { data: sess } = await db()
      .from('psak_session')
      .select('template_data, nama_entitas, jenis_usaha')
      .eq('id', sessionId)
      .single()

    if (!sess?.template_data) throw new Error('Data template tidak tersedia')

    const prompt = buildAnalysisPrompt(sess.template_data as unknown as TemplateData)

    const text = await callOpenRouter(
      'Kamu adalah pengawas OJK senior ahli PSAK 117 dan PSAK 109. Tulis analisis komprehensif dalam bahasa Indonesia formal.',
      prompt,
      8000
    )

    await db()
      .from('psak_session')
      .update({
        analisis_text: text,
        status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    console.log(`[psak] analisis selesai untuk session ${sessionId}`)
  } catch (err) {
    console.error('[psak] analisis gagal:', err)
    await db()
      .from('psak_session')
      .update({
        status: 'error',
        error_msg: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: sess } = await db()
    .from('psak_session')
    .select('template_data, user_id, status')
    .eq('id', id)
    .single()

  if (!sess) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
  if (sess.user_id !== user.id && !['admin', 'superadmin'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!sess.template_data) return NextResponse.json({ error: 'Data template belum tersedia' }, { status: 400 })

  await db()
    .from('psak_session')
    .update({ status: 'analyzing', updated_at: new Date().toISOString() })
    .eq('id', id)

  after(() => doAnalyze(id))

  return NextResponse.json({ ok: true, analyzing: true })
}
