'use client'

import { useState, useEffect, useRef } from 'react'
import Navbar from '@/components/oasis/Navbar'
import { KYIC_BABS, BabId } from '@/lib/kyic-sections'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KySession {
  id: string
  kode: string
  nama_entitas: string
  jenis_usaha: string
  periode: string
  status: string
  template_nama?: string
  template_text?: string
  template_sections?: Record<string, string>
  created_at: string
}

interface KyAnalisis {
  id: string
  bab_id: BabId
  status: 'pending' | 'analyzing' | 'done' | 'error'
  catatan_pengawas: string
  hasil_json: Record<string, unknown> | null
  analyzed_at: string | null
}

interface KyDokumen {
  id: string
  bab_id: BabId
  nama_file: string
  uploaded_at: string
}

interface SessionDetail {
  session: KySession
  analisis: KyAnalisis[]
  dokumen: KyDokumen[]
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: '#828d96',
  analyzing: '#45e661',
  done: '#45e661',
  error: '#ff6f61',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Belum Dianalisis',
  analyzing: 'Sedang Dianalisis...',
  done: 'Selesai',
  error: 'Error',
}
const PRIORITAS_COLORS: Record<string, string> = {
  tinggi: '#ff6f61',
  sedang: '#ffbe50',
  opsional: '#828d96',
}

// ─── Component Utama ─────────────────────────────────────────────────────────

