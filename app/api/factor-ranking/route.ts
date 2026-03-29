import { NextRequest, NextResponse } from 'next/server'
import { ALL_INSTRUMENTS, BENCHMARK_TICKERS, type Instrument } from '@/lib/factor/instruments'
import { getCedear } from '@/lib/factor/cedearMap'
import {
  computeEquityMetrics, computeFuturesMetrics,
  computeEquityFactorScores, computeFuturesFactorScores,
  type PriceBar, type EquityRawMetrics, type FuturesRawMetrics,
  type EquityFactorScores, type FuturesFactorScores,
} from '@/lib/factor/computeFactors'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RankedInstrument {
  // Identity
  ticker: string
  displayTicker: string
  name: string
  market: string
  assetType: 'equity' | 'future'
  currency: string
  sector?: string
  // CEDEAR
  isCedear: boolean
  cedearTicker?: string
  cedearRatio?: number
  // Price
  price: number
  change1DPct: number
  // Scores
  finalScore: number
  rank: number
  marketRank: number
  factorScores: EquityFactorScores | FuturesFactorScores
  // Key metrics for display
  keyMetrics: Record<string, number | null>
  // Status
  error?: string
}

// ── Data fetching helpers ─────────────────────────────────────────────────────

async function fetchHistory(ticker: string, days: number): Promise<PriceBar[]> {
  const period2 = new Date()
  const period1 = new Date()
  period1.setDate(period1.getDate() - Math.ceil(days * 1.5)) // fetch extra to account for weekends/holidays

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await yf.historical(ticker, {
      period1: period1.toISOString().split('T')[0],
      period2: period2.toISOString().split('T')[0],
      interval: '1d',
    })
    return rows
      .filter((r) => r.close && r.high && r.low)
      .map((r) => ({
        date: new Date(r.date),
        close: r.adjClose ?? r.close,
        high: r.high,
        low: r.low,
        volume: r.volume ?? 0,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFundamentals(ticker: string): Promise<any | null> {
  try {
    return await yf.quoteSummary(ticker, {
      modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'earningsTrend'],
    })
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchQuote(ticker: string): Promise<any | null> {
  try {
    return await yf.quote(ticker)
  } catch {
    return null
  }
}

// Batch fetch with concurrency limit to avoid rate limits
async function batchFetch<T>(
  items: string[],
  fn: (ticker: string) => Promise<T>,
  concurrency = 5,
): Promise<Map<string, T>> {
  const results = new Map<string, T>()
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const settled = await Promise.allSettled(batch.map(async (ticker) => ({ ticker, data: await fn(ticker) })))
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        results.set(r.value.ticker, r.value.data)
      }
    }
  }
  return results
}

// ── Normalization note ────────────────────────────────────────────────────────
// For percentile ranking we normalize within peer groups:
//   - MERVAL equities rank vs each other (ARS prices, self-normalized)
//   - US equities (NYSE + NASDAQ) rank vs each other (USD prices)
//   - ROFEX futures rank vs each other (USD prices)
// Cross-market USD normalization is applied to keyMetrics display but NOT to
// within-market rankings (which are already relative to peers in same currency).

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market') ?? 'all'
  const topN   = parseInt(req.nextUrl.searchParams.get('topN') ?? '0') || 0
  const onlyCedear = req.nextUrl.searchParams.get('cedear') === '1'
  const normalizeUSD = req.nextUrl.searchParams.get('usd') === '1'

  // Filter instruments
  let instruments = ALL_INSTRUMENTS
  if (market !== 'all') {
    const markets = market.toUpperCase().split(',')
    instruments = instruments.filter((i) => markets.includes(i.market))
  }
  if (onlyCedear) {
    instruments = instruments.filter((i) => i.isCedear || i.assetType === 'future')
  }

  // Unique tickers to fetch
  const equityInstruments = instruments.filter((i) => i.assetType === 'equity')
  const futuresInstruments = instruments.filter((i) => i.assetType === 'future')

  const allTickers = instruments.map((i) => i.ticker)
  const benchmarkTickersNeeded = Array.from(new Set([
    ...instruments.map((i) => i.benchmarkTicker),
    ...BENCHMARK_TICKERS,
  ]))

  // ARS/USD FX rate for cross-currency display
  let arsUsdRate = 1
  if (normalizeUSD) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fxQuote: any = await yf.quote('ARSUSD=X').catch(() => null)
        ?? await yf.quote('ARS=X').catch(() => null)
      arsUsdRate = fxQuote?.regularMarketPrice ?? 1 / 1200  // approximate fallback
    } catch {
      arsUsdRate = 1 / 1200
    }
  }

  // Fetch all price history in parallel batches
  // 380 days = enough for 252 trading days (1Y momentum) + buffer
  const HISTORY_DAYS = 380
  const [historyMap, benchmarkHistoryMap, fundamentalsMap, quotesMap] = await Promise.all([
    batchFetch(allTickers, (t) => fetchHistory(t, HISTORY_DAYS), 4),
    batchFetch(benchmarkTickersNeeded, (t) => fetchHistory(t, HISTORY_DAYS), 4),
    // Fundamentals only for equities (skip futures)
    batchFetch(equityInstruments.map((i) => i.ticker), fetchFundamentals, 3),
    batchFetch(allTickers, fetchQuote, 6),
  ])

  // ── Process equities ─────────────────────────────────────────────────────────

  // Build raw metrics for each equity, grouped by peer group for percentile calc
  interface EquityEntry {
    instrument: Instrument
    metrics: EquityRawMetrics | null
    price: number
    change1DPct: number
  }

  const equityEntries: EquityEntry[] = equityInstruments.map((instrument) => {
    const bars = historyMap.get(instrument.ticker) ?? []
    const benchBars = benchmarkHistoryMap.get(instrument.benchmarkTicker) ?? []
    const fundamentals = fundamentalsMap.get(instrument.ticker) ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = quotesMap.get(instrument.ticker) as any

    const price = quote?.regularMarketPrice ?? (bars.length > 0 ? bars[bars.length - 1].close : 0)
    const prevClose = quote?.regularMarketPreviousClose ?? price
    const change1DPct = prevClose > 0 ? (price - prevClose) / prevClose : 0

    let metrics: EquityRawMetrics | null = null
    if (bars.length >= 60) {
      metrics = computeEquityMetrics(bars, benchBars, fundamentals)
    }

    return { instrument, metrics, price, change1DPct }
  })

  // Group by ranking peer group
  const mervalEntries   = equityEntries.filter((e) => e.instrument.market === 'MERVAL')
  const usEquityEntries = equityEntries.filter((e) => e.instrument.market === 'NYSE' || e.instrument.market === 'NASDAQ')

  function rankEquityGroup(entries: EquityEntry[]): Map<string, EquityFactorScores> {
    const validMetrics = entries.map((e) => e.metrics)
    const scoreMap = new Map<string, EquityFactorScores>()
    entries.forEach((entry, idx) => {
      if (!validMetrics[idx]) {
        scoreMap.set(entry.instrument.ticker, { momentum: 50, trend: 50, earnings: 50, quality: 50, risk: 50, finalScore: 50 })
        return
      }
      const allMetrics = validMetrics.filter((m): m is EquityRawMetrics => m !== null)
      const validIdx = allMetrics.indexOf(validMetrics[idx]!)
      if (validIdx === -1) {
        scoreMap.set(entry.instrument.ticker, { momentum: 50, trend: 50, earnings: 50, quality: 50, risk: 50, finalScore: 50 })
        return
      }
      const scores = computeEquityFactorScores(allMetrics, validIdx)
      scoreMap.set(entry.instrument.ticker, scores)
    })
    return scoreMap
  }

  const mervalScores   = rankEquityGroup(mervalEntries)
  const usEquityScores = rankEquityGroup(usEquityEntries)

  function equityScoreFor(ticker: string, market: string): EquityFactorScores {
    const map = market === 'MERVAL' ? mervalScores : usEquityScores
    return map.get(ticker) ?? { momentum: 50, trend: 50, earnings: 50, quality: 50, risk: 50, finalScore: 50 }
  }

  // ── Process futures ──────────────────────────────────────────────────────────

  interface FuturesEntry {
    instrument: Instrument
    metrics: FuturesRawMetrics | null
    price: number
    change1DPct: number
  }

  const futuresEntries: FuturesEntry[] = futuresInstruments.map((instrument) => {
    const bars = historyMap.get(instrument.ticker) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = quotesMap.get(instrument.ticker) as any

    const price = quote?.regularMarketPrice ?? (bars.length > 0 ? bars[bars.length - 1].close : 0)
    const prevClose = quote?.regularMarketPreviousClose ?? price
    const change1DPct = prevClose > 0 ? (price - prevClose) / prevClose : 0

    const metrics = bars.length >= 30 ? computeFuturesMetrics(bars) : null
    return { instrument, metrics, price, change1DPct }
  })

  // Rank futures as a group
  const validFutMetrics = futuresEntries.map((e) => e.metrics).filter((m): m is FuturesRawMetrics => m !== null)
  const futuresScoreMap = new Map<string, FuturesFactorScores>()
  futuresEntries.forEach((entry, idx) => {
    const m = futuresEntries[idx].metrics
    if (!m) {
      futuresScoreMap.set(entry.instrument.ticker, { momentum: 50, termStructure: 50, volatility: 50, liquidity: 50, finalScore: 50 })
      return
    }
    const validIdx = validFutMetrics.indexOf(m)
    if (validIdx === -1) {
      futuresScoreMap.set(entry.instrument.ticker, { momentum: 50, termStructure: 50, volatility: 50, liquidity: 50, finalScore: 50 })
      return
    }
    futuresScoreMap.set(entry.instrument.ticker, computeFuturesFactorScores(validFutMetrics, validIdx))
  })

  // ── Assemble final results ───────────────────────────────────────────────────

  const allResults: RankedInstrument[] = []

  // Equities
  for (const entry of equityEntries) {
    const { instrument, metrics, price, change1DPct } = entry
    const scores = equityScoreFor(instrument.ticker, instrument.market)
    const cedearData = instrument.isCedear ? getCedear(instrument.ticker) : undefined

    const displayPrice = normalizeUSD && instrument.currency === 'ARS'
      ? price * arsUsdRate
      : price

    const keyMetrics: Record<string, number | null> = metrics
      ? {
          'Ret 12M':       Math.round(metrics.return12M * 1000) / 10,
          'Ret 6M (skip)': Math.round(metrics.return6MSkip1M * 1000) / 10,
          'vs 200MA':      Math.round(metrics.pctAbove200MA * 1000) / 10,
          'vs 50MA':       Math.round(metrics.pctAbove50MA * 1000) / 10,
          'Dist 52w Hi':   Math.round(metrics.distTo52wHigh * 1000) / 10,
          'ATR%':          Math.round(metrics.atrPct * 1000) / 10,
          'Max DD 6M':     Math.round(metrics.maxDD6M * 1000) / 10,
          'EPS Gr YoY':    metrics.epsGrowthYoY !== null ? Math.round(metrics.epsGrowthYoY * 1000) / 10 : null,
          'Rev Gr YoY':    metrics.revenueGrowthYoY !== null ? Math.round(metrics.revenueGrowthYoY * 1000) / 10 : null,
          'ROE':           metrics.roe !== null ? Math.round(metrics.roe * 1000) / 10 : null,
        }
      : {}

    allResults.push({
      ticker: instrument.ticker,
      displayTicker: instrument.displayTicker,
      name: instrument.name,
      market: instrument.market,
      assetType: 'equity',
      currency: normalizeUSD ? 'USD' : instrument.currency,
      sector: instrument.sector,
      isCedear: instrument.isCedear ?? false,
      cedearTicker: cedearData?.bcbaTicker,
      cedearRatio: cedearData?.ratio,
      price: displayPrice,
      change1DPct: Math.round(change1DPct * 10000) / 100,
      finalScore: Math.round(scores.finalScore * 10) / 10,
      rank: 0,
      marketRank: 0,
      factorScores: {
        momentum: Math.round(scores.momentum * 10) / 10,
        trend: Math.round(scores.trend * 10) / 10,
        earnings: Math.round(scores.earnings * 10) / 10,
        quality: Math.round(scores.quality * 10) / 10,
        risk: Math.round(scores.risk * 10) / 10,
        finalScore: Math.round(scores.finalScore * 10) / 10,
      },
      keyMetrics,
    })
  }

  // Futures
  for (const entry of futuresEntries) {
    const { instrument, price, change1DPct } = entry
    const scores = futuresScoreMap.get(instrument.ticker) ?? { momentum: 50, termStructure: 50, volatility: 50, liquidity: 50, finalScore: 50 }
    const metrics = entry.metrics

    const keyMetrics: Record<string, number | null> = metrics
      ? {
          'Ret 1M':   Math.round(metrics.return1M * 1000) / 10,
          'Ret 3M':   Math.round(metrics.return3M * 1000) / 10,
          'Trend':    Math.round(metrics.trendStrength * 1000) / 10,
          'ATR%':     Math.round(metrics.atrPct * 1000) / 10,
          'Vol Exp':  Math.round(metrics.volExpansion * 100) / 100,
          'Vol Trend':Math.round(metrics.volumeTrend * 100) / 100,
        }
      : {}

    allResults.push({
      ticker: instrument.ticker,
      displayTicker: instrument.displayTicker,
      name: instrument.name,
      market: instrument.market,
      assetType: 'future',
      currency: instrument.currency,
      isCedear: false,
      price,
      change1DPct: Math.round(change1DPct * 10000) / 100,
      finalScore: Math.round(scores.finalScore * 10) / 10,
      rank: 0,
      marketRank: 0,
      factorScores: {
        momentum: Math.round(scores.momentum * 10) / 10,
        termStructure: Math.round(scores.termStructure * 10) / 10,
        volatility: Math.round(scores.volatility * 10) / 10,
        liquidity: Math.round(scores.liquidity * 10) / 10,
        finalScore: Math.round(scores.finalScore * 10) / 10,
      },
      keyMetrics,
    })
  }

  // ── Assign global and market-level ranks ─────────────────────────────────────
  allResults.sort((a, b) => b.finalScore - a.finalScore)
  allResults.forEach((r, i) => { r.rank = i + 1 })

  // Market-level rank (within same market)
  const byMarket = new Map<string, RankedInstrument[]>()
  for (const r of allResults) {
    const key = `${r.market}_${r.assetType}`
    const group = byMarket.get(key) ?? []
    group.push(r)
    byMarket.set(key, group)
  }
  for (const group of byMarket.values()) {
    group.sort((a, b) => b.finalScore - a.finalScore)
    group.forEach((r, i) => { r.marketRank = i + 1 })
  }

  // Apply topN filter (per market if cross-market query, or globally)
  let finalResults = allResults
  if (topN > 0) {
    finalResults = allResults.slice(0, topN)
  }

  // Metadata
  const metadata = {
    computedAt: new Date().toISOString(),
    totalInstruments: allResults.length,
    marketCounts: Object.fromEntries(
      Array.from(byMarket.entries()).map(([k, v]) => [k, v.length])
    ),
    normalizedToUSD: normalizeUSD,
    arsUsdRate: normalizeUSD ? arsUsdRate : undefined,
  }

  return NextResponse.json({ results: finalResults, metadata }, {
    headers: {
      // Cache for 30 minutes — factor rankings don't need real-time updates
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  })
}
