import { NextRequest, NextResponse } from 'next/server'
import { getETFData } from '@/lib/data/yahooClient'
import { computeETFScore, scoreLabel } from '@/lib/data/etfScore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSectorWeights(raw: any[]): Array<{ sector: string; weight: number }> {
  if (!Array.isArray(raw)) return []
  const results: Array<{ sector: string; weight: number }> = []
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const keys = Object.keys(item)
      for (const key of keys) {
        const weight = item[key]
        if (typeof weight === 'number' && weight > 0) {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          results.push({ sector: label, weight })
        }
      }
    }
  }
  return results.sort((a, b) => b.weight - a.weight)
}

// Yahoo topHoldings.equityHoldings returns yield-form fractions (e.g. priceToEarnings = earnings yield).
// Invert values < 1 to get the actual price multiple.
function toMultiple(v: unknown): number | null {
  if (typeof v !== 'number' || v <= 0) return null
  return v < 1 ? Math.round((1 / v) * 10) / 10 : Math.round(v * 10) / 10
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()?.trim()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await getETFData(ticker)

    const top = raw?.topHoldings ?? {}
    const fund = raw?.fundProfile ?? {}
    const stats = raw?.defaultKeyStatistics ?? {}
    const detail = raw?.summaryDetail ?? {}
    const price = raw?.price ?? {}

    const holdings = (top.holdings ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((h: any, i: number) => ({
        rank: i + 1,
        symbol: h.symbol ?? '',
        name: h.holdingName ?? h.symbol ?? '',
        weight: typeof h.holdingPercent === 'number' ? h.holdingPercent : null,
      }))

    const sectorWeights = parseSectorWeights(top.sectorWeightings ?? [])

    const eq = top.equityHoldings ?? {}

    const peRatio  = toMultiple(eq.priceToEarnings)
    const pbRatio  = toMultiple(eq.priceToBook)
    const psRatio  = toMultiple(eq.priceToSales)
    const pcfRatio = toMultiple(eq.priceToCashflow)

    const yieldVal: number | null = typeof detail.yield === 'number' ? detail.yield : null

    // expense ratio lives under feesExpensesInvestment, not at top-level
    const fees = fund.feesExpensesInvestment ?? {}
    const expenseRatio: number | null =
      typeof fees.annualReportExpenseRatio === 'number' ? fees.annualReportExpenseRatio :
      typeof fund.expenseRatio === 'number' ? fund.expenseRatio : null

    const { score: valueScore, breakdown: scoreBreakdown } = computeETFScore(peRatio, pbRatio, yieldVal, expenseRatio)

    // Fire-and-forget: record score snapshot for history chart
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    fetch(`${baseUrl}/api/etf/score-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, score: valueScore, peRatio, pbRatio, yieldVal, expenseRatio }),
    }).catch(() => { /* silent — history is best-effort */ })

    return NextResponse.json(
      {
        ticker,
        name: (price.longName ?? price.shortName ?? ticker) as string,
        price: typeof price.regularMarketPrice === 'number' ? price.regularMarketPrice : null,
        priceChange: typeof price.regularMarketChange === 'number' ? price.regularMarketChange : null,
        priceChangePct: typeof price.regularMarketChangePercent === 'number' ? price.regularMarketChangePercent : null,
        fiftyTwoWeekHigh: typeof price.fiftyTwoWeekHigh === 'number' ? price.fiftyTwoWeekHigh : null,
        fiftyTwoWeekLow: typeof price.fiftyTwoWeekLow === 'number' ? price.fiftyTwoWeekLow : null,
        aum: typeof detail.totalAssets === 'number' ? detail.totalAssets : null,
        navPrice: typeof detail.navPrice === 'number' ? detail.navPrice : null,
        expenseRatio,
        yield: yieldVal,
        dividendRate: typeof detail.dividendRate === 'number' ? detail.dividendRate : null,
        beta3Year: typeof stats.beta3Year === 'number' ? stats.beta3Year : null,
        // H3: fundInceptionDate is Unix seconds — multiply by 1000 for ms
        inceptionDate: stats.fundInceptionDate
          ? new Date(stats.fundInceptionDate * 1000).toISOString().split('T')[0]
          : null,
        issuer: typeof fund.family === 'string' ? fund.family : null,
        category: typeof fund.categoryName === 'string' ? fund.categoryName : null,
        managementStyle: typeof fund.managementStyle === 'string' ? fund.managementStyle : null,
        peRatio,
        pbRatio,
        psRatio,
        pcfRatio,
        medianMarketCap: typeof eq.medianMarketCap === 'number' ? eq.medianMarketCap : null,
        valueScore,
        valueScoreLabel: scoreLabel(valueScore),
        scoreBreakdown,
        holdings,
        sectorWeights,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
    )
  } catch (err) {
    console.error('ETF profile error:', err)
    return NextResponse.json({ error: 'Failed to load ETF data' }, { status: 500 })
  }
}
