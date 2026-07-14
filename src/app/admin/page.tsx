import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import Navbar from '@/components/oasis/Navbar'

export default async function AdminPage() {
  const profile = await requireAdmin()
  if (!profile) redirect('/dashboard')

  const [{ count: totalUsers }, { count: totalSessions }] =
    await Promise.all([
      db().from('oasis_users').select('*', { count: 'exact', head: true }),
      db().from('pemeriksaan_sessions').select('*', { count: 'exact', head: true }),
    ])

  const { data: recentUsers } = await db()
    .from('oasis_users')
    .select('id, username, nama_lengkap, role, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: 'Total User', value: totalUsers ?? 0, href: '/admin/users' },
    { label: 'Total Pemeriksaan', value: totalSessions ?? 0, href: '/dashboard' },
  ]

  const adminMenus = [
    { href: '/admin/users',    label: 'Kelola User',   sub: 'Tambah, edit, suspend pengguna' },
    { href: '/admin/sessions', label: 'Sesi Onsite',   sub: 'Buat & kelola kode pemeriksaan' },
    { href: '/admin/skills',   label: 'Skills Config', sub: 'Edit prompt & parameter per modul' },
  ]

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar
          userName={profile.nama_lengkap || profile.username}
          userRole={profile.role}
          showAdmin={true}
        />

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#45e661', marginBottom: 8 }}>ADMIN</div>
          <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>Panel Administrasi</h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 36 }}>
          {stats.map(s => (
            <Link key={s.label} href={s.href} style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '24px 28px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ fontSize: 42, fontWeight: 300, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8a949c', marginTop: 8 }}>{s.label}</div>
            </Link>
          ))}
        </div>

        {/* Menu */}
        <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#5a646c', marginBottom: 14 }}>MENU</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 40 }}>
          {adminMenus.map(m => (
            <Link key={m.href} href={m.href} style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '20px 22px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#eef2ef', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: '#5a646c', lineHeight: 1.6 }}>{m.sub}</div>
              <div style={{ marginTop: 16, color: '#45e661', fontSize: 13 }}>↗</div>
            </Link>
          ))}
        </div>

        {/* Recent Users */}
        <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#5a646c', marginBottom: 14 }}>USER TERBARU</div>
        <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 24px' }}>
          {recentUsers?.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{u.nama_lengkap || u.username}</div>
                <div style={{ fontSize: 11, color: '#8a949c', marginTop: 2 }}>{u.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RoleBadge role={u.role} />
                <StatusBadge status={u.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    admin:      { bg: 'rgba(168,85,247,0.12)', color: '#c084fc' },
    supervisor: { bg: 'rgba(69,230,97,0.10)',  color: '#45e661' },
    pemeriksa:  { bg: 'rgba(255,255,255,0.06)', color: '#8a949c' },
  }
  const c = colors[role] ?? colors.pemeriksa
  return <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: c.bg, color: c.color }}>{role}</span>
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    active:    { bg: 'rgba(69,230,97,0.10)',   color: '#45e661' },
    pending:   { bg: 'rgba(255,190,80,0.10)',  color: '#ffbe50' },
    suspended: { bg: 'rgba(255,111,97,0.10)',  color: '#ff6f61' },
  }
  const c = colors[status] ?? colors.pending
  return <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: c.bg, color: c.color }}>{status}</span>
}
