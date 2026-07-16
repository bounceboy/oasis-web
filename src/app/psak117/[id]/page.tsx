'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/oasis/Navbar'

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#45e661', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eef2ef' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#aab4bc' }}>Sesi tidak ditemukan</p>
        <button onClick={() => router.push('/dashboard')} style={{ color: '#45e661', background: 'none', border: 'none', cursor: 'pointer', marginTop: 12, fontFamily: 'inherit' }}>← Dashboard</button>
      </div>
    </div>
  )

  const meta = data.metadata as Record<string, string> | undefined
  const scorecard = data.scorecard as Array<{ metric: string; nilai: number | null; threshold: string; pass: boolean | null; keterangan: string }> | undefined
  const skor = data.skor as { nilai: number; total: number; rating: string } | undefined
  const dk = data.data_keuangan as Record<string, unknown> | undefined

  const ratingColor = skor?.rating === 'Baik' ? '#45e661' :
    skor?.rating === 'Cukup' ? '#ffbe50' :
    skor?.rating === 'Kurang' ? '#ff9940' : '#ff6f61'

  const TABS = [
    { key: 'scorecard' as Tab, label: 'Scorecard & Rasio' },
    { key: 'compliance' as Tab, label: 'Compliance POJK' },
    { key: 'risiko' as Tab, label: 'Pemetaan Risiko' },
    { key: 'detail' as Tab, label: 'Data Lengkap' },
  ]

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 64px' }}>
        <Navbar simple />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 11, color: '#45e661', letterSpacing: '0.15em', marginBottom: 6 }}>PSAK 117</div>
            <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{meta?.namaEntitas || id}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {skor && (
              <span style={{ fontSize: 14, fontWeight: 600, color: ratingColor }}>
                Rating: {skor.rating} ({skor.nilai}/{skor.total})
              </span>
            )}
            {meta && (
              <span style={{ fontSize: 11.5, color: '#aab4bc', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '5px 12px' }}>
                {meta.jenisUsaha} · {meta.periode}
              </span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: 5, marginBottom: 24 }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ flex: 1, padding: '9px 12px', border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: activeTab === tab.key ? '#45e661' : 'transparent', color: activeTab === tab.key ? '#04120a' : '#aab4bc', fontFamily: 'inherit' }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 28 }}>

          {/* Scorecard */}
          {activeTab === 'scorecard' && (
            <div>
              {skor && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 38, fontWeight: 300 }}>{skor.nilai}<span style={{ fontSize: 20, color: '#828d96' }}>/{skor.total}</span></div>
                    <div style={{ fontSize: 11, color: '#aab4bc', marginTop: 6 }}>Metrik Lulus</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 38, fontWeight: 300, color: ratingColor }}>{skor.rating}</div>
                    <div style={{ fontSize: 11, color: '#aab4bc', marginTop: 6 }}>Rating Keseluruhan</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 300 }}>{meta?.periode || '–'}</div>
                    <div style={{ fontSize: 11, color: '#aab4bc', marginTop: 6 }}>Periode</div>
                  </div>
                </div>
              )}

              {scorecard && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Metrik', 'Nilai', 'Threshold', 'Status', 'Keterangan'].map(h => (
                          <th key={h} style={{ textAlign: h === 'Nilai' ? 'right' : h === 'Status' ? 'center' : 'left', padding: '10px 16px', color: '#aab4bc', fontWeight: 500, fontSize: 11, letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scorecard.map((s, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '11px 16px', color: '#eef2ef' }}>{s.metric}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#b7c0c6' }}>
                            {s.nilai != null ? (s.nilai < 10 ? (s.nilai * 100).toFixed(2) + '%' : s.nilai.toFixed(2) + 'x') : 'N/A'}
                          </td>
                          <td style={{ padding: '11px 16px', color: '#828d96', fontSize: 12 }}>{s.threshold}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                            {s.pass === null ? (
                              <span style={{ color: '#828d96', fontSize: 11 }}>–</span>
                            ) : s.pass ? (
                              <span style={{ background: 'rgba(69,230,97,0.12)', color: '#45e661', fontSize: 11, padding: '3px 10px', borderRadius: 999 }}>✓ Lulus</span>
                            ) : (
                              <span style={{ background: 'rgba(255,111,97,0.12)', color: '#ff6f61', fontSize: 11, padding: '3px 10px', borderRadius: 999 }}>✗ Tidak Lulus</span>
                            )}
                          </td>
                          <td style={{ padding: '11px 16px', color: '#aab4bc', fontSize: 12 }}>{s.keterangan}</td>
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
            <pre style={{ fontSize: 13, color: '#b7c0c6', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.8, margin: 0 }}>
              {data.compliance as string}
            </pre>
          )}

          {/* Risiko */}
          {activeTab === 'risiko' && (
            <pre style={{ fontSize: 13, color: '#b7c0c6', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.8, margin: 0 }}>
              {data.pemetaan_risiko as string}
            </pre>
          )}

          {/* Data Detail */}
          {activeTab === 'detail' && dk && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { title: 'Posisi Keuangan', fields: ['total_aset', 'total_liabilitas', 'total_ekuitas', 'kas', 'investasi_total', 'liabilitas_kontrak_asuransi', 'aset_kontrak_reasuransi'] },
                { title: 'Laba Rugi', fields: ['pendapatan_asuransi', 'beban_jasa_asuransi', 'klaim_dan_manfaat', 'hasil_investasi', 'profit_tahun_berjalan', 'total_comprehensive_income'] },
                { title: 'IFRS 17 — CSM & Liabilitas', fields: ['csm_penutup', 'csm_pembuka', 'lrc', 'lic', 'loss_component', 'risk_adjustment'] },
                { title: 'IFRS 9 — ECL & Klasifikasi', fields: ['ecl_total', 'ecl_base', 'stage2_3_exposure', 'stage_total_exposure'] },
              ].map(section => (
                <div key={section.title} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px' }}>
                  <p style={{ fontSize: 10.5, color: '#828d96', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                    {section.title} ({dk.unit as string})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {section.fields.map(field => (
                      <div key={field} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                        <span style={{ color: '#aab4bc' }}>{field.replace(/_/g, ' ')}</span>
                        <span style={{ color: '#eef2ef', fontFamily: 'monospace' }}>
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
