import { NextRequest, NextResponse } from 'next/server'
import { getETFData } from '@/lib/data/yahooClient'

function computeValueScore(params: {
  peRatio: number | null
  pbRatio: number | null
  yieldVal: number | null
  expenseRatio: number | null
}): number {
  const { peRatio, pbRatio, yieldVal, expenseRatio } = params
  let pe = 0
  if (peRatio != null && peRatio > 0) pe = Math.max(0, Math.min(30, ((30 - peRatio) / (30 - 12)) * 30))
  let pb = 0
  if (pbRatio != null && pbRatio > 0) pb = Math.max(0, Math.min(25, ((4 - pbRatio) / (4 - 1)) * 25))
  let yieldPts = 0
  if (yieldVal != null && yieldVal > 0) yieldPts = Math.min(25, (yieldVal / 0.04) * 25)
  let expensePenalty = 0
  if (expenseRatio != null && expenseRatio > 0.0005) {
    expensePenalty = Math.min(20, ((expenseRatio - 0.0005) / (0.0075 - 0.0005)) * 20)
  }
  return Math.round(Math.max(0, Math.min(100, pe + pb + yieldPts - expensePenalty)))
}

function toMultiple(v: unknown): number | null {
  if (typeof v !== 'number' || v <= 0) return null
  return v < 1 ? Math.round((1 / v) * 10) / 10 : Math.round(v * 10) / 10
}

export interface ETFBatchItem {
  ticker: string
  name: string
  category: string | null
  peRatio: number | null
  pbRatio: number | null
  expenseRatio: number | null
  yield: number | null
  aum: number | null
  valueScore: number
}

async function fetchOne(ticker: string): Promise<ETFBatchItem | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await getETFData(ticker)
    const top = raw?.topHoldings ?? {}
    const fund = raw?.fundProfile ?? {}
    const detail = raw?.summaryDetail ?? {}
    const price = raw?.price ?? {}

    const eq = top.equityHoldings ?? {}
    const peRatio = toMultiple(eq.priceToEarnings)
    const pbRatio = toMultiple(eq.priceToBook)
    const yieldVal: number | null = typeof detail.yield === 'number' ? detail.yield : null
    const fees = fund.feesExpensesInvestment ?? {}
    const expenseRatio: number | null =
      typeof fees.annualReportExpenseRatio === 'number' ? fees.annualReportExpenseRatio :
      typeof fund.expenseRatio === 'number' ? fund.expenseRatio : null

    return {
      ticker,
      name: (price.longName ?? price.shortName ?? ticker) as string,
      category: typeof fund.categoryName === 'string' ? fund.categoryName : null,
      peRatio,
      pbRatio,
      expenseRatio,
      yield: yieldVal,
      aum: typeof detail.totalAssets === 'number' ? detail.totalAssets : null,
      valueScore: computeValueScore({ peRatio, pbRatio, yieldVal, expenseRatio }),
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get('tickers')
  if (!tickersParam) return NextResponse.json({ error: 'tickers required' }, { status: 400 })

  const tickers = tickersParam
    .split(',')
    .map((t) => t.toUpperCase().trim())
    .filter(Boolean)
    .slice(0, 50)

  // Fetch in parallel batches of 6 to avoid Yahoo rate limits
  const CONCURRENCY = 6
  const results: Record<string, ETFBatchItem | null> = {}

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map((t) => fetchOne(t)))
    settled.forEach((r, idx) => {
      results[batch[idx]] = r.status === 'fulfilled' ? r.value : null
    })
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  })
}
