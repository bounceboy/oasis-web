import { NextRequest, NextResponse, after } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { type TemplateData } from '@/lib/psak-template-structure'
import { callOpenRouter } from '@/lib/claude'

export const maxDuration = 300

function buildAnalysisPrompt(data: TemplateData): string {
  const v = data.values || {}
  const m = data.metadata

  // Helper: format number
  const fmt = (n: number | null | undefined) =>
    n == null ? 'N/A' : `Rp${n.toLocaleString('id-ID')} juta`

  // Derived figures
  const totalAset = (v['SFP_CASH']?.CY ?? 0) + (v['SFP_MM']?.CY ?? 0) + (v['SFP_FVTPL']?.CY ?? 0) +
    (v['SFP_FVOCI_DEBT']?.CY ?? 0) + (v['SFP_AC']?.CY ?? 0) + (v['SFP_REINS_ASSET']?.CY ?? 0) +
    (v['SFP_PPE']?.CY ?? 0) + (v['SFP_OTHER']?.CY ?? 0)
  const totalLiab = (v['SFP_INS_LIAB']?.CY ?? 0) + (v['SFP_REINS_LIAB']?.CY ?? 0) +
    (v['SFP_PAYABLES']?.CY ?? 0) + (v['SFP_OTHER_LIAB']?.CY ?? 0)
  const totalEkuitas = (v['SFP_SHARECAP']?.CY ?? 0) + (v['SFP_RETAINED']?.CY ?? 0) + (v['SFP_FVOCI_RES']?.CY ?? 0)
  const lrc = v['I17_LRC']?.CY
  const lic = v['I17_LIC']?.CY
  const lossComp = v['I17_LOSS_COMP']?.CY
  const ra = v['I17_RA']?.CY
  const csm = v['I17_CSM_CLOSE']?.CY
  const insRev = v['PL_INS_REV']?.CY
  const insExp = v['PL_INS_EXP']?.CY
  const reinsNet = v['PL_REINS_NET']?.CY
  const grossClaims = v['I17_GROSS_CLAIMS']?.CY
  const nwp = v['I17_NWP']?.CY
  const gwp = v['I17_GWP']?.CY
  const retention = (nwp && gwp && gwp !== 0) ? (nwp / gwp * 100).toFixed(1) : null
  const lossRatio = (grossClaims && gwp && gwp !== 0) ? (grossClaims / gwp * 100).toFixed(1) : null
  const ocr = v['I17_OCR']?.CY
  const ibnr = v['I17_IBNR']?.CY
  const fvociDebt = v['I9_FVOCI_DEBT']?.CY
  const amortCost = v['I9_AC']?.CY
  const s1exp = v['I9_S1_EXP']?.CY; const s1allow = v['I9_S1_ALLOW']?.CY
  const s2exp = v['I9_S2_EXP']?.CY; const s2allow = v['I9_S2_ALLOW']?.CY
  const s3exp = v['I9_S3_EXP']?.CY; const s3allow = v['I9_S3_ALLOW']?.CY
  const totalECL = (s1allow ?? 0) + (s2allow ?? 0) + (s3allow ?? 0)
  const totalFAECL = (s1exp ?? 0) + (s2exp ?? 0) + (s3exp ?? 0)
  const coverageRatio = totalFAECL > 0 ? (totalECL / totalFAECL * 100).toFixed(2) : null

  return `Kamu adalah pengawas asuransi senior OJK yang berpengalaman (world class insurance supervisor) yang memahami:
- PSAK 117 (setara IFRS 17) – Kontrak Asuransi
- PSAK 109 (setara IFRS 9) – Instrumen Keuangan
- Peraturan OJK No. 26 Tahun 2025 dan regulasi terkait

Berikut adalah data keuangan audited ${m.nama_entitas} (${m.jenis_usaha === 'Jiwa' ? 'Asuransi Jiwa' : 'Asuransi Umum'}) periode ${m.periode || 'tahun berjalan'} dalam ${m.unit}:

=== POSISI KEUANGAN ===
Total Aset (estimasi): ${fmt(totalAset)}
Total Liabilitas (estimasi): ${fmt(totalLiab)}
Total Ekuitas (estimasi): ${fmt(totalEkuitas)}
Liabilitas Kontrak Asuransi: ${fmt(v['SFP_INS_LIAB']?.CY)}
Aset Kontrak Reasuransi: ${fmt(v['SFP_REINS_ASSET']?.CY)}
${csm ? `CSM Saldo Akhir: ${fmt(csm)}` : ''}

=== LABA RUGI ===
Insurance Revenue (Pendapatan Asuransi): ${fmt(insRev)}
Insurance Service Expense (Beban Jasa): ${fmt(insExp)}
Net Reinsurance Result: ${fmt(reinsNet)}
Hasil Investasi: ${fmt(v['PL_INV_RES']?.CY)}
Laba Sebelum Pajak: ${fmt(v['PL_TAX']?.CY ? (insRev ?? 0) - (insExp ?? 0) - (reinsNet ?? 0) + (v['PL_INV_RES']?.CY ?? 0) - (v['PL_OPEX']?.CY ?? 0) : null)}

=== ARUS KAS ===
Operasi: ${fmt(v['CF_OP']?.CY)}
Investasi: ${fmt(v['CF_INV']?.CY)}
Pendanaan: ${fmt(v['CF_FIN']?.CY)}

=== DETAIL PSAK 117 / IFRS 17 ===
GWP (management): ${fmt(gwp)}
NWP (management): ${fmt(nwp)}
Retention Ratio: ${retention ? retention + '%' : 'N/A'}
Gross Claims Incurred: ${fmt(grossClaims)}
Loss Ratio (gross): ${lossRatio ? lossRatio + '%' : 'N/A'}
LRC (excl. loss component): ${fmt(lrc)}
LIC (Liability for Incurred Claims): ${fmt(lic)}
Loss Component: ${fmt(lossComp)}
Risk Adjustment: ${fmt(ra)}
OCR (Outstanding Claims Reserve): ${fmt(ocr)}
IBNR Reserve: ${fmt(ibnr)}
Reinsurance Recoverables on LIC: ${fmt(v['I17_CEDED_RES']?.CY)}
Acquisition Cash Flow Asset (DAC): ${fmt(v['I17_DAC']?.CY)}

=== DETAIL PSAK 109 / IFRS 9 ===
FVTPL: ${fmt(v['I9_FVTPL']?.CY)}
FVOCI Debt: ${fmt(fvociDebt)}
Amortised Cost: ${fmt(amortCost)}
Stage 1 Exposure: ${fmt(s1exp)} | Allowance: ${fmt(s1allow)}
Stage 2 Exposure: ${fmt(s2exp)} | Allowance: ${fmt(s2allow)}
Stage 3 Exposure: ${fmt(s3exp)} | Allowance: ${fmt(s3allow)}
Total ECL Coverage Ratio: ${coverageRatio ? coverageRatio + '%' : 'N/A'}
FVOCI Reserve (OCI): ${fmt(v['I9_FVOCI_RES']?.CY)}
Investment Income: ${fmt(v['I9_INV_INC']?.CY)}

=== INSTRUKSI ANALISIS ===
Buatkan deskripsi hasil analisis yang **detail, komprehensif, dan mudah dipahami minimal 3 halaman** dari dua aspek:

**A. PSAK 117 – Kontrak Asuransi** (lebih detail):
1. Dampak PSAK 117 terhadap penyajian pendapatan (insurance revenue vs premi bruto) — berikan angka konkret
2. Analisis liabilitas kontrak asuransi: struktur LRC vs LIC, loss component, risk adjustment — interpretasi pengawas
3. Outstanding Claims Reserve (OCR), IBNR, dan kecukupannya
4. Analisis reasuransi: reinsurance contract assets/liabilities, retention ratio, ceded reserves
5. ${m.jenis_usaha === 'Jiwa' ? 'Analisis CSM (Contractual Service Margin) dan pergerakannya' : 'Analisis combined ratio, underwriting result, dan kontrak merugi per lini usaha'}
6. Perbandingan CY vs PY untuk setiap metrik di atas — tren dan signifikansi
7. Implikasi dan rekomendasi pengawas berdasarkan POJK No. 26/2025

**B. PSAK 109 – Instrumen Keuangan** (lebih detail):
1. Komposisi portofolio investasi: FVTPL, FVOCI, Amortised Cost — analisis strategi investasi
2. Analisis ECL (Expected Credit Loss): Stage 1/2/3 exposure dan allowance
3. Coverage ratio dan kecukupan pencadangan ECL
4. Credit-impaired assets dan write-offs — kualitas aset keuangan
5. FVOCI reserve movement dan dampak ke ekuitas
6. Investment yield dan efisiensi portofolio
7. Risiko interest rate dan dampak terhadap nilai aset keuangan

Gunakan bahasa Indonesia formal (bahasa pengawas OJK). Setiap poin harus menyebutkan angka konkret dari data di atas.
Akhiri dengan **Kesimpulan dan Rekomendasi Pengawas** yang berisi temuan utama, risiko yang perlu dipantau, dan tindak lanjut yang disarankan.`
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
