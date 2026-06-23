import { NextRequest, NextResponse } from 'next/server'
import { getETFData } from '@/lib/data/yahooClient'
import { computeETFScore } from '@/lib/data/etfScore'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

// Simple in-memory IP rate limiter: max 5 requests per 60s per IP
const ipRequestMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipRequestMap.get(ip)
  if (!entry || now > entry.resetAt) {
    ipRequestMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

function toMultiple(v: unknown): number | null {
  if (typeof v !== 'number' || v <= 0) return null
  return v < 1 ? Math.round((1 / v) * 10) / 10 : Math.round(v * 10) / 10
}

async function fetchOne(ticker: string): Promise<ETFBatchItem | null> {
  try {
    // 5-second timeout to avoid hanging on Yahoo rate limits
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await Promise.race([
      getETFData(ticker),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('timeout'))),
      ),
    ]).finally(() => clearTimeout(timeoutId))

    const top = raw?.topHoldings ?? {}
    const fund = raw?.fundProfile ?? {}
    const detail = raw?.summaryDetail ?? {}
    const price = raw?.price ?? {}
    const perf = raw?.fundPerformance ?? {}

    const eq = top.equityHoldings ?? {}
    const peRatio = toMultiple(eq.priceToEarnings)
    const pbRatio = toMultiple(eq.priceToBook)
    const yieldVal: number | null = typeof detail.yield === 'number' ? detail.yield : null
    const fees = fund.feesExpensesInvestment ?? {}
    const expenseRatio: number | null =
      typeof fees.annualReportExpenseRatio === 'number' ? fees.annualReportExpenseRatio :
      typeof fund.expenseRatio === 'number' ? fund.expenseRatio : null

    const { score: valueScore } = computeETFScore(peRatio, pbRatio, yieldVal, expenseRatio)

    const regularMarketPrice: number | null = typeof price.regularMarketPrice === 'number' ? price.regularMarketPrice : null
    const priceChangePct: number | null = typeof price.regularMarketChangePercent === 'number' ? price.regularMarketChangePercent : null

    // Trailing returns from fundPerformance.trailingReturns
    const tr = perf.trailingReturns ?? {}
    const toReturn = (v: unknown): number | null => typeof v === 'number' ? v : null

    // Risk overview from fundPerformance.riskOverview
    const risk = perf.riskOverview ?? {}
    const sharpeRatio: number | null = toReturn(risk.sharpeRatio ?? risk['3YearSharpeRatio'] ?? null)
    const beta3Y: number | null = toReturn(risk.beta ?? risk['3YearBeta'] ?? null)

    return {
      ticker,
      name: (price.longName ?? price.shortName ?? ticker) as string,
      category: typeof fund.categoryName === 'string' ? fund.categoryName : null,
      peRatio,
      pbRatio,
      expenseRatio,
      yield: yieldVal,
      aum: typeof detail.totalAssets === 'number' ? detail.totalAssets : null,
      valueScore,
      price: regularMarketPrice,
      priceChangePct,
      return1M: toReturn(tr.oneMonth ?? tr['1MonthTotalReturn'] ?? null),
      return3M: toReturn(tr.threeMonth ?? tr['3MonthTotalReturn'] ?? null),
      return1Y: toReturn(tr.oneYear ?? tr['1YearTotalReturn'] ?? null),
      return3Y: toReturn(tr.threeYear ?? tr['3YearTotalReturn'] ?? null),
      return5Y: toReturn(tr.fiveYear ?? tr['5YearTotalReturn'] ?? null),
      sharpeRatio,
      beta3Y,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const tickersParam = req.nextUrl.searchParams.get('tickers')
  if (!tickersParam) return NextResponse.json({ error: 'tickers required' }, { status: 400 })

  const tickers = tickersParam
    .split(',')
    .map((t) => t.toUpperCase().trim())
    .filter(Boolean)
    .slice(0, 50)

  const CONCURRENCY = 10
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
