'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/oasis/Navbar'

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
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar simple />

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 30, fontWeight: 500, margin: 0 }}>
            <span style={{ color: '#45e661' }}>Pemeriksaan</span> onsite
          </h1>
          <p style={{ fontSize: 13, color: '#8a949c', margin: '8px 0 0' }}>Masukkan kode sesi dari admin untuk memulai atau melanjutkan.</p>
        </div>

        {/* Two column: form + riwayat */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>

          {/* Form */}
          <div style={{ flex: 1, background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 10.5, letterSpacing: '0.12em', color: '#5a646c', marginBottom: 16 }}>KODE PEMERIKSAAN</label>
              <input
                value={kode}
                onChange={e => { setKode(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleMasuk()}
                placeholder="CONTOH: KITABISA"
                autoFocus
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  padding: '16px 20px', fontSize: 18, fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center',
                  color: '#eef2ef', outline: 'none', boxSizing: 'border-box', textTransform: 'uppercase',
                }}
              />
              {error && <p style={{ color: '#ff6f61', fontSize: 12, marginTop: 8 }}>{error}</p>}
            </div>

            <button
              onClick={handleMasuk}
              disabled={loading || !kode.trim()}
              style={{
                width: '100%', background: kode.trim() && !loading ? '#45e661' : 'rgba(255,255,255,0.06)',
                color: kode.trim() && !loading ? '#04120a' : '#5a646c',
                border: 'none', borderRadius: 999, padding: '14px 0', fontSize: 11.5,
                fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: kode.trim() && !loading ? 'pointer' : 'default', fontFamily: 'inherit',
              }}
            >
              {loading ? 'Memeriksa...' : 'Masuk ke Pemeriksaan ↗'}
            </button>
          </div>

          {/* Riwayat sesi */}
          <div style={{ width: 320, flexShrink: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#5a646c', marginBottom: 16 }}>SESI PEMERIKSAAN ANDA</div>
            {riwayat.length === 0 ? (
              <p style={{ fontSize: 12, color: '#5a646c' }}>Belum ada sesi aktif.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {riwayat.map(s => (
                  <button
                    key={s.kode}
                    onClick={() => router.push(`/pemeriksaan/${s.kode}`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%' }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: '#45e661', letterSpacing: '0.15em', marginBottom: 4 }}>{s.kode}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#eef2ef' }}>{s.nama_entitas}</div>
                      <div style={{ fontSize: 11, color: '#8a949c', marginTop: 2 }}>
                        {new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {s.jenis_usaha}
                      </div>
                    </div>
                    <span style={{ color: '#45e661', fontSize: 16, flexShrink: 0 }}>↗</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
