import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export const revalidate = 60

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// GET /api/quotes?tickers=AAPL,MSFT,NVDA
// Returns { [ticker]: { price, change, changePct } }
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 10, 60_000, 'quotes')
  if (limited) return limited

  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50) // max 50 tickers per request

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: {} })
  }

  const results = await Promise.allSettled(
    tickers.map(ticker =>
      yf.quote(ticker).catch(() => null)
    )
  )

  const quotes: Record<string, { price: number | null; change: number | null; changePct: number | null }> = {}

  results.forEach((r, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = r.status === 'fulfilled' ? r.value : null
    quotes[tickers[i]] = {
      price:     q?.regularMarketPrice     ?? null,
      change:    q?.regularMarketChange    ?? null,
      changePct: q?.regularMarketChangePercent ?? null,
    }
  })

  return NextResponse.json(
    { quotes },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  )
}
