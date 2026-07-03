'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Direktorat = { id: string; kode: string; nama: string }
type Departemen = { id: string; direktorat_id: string; kode: string; nama: string }

export default function EditUserPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [showResetPwd, setShowResetPwd] = useState(false)

  const [direktoratList, setDirektoratList] = useState<Direktorat[]>([])
  const [departemenList, setDepartemenList] = useState<Departemen[]>([])
  const [filteredDep, setFilteredDep] = useState<Departemen[]>([])

  const [form, setForm] = useState({
    nama_lengkap: '', role: 'pemeriksa', nip: '',
    direktorat_id: '', departemen_id: '', status: 'active', new_password: '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('oasis_direktorat').select('id, kode, nama').eq('aktif', true).order('urutan'),
      supabase.from('oasis_departemen').select('id, direktorat_id, kode, nama').eq('aktif', true).order('urutan'),
      fetch(`/api/admin/users/${id}`).then((r) => r.json()),
    ]).then(([{ data: dirs }, { data: deps }, userData]) => {
      setDirektoratList(dirs ?? [])
      setDepartemenList(deps ?? [])
      setUsername(userData.username ?? userData.email?.replace('@oasis.internal', '') ?? '')
      setForm({
        nama_lengkap: userData.nama_lengkap ?? '',
        role: userData.role ?? 'pemeriksa',
        nip: userData.nip ?? '',
        direktorat_id: userData.direktorat_id ?? '',
        departemen_id: userData.departemen_id ?? '',
        status: userData.status ?? 'active',
        new_password: '',
      })
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (form.direktorat_id) {
      setFilteredDep(departemenList.filter((d) => d.direktorat_id === form.direktorat_id))
    } else {
      setFilteredDep([])
    }
  }, [form.direktorat_id, departemenList])

  function set(field: string, value: string) {
    if (field === 'direktorat_id') {
      setForm((f) => ({ ...f, direktorat_id: value, departemen_id: '' }))
    } else {
      setForm((f) => ({ ...f, [field]: value }))
    }
  }

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
    if (!confirm(`Hapus user "${username}"? Semua data pemeriksaan terkait akan tetap tersimpan.`)) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    router.push('/admin/users')
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

      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">{form.nama_lengkap || username}</h1>
          <p className="text-slate-400 text-sm mt-1">@{username}</p>
        </div>

        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">

          <div className="pb-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Informasi Pribadi</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Nama Lengkap</label>
              <input value={form.nama_lengkap} onChange={(e) => set('nama_lengkap', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">NIP</label>
              <input value={form.nip} onChange={(e) => set('nip', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="19XXXXXXXXXX" />
            </div>
          </div>

          <div className="pt-2 pb-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Unit Kerja</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Role</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="pemeriksa">Pemeriksa</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Status Akun</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Reset password */}
          <div className="pt-2 pb-2 border-b border-slate-800">
            <button type="button" onClick={() => setShowResetPwd(!showResetPwd)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {showResetPwd ? '▼' : '▶'} Reset password
            </button>
          </div>

          {showResetPwd && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password Baru</label>
              <input type="password" value={form.new_password}
                onChange={(e) => set('new_password', e.target.value)}
                minLength={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Kosongkan jika tidak ingin diubah" />
            </div>
          )}

          {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>}

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={handleDelete}
              className="text-red-400 hover:text-red-300 text-sm transition-colors">
              Hapus User
            </button>
            <div className="flex gap-3">
              <Link href="/admin/users" className="text-slate-400 hover:text-white text-sm px-4 py-2">Batal</Link>
              <button type="submit" disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
