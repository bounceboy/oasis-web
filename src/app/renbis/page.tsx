'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { KkRow } from '@/lib/renbis'

interface RenbisResult {
  sessionId: string
  nama_perusahaan: string
  tahun: string
  kk_rows: KkRow[]
  analisis: string
  kesimpulan: string
}

interface RiwayatItem {
  id: string
  nama_entitas: string
  created_at: string
  hasil: RenbisResult
}

type Step = 'upload' | 'processing' | 'hasil'

export default function RenbisPage() {
  const [step, setStep] = useState<Step>('upload')
  const [namaEntitas, setNamaEntitas] = useState('')
  const [tahun, setTahun] = useState(new Date().getFullYear().toString())
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RenbisResult | null>(null)
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/sessions?modul=renbis')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRiwayat(data) })
      .catch(() => {})
  }, [])

  function loadRiwayat(item: RiwayatItem) {
    setResult({ ...item.hasil, sessionId: item.id })
    setStep('hasil')
  }

  async function handleAnalyze() {
    if (!file || !namaEntitas.trim() || !tahun.trim()) {
      setError('Lengkapi semua field dan pilih file PDF.')
      return
    }
    setError(null)
    setStep('processing')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('namaEntitas', namaEntitas.trim())
    fd.append('tahun', tahun.trim())

    try {
      const res = await fetch('/api/renbis/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Terjadi kesalahan')
      setResult(data)
      setStep('hasil')
      // Refresh riwayat
      fetch('/api/sessions?modul=renbis').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menganalisis')
      setStep('upload')
    }
  }

  function handleDownload() {
    if (!result?.sessionId) return
    window.open(`/api/renbis/download/${result.sessionId}`, '_blank')
  }

  // Kelompok baris KK untuk tampilan
  const adminRows = result?.kk_rows.slice(0, 7) ?? []
  const checklistRows = result?.kk_rows.slice(10, 34) ?? []
  const analisisRows = result?.kk_rows.slice(34) ?? []

  return (
    <>
      <style jsx>{`
        .container { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
        .back { color: #64748b; font-size: 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem; margin-bottom: 1.5rem; }
        .back:hover { color: #94a3b8; }
        .title { font-size: 1.4rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.25rem; }
        .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }

        /* Steps */
        .steps { display: flex; gap: 0; margin-bottom: 2.5rem; }
        .step-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; position: relative; }
        .step-item:not(:last-child)::after {
          content: ''; position: absolute; top: 14px; left: 60%; width: 80%; height: 2px;
          background: #1e293b;
        }
        .step-item.active::after { background: #2563eb; }
        .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; background: #1e293b; color: #475569; border: 2px solid #334155; z-index: 1; }
        .step-item.active .step-dot { background: #2563eb; color: white; border-color: #2563eb; }
        .step-item.done .step-dot { background: #16a34a; color: white; border-color: #16a34a; }
        .step-label { font-size: 0.75rem; color: #475569; }
        .step-item.active .step-label { color: #93c5fd; }

        /* Card */
        .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 1rem; padding: 2rem; }

        /* Form */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
        .form-full { grid-column: 1 / -1; }
        label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.4rem; font-weight: 500; }
        input[type="text"], input[type="number"] {
          width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem;
          padding: 0.6rem 0.75rem; color: #f1f5f9; font-size: 0.9rem; outline: none;
          box-sizing: border-box;
        }
        input[type="text"]:focus, input[type="number"]:focus { border-color: #2563eb; }

        .upload-zone {
          border: 2px dashed #334155; border-radius: 0.75rem; padding: 2.5rem;
          text-align: center; cursor: pointer; transition: border-color 0.2s;
        }
        .upload-zone:hover, .upload-zone.has-file { border-color: #2563eb; }
        .upload-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
        .upload-hint { color: #64748b; font-size: 0.85rem; }
        .file-name { color: #93c5fd; font-size: 0.9rem; font-weight: 500; margin-top: 0.5rem; }

        .btn { padding: 0.7rem 1.5rem; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-success { background: #16a34a; color: white; }
        .btn-success:hover { background: #15803d; }
        .btn-outline { background: transparent; color: #94a3b8; border: 1px solid #334155; }
        .btn-outline:hover { border-color: #64748b; color: #f1f5f9; }

        .error-box { background: #450a0a; border: 1px solid #991b1b; border-radius: 0.5rem; padding: 0.75rem 1rem; color: #fca5a5; font-size: 0.85rem; margin-bottom: 1rem; }

        /* Processing */
        .processing-center { text-align: center; padding: 3rem 1rem; }
        .spinner { width: 48px; height: 48px; border: 4px solid #1e293b; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.5rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .processing-text { color: #94a3b8; font-size: 0.95rem; }
        .processing-hint { color: #475569; font-size: 0.8rem; margin-top: 0.5rem; }

        /* Hasil */
        .hasil-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .hasil-title { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; }
        .hasil-meta { color: #64748b; font-size: 0.85rem; margin-top: 0.2rem; }

        .section-label { font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin: 1.5rem 0 0.75rem; }

        /* KK Table */
        .kk-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .kk-table th { background: #1e293b; color: #94a3b8; font-weight: 600; padding: 0.5rem 0.75rem; text-align: left; border: 1px solid #334155; }
        .kk-table td { padding: 0.5rem 0.75rem; border: 1px solid #1e293b; vertical-align: top; color: #cbd5e1; }
        .kk-table tr:nth-child(even) td { background: #0c1525; }
        .kk-table .section-row td { background: #172033; color: #93c5fd; font-weight: 600; }
        .kk-table .col-no { width: 48px; color: #475569; }
        .kk-table .col-hal { width: 220px; color: #94a3b8; }
        .kk-table .col-ket { width: 200px; color: #64748b; font-style: italic; }
        .kk-table .isian-ada { color: #86efac; }
        .kk-table .isian-tidak { color: #fca5a5; }

        .checklist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.5rem; }
        .checklist-item { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; padding: 0.6rem 0.75rem; display: flex; gap: 0.6rem; align-items: flex-start; }
        .checklist-badge { font-size: 0.85rem; flex-shrink: 0; margin-top: 0.05rem; }
        .checklist-hal { font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
        .checklist-isian { font-size: 0.78rem; color: #64748b; margin-top: 0.2rem; }

        .narasi-box { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1rem 1.25rem; color: #cbd5e1; font-size: 0.875rem; line-height: 1.7; white-space: pre-wrap; }
      `}</style>

      <div className="container">
        <Link href="/dashboard" className="back">← Dashboard</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.25rem' }}>
          <div>
            <div className="title">Evaluasi Rencana Bisnis</div>
            <div className="subtitle">Upload PDF Rencana Bisnis perusahaan asuransi — AI akan mengisi KK secara otomatis</div>
          </div>
          {step === 'hasil' && (
            <button className="btn btn-outline" style={{ marginTop: '0.25rem' }} onClick={() => { setStep('upload'); setResult(null) }}>+ Analisis Baru</button>
          )}
        </div>

        {/* Riwayat */}
        {riwayat.length > 0 && step === 'upload' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Riwayat Analisis</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {riwayat.map(item => (
                <button key={item.id} onClick={() => loadRiwayat(item)}
                  style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#2563eb')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
                >
                  <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>{item.nama_entitas}</div>
                  <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: '0.1rem' }}>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="steps">
          {[
            { key: 'upload', label: 'Upload PDF' },
            { key: 'processing', label: 'Analisis AI' },
            { key: 'hasil', label: 'Hasil KK' },
          ].map((s, i) => (
            <div key={s.key} className={`step-item ${step === s.key ? 'active' : step === 'hasil' && s.key !== 'hasil' ? 'done' : step === 'processing' && s.key === 'upload' ? 'done' : ''}`}>
              <div className="step-dot">{step === 'hasil' && s.key !== 'hasil' ? '✓' : step === 'processing' && s.key === 'upload' ? '✓' : i + 1}</div>
              <div className="step-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Upload step */}
        {step === 'upload' && (
          <div className="card">
            {error && <div className="error-box">{error}</div>}
            <div className="form-grid">
              <div>
                <label>Nama Perusahaan</label>
                <input type="text" value={namaEntitas} onChange={(e) => setNamaEntitas(e.target.value)} placeholder="PT Asuransi ..." />
              </div>
              <div>
                <label>Tahun Rencana Bisnis</label>
                <input type="text" value={tahun} onChange={(e) => setTahun(e.target.value)} placeholder="2025" />
              </div>
              <div className="form-full">
                <label>File PDF Rencana Bisnis</label>
                <div
                  className={`upload-zone ${file ? 'has-file' : ''}`}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="upload-icon">📄</div>
                  {file ? (
                    <>
                      <div className="file-name">{file.name}</div>
                      <div className="upload-hint" style={{ marginTop: '0.25rem' }}>
                        {(file.size / 1024 / 1024).toFixed(1)} MB — klik untuk ganti
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ color: '#94a3b8', fontWeight: 500 }}>Klik atau drag file PDF di sini</div>
                      <div className="upload-hint">Format: PDF · Maks. 50 MB</div>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleAnalyze} disabled={!file || !namaEntitas || !tahun}>
                Analisis →
              </button>
            </div>
          </div>
        )}

        {/* Processing step */}
        {step === 'processing' && (
          <div className="card">
            <div className="processing-center">
              <div className="spinner" />
              <div className="processing-text">AI sedang membaca dan menganalisis Rencana Bisnis...</div>
              <div className="processing-hint">Proses ini membutuhkan waktu 1–3 menit</div>
            </div>
          </div>
        )}

        {/* Hasil step */}
        {step === 'hasil' && result && (
          <div>
            <div className="card">
              <div className="hasil-header">
                <div>
                  <div className="hasil-title">KK Rencana Bisnis — {result.nama_perusahaan}</div>
                  <div className="hasil-meta">Tahun {result.tahun}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-success" onClick={handleDownload}>⬇ Unduh .docx</button>
                </div>
              </div>

              {/* Bagian Admin */}
              <div className="section-label">Bagian 1 — Administratif</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="kk-table">
                  <thead>
                    <tr>
                      <th className="col-no">No.</th>
                      <th className="col-ket">Keterangan</th>
                      <th>Isian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminRows.map((row, i) => (
                      <tr key={i}>
                        <td className="col-no">{row.no}</td>
                        <td className="col-ket">{row.keterangan}</td>
                        <td>{row.isian}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bagian Checklist Cakupan */}
              <div className="section-label">Bagian 2 — Cakupan Rencana Bisnis</div>

              {/* Baris komisaris & catatan cakupan */}
              {result.kk_rows.slice(8, 10).map((row, i) => (
                <div key={i} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>{row.hal}</div>
                  <div className="narasi-box" style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{row.isian}</div>
                </div>
              ))}

              <div style={{ marginTop: '1rem' }}>
                <div className="checklist-grid">
                  {checklistRows.map((row, i) => {
                    const isAda = row.isian.toLowerCase().startsWith('ada')
                    return (
                      <div key={i} className="checklist-item">
                        <span className="checklist-badge">{isAda ? '✅' : '❌'}</span>
                        <div>
                          <div className="checklist-hal">{row.hal}</div>
                          <div className="checklist-isian">{row.isian}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bagian Analisis */}
              <div className="section-label">Bagian 3 — Tingkat Kesehatan</div>
              <div className="narasi-box">{result.kk_rows[34]?.isian ?? '-'}</div>

              <div className="section-label">Bagian 4 — Analisis Rencana Bisnis</div>
              <div className="narasi-box">{result.analisis}</div>

              <div className="section-label">Bagian 5 — Kesimpulan</div>
              <div className="narasi-box">{result.kesimpulan}</div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="btn btn-success" onClick={handleDownload}>⬇ Unduh KK Renbis (.docx)</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
