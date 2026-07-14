'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const modules = [
    { icon: '🔍', label: 'Pemeriksaan Onsite', sub: 'Analisis dokumen & temuan lapangan' },
    { icon: '📊', label: 'PSAK 117',           sub: 'Analisis laporan keuangan asuransi' },
    { icon: '🏷️', label: 'KYIC / KYNBFI',      sub: 'Profil risiko berbasis SEDK' },
    { icon: '📋', label: 'LHPTL',              sub: 'Pengawasan tidak langsung pialang' },
    { icon: '📈', label: 'Renbis',             sub: 'Evaluasi rencana bisnis tahunan' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel — branding */}
      <div className="hidden sm:flex flex-col w-[380px] shrink-0 bg-slate-900 border-r border-slate-800 p-10 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">OASIS</p>
              <p className="text-slate-500 text-xs mt-0.5">Onsite & Offsite AI Powered Supervisory System</p>
            </div>
          </div>

          <h2 className="text-white text-2xl font-bold leading-snug mb-3">
            Sistem Pengawasan<br />Berbasis AI
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Platform terintegrasi untuk pengawasan perusahaan asuransi, reasuransi, dan pialang asuransi — didukung kecerdasan buatan dan referensi regulasi OJK.
          </p>

          <div className="space-y-3">
            {modules.map(m => (
              <div key={m.label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/60">
                <span className="text-lg">{m.icon}</span>
                <div>
                  <p className="text-white text-xs font-medium">{m.label}</p>
                  <p className="text-slate-500 text-xs">{m.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-700 text-xs">OJK Internal System · Akses terbatas</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 md:hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">O</span>
            </div>
            <div>
              <p className="text-white font-bold">OASIS</p>
              <p className="text-slate-500 text-xs">Onsite & Offsite AI Powered Supervisory System</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-white text-xl font-bold">Selamat datang</h1>
            <p className="text-slate-400 text-sm mt-1">Masuk untuk melanjutkan ke sistem</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                placeholder="username Anda"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-900/60 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-2"
            >
              {loading ? 'Masuk...' : 'Masuk ke OASIS'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-8">
            Belum punya akun?{' '}
            <Link href="/register" className="text-slate-400 hover:text-white transition-colors">
              Hubungi administrator
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
