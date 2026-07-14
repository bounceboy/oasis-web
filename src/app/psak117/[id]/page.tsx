'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

type Tab = 'scorecard' | 'compliance' | 'risiko' | 'detail'

export default function Psak117DetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('scorecard')

  useEffect(() => {
    fetch(`/api/psak117/session/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400">Sesi tidak ditemukan</p>
        <button onClick={() => router.push('/dashboard')} className="text-blue-400 mt-3 text-sm">← Dashboard</button>
      </div>
    </div>
  )

  const meta = data.metadata as Record<string, string> | undefined
  const scorecard = data.scorecard as Array<{ metric: string; nilai: number | null; threshold: string; pass: boolean | null; keterangan: string }> | undefined
  const skor = data.skor as { nilai: number; total: number; rating: string } | undefined
  const dk = data.data_keuangan as Record<string, unknown> | undefined

  const ratingColor = skor?.rating === 'Baik' ? 'text-green-400' :
    skor?.rating === 'Cukup' ? 'text-yellow-400' :
    skor?.rating === 'Kurang' ? 'text-orange-400' : 'text-red-400'

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white text-sm">
            ← Dashboard
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-400">PSAK 117</span>
          <span className="text-slate-600">/</span>
          <span className="text-sm font-medium">{meta?.namaEntitas || id}</span>
        </div>
        <div className="flex items-center gap-3">
          {skor && (
            <span className={`text-sm font-semibold ${ratingColor}`}>
              Rating: {skor.rating} ({skor.nilai}/{skor.total})
            </span>
          )}
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
            {meta?.jenisUsaha} · {meta?.periode}
          </span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 mb-6">
          {([
            { key: 'scorecard', label: '📊 Scorecard & Rasio' },
            { key: 'compliance', label: '⚖️ Compliance POJK' },
            { key: 'risiko', label: '⚠️ Pemetaan Risiko' },
            { key: 'detail', label: '🔢 Data Lengkap' },
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

          {/* Scorecard */}
          {activeTab === 'scorecard' && (
            <div className="space-y-6">
              {skor && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold">{skor.nilai}<span className="text-slate-500 text-lg">/{skor.total}</span></div>
                    <div className="text-xs text-slate-400 mt-1">Metrik Lulus</div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4 text-center">
                    <div className={`text-3xl font-bold ${ratingColor}`}>{skor.rating}</div>
                    <div className="text-xs text-slate-400 mt-1">Rating Keseluruhan</div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold">{meta?.periode || '–'}</div>
                    <div className="text-xs text-slate-400 mt-1">Periode</div>
                  </div>
                </div>
              )}

              {scorecard && (
                <div className="overflow-hidden rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Metrik</th>
                        <th className="text-right px-4 py-3 text-slate-400 font-medium">Nilai</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Threshold</th>
                        <th className="text-center px-4 py-3 text-slate-400 font-medium">Status</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scorecard.map((s, i) => (
                        <tr key={i} className="border-t border-slate-700/50">
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
              )}
            </div>
          )}

          {/* Compliance */}
          {activeTab === 'compliance' && (
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {data.compliance as string}
            </pre>
          )}

          {/* Risiko */}
          {activeTab === 'risiko' && (
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {data.pemetaan_risiko as string}
            </pre>
          )}

          {/* Data Detail */}
          {activeTab === 'detail' && dk && (
            <div className="grid grid-cols-2 gap-6">
              {[
                {
                  title: 'Posisi Keuangan',
                  fields: ['total_aset', 'total_liabilitas', 'total_ekuitas', 'kas', 'investasi_total',
                    'liabilitas_kontrak_asuransi', 'aset_kontrak_reasuransi'],
                },
                {
                  title: 'Laba Rugi',
                  fields: ['pendapatan_asuransi', 'beban_jasa_asuransi', 'klaim_dan_manfaat',
                    'hasil_investasi', 'profit_tahun_berjalan', 'total_comprehensive_income'],
                },
                {
                  title: 'IFRS 17 — CSM & Liabilitas',
                  fields: ['csm_penutup', 'csm_pembuka', 'lrc', 'lic', 'loss_component', 'risk_adjustment'],
                },
                {
                  title: 'IFRS 9 — ECL & Klasifikasi',
                  fields: ['ecl_total', 'ecl_base', 'stage2_3_exposure', 'stage_total_exposure'],
                },
              ].map((section) => (
                <div key={section.title} className="bg-slate-800 rounded-xl p-4">
                  <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wide">
                    {section.title} ({dk.unit as string})
                  </p>
                  <div className="space-y-2">
                    {section.fields.map((field) => (
                      <div key={field} className="flex justify-between text-sm">
                        <span className="text-slate-400">{field.replace(/_/g, ' ')}</span>
                        <span className="text-white font-mono">
                          {dk[field] != null ? Number(dk[field]).toLocaleString('id-ID') : '–'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
