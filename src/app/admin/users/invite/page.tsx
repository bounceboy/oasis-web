'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DIREKTORAT_LIST = ['DPEA', 'DPSI', 'DPIA', 'DPK', 'DPPK', 'DJKN', 'Lainnya']

export default function InviteUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    email: '',
    nama_lengkap: '',
    role: 'pemeriksa',
    direktorat: '',
    departemen: '',
    nip: '',
  })

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Gagal mengundang user')
      setLoading(false)
    } else {
      setSuccess(`Undangan berhasil dikirim ke ${form.email}`)
      setForm({ email: '', nama_lengkap: '', role: 'pemeriksa', direktorat: '', departemen: '', nip: '' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin/users" className="text-slate-400 hover:text-white text-sm">← Kelola User</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Undang User Baru</span>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-2">Undang User Baru</h1>
        <p className="text-slate-400 text-sm mb-6">
          User akan menerima email undangan dan bisa langsung login. Akun dibuat dengan status <span className="text-yellow-400">pending</span> sampai Anda aktifkan.
        </p>

        <form onSubmit={handleInvite} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email <span className="text-red-400">*</span></label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="nama@ojk.go.id"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Nama Lengkap</label>
              <input
                value={form.nama_lengkap}
                onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Nama sesuai kepegawaian"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">NIP</label>
              <input
                value={form.nip}
                onChange={(e) => setForm({ ...form, nip: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="19XXXXXXXXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Direktorat</label>
              <select
                value={form.direktorat}
                onChange={(e) => setForm({ ...form, direktorat: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Pilih direktorat</option>
                {DIREKTORAT_LIST.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="pemeriksa">Pemeriksa</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>
          )}
          {success && (
            <div className="bg-green-900/30 border border-green-800 rounded-lg px-3 py-2 text-green-400 text-sm">{success}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin/users" className="text-slate-400 hover:text-white text-sm px-4 py-2">
              Batal
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Mengirim undangan...' : 'Kirim Undangan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
