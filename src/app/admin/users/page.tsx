import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function AdminUsersPage() {
  const profile = await requireAdmin()
  if (!profile) redirect('/dashboard')

  const admin = createAdminClient()

  // Ambil semua users dari auth + join profiles
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const { data: profiles } = await admin
    .from('oasis_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const users = (authUsers?.users ?? []).map((u) => ({
    ...profileMap[u.id],
    id: u.id,
    email: u.email,
    confirmed: !!u.email_confirmed_at,
    last_sign_in: u.last_sign_in_at,
  }))

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-900/50 text-purple-400',
    supervisor: 'bg-blue-900/50 text-blue-400',
    pemeriksa: 'bg-slate-800 text-slate-400',
  }
  const statusColors: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400',
    pending: 'bg-yellow-900/50 text-yellow-400',
    suspended: 'bg-red-900/50 text-red-400',
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-slate-400 hover:text-white text-sm">← Admin</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Kelola User</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Daftar User ({users.length})</h1>
          <Link href="/admin/users/invite"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Undang User Baru
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left px-4 py-3 font-medium">Nama / Email</th>
                <th className="text-left px-4 py-3 font-medium">Direktorat</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{u.nama_lengkap || '(belum diisi)'}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u.direktorat || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[u.role] ?? roleColors.pemeriksa}`}>
                      {u.role ?? 'pemeriksa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[u.status] ?? statusColors.pending}`}>
                      {u.status ?? 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs">
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
