'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Navbar from '@/components/oasis/Navbar'

type JenisUsaha = 'Jiwa' | 'Umum'
type SessionStatus = 'idle' | 'extracting' | 'template_ready' | 'analyzing' | 'done' | 'error'

type PsakSession = {
  id: string
  nama_entitas: string
  jenis_usaha: JenisUsaha
  periode: string | null
  status: SessionStatus
  lk_storage_path: string | null
  lk_file_name: string | null
  template_data: Record<string, unknown> | null
  analisis_text: string | null
  error_msg: string | null
  created_at: string
}

type View = 'list' | 'new' | 'detail'

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'Belum mulai',
  extracting: '⏳ Membaca PDF...',
  template_ready: '✓ Template siap',
  analyzing: '⏳ Menganalisis...',
  done: '✓ Selesai',
  error: '✗ Error',
}

const STATUS_COLOR: Record<SessionStatus, string> = {
  idle: '#828d96',
  extracting: '#ffbe50',
  template_ready: '#45e661',
  analyzing: '#ffbe50',
  done: '#45e661',
  error: '#ff6f61',
}

export default function PsakPage() {
  const [view, setView] = useState<View>('list')
  const [sessions, setSessions] = useState<PsakSession[]>([])
  const [detail, setDetail] = useState<PsakSession | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // New session form
  const [namaEntitas, setNamaEntitas] = useState('')
  const [jenisUsaha, setJenisUsaha] = useState<JenisUsaha>('Umum')
  const [periode, setPeriode] = useState('')
  const [creating, setCreating] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/psak/v2/session')
    if (res.ok) setSessions(await res.json())
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/psak/v2/session/${id}`)
    if (res.ok) {
      const data = await res.json()
      setDetail(data)
      return data as PsakSession
    }
    return null
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Polling untuk status extracting / analyzing
  function startPoll(id: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const data = await loadDetail(id)
      if (!data) return
      if (data.status === 'template_ready' || data.status === 'done' || data.status === 'error') {
        clearInterval(pollRef.current!)
        setExtracting(false)
        setAnalyzing(false)
        setSessions(prev => prev.map(s => s.id === id ? { ...s, status: data.status } : s))
      }
    }, 3000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function createSession() {
    if (!namaEntitas.trim()) return
    setCreating(true)
    const res = await fetch('/api/psak/v2/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama_entitas: namaEntitas.trim(), jenis_usaha: jenisUsaha, periode: periode.trim() }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      await loadSessions()
      await loadDetail(data.id)
      setView('detail')
    }
  }

  async function openSession(id: string) {
    const data = await loadDetail(id)
    if (data) {
      setView('detail')
      setExtracting(data.status === 'extracting')
      setAnalyzing(data.status === 'analyzing')
      if (data.status === 'extracting' || data.status === 'analyzing') startPoll(id)
    }
  }

  async function uploadLK(file: File) {
    if (!detail) return
    setUploading(true)
    setUploadError(null)
    try {
      // Get signed URL
      const urlRes = await fetch(`/api/psak/v2/session/${detail.id}/upload-signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlData.error || 'Gagal mendapatkan upload URL')

      // Upload directly to Supabase Storage
      const putRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
      if (!putRes.ok) throw new Error('Gagal upload file ke storage')

      // Save storage path
      const setRes = await fetch(`/api/psak/v2/session/${detail.id}/set-lk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: urlData.storagePath, fileName: file.name }),
      })
      if (!setRes.ok) throw new Error('Gagal menyimpan path file')

      // Trigger extraction
      await fetch(`/api/psak/v2/session/${detail.id}/extract`, { method: 'POST' })
      setExtracting(true)
      startPoll(detail.id)

      // Update local state
      setDetail(prev => prev ? { ...prev, lk_file_name: file.name, lk_storage_path: urlData.storagePath, status: 'extracting' } : prev)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  async function triggerAnalysis() {
    if (!detail) return
    setAnalyzing(true)
    const res = await fetch(`/api/psak/v2/session/${detail.id}/analyze`, { method: 'POST' })
    if (res.ok) {
      setDetail(prev => prev ? { ...prev, status: 'analyzing' } : prev)
      startPoll(detail.id)
    } else {
      setAnalyzing(false)
    }
  }

  async function downloadFile(endpoint: string, label: string) {
    if (!detail) return
    setDownloading(label)
    try {
      const res = await fetch(`/api/psak/v2/session/${detail.id}/${endpoint}`)
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Gagal download'); return }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      const fileName = match ? match[1] : `${label}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  async function deleteSession(id: string) {
    await fetch(`/api/psak/v2/session/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    setConfirmDeleteId(null)
    if (detail?.id === id) { setDetail(null); setView('list') }
  }

  // ─── LIST VIEW ───────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px 64px' }}>
          <Navbar simple />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>
                <span style={{ color: '#45e661' }}>PSAK</span> — Analisis Laporan Keuangan Asuransi
              </h1>
              <p style={{ fontSize: 12.5, color: '#aab4bc', margin: '8px 0 0' }}>
                PSAK 117 (Kontrak Asuransi) · PSAK 109 (Instrumen Keuangan) · Template Analisis + V5 Supervisory
              </p>
            </div>
            <button onClick={() => setView('new')} style={{ background: '#45e661', color: '#04120a', border: 'none', borderRadius: 999, padding: '10px 22px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Analisis Baru
            </button>
          </div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#828d96' }}>
              <p style={{ fontSize: 14 }}>Belum ada analisis tersimpan.</p>
              <button onClick={() => setView('new')} style={{ marginTop: 12, background: 'transparent', border: '1px solid rgba(69,230,97,0.4)', color: '#45e661', borderRadius: 999, padding: '10px 24px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Mulai analisis pertama ↗</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map(s => (
                <div key={s.id} style={{ background: 'rgba(8,12,18,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{s.nama_entitas}</span>
                      <span style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#aab4bc' }}>{s.jenis_usaha}</span>
                      <span style={{ fontSize: 11, color: STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#828d96', marginTop: 4 }}>
                      {s.periode || '—'} · {new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => openSession(s.id)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '7px 16px', fontSize: 11.5, color: '#eef2ef', cursor: 'pointer', fontFamily: 'inherit' }}>Buka</button>
                    {confirmDeleteId === s.id ? (
                      <>
                        <button onClick={() => deleteSession(s.id)} style={{ background: 'rgba(255,111,97,0.15)', border: '1px solid rgba(255,111,97,0.4)', borderRadius: 999, padding: '7px 14px', fontSize: 11, color: '#ff6f61', cursor: 'pointer', fontFamily: 'inherit' }}>Hapus</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', border: 'none', color: '#828d96', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(s.id)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 999, padding: '7px 10px', fontSize: 11, color: '#828d96', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── NEW SESSION VIEW ─────────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 24px 64px' }}>
          <Navbar simple />
          <button onClick={() => setView('list')} style={{ background: 'transparent', border: 'none', color: '#828d96', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 24, padding: 0 }}>← Semua Analisis</button>
          <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 28px' }}>Analisis Baru</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32 }}>
            <div>
              <label style={{ fontSize: 12, color: '#aab4bc', display: 'block', marginBottom: 6 }}>Nama perusahaan</label>
              <input value={namaEntitas} onChange={e => setNamaEntitas(e.target.value)} placeholder="PT Asuransi Central Asia" className="input-underline" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#aab4bc', display: 'block', marginBottom: 6 }}>Jenis usaha</label>
              <select value={jenisUsaha} onChange={e => setJenisUsaha(e.target.value as JenisUsaha)} className="input-underline">
                <option value="Umum">Asuransi Umum</option>
                <option value="Jiwa">Asuransi Jiwa</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#aab4bc', display: 'block', marginBottom: 6 }}>Periode laporan</label>
              <input value={periode} onChange={e => setPeriode(e.target.value)} placeholder="31 Desember 2025" className="input-underline" />
            </div>
            <button
              onClick={createSession}
              disabled={creating || !namaEntitas.trim()}
              className="btn-filled"
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
            >
              {creating ? 'Membuat...' : 'Buat sesi & lanjut upload ↗'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (!detail) return null

  const hasLK = !!detail.lk_storage_path
  const hasTemplate = !!detail.template_data
  const hasAnalysis = !!detail.analisis_text
  const isExtracting = detail.status === 'extracting' || extracting
  const isAnalyzing = detail.status === 'analyzing' || analyzing

  const filledCount = hasTemplate
    ? Object.values((detail.template_data as Record<string, { CY: number | null }>)).filter(v => v?.CY != null).length
    : 0

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar simple />
        <button onClick={() => { setView('list'); setDetail(null); if (pollRef.current) clearInterval(pollRef.current) }} style={{ background: 'transparent', border: 'none', color: '#828d96', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20, padding: 0 }}>← Semua Analisis</button>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{detail.nama_entitas}</h2>
          <div style={{ fontSize: 12.5, color: '#aab4bc', marginTop: 5 }}>{detail.jenis_usaha === 'Jiwa' ? 'Asuransi Jiwa' : 'Asuransi Umum'} · {detail.periode || '—'}</div>
        </div>

        {/* Error banner */}
        {detail.status === 'error' && detail.error_msg && (
          <div style={{ background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.25)', borderRadius: 14, padding: '14px 20px', marginBottom: 20, fontSize: 13, color: '#ff6f61' }}>
            ✗ {detail.error_msg}
          </div>
        )}

        {/* Step cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* STEP 1 — Upload LK */}
          <StepCard
            num={1}
            title="Upload Laporan Keuangan Audited (PDF)"
            done={hasLK}
            active={!hasLK}
          >
            {hasLK ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12.5, color: '#45e661' }}>✓ {detail.lk_file_name || 'File terupload'}</span>
                <label style={{ cursor: 'pointer' }}>
                  <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLK(f); e.target.value = '' }} />
                  <span style={{ fontSize: 11, color: '#828d96', textDecoration: 'underline', cursor: 'pointer' }}>Ganti PDF</span>
                </label>
              </div>
            ) : uploading ? (
              <p style={{ fontSize: 12.5, color: '#ffbe50', margin: 0 }}>⏳ Mengupload PDF...</p>
            ) : (
              <label style={{ cursor: 'pointer', display: 'block', border: '1px dashed rgba(69,230,97,0.4)', borderRadius: 14, padding: '24px 20px', textAlign: 'center' }}>
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLK(f); e.target.value = '' }} />
                <div style={{ fontSize: 13.5, color: '#b7c0c6', fontWeight: 500 }}>Klik untuk upload Lapkeu PDF</div>
                <div style={{ fontSize: 11, color: '#828d96', marginTop: 4 }}>Maks 50 MB · dengan CALK lengkap</div>
              </label>
            )}
            {uploadError && <p style={{ fontSize: 11.5, color: '#ff6f61', margin: '8px 0 0' }}>{uploadError}</p>}
          </StepCard>

          {/* STEP 2 — Ekstraksi */}
          <StepCard
            num={2}
            title="Ekstraksi Data ke Template"
            done={hasTemplate}
            active={hasLK && !hasTemplate && !isExtracting}
            loading={isExtracting}
          >
            {isExtracting ? (
              <p style={{ fontSize: 12.5, color: '#ffbe50', margin: 0 }}>⏳ AI sedang membaca PDF dan mengisi template (~60 detik)...</p>
            ) : hasTemplate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12.5, color: '#45e661', margin: 0 }}>✓ {filledCount} field terisi dari laporan keuangan</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => downloadFile('download-template', 'template')}
                    disabled={downloading === 'template'}
                    style={{ background: 'rgba(69,230,97,0.1)', border: '1px solid rgba(69,230,97,0.3)', color: '#45e661', borderRadius: 999, padding: '9px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {downloading === 'template' ? '...' : '↓ Download Template Analisis LK'}
                  </button>
                  <button
                    onClick={() => downloadFile('download-v5', 'v5')}
                    disabled={downloading === 'v5'}
                    style={{ background: 'rgba(69,230,97,0.1)', border: '1px solid rgba(69,230,97,0.3)', color: '#45e661', borderRadius: 999, padding: '9px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {downloading === 'v5' ? '...' : '↓ Download V5 Supervisory'}
                  </button>
                </div>
                <button
                  onClick={async () => {
                    setExtracting(true)
                    await fetch(`/api/psak/v2/session/${detail.id}/extract`, { method: 'POST' })
                    setDetail(prev => prev ? { ...prev, status: 'extracting' } : prev)
                    startPoll(detail.id)
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#828d96', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' }}
                >
                  ↺ Ekstrak ulang
                </button>
              </div>
            ) : hasLK ? (
              <p style={{ fontSize: 12.5, color: '#828d96', margin: 0 }}>Menunggu proses ekstraksi dimulai...</p>
            ) : (
              <p style={{ fontSize: 12.5, color: '#828d96', margin: 0 }}>Upload LK terlebih dahulu</p>
            )}
          </StepCard>

          {/* STEP 3 — Generate Analisis */}
          <StepCard
            num={3}
            title="Generate Analisis PSAK 117 & PSAK 109"
            done={hasAnalysis}
            active={hasTemplate && !hasAnalysis && !isAnalyzing}
            loading={isAnalyzing}
          >
            {isAnalyzing ? (
              <p style={{ fontSize: 12.5, color: '#ffbe50', margin: 0 }}>⏳ AI sedang menyusun analisis komprehensif (~90 detik)...</p>
            ) : hasAnalysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12.5, color: '#45e661', margin: 0 }}>✓ Analisis PSAK 117 & PSAK 109 tersedia</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => downloadFile('download-analysis', 'analisis')}
                    disabled={downloading === 'analisis'}
                    style={{ background: 'rgba(69,230,97,0.1)', border: '1px solid rgba(69,230,97,0.3)', color: '#45e661', borderRadius: 999, padding: '9px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {downloading === 'analisis' ? '...' : '↓ Download Analisis (.docx)'}
                  </button>
                </div>
                {/* Preview analisis */}
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '16px 18px', maxHeight: 280, overflowY: 'auto' }}>
                  <pre style={{ fontSize: 12, color: '#b7c0c6', whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0, fontFamily: 'inherit' }}>
                    {detail.analisis_text?.slice(0, 2000)}{(detail.analisis_text?.length ?? 0) > 2000 ? '\n\n[... lihat file docx untuk teks lengkap]' : ''}
                  </pre>
                </div>
                <button
                  onClick={triggerAnalysis}
                  style={{ background: 'transparent', border: 'none', color: '#828d96', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' }}
                >
                  ↺ Generate ulang analisis
                </button>
              </div>
            ) : hasTemplate ? (
              <button
                onClick={triggerAnalysis}
                className="btn-filled"
                style={{ fontSize: 12.5 }}
              >
                Generate Analisis PSAK 117 & PSAK 109 ↗
              </button>
            ) : (
              <p style={{ fontSize: 12.5, color: '#828d96', margin: 0 }}>Selesaikan ekstraksi template terlebih dahulu</p>
            )}
          </StepCard>
        </div>
      </div>
    </div>
  )
}

// ─── Step card component ──────────────────────────────────────────────────────
function StepCard({ num, title, done, active, loading, children }: {
  num: number
  title: string
  done?: boolean
  active?: boolean
  loading?: boolean
  children: React.ReactNode
}) {
  const borderColor = done
    ? 'rgba(69,230,97,0.25)'
    : active || loading
    ? 'rgba(255,190,80,0.2)'
    : 'rgba(255,255,255,0.06)'

  return (
    <div style={{
      background: 'rgba(8,12,18,0.85)',
      border: `1px solid ${borderColor}`,
      borderRadius: 20,
      padding: '22px 26px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600,
          background: done ? 'rgba(69,230,97,0.15)' : 'rgba(255,255,255,0.06)',
          color: done ? '#45e661' : '#828d96',
          border: `1px solid ${done ? 'rgba(69,230,97,0.3)' : 'rgba(255,255,255,0.1)'}`,
        }}>
          {done ? '✓' : num}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: done ? '#45e661' : active || loading ? '#eef2ef' : '#828d96' }}>
          {title}
        </span>
      </div>
      <div style={{ paddingLeft: 40 }}>{children}</div>
    </div>
  )
}
