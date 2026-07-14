'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/oasis/Navbar'

// ── Types ────────────────────────────────────────────────────────────────────

type Session = { kode: string; nama_entitas: string; jenis_usaha: string; created_at: string }
type Dokumen  = { id: string; kode: string; departemen: string; nama_file: string; fokus: string; status: string; ringkasan: string; created_at: string }
type Wawancara = { id: string; kode: string; departemen: string; nama_file: string; fokus: string; status: string; ringkasan: string; created_at: string }
type Temuan   = {
  id: string; kode: string; judul: string; uraian: string
  urgensi: 'kritis' | 'signifikan' | 'perlu_perhatian'
  sifat: 'pelanggaran_ketentuan' | 'potensi_pelanggaran' | 'perlu_perbaikan'
  kluster: string; kluster_nama: string; pasal_terkait: string[]
  rekomendasi: string; sumber_tipe: string; sumber_nama: string
  tipe_analisis: 'risk_based' | 'compliance'
  status: string; catatan_pengawas: string | null; created_at: string
}
type Stats = { dokumen: number; wawancara: number; temuan: number; kritis: number; dikonfirmasi: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPARTEMEN = [
  'Tata Kelola / GCG', 'Keuangan', 'Aktuaria', 'Investasi',
  'SDM & Umum', 'Produk & Pemasaran', 'Keagenan', 'APU-PPT',
  'Teknologi Informasi (IT)', 'Kepatuhan & Hukum', 'Underwriting & Klaim', 'Lainnya',
]

const KLUSTER_LIST = [
  { kode: 'A', nama: 'Risiko Asuransi' }, { kode: 'B', nama: 'SDM & Kelembagaan' },
  { kode: 'C', nama: 'Pemasaran & Keagenan' }, { kode: 'D', nama: 'Keuangan' },
  { kode: 'E', nama: 'Tata Kelola (GCG)' }, { kode: 'F', nama: 'APU-PPT' },
  { kode: 'G', nama: 'Investasi' }, { kode: 'H', nama: 'MRTI (TI)' },
]

const URGENSI_COLOR: Record<string, string> = {
  kritis: 'text-red-400 bg-red-900/30 border-red-800/50',
  signifikan: 'text-orange-400 bg-orange-900/30 border-orange-800/50',
  perlu_perhatian: 'text-green-400 bg-green-900/30 border-green-800/50',
}
const URGENSI_LABEL: Record<string, string> = {
  kritis: 'Kritis', signifikan: 'Signifikan', perlu_perhatian: 'Perlu Perhatian',
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { kode } = useParams<{ kode: string }>()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [dokumen, setDokumen] = useState<Dokumen[]>([])
  const [wawancara, setWawancara] = useState<Wawancara[]>([])
  const [temuan, setTemuan] = useState<Temuan[]>([])
  const [stats, setStats] = useState<Stats>({ dokumen: 0, wawancara: 0, temuan: 0, kritis: 0, dikonfirmasi: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dokumen' | 'wawancara' | 'temuan'>('dokumen')

  const load = useCallback(async () => {
    const res = await fetch(`/api/onsite/sessions/${kode}`)
    if (!res.ok) { router.push('/pemeriksaan'); return }
    const d = await res.json()
    setSession(d.session)
    setDokumen(d.dokumen)
    setWawancara(d.wawancara)
    setTemuan(d.temuan)
    setStats(d.stats)
    setLoading(false)
  }, [kode, router])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#8a949c', fontSize: 13 }}>Memuat sesi...</p>
    </div>
  )
  if (!session) return null

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 8px', width: '100%', boxSizing: 'border-box' }}>
        <Navbar />

        {/* Session header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#45e661', letterSpacing: '0.15em' }}>{kode}</div>
            <h1 style={{ fontSize: 26, fontWeight: 500, margin: '6px 0 0' }}>{session.nama_entitas}</h1>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 400, color: '#ff6f61' }}>{stats.kritis}</div>
              <div style={{ fontSize: 10.5, color: '#8a949c' }}>Kritis</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 400, color: '#45e661' }}>{stats.dikonfirmasi}</div>
              <div style={{ fontSize: 10.5, color: '#8a949c' }}>Dikonfirmasi</div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 26, borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '26px 0 0' }}>
          {([
            ['dokumen', 'Dokumen', stats.dokumen],
            ['wawancara', 'Wawancara', stats.wawancara],
            ['temuan', 'Temuan', stats.temuan],
          ] as const).map(([key, label, count]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 14px', fontSize: 13, fontWeight: 500, color: activeTab === key ? '#eef2ef' : '#5a646c', borderBottom: `1px solid ${activeTab === key ? '#45e661' : 'transparent'}`, fontFamily: 'inherit' }}>
              {label} <span style={{ color: '#5a646c', marginLeft: 4 }}>({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', maxWidth: 1200, margin: '0 auto', width: '100%', padding: '0 24px 48px', boxSizing: 'border-box' }}>
        {activeTab === 'dokumen' && <TabDokumen kode={kode} items={dokumen} onRefresh={load} />}
        {activeTab === 'wawancara' && <TabWawancara kode={kode} items={wawancara} onRefresh={load} />}
        {activeTab === 'temuan' && <TabTemuan items={temuan} onRefresh={load} />}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 500, fontSize: 13, color }}>{value}</span>
      <span style={{ color: '#5a646c', fontSize: 11 }}>{label}</span>
    </div>
  )
}

function StatBar({ label, value, icon, onClick, active }: { label: string; value: number; icon: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: active ? '#eef2ef' : '#5a646c', fontFamily: 'inherit', fontSize: 13 }}>
      <span>{icon}</span>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: active ? '#45e661' : 'rgba(255,255,255,0.06)', color: active ? '#04120a' : '#5a646c' }}>{value}</span>
    </button>
  )
}

// ── Tab Dokumen ───────────────────────────────────────────────────────────────

function TabDokumen({ kode, items, onRefresh }: { kode: string; items: Dokumen[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [departemen, setDepartemen] = useState(DEPARTEMEN[0])
  const [fokus, setFokus] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('kode', kode)
      fd.append('departemen', departemen)
      fd.append('fokus', fokus)
      fd.append('file', file)
      const res = await fetch('/api/onsite/dokumen', { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      setFile(null); setFokus('')
      if (fileRef.current) fileRef.current.value = ''
      await onRefresh()
    } catch { setError('Gagal upload') }
    finally { setUploading(false) }
  }

  const panelStyle: React.CSSProperties = { width: 300, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#8a949c', marginBottom: 6, display: 'block' }
  const selectStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#eef2ef', padding: '8px 0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const textareaStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#eef2ef', padding: '8px 0', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none' }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={panelStyle}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Upload Dokumen Pemeriksaan</div>

        <div>
          <label style={labelStyle}>Departemen</label>
          <select value={departemen} onChange={e => setDepartemen(e.target.value)} style={selectStyle}>
            {DEPARTEMEN.map(d => <option key={d} style={{ background: '#0d1117' }}>{d}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>File Dokumen</label>
          <div onClick={() => fileRef.current?.click()} style={{ border: '1px dashed rgba(69,230,97,0.3)', borderRadius: 12, padding: 16, textAlign: 'center', cursor: 'pointer' }}>
            {file ? (
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{file.name}</p>
                <p style={{ fontSize: 11, color: '#8a949c', marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#5a646c' }}>Klik untuk pilih file<br/><span style={{ fontSize: 11 }}>PDF, DOCX, TXT — maks 20MB</span></p>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <div>
          <label style={labelStyle}>Fokus Analisis <span style={{ color: '#5a646c' }}>opsional</span></label>
          <textarea value={fokus} onChange={e => setFokus(e.target.value)} rows={3}
            placeholder="Contoh: fokus pada kesesuaian struktur organisasi..." style={textareaStyle} />
        </div>

        {error && <p style={{ color: '#ff6f61', fontSize: 12 }}>{error}</p>}

        <button onClick={handleUpload} disabled={!file || uploading}
          style={{ background: file && !uploading ? '#45e661' : 'rgba(255,255,255,0.06)', color: file && !uploading ? '#04120a' : '#5a646c', border: 'none', borderRadius: 999, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: file && !uploading ? 'pointer' : 'default', fontFamily: 'inherit', width: '100%' }}>
          {uploading ? 'Menganalisis...' : 'Mulai Analisis'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {items.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5a646c', fontSize: 13 }}>
            Belum ada dokumen. Upload dokumen untuk memulai analisis.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(dok => (
              <div key={dok.id} style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#8a949c' }}>{dok.departemen}</span>
                      <StatusBadge status={dok.status} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dok.nama_file}</p>
                    {dok.fokus && <p style={{ fontSize: 11, color: '#5a646c', marginTop: 2 }}>Fokus: {dok.fokus}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {dok.status === 'done' && (
                      <button onClick={() => setExpanded(expanded === dok.id ? null : dok.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#45e661', fontFamily: 'inherit' }}>
                        {expanded === dok.id ? '▲' : '▼'}
                      </button>
                    )}
                    <button onClick={async () => {
                      if (!confirm(`Hapus dokumen "${dok.nama_file}" dan semua temuannya?`)) return
                      await fetch(`/api/onsite/dokumen/${dok.id}`, { method: 'DELETE' })
                      await onRefresh()
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#5a646c', fontFamily: 'inherit' }} title="Hapus">✕</button>
                  </div>
                </div>
                {expanded === dok.id && (
                  <p style={{ fontSize: 12, color: '#8a949c', marginTop: 12, lineHeight: 1.7, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    {dok.ringkasan || <span style={{ fontStyle: 'italic', color: '#5a646c' }}>Ringkasan tidak tersedia</span>}
                  </p>
                )}
                <p style={{ fontSize: 11, color: '#5a646c', marginTop: 8 }}>{new Date(dok.created_at).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab Wawancara ─────────────────────────────────────────────────────────────

function TabWawancara({ kode, items, onRefresh }: { kode: string; items: Wawancara[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [departemen, setDepartemen] = useState(DEPARTEMEN[0])
  const [fokus, setFokus] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('kode', kode)
      fd.append('departemen', departemen)
      fd.append('fokus', fokus)
      fd.append('file', file)
      const res = await fetch('/api/onsite/wawancara', { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      setFile(null); setFokus('')
      if (fileRef.current) fileRef.current.value = ''
      await onRefresh()
    } catch { setError('Gagal upload') }
    finally { setUploading(false) }
  }

  const panelStyle: React.CSSProperties = { width: 300, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#8a949c', marginBottom: 6, display: 'block' }
  const selectStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#eef2ef', padding: '8px 0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const textareaStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#eef2ef', padding: '8px 0', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none' }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={panelStyle}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Upload Catatan / Bahan Tayang Wawancara</div>

        <div>
          <label style={labelStyle}>Departemen yang Diwawancara</label>
          <select value={departemen} onChange={e => setDepartemen(e.target.value)} style={selectStyle}>
            {DEPARTEMEN.map(d => <option key={d} style={{ background: '#0d1117' }}>{d}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>File Catatan / Paparan</label>
          <div onClick={() => fileRef.current?.click()} style={{ border: '1px dashed rgba(69,230,97,0.3)', borderRadius: 12, padding: 16, textAlign: 'center', cursor: 'pointer' }}>
            {file ? (
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{file.name}</p>
                <p style={{ fontSize: 11, color: '#8a949c', marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#5a646c' }}>Klik untuk pilih file<br/><span style={{ fontSize: 11 }}>PDF, DOCX, PPTX, TXT</span></p>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.pptx,.txt" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <div>
          <label style={labelStyle}>Fokus Analisis <span style={{ color: '#5a646c' }}>opsional</span></label>
          <textarea value={fokus} onChange={e => setFokus(e.target.value)} rows={3}
            placeholder="Contoh: perhatikan konsistensi jawaban dengan laporan keuangan..." style={textareaStyle} />
        </div>

        {error && <p style={{ color: '#ff6f61', fontSize: 12 }}>{error}</p>}

        <button onClick={handleUpload} disabled={!file || uploading}
          style={{ background: file && !uploading ? '#45e661' : 'rgba(255,255,255,0.06)', color: file && !uploading ? '#04120a' : '#5a646c', border: 'none', borderRadius: 999, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: file && !uploading ? 'pointer' : 'default', fontFamily: 'inherit', width: '100%' }}>
          {uploading ? 'Menganalisis...' : 'Mulai Analisis Wawancara'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {items.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5a646c', fontSize: 13 }}>
            Belum ada wawancara. Upload catatan atau bahan tayang untuk dianalisis.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(w => (
              <div key={w.id} style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#8a949c' }}>{w.departemen}</span>
                      <StatusBadge status={w.status} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.nama_file}</p>
                    {w.fokus && <p style={{ fontSize: 11, color: '#5a646c', marginTop: 2 }}>Fokus: {w.fokus}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {w.status === 'done' && (
                      <button onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#45e661', fontFamily: 'inherit' }}>
                        {expanded === w.id ? '▲' : '▼'}
                      </button>
                    )}
                    <button onClick={async () => {
                      if (!confirm(`Hapus wawancara "${w.nama_file}" dan semua temuannya?`)) return
                      await fetch(`/api/onsite/wawancara/${w.id}`, { method: 'DELETE' })
                      await onRefresh()
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#5a646c', fontFamily: 'inherit' }} title="Hapus">✕</button>
                  </div>
                </div>
                {expanded === w.id && (
                  <p style={{ fontSize: 12, color: '#8a949c', marginTop: 12, lineHeight: 1.7, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    {w.ringkasan || <span style={{ fontStyle: 'italic', color: '#5a646c' }}>Ringkasan tidak tersedia — coba upload ulang file</span>}
                  </p>
                )}
                <p style={{ fontSize: 11, color: '#5a646c', marginTop: 8 }}>{new Date(w.created_at).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab Temuan ────────────────────────────────────────────────────────────────

function TabTemuan({ items, onRefresh }: { items: Temuan[]; onRefresh: () => void }) {
  const [tipeTab, setTipeTab] = useState<'risk_based' | 'compliance'>('risk_based')
  const [filterUrgensi, setFilterUrgensi] = useState<string>('semua')
  const [filterSifat, setFilterSifat] = useState<string>('semua')
  const [filterKluster, setFilterKluster] = useState<string>('semua')
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [catatan, setCatatan] = useState<Record<string, string>>({})
  const [savingCatatan, setSavingCatatan] = useState<string | null>(null)

  const byTipe = items.filter(t => t.tipe_analisis === tipeTab)

  const filtered = byTipe.filter(t =>
    (filterUrgensi === 'semua' || t.urgensi === filterUrgensi) &&
    (filterSifat === 'semua' || t.sifat === filterSifat) &&
    (filterKluster === 'semua' || t.kluster === filterKluster) &&
    (filterStatus === 'semua' || t.status === filterStatus)
  )

  const dikonfirmasi = byTipe.filter(t => t.status === 'dikonfirmasi').length

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/onsite/temuan/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await onRefresh()
  }

  async function saveCatatan(id: string) {
    setSavingCatatan(id)
    await fetch(`/api/onsite/temuan/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catatan_pengawas: catatan[id] ?? '' }),
    })
    setSavingCatatan(null)
    await onRefresh()
  }

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', fontSize: 11, padding: '6px 10px', borderRadius: 8, marginBottom: 4, background: active ? 'rgba(69,230,97,0.12)' : 'none', color: active ? '#45e661' : '#8a949c', border: 'none', cursor: 'pointer', fontFamily: 'inherit'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sub-tab */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px 0', flexShrink: 0, gap: 20 }}>
        {([
          ['risk_based', 'Risk-Based', items.filter(t => t.tipe_analisis === 'risk_based').length],
          ['compliance', 'Compliance', items.filter(t => t.tipe_analisis === 'compliance').length],
        ] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => { setTipeTab(key); setFilterUrgensi('semua'); setFilterKluster('semua'); setFilterSifat('semua'); setFilterStatus('semua') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, fontSize: 13, fontWeight: 500, color: tipeTab === key ? '#eef2ef' : '#5a646c', borderBottom: `1px solid ${tipeTab === key ? '#45e661' : 'transparent'}`, fontFamily: 'inherit' }}>
            {label} <span style={{ color: '#5a646c', marginLeft: 4 }}>({count})</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Filter sidebar */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', padding: 16, overflowY: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: '#5a646c', letterSpacing: '0.12em', marginBottom: 8 }}>URGENSI</p>
          {['semua', 'kritis', 'signifikan', 'perlu_perhatian'].map(v => (
            <button key={v} onClick={() => setFilterUrgensi(v)} style={filterBtnStyle(filterUrgensi === v)}>
              {v === 'semua' ? 'Semua' : URGENSI_LABEL[v]}
              <span style={{ float: 'right', color: '#5a646c' }}>{v === 'semua' ? byTipe.length : byTipe.filter(t => t.urgensi === v).length}</span>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: '#5a646c', letterSpacing: '0.12em', marginBottom: 8 }}>SIFAT</p>
          {['semua', 'pelanggaran_ketentuan', 'potensi_pelanggaran', 'perlu_perbaikan'].map(v => (
            <button key={v} onClick={() => setFilterSifat(v)} style={filterBtnStyle(filterSifat === v)}>
              {v === 'semua' ? 'Semua' : v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: '#5a646c', letterSpacing: '0.12em', marginBottom: 8 }}>KLUSTER</p>
          {['semua', ...KLUSTER_LIST.map(k => k.kode)].map(v => (
            <button key={v} onClick={() => setFilterKluster(v)} style={filterBtnStyle(filterKluster === v)}>
              {v === 'semua' ? 'Semua' : `${v} — ${KLUSTER_LIST.find(k => k.kode === v)?.nama}`}
              {v !== 'semua' && <span style={{ float: 'right', color: '#5a646c' }}>{byTipe.filter(t => t.kluster === v).length}</span>}
            </button>
          ))}
        </div>

        <div>
          <p style={{ fontSize: 10, color: '#5a646c', letterSpacing: '0.12em', marginBottom: 8 }}>STATUS</p>
          {['semua', 'draft', 'dikonfirmasi', 'di_drop'].map(v => (
            <button key={v} onClick={() => setFilterStatus(v)} style={filterBtnStyle(filterStatus === v)}>
              {v === 'semua' ? 'Semua' : v.charAt(0).toUpperCase() + v.slice(1).replace('_', ' ')}
              <span style={{ float: 'right', color: '#5a646c' }}>{v === 'semua' ? byTipe.length : byTipe.filter(t => t.status === v).length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#8a949c' }}>{filtered.length} temuan ditampilkan</p>
          <p style={{ fontSize: 12, color: '#45e661' }}>{dikonfirmasi} dikonfirmasi</p>
        </div>

        {filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: '#5a646c', fontSize: 13 }}>
            Tidak ada temuan sesuai filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ background: 'rgba(8,12,18,0.85)', border: `1px solid ${t.urgensi === 'kritis' ? 'rgba(255,111,97,0.35)' : t.urgensi === 'signifikan' ? 'rgba(255,190,80,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: 16, opacity: t.status === 'di_drop' ? 0.4 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: `1px solid ${t.urgensi === 'kritis' ? 'rgba(255,111,97,0.5)' : t.urgensi === 'signifikan' ? 'rgba(255,190,80,0.4)' : 'rgba(255,255,255,0.15)'}`, color: t.urgensi === 'kritis' ? '#ff6f61' : t.urgensi === 'signifikan' ? '#ffbe50' : '#8a949c' }}>
                        {URGENSI_LABEL[t.urgensi]}
                      </span>
                      {t.kluster && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#8a949c' }}>
                          {t.kluster} · {t.kluster_nama}
                        </span>
                      )}
                      {t.sumber_tipe && (
                        <span style={{ fontSize: 11, color: '#5a646c' }}>dari {t.sumber_tipe}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{t.judul}</p>
                    {expanded === t.id && (
                      <div style={{ marginTop: 12, fontSize: 12, color: '#8a949c', lineHeight: 1.7 }}>
                        {t.uraian && <p style={{ marginBottom: 8 }}>{t.uraian}</p>}
                        {t.pasal_terkait?.length > 0 && (
                          <p style={{ color: '#45e661', marginBottom: 8 }}>Pasal: {t.pasal_terkait.join(', ')}</p>
                        )}
                        {t.rekomendasi && (
                          <p style={{ color: '#eef2ef', fontStyle: 'italic' }}>Rekomendasi: {t.rekomendasi}</p>
                        )}
                      </div>
                    )}

                    {t.status === 'dikonfirmasi' && (
                      <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                        <p style={{ fontSize: 11, color: '#8a949c', marginBottom: 8 }}>Catatan Pengawas <span style={{ color: '#5a646c' }}>(setelah konfirmasi ke perusahaan)</span></p>
                        <textarea
                          rows={3}
                          value={catatan[t.id] ?? (t.catatan_pengawas || '')}
                          onChange={e => setCatatan(prev => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Isi catatan pengawas di sini..."
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#eef2ef', padding: '6px 0', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <button onClick={() => saveCatatan(t.id)} disabled={savingCatatan === t.id}
                            style={{ fontSize: 11, padding: '5px 14px', borderRadius: 999, background: 'rgba(69,230,97,0.12)', color: '#45e661', border: '1px solid rgba(69,230,97,0.3)', cursor: 'pointer', fontFamily: 'inherit', opacity: savingCatatan === t.id ? 0.5 : 1 }}>
                            {savingCatatan === t.id ? 'Menyimpan...' : 'Simpan Catatan'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#5a646c', fontFamily: 'inherit' }}>
                      {expanded === t.id ? '▲' : '▼'}
                    </button>
                    {t.status === 'draft' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => updateStatus(t.id, 'dikonfirmasi')}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(69,230,97,0.12)', color: '#45e661', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                        <button onClick={() => updateStatus(t.id, 'di_drop')}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#8a949c', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    )}
                    {t.status === 'dikonfirmasi' && (
                      <span style={{ fontSize: 11, color: '#45e661' }}>✓ Dikonfirmasi</span>
                    )}
                    {t.status === 'di_drop' && (
                      <button onClick={() => updateStatus(t.id, 'draft')}
                        style={{ fontSize: 11, color: '#5a646c', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Batalkan drop</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div> {/* end flex flex-1 */}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    uploaded: { bg: 'rgba(255,255,255,0.06)', color: '#8a949c' },
    analyzing: { bg: 'rgba(255,190,80,0.12)', color: '#ffbe50' },
    done: { bg: 'rgba(69,230,97,0.12)', color: '#45e661' },
    error: { bg: 'rgba(255,111,97,0.12)', color: '#ff6f61' },
  }
  const label: Record<string, string> = {
    uploaded: 'Diupload', analyzing: 'Menganalisis...', done: 'Selesai', error: 'Gagal',
  }
  const c = colors[status] ?? colors.uploaded
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.color }}>{label[status] ?? status}</span>
}
