import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const maxDuration = 30

// Build minimal .docx from plain text using raw XML
function buildDocx(text: string, title: string): Buffer {
  const escape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // Split into paragraphs; detect headings (lines starting with A. / B. / 1. / **...)
  const paragraphs = text.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>'

    const isBold = trimmed.startsWith('**') || /^[A-Z]\.\s/.test(trimmed) || /^\d+\.\s[A-Z]/.test(trimmed)
    const cleanLine = trimmed.replace(/\*\*/g, '')

    const style = isBold ? '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' : '<w:pPr><w:spacing w:after="120"/></w:pPr>'
    const runProps = isBold ? '<w:rPr><w:b/></w:rPr>' : ''
    return `<w:p>${style}<w:r>${runProps}<w:t xml:space="preserve">${escape(cleanLine)}</w:t></w:r></w:p>`
  })

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
<w:p>
  <w:pPr><w:pStyle w:val="Title"/></w:pPr>
  <w:r><w:t>${escape(title)}</w:t></w:r>
</w:p>
${paragraphs.join('\n')}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
</w:sectPr>
</w:body>
</w:document>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
    <w:pPr><w:spacing w:after="240"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="24"/></w:rPr>
  </w:style>
</w:styles>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  // Build zip manually using AdmZip
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require('adm-zip')
  const zip = new AdmZip()
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypesXml, 'utf8'))
  zip.addFile('_rels/.rels', Buffer.from(rootRelsXml, 'utf8'))
  zip.addFile('word/document.xml', Buffer.from(docXml, 'utf8'))
  zip.addFile('word/styles.xml', Buffer.from(stylesXml, 'utf8'))
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8'))
  return zip.toBuffer() as Buffer
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: sess } = await db()
    .from('psak_session')
    .select('nama_entitas, jenis_usaha, periode, analisis_text, user_id')
    .eq('id', id)
    .single()

  if (!sess) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
  if (sess.user_id !== user.id && !['admin', 'superadmin'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!sess.analisis_text) return NextResponse.json({ error: 'Analisis belum tersedia' }, { status: 400 })

  const docTitle = `Analisis PSAK 117 dan PSAK 109 ${sess.nama_entitas} Tahun Buku ${sess.periode || ''}`
  const docxBuf = buildDocx(sess.analisis_text as string, docTitle)
  const fileName = `Analisis_PSAK_${sess.nama_entitas.replace(/[^a-zA-Z0-9]/g, '_')}.docx`

  return new NextResponse(docxBuf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
