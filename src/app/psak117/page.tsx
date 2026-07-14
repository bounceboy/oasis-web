'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/oasis/Navbar'
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

    const ratingColor = skor.rating === 'Baik' ? '#45e661' :
      skor.rating === 'Cukup' ? '#f5c842' :
      skor.rating === 'Kurang' ? '#f5a142' : '#ff6f61'

    const thStyle: React.CSSProperties = { textAlign: 'left', padding: '14px 24px', fontSize: 10.5, color: '#8a949c', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }
    const tdStyle: React.CSSProperties = { padding: '13px 24px', fontSize: 13 }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Skor ringkas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {[
            { label: 'Metrik lulus', val: `${skor.nilai}/${skor.total}`, color: '#eef2ef' },
            { label: 'Rating keseluruhan', val: skor.rating, color: ratingColor },
            { label: 'Periode', val: dk.periode as string || '-', color: '#eef2ef' },
          ].map((item, i) => (
            <div key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: '#8a949c' }}>{item.label}</div>
              <div style={{ fontSize: 40, fontWeight: 300, marginTop: 8, color: item.color }}>{item.val}</div>
            </div>
          ))}
        </div>

        {/* Scorecard table */}
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>
              <th style={thStyle}>Metrik</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Nilai</th>
              <th style={thStyle}>Threshold</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            </tr></thead>
            <tbody>
              {scorecard.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{s.metric}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 300 }}>
                    {s.nilai != null ? (s.nilai < 10 ? (s.nilai * 100).toFixed(2) + '%' : s.nilai.toFixed(2) + 'x') : 'N/A'}
                  </td>
                  <td style={{ ...tdStyle, color: '#8a949c' }}>{s.threshold}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {s.pass === null ? <span style={{ color: '#5a646c' }}>–</span>
                      : s.pass ? <span style={{ background: 'rgba(69,230,97,0.15)', color: '#45e661', padding: '4px 12px', borderRadius: 999, fontSize: 10.5, fontWeight: 500 }}>✓ Lulus</span>
                      : <span style={{ background: 'rgba(255,111,97,0.15)', color: '#ff6f61', padding: '4px 12px', borderRadius: 999, fontSize: 10.5, fontWeight: 500 }}>✗ Tidak Lulus</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Data keuangan */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { title: `Posisi keuangan (${dk.unit})`, rows: [['Total Aset', dk.total_aset], ['Total Liabilitas', dk.total_liabilitas], ['Ekuitas', dk.total_ekuitas], ['Liab. Kontrak Asuransi', dk.liabilitas_kontrak_asuransi], ['CSM Penutup', dk.csm_penutup]] },
            { title: `Laba rugi (${dk.unit})`, rows: [['Pendapatan Asuransi', dk.pendapatan_asuransi], ['Beban Jasa Asuransi', dk.beban_jasa_asuransi], ['Klaim & Manfaat', dk.klaim_dan_manfaat], ['Hasil Investasi', dk.hasil_investasi], ['Profit Tahun Berjalan', dk.profit_tahun_berjalan]] },
          ].map(section => (
            <div key={section.title} style={{ background: 'rgba(8,12,18,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 24 }}>
              <div className="section-label" style={{ marginBottom: 14 }}>{section.title}</div>
              {section.rows.map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: '#8a949c' }}>{label as string}</span>
                  <span style={{ color: Number(val) < 0 ? '#ff6f61' : '#eef2ef' }}>{val != null ? Number(val).toLocaleString('id-ID') : '–'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderMarkdown(text: string) {
    return (
      <pre style={{ fontSize: 13.5, color: '#b7c0c6', whiteSpace: 'pre-wrap', lineHeight: 1.9, margin: 0, fontFamily: 'inherit' }}>
        {text}
      </pre>
    )
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  const riwayatPanel = (
    <div style={{ width: 280, flexShrink: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#5a646c', marginBottom: 16 }}>RIWAYAT ANALISIS</div>
      {riwayat.length === 0 ? (
        <p style={{ fontSize: 12, color: '#5a646c' }}>Belum ada analisis tersimpan.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {riwayat.map(item => (
            <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama_entitas}</div>
                  <div style={{ fontSize: 11, color: '#8a949c', marginTop: 3 }}>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  {(item as { hasil?: { scorecard?: { predikat?: string } } }).hasil?.scorecard?.predikat && (
                    <div style={{ marginTop: 6, display: 'inline-block', fontSize: 10.5, padding: '2px 10px', borderRadius: 999, background: 'rgba(69,230,97,0.1)', color: '#45e661', border: '1px solid rgba(69,230,97,0.25)' }}>
                      {(item as { hasil?: { scorecard?: { predikat?: string } } }).hasil!.scorecard!.predikat}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => router.push(`/psak117/${item.id}`)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '4px 10px', fontSize: 10.5, color: '#8a949c', cursor: 'pointer', fontFamily: 'inherit' }}>Lihat</button>
                  <button onClick={async () => { if (!confirm(`Hapus analisis "${item.nama_entitas}"?`)) return; await fetch(`/api/sessions/${item.id}`, { method: 'DELETE' }); setRiwayat(prev => prev.filter(r => r.id !== item.id)) }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, color: '#5a646c', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar />

        {/* Header */}
        <div style={{ marginBottom: 26 }}>
          <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}><span style={{ color: '#45e661' }}>PSAK 117</span> — analisis kepatuhan asuransi</h1>
          <p style={{ fontSize: 12.5, color: '#8a949c', margin: '8px 0 0' }}>Upload laporan keuangan audited — AI mengekstrak rasio, kepatuhan, dan pemetaan risiko.</p>
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

        {/* Log panel */}
        {log.length > 0 && (
          <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 20, maxHeight: 140, overflowY: 'auto' }}>
            {log.map((l, i) => <p key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#8a949c', margin: '2px 0' }}>{l}</p>)}
            {status === 'loading' && <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#45e661', margin: '4px 0' }}>Memproses...</p>}
          </div>
        )}

        {/* Two-column layout: main content + riwayat */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Step 1: Form upload */}
            {step === 1 && (
              <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 6 }}>Nama perusahaan</label>
                    <input value={namaEntitas} onChange={e => setNamaEntitas(e.target.value)} placeholder="PT Asuransi Jiwa Cahaya Abadi Tbk" className="input-underline" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 6 }}>Jenis usaha</label>
                    <select value={jenisUsaha} onChange={e => setJenisUsaha(e.target.value as JenisUsaha)} className="input-underline">
                      <option value="Jiwa">Asuransi Jiwa</option>
                      <option value="Umum">Asuransi Umum</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 6 }}>Periode laporan</label>
                  <input value={periode} onChange={e => setPeriode(e.target.value)} placeholder="31 Desember 2025" className="input-underline" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#8a949c', marginBottom: 8 }}>Laporan keuangan audited</label>
                  <label style={{ display: 'block', border: '1px dashed rgba(69,230,97,0.45)', borderRadius: 18, padding: 30, textAlign: 'center', cursor: 'pointer' }}>
                    <input ref={fileRef} type="file" accept=".pdf,.txt" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                    {file ? (
                      <div style={{ fontWeight: 500, fontSize: 13.5, color: '#45e661' }}>{file.name}</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 500, fontSize: 13.5, color: '#b7c0c6' }}>Klik untuk upload lapkeu (PDF)</div>
                        <div style={{ fontSize: 11.5, color: '#5a646c', marginTop: 5 }}>Maks 50 MB · dengan CALK lengkap</div>
                      </>
                    )}
                  </label>
                </div>

                <button onClick={handleAnalisis} disabled={status === 'loading'} className="btn-filled" style={{ alignSelf: 'flex-start' }}>
                  Mulai analisis ↗
                </button>
              </div>
            )}

            {/* Step 2: Processing */}
            {step === 2 && status === 'loading' && (
              <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 56, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#45e661', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontWeight: 500, fontSize: 15 }}>Menganalisis laporan keuangan…</div>
                <div style={{ fontSize: 12, color: '#8a949c', marginTop: 8 }}>Menghitung rasio, kepatuhan POJK, dan pemetaan risiko.</div>
              </div>
            )}

            {/* Step 2: Error */}
            {step === 2 && status === 'error' && (
              <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,100,97,0.3)', borderRadius: 24, padding: 32, textAlign: 'center' }}>
                <p style={{ color: '#ff6f61', fontWeight: 500, margin: '0 0 8px' }}>Analisis Gagal</p>
                <p style={{ color: '#8a949c', fontSize: 13, margin: '0 0 16px' }}>Lihat log di atas untuk detail error.</p>
                <button onClick={() => { setStep(1); setStatus('idle') }} style={{ background: 'transparent', border: 'none', color: '#45e661', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Kembali</button>
              </div>
            )}

            {/* Step 3: Hasil */}
            {step === 3 && hasil && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 500 }}>{(hasil.metadata as Record<string, string>).namaEntitas}</div>
                    <div style={{ fontSize: 12, color: '#8a949c', marginTop: 3 }}>{(hasil.metadata as Record<string, string>).jenisUsaha} · {(hasil.metadata as Record<string, string>).periode}</div>
                  </div>
                  <button onClick={() => { setStep(1); setStatus('idle') }} style={{ background: 'transparent', color: '#8a949c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '9px 18px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>+ Analisis baru</button>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 6, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: 5, marginBottom: 26 }}>
                  {([
                    { key: 'scorecard', label: 'Scorecard & Rasio' },
                    { key: 'compliance', label: 'Compliance POJK' },
                    { key: 'risiko', label: 'Pemetaan Risiko' },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 999, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', background: activeTab === tab.key ? '#45e661' : 'transparent', color: activeTab === tab.key ? '#04120a' : '#8a949c', fontFamily: 'inherit' }}>{tab.label}</button>
                  ))}
                </div>

                <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 28 }}>
                  {activeTab === 'scorecard' && renderScorecard()}
                  {activeTab === 'compliance' && renderMarkdown(hasil.compliance as string)}
                  {activeTab === 'risiko' && renderMarkdown(hasil.pemetaan_risiko as string)}
                </div>
              </div>
            )}

          </div>

          {/* Riwayat sidebar */}
          {riwayatPanel}
        </div>
      </div>
    </div>
  )
}
