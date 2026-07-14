'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import type { HasilPengawasan } from '@/lib/lhptl-rules'

type JenisEntitas = 'pialang_asuransi' | 'pialang_reasuransi'
type Step = 1 | 2 | 3

type HasilData = {
  nama_perusahaan: string
  jenis_entitas: string
  periode: string
  hasil_pengawasan: HasilPengawasan[]
  kesimpulan: string
  tindak_lanjut: string
  sessionId: string
  ringkasan: { total: number; pelanggaran: number; perlu_perhatian: number; informasional: number }
}

export default function LhptlPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const [namaEntitas, setNamaEntitas]     = useState('')
  const [jenisEntitas, setJenisEntitas]   = useState<JenisEntitas>('pialang_asuransi')
  const [periode, setPeriode]             = useState('')
  const [file, setFile]                   = useState<File | null>(null)

  const [hasil, setHasil]                 = useState<HasilData | null>(null)
  const [activeTab, setActiveTab]         = useState<'semua' | 'pelanggaran' | 'perhatian' | 'informasional'>('semua')
  const [error, setError]                 = useState('')

  function addLog(msg: string) {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString('id-ID')}] ${msg}`])
  }

  async function handleAnalisis() {
    if (!file || !namaEntitas.trim() || !periode.trim()) return
    setLoading(true); setError(''); setLog([]); setStep(2)

    try {
      addLog(`Mengupload file: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`)
      addLog('Membaca sheet Excel...')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('namaEntitas', namaEntitas)
      fd.append('jenisEntitas', jenisEntitas)
      fd.append('periode', periode)

      addLog('AI mengekstrak data dari semua sheet...')
      addLog('Menjalankan rules deterministik...')
      addLog('Menyusun Kesimpulan dan Tindak Lanjut...')

      const res = await fetch('/api/lhptl/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analisis gagal')

      setHasil(data)
      addLog(`Selesai: ${data.ringkasan.total} temuan`)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  const filteredHasil = hasil?.hasil_pengawasan.filter(h => {
    if (activeTab === 'pelanggaran') return h.tipe === 'pelanggaran'
    if (activeTab === 'perhatian')   return h.tipe === 'perlu_perhatian'
    if (activeTab === 'informasional') return h.tipe === 'informasional'
    return true
  }) ?? []

  const STEPS = [
    { n: 1, label: 'Upload Excel' },
    { n: 2, label: 'Analisis AI' },
    { n: 3, label: 'Hasil' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">← Dashboard</Link>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-medium">LHPTL</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold">Modul LHPTL</h1>
          <p className="text-slate-500 text-sm mt-1">Laporan Hasil Pengawasan Tidak Langsung — Pialang Asuransi</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                  step > s.n ? 'bg-green-600 border-green-600 text-white' :
                  step === s.n ? 'border-blue-500 text-blue-400' :
                  'border-slate-700 text-slate-600'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={`text-sm ${step === s.n ? 'text-white font-medium' : 'text-slate-600'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-800 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Form */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl space-y-5">
            <h2 className="font-semibold">Data Entitas & Upload Excel</h2>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Nama Entitas</label>
              <input value={namaEntitas} onChange={e => setNamaEntitas(e.target.value)}
                placeholder="contoh: PT Howden Insurance Brokers Indonesia"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Jenis Entitas</label>
                <select value={jenisEntitas} onChange={e => setJenisEntitas(e.target.value as JenisEntitas)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="pialang_asuransi">Pialang Asuransi</option>
                  <option value="pialang_reasuransi">Pialang Reasuransi</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Periode</label>
                <input value={periode} onChange={e => setPeriode(e.target.value)}
                  placeholder="contoh: 31 Desember 2025"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">File Excel (Form Laporan Keuangan Pialang)</label>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-slate-500 transition-colors">
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-blue-400">📊 {file.name}</p>
                    <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-400 text-sm">Klik untuk pilih file Excel (.xlsx / .xlsm)</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button onClick={handleAnalisis}
              disabled={!file || !namaEntitas.trim() || !periode.trim() || loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
              Mulai Analisis LHPTL
            </button>
          </div>
        )}

        {/* Step 2: Loading */}
        {step === 2 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">⏳ Memproses Analisis...</h2>
            <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs space-y-1 min-h-32 max-h-64 overflow-y-auto">
              {log.map((l, i) => (
                <p key={i} className="text-slate-400">{l}</p>
              ))}
              {loading && <p className="text-blue-400 animate-pulse">▋</p>}
            </div>
          </div>
        )}

        {/* Step 3: Hasil */}
        {step === 3 && hasil && (
          <div className="space-y-5">
            {/* Scorecard */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Temuan',    value: hasil.ringkasan.total,          cls: 'bg-slate-900 border-slate-800 text-white' },
                { label: 'Pelanggaran',     value: hasil.ringkasan.pelanggaran,    cls: 'bg-red-950/60 border-red-900/50 text-red-300' },
                { label: 'Perlu Perhatian', value: hasil.ringkasan.perlu_perhatian, cls: 'bg-orange-950/60 border-orange-900/50 text-orange-300' },
                { label: 'Informasional',   value: hasil.ringkasan.informasional,  cls: 'bg-green-950/60 border-green-900/50 text-green-300' },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl p-4 text-center ${s.cls}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs mt-1 opacity-70">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Download */}
            <div className="flex justify-end">
              <a href={`/api/lhptl/download/${hasil.sessionId}`} download
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                ⬇ Download LHPTL (.docx)
              </a>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-800">
              {([
                ['semua',        `Semua (${hasil.ringkasan.total})`],
                ['pelanggaran',  `Pelanggaran (${hasil.ringkasan.pelanggaran})`],
                ['perhatian',    `Perlu Perhatian (${hasil.ringkasan.perlu_perhatian})`],
                ['informasional',`Informasional (${hasil.ringkasan.informasional})`],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                    activeTab === key ? 'border-blue-500 text-white font-medium' : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tabel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h2 className="font-semibold text-sm">Hasil Pengawasan Tidak Langsung</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium w-10">No</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Hasil Pengawasan</th>
                      <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium w-36">Indikasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHasil.map(h => (
                      <tr key={h.nomor}
                        className={`border-b border-slate-800/50 ${
                          h.tipe === 'pelanggaran' ? 'bg-red-950/20' :
                          h.tipe === 'perlu_perhatian' ? 'bg-orange-950/20' : ''
                        }`}>
                        <td className="px-4 py-3 text-center text-slate-500 text-xs">{h.nomor}</td>
                        <td className="px-4 py-3 text-slate-300 leading-relaxed">{h.catatan}</td>
                        <td className="px-4 py-3 text-center">
                          {h.tipe === 'pelanggaran' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-800/50">Pelanggaran</span>
                          )}
                          {h.tipe === 'perlu_perhatian' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-400 border border-orange-800/50">Perlu Perhatian</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kesimpulan */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-sm">Kesimpulan Pengawasan</h2>
              <div className="text-slate-300 text-sm leading-relaxed space-y-2">
                {hasil.kesimpulan.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>

            {/* Tindak Lanjut */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-sm">Tindak Lanjut</h2>
              <div className="space-y-3">
                {hasil.tindak_lanjut.split(/\d+\.\s+/).filter(Boolean).map((poin, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-slate-300 text-sm leading-relaxed">{poin}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setHasil(null); setLog([]) }}
                className="border border-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">
                ← Analisis Baru
              </button>
              <a href={`/api/lhptl/download/${hasil.sessionId}`} download
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                ⬇ Download LHPTL (.docx)
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
