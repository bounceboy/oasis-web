'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Departemen = { id: string; kode: string; nama: string }
type Direktorat = { id: string; kode: string; nama: string; departemen_id: string }

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.15)',
  padding: '8px 0',
  fontSize: 13.5,
  color: '#eef2ef',
  outline: 'none',
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [departemenList, setDepartemenList] = useState<Departemen[]>([])
  const [direktoratList, setDirektoratList] = useState<Direktorat[]>([])
  const [filteredDir, setFilteredDir] = useState<Direktorat[]>([])

  const [form, setForm] = useState({
    username: '', password: '', konfirmasi_password: '',
    nama_lengkap: '', nip: '', departemen_id: '', direktorat_id: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/org/departemen').then(r => r.json()),
      fetch('/api/org/direktorat').then(r => r.json()),
    ]).then(([deps, dirs]) => {
      setDepartemenList(deps ?? [])
      setDirektoratList(dirs ?? [])
    })
  }, [])

  useEffect(() => {
    if (form.departemen_id) {
      const filtered = direktoratList.filter(d => d.departemen_id === form.departemen_id)
      setFilteredDir(filtered)
      setForm(f => ({ ...f, direktorat_id: '' }))
    } else {
      setFilteredDir([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.departemen_id, direktoratList])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.konfirmasi_password) {
      setError('Password dan konfirmasi password tidak cocok')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username, password: form.password,
        nama_lengkap: form.nama_lengkap, nip: form.nip,
        departemen_id: form.departemen_id || null,
        direktorat_id: form.direktorat_id || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center', background: 'rgba(6,10,15,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '48px 40px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid #45e661', color: '#45e661', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22 }}>✓</div>
          <h2 style={{ fontSize: 19, fontWeight: 500, margin: '0 0 10px' }}>Akun berhasil dibuat</h2>
          <p style={{ fontSize: 13, color: '#aab4bc', margin: '0 0 28px', lineHeight: 1.7 }}>Silakan login dengan username dan password yang telah dibuat.</p>
          <Link href="/login" style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Login ke OASIS</Link>
        </div>
      </div>
    )
  }

  const selectedDep = departemenList.find(d => d.id === form.departemen_id)
  const hasChildDir = filteredDir.length > 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#45e661', boxShadow: '0 0 14px rgba(69,230,97,0.8)' }} />
          <span style={{ fontSize: 18, fontWeight: 500 }}>oasis</span>
          <span style={{ fontSize: 12, color: '#aab4bc', marginLeft: 8 }}>/ buat akun baru</span>
        </div>

        <form onSubmit={handleRegister} style={{ background: 'rgba(6,10,15,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 36, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#828d96', margin: 0 }}>Informasi akun</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aab4bc', marginBottom: 6 }}>Username*</label>
              <input value={form.username} onChange={e => set('username', e.target.value.replace(/\s/g, ''))} required minLength={3} placeholder="tanpa spasi" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aab4bc', marginBottom: 6 }}>NIP</label>
              <input value={form.nip} onChange={e => set('nip', e.target.value)} placeholder="19XXXXXXXXXX" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aab4bc', marginBottom: 6 }}>Nama lengkap*</label>
            <input value={form.nama_lengkap} onChange={e => set('nama_lengkap', e.target.value)} required placeholder="Nama sesuai kepegawaian" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aab4bc', marginBottom: 6 }}>Password*</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} placeholder="min. 8 karakter" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aab4bc', marginBottom: 6 }}>Konfirmasi</label>
              <input type="password" value={form.konfirmasi_password} onChange={e => set('konfirmasi_password', e.target.value)} required placeholder="ulangi password" style={inputStyle} />
            </div>
          </div>

          <p style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#828d96', margin: '8px 0 0' }}>Unit kerja</p>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aab4bc', marginBottom: 6 }}>Departemen</label>
            <select value={form.departemen_id} onChange={e => set('departemen_id', e.target.value)} style={selectStyle}>
              <option value="">Pilih departemen</option>
              {departemenList.map(d => <option key={d.id} value={d.id}>{d.kode} — {d.nama}</option>)}
            </select>
          </div>

          {form.departemen_id && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aab4bc', marginBottom: 6 }}>
                Direktorat {!hasChildDir && <span style={{ color: '#828d96' }}>({selectedDep?.kode} tidak memiliki direktorat)</span>}
              </label>
              {hasChildDir ? (
                <select value={form.direktorat_id} onChange={e => set('direktorat_id', e.target.value)} style={selectStyle}>
                  <option value="">Pilih direktorat</option>
                  {filteredDir.map(d => <option key={d.id} value={d.id}>{d.kode} — {d.nama}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 13.5, color: '#828d96', padding: '8px 0' }}>{selectedDep?.nama}</div>
              )}
            </div>
          )}

          {error && <p style={{ fontSize: 12.5, color: '#ff6f61', margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading} className="btn-filled" style={{ alignSelf: 'flex-start', marginTop: 10 }}>
            {loading ? 'Membuat akun...' : 'Buat akun ↗'}
          </button>
          <p style={{ fontSize: 11, color: '#828d96', margin: 0 }}>Akun Anda langsung aktif setelah registrasi</p>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12.5, color: '#aab4bc', marginTop: 18 }}>
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
