'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type OnsiteSession = {
  id: string; kode: string; nama_entitas: string; jenis_usaha: string; created_at: string
}

const JENIS_USAHA = [
  'Asuransi Jiwa', 'Asuransi Jiwa Syariah', 'Asuransi Umum',
  'Asuransi Umum Syariah', 'Reasuransi', 'Reasuransi Syariah', 'Pialang Asuransi',
]

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<OnsiteSession[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [kode, setKode] = useState('')
  const [namaEntitas, setNamaEntitas] = useState('')
  const [jenisUsaha, setJenisUsaha] = useState(JENIS_USAHA[0])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    try {
      const res = await fetch('/api/admin/onsite-sessions')
      if (res.ok) setSessions(await res.json())
    } finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!kode.trim() || !namaEntitas.trim()) return
    setCreating(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/onsite/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode: kode.trim().toUpperCase(), nama_entitas: namaEntitas.trim(), jenis_usaha: jenisUsaha }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      setSuccess(`Sesi ${d.kode} berhasil dibuat`)
      setKode(''); setNamaEntitas('')
      await loadSessions()
    } catch { setError('Gagal membuat sesi') }
    finally { setCreating(false) }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors">← Admin</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Sesi Onsite</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Kelola Sesi Pemeriksaan Onsite</h1>

        {/* Form Buat Sesi */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="font-medium text-sm text-slate-300">Buat Sesi Baru</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Kode Pemeriksaan</label>
              <input value={kode} onChange={e => { setKode(e.target.value.toUpperCase()); setError(''); setSuccess('') }}
                placeholder="KITABISA"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 uppercase placeholder:normal-case placeholder:font-sans" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Nama Entitas</label>
              <input value={namaEntitas} onChange={e => setNamaEntitas(e.target.value)}
                placeholder="PT Asuransi Jiwa ASYKI"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Jenis Usaha</label>
              <select value={jenisUsaha} onChange={e => setJenisUsaha(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {JENIS_USAHA.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-green-400 text-xs">{success}</p>}

          <button onClick={handleCreate} disabled={creating || !kode.trim() || !namaEntitas.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {creating ? 'Membuat...' : '+ Buat Sesi'}
          </button>
        </div>

        {/* List Sesi */}
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Sesi Aktif</h2>
          {loading ? (
            <p className="text-slate-600 text-sm">Memuat...</p>
          ) : sessions.length === 0 ? (
            <p className="text-slate-600 text-sm">Belum ada sesi pemeriksaan.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-blue-400 text-sm tracking-widest">{s.kode}</span>
                      <span className="font-medium text-sm">{s.nama_entitas}</span>
                      <span className="text-xs text-slate-500">{s.jenis_usaha}</span>
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5">{new Date(s.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                  <Link href={`/pemeriksaan/${s.kode}`}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    Buka →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
