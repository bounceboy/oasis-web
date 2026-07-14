import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Link from 'next/link'
import Navbar from '@/components/oasis/Navbar'

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
        <Navbar
          userName={user.nama_lengkap || user.username}
          userRole={user.role}
          showAdmin={isAdmin}
        />

        {/* Welcome */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 500, margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              Selamat datang, {firstName}.<br />
              <span style={{ color: '#45e661' }}>Pantau pengawasan</span> Anda di sini.
            </h1>
            <p style={{ fontSize: 13, color: '#8a949c', margin: '12px 0 0' }}>Onsite &amp; offsite, dalam satu tempat — didukung AI.</p>
          </div>
          <Link href="/pemeriksaan" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'transparent', color: '#45e661', border: '1px solid #45e661', borderRadius: 999, padding: '11px 24px', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Sesi baru
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#45e661', color: '#04120a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>↗</span>
          </Link>
        </div>

        {/* Onsite card */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#5a646c', marginBottom: 14 }}>Pemeriksaan Onsite</div>
          <Link href="/pemeriksaan" style={{ display: 'flex', alignItems: 'center', gap: 24, background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '22px 28px', textDecoration: 'none', color: 'inherit' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#eef2ef' }}>Pemeriksaan Onsite</div>
              <div style={{ fontSize: 12.5, color: '#8a949c', marginTop: 4 }}>Pemeriksaan lapangan berbasis kode sesi — dokumen, wawancara, dan temuan</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#45e661', fontSize: 18 }}>↗</span>
          </Link>
        </div>

        {/* Offsite modules */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#5a646c', marginBottom: 14 }}>Pengawasan Offsite</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {offsiteModules.map(m => (
              <Link key={m.href} href={m.href} style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '22px 24px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#eef2ef', marginBottom: 6 }}><span style={{ color: '#45e661' }}>{m.label.split('/')[0].split(' ')[0]}</span>{m.label.includes('/') ? '/'+m.label.split('/')[1] : m.label.replace(m.label.split(' ')[0], '')}</div>
                <div style={{ fontSize: 11.5, color: '#8a949c', lineHeight: 1.6 }}>{m.sub}</div>
                <div style={{ marginTop: 16, color: '#45e661', fontSize: 13 }}>↗</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Admin */}
        {isAdmin && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#5a646c', marginBottom: 14 }}>Administrasi</div>
            <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 24, background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '22px 28px', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#eef2ef' }}>Panel Admin</div>
                <div style={{ fontSize: 12.5, color: '#8a949c', marginTop: 4 }}>Kelola user, sesi pemeriksaan, dan konfigurasi sistem</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#45e661', fontSize: 18 }}>↗</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
