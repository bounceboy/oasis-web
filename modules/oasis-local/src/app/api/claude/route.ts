import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// OASIS Local: proxy generik ke Ollama, response dikonversi ke format Anthropic
// agar kompatibel dengan pemanggil lama.
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Format Anthropic: { system, messages, max_tokens } → format Ollama chat
  const messages = [
    ...(body.system ? [{ role: 'system', content: body.system }] : []),
    ...(body.messages ?? []).map((m: { role: string; content: unknown }) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : (m.content as Array<{ type: string; text?: string }>).map(c => c.text ?? '').join('\n'),
    })),
  ]

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: { num_predict: body.max_tokens ?? 4000, num_ctx: 32768 },
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Ollama error ${res.status}: ${err}` }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json({
    id: 'msg_local',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: data.message?.content ?? '' }],
    model: MODEL,
    stop_reason: 'end_turn',
    usage: {},
  })
}
