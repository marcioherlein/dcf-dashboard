import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// In-memory cache per ticker set — 2 min TTL
const _cache = new Map<string, { data: unknown[]; ts: number }>()
const CACHE_TTL = 2 * 60 * 1000

export interface SectorStockQuote {
  symbol: string
  shortName: string | null
  price: number | null
  changePct: number | null
  ytdChangePct: number | null
  sparkline: number[]
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 10)
  if (tickers.length === 0) return NextResponse.json([])

  const cacheKey = tickers.sort().join(',')
  const cached = _cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
    })
  }

  try {
    // Batch quote fetch — get price, changePct, YTD
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes: any[] = await yf.quote(tickers, {
      fields: [
        'regularMarketPrice', 'regularMarketChangePercent',
        'shortName', 'longName',
      ],
    }, { validateResult: false }).catch(() => [])

    const quoteArr = Array.isArray(quotes) ? quotes : [quotes]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quoteMap = new Map<string, any>(quoteArr.map((q: any) => [q.symbol, q]))

    // Fetch YTD history for sparkline + ytdChangePct — batch via chart API
    const results: SectorStockQuote[] = await Promise.all(
      tickers.map(async (symbol) => {
        const q = quoteMap.get(symbol)
        let ytdChangePct: number | null = null
        let sparkline: number[] = []

        try {
          const hist = await yf.chart(symbol, {
            period1: yearStart,
            interval: '1d',
          }, { validateResult: false })

          const closes: number[] = (hist?.quotes ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => p.close)
            .filter((v: unknown): v is number => typeof v === 'number' && isFinite(v))

          if (closes.length >= 2) {
            const ytdFirst = closes[0]
            const ytdLast  = closes[closes.length - 1]
            ytdChangePct = ((ytdLast - ytdFirst) / ytdFirst) * 100

            // Downsample to ~20 points for sparkline
            const step = Math.max(1, Math.floor(closes.length / 20))
            sparkline = closes.filter((_, i) => i % step === 0 || i === closes.length - 1)
          }
        } catch { /* sparkline optional */ }

        return {
          symbol,
          shortName: q?.shortName ?? q?.longName ?? null,
          price: q?.regularMarketPrice ?? null,
          changePct: q?.regularMarketChangePercent != null
            ? Math.round(q.regularMarketChangePercent * 100) / 100
            : null,
          ytdChangePct: ytdChangePct != null ? Math.round(ytdChangePct * 100) / 100 : null,
          sparkline,
        }
      })
    )

    _cache.set(cacheKey, { data: results, ts: Date.now() })
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[sector-stocks]', err)
    return NextResponse.json([], { status: 500 })
  }
}
