'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
type Step = 1 | 2 | 3
type Status = 'idle' | 'loading' | 'done' | 'error'

export default function PemeriksaanPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [status, setStatus] = useState<Status>('idle')
  const [log, setLog] = useState<string[]>([])

  const [namaEntitas, setNamaEntitas] = useState('')
  const [jenisUsaha, setJenisUsaha] = useState('')
  const [jenisPemeriksaan, setJenisPemeriksaan] = useState('compliance')
  const [file, setFile] = useState<File | null>(null)
  const [docText, setDocText] = useState('')
  const [sessionId, setSessionId] = useState('')

  const [compliance, setCompliance] = useState('')
  const [risk, setRisk] = useState('')
  const [activeTab, setActiveTab] = useState<'compliance' | 'risk'>('compliance')

  function addLog(msg: string) {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString('id-ID')}] ${msg}`])
  }

  async function extractText(f: File): Promise<string> {
    if (f.name.endsWith('.txt')) {
      return await f.text()
    }
    if (f.name.endsWith('.pdf')) {
      addLog('Mengekstrak teks PDF...')
      // Gunakan pdf.js via dynamic import
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
      GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      const arrayBuffer = await f.arrayBuffer()
      const pdf = await getDocument({ data: arrayBuffer }).promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const tc = await page.getTextContent()
        pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '))
      }
      return pages.join('\n')
    }
    if (f.name.endsWith('.docx')) {
      addLog('Mengekstrak teks DOCX...')
      const mammoth = await import('mammoth')
      const arrayBuffer = await f.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value
    }
    throw new Error('Format file tidak didukung. Gunakan PDF, DOCX, atau TXT.')
  }

  async function handleStep1() {
    if (!file || !namaEntitas.trim() || !jenisUsaha.trim()) {
      alert('Lengkapi semua field dan upload dokumen')
      return
    }
    setStatus('loading')
    try {
      const text = await extractText(file)
      setDocText(text)
      addLog(`Dokumen dibaca: ${text.length.toLocaleString()} karakter`)

      const fd = new FormData()
      fd.append('file', file)
      fd.append('namaEntitas', namaEntitas)
      fd.append('jenisUsaha', jenisUsaha)
      fd.append('jenisPemeriksaan', jenisPemeriksaan)

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSessionId(data.sessionId)
      addLog(`Sesi dibuat: ${data.sessionId}`)

      setStep(2)
      setStatus('idle')
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('error')
    }
  }

  async function handleAnalyze() {
    setStatus('loading')
    addLog('Mencari referensi POJK relevan...')
    addLog('Mengirim dokumen ke AI untuk dianalisis...')

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, docText, namaEntitas, jenisUsaha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setCompliance(data.compliance)
      setRisk(data.risk)
      addLog('Analisis selesai')

      setStep(3)
      setStatus('done')
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('error')
    }
  }

  const steps = [
    { n: 1, label: 'Upload Dokumen' },
    { n: 2, label: 'Konfirmasi' },
    { n: 3, label: 'Hasil' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white text-sm">
          ← Dashboard
        </button>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Pemeriksaan Baru</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
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
              {i < steps.length - 1 && <div className="w-8 h-px bg-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* Log panel */}
        {log.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto">
            {log.map((l, i) => (
              <p key={i} className="text-xs font-mono text-slate-400">{l}</p>
            ))}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Upload Dokumen Pemeriksaan</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Nama Entitas</label>
                <input
                  value={namaEntitas}
                  onChange={(e) => setNamaEntitas(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="PT Asuransi Contoh"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Jenis Usaha</label>
                <select
                  value={jenisUsaha}
                  onChange={(e) => setJenisUsaha(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Pilih jenis usaha</option>
                  <option value="Asuransi Jiwa">Asuransi Jiwa</option>
                  <option value="Asuransi Jiwa Syariah">Asuransi Jiwa Syariah</option>
                  <option value="Asuransi Umum">Asuransi Umum</option>
                  <option value="Asuransi Umum Syariah">Asuransi Umum Syariah</option>
                  <option value="Reasuransi">Reasuransi</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Jenis Pemeriksaan</label>
              <div className="flex gap-3">
                {['compliance', 'risk', 'keduanya'].map((j) => (
                  <button
                    key={j}
                    onClick={() => setJenisPemeriksaan(j)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                      jenisPemeriksaan === j
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {j === 'compliance' ? 'Compliance' : j === 'risk' ? 'Risk-Based' : 'Keduanya'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Dokumen (PDF / DOCX / TXT)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-slate-500 transition-colors"
              >
                {file ? (
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-slate-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-400">Klik untuk pilih file</p>
                    <p className="text-slate-600 text-sm mt-1">PDF, DOCX, atau TXT — maks 50 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <button
              onClick={handleStep1}
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {status === 'loading' ? 'Memproses...' : 'Lanjut ke Masking →'}
            </button>
          </div>
        )}

        {/* Step 2 — Konfirmasi */}
        {step === 2 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Konfirmasi & Mulai Analisis</h2>

            <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Entitas</span>
                <span className="font-medium">{namaEntitas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jenis Usaha</span>
                <span>{jenisUsaha}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jenis Pemeriksaan</span>
                <span className="capitalize">{jenisPemeriksaan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dokumen</span>
                <span>{file?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ukuran Teks</span>
                <span>{docText.length.toLocaleString()} karakter</span>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-3 text-sm text-blue-300">
              Dokumen akan dikirim ke AI bersama referensi POJK yang relevan untuk dianalisis.
            </div>

            <button
              onClick={handleAnalyze}
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {status === 'loading' ? 'Menganalisis...' : 'Mulai Analisis →'}
            </button>
          </div>
        )}

        {/* Step 3 — Hasil */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Hasil Pemeriksaan</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/pemeriksaan/${sessionId}`)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Buka halaman penuh →
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {(['compliance', 'risk'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'compliance' ? 'Compliance Check' : 'Risk-Based'}
                </button>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                {activeTab === 'compliance' ? compliance : risk}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
