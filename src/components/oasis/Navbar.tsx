'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface NavbarProps {
  userName?: string
  userRole?: string
  showAdmin?: boolean
  simple?: boolean  // mode sederhana: hanya ← Dashboard + user info
}

export default function Navbar({ userName, userRole, showAdmin, simple }: NavbarProps) {
  const [offsiteOpen, setOffsiteOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isDashboard = pathname === '/dashboard'
  const isOnsite = pathname.startsWith('/pemeriksaan')
  const isOffsite = ['/psak117', '/lhptl', '/kyic', '/renbis', '/kyic-v2'].some(p => pathname.startsWith(p))
  const isAdmin = pathname.startsWith('/admin')

  const navBtn = (active: boolean) => ({
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 400,
    color: active ? '#eef2ef' : '#aab4bc',
    fontFamily: 'inherit',
  } as React.CSSProperties)

  async function handleLogout() {
    await fetch('/api/auth/signout', { method: 'POST' })
    // Full page load — reset seluruh router cache client saat session berubah
    window.location.assign('/login')
  }

  const offsiteItems = [
    { label: 'PSAK 117', href: '/psak117' },
    { label: 'LHPTL', href: '/lhptl' },
    { label: 'KYIC / KYNBFI', href: '/kyic-v2' },
    { label: 'Renbis', href: '/renbis' },
  ]

  // Mode simple: hanya ← Dashboard + user info/logout
  if (simple) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#aab4bc', fontSize: 13 }}>
          ← Dashboard
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {userName && (
            <span style={{ fontSize: 12, color: '#aab4bc' }}>
              {userName} · {userRole === 'supervisor' ? 'Supervisor' : userRole === 'admin' ? 'Admin' : 'Pemeriksa'}
            </span>
          )}
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '7px 16px', fontSize: 11, color: '#aab4bc', cursor: 'pointer', fontFamily: 'inherit' }}>
            Keluar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'rgba(6,10,15,0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '12px 12px 12px 26px', display: 'flex', alignItems: 'center', gap: 22, backdropFilter: 'blur(10px)', marginBottom: 36 }}>
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 12, textDecoration: 'none' }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#45e661', boxShadow: '0 0 12px rgba(69,230,97,0.8)' }} />
        <span style={{ fontSize: 16, fontWeight: 500, color: '#eef2ef' }}>oasis</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap', position: 'relative' }}>
        <button onClick={() => router.push('/dashboard')} style={navBtn(isDashboard)}>Dashboard</button>
        <button onClick={() => router.push('/pemeriksaan')} style={navBtn(isOnsite)}>Onsite</button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setOffsiteOpen(o => !o)} style={{ ...navBtn(isOffsite) }}>Offsite ▾</button>
          {offsiteOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 10px)', left: 0, background: '#070b10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 8, minWidth: 220, zIndex: 40 }}
              onMouseLeave={() => setOffsiteOpen(false)}
            >
              {offsiteItems.map(item => (
                <button key={item.href}
                  onClick={() => { setOffsiteOpen(false); router.push(item.href) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: pathname.startsWith(item.href) ? 'rgba(255,255,255,0.06)' : 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', borderRadius: 10, fontSize: 12.5, color: pathname.startsWith(item.href) ? '#45e661' : '#b7c0c6', fontFamily: 'inherit' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {showAdmin && (
          <button onClick={() => router.push('/admin')} style={navBtn(isAdmin)}>Admin</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {userName && (
          <span style={{ fontSize: 12, color: '#aab4bc' }}>
            {userName} · {userRole === 'supervisor' ? 'Supervisor' : userRole === 'admin' ? 'Admin' : 'Pemeriksa'}
          </span>
        )}
        <button onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#45e661', border: '1px solid #45e661', borderRadius: 999, padding: '8px 18px', fontSize: 10.5, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>
          Keluar
        </button>
      </div>
    </div>
  )
}
