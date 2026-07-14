'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { KkRow } from '@/lib/renbis'
import Navbar from '@/components/oasis/Navbar'

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
  hasil: RenbisResult & { tahun?: string }
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/sessions?modul=renbis')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRiwayat(data) })
      .catch(() => {})
  }, [])

  function loadRiwayat(item: RiwayatItem) {
    setResult({ ...item.hasil, sessionId: item.id })
    setSaveState('saved')
    setStep('hasil')
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
      fetch('/api/sessions?modul=renbis').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
    } catch {
      setSaveState('error')
    }
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
      setSaveState('idle')
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
        .container { max-width: 1200px; margin: 0 auto; padding: 20px 24px 64px; }
        .title { font-size: 26px; font-weight: 500; color: #eef2ef; margin-bottom: 0; }
        .title span { color: #45e661; }
        .subtitle { color: #8a949c; font-size: 12.5px; margin: 8px 0 0; }

        /* Steps */
        .steps { display: flex; gap: 32px; margin-bottom: 32px; }
        .step-item { display: flex; align-items: baseline; gap: 10px; }
        .step-dot { font-size: 18px; font-weight: 300; color: #5a646c; }
        .step-item.active .step-dot { color: #45e661; }
        .step-item.done .step-dot { color: #45e661; }
        .step-label { font-size: 12px; color: #5a646c; }
        .step-item.active .step-label { color: #eef2ef; }
        .step-item.done .step-label { color: #eef2ef; }

        /* Card */
        .card { background: rgba(8,12,18,0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 32px; }

        /* Form */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .form-full { grid-column: 1 / -1; }
        label { display: block; font-size: 12px; color: #8a949c; margin-bottom: 6px; }
        input[type="text"], input[type="number"] {
          width: 100%; background: transparent; border: none;
          border-bottom: 1px solid rgba(255,255,255,0.15);
          padding: 8px 0; color: #eef2ef; font-size: 13.5px; outline: none;
          box-sizing: border-box; font-family: inherit;
        }
        input[type="text"]:focus, input[type="number"]:focus { border-bottom-color: #45e661; }

        .upload-zone {
          border: 1px dashed rgba(69,230,97,0.45); border-radius: 18px; padding: 28px;
          text-align: center; cursor: pointer;
        }
        .upload-icon { font-size: 2rem; margin-bottom: 0.5rem; }
        .upload-hint { color: #5a646c; font-size: 11.5px; margin-top: 5px; }
        .file-name { color: #45e661; font-size: 13.5px; font-weight: 500; }

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
        .processing-text { color: #eef2ef; font-size: 15px; font-weight: 500; }
        .processing-hint { color: #8a949c; font-size: 12px; margin-top: 8px; }

        /* Hasil */
        .hasil-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .hasil-title { font-size: 17px; font-weight: 500; color: #eef2ef; }
        .hasil-meta { color: #8a949c; font-size: 12px; margin-top: 4px; }

        .section-label { font-size: 10.5px; font-weight: 500; color: #5a646c; text-transform: uppercase; letter-spacing: 0.12em; margin: 24px 0 12px; }

        /* KK Table */
        .kk-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .kk-table th { background: rgba(8,12,18,0.8); color: #8a949c; font-weight: 500; padding: 10px 16px; text-align: left; border: 1px solid rgba(255,255,255,0.07); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; }
        .kk-table td { padding: 9px 16px; border: 1px solid rgba(255,255,255,0.05); vertical-align: top; color: #b7c0c6; }
        .kk-table tr:nth-child(even) td { background: rgba(255,255,255,0.01); }
        .kk-table .section-row td { background: rgba(69,230,97,0.06); color: #45e661; font-weight: 500; }
        .kk-table .col-no { width: 48px; color: #5a646c; }
        .kk-table .col-hal { width: 220px; color: #8a949c; }
        .kk-table .col-ket { width: 200px; color: #5a646c; font-style: italic; }
        .kk-table .isian-ada { color: #45e661; }
        .kk-table .isian-tidak { color: #ff6f61; }

        .checklist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
        .checklist-item { background: rgba(8,12,18,0.6); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 10px 14px; display: flex; gap: 10px; align-items: flex-start; }
        .checklist-badge { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
        .checklist-hal { font-size: 12px; color: #8a949c; font-weight: 500; }
        .checklist-isian { font-size: 11.5px; color: #5a646c; margin-top: 3px; }

        .narasi-box { background: rgba(8,12,18,0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 20px 24px; color: #b7c0c6; font-size: 13.5px; line-height: 1.9; white-space: pre-wrap; }
      `}</style>

      <div className="container">
        <Navbar />
        <div style={{ marginBottom: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="title"><span>Renbis</span> — evaluasi rencana bisnis</div>
            <div className="subtitle">Upload PDF Rencana Bisnis perusahaan asuransi — AI akan mengisi KK secara otomatis</div>
          </div>
          {step === 'hasil' && (
            <button className="btn btn-outline" onClick={() => { setStep('upload'); setResult(null) }}>+ Analisis Baru</button>
          )}
        </div>

        {/* Step indicator */}
        <div className="steps">
          {[
            { key: 'upload', label: 'Upload PDF' },
            { key: 'processing', label: 'Analisis AI' },
            { key: 'hasil', label: 'Hasil KK' },
          ].map((s, i) => (
            <div key={s.key} className={`step-item ${step === s.key ? 'active' : (step === 'hasil' && s.key !== 'hasil') || (step === 'processing' && s.key === 'upload') ? 'done' : ''}`}>
              <div className="step-dot">{i + 1}</div>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                {saveState !== 'saved' && (
                  <button
                    className="btn btn-outline"
                    onClick={handleSimpan}
                    disabled={saveState === 'saving'}
                  >
                    {saveState === 'saving' ? '⏳ Menyimpan...' : saveState === 'error' ? '⚠ Coba Lagi Simpan' : '💾 Simpan Analisis'}
                  </button>
                )}
                {saveState === 'saved' && (
                  <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: '#86efac' }}>✓ Tersimpan</span>
                )}
                <button className="btn btn-success" onClick={handleDownload}>⬇ Unduh KK Renbis (.docx)</button>
              </div>
            </div>
          </div>
        )}
        {/* Riwayat — selalu tampil di bawah */}
        <div style={{ marginTop: '2rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Riwayat Analisis
          </div>
          {riwayat.length === 0 ? (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.75rem', padding: '1.25rem', color: '#475569', fontSize: '0.85rem', textAlign: 'center' }}>
              Belum ada riwayat analisis
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {riwayat.map(item => (
                <div key={item.id}
                  style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>{item.nama_entitas}</div>
                    <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                      {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {item.hasil?.tahun && <span style={{ marginLeft: '0.5rem', color: '#334155' }}>· Tahun {item.hasil.tahun}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '1rem' }}>
                    <button onClick={() => loadRiwayat(item)}
                      style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '0.4rem', padding: '0.3rem 0.75rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#93c5fd' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8' }}
                    >Lihat</button>
                    <button onClick={async () => {
                      if (!confirm(`Hapus analisis "${item.nama_entitas}"?`)) return
                      await fetch(`/api/sessions/${item.id}`, { method: 'DELETE' })
                      setRiwayat(prev => prev.filter(r => r.id !== item.id))
                      if (result?.sessionId === item.id) { setResult(null); setStep('upload') }
                    }}
                      style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '0.4rem', padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#991b1b'; e.currentTarget.style.color = '#f87171' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#475569' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
