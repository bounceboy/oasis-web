'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { RisikoRating, RiskLevel } from '@/lib/kyic'

interface KyicResult {
  sessionId: string
  nama_perusahaan: string
  periode: string
  supervisory_concern: string
  analisis_akar: string
  supervisory_action: string
  risk_matrix: RisikoRating[]
  gcg: RiskLevel
  gcg_analisis: string
  rentabilitas: RiskLevel
  rentabilitas_analisis: string
  permodalan: RiskLevel
  permodalan_analisis: string
  peringkat_komposit: RiskLevel
  peringkat_komposit_analisis: string
  sections_updated: string[]
  progress_log: string[]
}

type Step = 'upload' | 'processing' | 'hasil'

const RATING_COLORS: Record<number, string> = {
  1: '#16a34a', 2: '#65a30d', 3: '#ca8a04', 4: '#ea580c', 5: '#dc2626',
}
const RATING_LABELS: Record<number, string> = {
  1: 'Sangat Rendah', 2: 'Rendah', 3: 'Moderat', 4: 'Tinggi', 5: 'Sangat Tinggi',
}

function RatingBadge({ value }: { value: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '50%', fontWeight: 700, fontSize: '0.85rem',
      background: RATING_COLORS[value] + '22', color: RATING_COLORS[value],
      border: `1.5px solid ${RATING_COLORS[value]}44`,
    }}>{value}</span>
  )
}

