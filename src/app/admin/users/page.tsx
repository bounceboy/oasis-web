import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'

const DIREKTORAT_INFO = [
  { kode: 'DPSS', label: 'Asuransi & Reasuransi Syariah', role: 'Admin' },
  { kode: 'DAJI', label: 'Asuransi Jiwa', role: 'User' },
  { kode: 'DASR', label: 'Asuransi Umum', role: 'User' },
  { kode: 'DPJP', label: 'Jasa Penunjang', role: 'User' },
  { kode: 'DPDP', label: 'Dana Pensiun', role: 'User' },
  { kode: 'PENJAMINAN', label: 'Pengawasan Penjaminan', role: 'User' },
  { kode: 'DEMO', label: 'Akun Demonstrasi', role: 'User' },
]

export default async function AdminUsersPage() {
  const profile = await getUser()
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin' || profile.direktorat_id === 'DPSS'

  // Hitung jumlah unique API key per direktorat dari login_log
  const { data: logData } = await db()
    .from('login_log')
    .select('direktorat, api_key_prefix')

  const keyCountMap: Record<string, Set<string>> = {}
  for (const row of logData ?? []) {
    if (!keyCountMap[row.direktorat]) keyCountMap[row.direktorat] = new Set()
    keyCountMap[row.direktorat].add(row.api_key_prefix)
  }

  return (
    <div style={{ minHeight: '100vh', color: '#eef2ef' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px 64px' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36, fontSize: 13, color: '#aab4bc' }}>
          <Link href="/admin" style={{ color: '#aab4bc', textDecoration: 'none' }}>← Admin</Link>
          <span style={{ color: '#3a444c' }}>/</span>
          <span style={{ color: '#eef2ef' }}>Kelola Direktorat</span>
        </nav>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Kelola Direktorat</h1>
          <p style={{ fontSize: 12.5, color: '#828d96', margin: '6px 0 0' }}>
            Status dan aktivitas login per direktorat
          </p>
        </div>

        {/* Table */}
        <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 160px', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7680' }}>
            <div>Kode</div>
            <div>Direktorat</div>
            <div>Status</div>
            <div>API Key Dipakai</div>
          </div>

          {DIREKTORAT_INFO.map((d, i) => {
            const keyCount = keyCountMap[d.kode]?.size ?? 0
            const isCurrentUser = profile.direktorat_id === d.kode
            return (
              <div
                key={d.kode}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 100px 160px',
                  padding: '16px 24px',
                  borderBottom: i < DIREKTORAT_INFO.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  alignItems: 'center',
                  background: isCurrentUser ? 'rgba(69,230,97,0.03)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: d.kode === 'DPSS' ? '#45e661' : '#eef2ef' }}>
                    {d.kode}
                  </span>
                  {isCurrentUser && (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: '#45e661', background: 'rgba(69,230,97,0.12)', borderRadius: 999, padding: '2px 6px' }}>ANDA</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#eef2ef' }}>{d.kode} — {d.label}</div>
                </div>
                <div>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 999,
                    background: d.role === 'Admin' ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.06)',
                    color: d.role === 'Admin' ? '#c084fc' : '#aab4bc',
                  }}>
                    {d.role}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: keyCount > 0 ? '#eef2ef' : '#3a444c' }}>
                  {keyCount > 0 ? (
                    <span>
                      <span style={{ fontWeight: 500 }}>{keyCount}</span>
                      <span style={{ color: '#828d96', fontSize: 11.5 }}> key unik</span>
                    </span>
                  ) : (
                    <span style={{ color: '#3a444c' }}>Belum pernah login</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {!isAdmin && (
          <p style={{ fontSize: 12, color: '#4a5560', marginTop: 20, textAlign: 'center' }}>
            Untuk mengubah konfigurasi direktorat, hubungi DPSS selaku admin.
          </p>
        )}
      </div>
    </div>
  )
}
