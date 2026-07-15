import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// DEV-ONLY: serve local file for browser-based testing
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }
  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const buf = fs.readFileSync(resolved)
  const ext = path.extname(resolved).toLowerCase()
  const contentType = ext === '.pdf' ? 'application/pdf'
    : ext === '.xlsx' || ext === '.xlsm' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/octet-stream'

  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': contentType }
  })
}
