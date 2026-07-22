'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Navbar from '@/components/oasis/Navbar'
import type { TemplateData } from '@/lib/psak-template-structure'
import {
  buildRasioGroups,
  formatRasio,
  templateDataToDataKeuangan,
  type RasioGroup,
  type DataKeuangan,
} from '@/lib/psak-scorecard'

type JenisUsaha = 'Jiwa' | 'Umum'
type SessionStatus = 'idle' | 'extracting' | 'template_ready' | 'analyzing' | 'done' | 'error'
type Tab = 'scorecard' | 'analisis' | 'detail'

type PsakSession = {
  id: string
  nama_entitas: string
  jenis_usaha: JenisUsaha
  periode: string | null
  status: SessionStatus
  lk_storage_path: string | null
  lk_file_name: string | null
  template_data: TemplateData | null
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
  const [activeTab, setActiveTab] = useState<Tab>('scorecard')

  // New session form
  const [namaEntitas, setNamaEntitas] = useState('')
  const [jenisUsaha, setJenisUsaha] = useState<JenisUsaha>('Umum')
  const [periode, setPeriode] = useState('')
  const [creating, setCreating] = useState(false)

  // Action state
  const [uploading, setUploading] = useState(false)
  const [uploadingExcel, setUploadingExcel] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [excelError, setExcelError] = useState<string | null>(null)
  const [excelImported, setExcelImported] = useState<number | null>(null)

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

  useEffect(() => { loadSessions() }, [loadSessions])

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
      setActiveTab('scorecard')
    }
  }

  async function openSession(id: string) {
    const data = await loadDetail(id)
    if (data) {
      setView('detail')
      setActiveTab(data.status === 'done' ? 'analisis' : 'scorecard')
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
      const urlRes = await fetch(`/api/psak/v2/session/${detail.id}/upload-signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlData.error || 'Gagal mendapatkan upload URL')

      const putRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
      if (!putRes.ok) throw new Error('Gagal upload file ke storage')

      const setRes = await fetch(`/api/psak/v2/session/${detail.id}/set-lk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: urlData.storagePath, fileName: file.name }),
      })
      if (!setRes.ok) throw new Error('Gagal menyimpan path file')

      await fetch(`/api/psak/v2/session/${detail.id}/extract`, { method: 'POST' })
      setExtracting(true)
      startPoll(detail.id)
      setDetail(prev => prev ? { ...prev, lk_file_name: file.name, lk_storage_path: urlData.storagePath, status: 'extracting' } : prev)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  async function uploadExcel(file: File) {
    if (!detail) return
    setUploadingExcel(true)
    setExcelError(null)
    setExcelImported(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/psak/v2/session/${detail.id}/upload-excel`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal upload Excel')
      setExcelImported(data.fieldsImported)
      // Reload session untuk update template_data
      const updated = await loadDetail(detail.id)
      if (updated && !['template_ready', 'analyzing', 'done'].includes(updated.status)) {
        startPoll(detail.id)
      }
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploadingExcel(false)
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
      const fileName = match ? match[1] : `${label}`
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

  // ─── LIST ──────────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar simple />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>
              <span style={{ color: '#45e661' }}>PSAK</span> — Analisis Laporan Keuangan Asuransi
            </h1>
            <p style={{ fontSize: 12.5, color: '#aab4bc', margin: '8px 0 0' }}>
              PSAK 117 (Kontrak Asuransi) · PSAK 109 (Instrumen Keuangan)
            </p>
          </div>
          <button onClick={() => setView('new')} style={{ background: '#45e661', color: '#04120a', border: 'none', borderRadius: 999, padding: '10px 22px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Analisis Baru
          </button>
        </div>

        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#828d96' }}>
            <p style={{ fontSize: 14 }}>Belum ada analisis tersimpan.</p>
            <button onClick={() => setView('new')} style={{ marginTop: 12, background: 'transparent', border: '1px solid rgba(69,230,97,0.4)', color: '#45e661', borderRadius: 999, padding: '10px 24px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              Mulai analisis pertama ↗
            </button>
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

  // ─── NEW SESSION ────────────────────────────────────────────────────────────
  if (view === 'new') return (
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
          <button onClick={createSession} disabled={creating || !namaEntitas.trim()} className="btn-filled" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
            {creating ? 'Membuat...' : 'Buat sesi & lanjut upload ↗'}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── DETAIL ─────────────────────────────────────────────────────────────────
  if (!detail) return null

  const hasLK = !!detail.lk_storage_path
  const hasTemplate = !!detail.template_data
  const hasAnalysis = !!detail.analisis_text
  const isExtracting = detail.status === 'extracting' || extracting
  const isAnalyzing = detail.status === 'analyzing' || analyzing
  const showScorecard = hasTemplate && ['template_ready', 'analyzing', 'done'].includes(detail.status)

  // Compute rasio groups from template_data
  const rasioGroups: RasioGroup[] = hasTemplate
    ? buildRasioGroups(detail.template_data!, detail.jenis_usaha)
    : []
  const dk: DataKeuangan | null = hasTemplate ? templateDataToDataKeuangan(detail.template_data!) : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'scorecard', label: 'Scorecard & Rasio' },
    { key: 'analisis', label: 'Analisis Komprehensif' },
    { key: 'detail', label: 'Data Lengkap' },
  ]

  // ── Pre-extraction: step-card UI ─────────────────────────────────────────
  if (!showScorecard) return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar simple />
        <button onClick={() => { setView('list'); setDetail(null); if (pollRef.current) clearInterval(pollRef.current) }}
          style={{ background: 'transparent', border: 'none', color: '#828d96', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20, padding: 0 }}>
          ← Semua Analisis
        </button>

        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{detail.nama_entitas}</h2>
          <div style={{ fontSize: 12.5, color: '#aab4bc', marginTop: 5 }}>{detail.jenis_usaha === 'Jiwa' ? 'Asuransi Jiwa' : 'Asuransi Umum'} · {detail.periode || '—'}</div>
        </div>

        {detail.status === 'error' && detail.error_msg && (
          <div style={{ background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.25)', borderRadius: 14, padding: '14px 20px', marginBottom: 20, fontSize: 13, color: '#ff6f61' }}>
            ✗ {detail.error_msg}
            <button
              onClick={async () => {
                setExtracting(true)
                setDetail(prev => prev ? { ...prev, status: 'extracting', error_msg: null } : prev)
                await fetch(`/api/psak/v2/session/${detail.id}/extract`, { method: 'POST' })
                startPoll(detail.id)
              }}
              style={{ marginLeft: 16, background: 'rgba(255,111,97,0.15)', border: '1px solid rgba(255,111,97,0.4)', borderRadius: 999, padding: '4px 12px', fontSize: 11, color: '#ff6f61', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ↺ Coba lagi
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* STEP 1 — Upload */}
          <StepCard num={1} title="Upload Laporan Keuangan Audited (PDF)" done={hasLK} active={!hasLK}>
            {hasLK ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12.5, color: '#45e661' }}>✓ {detail.lk_file_name || 'File terupload'}</span>
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLK(f); e.target.value = '' }} />
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

          {/* STEP 2 — Upload Excel */}
          <StepCard num={2} title="Upload Excel PSAK 117 (OJK Template)" done={false} active={hasLK} loading={uploadingExcel}>
            <p style={{ fontSize: 12, color: '#828d96', margin: '0 0 12px' }}>
              Template Excel format OJK — sheet: LUPSPK, LUPLRG, LUPAKS, LUPCRF, LUPSAGP, LUPAKD, LUPSKV
            </p>
            {uploadingExcel ? (
              <p style={{ fontSize: 12.5, color: '#ffbe50', margin: 0 }}>⏳ Membaca Excel dan mengisi data...</p>
            ) : excelImported != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12.5, color: '#45e661' }}>✓ {excelImported} field berhasil diimport dari Excel</span>
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept=".xlsx,.xls,.xlsm" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadExcel(f); e.target.value = '' }} />
                  <span style={{ fontSize: 11, color: '#828d96', textDecoration: 'underline' }}>Upload ulang</span>
                </label>
              </div>
            ) : (
              <label style={{ cursor: hasLK ? 'pointer' : 'default', display: 'block', border: `1px dashed ${hasLK ? 'rgba(69,230,97,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '20px', textAlign: 'center', opacity: hasLK ? 1 : 0.5 }}>
                <input type="file" accept=".xlsx,.xls,.xlsm" style={{ display: 'none' }} disabled={!hasLK}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadExcel(f); e.target.value = '' }} />
                <div style={{ fontSize: 13, color: '#b7c0c6', fontWeight: 500 }}>Klik untuk upload Excel PSAK 117</div>
                <div style={{ fontSize: 11, color: '#828d96', marginTop: 4 }}>.xlsx / .xls / .xlsm · Diutamakan setelah upload PDF</div>
              </label>
            )}
            {excelError && <p style={{ fontSize: 11.5, color: '#ff6f61', margin: '8px 0 0' }}>{excelError}</p>}
          </StepCard>

          {/* STEP 3 — Ekstraksi PDF */}
          <StepCard num={3} title="Ekstraksi Data dari PDF (AI)" done={false} active={hasLK && !isExtracting} loading={isExtracting}>
            {isExtracting ? (
              <p style={{ fontSize: 12.5, color: '#ffbe50', margin: 0 }}>⏳ AI sedang membaca PDF dan mengisi template (~60 detik)...</p>
            ) : hasLK ? (
              <p style={{ fontSize: 12.5, color: '#828d96', margin: 0 }}>Menunggu proses ekstraksi PDF...</p>
            ) : (
              <p style={{ fontSize: 12.5, color: '#828d96', margin: 0 }}>Upload LK PDF terlebih dahulu</p>
            )}
          </StepCard>
        </div>
      </div>
    </div>
  )

  // ── Post-extraction: tabbed scorecard view ───────────────────────────────
  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar simple />
        <button onClick={() => { setView('list'); setDetail(null); if (pollRef.current) clearInterval(pollRef.current) }}
          style={{ background: 'transparent', border: 'none', color: '#828d96', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20, padding: 0 }}>
          ← Semua Analisis
        </button>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#45e661', letterSpacing: '0.15em', marginBottom: 6 }}>PSAK 117 · PSAK 109</div>
            <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{detail.nama_entitas}</h1>
            <div style={{ fontSize: 12, color: '#aab4bc', marginTop: 5 }}>{detail.jenis_usaha === 'Jiwa' ? 'Asuransi Jiwa' : 'Asuransi Umum'} · {detail.periode || '—'}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Download buttons */}
            <button onClick={() => downloadFile('download-template', 'template.xlsx')} disabled={downloading === 'template.xlsx'}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#b7c0c6', borderRadius: 999, padding: '7px 14px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              {downloading === 'template.xlsx' ? '...' : '↓ Template'}
            </button>
            <button onClick={() => downloadFile('download-v5', 'v5.xlsx')} disabled={downloading === 'v5.xlsx'}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#b7c0c6', borderRadius: 999, padding: '7px 14px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              {downloading === 'v5.xlsx' ? '...' : '↓ V5'}
            </button>
            {hasAnalysis && (
              <button onClick={() => downloadFile('download-analysis', 'analisis.docx')} disabled={downloading === 'analisis.docx'}
                style={{ background: 'rgba(69,230,97,0.1)', border: '1px solid rgba(69,230,97,0.3)', color: '#45e661', borderRadius: 999, padding: '7px 14px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                {downloading === 'analisis.docx' ? '...' : '↓ Analisis (.docx)'}
              </button>
            )}
            {/* Re-upload PDF */}
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLK(f); e.target.value = '' }} />
              <span style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#828d96', borderRadius: 999, padding: '7px 12px', fontSize: 11, cursor: 'pointer' }}>↑ Ganti PDF</span>
            </label>
            {/* Re-upload Excel */}
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".xlsx,.xls,.xlsm" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadExcel(f); e.target.value = '' }} />
              <span style={{ background: 'transparent', border: `1px solid ${excelImported != null ? 'rgba(69,230,97,0.3)' : 'rgba(255,255,255,0.06)'}`, color: excelImported != null ? '#45e661' : '#828d96', borderRadius: 999, padding: '7px 12px', fontSize: 11, cursor: 'pointer' }}>
                {uploadingExcel ? '⏳' : excelImported != null ? `✓ Excel (${excelImported})` : '↑ Upload Excel'}
              </span>
            </label>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: 5, marginBottom: 24, width: 'fit-content' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '9px 20px', border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: activeTab === tab.key ? '#45e661' : 'transparent', color: activeTab === tab.key ? '#04120a' : '#aab4bc', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 28 }}>

          {/* ── SCORECARD TAB ── */}
          {activeTab === 'scorecard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {rasioGroups.map(group => (
                <div key={group.title}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#45e661', marginBottom: 12 }}>
                    {group.title}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['Indikator', 'Formula', 'Nilai'].map((h, hi) => (
                            <th key={h} style={{
                              textAlign: hi === 2 ? 'right' : 'left',
                              padding: '8px 14px',
                              color: '#828d96',
                              fontWeight: 500,
                              fontSize: 10.5,
                              letterSpacing: '0.08em',
                              borderBottom: '1px solid rgba(255,255,255,0.07)',
                              width: hi === 0 ? '35%' : hi === 1 ? '45%' : '20%',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item, i) => (
                          <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 14px', color: '#eef2ef' }}>{item.metric}</td>
                            <td style={{ padding: '10px 14px', color: '#828d96', fontSize: 12 }}>{item.formula}</td>
                            <td style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontVariantNumeric: 'tabular-nums',
                              color: item.nilai == null ? '#454e55' : '#b7c0c6',
                            }}>
                              {formatRasio(item.nilai, item.format)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ANALISIS TAB ── */}
          {activeTab === 'analisis' && (
            <div>
              {isAnalyzing ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#ffbe50' }}>
                  <div style={{ width: 36, height: 36, border: '2px solid rgba(255,190,80,0.2)', borderTopColor: '#ffbe50', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ fontSize: 13, margin: 0 }}>AI sedang menyusun analisis komprehensif (~90 detik)...</p>
                </div>
              ) : hasAnalysis ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <p style={{ fontSize: 12, color: '#45e661', margin: 0 }}>✓ Analisis PSAK 117 & PSAK 109 tersedia</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => downloadFile('download-analysis', 'analisis.docx')} disabled={downloading === 'analisis.docx'}
                        style={{ background: 'rgba(69,230,97,0.1)', border: '1px solid rgba(69,230,97,0.3)', color: '#45e661', borderRadius: 999, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {downloading === 'analisis.docx' ? '...' : '↓ Download .docx'}
                      </button>
                      <button onClick={triggerAnalysis}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#828d96', borderRadius: 999, padding: '8px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ↺ Generate ulang
                      </button>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '20px 24px' }}>
                    <pre style={{ fontSize: 13, color: '#b7c0c6', whiteSpace: 'pre-wrap', lineHeight: 1.9, margin: 0, fontFamily: 'inherit' }}>
                      {detail.analisis_text}
                    </pre>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <p style={{ fontSize: 13, color: '#aab4bc', marginBottom: 20 }}>
                    Buat analisis komprehensif PSAK 117 & PSAK 109 berdasarkan data yang telah diekstrak.
                  </p>
                  <button onClick={triggerAnalysis} className="btn-filled" style={{ fontSize: 13 }}>
                    Generate Analisis PSAK 117 & PSAK 109 ↗
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── DATA LENGKAP TAB ── */}
          {activeTab === 'detail' && dk && (
            <div>
              <div style={{ fontSize: 11.5, color: '#828d96', marginBottom: 20 }}>
                Unit: {detail.template_data?.metadata.unit || 'juta Rupiah'} · Mata uang: {detail.template_data?.metadata.mata_uang || 'IDR'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { title: 'Posisi Keuangan', items: [
                    { label: 'Kas & setara kas', val: dk.kas },
                    { label: 'Investasi', val: dk.investasi_total },
                    { label: 'Aset reasuransi', val: dk.aset_kontrak_reasuransi },
                    { label: 'Total aset', val: dk.total_aset },
                    { label: 'Liab. kontrak asuransi', val: dk.liabilitas_kontrak_asuransi },
                    { label: 'Total liabilitas', val: dk.total_liabilitas },
                    { label: 'Total ekuitas', val: dk.total_ekuitas },
                  ]},
                  { title: 'Laba Rugi', items: [
                    { label: 'Pendapatan asuransi', val: dk.pendapatan_asuransi },
                    { label: 'Beban jasa asuransi', val: dk.beban_jasa_asuransi },
                    { label: 'Klaim & manfaat', val: dk.klaim_dan_manfaat },
                    { label: 'ISR', val: dk.insurance_service_result },
                    { label: 'Hasil investasi', val: dk.hasil_investasi },
                    { label: 'Profit tahun berjalan', val: dk.profit_tahun_berjalan },
                  ]},
                  { title: 'IFRS 17 — Liabilitas & CSM', items: [
                    { label: 'LRC', val: dk.lrc },
                    { label: 'LIC', val: dk.lic },
                    { label: 'Loss component', val: dk.loss_component },
                    { label: 'Risk adjustment', val: dk.risk_adjustment },
                    { label: 'RA pembuka', val: dk.risk_adjustment_pembuka },
                    { label: 'CSM saldo akhir', val: dk.csm_penutup },
                    { label: 'CSM saldo awal', val: dk.csm_pembuka },
                  ]},
                  { title: 'IFRS 9 — ECL & Staging', items: [
                    { label: 'ECL cadangan (Stage 1)', val: dk.ecl_total },
                    { label: 'Total aset finansial (ECL base)', val: dk.ecl_base },
                    { label: 'Arus kas operasi', val: dk.arus_kas_operasi },
                  ]},
                ].map(section => (
                  <div key={section.title} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px' }}>
                    <p style={{ fontSize: 10.5, color: '#828d96', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, margin: '0 0 14px' }}>
                      {section.title}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {section.items.map(({ label, val }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                          <span style={{ color: '#aab4bc' }}>{label}</span>
                          <span style={{ color: '#eef2ef', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                            {val != null ? val.toLocaleString('id-ID') : '–'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepCard({ num, title, done, active, loading, children }: {
  num: number; title: string; done?: boolean; active?: boolean; loading?: boolean; children: React.ReactNode
}) {
  const borderColor = done ? 'rgba(69,230,97,0.25)' : active || loading ? 'rgba(255,190,80,0.2)' : 'rgba(255,255,255,0.06)'
  return (
    <div style={{ background: 'rgba(8,12,18,0.85)', border: `1px solid ${borderColor}`, borderRadius: 20, padding: '22px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: done ? 'rgba(69,230,97,0.15)' : 'rgba(255,255,255,0.06)', color: done ? '#45e661' : '#828d96', border: `1px solid ${done ? 'rgba(69,230,97,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
          {done ? '✓' : num}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: done ? '#45e661' : active || loading ? '#eef2ef' : '#828d96' }}>{title}</span>
      </div>
      <div style={{ paddingLeft: 40 }}>{children}</div>
    </div>
  )
}
