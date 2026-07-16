import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Link from 'next/link'

export default async function DashboardPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const isAdmin = user.role === 'admin'
  const firstName = (user.nama_lengkap || user.username).split(' ')[0]

  const offsiteModules = [
    { href: '/psak117', label: 'PSAK 117',    sub: 'Analisis Lapkeu Asuransi' },
    { href: '/lhptl',   label: 'LHPTL',       sub: 'Pengawasan Tidak Langsung Pialang' },
    { href: '/kyic',    label: 'KYIC/KYNBFI', sub: 'Know Your Insurance Company' },
    { href: '/renbis',  label: 'Renbis',       sub: 'Evaluasi Rencana Bisnis Tahunan' },
  ]

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 64px' }}>
        {/* Top bar: user info + logout */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginBottom: 48 }}>
          <span style={{ fontSize: 12, color: '#aab4bc' }}>{user.nama_lengkap || user.username} · <span style={{ color: '#828d96' }}>{user.role}</span></span>
          <Link href="/api/auth/signout" style={{ fontSize: 11.5, color: '#eef2ef', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 16px', textDecoration: 'none', letterSpacing: '0.05em' }}>Keluar</Link>
        </div>

        {/* Welcome */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 34, fontWeight: 500, margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            Selamat datang, {firstName}.<br />
            <span style={{ color: '#45e661' }}>Pantau pengawasan</span> Anda di sini.
          </h1>
          <p style={{ fontSize: 13, color: '#aab4bc', margin: '12px 0 0' }}>Onsite &amp; offsite, dalam satu tempat — didukung AI.</p>
        </div>

        {/* Onsite card */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#828d96', marginBottom: 14 }}>Pemeriksaan Onsite</div>
          <HoverCard href="/pemeriksaan">
            <div style={{ fontSize: 16, fontWeight: 500, color: '#eef2ef' }}>Pemeriksaan Onsite</div>
            <div style={{ fontSize: 12.5, color: '#aab4bc', marginTop: 4 }}>Pemeriksaan lapangan berbasis kode sesi — dokumen, wawancara, dan temuan</div>
            <div style={{ marginTop: 16, color: '#45e661', fontSize: 18 }}>↗</div>
          </HoverCard>
        </div>

        {/* Offsite modules */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#828d96', marginBottom: 14 }}>Pengawasan Offsite</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {offsiteModules.map(m => (
              <HoverCard key={m.href} href={m.href}>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#eef2ef', marginBottom: 6 }}>
                  <span style={{ color: '#45e661' }}>{m.label.split(' ')[0]}</span>
                  {m.label.includes(' ') ? ' ' + m.label.split(' ').slice(1).join(' ') : ''}
                </div>
                <div style={{ fontSize: 11.5, color: '#aab4bc', lineHeight: 1.6 }}>{m.sub}</div>
                <div style={{ marginTop: 16, color: '#45e661', fontSize: 13 }}>↗</div>
              </HoverCard>
            ))}
          </div>
        </div>

        {/* Admin */}
        {isAdmin && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#828d96', marginBottom: 14 }}>Administrasi</div>
            <HoverCard href="/admin">
              <div style={{ fontSize: 16, fontWeight: 500, color: '#eef2ef' }}>Panel Admin</div>
              <div style={{ fontSize: 12.5, color: '#aab4bc', marginTop: 4 }}>Kelola user, sesi pemeriksaan, dan konfigurasi sistem</div>
              <div style={{ marginTop: 16, color: '#45e661', fontSize: 18 }}>↗</div>
            </HoverCard>
          </div>
        )}
      </div>
    </div>
  )
}

// Client component hanya untuk hover effect
import HoverCard from '@/components/oasis/HoverCard'
