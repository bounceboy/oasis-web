import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET — cek apakah tabel sudah ada
export async function GET(_req: NextRequest) {
  const user = await getUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await db().from('ky_session').select('id').limit(1)
  return NextResponse.json({ tables_exist: data !== null })
}
