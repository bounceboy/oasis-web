'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { OasisProfile } from '@/types'

const DIREKTORAT_LIST = [
  'DPEA', 'DPSI', 'DPIA', 'DPK', 'DPPK', 'DJKN', 'Lainnya',
]

export default function EditUserPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<(OasisProfile & { email?: string }) | null>(null)

  const [form, setForm] = useState({
    nama_lengkap: '',
    role: 'pemeriksa',
    direktorat: '',
    departemen: '',
    nip: '',
    status: 'active',
  })

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data)
        setForm({
          nama_lengkap: data.nama_lengkap ?? '',
          role: data.role ?? 'pemeriksa',
          direktorat: data.direktorat ?? '',
          departemen: data.departemen ?? '',
          nip: data.nip ?? '',
          status: data.status ?? 'active',
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Gagal menyimpan')
      setSaving(false)
    } else {
      router.push('/admin/users')
    }
  }

  async function handleDelete() {
    if (!confirm('Hapus user ini? Tindakan ini tidak bisa dibatalkan.')) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/users')
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin/users" className="text-slate-400 hover:text-white text-sm">← Kelola User</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Edit User</span>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">{user?.nama_lengkap || '(belum diisi)'}</h1>
          <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
        </div>

        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Nama Lengkap</label>
              <input
                value={form.nama_lengkap}
                onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-sm text-slate-400 mb-1.5">Departemen</label>
              <input
                value={form.departemen}
                onChange={(e) => setForm({ ...form, departemen: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Departemen..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Status Akun</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleDelete}
              className="text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              Hapus User
            </button>
            <div className="flex gap-3">
              <Link href="/admin/users" className="text-slate-400 hover:text-white text-sm px-4 py-2">
                Batal
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
