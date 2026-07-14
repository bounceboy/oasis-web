'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
type JenisUsaha = 'Jiwa' | 'Umum'

type Status = 'idle' | 'loading' | 'done' | 'error'

const STEPS = [
  { n: 1, label: 'Upload Lapkeu' },
  { n: 2, label: 'Analisis AI' },
  { n: 3, label: 'Hasil' },
]

export default function Psak117Page() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [status, setStatus] = useState<Status>('idle')
  const [log, setLog] = useState<string[]>([])

  // Form
  const [namaEntitas, setNamaEntitas] = useState('')
  const [jenisUsaha, setJenisUsaha] = useState<JenisUsaha>('Jiwa')
  const [periode, setPeriode] = useState('')
  const [file, setFile] = useState<File | null>(null)

  // Hasil
  const [sessionId, setSessionId] = useState('')
  const [hasil, setHasil] = useState<Record<string, unknown> | null>(null)
  const [activeTab, setActiveTab] = useState<'scorecard' | 'compliance' | 'risiko'>('scorecard')
  const [riwayat, setRiwayat] = useState<{id: string; nama_entitas: string; created_at: string}[]>([])

  useEffect(() => {
    fetch('/api/sessions?modul=psak117')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRiwayat(data) })
      .catch(() => {})
  }, [])

  function addLog(msg: string) {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString('id-ID')}] ${msg}`])
  }

  async function handleAnalisis() {
    if (!file || !namaEntitas.trim() || !jenisUsaha || !periode.trim()) {
      alert('Lengkapi semua field dan upload file lapkeu')
      return
    }

    setStatus('loading')
    setLog([])
    setStep(2)

    try {
      addLog(`Mengupload file: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`)
      addLog('Server mengekstrak teks per halaman...')

      // Step 1: Upload PDF ke server, ekstrak + seleksi halaman relevan
      const formData = new FormData()
      formData.append('file', file)
      formData.append('config', JSON.stringify({
        includeKeywords: [
          'total aset', 'total liabilitas', 'ekuitas', 'laba', 'pendapatan',
          'beban jasa asuransi', 'klaim', 'investasi', 'arus kas',
          'csm', 'margin jasa kontraktual', 'contractual service margin',
          'lrc', 'lic', 'risk adjustment', 'penyesuaian risiko',
          'loss component', 'komponen kerugian', 'gmm', 'bba', 'paa', 'vfa',
          'expected credit loss', 'ecl', 'kerugian kredit ekspektasian',
          'stage 1', 'stage 2', 'stage 3', 'cadangan kerugian penurunan nilai',
          'catatan atas laporan keuangan', 'notes to the financial statements',
        ],
        highPriorityKeywords: ['stage 1', 'stage 2', 'stage 3', 'margin jasa kontraktual', 'csm'],
        minChars: 150,
        maxTotalChars: 160000,
      }))

      const uploadRes = await fetch('/api/upload/pdf', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload gagal')

      addLog(`PDF: ${uploadData.totalPages} halaman total, ${uploadData.selectedPages} halaman relevan dipilih`)
      addLog(`Halaman terpilih: ${uploadData.selectedPageNums?.join(', ')}`)
      addLog('Mengirim ke AI untuk analisis...')
      addLog('— Mengekstrak data keuangan (neraca, laba rugi, CALK PSAK 117/IFRS 9)...')
      addLog('— Menghitung rasio keuangan...')
      addLog('— Mencari referensi POJK (solvabilitas & kesehatan keuangan)...')
      addLog('— Mencari referensi SEDK (pemetaan risiko PSAK 117)...')
      addLog('— Menganalisis compliance dan risiko...')

      const res = await fetch('/api/psak117/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teksLapkeu: uploadData.combinedText,
          namaEntitas,
          jenisUsaha,
          periode,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analisis gagal')

      addLog('Analisis selesai.')
      setSessionId(data.sessionId)
      setHasil(data)
      setStep(3)
      fetch('/api/sessions?modul=psak117').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
      setStatus('done')
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('error')
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────

  function renderScorecard() {
    if (!hasil) return null
    const scorecard = hasil.scorecard as Array<{
      metric: string
      nilai: number | null
      threshold: string
      pass: boolean | null
      keterangan: string
    }>
    const skor = hasil.skor as { nilai: number; total: number; rating: string }
    const rasio = hasil.rasio as Record<string, number | null>
    const dk = hasil.data_keuangan as Record<string, unknown>

    const ratingColor = skor.rating === 'Baik' ? 'text-green-400' :
      skor.rating === 'Cukup' ? 'text-yellow-400' :
      skor.rating === 'Kurang' ? 'text-orange-400' : 'text-red-400'

    return (
      <div className="space-y-6">
        {/* Skor ringkas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-white">{skor.nilai}<span className="text-slate-500 text-lg">/{skor.total}</span></div>
            <div className="text-xs text-slate-400 mt-1">Metrik Lulus</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${ratingColor}`}>{skor.rating}</div>
            <div className="text-xs text-slate-400 mt-1">Rating Keseluruhan</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-white">{dk.periode as string || '-'}</div>
            <div className="text-xs text-slate-400 mt-1">Periode</div>
          </div>
        </div>

        {/* Scorecard table */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Metrik</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Nilai</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Threshold</th>
                <th className="text-center px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.map((s, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white">{s.metric}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {s.nilai != null ? (s.nilai < 10 ? (s.nilai * 100).toFixed(2) + '%' : s.nilai.toFixed(2) + 'x') : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{s.threshold}</td>
                  <td className="px-4 py-3 text-center">
                    {s.pass === null ? (
                      <span className="text-slate-500 text-xs">–</span>
                    ) : s.pass ? (
                      <span className="bg-green-900/50 text-green-400 text-xs px-2 py-0.5 rounded-full">✓ Lulus</span>
                    ) : (
                      <span className="bg-red-900/50 text-red-400 text-xs px-2 py-0.5 rounded-full">✗ Tidak Lulus</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{s.keterangan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Data keuangan ringkas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wide">Posisi Keuangan ({dk.unit as string})</p>
            <div className="space-y-2">
              {[
                ['Total Aset', dk.total_aset],
                ['Total Liabilitas', dk.total_liabilitas],
                ['Ekuitas', dk.total_ekuitas],
                ['Liab. Kontrak Asuransi', dk.liabilitas_kontrak_asuransi],
                ['CSM Penutup', dk.csm_penutup],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label as string}</span>
                  <span className="text-white font-mono">{val != null ? Number(val).toLocaleString('id-ID') : '–'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wide">Laba Rugi ({dk.unit as string})</p>
            <div className="space-y-2">
              {[
                ['Pendapatan Asuransi', dk.pendapatan_asuransi],
                ['Beban Jasa Asuransi', dk.beban_jasa_asuransi],
                ['Klaim & Manfaat', dk.klaim_dan_manfaat],
                ['Hasil Investasi', dk.hasil_investasi],
                ['Profit Tahun Berjalan', dk.profit_tahun_berjalan],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label as string}</span>
                  <span className={`font-mono ${Number(val) < 0 ? 'text-red-400' : 'text-white'}`}>
                    {val != null ? Number(val).toLocaleString('id-ID') : '–'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderMarkdown(text: string) {
    return (
      <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
        {text}
      </pre>
    )
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white text-sm">
          ← Dashboard
        </button>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Analisis PSAK 117</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${step >= s.n ? 'text-blue-400' : 'text-slate-600'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                  step > s.n ? 'bg-blue-600 border-blue-600 text-white' :
                  step === s.n ? 'border-blue-500 text-blue-400' :
                  'border-slate-700 text-slate-600'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className="text-sm hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* Log panel */}
        {log.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 max-h-40 overflow-y-auto">
            {log.map((l, i) => (
              <p key={i} className="text-xs font-mono text-slate-400">{l}</p>
            ))}
            {status === 'loading' && (
              <p className="text-xs font-mono text-blue-400 animate-pulse">Memproses...</p>
            )}
          </div>
        )}

        {/* Step 1: Form upload */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-lg">Analisis Laporan Keuangan PSAK 117</h2>
              <p className="text-slate-400 text-sm mt-1">
                Upload laporan keuangan audited (PDF) perusahaan asuransi konvensional.
                AI akan mengekstrak data, menghitung rasio, dan menganalisis kepatuhan serta profil risiko.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Nama Perusahaan</label>
                <input
                  value={namaEntitas}
                  onChange={(e) => setNamaEntitas(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="PT Asuransi Contoh Tbk"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Jenis Usaha</label>
                <select
                  value={jenisUsaha}
                  onChange={(e) => setJenisUsaha(e.target.value as JenisUsaha)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Jiwa">Asuransi Jiwa</option>
                  <option value="Umum">Asuransi Umum</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Periode Laporan</label>
              <input
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="FY 2024 / 31 Desember 2024"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Laporan Keuangan Audited</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-slate-500 transition-colors"
              >
                {file ? (
                  <div>
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-slate-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-400 text-2xl mb-2">📄</p>
                    <p className="text-slate-300 font-medium">Klik untuk upload lapkeu</p>
                    <p className="text-slate-500 text-sm mt-1">PDF dengan CALK — maks 50 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg px-4 py-3">
              <p className="text-blue-400 text-sm">
                <span className="font-medium">Referensi yang digunakan:</span> POJK No. 26/2025 (Solvabilitas),
                POJK No. 5/2023 (Kesehatan Keuangan), SEDK No. 8/2021 (Pengawasan Berbasis Risiko)
              </p>
            </div>

            <button
              onClick={handleAnalisis}
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-3 text-sm font-semibold transition-colors"
            >
              Mulai Analisis PSAK 117 →
            </button>
          </div>
        )}

        {/* Riwayat */}
        {step === 1 && riwayat.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Riwayat Analisis</p>
            <div className="flex flex-wrap gap-2">
              {riwayat.map(item => (
                <button key={item.id}
                  onClick={() => router.push(`/psak117/${item.id}`)}
                  className="bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-lg px-3 py-2 text-left transition-colors"
                >
                  <div className="text-sm font-medium text-slate-200">{item.nama_entitas}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 2 && status === 'loading' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="font-semibold text-lg">Menganalisis Laporan Keuangan</p>
              <p className="text-slate-400 text-sm mt-1">
                Proses ini memakan waktu 1–2 menit. AI sedang membaca lapkeu, menghitung rasio,
                dan menyusun analisis kepatuhan serta pemetaan risiko.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Error */}
        {step === 2 && status === 'error' && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-center space-y-3">
            <p className="text-red-400 font-semibold">Analisis Gagal</p>
            <p className="text-slate-400 text-sm">Lihat log di atas untuk detail error.</p>
            <button onClick={() => { setStep(1); setStatus('idle') }} className="text-blue-400 text-sm hover:text-blue-300">
              ← Kembali
            </button>
          </div>
        )}

        {/* Step 3: Hasil */}
        {step === 3 && hasil && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-xl">
                  {(hasil.metadata as Record<string, string>).namaEntitas}
                </h2>
                <p className="text-slate-400 text-sm">
                  {(hasil.metadata as Record<string, string>).jenisUsaha} ·{' '}
                  {(hasil.metadata as Record<string, string>).periode} · Sesi: {sessionId.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => router.push(`/psak117/${sessionId}`)}
                className="text-sm text-blue-400 hover:text-blue-300 border border-blue-800 px-3 py-1.5 rounded-lg"
              >
                Buka halaman penuh →
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {([
                { key: 'scorecard', label: '📊 Scorecard & Rasio' },
                { key: 'compliance', label: '⚖️ Compliance POJK' },
                { key: 'risiko', label: '⚠️ Pemetaan Risiko' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              {activeTab === 'scorecard' && renderScorecard()}
              {activeTab === 'compliance' && renderMarkdown(hasil.compliance as string)}
              {activeTab === 'risiko' && renderMarkdown(hasil.pemetaan_risiko as string)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
