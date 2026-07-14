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
        </div>

        {/* Right — form */}
        <div style={{ flex: 1, padding: '24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Selamat datang</h2>
          <p style={{ fontSize: 13, color: '#8a949c', margin: '8px 0 32px' }}>Masuk untuk melanjutkan ke sistem</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a949c', marginBottom: 8 }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                placeholder="Ketik username Anda"
                className="input-underline"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a949c', marginBottom: 8 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="input-underline"
              />
            </div>

            {error && (
              <p style={{ fontSize: 12.5, color: '#ff6f61', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-outline"
              style={{ alignSelf: 'flex-start', marginTop: 16, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Masuk...' : 'Masuk ke OASIS'}
              {!loading && (
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#45e661', color: '#04120a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>↗</span>
              )}
            </button>
          </form>

          <p style={{ fontSize: 12.5, color: '#5a646c', marginTop: 40 }}>
            Belum punya akun?{' '}
            <Link href="/register">Hubungi administrator</Link>
          </p>
          <p style={{ fontSize: 11, color: '#414a52', marginTop: 24 }}>OJK Internal System · Akses terbatas</p>
        </div>
      </div>
    </div>
  )
}
