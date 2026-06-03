import { NextRequest, NextResponse } from 'next/server'
import { ALL_TICKERS } from '@/lib/data/etfUniverse'
import { getETFData } from '@/lib/data/yahooClient'
import { computeETFScore } from '@/lib/data/etfScore'

interface HoldingResult {
  etfTicker: string
  etfName: string
  weight: number
  valueScore: number | null
}

function toMultiple(v: unknown): number | null {
  if (typeof v !== 'number' || v <= 0) return null
  return v < 1 ? Math.round((1 / v) * 10) / 10 : Math.round(v * 10) / 10
}

async function getETFHoldings(etfTicker: string): Promise<{
  name: string
  holdings: Array<{ symbol: string; weight: number | null }>
  valueScore: number | null
} | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await getETFData(etfTicker)
    if (!raw) return null

    const top = raw?.topHoldings ?? {}
    const price = raw?.price ?? {}

    const name: string = price?.longName ?? price?.shortName ?? etfTicker

    const holdings = (top.holdings ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((h: any) => ({
        symbol: (h.symbol ?? '') as string,
        weight: typeof h.holdingPercent === 'number' ? h.holdingPercent : null,
      }))

    const eq = top.equityHoldings ?? {}
    const detail = raw?.summaryDetail ?? {}
    const stats = raw?.defaultKeyStatistics ?? {}

    const peRatio = toMultiple(eq.priceToEarnings)
    const pbRatio = toMultiple(eq.priceToBook)
    const yieldVal = typeof detail.yield === 'number' ? detail.yield : null
    const expenseRatio = typeof stats.annualReportExpenseRatio === 'number' ? stats.annualReportExpenseRatio : null

    const { score: valueScore } = computeETFScore(peRatio, pbRatio, yieldVal, expenseRatio)

    return { name, holdings, valueScore }
  } catch {
    return null
  }
}

const CONCURRENCY = 6

export async function GET(req: NextRequest) {
  const stockTicker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()?.trim()
  if (!stockTicker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const results: HoldingResult[] = []

  for (let i = 0; i < ALL_TICKERS.length; i += CONCURRENCY) {
    const batch = ALL_TICKERS.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map(t => getETFHoldings(t).then(profile => ({ ticker: t, profile }))))
    for (const r of settled) {
      if (r.status !== 'fulfilled' || !r.value.profile) continue
      const { profile } = r.value
      const match = profile.holdings.find(h => h.symbol?.toUpperCase() === stockTicker)
      if (match) {
        results.push({
          etfTicker: r.value.ticker,
          etfName: profile.name,
          weight: match.weight ?? 0,
          valueScore: profile.valueScore,
        })
      }
    }
  }

  results.sort((a, b) => b.weight - a.weight)

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  })
}
