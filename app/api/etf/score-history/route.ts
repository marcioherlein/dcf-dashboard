import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

const TICKER_RE = /^[A-Z0-9.]{1,10}$/

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000, 'etf-score-history')
  if (limited) return limited

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()?.trim()
  if (!ticker || !TICKER_RE.test(ticker)) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const client = getAnonClient()
  if (!client) return NextResponse.json([], { status: 200 })

  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await client
      .from('etf_score_history')
      .select('score, pe_ratio, pb_ratio, yield_val, expense_ratio, ts')
      .eq('ticker', ticker)
      .gte('ts', since)
      .order('ts', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [], {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    })
  } catch (err) {
    console.error('score-history error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 2, 60_000, 'etf-score-history-post')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const { ticker, score, peRatio, pbRatio, yieldVal, expenseRatio } = body
  if (!ticker || typeof score !== 'number' || !isFinite(score) || score < 0 || score > 100) {
    return NextResponse.json({ error: 'missing or invalid fields' }, { status: 400 })
  }
  if (!TICKER_RE.test(String(ticker).toUpperCase())) {
    return NextResponse.json({ error: 'invalid ticker' }, { status: 400 })
  }

  const client = getAnonClient()
  if (!client) return NextResponse.json({ ok: false })

  try {
    await client.from('etf_score_history').insert({
      ticker: String(ticker).toUpperCase(),
      score: Math.round(score),
      pe_ratio: peRatio ?? null,
      pb_ratio: pbRatio ?? null,
      yield_val: yieldVal ?? null,
      expense_ratio: expenseRatio ?? null,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
