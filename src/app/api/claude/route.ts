import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// OpenRouter mendukung Anthropic API format via /api/v1/messages
const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions'
// Anthropic native via OpenRouter passthrough
const ANTHROPIC_VIA_OR = 'https://openrouter.ai/api/v1/messages'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key tidak dikonfigurasi di server' }, { status: 500 })

  const body = await req.json()

  // OpenRouter menerima format Anthropic native (sama persis)
  // Ganti model jika pakai claude-sonnet-4-20250514 → anthropic/claude-sonnet-4-5
  if (body.model && body.model.includes('claude-sonnet-4-20250514')) {
    body.model = 'anthropic/claude-sonnet-4-5'
  } else if (body.model && !body.model.includes('/')) {
    body.model = 'anthropic/' + body.model
  }

  const res = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://oasis-web-rust.vercel.app',
      'X-Title': 'OASIS OJK',
    },
    body: JSON.stringify(body),
  })

  const data = await res.text()

  // OpenRouter returns OpenAI format. OASIS expects Anthropic format.
  // Convert response: { choices[0].message.content } → { content: [{type:"text", text:"..."}] }
  try {
    const parsed = JSON.parse(data)
    if (parsed.choices && parsed.choices[0]) {
      const text = parsed.choices[0].message?.content ?? ''
      const anthropicResponse = {
        id: parsed.id ?? 'msg_proxy',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text }],
        model: body.model,
        stop_reason: 'end_turn',
        usage: parsed.usage ?? {},
      }
      return NextResponse.json(anthropicResponse)
    }
  } catch {
    // fallthrough to raw response
  }

  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
