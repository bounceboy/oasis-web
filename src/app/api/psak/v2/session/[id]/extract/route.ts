import { NextRequest, NextResponse, after } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'
import { buildExtractionPrompt, type JenisUsaha, type TemplateData } from '@/lib/psak-template-structure'

export const maxDuration = 300

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function doExtract(sessionId: string, storagePath: string, jenis: JenisUsaha) {
  try {
    const { data, error } = await adminClient.storage.from('psak-uploads').download(storagePath)
    if (error || !data) throw new Error('Gagal mengunduh PDF LK')

    const buf = Buffer.from(await data.arrayBuffer())
    const base64 = buf.toString('base64')

    const prompt = buildExtractionPrompt(jenis)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 300)}`)
    }

    const aiData = await res.json()
    const rawText: string = aiData.content?.[0]?.text || ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Respons AI tidak mengandung JSON valid')

    let templateData: TemplateData
    try {
      templateData = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Gagal parse JSON dari respons AI')
    }

    const filledCount = Object.values(templateData.values || {})
      .filter(v => v.CY != null || v.PY != null).length

    console.log(`[psak] extract selesai: ${filledCount} field terisi dari ${Object.keys(templateData.values || {}).length}`)

    await db()
      .from('psak_session')
      .update({
        template_data: templateData,
        status: 'template_ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
  } catch (err) {
    console.error('[psak] extract gagal:', err)
    await db()
      .from('psak_session')
      .update({
        status: 'error',
        error_msg: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: sess } = await db()
    .from('psak_session')
    .select('lk_storage_path, jenis_usaha, user_id')
    .eq('id', id)
    .single()

  if (!sess) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
  if (sess.user_id !== user.id && !['admin', 'superadmin'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!sess.lk_storage_path) return NextResponse.json({ error: 'PDF LK belum diupload' }, { status: 400 })

  await db()
    .from('psak_session')
    .update({ status: 'extracting', error_msg: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  after(() => doExtract(id, sess.lk_storage_path as string, sess.jenis_usaha as JenisUsaha))

  return NextResponse.json({ ok: true, extracting: true })
}