export default function KyicPage() {
  const [step, setStep] = useState<Step>('upload')
  const [namaEntitas, setNamaEntitas] = useState('')
  const [periode, setPeriode] = useState('')
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [dokFiles, setDokFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [catatanPengawas, setCatatanPengawas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<KyicResult | null>(null)
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [activeRisk, setActiveRisk] = useState<string | null>(null)
  const [activeComposit, setActiveComposit] = useState<string | null>(null)

  const templateRef = useRef<HTMLInputElement>(null)
  const dokRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)

  function handleDokFiles(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files)
    setDokFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...arr.filter((f) => !existing.has(f.name))]
    })
  }

  function removeDok(name: string) {
    setDokFiles((prev) => prev.filter((f) => f.name !== name))
  }

  async function handleAnalyze() {
    if (!templateFile || !namaEntitas.trim() || !periode.trim()) {
      setError('Lengkapi nama perusahaan, periode, dan upload template KYIC.')
      return
    }
    setError(null)
    setStep('processing')
    setProgressLog(['Memulai proses...'])

    const fd = new FormData()
    fd.append('template', templateFile)
    fd.append('namaEntitas', namaEntitas.trim())
    fd.append('periode', periode.trim())
    dokFiles.forEach((f) => fd.append('docs[]', f))
    if (zipFile) fd.append('zip', zipFile)
    if (catatanPengawas.trim()) fd.append('catatanPengawas', catatanPengawas.trim())

    try {
      const res = await fetch('/api/kyic/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Terjadi kesalahan')
      setResult(data)
      if (data.progress_log) setProgressLog(data.progress_log)
      setStep('hasil')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menganalisis')
      setStep('upload')
    }
  }

  const stepDone = (key: Step) => {
    if (step === 'hasil') return true
    if (step === 'processing' && key === 'upload') return true
    return false
  }

  return (
    <>
      <style jsx>{`
        .container { max-width: 1000px; margin: 0 auto; padding: 2rem 1rem; }
        .back { color: #64748b; font-size: 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem; margin-bottom: 1.5rem; }
        .back:hover { color: #94a3b8; }
        .title { font-size: 1.4rem; font-weight: 700; color: #f1f5f9; }
        .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; margin-top: 0.2rem; }

        .steps { display: flex; gap: 0; margin-bottom: 2.5rem; }
        .step-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; position: relative; }
        .step-item:not(:last-child)::after { content: ''; position: absolute; top: 14px; left: 60%; width: 80%; height: 2px; background: #1e293b; }
        .step-item.active::after { background: #2563eb; }
        .step-item.done::after { background: #16a34a; }
        .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; background: #1e293b; color: #475569; border: 2px solid #334155; z-index: 1; }
        .step-item.active .step-dot { background: #2563eb; color: white; border-color: #2563eb; }
        .step-item.done .step-dot { background: #16a34a; color: white; border-color: #16a34a; }
        .step-label { font-size: 0.75rem; color: #475569; }
        .step-item.active .step-label { color: #93c5fd; }
        .step-item.done .step-label { color: #86efac; }

        .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 1rem; padding: 2rem; margin-bottom: 1.5rem; }
        .card-title { font-size: 1rem; font-weight: 700; color: #e2e8f0; margin-bottom: 1rem; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
        label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.4rem; font-weight: 500; }
        input[type="text"] { width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; padding: 0.6rem 0.75rem; color: #f1f5f9; font-size: 0.9rem; outline: none; box-sizing: border-box; }
        input[type="text"]:focus { border-color: #2563eb; }

        .upload-zone { border: 2px dashed #334155; border-radius: 0.75rem; padding: 1.5rem; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .upload-zone:hover, .upload-zone.active { border-color: #2563eb; }
        .upload-icon { font-size: 2rem; margin-bottom: 0.5rem; }
        .upload-hint { color: #64748b; font-size: 0.8rem; }
        .file-chip { display: inline-flex; align-items: center; gap: 0.4rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.4rem; padding: 0.25rem 0.6rem; font-size: 0.78rem; color: #94a3b8; margin: 0.2rem; }
        .file-chip button { background: none; border: none; color: #475569; cursor: pointer; padding: 0; font-size: 0.85rem; line-height: 1; }
        .file-chip button:hover { color: #f87171; }

        .btn { padding: 0.7rem 1.5rem; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-success { background: #16a34a; color: white; }
        .btn-success:hover { background: #15803d; }
        .btn-outline { background: transparent; color: #94a3b8; border: 1px solid #334155; }
        .btn-outline:hover { border-color: #64748b; color: #f1f5f9; }

        .error-box { background: #450a0a; border: 1px solid #991b1b; border-radius: 0.5rem; padding: 0.75rem 1rem; color: #fca5a5; font-size: 0.85rem; margin-bottom: 1rem; }

        /* Processing */
        .processing-center { text-align: center; padding: 2rem 1rem; }
        .spinner { width: 48px; height: 48px; border: 4px solid #1e293b; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.5rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .progress-log { text-align: left; background: #0a0f1e; border: 1px solid #1e293b; border-radius: 0.75rem; padding: 1rem; margin-top: 1.5rem; max-height: 200px; overflow-y: auto; }
        .log-item { font-size: 0.8rem; color: #64748b; padding: 0.2rem 0; }
        .log-item.active { color: #93c5fd; }
        .log-item::before { content: '→ '; }

        /* Hasil */
        .hasil-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .section-label { font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin: 1.5rem 0 0.75rem; }
        .narasi-box { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1rem 1.25rem; color: #cbd5e1; font-size: 0.875rem; line-height: 1.7; white-space: pre-wrap; }

        /* Risk matrix */
        .risk-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .risk-table th { background: #1e293b; color: #94a3b8; font-weight: 600; padding: 0.5rem 0.75rem; text-align: center; border: 1px solid #334155; }
        .risk-table th:first-child { text-align: left; }
        .risk-table td { padding: 0.45rem 0.75rem; border: 1px solid #1e293b; text-align: center; vertical-align: middle; }
        .risk-table tr:nth-child(even) td { background: #0c1525; }
        .risk-table td:first-child { text-align: left; color: #94a3b8; cursor: pointer; }
        .risk-table td:first-child:hover { color: #93c5fd; }
        .risk-table tr.selected td { background: #1e293b44; }

        .analisis-panel { background: #172033; border: 1px solid #2563eb33; border-radius: 0.75rem; padding: 1rem 1.25rem; margin-top: 0.75rem; color: #cbd5e1; font-size: 0.85rem; line-height: 1.7; }
        .analisis-label { font-size: 0.75rem; font-weight: 700; color: #3b82f6; margin-bottom: 0.4rem; }

        .composite-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; }
        .composite-item { flex: 1; min-width: 140px; background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 0.75rem 1rem; text-align: center; }
        .composite-label { font-size: 0.75rem; color: #64748b; margin-bottom: 0.4rem; }
        .composite-value { font-size: 1.1rem; font-weight: 700; }
      `}</style>

      <div className="container">
        <Link href="/dashboard" className="back">← Dashboard</Link>
        <div className="title">Know Your Insurance Company (KYIC)</div>
        <div className="subtitle">Upload template KYIC + dokumen pendukung — AI akan menganalisis dan mengisi KK secara otomatis</div>

        {/* Steps */}
        <div className="steps">
          {[
            { key: 'upload' as Step, label: 'Upload File' },
            { key: 'processing' as Step, label: 'Analisis AI' },
            { key: 'hasil' as Step, label: 'Hasil KYIC' },
          ].map((s, i) => (
            <div key={s.key} className={`step-item ${step === s.key ? 'active' : stepDone(s.key) ? 'done' : ''}`}>
              <div className="step-dot">{stepDone(s.key) ? '✓' : i + 1}</div>
              <div className="step-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Upload ── */}
        {step === 'upload' && (
          <div>
            {error && <div className="error-box">{error}</div>}

            {/* Metadata */}
            <div className="card">
              <div className="card-title">Informasi Umum</div>
              <div className="form-grid">
                <div>
                  <label>Nama Perusahaan</label>
                  <input type="text" value={namaEntitas} onChange={(e) => setNamaEntitas(e.target.value)} placeholder="PT Asuransi ..." />
                </div>
                <div>
                  <label>Periode Penilaian</label>
                  <input type="text" value={periode} onChange={(e) => setPeriode(e.target.value)} placeholder="31 Desember 2025" />
                </div>
              </div>
            </div>

            {/* Template KYIC */}
            <div className="card">
              <div className="card-title">Template KYIC Tahun Sebelumnya <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>*wajib</span></div>
              <div
                className={`upload-zone ${templateFile ? 'active' : ''}`}
                onClick={() => templateRef.current?.click()}
              >
                <div className="upload-icon">📋</div>
                {templateFile ? (
                  <>
                    <div style={{ color: '#93c5fd', fontWeight: 500 }}>{templateFile.name}</div>
                    <div className="upload-hint">{(templateFile.size / 1024 / 1024).toFixed(1)} MB — klik untuk ganti</div>
                  </>
                ) : (
                  <>
                    <div style={{ color: '#94a3b8', fontWeight: 500 }}>Klik untuk upload template KYIC</div>
                    <div className="upload-hint">Format: .docx · Maks. 20 MB</div>
                  </>
                )}
                <input ref={templateRef} type="file" accept=".docx" style={{ display: 'none' }}
                  onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            {/* Dokumen pendukung */}
            <div className="card">
              <div className="card-title">Dokumen Pendukung</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Multi-file */}
                <div>
                  <label>Upload file langsung (bisa banyak)</label>
                  <div
                    className="upload-zone"
                    onClick={() => dokRef.current?.click()}
                    onDrop={(e) => { e.preventDefault(); handleDokFiles(e.dataTransfer.files) }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <div className="upload-icon">📁</div>
                    <div style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.9rem' }}>Klik atau drag file di sini</div>
                    <div className="upload-hint">PDF, Word, Excel, JPG/PNG</div>
                    <input ref={dokRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.xlsm,.png,.jpg,.jpeg"
                      multiple style={{ display: 'none' }}
                      onChange={(e) => handleDokFiles(e.target.files)} />
                  </div>
                </div>

                {/* ZIP */}
                <div>
                  <label>Atau upload sebagai ZIP</label>
                  <div
                    className={`upload-zone ${zipFile ? 'active' : ''}`}
                    onClick={() => zipRef.current?.click()}
                  >
                    <div className="upload-icon">🗜️</div>
                    {zipFile ? (
                      <>
                        <div style={{ color: '#93c5fd', fontWeight: 500, fontSize: '0.9rem' }}>{zipFile.name}</div>
                        <div className="upload-hint">{(zipFile.size / 1024 / 1024).toFixed(1)} MB</div>
                      </>
                    ) : (
                      <>
                        <div style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.9rem' }}>Upload file ZIP</div>
                        <div className="upload-hint">Akan diekstrak otomatis</div>
                      </>
                    )}
                    <input ref={zipRef} type="file" accept=".zip" style={{ display: 'none' }}
                      onChange={(e) => setZipFile(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
              </div>

              {/* Daftar file */}
              {dokFiles.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>
                    {dokFiles.length} file dipilih:
                  </div>
                  <div>
                    {dokFiles.map((f) => (
                      <span key={f.name} className="file-chip">
                        {f.name.endsWith('.pdf') ? '📄' : f.name.match(/xlsx?|xlsm/i) ? '📊' : f.name.match(/docx?/i) ? '📝' : '🖼️'}
                        {' '}{f.name}
                        <button onClick={() => removeDok(f.name)}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Catatan / update teks dari pengawas */}
            <div className="card">
              <div className="card-title">
                Catatan / Update Pengawas
                <span style={{ fontWeight: 400, color: '#475569', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  (opsional)
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Sampaikan perkembangan terbaru, hasil pertemuan, temuan baru, atau konteks tambahan yang belum tercantum dalam dokumen. AI akan memasukkannya ke dalam analisis.
              </div>
              <textarea
                value={catatanPengawas}
                onChange={(e) => setCatatanPengawas(e.target.value)}
                placeholder={`Contoh:\n- RBC Dana Tabarru per Maret 2026 turun ke 105%, di bawah threshold minimum.\n- Perusahaan telah menyampaikan rencana aksi permodalan kepada OJK pada 15 April 2026.\n- Direktur Keuangan definitif baru dilantik pada 30 April 2026 atas nama Budi Santoso.`}
                rows={7}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: '0.5rem', padding: '0.75rem', color: '#f1f5f9',
                  fontSize: '0.875rem', lineHeight: 1.7, outline: 'none',
                  resize: 'vertical', fontFamily: 'inherit',
                }}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
              {catatanPengawas.trim() && (
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.4rem', textAlign: 'right' }}>
                  {catatanPengawas.length} karakter
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={!templateFile || !namaEntitas || !periode}
              >
                Mulai Analisis →
              </button>
            </div>
          </div>
        )}

        {/* ── Processing ── */}
        {step === 'processing' && (
          <div className="card">
            <div className="processing-center">
              <div className="spinner" />
              <div style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 500 }}>
                AI sedang menganalisis dokumen dan mengisi KYIC...
              </div>
              <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                Proses ini membutuhkan waktu 3–8 menit (analisis 9 jenis risiko + narratif)
              </div>
              {progressLog.length > 0 && (
                <div className="progress-log">
                  {progressLog.map((log, i) => (
                    <div key={i} className={`log-item ${i === progressLog.length - 1 ? 'active' : ''}`}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Hasil ── */}
        {step === 'hasil' && result && (
          <div>
            {/* Header */}
            <div className="card">
              <div className="hasil-header">
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>
                    KYIC — {result.nama_perusahaan}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    Periode: {result.periode}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {result.sections_updated.map((s) => (
                      <span key={s} style={{ background: '#16a34a22', color: '#86efac', border: '1px solid #16a34a44', borderRadius: '0.3rem', padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className="btn btn-outline" onClick={() => { setStep('upload'); setResult(null) }}>← Baru</button>
                  <button className="btn btn-success" onClick={() => window.open(`/api/kyic/download/${result.sessionId}`, '_blank')}>
                    ⬇ Unduh KYIC (.docx)
                  </button>
                </div>
              </div>
            </div>

            {/* Risk Matrix */}
            <div className="card">
              <div className="card-title">Profil Risiko & Penilaian Tingkat Kesehatan</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="risk-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Jenis Risiko</th>
                      <th>Inheren</th>
                      <th>KPMR</th>
                      <th>Net Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.risk_matrix.map((r) => (
                      <>
                        <tr
                          key={r.jenis}
                          className={activeRisk === r.jenis ? 'selected' : ''}
                          onClick={() => setActiveRisk(activeRisk === r.jenis ? null : r.jenis)}
                        >
                          <td title="Klik untuk lihat analisis">
                            {r.jenis} {activeRisk === r.jenis ? '▴' : '▾'}
                          </td>
                          <td><RatingBadge value={r.inheren} /></td>
                          <td><RatingBadge value={r.kpmr} /></td>
                          <td><RatingBadge value={r.net_risk} /></td>
                        </tr>
                        {activeRisk === r.jenis && (
                          <tr key={`${r.jenis}-analisis`}>
                            <td colSpan={4} style={{ padding: 0, border: 'none' }}>
                              <div className="analisis-panel">
                                <div className="analisis-label">Analisis {r.jenis}</div>
                                {r.analisis}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Komposit */}
              <div className="composite-row">
                {([
                  { label: 'GCG', value: result.gcg, analisis: result.gcg_analisis },
                  { label: 'Rentabilitas', value: result.rentabilitas, analisis: result.rentabilitas_analisis },
                  { label: 'Permodalan', value: result.permodalan, analisis: result.permodalan_analisis },
                  { label: 'Peringkat Komposit', value: result.peringkat_komposit, analisis: result.peringkat_komposit_analisis },
                ] as { label: string; value: RiskLevel; analisis: string }[]).map((item) => (
                  <div key={item.label}
                    className="composite-item"
                    onClick={() => setActiveComposit(activeComposit === item.label ? null : item.label)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="composite-label">
                      {item.label}
                      <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '0.3rem' }}>
                        {activeComposit === item.label ? '▲' : '▼'}
                      </span>
                    </div>
                    <div className="composite-value" style={{ color: RATING_COLORS[item.value] }}>
                      {item.value}
                      <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#64748b', marginLeft: '0.4rem' }}>
                        {RATING_LABELS[item.value]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Panel analisis komposit */}
              {activeComposit && (() => {
                const map: Record<string, string> = {
                  'GCG': result.gcg_analisis,
                  'Rentabilitas': result.rentabilitas_analisis,
                  'Permodalan': result.permodalan_analisis,
                  'Peringkat Komposit': result.peringkat_komposit_analisis,
                }
                const analisis = map[activeComposit]
                if (!analisis) return null
                return (
                  <div style={{
                    margin: '0.5rem 0 0',
                    padding: '0.75rem 1rem',
                    background: '#0f172a',
                    borderRadius: 8,
                    borderLeft: `3px solid ${RATING_COLORS[({
                      'GCG': result.gcg,
                      'Rentabilitas': result.rentabilitas,
                      'Permodalan': result.permodalan,
                      'Peringkat Komposit': result.peringkat_komposit,
                    } as Record<string, RiskLevel>)[activeComposit]]}`,
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Analisis {activeComposit}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>{analisis}</div>
                  </div>
                )
              })()}
            </div>

            {/* Narratif sections */}
            <div className="card">
              <div className="card-title">Supervisory Concern</div>
              <div className="narasi-box">{result.supervisory_concern}</div>

              <div className="section-label" style={{ marginTop: '1.5rem' }}>Analisis Akar Permasalahan</div>
              <div className="narasi-box">{result.analisis_akar}</div>

              <div className="section-label">Supervisory Action</div>
              <div className="narasi-box">{result.supervisory_action}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn btn-success" onClick={() => window.open(`/api/kyic/download/${result.sessionId}`, '_blank')}>
                ⬇ Unduh KYIC (.docx)
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
