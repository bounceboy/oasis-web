'use client'

import { useState, useEffect } from 'react'

const DIREKTORAT = [
  { kode: 'DPSS', label: 'DPSS — Asuransi & Reasuransi Syariah' },
  { kode: 'DAJI', label: 'DAJI — Asuransi Jiwa' },
  { kode: 'DASR', label: 'DASR — Asuransi Umum' },
  { kode: 'DPJP', label: 'DPJP — Jasa Penunjang' },
]

const LS_KEY = (kode: string) => `oasis_apikeys_${kode}`

export default function LoginPage() {
  const [direktorat, setDirektorat] = useState('DPSS')
  const [apiKey, setApiKey] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load suggestions dari localStorage saat direktorat berubah
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY(direktorat)) ?? '[]') as string[]
      setSuggestions(saved)
    } catch {
      setSuggestions([])
    }
  }, [direktorat])

  function saveKeyToStorage(kode: string, key: string) {
    try {
      const existing = JSON.parse(localStorage.getItem(LS_KEY(kode)) ?? '[]') as string[]
      const updated = [key, ...existing.filter(k => k !== key)].slice(0, 5)
      localStorage.setItem(LS_KEY(kode), JSON.stringify(updated))
    } catch {}
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direktorat, api_key: apiKey.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
    } else {
      saveKeyToStorage(direktorat, apiKey.trim())
      window.location.assign('/dashboard')
    }
  }

  function maskKey(key: string) {
    if (key.length <= 12) return key
    return key.slice(0, 10) + '••••' + key.slice(-6)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 980, display: 'flex', gap: 64 }}>

        {/* Left — branding */}
        <div style={{ flex: 1, padding: '24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#45e661', boxShadow: '0 0 14px rgba(69,230,97,0.8)' }} />
            <span style={{ fontSize: 19, fontWeight: 500 }}>oasis</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 500, lineHeight: 1.3, margin: 0, letterSpacing: '-0.01em' }}>
            Onsite &amp; Offsite<br />
            <span style={{ color: '#45e661' }}>AI Powered</span><br />
            Supervisory System
          </h1>
          <p style={{ fontSize: 12.5, color: '#828d96', marginTop: 20, lineHeight: 1.6 }}>
            Masuk dengan direktorat Anda dan API key Anthropic.<br />
            API key tersimpan di browser untuk kemudahan login berikutnya.
          </p>
        </div>

        {/* Right — form */}
        <div style={{ flex: 1, padding: '24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Masuk ke OASIS</h2>
          <p style={{ fontSize: 13, color: '#aab4bc', margin: '8px 0 32px' }}>Pilih direktorat dan masukkan API key Anda.</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Direktorat */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#aab4bc', marginBottom: 8 }}>Direktorat</label>
              <select
                value={direktorat}
                onChange={e => { setDirektorat(e.target.value); setApiKey(''); setError('') }}
                style={{
                  width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)',
                  color: '#eef2ef', fontSize: 14, padding: '8px 0', cursor: 'pointer', outline: 'none',
                  appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                {DIREKTORAT.map(d => (
                  <option key={d.kode} value={d.kode} style={{ background: '#0a0f16' }}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#aab4bc', marginBottom: 8 }}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setError('') }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                required
                placeholder="sk-ant-..."
                autoComplete="off"
                style={{
                  width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)',
                  color: '#eef2ef', fontSize: 14, padding: '8px 0', outline: 'none', fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#0d1520', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, marginTop: 4, overflow: 'hidden',
                }}>
                  <div style={{ padding: '6px 12px', fontSize: 10, color: '#828d96', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    Key sebelumnya
                  </div>
                  {suggestions.map((k, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setApiKey(k); setShowSuggestions(false) }}
                      style={{
                        width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                        padding: '10px 12px', cursor: 'pointer', color: '#aab4bc', fontSize: 12,
                        fontFamily: 'monospace', display: 'block',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {maskKey(k)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p style={{ fontSize: 12.5, color: '#ff6f61', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-outline"
              style={{ alignSelf: 'flex-start', marginTop: 8, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Masuk...' : 'Masuk ke OASIS'}
              {!loading && (
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#45e661', color: '#04120a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>↗</span>
              )}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#6b7680', marginTop: 40 }}>
            OJK Internal System · Akses terbatas<br />
            <span style={{ color: '#4a5560' }}>Dapatkan API key di console.anthropic.com</span>
          </p>
        </div>
      </div>
    </div>
  )
}
