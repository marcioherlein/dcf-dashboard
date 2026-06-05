import { NextRequest, NextResponse } from 'next/server'
import { SCREENER_UNIVERSE } from '@/lib/data/screenerUniverse'
import { rateLimit } from '@/lib/rateLimit'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// Server-side cache — avoid re-fetching 200 quotes on every request within the TTL
let _cache: { data: ScreenerStock[]; ts: number } | null = null
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

export interface ScreenerStock {
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  price: number | null
  marketCap: number | null
  beta: number | null
  dividendYield: number | null
  exchange: 'NYSE' | 'NASDAQ' | null
  trailingPE: number | null
}

// Market cap tier boundaries
const CAP_BOUNDS: Record<string, { min?: number; max?: number }> = {
  mega:  { min: 200e9 },
  large: { min: 10e9,  max: 200e9 },
  mid:   { min: 2e9,   max: 10e9  },
  small: { min: 300e6, max: 2e9   },
}

async function fetchAllQuotes(): Promise<ScreenerStock[]> {
  const now = Date.now()
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data

  const tickers = SCREENER_UNIVERSE.map(t => t.ticker)
  const metaMap = new Map(SCREENER_UNIVERSE.map(t => [t.ticker, t]))

  // Batch in groups of 100 to stay within Yahoo limits
  const BATCH = 100
  const batches: string[][] = []
  for (let i = 0; i < tickers.length; i += BATCH) batches.push(tickers.slice(i, i + BATCH))

  // Fields to request — explicit list avoids the schema validation error for unknown fields
  const QUOTE_FIELDS = [
    'regularMarketPrice', 'marketCap', 'trailingPE', 'dividendYield',
    'beta', 'exchange', 'longName', 'shortName',
  ] as const

  const results: ScreenerStock[] = []
  for (const batch of batches) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quotes: any[] = await yf.quote(batch, { fields: QUOTE_FIELDS }, { validateResult: false })
      for (const q of (Array.isArray(quotes) ? quotes : [])) {
        const meta = metaMap.get(q.symbol)
        if (!meta) continue

        const divYield = (q.dividendYield != null && q.dividendYield > 0)
          ? q.dividendYield / 100  // Yahoo returns e.g. 0.35 meaning 0.35% → store as 0.0035
          : null

        results.push({
          ticker:       q.symbol,
          name:         q.longName ?? q.shortName ?? meta.name,
          sector:       meta.sector,
          industry:     null,
          price:        q.regularMarketPrice ?? null,
          marketCap:    q.marketCap ?? null,
          beta:         q.beta ?? null,
          dividendYield: divYield,
          exchange:     meta.exchange,
          trailingPE:   q.trailingPE ?? null,
        })
      }
    } catch (err) {
      console.error('[screener] batch quote error:', err)
    }
  }

  // Sort by market cap desc
  results.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
  _cache = { data: results, ts: now }
  return results
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 2, 300000, 'screener')
  if (limited) return limited

  const params = req.nextUrl.searchParams
  const sector    = params.get('sector') || undefined
  const capTier   = params.get('capTier') || undefined
  const dividends = params.get('dividends') === '1'
  const exchange  = params.get('exchange') || undefined

  try {
    const all = await fetchAllQuotes()

    let filtered = all
    if (sector)              filtered = filtered.filter(s => s.sector === sector)
    if (exchange && exchange !== 'all') filtered = filtered.filter(s => s.exchange === exchange)
    if (dividends)           filtered = filtered.filter(s => s.dividendYield != null && s.dividendYield > 0)

    if (capTier && CAP_BOUNDS[capTier]) {
      const { min, max } = CAP_BOUNDS[capTier]
      filtered = filtered.filter(s => {
        if (s.marketCap == null) return false
        if (min != null && s.marketCap < min) return false
        if (max != null && s.marketCap >= max) return false
        return true
      })
    }

    return NextResponse.json(filtered, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    })
  } catch (err) {
    console.error('[/api/screener]', err)
    return NextResponse.json(
      { error: 'Screener data unavailable. Please try again in a moment.' },
      { status: 503 }
    )
  }
}
