import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()?.trim()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const client = getClient()
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
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const { ticker, score, peRatio, pbRatio, yieldVal, expenseRatio } = body
  if (!ticker || typeof score !== 'number') return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const client = getClient()
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
