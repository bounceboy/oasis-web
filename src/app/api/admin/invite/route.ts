import { NextResponse } from 'next/server'

// Invite flow tidak digunakan — user mendaftar langsung via /register
export async function POST() {
  return NextResponse.json({ error: 'Gunakan halaman /register untuk membuat akun baru' }, { status: 410 })
}
