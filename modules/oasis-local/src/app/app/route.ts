import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const session = await getSession()

  const htmlPath = path.join(process.cwd(), 'oasis_app.html')
  const html = fs.readFileSync(htmlPath, 'utf-8')

  // Inject direktorat dari session ke localStorage (jika sudah login)
  // Jika belum login, HTML akan menampilkan login screen
  const injectionScript = session
    ? `<script>
    (function(){
      var dir = "${session.direktorat_id ?? 'DPSS'}";
      if (!localStorage.getItem("oasis:direktorat")) {
        localStorage.setItem("oasis:direktorat", dir);
      }
    })();
  </script>`
    : ''

  const modifiedHtml = html.replace('</head>', injectionScript + '\n</head>')

  return new NextResponse(modifiedHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
