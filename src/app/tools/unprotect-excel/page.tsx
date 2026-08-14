import UnprotectExcel from '@/components/tools/UnprotectExcel'
import Link from 'next/link'

export default function UnprotectExcelPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#04070b', color: '#eef2ef', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 40 }}>
          <Link href="/dashboard" style={{ fontSize: 11.5, color: '#45e661', textDecoration: 'none', marginBottom: 20, display: 'inline-block', letterSpacing: '0.05em' }}>
            Kembali ke Dashboard
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 300, margin: '20px 0 8px', letterSpacing: '-0.5px' }}>Unprotect Excel</h1>
          <p style={{ fontSize: 12.5, color: '#aab4bc', margin: 0 }}>Hapus proteksi sheet dan workbook dari file .xlsx tanpa password</p>
        </div>
        <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 40 }}>
          <UnprotectExcel />
        </div>
      </div>
    </div>
  )
}
