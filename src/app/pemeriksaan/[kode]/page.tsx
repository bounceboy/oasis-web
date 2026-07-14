'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  status: string; created_at: string
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Memuat sesi...</p>
    </div>
  )
  if (!session) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-white text-sm transition-colors">← Dashboard</Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-mono font-bold text-blue-400 tracking-widest">{kode}</span>
          <span className="text-slate-500 text-sm hidden sm:inline">{session.nama_entitas}</span>
        </div>
        <div className="flex items-center gap-4">
          <StatChip label="Kritis" value={stats.kritis} color="text-red-400" />
          <StatChip label="Dikonfirmasi" value={stats.dikonfirmasi} color="text-green-400" />
        </div>
      </nav>

      {/* Stat bar */}
      <div className="border-b border-slate-800 px-6 py-2 flex gap-6 text-sm bg-slate-950 shrink-0">
        <StatBar label="Dokumen" value={stats.dokumen} icon="📄" onClick={() => setActiveTab('dokumen')} active={activeTab === 'dokumen'} />
        <StatBar label="Wawancara" value={stats.wawancara} icon="💬" onClick={() => setActiveTab('wawancara')} active={activeTab === 'wawancara'} />
        <StatBar label="Temuan" value={stats.temuan} icon="🔎" onClick={() => setActiveTab('temuan')} active={activeTab === 'temuan'} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dokumen' && (
          <TabDokumen kode={kode} items={dokumen} onRefresh={load} />
        )}
        {activeTab === 'wawancara' && (
          <TabWawancara kode={kode} items={wawancara} onRefresh={load} />
        )}
        {activeTab === 'temuan' && (
          <TabTemuan items={temuan} onRefresh={load} />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-bold text-sm ${color}`}>{value}</span>
      <span className="text-slate-600 text-xs">{label}</span>
    </div>
  )
}

function StatBar({ label, value, icon, onClick, active }: { label: string; value: number; icon: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 py-1 border-b-2 transition-colors ${active ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{value}</span>
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Upload panel */}
      <div className="w-80 shrink-0 border-r border-slate-800 p-5 overflow-y-auto space-y-4">
        <h2 className="font-semibold text-sm">Upload Dokumen Pemeriksaan</h2>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Departemen</label>
          <select value={departemen} onChange={e => setDepartemen(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            {DEPARTEMEN.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">File Dokumen</label>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-slate-500 transition-colors">
            {file ? (
              <div>
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Klik untuk pilih file<br/><span className="text-xs">PDF, DOCX, TXT — maks 20MB</span></p>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Instruksi / Fokus Analisis <span className="text-slate-600">opsional</span></label>
          <textarea value={fokus} onChange={e => setFokus(e.target.value)} rows={3}
            placeholder="Contoh: fokus pada kesesuaian struktur organisasi dengan POJK..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500 placeholder:text-slate-600" />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button onClick={handleUpload} disabled={!file || uploading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
          {uploading ? 'Menganalisis...' : 'Mulai Analisis'}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-5">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Belum ada dokumen. Upload dokumen untuk memulai analisis.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(dok => (
              <div key={dok.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">{dok.departemen}</span>
                      <StatusBadge status={dok.status} />
                    </div>
                    <p className="font-medium text-sm truncate">{dok.nama_file}</p>
                    {dok.fokus && <p className="text-slate-500 text-xs mt-0.5 truncate">Fokus: {dok.fokus}</p>}
                  </div>
                  {dok.ringkasan && (
                    <button onClick={() => setExpanded(expanded === dok.id ? null : dok.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 shrink-0">
                      {expanded === dok.id ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {expanded === dok.id && dok.ringkasan && (
                  <p className="text-slate-400 text-xs mt-3 leading-relaxed border-t border-slate-800 pt-3">{dok.ringkasan}</p>
                )}
                <p className="text-slate-600 text-xs mt-2">{new Date(dok.created_at).toLocaleString('id-ID')}</p>
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

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-80 shrink-0 border-r border-slate-800 p-5 overflow-y-auto space-y-4">
        <h2 className="font-semibold text-sm">Upload Catatan / Bahan Tayang Wawancara</h2>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Departemen yang Diwawancara</label>
          <select value={departemen} onChange={e => setDepartemen(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            {DEPARTEMEN.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">File Catatan / Paparan</label>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-slate-500 transition-colors">
            {file ? (
              <div>
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Klik untuk pilih file<br/><span className="text-xs">PDF, DOCX, PPTX, TXT</span></p>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.pptx,.txt" className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Fokus Analisis <span className="text-slate-600">opsional</span></label>
          <textarea value={fokus} onChange={e => setFokus(e.target.value)} rows={3}
            placeholder="Contoh: perhatikan konsistensi jawaban dengan laporan keuangan..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500 placeholder:text-slate-600" />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button onClick={handleUpload} disabled={!file || uploading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
          {uploading ? 'Menganalisis...' : 'Mulai Analisis Wawancara'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Belum ada wawancara. Upload catatan atau bahan tayang untuk dianalisis.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(w => (
              <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">{w.departemen}</span>
                      <StatusBadge status={w.status} />
                    </div>
                    <p className="font-medium text-sm truncate">{w.nama_file}</p>
                    {w.fokus && <p className="text-slate-500 text-xs mt-0.5 truncate">Fokus: {w.fokus}</p>}
                  </div>
                  {w.ringkasan && (
                    <button onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 shrink-0">
                      {expanded === w.id ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {expanded === w.id && w.ringkasan && (
                  <p className="text-slate-400 text-xs mt-3 leading-relaxed border-t border-slate-800 pt-3">{w.ringkasan}</p>
                )}
                <p className="text-slate-600 text-xs mt-2">{new Date(w.created_at).toLocaleString('id-ID')}</p>
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab Risk-Based / Compliance */}
      <div className="flex border-b border-slate-800 px-4 pt-3 shrink-0">
        {([
          ['risk_based', 'Risk-Based', items.filter(t => t.tipe_analisis === 'risk_based').length],
          ['compliance', 'Compliance', items.filter(t => t.tipe_analisis === 'compliance').length],
        ] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => { setTipeTab(key); setFilterUrgensi('semua'); setFilterKluster('semua'); setFilterSifat('semua'); setFilterStatus('semua') }}
            className={`px-4 py-2 text-sm border-b-2 -mb-px mr-2 transition-colors ${tipeTab === key ? 'border-blue-500 text-white font-medium' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tipeTab === key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
      {/* Filter sidebar */}
      <div className="w-56 shrink-0 border-r border-slate-800 p-4 overflow-y-auto space-y-5">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Urgensi</p>
          {['semua', 'kritis', 'signifikan', 'perlu_perhatian'].map(v => (
            <button key={v} onClick={() => setFilterUrgensi(v)}
              className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg mb-1 transition-colors ${filterUrgensi === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              {v === 'semua' ? 'Semua' : URGENSI_LABEL[v]}
              <span className="float-right text-slate-500">{v === 'semua' ? byTipe.length : byTipe.filter(t => t.urgensi === v).length}</span>
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Sifat</p>
          {['semua', 'pelanggaran_ketentuan', 'potensi_pelanggaran', 'perlu_perbaikan'].map(v => (
            <button key={v} onClick={() => setFilterSifat(v)}
              className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg mb-1 transition-colors ${filterSifat === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              {v === 'semua' ? 'Semua' : v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Kluster</p>
          {['semua', ...KLUSTER_LIST.map(k => k.kode)].map(v => (
            <button key={v} onClick={() => setFilterKluster(v)}
              className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg mb-1 transition-colors ${filterKluster === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              {v === 'semua' ? 'Semua' : `${v} — ${KLUSTER_LIST.find(k => k.kode === v)?.nama}`}
              {v !== 'semua' && <span className="float-right text-slate-500">{byTipe.filter(t => t.kluster === v).length}</span>}
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Status</p>
          {['semua', 'draft', 'dikonfirmasi', 'di_drop'].map(v => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg mb-1 transition-colors ${filterStatus === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              {v === 'semua' ? 'Semua' : v.charAt(0).toUpperCase() + v.slice(1).replace('_', ' ')}
              <span className="float-right text-slate-500">{v === 'semua' ? byTipe.length : byTipe.filter(t => t.status === v).length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-400">{filtered.length} temuan ditampilkan</p>
          <p className="text-xs text-green-400">{dikonfirmasi} dikonfirmasi</p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
            Tidak ada temuan sesuai filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id}
                className={`bg-slate-900 border rounded-xl p-4 transition-opacity ${t.status === 'di_drop' ? 'opacity-40' : ''}`}
                style={{ borderColor: t.urgensi === 'kritis' ? '#991b1b' : t.urgensi === 'signifikan' ? '#92400e' : '#1e3a5f' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${URGENSI_COLOR[t.urgensi]}`}>
                        {URGENSI_LABEL[t.urgensi]}
                      </span>
                      {t.kluster && (
                        <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">
                          {t.kluster} · {t.kluster_nama}
                        </span>
                      )}
                      {t.sumber_tipe && (
                        <span className="text-xs text-slate-600">dari {t.sumber_tipe}</span>
                      )}
                    </div>
                    <p className="font-medium text-sm">{t.judul}</p>
                    {expanded === t.id && (
                      <div className="mt-3 space-y-2 text-xs text-slate-400 leading-relaxed">
                        {t.uraian && <p>{t.uraian}</p>}
                        {t.pasal_terkait?.length > 0 && (
                          <p className="text-blue-400">Pasal: {t.pasal_terkait.join(', ')}</p>
                        )}
                        {t.rekomendasi && (
                          <p className="text-slate-300 italic">Rekomendasi: {t.rekomendasi}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                      className="text-slate-600 hover:text-slate-400 text-sm">
                      {expanded === t.id ? '▲' : '▼'}
                    </button>
                    {t.status === 'draft' && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(t.id, 'dikonfirmasi')}
                          className="text-xs px-2 py-1 bg-green-900/40 text-green-400 hover:bg-green-900/60 rounded transition-colors">
                          ✓
                        </button>
                        <button onClick={() => updateStatus(t.id, 'di_drop')}
                          className="text-xs px-2 py-1 bg-slate-800 text-slate-500 hover:bg-slate-700 rounded transition-colors">
                          ✕
                        </button>
                      </div>
                    )}
                    {t.status === 'dikonfirmasi' && (
                      <span className="text-xs text-green-500">✓ Dikonfirmasi</span>
                    )}
                    {t.status === 'di_drop' && (
                      <button onClick={() => updateStatus(t.id, 'draft')}
                        className="text-xs text-slate-600 hover:text-slate-400">
                        Batalkan drop
                      </button>
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
  const map: Record<string, string> = {
    uploaded: 'bg-slate-800 text-slate-400',
    analyzing: 'bg-yellow-900/40 text-yellow-400',
    done: 'bg-green-900/40 text-green-400',
    error: 'bg-red-900/40 text-red-400',
  }
  const label: Record<string, string> = {
    uploaded: 'Diupload', analyzing: 'Menganalisis...', done: 'Selesai', error: 'Error',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? map.uploaded}`}>{label[status] ?? status}</span>
}
