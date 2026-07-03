import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const { data } = await db()
    .from('oasis_departemen')
    .select('id, direktorat_id, kode, nama')
    .eq('aktif', true)
    .order('urutan')
  return NextResponse.json(data ?? [])
}
