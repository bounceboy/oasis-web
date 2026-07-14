'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type User = { nama_lengkap: string; username: string; role: string }

const MODULES = [
  { href: '/pemeriksaan', label: 'Onsite',       accent: 'Pemeriksaan', sub: 'Dokumen, wawancara, dan temuan lapangan berbasis kode sesi' },
  { href: '/psak117',    label: 'PSAK 117',      accent: 'PSAK',       sub: 'Analisis kepatuhan laporan keuangan asuransi' },
  { href: '/lhptl',      label: 'LHPTL',         accent: 'LHPTL',      sub: 'Pengawasan tidak langsung pialang asuransi' },
  { href: '/kyic',       label: 'KYIC/KYNBFI',   accent: 'KYIC',       sub: 'Know Your Insurance Company / Non-Bank Financial Institution' },
  { href: '/renbis',     label: 'Renbis',         accent: 'Renbis',     sub: 'Evaluasi rencana bisnis tahunan' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d?.username) setUser(d)
      else router.push('/login')
    }).catch(() => router.push('/login'))
  }, [router])

  const isAdmin = user?.role === 'admin'
  const firstName = (user?.nama_lengkap || user?.username || '').split(' ')[0]

  async function handleLogout() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 64 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#45e661', marginBottom: 14 }}>OASIS</div>
            <h1 style={{ fontSize: 36, fontWeight: 400, margin: 0, lineHeight: 1.25, letterSpacing: '-0.01em' }}>
              Selamat datang{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p style={{ fontSize: 13, color: '#8a949c', margin: '10px 0 0' }}>Onsite &amp; offsite, dalam satu tempat — didukung AI.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isAdmin && (
              <Link href="/admin" style={{ fontSize: 11, color: '#8a949c', textDecoration: 'none', letterSpacing: '0.1em' }}>ADMIN</Link>
            )}
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '7px 16px', fontSize: 11, color: '#8a949c', cursor: 'pointer', fontFamily: 'inherit' }}>Keluar</button>
          </div>
        </div>

        {/* Module grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {MODULES.map(m => (
            <Link
              key={m.href}
              href={m.href}
              onMouseEnter={() => setHovered(m.href)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'block',
                background: hovered === m.href ? 'rgba(69,230,97,0.10)' : 'rgba(8,12,18,0.85)',
                border: `1px solid ${hovered === m.href ? 'rgba(69,230,97,0.45)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 20,
                padding: '24px 20px 20px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.18s, border-color 0.18s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: hovered === m.href ? '#45e661' : '#eef2ef', marginBottom: 8, transition: 'color 0.18s' }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: hovered === m.href ? 'rgba(69,230,97,0.7)' : '#5a646c', lineHeight: 1.6, transition: 'color 0.18s' }}>{m.sub}</div>
              <div style={{ marginTop: 20, color: hovered === m.href ? '#45e661' : '#5a646c', fontSize: 14, transition: 'color 0.18s' }}>↗</div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
