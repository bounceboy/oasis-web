'use client'

// Client component murni — TIDAK boleh diganti <Link href="/api/auth/signout">.
// Next.js otomatis prefetch semua <Link> yang terlihat di viewport lewat GET
// diam-diam; kalau logout dipicu lewat navigasi Link, user akan ter-logout
// sendiri beberapa saat setelah halaman dimuat, sebelum sempat klik apa pun.
export default function LogoutButton({ style }: { style?: React.CSSProperties }) {
  async function handleLogout() {
    await fetch('/api/auth/signout', { method: 'POST' })
    window.location.assign('/login')
  }

  return (
    <button onClick={handleLogout} style={{ ...style, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }}>
      Keluar
    </button>
  )
}
