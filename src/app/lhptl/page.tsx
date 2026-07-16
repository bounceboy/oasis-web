'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { HasilPengawasan } from '@/lib/lhptl-rules'
import Navbar from '@/components/oasis/Navbar'
import { useSessionPolling } from '@/lib/useSessionPolling'

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
  const fileGcgRef = useRef<HTMLInputElement>(null)
  const fileLapkeuPrevRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const [namaEntitas, setNamaEntitas]     = useState('')
  const [jenisEntitas, setJenisEntitas]   = useState<JenisEntitas>('pialang_asuransi')
  const [periode, setPeriode]             = useState('')
  const [file, setFile]                   = useState<File | null>(null)
  const [fileGcg, setFileGcg]             = useState<File | null>(null)
  const [fileLapkeuPrev, setFileLapkeuPrev] = useState<File | null>(null)

  const [hasil, setHasil]                 = useState<HasilData | null>(null)
  const [activeTab, setActiveTab]         = useState<'semua' | 'pelanggaran' | 'perhatian' | 'informasional'>('semua')
  const [error, setError]                 = useState('')
  const [riwayat, setRiwayat] = useState<{id: string; nama_entitas: string; created_at: string}[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pollingId, setPollingId] = useState<string | null>(null)

  useSessionPolling(pollingId, (data) => {
    setPollingId(null)
    setLoading(false)
    if (data.status === 'selesai' && data.hasil) {
      const h = data.hasil as unknown as HasilData
      setHasil({ ...h, sessionId: pollingId! })
      setSaveState('saved')
      addLog(`Selesai: ${h.ringkasan?.total ?? 0} temuan`)
      setStep(3)
      fetch('/api/sessions?modul=lhptl').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
    } else {
      setError('Analisis gagal di server. Coba lagi.')
      setStep(1)
    }
  })

  useEffect(() => {
    fetch('/api/sessions?modul=lhptl')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRiwayat(data) })
      .catch(() => {})
  }, [])

  async function handleSimpan() {
    if (!hasil?.sessionId) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/sessions/${hasil.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasil }),
      })
      if (!res.ok) throw new Error()
      setSaveState('saved')
      fetch('/api/sessions?modul=lhptl').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
    } catch {
      setSaveState('error')
    }
  }

  function addLog(msg: string) {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString('id-ID')}] ${msg}`])
  }

  async function handleAnalisis() {
    if (!file || !fileGcg || !fileLapkeuPrev || !namaEntitas.trim() || !periode.trim()) return
    setLoading(true); setError(''); setLog([]); setStep(2)

    try {
      addLog(`Mengupload file laporan keuangan: ${file.name}`)
      addLog(`Mengupload file laporan keuangan tahun sebelumnya: ${fileLapkeuPrev.name}`)
      addLog(`Mengupload file laporan GCG: ${fileGcg.name}`)
      addLog('Membaca sheet Excel...')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('fileGcg', fileGcg)
      fd.append('fileLapkeuPrev', fileLapkeuPrev)
      fd.append('namaEntitas', namaEntitas)
      fd.append('jenisEntitas', jenisEntitas)
      fd.append('periode', periode)

      addLog('AI mengekstrak data dari semua sheet...')
      addLog('Menjalankan rules deterministik...')
      addLog('Menyusun Kesimpulan dan Tindak Lanjut...')

      const res = await fetch('/api/lhptl/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analisis gagal')

      addLog('Analisis berjalan di server — aman untuk pindah halaman, hasil tersimpan di Riwayat.')
      setPollingId(data.sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setStep(1)
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
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar simple />

        {/* Header */}
        <div style={{ marginBottom: 26 }}>
          <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}><span style={{ color: '#45e661' }}>LHPTL</span> — pengawasan tidak langsung pialang</h1>
          <p style={{ fontSize: 12.5, color: '#8a949c', margin: '8px 0 0' }}>Upload form laporan keuangan pialang (Excel) — AI &amp; rules deterministik menyusun temuan.</p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 300, color: step >= s.n ? '#45e661' : '#5a646c' }}>{s.n}</span>
              <span style={{ fontSize: 12, color: step >= s.n ? '#eef2ef' : '#5a646c' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* Step 1: Form */}
        {step === 1 && (
          <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 6 }}>Nama entitas</label>
              <input value={namaEntitas} onChange={e => setNamaEntitas(e.target.value)}
                placeholder="PT Pialang Asuransi Mitra Utama"
                className="input-underline" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 6 }}>Jenis entitas</label>
                <select value={jenisEntitas} onChange={e => setJenisEntitas(e.target.value as JenisEntitas)}
                  className="input-underline">
                  <option value="pialang_asuransi">Pialang Asuransi</option>
                  <option value="pialang_reasuransi">Pialang Reasuransi</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 6 }}>Periode</label>
                <input value={periode} onChange={e => setPeriode(e.target.value)}
                  placeholder="31 Desember 2025"
                  className="input-underline" />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 8 }}>File Excel — Form Laporan Keuangan Pialang <span style={{ color: '#ff6f61' }}>*wajib</span></label>
              <label style={{ display: 'block', border: '1px dashed rgba(69,230,97,0.45)', borderRadius: 18, padding: 28, textAlign: 'center', cursor: 'pointer' }}>
                <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                {file ? <div style={{ fontWeight: 500, fontSize: 13.5, color: '#45e661' }}>📊 {file.name}</div>
                  : <div style={{ fontSize: 13.5, color: '#b7c0c6' }}>Klik untuk pilih file Excel (.xlsx / .xlsm)</div>}
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 8 }}>File Excel — Form Laporan Keuangan Pialang Tahun Sebelumnya <span style={{ color: '#ff6f61' }}>*wajib</span></label>
              <label style={{ display: 'block', border: '1px dashed rgba(69,230,97,0.45)', borderRadius: 18, padding: 28, textAlign: 'center', cursor: 'pointer' }}>
                <input ref={fileLapkeuPrevRef} type="file" accept=".xlsx,.xlsm,.xls" style={{ display: 'none' }} onChange={e => setFileLapkeuPrev(e.target.files?.[0] ?? null)} />
                {fileLapkeuPrev ? <div style={{ fontWeight: 500, fontSize: 13.5, color: '#45e661' }}>📊 {fileLapkeuPrev.name}</div>
                  : <div style={{ fontSize: 13.5, color: '#b7c0c6' }}>Klik untuk pilih file Excel tahun sebelumnya (.xlsx / .xlsm)</div>}
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 8 }}>File Excel — Laporan GCG <span style={{ color: '#ff6f61' }}>*wajib</span></label>
              <label style={{ display: 'block', border: '1px dashed rgba(69,230,97,0.45)', borderRadius: 18, padding: 28, textAlign: 'center', cursor: 'pointer' }}>
                <input ref={fileGcgRef} type="file" accept=".xlsx,.xlsm,.xls" style={{ display: 'none' }} onChange={e => setFileGcg(e.target.files?.[0] ?? null)} />
                {fileGcg ? <div style={{ fontWeight: 500, fontSize: 13.5, color: '#45e661' }}>📊 {fileGcg.name}</div>
                  : <div style={{ fontSize: 13.5, color: '#b7c0c6' }}>Klik untuk pilih file Excel Laporan GCG (.xlsx / .xlsm)</div>}
              </label>
            </div>

            {error && <p style={{ fontSize: 12.5, color: '#ff6f61', margin: 0 }}>{error}</p>}

            <button onClick={handleAnalisis}
              disabled={!file || !fileGcg || !fileLapkeuPrev || !namaEntitas.trim() || !periode.trim() || loading}
              className="btn-filled" style={{ alignSelf: 'flex-start' }}>
              Mulai Analisis LHPTL ↗
            </button>
          </div>
        )}

        {/* Step 2: Loading */}
        {step === 2 && (
          <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 56, textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#45e661', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontWeight: 500, fontSize: 15 }}>Membaca sheet &amp; menjalankan rules pengawasan…</div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, marginTop: 16, maxHeight: 140, overflowY: 'auto', textAlign: 'left' }}>
              {log.map((l, i) => <p key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#8a949c', margin: '2px 0' }}>{l}</p>)}
              {loading && <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#45e661', margin: '4px 0' }}>▋</p>}
            </div>
          </div>
        )}

        {/* Step 3: Hasil */}
        {step === 3 && hasil && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Scorecard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
              {[
                { label: 'Total Temuan',    value: hasil.ringkasan.total,           color: '#eef2ef' },
                { label: 'Pelanggaran',     value: hasil.ringkasan.pelanggaran,     color: '#ff6f61' },
                { label: 'Perlu Perhatian', value: hasil.ringkasan.perlu_perhatian, color: '#f5a142' },
                { label: 'Informasional',   value: hasil.ringkasan.informasional,   color: '#45e661' },
              ].map((s, i) => (
                <div key={s.label} style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: '#8a949c' }}>{s.label} <span style={{ float: 'right' }}>({String(i+1).padStart(2,'0')})</span></div>
                  <div style={{ fontSize: 44, fontWeight: 300, marginTop: 8, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {saveState !== 'saved'
                ? <button onClick={handleSimpan} disabled={saveState === 'saving'} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '9px 18px', fontSize: 11, color: '#8a949c', cursor: 'pointer', fontFamily: 'inherit', opacity: saveState === 'saving' ? 0.5 : 1 }}>
                    {saveState === 'saving' ? 'Menyimpan...' : saveState === 'error' ? '⚠ Coba Lagi Simpan' : 'Simpan Analisis'}
                  </button>
                : <span style={{ fontSize: 12, color: '#45e661' }}>✓ Tersimpan</span>
              }
              <a href={`/api/lhptl/download/${hasil.sessionId}`} download className="btn-filled" style={{ textDecoration: 'none', padding: '9px 20px', fontSize: 11 }}>
                Download LHPTL (.docx)
              </a>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: 5, maxWidth: 700, overflowX: 'auto' }}>
              {([
                ['semua',        `Semua (${hasil.ringkasan.total})`],
                ['pelanggaran',  `Pelanggaran (${hasil.ringkasan.pelanggaran})`],
                ['perhatian',    `Perlu Perhatian (${hasil.ringkasan.perlu_perhatian})`],
                ['informasional',`Informasional (${hasil.ringkasan.informasional})`],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{ flexShrink: 0, padding: '9px 16px', border: 'none', borderRadius: 999, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: activeTab === key ? '#45e661' : 'transparent', color: activeTab === key ? '#04120a' : '#8a949c', fontFamily: 'inherit' }}>{label}</button>
              ))}
            </div>

            {/* Tabel */}
            <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                    {filteredHasil.map(h => (
                      <tr key={h.nomor} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '14px 24px', color: '#45e661', width: 40, fontWeight: 300 }}>{h.nomor}</td>
                        <td style={{ padding: '14px 24px', lineHeight: 1.7, color: '#b7c0c6' }}>{h.catatan}</td>
                        <td style={{ padding: '14px 24px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {h.tipe === 'pelanggaran' && <span style={{ background: 'rgba(255,111,97,0.15)', color: '#ff6f61', padding: '4px 12px', borderRadius: 999, fontSize: 10.5, fontWeight: 500 }}>Pelanggaran</span>}
                          {h.tipe === 'perlu_perhatian' && <span style={{ background: 'rgba(245,161,66,0.15)', color: '#f5a142', padding: '4px 12px', borderRadius: 999, fontSize: 10.5, fontWeight: 500 }}>Perlu Perhatian</span>}
                          {h.tipe === 'informasional' && <span style={{ background: 'rgba(69,230,97,0.15)', color: '#45e661', padding: '4px 12px', borderRadius: 999, fontSize: 10.5, fontWeight: 500 }}>Informasional</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Kesimpulan */}
            <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 26 }}>
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}><span style={{ color: '#45e661' }}>Kesimpulan</span> pengawasan</div>
              <div style={{ fontSize: 13, lineHeight: 1.9, color: '#b7c0c6' }}>
                {hasil.kesimpulan.split('\n').filter(Boolean).map((p, i) => <p key={i} style={{ margin: '4px 0' }}>{p}</p>)}
              </div>
            </div>

            {/* Tindak Lanjut */}
            <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 26 }}>
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 14 }}><span style={{ color: '#45e661' }}>Tindak</span> lanjut</div>
              {hasil.tindak_lanjut.split(/\d+\.\s+/).filter(Boolean).map((poin, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <span style={{ fontSize: 14, fontWeight: 300, color: '#45e661', minWidth: 20 }}>{i + 1}</span>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: '#b7c0c6' }}>{poin}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>{/* end flex-1 */}

        {/* Riwayat sidebar */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#5a646c', marginBottom: 16 }}>RIWAYAT ANALISIS</div>
          {riwayat.length === 0 ? (
            <p style={{ fontSize: 12, color: '#5a646c' }}>Belum ada analisis tersimpan.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {riwayat.map(item => (
                <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama_entitas}</div>
                  <div style={{ fontSize: 11, color: '#8a949c', marginTop: 3 }}>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={async () => {
                      const r = await fetch(`/api/sessions?modul=lhptl`).then(x => x.json())
                      const found = Array.isArray(r) ? r.find((s: {id: string; hasil: HasilData}) => s.id === item.id) : null
                      if (found?.hasil) { setHasil({ ...found.hasil, sessionId: found.id }); setSaveState('saved'); setStep(3) }
                    }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '4px 10px', fontSize: 10.5, color: '#8a949c', cursor: 'pointer', fontFamily: 'inherit' }}>Lihat</button>
                    <button onClick={async () => {
                      if (!confirm(`Hapus analisis "${item.nama_entitas}"?`)) return
                      await fetch(`/api/sessions/${item.id}`, { method: 'DELETE' })
                      setRiwayat(prev => prev.filter(r => r.id !== item.id))
                    }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, color: '#5a646c', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>{/* end two-column */}
      </div>
    </div>
  )
}
