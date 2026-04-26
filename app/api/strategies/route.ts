import { NextResponse } from 'next/server'
import { STRATEGY_UNIVERSE, StrategyRow } from '@/lib/strategies/types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// ─── Math helpers ─────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function std(arr: number[]): number {
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  return mean(closes.slice(-period))
}

function assignRanks(rows: { ticker: string; value: number | null }[], ascending: boolean): Map<string, number> {
  const valid = rows.filter(r => r.value !== null) as { ticker: string; value: number }[]
  const sorted = [...valid].sort((a, b) => ascending ? a.value - b.value : b.value - a.value)
  const m = new Map<string, number>()
  sorted.forEach((r, i) => m.set(r.ticker, i + 1))
  return m
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const tickers = STRATEGY_UNIVERSE.map(t => t.ticker)

  const now = new Date()
  const period1 = new Date(now)
  period1.setMonth(period1.getMonth() - 14)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const histMap = new Map<string, any[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteMap = new Map<string, any>()

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const [hist, summary] = await Promise.all([
          yf.historical(ticker, {
            period1: period1.toISOString().split('T')[0],
            period2: now.toISOString().split('T')[0],
            interval: '1d',
          }),
          yf.quoteSummary(ticker, {
            modules: ['defaultKeyStatistics', 'summaryDetail', 'financialData', 'price'],
          }).catch(() => null),
        ])
        if (hist?.length) histMap.set(ticker, hist)
        if (summary) quoteMap.set(ticker, summary)
      } catch {
        // skip failed tickers
      }
    })
  )

  // Build per-ticker signals
  const rawRows: StrategyRow[] = STRATEGY_UNIVERSE.map(({ ticker, name, layer, category }) => {
    const hist = histMap.get(ticker) ?? []
    const summary = quoteMap.get(ticker)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const closes: number[] = hist.map((r: any) => r.adjClose ?? r.close).filter((v: number) => v > 0)
    const price = closes.length > 0 ? closes[closes.length - 1] : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr = summary?.price as any
    const change1d: number | null = pr?.regularMarketChangePercent ?? null

    // ── Strategy 1: Price Momentum (12-1) ────────────────────────────────────
    let momentum12_1: number | null = null
    if (closes.length >= 250) {
      const skip = Math.min(21, closes.length - 50)
      const lookback = Math.min(252, closes.length - skip - 1)
      const pSkip = closes[closes.length - 1 - skip]
      const pBase = closes[closes.length - 1 - skip - lookback]
      if (pBase > 0) momentum12_1 = pSkip / pBase - 1
    }

    // ── Strategy 2: Low Volatility (252-day) ─────────────────────────────────
    let vol252: number | null = null
    if (closes.length >= 63) {
      const window = closes.slice(-Math.min(253, closes.length))
      const returns: number[] = []
      for (let i = 1; i < window.length; i++) {
        returns.push(window[i] / window[i - 1] - 1)
      }
      if (returns.length >= 20) vol252 = std(returns) * Math.sqrt(252)
    }

    // ── Strategy 3: MA Signal ─────────────────────────────────────────────────
    const ma50  = sma(closes, 50)
    const ma200 = sma(closes, 200)
    let maSpread: number | null = null
    let maSignal: 'golden' | 'death' | null = null
    if (ma50 !== null && ma200 !== null && ma200 > 0) {
      maSpread = (ma50 - ma200) / ma200
      maSignal = ma50 > ma200 ? 'golden' : 'death'
    }

    // ── Strategy 4: Mean Reversion (1-month return) ───────────────────────────
    let return1m: number | null = null
    if (closes.length >= 22) {
      const pNow   = closes[closes.length - 1]
      const p1mAgo = closes[closes.length - 21]
      if (p1mAgo > 0) return1m = pNow / p1mAgo - 1
    }

    // ── Strategy 5: Value composite ───────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ks = summary?.defaultKeyStatistics as any ?? {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sd = summary?.summaryDetail as any ?? {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = summary?.financialData as any ?? {}
    const pe      = ks.trailingPE ?? sd.trailingPE ?? null
    const pb      = ks.priceToBook ?? null
    const ps      = fd.priceToSalesTrailing12Months ?? null
    const evEbitda = ks.enterpriseToEbitda ?? null

    return {
      ticker, name, layer, category, price, change1d,
      momentum12_1,
      momentumRank: null,
      vol252,
      volRank: null,
      ma50: null,
      ma200: null,
      maSpread,
      maSignal,
      return1m,
      mrZscore: null,
      pe, pb, ps, evEbitda,
      valueRank: null,
    }
  })

  // ── Cross-sectional ranking ───────────────────────────────────────────────

  const momRanks = assignRanks(
    rawRows.map(r => ({ ticker: r.ticker, value: r.momentum12_1 })),
    false
  )

  const volRanks = assignRanks(
    rawRows.map(r => ({ ticker: r.ticker, value: r.vol252 })),
    true
  )

  const returns1m = rawRows.map(r => r.return1m).filter((v): v is number => v !== null)
  const mrMean = returns1m.length > 1 ? mean(returns1m) : 0
  const mrStd  = returns1m.length > 1 ? std(returns1m) : 1

  const nRows = rawRows.length
  function safeRank(values: (number | null)[], ascending: boolean): number[] {
    const withIdx = values.map((v, i) => ({ v, i }))
    const valid = withIdx.filter(x => x.v !== null) as { v: number; i: number }[]
    const sorted = [...valid].sort((a, b) => ascending ? a.v - b.v : b.v - a.v)
    const rankArr = new Array(values.length).fill(null)
    sorted.forEach((x, rank) => { rankArr[x.i] = rank + 1 })
    const midRank = Math.ceil(nRows / 2)
    return rankArr.map(r => r ?? midRank)
  }

  const peRanks  = safeRank(rawRows.map(r => (r.pe      !== null && r.pe      > 0) ? r.pe      : null), true)
  const pbRanks  = safeRank(rawRows.map(r => (r.pb      !== null && r.pb      > 0) ? r.pb      : null), true)
  const psRanks  = safeRank(rawRows.map(r => (r.ps      !== null && r.ps      > 0) ? r.ps      : null), true)
  const evRanks  = safeRank(rawRows.map(r => (r.evEbitda !== null && r.evEbitda > 0) ? r.evEbitda : null), true)

  const valueComposite = rawRows.map((_, i) =>
    (peRanks[i] + pbRanks[i] + psRanks[i] + evRanks[i]) / 4
  )
  const valueRankMap = assignRanks(
    rawRows.map((r, i) => ({ ticker: r.ticker, value: valueComposite[i] })),
    true
  )

  const results: StrategyRow[] = rawRows.map((r) => ({
    ...r,
    momentumRank: momRanks.get(r.ticker) ?? null,
    volRank:      volRanks.get(r.ticker) ?? null,
    mrZscore: r.return1m !== null ? (r.return1m - mrMean) / (mrStd || 0.01) : null,
    valueRank: valueRankMap.get(r.ticker) ?? null,
  }))

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
  })
}