export default function KyicV2Page() {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list')
  const [sessions, setSessions] = useState<KySession[]>([])
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [activeBab, setActiveBab] = useState<BabId>(KYIC_BABS[0].id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Form state untuk sesi baru
  const [formNama, setFormNama] = useState('')
  const [formJenis, setFormJenis] = useState('')
  const [formPeriode, setFormPeriode] = useState('')
  const [formKode, setFormKode] = useState('')
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [uploadingTemplate, setUploadingTemplate] = useState(false)

  // Per-BAB state
  const [babFiles, setBabFiles] = useState<File[]>([])
  const [babCatatan, setBabCatatan] = useState<Record<BabId, string>>({} as Record<BabId, string>)
  const [uploadingBab, setUploadingBab] = useState(false)
  const [analyzingBab, setAnalyzingBab] = useState<BabId | null>(null)
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showBaseline, setShowBaseline] = useState(true)

  // ─── Data fetching ──────────────────────────────────────────────────────

  async function loadSessions() {
    const res = await fetch('/api/kyic/v2/session')
    if (res.ok) setSessions(await res.json())
  }

  async function loadDetail(id: string) {
    setLoading(true)
    const res = await fetch(`/api/kyic/v2/session/${id}`)
    if (res.ok) setDetail(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadSessions() }, [])

  // Polling saat ada BAB yang sedang analyzing
  useEffect(() => {
    if (!detail) return
    const anyAnalyzing = detail.analisis.some(a => a.status === 'analyzing')
    if (anyAnalyzing) {
      pollingRef.current = setInterval(async () => {
        const res = await fetch(`/api/kyic/v2/session/${detail.session.id}`)
        if (res.ok) {
          const data: SessionDetail = await res.json()
          setDetail(data)
          if (!data.analisis.some(a => a.status === 'analyzing')) {
            clearInterval(pollingRef.current!)
          }
        }
      }, 4000)
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [detail?.analisis.map(a => a.status).join(',')])

  // ─── Handlers ──────────────────────────────────────────────────────────

  async function createSession() {
    if (!formNama || !formJenis || !formPeriode || !formKode) {
      setError('Semua field wajib diisi'); return
    }
    setLoading(true); setError(null)

    const res = await fetch('/api/kyic/v2/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama_entitas: formNama, jenis_usaha: formJenis, periode: formPeriode, kode: formKode }),
    })
    if (!res.ok) { setError((await res.json()).error); setLoading(false); return }

    const sess: KySession = await res.json()
    await loadSessions()
    await loadDetail(sess.id)
    setView('detail')
    setActiveBab(KYIC_BABS[0].id)
    setLoading(false)
  }

  async function uploadTemplate(sessionId: string, file: File) {
    setUploadingTemplate(true)
    setError(null)
    try {
      const SIZE_LIMIT = 3 * 1024 * 1024 // 3MB — stay safely under Vercel's 4.5MB body limit

      if (file.size > SIZE_LIMIT) {
        // Large file: upload directly to Supabase Storage, then call API with path
        const signRes = await fetch(`/api/kyic/v2/session/${sessionId}/upload-signed-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name }),
        })
        if (!signRes.ok) { setError('Gagal mendapatkan upload URL'); return }
        const { signedUrl, storagePath } = await signRes.json()

        // Upload langsung ke Supabase Storage
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!uploadRes.ok) { setError('Gagal mengupload file ke storage'); return }

        // Minta server proses dari storage
        const processRes = await fetch(`/api/kyic/v2/session/${sessionId}/upload-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePath, fileName: file.name }),
        })
        if (!processRes.ok) setError('Gagal memproses template')
        else await loadDetail(sessionId)
      } else {
        // Small file: kirim langsung via FormData
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`/api/kyic/v2/session/${sessionId}/upload-template`, { method: 'POST', body: fd })
        if (!res.ok) setError('Gagal upload template')
        else await loadDetail(sessionId)
      }
    } finally {
      setUploadingTemplate(false)
    }
  }

  async function uploadBabDocs(sessionId: string, babId: BabId, files: File[]) {
    if (!files.length) return
    setUploadingBab(true)
    const fd = new FormData()
    files.forEach(f => fd.append('file', f))
    await fetch(`/api/kyic/v2/session/${sessionId}/bab/${babId}/upload`, { method: 'POST', body: fd })
    await loadDetail(sessionId)
    setBabFiles([])
    setUploadingBab(false)
  }

  async function deleteBabDoc(sessionId: string, babId: BabId, dokId: string) {
    await fetch(`/api/kyic/v2/session/${sessionId}/bab/${babId}/upload`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dokId }),
    })
    await loadDetail(sessionId)
  }

  async function deleteSession(id: string) {
    setDeletingId(id)
    await fetch(`/api/kyic/v2/session/${id}/delete`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    setDeletingId(null)
    await loadSessions()
  }

  async function analyzeBab(sessionId: string, babId: BabId) {
    setAnalyzingBab(babId)
    const res = await fetch(`/api/kyic/v2/session/${sessionId}/bab/${babId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catatan_pengawas: babCatatan[babId] ?? '' }),
    })
    if (!res.ok) { setError('Gagal memulai analisis'); setAnalyzingBab(null); return }
    await loadDetail(sessionId)
    setAnalyzingBab(null)
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  function getBabStatus(babId: BabId): KyAnalisis['status'] {
    return detail?.analisis.find(a => a.bab_id === babId)?.status ?? 'pending'
  }

  function getBabAnalisis(babId: BabId): KyAnalisis | undefined {
    return detail?.analisis.find(a => a.bab_id === babId)
  }

  function getBabDokumen(babId: BabId): KyDokumen[] {
    return detail?.dokumen.filter(d => d.bab_id === babId) ?? []
  }

  const doneCount = detail ? KYIC_BABS.filter(b => getBabStatus(b.id) === 'done').length : 0
  const currentBab = KYIC_BABS.find(b => b.id === activeBab)!
  const currentAnalisis = getBabAnalisis(activeBab)
  const currentDokumen = getBabDokumen(activeBab)
  const currentStatus = getBabStatus(activeBab)
  const baselineText = detail?.session.template_sections?.[activeBab] ?? null
  const hasPdfTemplate = !!(detail?.session as unknown as Record<string, unknown>)?.template_storage_path

  // ─── Render: Session List ───────────────────────────────────────────────

  if (view === 'list') return (
    <div style={{ minHeight: '100vh', background: '#080c12', color: '#eef2ef', fontFamily: 'var(--font-sans, system-ui)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 0' }}><Navbar simple /></div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 20px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>KYIC — Know Your Insurance Company</h1>
            <p style={{ color: '#828d96', fontSize: 13 }}>Analisis per-BAB berbasis dokumen & catatan pengawas</p>
          </div>
          <button onClick={() => { setView('new'); setError(null) }}
            style={{ padding: '10px 20px', background: 'rgba(69,230,97,0.12)', color: '#45e661', border: '1px solid rgba(69,230,97,0.3)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            + Sesi Baru
          </button>
        </div>

        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#828d96' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>Belum ada sesi KYIC</p>
            <p style={{ fontSize: 13 }}>Buat sesi baru untuk mulai analisis</p>
          </div>
        ) : sessions.map(s => (
          <div key={s.id}
            style={{ background: 'rgba(8,12,18,0.85)', border: `1px solid ${confirmDeleteId === s.id ? 'rgba(255,111,97,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '16px 20px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onMouseEnter={e => { if (confirmDeleteId !== s.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
            onMouseLeave={e => { if (confirmDeleteId !== s.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
            <div style={{ cursor: 'pointer', flex: 1 }} onClick={async () => { await loadDetail(s.id); setActiveBab(KYIC_BABS[0].id); setView('detail') }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>{s.nama_entitas}</p>
              <p style={{ fontSize: 12, color: '#828d96' }}>{s.kode} · {s.periode} · {s.jenis_usaha}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#aab4bc' }}>
                {s.status}
              </span>
              {confirmDeleteId === s.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => deleteSession(s.id)} disabled={deletingId === s.id}
                    style={{ padding: '5px 12px', background: 'rgba(255,111,97,0.15)', color: '#ff6f61', border: '1px solid rgba(255,111,97,0.3)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                    {deletingId === s.id ? '...' : 'Hapus'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                    style={{ padding: '5px 10px', background: 'transparent', color: '#828d96', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                    Batal
                  </button>
                </div>
              ) : (
                <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(s.id) }}
                  style={{ padding: '5px 10px', background: 'transparent', color: '#828d96', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}
                  title="Hapus sesi">
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ─── Render: Form Sesi Baru ─────────────────────────────────────────────

  if (view === 'new') return (
    <div style={{ minHeight: '100vh', background: '#080c12', color: '#eef2ef', fontFamily: 'var(--font-sans, system-ui)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 0' }}><Navbar simple /></div>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px 40px' }}>
        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: '#828d96', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 24 }}>← Kembali ke Daftar Sesi</button>

        <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Sesi KYIC Baru</h2>

          {error && (
            <div style={{ background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#ff6f61' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Kode Pemeriksaan', value: formKode, set: setFormKode, placeholder: 'cth: ASYKI-2025', hint: 'Kode unik sesi ini', full: false },
              { label: 'Periode Penilaian', value: formPeriode, set: setFormPeriode, placeholder: 'cth: 31 Desember 2025', hint: '', full: false },
              { label: 'Nama Entitas', value: formNama, set: setFormNama, placeholder: 'cth: PT Asuransi Syariah Keluarga Indonesia', hint: '', full: true },
              { label: 'Jenis Usaha', value: formJenis, set: setFormJenis, placeholder: 'cth: Asuransi Jiwa Syariah', hint: 'Menentukan POJK yang digunakan', full: true },
            ].map(f => (
              <div key={f.label} style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}>
                <label style={{ fontSize: 11, color: '#828d96', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</label>
                <input
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#eef2ef', padding: '8px 0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                {f.hint && <p style={{ fontSize: 11, color: '#828d96', marginTop: 4 }}>{f.hint}</p>}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={createSession} disabled={loading}
              style={{ padding: '10px 24px', background: 'rgba(69,230,97,0.1)', color: '#45e661', border: '1px solid rgba(69,230,97,0.25)', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Membuat...' : 'Buat Sesi →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Render: Detail Sesi ────────────────────────────────────────────────

  if (!detail) return null

  const hasilJson = currentAnalisis?.hasil_json as Record<string, unknown> | null
  const findings = Array.isArray(hasilJson?.findings) ? (hasilJson!.findings as {judul:string;uraian:string;urgensi:string}[]) : []
  const subSections = hasilJson?.sub_sections as Record<string, string> | undefined
  const ringkasan = hasilJson?.ringkasan ? String(hasilJson.ringkasan) : null
  const perubahan = hasilJson?.perubahan_vs_T1 ? String(hasilJson.perubahan_vs_T1) : null
  const rekomendasi = hasilJson?.rekomendasi ? String(hasilJson.rekomendasi) : null
  const draftTeks = hasilJson?.draft_teks ? String(hasilJson.draft_teks) : null

  return (
    <div style={{ minHeight: '100vh', background: '#080c12', color: '#eef2ef', fontFamily: 'var(--font-sans, system-ui)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 20px 0' }}><Navbar simple /></div>
      <div style={{ display: 'flex', maxWidth: 1280, margin: '0 auto' }}>

        {/* ─── Sidebar BAB Navigator ─── */}
        <div style={{ width: 260, flexShrink: 0, padding: '8px 0 24px 20px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{detail.session.nama_entitas}</p>
          <p style={{ fontSize: 11, color: '#828d96', marginBottom: 4 }}>{detail.session.kode} · {detail.session.periode}</p>

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#828d96', marginBottom: 4 }}>
              <span>Progress</span><span>{doneCount}/{KYIC_BABS.length} BAB</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
              <div style={{ height: 4, background: '#45e661', borderRadius: 2, width: `${(doneCount / KYIC_BABS.length) * 100}%`, transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Template KYIC T-1 */}
          <div style={{ marginBottom: 20, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 11, color: '#aab4bc', marginBottom: 8 }}>KYIC Template (T-1)</p>
            {uploadingTemplate ? (
              <p style={{ fontSize: 11, color: '#828d96' }}>⏳ Menyimpan template...</p>
            ) : detail.session.template_nama ? (
              <div>
                <p style={{ fontSize: 11, color: '#45e661', marginBottom: 6 }}>✓ {detail.session.template_nama}</p>
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept=".docx,.pdf" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setTemplateFile(f); uploadTemplate(detail.session.id, f) } }} />
                  <span style={{ fontSize: 11, color: '#828d96', cursor: 'pointer', textDecoration: 'underline' }}>
                    Ganti template
                  </span>
                </label>
              </div>
            ) : (
              <label style={{ cursor: 'pointer' }}>
                <input type="file" accept=".docx,.pdf" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setTemplateFile(f); uploadTemplate(detail.session.id, f) } }} />
                <span style={{ fontSize: 11, color: '#ffbe50', cursor: 'pointer' }}>
                  ⚠ Upload template KYIC T-1
                </span>
              </label>
            )}
          </div>

          {/* BAB list */}
          {KYIC_BABS.map(bab => {
            const status = getBabStatus(bab.id)
            const hasBaseline = !!detail?.session.template_sections?.[bab.id]
            const isActive = activeBab === bab.id
            return (
              <button key={bab.id} onClick={() => { setActiveBab(bab.id); setBabFiles([]); setExpandedFinding(null); setShowBaseline(true) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 4,
                  background: isActive ? 'rgba(69,230,97,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(69,230,97,0.2)' : '1px solid transparent',
                  borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#eef2ef' : '#aab4bc' }}>
                    {bab.nomor}. {bab.judul.length > 28 ? bab.judul.slice(0, 28) + '…' : bab.judul}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                    {(hasBaseline || hasPdfTemplate) && status === 'pending' && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,190,80,0.6)' }} title="Ada template T-1" />
                    )}
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status] }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ─── Main Content ─── */}
        <div style={{ flex: 1, padding: '24px 20px 60px 24px', minWidth: 0 }}>

          {/* BAB Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>BAB {currentBab.nomor} — {currentBab.judul}</h2>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: `${STATUS_COLORS[currentStatus]}18`, color: STATUS_COLORS[currentStatus], border: `1px solid ${STATUS_COLORS[currentStatus]}40` }}>
                {STATUS_LABELS[currentStatus]}
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#828d96' }}>{currentBab.deskripsi}</p>
          </div>

          {/* Info box: PDF T-1 tersedia, baseline akan dibaca saat analisis */}
          {hasPdfTemplate && !baselineText && currentStatus === 'pending' && (
            <div style={{ background: 'rgba(69,230,97,0.05)', border: '1px solid rgba(69,230,97,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#45e661', marginBottom: 2 }}>Template KYIC T-1 (PDF) tersedia</p>
                <p style={{ fontSize: 12, color: '#828d96' }}>Data baseline T-1 akan dibaca langsung dari PDF saat analisis dijalankan. Klik <strong style={{ color: '#aab4bc' }}>▶ Analisis BAB Ini</strong> untuk mulai.</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

            {/* ─── Upload Dokumen Pendukung ─── */}
            <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Dokumen Pendukung</p>

              {/* Drag & drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); setBabFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]) }}
                style={{ border: `2px dashed ${dragOver ? 'rgba(69,230,97,0.5)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, padding: '14px 12px', textAlign: 'center', marginBottom: 12, transition: 'border-color 0.2s', background: dragOver ? 'rgba(69,230,97,0.04)' : 'transparent', cursor: 'pointer' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.xlsm,.pptx,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={e => setBabFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                  <p style={{ fontSize: 12, color: '#aab4bc' }}>Drop files atau <span style={{ color: '#45e661' }}>browse</span></p>
                  <p style={{ fontSize: 11, color: '#828d96', marginTop: 4 }}>PDF, Word, Excel, PPT, gambar</p>
                </label>
              </div>

              {/* Files yang sudah dipilih tapi belum diupload */}
              {babFiles.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {babFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#aab4bc', padding: '4px 0' }}>
                      <span>📄 {f.name}</span>
                      <button onClick={() => setBabFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ff6f61', cursor: 'pointer', fontSize: 11 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => uploadBabDocs(detail.session.id, activeBab, babFiles)} disabled={uploadingBab}
                    style={{ marginTop: 8, width: '100%', padding: '7px 0', background: 'rgba(69,230,97,0.1)', color: '#45e661', border: '1px solid rgba(69,230,97,0.25)', borderRadius: 7, cursor: uploadingBab ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                    {uploadingBab ? 'Mengupload...' : `Upload ${babFiles.length} file`}
                  </button>
                </div>
              )}

              {/* Files yang sudah terupload */}
              {currentDokumen.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                  <p style={{ fontSize: 11, color: '#828d96', marginBottom: 6 }}>Terupload ({currentDokumen.length})</p>
                  {currentDokumen.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#aab4bc', padding: '3px 0' }}>
                      <span>✓ {d.nama_file}</span>
                      <button onClick={() => deleteBabDoc(detail.session.id, activeBab, d.id)} style={{ background: 'none', border: 'none', color: '#828d96', cursor: 'pointer', fontSize: 11 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Hint Dokumen Pendukung ─── */}
            <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>💡 Dokumen Disarankan</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentBab.doc_hints.map((hint, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `3px solid ${PRIORITAS_COLORS[hint.prioritas]}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#eef2ef', margin: 0 }}>{hint.nama}</p>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: `${PRIORITAS_COLORS[hint.prioritas]}18`, color: PRIORITAS_COLORS[hint.prioritas], whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {hint.prioritas}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: '#828d96', margin: '3px 0 0 0' }}>{hint.keterangan}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Catatan Pengawas ─── */}
          <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Catatan Pengawas <span style={{ fontSize: 11, color: '#828d96', fontWeight: 400 }}>(untuk mempertajam analisis AI)</span></p>
            <textarea
              rows={4}
              value={babCatatan[activeBab] ?? currentAnalisis?.catatan_pengawas ?? ''}
              onChange={e => setBabCatatan(prev => ({ ...prev, [activeBab]: e.target.value }))}
              placeholder={`Tambahkan konteks khusus untuk BAB ${currentBab.nomor} ini...\nContoh: "Komisaris X baru bergabung Maret 2025", "Komite Investasi belum pernah rapat sepanjang 2024"`}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#eef2ef', padding: '8px 0', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
            />
          </div>

          {/* ─── Baseline T-1 ─── */}
          {baselineText && (
            <div style={{ background: 'rgba(255,190,80,0.04)', border: '1px solid rgba(255,190,80,0.18)', borderRadius: 14, marginBottom: 16, overflow: 'hidden' }}>
              <button
                onClick={() => setShowBaseline(v => !v)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,190,80,0.15)', color: '#ffbe50', border: '1px solid rgba(255,190,80,0.3)', fontWeight: 600 }}>T-1</span>
                  <span style={{ fontSize: 13, color: '#ffbe50', fontWeight: 600 }}>Data KYIC Periode Lalu</span>
                  <span style={{ fontSize: 11, color: '#828d96' }}>— sebagai baseline analisis baru</span>
                </div>
                <span style={{ fontSize: 12, color: '#828d96' }}>{showBaseline ? '▲ Sembunyikan' : '▼ Tampilkan'}</span>
              </button>
              {showBaseline && (
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px', maxHeight: 320, overflowY: 'auto' }}>
                    <pre style={{ fontSize: 12, color: '#aab4bc', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                      {baselineText}
                    </pre>
                  </div>
                  <p style={{ fontSize: 11, color: '#828d96', marginTop: 8 }}>
                    💡 Upload dokumen baru dan/atau isi catatan pengawas di atas, lalu klik Analisis untuk memperbarui bagian ini.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── Tombol Analisis ─── */}
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => analyzeBab(detail.session.id, activeBab)}
              disabled={currentStatus === 'analyzing' || analyzingBab === activeBab || !detail.session.template_text}
              style={{
                padding: '12px 28px', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: !detail.session.template_text ? 'rgba(255,255,255,0.04)' : currentStatus === 'analyzing' ? 'rgba(69,230,97,0.06)' : 'rgba(69,230,97,0.12)',
                color: !detail.session.template_text ? '#828d96' : '#45e661',
                border: !detail.session.template_text ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(69,230,97,0.3)',
              }}>
              {!detail.session.template_text ? '⚠ Upload KYIC T-1 dulu' : currentStatus === 'analyzing' ? '⏳ Sedang Menganalisis...' : currentStatus === 'done' ? '🔄 Analisis Ulang' : '▶ Analisis BAB Ini'}
            </button>
            {currentStatus === 'analyzing' && (
              <span style={{ marginLeft: 12, fontSize: 12, color: '#828d96' }}>Proses berjalan di background, halaman akan otomatis update...</span>
            )}
          </div>

          {/* ─── Hasil Analisis ─── */}
          {currentAnalisis?.status === 'done' && hasilJson && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Ringkasan */}
              {ringkasan && (
                <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                  <p style={{ fontSize: 12, color: '#828d96', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Ringkasan</p>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#eef2ef' }}>{ringkasan}</p>
                  {perubahan && (
                    <p style={{ fontSize: 12, color: '#aab4bc', marginTop: 8, fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      Perubahan vs T-1: {perubahan}
                    </p>
                  )}
                </div>
              )}

              {/* Sub-sections */}
              {subSections && Object.keys(subSections).length > 0 && (
                <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                  <p style={{ fontSize: 12, color: '#828d96', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Detail per Sub-Section</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(subSections).map(([key, val]) => (
                      <div key={key} style={{ borderLeft: '2px solid rgba(255,255,255,0.12)', paddingLeft: 12 }}>
                        <p style={{ fontSize: 12, color: '#aab4bc', marginBottom: 4, fontWeight: 600 }}>{key}</p>
                        <p style={{ fontSize: 13, color: '#eef2ef', lineHeight: 1.65 }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Findings */}
              {findings.length > 0 && (
                <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                  <p style={{ fontSize: 12, color: '#828d96', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Findings ({findings.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {findings.map((f, i) => (
                      <div key={i}
                        onClick={() => setExpandedFinding(expandedFinding === i ? null : i)}
                        style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, cursor: 'pointer', border: `1px solid ${f.urgensi === 'tinggi' ? 'rgba(255,111,97,0.25)' : f.urgensi === 'sedang' ? 'rgba(255,190,80,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>{f.judul}</p>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: `${f.urgensi === 'tinggi' ? 'rgba(255,111,97,0.15)' : f.urgensi === 'sedang' ? 'rgba(255,190,80,0.12)' : 'rgba(255,255,255,0.06)'}`, color: f.urgensi === 'tinggi' ? '#ff6f61' : f.urgensi === 'sedang' ? '#ffbe50' : '#aab4bc' }}>
                            {f.urgensi}
                          </span>
                        </div>
                        {expandedFinding === i && (
                          <p style={{ fontSize: 12, color: '#aab4bc', marginTop: 8, lineHeight: 1.65 }}>{f.uraian}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rekomendasi */}
              {rekomendasi && (
                <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(69,230,97,0.15)', borderRadius: 14, padding: 16 }}>
                  <p style={{ fontSize: 12, color: '#45e661', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Rekomendasi</p>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: '#eef2ef' }}>{rekomendasi}</p>
                </div>
              )}

              {/* Draft Teks */}
              {draftTeks && (
                <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: '#828d96', textTransform: 'uppercase', letterSpacing: 1 }}>Draft Teks KYIC</p>
                    <button onClick={() => navigator.clipboard.writeText(draftTeks)}
                      style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#aab4bc', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Salin
                    </button>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.75, color: '#eef2ef', whiteSpace: 'pre-wrap' }}>{draftTeks}</p>
                </div>
              )}
            </div>
          )}

          {currentAnalisis?.status === 'error' && (
            <div style={{ background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.25)', borderRadius: 12, padding: 16, color: '#ff6f61', fontSize: 13 }}>
              Analisis gagal. Coba klik "Analisis BAB Ini" kembali.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
