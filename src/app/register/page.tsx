'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Direktorat = { id: string; kode: string; nama: string }
type Departemen = { id: string; direktorat_id: string; kode: string; nama: string }

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [direktoratList, setDirektoratList] = useState<Direktorat[]>([])
  const [departeменList, setDepartemenList] = useState<Departemen[]>([])
  const [filteredDep, setFilteredDep] = useState<Departemen[]>([])

  const [form, setForm] = useState({
    username: '',
    password: '',
    konfirmasi_password: '',
    nama_lengkap: '',
    nip: '',
    direktorat_id: '',
    departemen_id: '',
  })

  // Ambil daftar direktorat & departemen (public, tanpa auth)
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

  // Filter departemen berdasarkan direktorat yang dipilih
  useEffect(() => {
    if (form.direktorat_id) {
      setFilteredDep(departeменList.filter((d) => d.direktorat_id === form.direktorat_id))
      setForm((f) => ({ ...f, departemen_id: '' }))
    } else {
      setFilteredDep([])
    }
  }, [form.direktorat_id, departeменList])

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.konfirmasi_password) {
      setError('Password dan konfirmasi password tidak cocok')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username,
        password: form.password,
        nama_lengkap: form.nama_lengkap,
        nip: form.nip,
        direktorat_id: form.direktorat_id || null,
        departemen_id: form.departemen_id || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-400 text-2xl">✓</span>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Akun berhasil dibuat</h2>
          <p className="text-slate-400 text-sm mb-6">
            Akun Anda sedang menunggu aktivasi dari administrator. Anda akan dihubungi setelah akun diaktifkan.
          </p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Kembali ke halaman login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">O</span>
            </div>
            <span className="text-white text-xl font-bold tracking-tight">OASIS</span>
          </div>
          <p className="text-slate-400 text-sm">Buat akun baru</p>
        </div>

        <form onSubmit={handleRegister} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">

          {/* Informasi akun */}
          <div className="pb-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Informasi Akun</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Username <span className="text-red-400">*</span></label>
              <input
                value={form.username}
                onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))}
                required
                minLength={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="tanpa spasi"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">NIP</label>
              <input
                value={form.nip}
                onChange={(e) => set('nip', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="19XXXXXXXXXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Nama Lengkap <span className="text-red-400">*</span></label>
            <input
              value={form.nama_lengkap}
              onChange={(e) => set('nama_lengkap', e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="Nama sesuai kepegawaian"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Password <span className="text-red-400">*</span></label>
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
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Konfirmasi</label>
              <input
                type="password"
                value={form.konfirmasi_password}
                onChange={(e) => set('konfirmasi_password', e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="ulangi password"
              />
            </div>
          </div>

          {/* Struktur organisasi */}
          <div className="pt-2 pb-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Unit Kerja</p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Direktorat</label>
            <select
              value={form.direktorat_id}
              onChange={(e) => set('direktorat_id', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Pilih direktorat</option>
              {direktoratList.map((d) => (
                <option key={d.id} value={d.id}>{d.kode} — {d.nama}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Departemen</label>
            <select
              value={form.departemen_id}
              onChange={(e) => set('departemen_id', e.target.value)}
              disabled={!form.direktorat_id}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
            >
              <option value="">
                {form.direktorat_id ? 'Pilih departemen' : 'Pilih direktorat dulu'}
              </option>
              {filteredDep.map((d) => (
                <option key={d.id} value={d.id}>{d.kode} — {d.nama}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? 'Membuat akun...' : 'Buat Akun'}
          </button>

          <p className="text-slate-600 text-xs text-center">
            Akun akan aktif setelah diverifikasi oleh administrator
          </p>
        </form>

        <p className="text-center text-slate-500 text-sm mt-4">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
