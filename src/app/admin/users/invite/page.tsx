'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Direktorat = { id: string; kode: string; nama: string }
type Departemen = { id: string; direktorat_id: string; kode: string; nama: string }

export default function InviteUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [direktoratList, setDirektoratList] = useState<Direktorat[]>([])
  const [departemenList, setDepartemenList] = useState<Departemen[]>([])
  const [filteredDep, setFilteredDep] = useState<Departemen[]>([])

  const [form, setForm] = useState({
    username: '', password: '', nama_lengkap: '', nip: '',
    role: 'pemeriksa', direktorat_id: '', departemen_id: '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('oasis_direktorat').select('id, kode, nama').eq('aktif', true).order('urutan'),
      supabase.from('oasis_departemen').select('id, direktorat_id, kode, nama').eq('aktif', true).order('urutan'),
    ]).then(([{ data: dirs }, { data: deps }]) => {
      setDirektoratList(dirs ?? [])
      setDepartemenList(deps ?? [])
    })
  }, [])

  useEffect(() => {
    if (form.direktorat_id) {
      setFilteredDep(departemenList.filter((d) => d.direktorat_id === form.direktorat_id))
      setForm((f) => ({ ...f, departemen_id: '' }))
    } else {
      setFilteredDep([])
    }
  }, [form.direktorat_id, departemenList])

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
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
      setError(data.error ?? 'Gagal membuat user')
      setLoading(false)
    } else {
      setSuccess(`User "${form.username}" berhasil dibuat dan langsung aktif.`)
      setForm({ username: '', password: '', nama_lengkap: '', nip: '', role: 'pemeriksa', direktorat_id: '', departemen_id: '' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin/users" className="text-slate-400 hover:text-white text-sm">← Kelola User</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Buat User Baru</span>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-1">Buat User Baru</h1>
        <p className="text-slate-400 text-sm mb-6">
          User yang dibuat admin langsung aktif. User yang daftar mandiri perlu diaktifkan dulu.
        </p>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">

          <div className="pb-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Informasi Akun</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Username <span className="text-red-400">*</span></label>
              <input
                value={form.username}
                onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="tanpa spasi"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password <span className="text-red-400">*</span></label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                required
                minLength={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="min. 8 karakter"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Nama Lengkap</label>
              <input
                value={form.nama_lengkap}
                onChange={(e) => set('nama_lengkap', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">NIP</label>
              <input
                value={form.nip}
                onChange={(e) => set('nip', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="19XXXXXXXXXX"
              />
            </div>
          </div>

          <div className="pt-2 pb-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Unit Kerja & Akses</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Direktorat</label>
            <select value={form.direktorat_id} onChange={(e) => set('direktorat_id', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="">Pilih direktorat</option>
              {direktoratList.map((d) => <option key={d.id} value={d.id}>{d.kode} — {d.nama}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Departemen</label>
            <select value={form.departemen_id} onChange={(e) => set('departemen_id', e.target.value)}
              disabled={!form.direktorat_id}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-40">
              <option value="">{form.direktorat_id ? 'Pilih departemen' : 'Pilih direktorat dulu'}</option>
              {filteredDep.map((d) => <option key={d.id} value={d.id}>{d.kode} — {d.nama}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Role</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="pemeriksa">Pemeriksa</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>}
          {success && <div className="bg-green-900/30 border border-green-800 rounded-lg px-3 py-2 text-green-400 text-sm">{success}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin/users" className="text-slate-400 hover:text-white text-sm px-4 py-2">Batal</Link>
            <button type="submit" disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              {loading ? 'Membuat...' : 'Buat User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
