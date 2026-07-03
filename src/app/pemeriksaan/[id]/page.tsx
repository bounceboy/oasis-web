import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const { data: session } = await db()
    .from('pemeriksaan_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">{session.nama_entitas}</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">{session.nama_entitas}</h1>
            <p className="text-slate-400 text-sm mt-1">{session.jenis_usaha} · {session.dokumen_nama}</p>
          </div>
          <span className={`text-sm px-3 py-1 rounded-full ${
            session.status === 'selesai' ? 'bg-green-900/50 text-green-400' :
            session.status === 'processing' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-slate-800 text-slate-400'
          }`}>
            {session.status}
          </span>
        </div>

        {session.status === 'selesai' && (
          <div className="space-y-6">
            {session.hasil_compliance && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="font-semibold mb-4 text-blue-400">Compliance Check</h2>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {session.hasil_compliance}
                </pre>
              </div>
            )}
            {session.hasil_risk && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="font-semibold mb-4 text-orange-400">Risk-Based Assessment</h2>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {session.hasil_risk}
                </pre>
              </div>
            )}
          </div>
        )}

        {session.status === 'processing' && (
          <div className="text-center py-16 text-slate-500">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>Analisis sedang berjalan...</p>
          </div>
        )}

        {session.status === 'draft' && (
          <div className="text-center py-16 text-slate-500">
            <p>Belum ada analisis. Lanjutkan pemeriksaan dari halaman sebelumnya.</p>
          </div>
        )}
      </div>
    </div>
  )
}
