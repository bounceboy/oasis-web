'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Navbar from '@/components/oasis/Navbar'
import { parseLapbul, type LapbulData } from '@/lib/lapbul/parse'
import {
  analyze, DEFAULT_PARAMS, LINGKUP, STAT, fmtVal, idn, refLabel, rpF, rpS, sheetTitle,
  type Analysis, type Lingkup, type Params, type Ref, type Status,
} from '@/lib/lapbul/engine'
import { susunDataAi, type AiRecord } from '@/lib/lapbul/ai-shared'

type Tab = 'ai' | 'ringkasan' | 'angka' | 'uji' | 'anomali' | 'hitung'
const TABS: [Tab, string][] = [['ringkasan', 'Ringkasan'], ['angka', 'Angka dan rasio'], ['uji', 'Pengujian ketentuan'], ['anomali', 'Anomali'], ['hitung', 'Hitung ulang'], ['ai', 'Analisis AI']]

interface RiwayatItem { id: string; nama_entitas: string; created_at: string; ringkasan: { posisi?: string; sum?: Record<Status, number> } | null }
interface Loaded { file: File; data?: LapbulData; error?: string }

const MAX_FILE = 25 * 1024 * 1024

export default function LapbulPage() {
  const [files, setFiles] = useState<Loaded[]>([])
  const [nama, setNama] = useState('')
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [main, setMain] = useState<LapbulData | null>(null)
  const [prior, setPrior] = useState<LapbulData[]>([])
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [dlState, setDlState] = useState<'idle' | 'busy'>('idle')
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([])
  const [stack, setStack] = useState<Ref[]>([])
  const [filterUji, setFilterUji] = useState<'all' | Status>('all')
  const fileRef = useRef<HTMLInputElement>(null)
  const [ai, setAi] = useState<AiRecord | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [detik, setDetik] = useState(0)
  const aiRun = useRef(0) // jawaban dari analisis yang sudah ditinggalkan diabaikan

  useEffect(() => {
    if (!aiBusy) return
    const t = setInterval(() => setDetik(d => d + 1), 1000)
    return () => clearInterval(t)
  }, [aiBusy])

  async function jalankanAi(L: LapbulData, pembanding: LapbulData[], P: Params) {
    const run = ++aiRun.current
    setAiBusy(true); setAiError(null); setDetik(0)
    try {
      const data = susunDataAi(L, analyze(L, pembanding, P), P)
      const res = await fetch('/api/lapbul/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) })
      const d = await res.json().catch(() => ({ error: `Server tidak merespons (${res.status})` }))
      if (aiRun.current !== run) return
      if (!res.ok) throw new Error(d.error || 'Analisis AI gagal')
      setAi({ hasil: d.hasil, model: d.model, angkaPerluCek: d.angkaPerluCek || [], params: P, dibuat: new Date().toISOString() })
      setSaveState('idle')
    } catch (e) {
      if (aiRun.current !== run) return
      setAiError(e instanceof Error ? e.message : 'Analisis AI gagal')
    }
    setAiBusy(false)
  }
  const batalkanAi = () => { aiRun.current++; setAiBusy(false); setAiError(null) }

  const A: Analysis | null = useMemo(() => (main ? analyze(main, prior, params) : null), [main, prior, params])

  const loadRiwayat = () => fetch('/api/lapbul').then(r => r.json()).then(d => { if (Array.isArray(d)) setRiwayat(d) }).catch(() => {})
  useEffect(() => { loadRiwayat() }, [])

  async function onPick(list: FileList | null) {
    if (!list?.length) return
    setError(null)
    const out: Loaded[] = []
    for (const f of Array.from(list).slice(0, 4)) {
      if (!/\.xlsx?$/i.test(f.name)) { out.push({ file: f, error: 'Bukan berkas Excel' }); continue }
      if (f.size > MAX_FILE) { out.push({ file: f, error: 'Lebih dari 25 MB' }); continue }
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
        out.push({ file: f, data: parseLapbul(wb, f.name) })
      } catch (e) { out.push({ file: f, error: e instanceof Error ? e.message : 'Gagal dibaca' }) }
    }
    setFiles(out)
    const ok = out.filter(x => x.data).map(x => x.data!).sort((a, b) => b.posisiISO.localeCompare(a.posisiISO))
    if (ok[0] && !nama) setNama(ok[0].entitas)
  }

  function runAnalysis() {
    const ok = files.filter(x => x.data).map(x => x.data!).sort((a, b) => b.posisiISO.localeCompare(a.posisiISO))
    if (!ok.length) { setError('Belum ada lapbul yang terbaca.'); return }
    setBusy(true)
    setMain(ok[0]); setPrior(ok.slice(1)); setSavedId(null); setSaveState('idle'); setTab('ai'); setStack([]); setAi(null)
    void jalankanAi(ok[0], ok.slice(1), params)
    if (!nama) setNama(ok[0].entitas)
    setBusy(false)
  }

  async function openRiwayat(id: string) {
    setError(null)
    const r = await fetch(`/api/sessions/${id}`).then(r => r.json()).catch(() => null)
    const h = r?.hasil
    if (!h?.main) { setError('Riwayat tidak dapat dibuka.'); return }
    const item = riwayat.find(x => x.id === id)
    setMain(h.main); setPrior(h.prior || []); setParams({ ...DEFAULT_PARAMS, ...h.params }); setNama(item?.nama_entitas || h.main.entitas)
    batalkanAi(); setAi(h.ai || null)
    setSavedId(id); setSaveState('saved'); setTab('ringkasan'); setStack([])
  }

  async function hapusRiwayat(id: string) {
    if (!confirm('Hapus riwayat analisis ini?')) return
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (savedId === id) setSavedId(null)
    loadRiwayat()
  }

  async function simpan() {
    if (!main || !A) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/lapbul', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: savedId, namaEntitas: nama || main.entitas, main, prior, params, ai, ringkasan: { posisi: main.posisi, posisiISO: main.posisiISO, sum: A.sum, file: main.file } }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSavedId(d.id); setSaveState('saved'); loadRiwayat()
    } catch (e) { setSaveState('error'); setError('Gagal menyimpan: ' + (e instanceof Error ? e.message : '')) }
  }

  async function unduh() {
    if (!main || !A) return
    setDlState('busy')
    try {
      const [{ Packer }, { buildReportDoc, reportFileName }] = await Promise.all([import('docx'), import('@/lib/lapbul/docx')])
      const logo = await fetch('/lapbul/ojk-logo.png').then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null)
      const dibaca = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      const doc = buildReportDoc({ L: main, A, P: params, namaEntitas: nama || main.entitas, logo: logo ? new Uint8Array(logo) : null, dibaca, ai })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = reportFileName(nama || main.entitas, main); a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) { setError('Gagal membuat Word: ' + (e instanceof Error ? e.message : '')) }
    setDlState('idle')
  }

  const setP = (p: Partial<Params>) => { setParams(x => ({ ...x, ...p })); if (saveState === 'saved') setSaveState('idle') }
  const reset = () => { batalkanAi(); setAi(null); setMain(null); setPrior([]); setFiles([]); setNama(''); setParams(DEFAULT_PARAMS); setSavedId(null); setSaveState('idle'); setStack([]) }

  // ───────── komponen kecil ─────────
  const Chip = ({ r, push }: { r: Ref; push?: boolean }) => (
    <button className={`chip ${r.t === 'd' ? 'chip-d' : ''}`} title="Lihat jejak sumber"
      onClick={e => { e.stopPropagation(); setStack(s => (push ? [...s, r] : [r])) }}>
      {A ? refLabel(r, A.D) : ''}
    </button>
  )
  const Pill = ({ s }: { s: Status }) => <span className={`pill pill-${s}`}>{STAT[s]}</span>

  return (
    <div className="lb">
      <style jsx global>{`
        .container { max-width: 1280px; margin: 0 auto; padding: 20px 24px 64px; }
        .title { font-size: 26px; font-weight: 500; color: #eef2ef; }
        .title span { color: #45e661; }
        .subtitle { color: #aab4bc; font-size: 12.5px; margin: 8px 0 0; max-width: 720px; line-height: 1.6; }
        .card { background: rgba(8,12,18,0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 28px; }
        .lb label { display: block; font-size: 12px; color: #aab4bc; margin-bottom: 6px; }
        .lb input[type="text"], .lb input[type="number"], .lb input[type="date"], .lb select {
          width: 100%; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.15);
          padding: 8px 0; color: #eef2ef; font-size: 13.5px; outline: none; box-sizing: border-box; font-family: inherit; color-scheme: dark;
        }
        .lb select option { background: #0b1016; }
        .lb input:focus, .lb select:focus { border-bottom-color: #45e661; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .upload-zone { border: 1px dashed rgba(69,230,97,0.45); border-radius: 18px; padding: 26px; text-align: center; cursor: pointer; }
        .upload-hint { color: #828d96; font-size: 11.5px; margin-top: 6px; line-height: 1.6; }
        .flist { margin-top: 14px; display: grid; gap: 8px; }
        .fitem { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .fitem .fn { color: #eef2ef; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fitem .fm { color: #828d96; white-space: nowrap; }
        .fitem .fe { color: #ff6f61; }
        .tag { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #45e661; margin-left: 8px; }
        .btn { padding: 11px 24px; border-radius: 999px; border: none; cursor: pointer; font-weight: 600; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-family: inherit; }
        .btn-primary { background: #45e661; color: #04120a; }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-outline { background: transparent; color: #aab4bc; border: 1px solid rgba(255,255,255,0.15); }
        .error-box { background: rgba(255,111,97,0.08); border: 1px solid rgba(255,111,97,0.3); border-radius: 12px; padding: 12px 16px; color: #ff6f61; font-size: 12.5px; margin-bottom: 16px; }
        .note { font-size: 11.5px; color: #828d96; line-height: 1.6; }

        .hasil-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .hasil-title { font-size: 18px; font-weight: 500; color: #eef2ef; }
        .hasil-meta { color: #aab4bc; font-size: 12px; margin-top: 4px; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; padding: 14px 18px; border-radius: 16px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 18px; }
        .settings label { font-size: 11px; }
        .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .tile { border-radius: 16px; padding: 14px 16px; border: 1px solid rgba(255,255,255,0.06); cursor: pointer; text-align: left; font-family: inherit; background: rgba(255,255,255,0.02); }
        .tile .n { font-size: 26px; font-weight: 500; font-variant-numeric: tabular-nums; }
        .tile .l { font-size: 11.5px; color: #aab4bc; margin-top: 2px; }
        .t-ok .n { color: #45e661; } .t-bad .n { color: #ff6f61; } .t-warn .n { color: #f5c542; } .t-na .n { color: #828d96; }
        .tabs { display: flex; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 18px; overflow-x: auto; }
        .tabs button { background: none; border: none; border-bottom: 2px solid transparent; color: #aab4bc; padding: 10px 14px; font-size: 12.5px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .tabs button.on { color: #eef2ef; border-bottom-color: #45e661; }
        .tabs .cnt { font-size: 10.5px; color: #828d96; margin-left: 6px; }

        .pill { display: inline-block; font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .pill-ok { background: rgba(69,230,97,0.12); color: #45e661; }
        .pill-bad { background: rgba(255,111,97,0.14); color: #ff6f61; }
        .pill-warn { background: rgba(245,197,66,0.14); color: #f5c542; }
        .pill-na { background: rgba(255,255,255,0.06); color: #828d96; }
        .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #8fd7ff; background: rgba(143,215,255,0.08); border: 1px solid rgba(143,215,255,0.2); border-radius: 6px; padding: 2px 7px; margin: 2px 4px 2px 0; cursor: pointer; }
        .chip:hover { background: rgba(143,215,255,0.16); }
        .chip-d { color: #c9b6ff; background: rgba(201,182,255,0.08); border-color: rgba(201,182,255,0.22); }

        .test { border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px 18px; margin-bottom: 10px; background: rgba(255,255,255,0.015); }
        .test-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .test-title { font-size: 14px; color: #eef2ef; font-weight: 500; }
        .test-pasal { font-size: 11px; color: #828d96; margin-top: 3px; }
        .test-num { display: flex; gap: 22px; margin: 12px 0 6px; flex-wrap: wrap; }
        .test-num div { font-size: 11px; color: #828d96; }
        .test-num b { display: block; font-size: 15px; color: #eef2ef; font-weight: 500; font-variant-numeric: tabular-nums; margin-top: 2px; }
        .test-calc { font-size: 12px; color: #b7c0c6; line-height: 1.6; }
        .test-aturan { font-size: 11.5px; color: #828d96; line-height: 1.6; margin-top: 6px; font-style: italic; }
        .grp { font-size: 10.5px; font-weight: 500; color: #828d96; text-transform: uppercase; letter-spacing: 0.12em; margin: 22px 0 10px; }
        .filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
        .filters button { font-size: 11.5px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #aab4bc; cursor: pointer; font-family: inherit; }
        .filters button.on { border-color: #45e661; color: #eef2ef; }

        table.t { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        table.t th { text-align: left; color: #828d96; font-weight: 500; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        table.t td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #b7c0c6; vertical-align: top; }
        table.t td.num { text-align: right; font-variant-numeric: tabular-nums; color: #eef2ef; white-space: nowrap; }
        .tw { overflow-x: auto; }
        .kv { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
        .kv-item { border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 12px 14px; }
        .kv-item .k { font-size: 11.5px; color: #828d96; }
        .kv-item .v { font-size: 16px; color: #eef2ef; margin: 4px 0 4px; font-variant-numeric: tabular-nums; }
        .seg { display: inline-flex; border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; overflow: hidden; }
        .seg button { background: none; border: none; color: #aab4bc; padding: 7px 14px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .seg button.on { background: rgba(69,230,97,0.14); color: #eef2ef; }
        .concl { border-radius: 14px; padding: 12px 16px; font-size: 12.5px; line-height: 1.6; margin-top: 10px; }
        .concl.ok { background: rgba(69,230,97,0.07); color: #bdf5c7; } .concl.bad { background: rgba(255,111,97,0.08); color: #ffc2bb; }

        .side { width: 280px; flex-shrink: 0; }
        .rw { padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 8px; cursor: pointer; }
        .rw:hover { border-color: rgba(69,230,97,0.4); }
        .rw .a { font-size: 12.5px; color: #eef2ef; }
        .rw .b { font-size: 11px; color: #828d96; margin-top: 3px; display: flex; justify-content: space-between; }
        .rw .x { background: none; border: none; color: #828d96; cursor: pointer; font-size: 11px; }

        .drawer-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 40; }
        .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(520px, 100vw); background: #0b1016; border-left: 1px solid rgba(255,255,255,0.1); z-index: 41; display: flex; flex-direction: column; }
        .dh { padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        .dh .ttl { font-size: 11px; color: #828d96; letter-spacing: .12em; text-transform: uppercase; }
        .db { padding: 18px 22px; overflow-y: auto; flex: 1; }
        .dv { font-size: 22px; color: #eef2ef; font-variant-numeric: tabular-nums; margin: 6px 0 12px; }
        .dl { display: grid; grid-template-columns: 110px 1fr; gap: 6px 12px; font-size: 12px; margin-bottom: 16px; }
        .dl dt { color: #828d96; } .dl dd { margin: 0; color: #d6dde1; word-break: break-word; }
        .formula { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #c9b6ff; background: rgba(201,182,255,0.06); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; line-height: 1.6; }
        .excerpt { font-size: 11.5px; width: 100%; border-collapse: collapse; }
        .excerpt td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #aab4bc; }
        .excerpt tr.hit td { background: rgba(69,230,97,0.1); color: #eef2ef; }
        .excerpt td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .icon-btn { background: none; border: 1px solid rgba(255,255,255,0.12); color: #aab4bc; border-radius: 999px; padding: 5px 12px; cursor: pointer; font-size: 11.5px; font-family: inherit; }
        .ai-load { text-align: center; padding: 44px 16px; }
        .spin { width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(69,230,97,0.2); border-top-color: #45e661; margin: 0 auto 16px; animation: putar .9s linear infinite; }
        @keyframes putar { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
        .ai-warn { border: 1px solid rgba(245,197,66,0.3); background: rgba(245,197,66,0.07); color: #f5d98a; border-radius: 12px; padding: 10px 14px; font-size: 12px; line-height: 1.6; margin-bottom: 12px; }
        .ai-list { margin: 6px 0 0; padding-left: 18px; }
        @media (max-width: 960px) { .side { display: none; } .tiles { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <div className="container">
        <Navbar simple />
        <div style={{ marginBottom: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="title"><span>Cadangan Klaim</span> — analisis lapbul penjaminan</div>
            <div className="subtitle">Unggah laporan bulanan APOLO (LBPPNJK). Angka dibaca langsung dari kode komponen, diuji terhadap POJK 11/2025, dicek konsistensinya antar lembar, dan setiap angka dapat ditelusuri ke sel asalnya.</div>
          </div>
          {main && <button className="btn btn-outline" onClick={reset}>+ Analisis baru</button>}
        </div>

        <div style={{ display: 'flex', gap: 36, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {error && <div className="error-box">{error}</div>}

            {/* ───────── unggah ───────── */}
            {!main && (
              <div className="card">
                <div className="upload-zone" onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onPick(e.dataTransfer.files) }}>
                  <div style={{ color: '#eef2ef', fontWeight: 500, fontSize: 14 }}>Klik atau tarik berkas lapbul (.xlsx) ke sini</div>
                  <div className="upload-hint">
                    Berkas utama: lapbul posisi yang dianalisis. Opsional: tambahkan lapbul posisi tiga bulan sebelumnya<br />
                    (mis. Maret untuk posisi Juni) agar IBNR dihitung tepat. Maks. 4 berkas, dibaca di peramban.
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple style={{ display: 'none' }} onChange={e => { onPick(e.target.files); e.target.value = '' }} />
                </div>
                {files.length > 0 && (
                  <div className="flist">
                    {[...files].sort((a, b) => (b.data?.posisiISO || '').localeCompare(a.data?.posisiISO || '')).map((f, i) => (
                      <div className="fitem" key={f.file.name + i}>
                        <span className="fn">{f.file.name}{f.data && i === 0 && <span className="tag">utama</span>}{f.data && i > 0 && <span className="tag" style={{ color: '#8fd7ff' }}>pembanding IBNR</span>}</span>
                        {f.data ? <span className="fm">{f.data.posisi || 'posisi ?'} · {Object.keys(f.data.sheets).length} lembar</span> : <span className="fe">{f.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="form-grid">
                  <div>
                    <label>Nama perusahaan</label>
                    <input type="text" value={nama} onChange={e => setNama(e.target.value)} placeholder="Terisi otomatis dari lembar profil" />
                  </div>
                  <div>
                    <label>Lingkup wilayah (Pasal 43)</label>
                    <select value={params.lingkup} onChange={e => setP({ lingkup: e.target.value as Lingkup })}>
                      {Object.entries(LINGKUP).map(([k, v]) => <option key={k} value={k}>{v.label} · min {rpS(v.min)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Tanggal lapbul diterima (opsional)</label>
                    <input type="date" value={params.tglTerima} onChange={e => setP({ tglTerima: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span className="note">Angka dan status dihitung dengan aturan tetap; AI menelaah anomali dan menyusun draf analisis.</span>
                  <button className="btn btn-primary" disabled={busy || !files.some(f => f.data)} onClick={runAnalysis}>Analisis →</button>
                </div>
              </div>
            )}

            {/* ───────── hasil ───────── */}
            {main && A && (
              <div className="card">
                <div className="hasil-head">
                  <div>
                    <div className="hasil-title">{nama || main.entitas}</div>
                    <div className="hasil-meta">Posisi {main.posisi || '—'} · {main.file}{prior.length ? ` · pembanding: ${prior.map(p => p.posisi).join(', ')}` : ''}</div>
                  </div>
                  <div className="actions">
                    <button className="btn btn-outline" onClick={simpan} disabled={aiBusy || saveState === 'saving' || saveState === 'saved'}>
                      {saveState === 'saving' ? 'Menyimpan…' : saveState === 'saved' ? '✓ Tersimpan' : 'Simpan'}
                    </button>
                    <button className="btn btn-primary" onClick={unduh} disabled={aiBusy || dlState === 'busy'}>{aiBusy ? 'Menunggu AI…' : dlState === 'busy' ? 'Menyiapkan…' : '⬇ Unduh Word'}</button>
                  </div>
                </div>

                <div className="settings">
                  <div>
                    <label>Lingkup wilayah (Pasal 43)</label>
                    <select value={params.lingkup} onChange={e => setP({ lingkup: e.target.value as Lingkup })}>
                      {Object.entries(LINGKUP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Porsi ditanggung sendiri (%)</label>
                    <input type="number" min={0} max={100} value={params.porsi} onChange={e => setP({ porsi: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                  </div>
                  <div>
                    <label>Tanggal lapbul diterima</label>
                    <input type="date" value={params.tglTerima} onChange={e => setP({ tglTerima: e.target.value })} />
                  </div>
                </div>

                <div className="tiles">
                  {(['ok', 'bad', 'warn', 'na'] as Status[]).map(s => (
                    <button key={s} className={`tile t-${s}`} onClick={() => { setTab('uji'); setFilterUji(s) }}>
                      <div className="n">{A.sum[s]}</div><div className="l">{STAT[s]}</div>
                    </button>
                  ))}
                </div>

                <div className="tabs">
                  {TABS.map(([k, l]) => (
                    <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                      {l}
                      {k === 'uji' && <span className="cnt">{A.tests.length}</span>}
                      {k === 'anomali' && <span className="cnt">{A.checks.filter(c => c.status === 'warn').length}/{A.checks.length}</span>}
                    </button>
                  ))}
                </div>

                {tab === 'ai' && (
                  <AiPanel ai={ai} busy={aiBusy} error={aiError} detik={detik} stale={!!ai && (ai.params.lingkup !== params.lingkup || ai.params.porsi !== params.porsi || ai.params.tglTerima !== params.tglTerima)}
                    onRun={() => jalankanAi(main, prior, params)} A={A} L={main} Chip={Chip} />
                )}

                {tab === 'ringkasan' && <Ringkasan A={A} nama={nama || main.entitas} L={main} onTab={setTab} Pill={Pill} />}

                {tab === 'angka' && (
                  <div>
                    <div className="kv">
                      {KEY_FIG.map(([lbl, sheet, k]) => {
                        const r = main.sheets[sheet]?.rows.find(x => x.k === k)
                        const c = r?.cells.find(c => typeof c.v === 'number')
                        if (!r || !c) return null
                        const ref: Ref = { t: 's', sheet, k, h: c.h, addr: c.addr, r: r.r, u: r.u, v: c.v, file: main.file }
                        return <div className="kv-item" key={k}><div className="k">{lbl}</div><div className="v">{rpS(c.v as number)}</div><Chip r={ref} /></div>
                      })}
                      {(['cadKlaim', 'utangKlaim', 'klDiproses', 'nilaiJaminanKlaim', 'ibnr'] as const).map(id => A.D[id] && (
                        <div className="kv-item" key={id}><div className="k">{A.D[id].label}</div><div className="v">{rpS(A.D[id].value)}</div><Chip r={{ t: 'd', id }} /></div>
                      ))}
                    </div>
                    <div className="grp">Rasio: dilaporkan perusahaan vs hitung ulang</div>
                    <div className="tw"><table className="t">
                      <thead><tr><th>Rasio</th><th style={{ textAlign: 'right' }}>Dilaporkan</th><th style={{ textAlign: 'right' }}>Hitung ulang</th><th>Hasil</th><th>Sumber</th></tr></thead>
                      <tbody>{A.ratios.map(r => (
                        <tr key={r.nama}>
                          <td>{r.nama}</td>
                          <td className="num">{r.dilaporkan ? fmtVal(r.dilaporkan.v, r.unit) : '—'}</td>
                          <td className="num">{r.hitung}</td>
                          <td>{r.same === null ? '—' : r.same ? <span className="pill pill-ok">sama</span> : <span className="pill pill-warn">berbeda</span>}</td>
                          <td>{r.dilaporkan && <Chip r={r.dilaporkan} />}<Chip r={{ t: 'd', id: { 'Gearing ratio': 'gearing', 'Rasio likuiditas': 'likuid', 'Klaim terhadap IJP (basis bruto)': 'klaimIjpBruto', 'Klaim terhadap IJP (basis bersih)': 'klaimIjpBersih' }[r.nama] || '' }} /></td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                    <div className="grp">Komposisi investasi yang diuji (terhadap jumlah investasi)</div>
                    <div className="tw"><table className="t"><tbody>
                      {(['depMax', 'rdMax', 'rdTot', 'tbPct', 'pyPct', 'produktif'] as const).map(id => (
                        <tr key={id}><td>{A.D[id].label}</td><td className="num">{fmtVal(A.D[id].value, A.D[id].unit)}</td><td><Chip r={{ t: 'd', id }} /></td></tr>
                      ))}
                    </tbody></table></div>
                  </div>
                )}

                {tab === 'uji' && (
                  <div>
                    <div className="filters">
                      {(['all', 'ok', 'bad', 'warn', 'na'] as const).map(f => (
                        <button key={f} className={filterUji === f ? 'on' : ''} onClick={() => setFilterUji(f)}>{f === 'all' ? `Semua (${A.tests.length})` : `${STAT[f]} (${A.sum[f]})`}</button>
                      ))}
                    </div>
                    {[...new Set(A.tests.map(t => t.grp))].map(g => {
                      const list = A.tests.filter(t => t.grp === g && (filterUji === 'all' || t.status === filterUji))
                      if (!list.length) return null
                      return (
                        <div key={g}>
                          <div className="grp">{g}</div>
                          {list.map(t => (
                            <div className="test" key={t.id}>
                              <div className="test-head">
                                <div><div className="test-title">{t.judul}</div><div className="test-pasal">{t.pasal}</div></div>
                                <Pill s={t.status} />
                              </div>
                              {t.status !== 'na' || t.nilai !== '—' ? (
                                <div className="test-num"><div>Nilai<b>{t.nilai}</b></div><div>Batas<b>{t.batas}</b></div></div>
                              ) : null}
                              {t.calc && <div className="test-calc">{t.calc}</div>}
                              {t.note && <div className="test-calc" style={{ color: '#aab4bc', marginTop: 4 }}>{t.note}</div>}
                              <div className="test-aturan">{t.aturan}</div>
                              {t.refs.length > 0 && <div style={{ marginTop: 8 }}>{t.refs.map((r, i) => <Chip key={i} r={r} />)}</div>}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {tab === 'anomali' && (
                  <div>
                    <p className="note" style={{ marginTop: 0 }}>Angka yang sama dilaporkan di beberapa lembar dibandingkan. Selisih tidak otomatis berarti salah; perlu dikonfirmasi ke perusahaan.</p>
                    {A.checks.map(c => (
                      <div className="test" key={c.id}>
                        <div className="test-head">
                          <div className="test-title">{c.judul}</div>
                          <span className={`pill pill-${c.status === 'ok' ? 'ok' : c.status === 'warn' ? 'warn' : 'na'}`}>{c.status === 'ok' ? 'Sejalan' : c.status === 'warn' ? `Selisih ${c.selisih}` : 'Tidak dapat diuji'}</span>
                        </div>
                        <div className="test-calc" style={{ marginTop: 8 }}>{c.ket}</div>
                        {c.dampak && <div className="test-calc" style={{ color: '#f5c542', marginTop: 4 }}>{c.dampak}</div>}
                        {c.refs.length > 0 && <div style={{ marginTop: 8 }}>{c.refs.map((r, i) => <Chip key={i} r={r} />)}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'hitung' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                      <div className="test-title">Cadangan klaim — POJK 11/2025 Pasal 30</div>
                      <div className="seg">
                        <button className={params.skenario === 'berjalan' ? 'on' : ''} onClick={() => setP({ skenario: 'berjalan' })}>Klaim berjalan</button>
                        <button className={params.skenario === 'periode' ? 'on' : ''} onClick={() => setP({ skenario: 'periode' })}>Seluruh klaim periode</button>
                      </div>
                    </div>
                    <p className="note" style={{ marginTop: 0 }}>
                      &quot;Klaim yang dilaporkan&quot; dapat dibaca sebagai klaim yang masih diproses (lembar 3500) atau seluruh klaim yang dilaporkan pada periode (nilai jaminan, lembar 3400). Porsi ditanggung sendiri: {idn(params.porsi, 0)}% (ubah di pengaturan). {A.ibnr.ket}
                    </p>
                    {(() => {
                      const sc = A.scn.find(s => s.sk === params.skenario)!
                      return (
                        <>
                          <div className="tw"><table className="t">
                            <thead><tr><th>No</th><th>Langkah</th><th style={{ textAlign: 'right' }}>Nilai</th><th>Sumber</th></tr></thead>
                            <tbody>{sc.steps.map(s => (
                              <tr key={s.no} style={s.no === '8' ? { fontWeight: 600 } : undefined}>
                                <td>{s.no}</td>
                                <td>{s.label}{s.dasar && <div className="note">{s.dasar}</div>}</td>
                                <td className="num" style={s.no === '8' ? { color: s.value < 0 ? '#ff6f61' : '#45e661' } : undefined}>{rpF(s.value)}</td>
                                <td>{s.refs.map((r, i) => <Chip key={i} r={r} />)}</td>
                              </tr>
                            ))}</tbody>
                          </table></div>
                          <div className={`concl ${sc.ok ? 'ok' : 'bad'}`}>
                            {sc.ok ? `Cadangan klaim di neraca memadai menurut pembacaan ini, lebih besar ${rpF(sc.selisih)} dari pembanding.` : `Indikasi kekurangan cadangan klaim ${rpF(-sc.selisih)} menurut pembacaan ini.`}
                            {A.scn[0].ok !== A.scn[1].ok && ' Kedua pembacaan memberi kesimpulan berbeda, sehingga ketentuan ditandai Perlu klarifikasi.'}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ───────── riwayat ───────── */}
          <div className="side">
            <div className="grp" style={{ marginTop: 0 }}>Riwayat analisis</div>
            {riwayat.length === 0 && <div className="note">Belum ada analisis tersimpan.</div>}
            {riwayat.map(r => (
              <div className="rw" key={r.id} onClick={() => openRiwayat(r.id)} style={savedId === r.id ? { borderColor: 'rgba(69,230,97,0.5)' } : undefined}>
                <div className="a">{r.nama_entitas}</div>
                <div className="b">
                  <span>{r.ringkasan?.posisi || new Date(r.created_at).toLocaleDateString('id-ID')}</span>
                  <button className="x" onClick={e => { e.stopPropagation(); hapusRiwayat(r.id) }}>hapus</button>
                </div>
                {r.ringkasan?.sum && <div className="b"><span style={{ color: '#45e661' }}>{r.ringkasan.sum.ok} memenuhi</span><span style={{ color: '#ff6f61' }}>{r.ringkasan.sum.bad} tidak</span><span style={{ color: '#f5c542' }}>{r.ringkasan.sum.warn} klarifikasi</span></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────── panel jejak sumber ───────── */}
      {A && main && stack.length > 0 && (
        <>
          <div className="drawer-bg" onClick={() => setStack([])} />
          <div className="drawer" role="dialog" aria-label="Jejak sumber">
            <div className="dh">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {stack.length > 1 && <button className="icon-btn" onClick={() => setStack(s => s.slice(0, -1))}>← Kembali</button>}
                <span className="ttl">Jejak sumber</span>
              </div>
              <button className="icon-btn" onClick={() => setStack([])}>Tutup ✕</button>
            </div>
            <div className="db"><SourceView r={stack[stack.length - 1]} A={A} L={[main, ...prior]} Chip={Chip} /></div>
          </div>
        </>
      )}
    </div>
  )
}

const KEY_FIG: [string, string, string][] = [
  ['Ekuitas', '1000', '1000040000'], ['Jumlah investasi', '1000', '1000020000'], ['Total penjaminan', '1000', '1000100000'],
  ['IJP bruto', '1200', '12000101010000'], ['Pendapatan IJP bersih', '1200', '12000101060000'], ['Beban klaim', '1200', '12000201010000'],
  ['Laba bersih', '1000', '1000050000'], ['Piutang subrogasi', '1000', '1000170000'],
]

function Ringkasan({ A, nama, L, onTab, Pill }: { A: Analysis; nama: string; L: LapbulData; onTab: (t: Tab) => void; Pill: (p: { s: Status }) => React.ReactElement }) {
  const tm = A.tests.filter(t => t.status === 'bad' || t.status === 'warn')
  const gg = A.checks.filter(c => c.status === 'warn')
  return (
    <div>
      <p className="test-calc" style={{ fontSize: 13, lineHeight: 1.8 }}>
        Lapbul {nama} posisi {L.posisi} diuji terhadap {A.tests.length} ketentuan: {A.sum.ok} terpenuhi, {A.sum.bad} tidak terpenuhi, {A.sum.warn} perlu klarifikasi, dan {A.sum.na} tidak dapat diuji dari lapbul. Pemeriksaan konsistensi antar lembar menemukan {gg.length} selisih dari {A.checks.length} pemeriksaan.
      </p>
      <div className="grp">Perlu perhatian</div>
      {tm.length === 0 && gg.length === 0 && <div className="note">Tidak ada ketentuan yang dilanggar atau selisih antar lembar.</div>}
      {tm.map(t => (
        <div className="test" key={t.id} style={{ cursor: 'pointer' }} onClick={() => onTab(t.id === 'cadklaim' ? 'hitung' : 'uji')}>
          <div className="test-head"><div><div className="test-title">{t.judul}</div><div className="test-pasal">{t.pasal}</div></div><Pill s={t.status} /></div>
          <div className="test-calc" style={{ marginTop: 8 }}>{t.calc}</div>
        </div>
      ))}
      {gg.map(c => (
        <div className="test" key={c.id} style={{ cursor: 'pointer' }} onClick={() => onTab('anomali')}>
          <div className="test-head"><div className="test-title">{c.judul}</div><span className="pill pill-warn">Selisih {c.selisih}</span></div>
          <div className="test-calc" style={{ marginTop: 8 }}>{c.ket}</div>
        </div>
      ))}
      <div className="grp">Seluruh ketentuan</div>
      <div className="tw"><table className="t"><tbody>
        {A.tests.map(t => (
          <tr key={t.id}><td>{t.judul}<div className="note">{t.pasal}</div></td><td className="num">{t.nilai}</td><td className="note" style={{ whiteSpace: 'nowrap' }}>{t.batas}</td><td><Pill s={t.status} /></td></tr>
        ))}
      </tbody></table></div>
    </div>
  )
}

function AiPanel({ ai, busy, error, detik, stale, onRun, A, L, Chip }: {
  ai: AiRecord | null; busy: boolean; error: string | null; detik: number; stale: boolean; onRun: () => void
  A: Analysis; L: LapbulData; Chip: (p: { r: Ref; push?: boolean }) => React.ReactElement
}) {
  if (busy) {
    const tahap = detik < 8 ? 'Mengirim hasil aturan dan isi lembar ke AI' : detik < 25 ? 'AI menelaah pengujian dan selisih antar lembar' : detik < 50 ? 'AI mencari anomali pada neraca, laba rugi, dan klaim' : 'AI menyusun temuan, pertanyaan, dan tindak lanjut'
    return (
      <div className="ai-load" role="status">
        <div className="spin" />
        <div className="test-title">{tahap}…</div>
        <div className="note" style={{ marginTop: 8 }}>{detik} detik · biasanya 1–2 menit. Hasil aturan sudah bisa dibuka di tab lain.</div>
      </div>
    )
  }
  if (!ai) {
    return (
      <div className="ai-load">
        {error && <div className="error-box" style={{ textAlign: 'left' }}>{error}</div>}
        <div className="note" style={{ marginBottom: 14 }}>Analisis AI belum tersedia untuk lapbul ini.</div>
        <button className="btn btn-primary" onClick={onRun}>Jalankan analisis AI</button>
      </div>
    )
  }
  const h = ai.hasil
  /** Ubah pengenal rujukan AI menjadi chip jejak sumber; pengenal yang tidak ada diabaikan. */
  const rujuk = (ids: string[]) => {
    const refs: Ref[] = []
    for (const id of ids) {
      const [a, b] = id.replace(/[[\]]/g, '').split(':')
      if (a === 'uji') refs.push(...(A.tests.find(t => t.id === b)?.refs || []))
      else if (a === 'cek') refs.push(...(A.checks.find(c => c.id === b)?.refs || []))
      else {
        const row = L.sheets[a]?.rows.find(r => r.k === b)
        const nums = row?.cells.filter(c => typeof c.v === 'number') || []
        const c = nums.find(c => /^total ›|jumlah$/i.test(c.h)) || nums[0]
        if (row && c) refs.push({ t: 's', sheet: a, k: b, h: c.h, addr: c.addr, r: row.r, u: row.u, v: c.v, file: L.file })
      }
    }
    const unik = [...new Map(refs.map(r => [r.t === 'd' ? r.id : r.sheet + r.addr, r])).values()].slice(0, 8)
    return unik.length ? <div style={{ marginTop: 8 }}>{unik.map((r, i) => <Chip key={i} r={r} />)}</div> : null
  }
  const warna = { tinggi: 'bad', sedang: 'warn', rendah: 'na' } as const
  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      {stale && <div className="ai-warn">Pengaturan analisis berubah setelah AI dijalankan. Jalankan ulang agar teks AI sesuai dengan angka terbaru.</div>}
      {ai.angkaPerluCek.length > 0 && <div className="ai-warn">Angka pada teks AI yang tidak ditemukan persis di data, mohon dicek: {ai.angkaPerluCek.join('; ')}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="note">Draf AI ({ai.model}) · perlu diverifikasi pengawas. Angka dan status tetap dari aturan.</span>
        <button className="icon-btn" onClick={onRun}>Jalankan ulang</button>
      </div>
      <p className="test-calc" style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{h.ringkasan}</p>
      <div className="grp">Temuan prioritas</div>
      {h.temuan.map((t, i) => (
        <div className="test" key={i}>
          <div className="test-head"><div className="test-title">{t.judul}</div><span className={`pill pill-${warna[t.prioritas] || 'na'}`}>Prioritas {t.prioritas}</span></div>
          <div className="test-calc" style={{ marginTop: 8 }}>{t.uraian}</div>
          {rujuk(t.rujukan)}
        </div>
      ))}
      <div className="grp">Anomali yang perlu didalami</div>
      {h.anomali.map((a, i) => (
        <div className="test" key={i}>
          <div className="test-title">{a.judul}</div>
          <div className="test-calc" style={{ marginTop: 8 }}>{a.pengamatan}</div>
          <div className="note" style={{ marginTop: 8 }}>Dugaan penyebab (perlu konfirmasi)</div>
          <ul className="ai-list test-calc">{a.dugaan_penyebab.map((d, j) => <li key={j}>{d}</li>)}</ul>
          {rujuk(a.rujukan)}
        </div>
      ))}
      <div className="grp">Pertanyaan konfirmasi ke perusahaan</div>
      {h.pertanyaan.map((q, i) => (
        <div className="test" key={i}>
          <div className="test-calc" style={{ color: '#eef2ef' }}>{i + 1}. {q.pertanyaan}</div>
          <div className="note" style={{ marginTop: 6 }}>Data diminta: {q.data_diminta}</div>
          {rujuk(q.rujukan)}
        </div>
      ))}
      <div className="grp">Saran tindak lanjut</div>
      <ol className="ai-list test-calc">{h.tindak_lanjut.map((x, i) => <li key={i}>{x.replace(/^\d+[.)]\s*/, '')}</li>)}</ol>
    </div>
  )
}

function SourceView({ r, A, L, Chip }: { r: Ref; A: Analysis; L: LapbulData[]; Chip: (p: { r: Ref; push?: boolean }) => React.ReactElement }) {
  if (r.t === 'd') {
    const d = A.D[r.id]
    if (!d) return <div className="note">Angka turunan tidak ditemukan.</div>
    return (
      <div>
        <div className="note">Angka hasil hitung ulang</div>
        <div className="test-title" style={{ marginTop: 4 }}>{d.label}</div>
        <div className="dv">{fmtVal(d.value, d.unit)}</div>
        <div className="formula">{d.formula}</div>
        <div className="grp" style={{ marginTop: 0 }}>Masukan ({d.inputs.length})</div>
        {d.inputs.length === 0 && <div className="note">Tidak ada masukan yang terbaca.</div>}
        <div className="tw"><table className="t"><tbody>
          {d.inputs.slice(0, 150).map((x, i) => (
            <tr key={i}>
              <td><Chip r={x} push /></td>
              <td>{x.t === 's' ? (x.u || x.h) : A.D[x.id]?.label}</td>
              <td className="num">{x.t === 's' ? (typeof x.v === 'number' ? rpOrNum(x.v) : x.v) : fmtVal(A.D[x.id]?.value ?? NaN, A.D[x.id]?.unit ?? '')}</td>
            </tr>
          ))}
        </tbody></table></div>
        {d.inputs.length > 150 && <div className="note">… dan {d.inputs.length - 150} baris lainnya.</div>}
      </div>
    )
  }
  const src = L.find(l => l.file === r.file) || L[0]
  const sh = src.sheets[r.sheet]
  const rows = sh?.rows || []
  const idx = rows.findIndex(x => x.r === r.r)
  const win = rows.slice(Math.max(0, idx - 4), idx + 5)
  const colOf = (row: typeof rows[number]) => row.cells.find(c => c.h === r.h && typeof c.v === 'number') || row.cells.find(c => typeof c.v === 'number')
  return (
    <div>
      <div className="note">Sel lapbul</div>
      <div className="test-title" style={{ marginTop: 4 }}>{r.u || r.h}</div>
      <div className="dv">{typeof r.v === 'number' ? rpOrNum(r.v) : r.v}</div>
      <dl className="dl">
        <dt>Lembar</dt><dd>LBPPNJK-{r.sheet} · {sheetTitle(src, r.sheet)}</dd>
        <dt>Kode komponen</dt><dd style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{r.k}</dd>
        <dt>Kolom</dt><dd>{r.h}</dd>
        <dt>Sel</dt><dd style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{r.addr} (baris {r.r})</dd>
        <dt>Berkas</dt><dd>{r.file}{src.posisi ? ` · posisi ${src.posisi}` : ''}</dd>
      </dl>
      <div className="grp" style={{ marginTop: 0 }}>Cuplikan lembar</div>
      <table className="excerpt"><tbody>
        {win.map(row => {
          const c = colOf(row)
          return (
            <tr key={row.r} className={row.r === r.r ? 'hit' : ''}>
              <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap' }}>{row.r}</td>
              <td style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{row.k}</td>
              <td>{row.u}</td>
              <td className="num">{c ? (typeof c.v === 'number' ? idn(c.v, Number.isInteger(c.v) ? 0 : 2) : c.v) : ''}</td>
            </tr>
          )
        })}
      </tbody></table>
      <p className="note" style={{ marginTop: 14 }}>Nilai dibaca apa adanya dari sel di atas. Buka berkas asli pada alamat sel yang sama untuk verifikasi.</p>
    </div>
  )
}

const rpOrNum = (v: number) => (Math.abs(v) >= 1e6 ? rpF(v) : idn(v, Number.isInteger(v) ? 0 : 2))
