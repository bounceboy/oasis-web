import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

// TEMPORARY DIAGNOSTIC — remove after use. Only exposes a short hash prefix,
// never the actual secret, to compare what Node.js runtime sees vs middleware.
export async function GET(req: NextRequest) {
  const secret = process.env.SESSION_SECRET ?? 'FALLBACK_USED'
  const hash = createHash('sha256').update(secret).digest('hex').slice(0, 12)
  const rawCookieHeader = req.headers.get('cookie') ?? '(none)'
  return NextResponse.json({
    runtime: 'nodejs-api-route',
    hashPrefix: hash,
    region: process.env.VERCEL_REGION ?? 'unknown',
    rawCookieHeader,
  })
}
