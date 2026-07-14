import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Link from 'next/link'

export default async function DashboardPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const isAdmin = user.role === 'admin'

  const offsiteModules = [
    { href: '/psak117',  icon: '📊', label: 'PSAK 117',       sub: 'Analisis Lapkeu Asuransi' },
    { href: '/lhptl',   icon: '📋', label: 'LHPTL',          sub: 'Pengawasan Pialang' },
    { href: '/kyic',    icon: '🏷️', label: 'KYIC/KYNBFI',    sub: 'Know Your Insurance Company' },
    { href: '/renbis',  icon: '📈', label: 'Renbis',          sub: 'Evaluasi Rencana Bisnis' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <span className="font-bold text-lg">OASIS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">{user.nama_lengkap || user.username}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            user.role === 'admin' ? 'text-purple-400 bg-purple-900/30' :
            user.role === 'supervisor' ? 'text-blue-400 bg-blue-900/30' :
            'text-slate-400 bg-slate-800'
          }`}>{user.role}</span>
          <form action="/api/auth/signout" method="POST">
            <button className="text-slate-500 hover:text-white text-sm transition-colors ml-2">Keluar</button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Onsite */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Pemeriksaan Onsite</h2>
          <Link href="/pemeriksaan"
            className="flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-5 transition-colors group">
            <div className="text-3xl">🔍</div>
            <div>
              <p className="font-semibold text-base group-hover:text-blue-400 transition-colors">Pemeriksaan Onsite</p>
              <p className="text-slate-500 text-sm mt-0.5">Pemeriksaan lapangan berbasis kode sesi</p>
            </div>
            <span className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors text-lg">→</span>
          </Link>
        </section>

        {/* Offsite */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Pengawasan Offsite</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {offsiteModules.map((m) => (
              <Link key={m.href} href={m.href}
                className="bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-4 transition-colors group">
                <div className="text-2xl mb-2">{m.icon}</div>
                <p className="font-medium text-sm group-hover:text-blue-400 transition-colors">{m.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{m.sub}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Admin — hanya untuk role admin */}
        {isAdmin && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Administrasi</h2>
            <Link href="/admin"
              className="flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-purple-700 rounded-xl p-5 transition-colors group">
              <div className="text-3xl">⚙️</div>
              <div>
                <p className="font-semibold text-base group-hover:text-purple-400 transition-colors">Panel Admin</p>
                <p className="text-slate-500 text-sm mt-0.5">Kelola user, skills config, dan konfigurasi sistem</p>
              </div>
              <span className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors text-lg">→</span>
            </Link>
          </section>
        )}

      </div>
    </div>
  )
}
