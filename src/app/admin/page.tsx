import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'

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
    { href: '/admin/users',    icon: '👥', label: 'Kelola User',      sub: 'Tambah, edit, suspend pengguna' },
    { href: '/admin/sessions', icon: '🔑', label: 'Sesi Onsite',      sub: 'Buat & kelola kode pemeriksaan' },
    { href: '/admin/skills',   icon: '🧠', label: 'Skills Config',    sub: 'Edit prompt & parameter per modul' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">← Dashboard</Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm font-medium">Admin Panel</span>
        </div>
        <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded-full">Admin</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Panel Administrasi OASIS</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors">
              <p className="text-3xl font-bold text-white">{s.value}</p>
              <p className="text-slate-400 text-sm mt-1">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* Menu Admin */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Menu</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adminMenus.map((m) => (
              <Link key={m.href} href={m.href}
                className="flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-4 transition-colors group">
                <span className="text-2xl">{m.icon}</span>
                <div>
                  <p className="font-medium text-sm group-hover:text-blue-400 transition-colors">{m.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{m.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Users */}
        <section>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="font-medium mb-4 text-slate-300">User Terbaru</h2>
            <div className="space-y-3">
              {recentUsers?.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{u.nama_lengkap || u.username}</p>
                    <p className="text-slate-500 text-xs">{u.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={u.role} />
                    <StatusBadge status={u.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: 'bg-purple-900/50 text-purple-400',
    supervisor: 'bg-blue-900/50 text-blue-400',
    pemeriksa: 'bg-slate-800 text-slate-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[role] ?? colors.pemeriksa}`}>
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400',
    pending: 'bg-yellow-900/50 text-yellow-400',
    suspended: 'bg-red-900/50 text-red-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? ''}`}>
      {status}
    </span>
  )
}
