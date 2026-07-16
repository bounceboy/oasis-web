import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractPdfPages, selectRelevantPages, type PageClassifierConfig } from '@/lib/pdf-chunker'

const MAX_FILE_SIZE = 52_428_800 // 50 MB
const BUCKET = 'psak117-uploads'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { path, config } = body as { path?: string; config?: PageClassifierConfig | null }

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'path tidak ditemukan' }, { status: 400 })
  }
  if (!path.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Hanya file PDF yang diterima' }, { status: 400 })
  }

  const { data, error } = await db().storage.from(BUCKET).download(path)
  if (error || !data) {
    return NextResponse.json({ error: `Gagal mengunduh file dari storage: ${error?.message ?? 'unknown'}` }, { status: 500 })
  }

  if (data.size > MAX_FILE_SIZE) {
    await db().storage.from(BUCKET).remove([path]).catch(() => {})
    return NextResponse.json({ error: 'File melebihi 50 MB' }, { status: 413 })
  }

  const buffer = Buffer.from(await data.arrayBuffer())

  let pages
  try {
    pages = await extractPdfPages(buffer)
  } finally {
    await db().storage.from(BUCKET).remove([path]).catch(() => {})
  }

  if (config) {
    const { selected, combinedText, totalPages } = selectRelevantPages(pages, config)
    return NextResponse.json({
      totalPages,
      selectedPages: selected.length,
      selectedPageNums: selected.map((p) => p.page),
      combinedText,
    })
  }

  // Tanpa config: kembalikan semua halaman (untuk modul yang mau seleksi sendiri)
  return NextResponse.json({
    totalPages: pages.length,
    pages: pages.map((p) => ({ page: p.page, charCount: p.charCount, text: p.text })),
  })
}
