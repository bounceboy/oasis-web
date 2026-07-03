import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('pemeriksaan_sessions')
    .select('id, nama_entitas, jenis_pemeriksaan, status, created_at, dokumen_nama')
    .order('created_at', { ascending: false })
    .limit(20)

  const statusColor = {
    draft: 'bg-slate-700 text-slate-300',
    processing: 'bg-yellow-900/50 text-yellow-400',
    selesai: 'bg-green-900/50 text-green-400',
    error: 'bg-red-900/50 text-red-400',
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">O</span>
          </div>
          <span className="font-bold text-lg">OASIS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{user.email}</span>
          <form action="/api/auth/signout" method="POST">
            <button className="text-slate-400 hover:text-white text-sm transition-colors">
              Keluar
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Daftar Pemeriksaan</h1>
          <Link
            href="/pemeriksaan"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Pemeriksaan Baru
          </Link>
        </div>

        {(!sessions || sessions.length === 0) ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg mb-2">Belum ada pemeriksaan</p>
            <p className="text-sm">Mulai dengan klik &quot;Pemeriksaan Baru&quot;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/pemeriksaan/${s.id}`}
                className="block bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.nama_entitas}</p>
                    <p className="text-slate-400 text-sm mt-0.5">{s.dokumen_nama}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor[s.status as keyof typeof statusColor]}`}>
                      {s.status}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(s.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
