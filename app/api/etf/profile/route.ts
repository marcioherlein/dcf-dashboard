import { NextRequest, NextResponse } from 'next/server'
import { getETFData } from '@/lib/data/yahooClient'

function computeValueScore(params: {
  peRatio: number | null
  pbRatio: number | null
  yieldVal: number | null
  expenseRatio: number | null
}): { score: number; breakdown: { pe: number; pb: number; yieldPts: number; expensePenalty: number } } {
  const { peRatio, pbRatio, yieldVal, expenseRatio } = params

  // P/E: 0-30 pts — lower is better (≤12 → 30, ≥30 → 0)
  let pe = 0
  if (peRatio != null && peRatio > 0) {
    pe = Math.max(0, Math.min(30, ((30 - peRatio) / (30 - 12)) * 30))
  }

  // P/B: 0-25 pts — lower is better (≤1.0 → 25, ≥4.0 → 0)
  let pb = 0
  if (pbRatio != null && pbRatio > 0) {
    pb = Math.max(0, Math.min(25, ((4 - pbRatio) / (4 - 1)) * 25))
  }

  // Yield: 0-25 pts — higher is better (≥4% → 25, 0% → 0)
  let yieldPts = 0
  if (yieldVal != null && yieldVal > 0) {
    yieldPts = Math.min(25, (yieldVal / 0.04) * 25)
  }

  // Expense ratio penalty: 0-20 pts (≤0.05% → 0, ≥0.75% → 20)
  let expensePenalty = 0
  if (expenseRatio != null && expenseRatio > 0.0005) {
    expensePenalty = Math.min(20, ((expenseRatio - 0.0005) / (0.0075 - 0.0005)) * 20)
  }

  const score = Math.round(Math.max(0, Math.min(100, pe + pb + yieldPts - expensePenalty)))
  return { score, breakdown: { pe: Math.round(pe), pb: Math.round(pb), yieldPts: Math.round(yieldPts), expensePenalty: Math.round(expensePenalty) } }
}

function valueScoreLabel(score: number): string {
  if (score >= 70) return 'Deep Value'
  if (score >= 50) return 'Fair Value'
  if (score >= 30) return 'Stretched'
  return 'Expensive'
}

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

    const { score: valueScore, breakdown: scoreBreakdown } = computeValueScore({ peRatio, pbRatio, yieldVal, expenseRatio })

    return NextResponse.json({
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
      inceptionDate: stats.fundInceptionDate
        ? new Date(stats.fundInceptionDate).toISOString().split('T')[0]
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
      valueScoreLabel: valueScoreLabel(valueScore),
      scoreBreakdown,
      holdings,
      sectorWeights,
    })
  } catch (err) {
    console.error('ETF profile error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
