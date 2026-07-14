'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface OnsiteSession {
  kode: string
  nama_entitas: string
  jenis_usaha: string
  created_at: string
}

export default function PemeriksaanPage() {
  const router = useRouter()
  const [kode, setKode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [riwayat, setRiwayat] = useState<OnsiteSession[]>([])

  useEffect(() => {
    fetch('/api/onsite/my-sessions')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRiwayat(data) })
      .catch(() => {})
  }, [])

  async function handleMasuk() {
    const k = kode.trim().toUpperCase()
    if (!k) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/onsite/sessions?kode=${k}`)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Kode tidak ditemukan')
        return
      }
      router.push(`/pemeriksaan/${k}`)
    } catch {
      setError('Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← Kembali ke Dashboard
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg">🔍</div>
            <div>
              <h1 className="font-bold text-lg">Pemeriksaan Onsite</h1>
              <p className="text-slate-500 text-sm">Masukkan kode sesi dari admin</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Kode Pemeriksaan</label>
              <input
                value={kode}
                onChange={e => { setKode(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleMasuk()}
                placeholder="Contoh: KITABISA"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-mono tracking-widest text-center text-white focus:outline-none focus:border-blue-500 uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600"
                autoFocus
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            <button
              onClick={handleMasuk}
              disabled={loading || !kode.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl py-3 font-medium transition-colors"
            >
              {loading ? 'Memeriksa...' : 'Masuk ke Pemeriksaan →'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">1</span>
              <span>Kode baru — mulai sesi pemeriksaan baru</span>
            </div>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">2</span>
              <span>Kode lama — lanjutkan sesi yang sudah ada</span>
            </div>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">3</span>
              <span>Kode bersifat case-insensitive</span>
            </div>
          </div>
        </div>

        {/* Riwayat sesi */}
        {riwayat.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Sesi Pemeriksaan</p>
            <div className="space-y-2">
              {riwayat.map(s => (
                <button key={s.kode}
                  onClick={() => router.push(`/pemeriksaan/${s.kode}`)}
                  className="w-full bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl px-4 py-3 text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-blue-400">{s.kode}</span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{s.jenis_usaha}</span>
                    </div>
                    <div className="text-sm text-slate-300 mt-0.5">{s.nama_entitas}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <span className="text-slate-600 group-hover:text-slate-400 transition-colors">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
