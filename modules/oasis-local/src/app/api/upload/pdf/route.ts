import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { extractPdfPages, selectRelevantPages, type PageClassifierConfig } from '@/lib/pdf-chunker'

const MAX_FILE_SIZE = 52_428_800 // 50 MB

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const configJson = formData.get('config') as string | null

  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File melebihi 50 MB' }, { status: 413 })
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Hanya file PDF yang diterima' }, { status: 400 })
  }

  const config: PageClassifierConfig | null = configJson ? JSON.parse(configJson) : null

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const pages = await extractPdfPages(buffer)

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
