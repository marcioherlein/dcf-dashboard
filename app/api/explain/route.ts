import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Simple in-process cache keyed by ticker+day — avoids repeat calls for same stock same day
const cache = new Map<string, { text: string; ts: number }>()
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000, 'explain')
  if (limited) return limited

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ticker     = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  const fairValue  = parseFloat(req.nextUrl.searchParams.get('fv') ?? '')
  const price      = parseFloat(req.nextUrl.searchParams.get('price') ?? '')
  const upside     = parseFloat(req.nextUrl.searchParams.get('upside') ?? '')
  const wacc       = parseFloat(req.nextUrl.searchParams.get('wacc') ?? '')
  const cagr       = parseFloat(req.nextUrl.searchParams.get('cagr') ?? '')
  const sector     = req.nextUrl.searchParams.get('sector') ?? ''
  const method     = req.nextUrl.searchParams.get('method') ?? 'DCF'

  if (!ticker || isNaN(fairValue) || isNaN(price)) {
    return NextResponse.json({ error: 'ticker, fv, and price are required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const cacheKey = `${ticker}:${Math.round(fairValue)}:${Math.round(price)}:${new Date().toISOString().slice(0, 10)}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ explanation: cached.text, cached: true })
  }

  const pct = isNaN(upside) ? null : (upside * 100).toFixed(1)
  const direction = !isNaN(upside) && upside >= 0 ? 'undervalued' : 'overvalued'
  const waccStr = isNaN(wacc) ? 'N/A' : (wacc * 100).toFixed(1) + '%'
  const cagrStr = isNaN(cagr) ? 'N/A' : (cagr * 100).toFixed(1) + '%'

  const prompt = `You are a concise equity analyst. Explain in 2–3 short sentences why ${ticker} (${sector}) appears ${direction} based on a ${method} model.

Key data points:
- Current price: $${price.toFixed(2)}
- Model fair value: $${fairValue.toFixed(2)}
- Implied upside/downside: ${pct != null ? pct + '%' : 'N/A'}
- Model WACC: ${waccStr}
- Model CAGR assumption: ${cagrStr}

Rules:
- Use only the numbers above. Do not invent news or external context.
- Do not say "buy" or "sell".
- Do not hedge with "this is not financial advice" — it is already implied.
- Be direct. One sentence on the gap, one on the key driver (WACC or CAGR), one takeaway.
- Maximum 60 words.`

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  cache.set(cacheKey, { text, ts: Date.now() })

  return NextResponse.json({ explanation: text, cached: false })
}
