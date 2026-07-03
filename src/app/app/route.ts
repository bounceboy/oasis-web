import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }

  const htmlPath = path.join(process.cwd(), 'oasis_app.html')
  const html = fs.readFileSync(htmlPath, 'utf-8')

  // Map direktorat_id from oasis_users to OASIS direktorat codes
  // Default to first option if not set
  const direktoratCode = session.direktorat_id ?? 'DPSS'

  // Inject user session into localStorage before React loads
  const injectionScript = `<script>
    (function(){
      var dir = "${direktoratCode}";
      if (!localStorage.getItem("oasis:direktorat")) {
        localStorage.setItem("oasis:direktorat", dir);
        // Load POJK bawaan for this direktorat (will be called by React app)
      }
      // Mark as server-authenticated so app knows to skip login
      window.__OASIS_AUTH__ = {
        username: "${session.username}",
        nama: "${session.nama_lengkap ?? session.username}",
        role: "${session.role}",
        direktorat: dir
      };
    })();
  </script>`

  const modifiedHtml = html.replace('</head>', injectionScript + '\n</head>')

  return new NextResponse(modifiedHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
