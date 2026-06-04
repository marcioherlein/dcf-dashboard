import { NextRequest, NextResponse } from 'next/server'
import { getFmpScreener, type FmpScreenerResult } from '@/lib/data/fmpClient'

// Screener results cached 30 minutes — data doesn't change that often and this
// is an expensive query (up to 200 tickers).
export const revalidate = 1800

export interface ScreenerStock {
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  price: number | null
  marketCap: number | null
  beta: number | null
  dividendYield: number | null
  exchange: string | null
}

// FMP's sector names to normalize against
const ALLOWED_SECTORS = new Set([
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Communication Services',
  'Industrials',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
])

function toScreenerStock(r: FmpScreenerResult): ScreenerStock {
  // Compute dividend yield: lastAnnualDividend / price
  const divYield =
    r.lastAnnualDividend != null && r.lastAnnualDividend > 0 && r.price != null && r.price > 0
      ? r.lastAnnualDividend / r.price
      : null

  return {
    ticker: r.symbol,
    name: r.companyName,
    sector: r.sector ?? null,
    industry: r.industry ?? null,
    price: r.price ?? null,
    marketCap: r.marketCap ?? null,
    beta: r.beta ?? null,
    dividendYield: divYield,
    exchange: r.exchangeShortName ?? r.exchange ?? null,
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const sector    = params.get('sector') || undefined
  const capTier   = params.get('capTier') || undefined   // mega | large | mid | small
  const dividends = params.get('dividends') === '1'      // dividend payers only
  const exchange  = (params.get('exchange') as 'NYSE' | 'NASDAQ' | undefined) || undefined

  // Market cap bounds by tier
  let marketCapMoreThan: number | undefined
  let marketCapLowerThan: number | undefined
  if (capTier === 'mega')  { marketCapMoreThan = 200_000_000_000 }
  if (capTier === 'large') { marketCapMoreThan = 10_000_000_000;  marketCapLowerThan = 200_000_000_000 }
  if (capTier === 'mid')   { marketCapMoreThan = 2_000_000_000;   marketCapLowerThan = 10_000_000_000 }
  if (capTier === 'small') { marketCapLowerThan = 2_000_000_000;  marketCapMoreThan = 300_000_000 }

  try {
    // Run two queries in parallel when no exchange filter — NYSE + NASDAQ combined
    const exchanges: Array<'NYSE' | 'NASDAQ'> = exchange
      ? [exchange]
      : ['NYSE', 'NASDAQ']

    const results = await Promise.all(
      exchanges.map(ex =>
        getFmpScreener({
          exchange: ex,
          sector: sector && ALLOWED_SECTORS.has(sector) ? sector : undefined,
          marketCapMoreThan,
          marketCapLowerThan,
          dividendMoreThan: dividends ? 0 : undefined,
          limit: 200,
        }).catch(() => [] as FmpScreenerResult[])
      )
    )

    const combined = results.flat()

    // Deduplicate by ticker (NYSE + NASDAQ can overlap for dual-listed stocks)
    const seen = new Set<string>()
    const deduped: ScreenerStock[] = []
    for (const r of combined) {
      if (!seen.has(r.symbol) && r.isActivelyTrading && !r.isEtf) {
        seen.add(r.symbol)
        deduped.push(toScreenerStock(r))
      }
    }

    // Sort by market cap descending (largest first) as default
    deduped.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))

    return NextResponse.json(deduped, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[/api/screener]', err)
    return NextResponse.json(
      { error: 'Screener data unavailable. FMP may be temporarily down.' },
      { status: 503 }
    )
  }
}
