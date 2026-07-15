'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { RisikoRating, RiskLevel } from '@/lib/kyic'
import Navbar from '@/components/oasis/Navbar'
import { useSessionPolling } from '@/lib/useSessionPolling'

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
  const [riwayat, setRiwayat] = useState<{id: string; nama_entitas: string; created_at: string}[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pollingId, setPollingId] = useState<string | null>(null)

  useSessionPolling(pollingId, (data) => {
    const id = pollingId
    setPollingId(null)
    if (data.status === 'selesai' && data.hasil) {
      const h = data.hasil as unknown as KyicResult & { progress_log?: string[] }
      setResult({ ...h, sessionId: id! })
      setSaveState('saved')
      if (h.progress_log) setProgressLog(h.progress_log)
      setStep('hasil')
      fetch('/api/sessions?modul=kyic').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
    } else {
      setError('Analisis gagal di server. Coba lagi.')
      setStep('upload')
    }
  })

  useEffect(() => {
    fetch('/api/sessions?modul=kyic')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRiwayat(data) })
      .catch(() => {})
  }, [])

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
      setProgressLog(prev => [...prev, 'Analisis berjalan di server — aman untuk pindah halaman, hasil tersimpan di Riwayat.'])
      setPollingId(data.sessionId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menganalisis')
      setStep('upload')
    }
  }

  async function handleSimpan() {
    if (!result?.sessionId) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/sessions/${result.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasil: result }),
      })
      if (!res.ok) throw new Error()
      setSaveState('saved')
      fetch('/api/sessions?modul=kyic').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
    } catch {
      setSaveState('error')
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
        .container { max-width: 1200px; margin: 0 auto; padding: 20px 24px 64px; }
        .title { font-size: 26px; font-weight: 500; color: #eef2ef; }
        .title span { color: #45e661; }
        .subtitle { color: #8a949c; font-size: 12.5px; margin: 8px 0 0; margin-bottom: 0; }

        .steps { display: flex; gap: 32px; margin-bottom: 32px; }
        .step-item { display: flex; align-items: baseline; gap: 10px; }
        .step-dot { font-size: 18px; font-weight: 300; color: #5a646c; }
        .step-item.active .step-dot { color: #45e661; }
        .step-item.done .step-dot { color: #45e661; }
        .step-label { font-size: 12px; color: #5a646c; }
        .step-item.active .step-label { color: #eef2ef; }
        .step-item.done .step-label { color: #eef2ef; }

        .card { background: rgba(8,12,18,0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 28px; margin-bottom: 16px; }
        .card-title { font-size: 14px; font-weight: 500; color: #eef2ef; margin-bottom: 16px; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        label { display: block; font-size: 12px; color: #8a949c; margin-bottom: 6px; }
        input[type="text"] { width: 100%; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.15); padding: 8px 0; color: #eef2ef; font-size: 13.5px; outline: none; box-sizing: border-box; font-family: inherit; }
        input[type="text"]:focus { border-bottom-color: #45e661; }

        .upload-zone { border: 1px dashed rgba(69,230,97,0.45); border-radius: 18px; padding: 24px; text-align: center; cursor: pointer; }
        .upload-icon { font-size: 1.8rem; margin-bottom: 8px; }
        .upload-hint { color: #5a646c; font-size: 11.5px; margin-top: 5px; }
        .file-chip { display: inline-flex; align-items: center; gap: 6px; background: rgba(8,12,18,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 4px 12px; font-size: 11.5px; color: #8a949c; margin: 3px; }
        .file-chip button { background: none; border: none; color: #5a646c; cursor: pointer; padding: 0; font-size: 13px; line-height: 1; }
        .file-chip button:hover { color: #ff6f61; }

        .btn { padding: 12px 28px; border-radius: 999px; border: none; cursor: pointer; font-weight: 600; font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase; font-family: inherit; }
        .btn-primary { background: #45e661; color: #04120a; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-success { background: #45e661; color: #04120a; }
        .btn-outline { background: transparent; color: #8a949c; border: 1px solid rgba(255,255,255,0.15); }

        .error-box { background: rgba(255,111,97,0.08); border: 1px solid rgba(255,111,97,0.3); border-radius: 12px; padding: 12px 16px; color: #ff6f61; font-size: 12.5px; margin-bottom: 16px; }

        /* Processing */
        .processing-center { text-align: center; padding: 56px 16px; }
        .spinner { width: 40px; height: 40px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #45e661; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .progress-log { text-align: left; background: rgba(8,12,18,0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; margin-top: 20px; max-height: 200px; overflow-y: auto; }
        .log-item { font-size: 11.5px; color: #5a646c; padding: 2px 0; }
        .log-item.active { color: #45e661; }
        .log-item::before { content: '→ '; }

        /* Hasil */
        .hasil-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .section-label { font-size: 10.5px; font-weight: 500; color: #5a646c; text-transform: uppercase; letter-spacing: 0.12em; margin: 24px 0 12px; }
        .narasi-box { background: rgba(8,12,18,0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 20px 24px; color: #b7c0c6; font-size: 13.5px; line-height: 1.9; white-space: pre-wrap; }

        /* Risk matrix */
        .risk-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .risk-table th { background: rgba(8,12,18,0.8); color: #8a949c; font-weight: 500; padding: 10px 12px; text-align: center; border: 1px solid rgba(255,255,255,0.07); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; }
        .risk-table th:first-child { text-align: left; }
        .risk-table td { padding: 9px 12px; border: 1px solid rgba(255,255,255,0.05); text-align: center; vertical-align: middle; color: #b7c0c6; }
        .risk-table tr:nth-child(even) td { background: rgba(255,255,255,0.01); }
        .risk-table td:first-child { text-align: left; color: #8a949c; cursor: pointer; }
        .risk-table td:first-child:hover { color: #45e661; }
        .risk-table tr.selected td { background: rgba(69,230,97,0.06); }

        .analisis-panel { background: rgba(8,12,18,0.6); border: 1px solid rgba(69,230,97,0.2); border-radius: 16px; padding: 16px 20px; margin-top: 12px; color: #b7c0c6; font-size: 13px; line-height: 1.7; }
        .analisis-label { font-size: 10.5px; font-weight: 500; color: #45e661; margin-bottom: 6px; letter-spacing: 0.08em; text-transform: uppercase; }

        .composite-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
        .composite-item { flex: 1; min-width: 140px; background: rgba(8,12,18,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 14px 16px; text-align: center; }
        .composite-label { font-size: 11px; color: #8a949c; margin-bottom: 6px; }
        .composite-value { font-size: 18px; font-weight: 500; }
      `}</style>

      <div className="container">
        <Navbar simple />
        <div style={{ marginBottom: 26 }}>
          <div className="title"><span>KYIC/KYNBFI</span> — know your insurance company</div>
          <div className="subtitle">Upload template KYIC + dokumen pendukung — AI mengisi profil risiko secara otomatis.</div>
        </div>

        {/* Steps */}
        <div className="steps">
          {[
            { key: 'upload' as Step, label: 'Upload File' },
            { key: 'processing' as Step, label: 'Analisis AI' },
            { key: 'hasil' as Step, label: 'Hasil KYIC' },
          ].map((s, i) => (
            <div key={s.key} className={`step-item ${step === s.key ? 'active' : stepDone(s.key) ? 'done' : ''}`}>
              <div className="step-dot">{i + 1}</div>
              <div className="step-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Two-column: main + riwayat sidebar */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>

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

        {/* placeholder - riwayat moved to sidebar */}

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
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                  <button className="btn btn-outline" onClick={() => { setStep('upload'); setResult(null) }}>← Baru</button>
                  {saveState === 'saved'
                    ? <span style={{ fontSize: '0.85rem', color: '#86efac' }}>✓ Tersimpan</span>
                    : <button className="btn btn-outline" onClick={handleSimpan} disabled={saveState === 'saving'}>
                        {saveState === 'saving' ? '⏳ Menyimpan...' : saveState === 'error' ? '⚠ Coba Lagi' : '💾 Simpan'}
                      </button>
                  }
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'center' }}>
              {saveState !== 'saved' && (
                <button className="btn btn-outline" onClick={handleSimpan} disabled={saveState === 'saving'}>
                  {saveState === 'saving' ? '⏳ Menyimpan...' : saveState === 'error' ? '⚠ Coba Lagi Simpan' : '💾 Simpan Analisis'}
                </button>
              )}
              {saveState === 'saved' && <span style={{ fontSize: '0.85rem', color: '#86efac' }}>✓ Tersimpan</span>}
              <button className="btn btn-success" onClick={() => window.open(`/api/kyic/download/${result.sessionId}`, '_blank')}>
                ⬇ Unduh KYIC (.docx)
              </button>
            </div>
          </div>
        )}

        </div>{/* end flex-1 */}

        {/* Riwayat sidebar */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#5a646c', marginBottom: 16 }}>RIWAYAT ANALISIS</div>
          {riwayat.length === 0 ? (
            <p style={{ fontSize: 12, color: '#5a646c' }}>Belum ada analisis tersimpan.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {riwayat.map(item => (
                <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama_entitas}</div>
                  <div style={{ fontSize: 11, color: '#8a949c', marginTop: 3 }}>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={async () => {
                      const r = await fetch(`/api/sessions?modul=kyic`).then(x => x.json())
                      const found = Array.isArray(r) ? r.find((s: {id: string; hasil: KyicResult}) => s.id === item.id) : null
                      if (found?.hasil) { setResult({ ...found.hasil, sessionId: found.id }); setSaveState('saved'); setStep('hasil') }
                    }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '4px 10px', fontSize: 10.5, color: '#8a949c', cursor: 'pointer', fontFamily: 'inherit' }}>Lihat</button>
                    <button onClick={async () => {
                      if (!confirm(`Hapus analisis "${item.nama_entitas}"?`)) return
                      await fetch(`/api/sessions/${item.id}`, { method: 'DELETE' })
                      setRiwayat(prev => prev.filter(r => r.id !== item.id))
                    }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, color: '#5a646c', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>{/* end two-column */}
      </div>
    </>
  )
}
