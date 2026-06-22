import { NextResponse } from 'next/server'
import { SCREENER_UNIVERSE } from '@/lib/data/screenerUniverse'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdeaStock {
  ticker: string
  name: string
  sector: string | null
  price: number | null
  fairValue: number | null
  upsidePct: number | null
  impliedCAGR: number | null
  historicalCagr3y: number | null
  expectation: 'Conservative' | 'Moderate' | 'Aggressive' | 'Very Aggressive' | null
  marketCap: number | null
  pctFrom52WHigh: number | null
  analystRating: number | null
}

export type SignalId =
  | 'undervalued'
  | 'margin_of_safety'
  | 'priced_for_perfection'
  | 'contrarian'
  | 'near_52w_low'
  | 'high_conviction'

export interface IdeasResponse {
  signals: Record<SignalId, IdeaStock[]>
  updatedAt: string
  totalAnalyzed: number
}

// ─── Cache — 6-hour TTL ───────────────────────────────────────────────────────

let _cache: { data: IdeasResponse; ts: number } | null = null
const CACHE_TTL = 6 * 60 * 60 * 1000

// ─── Signal definitions ───────────────────────────────────────────────────────

// A curated subset of large/mid-cap liquid tickers to keep response fast.
// We avoid running all 5000 screener stocks through DCF logic.
const IDEAS_UNIVERSE = [
  // Mega cap US
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'BRK-B', 'JPM', 'V',
  'UNH', 'JNJ', 'WMT', 'MA', 'HD', 'PG', 'MRK', 'KO', 'PEP', 'CVX',
  'LLY', 'ABBV', 'ORCL', 'BAC', 'XOM', 'COST', 'NFLX', 'CRM', 'ADBE', 'AMD',
  // Large cap
  'INTC', 'QCOM', 'TXN', 'IBM', 'NOW', 'UBER', 'SPOT', 'SQ', 'PYPL', 'SNAP',
  'LYFT', 'ZM', 'DOCU', 'SHOP', 'MDB', 'SNOW', 'PLTR', 'HOOD', 'COIN', 'RBLX',
  'ABNB', 'DASH', 'RIVN', 'LCID', 'NIO', 'BIDU', 'BABA', 'JD', 'PDD', 'TSM',
  'ASML', 'SAP', 'TM', 'SONY', 'BHP', 'RIO', 'VALE', 'FCX', 'NEM', 'GS',
  'MS', 'C', 'WFC', 'AXP', 'BLK', 'SCHW', 'MCD', 'SBUX', 'YUM', 'CMG',
  'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'CHTR', 'ATVI', 'EA', 'TTWO', 'RKLB',
  // Dividend / value
  'PFE', 'MO', 'PM', 'BTI', 'ENB', 'EPD', 'ET', 'WPC', 'O', 'VICI',
  'SPG', 'PLD', 'AMT', 'CCI', 'SBAC', 'DLR', 'EQIX', 'PSA', 'EXR', 'AVB',
]

// ─── Expectation classifier ───────────────────────────────────────────────────

function classifyExpectation(impliedCAGR: number, historicalCagr3y: number | null): IdeaStock['expectation'] {
  if (impliedCAGR < 5) return 'Conservative'
  if (historicalCagr3y != null && impliedCAGR < historicalCagr3y * 0.80) return 'Conservative'
  if (impliedCAGR < 12) return 'Moderate'
  if (impliedCAGR < 25) return 'Aggressive'
  return 'Very Aggressive'
}

// ─── Simplified implied CAGR ──────────────────────────────────────────────────
// Uses analyst forward EPS growth (from epsForward vs epsTTM) as the primary
// signal. Falls back to revenue growth when EPS data is missing.
// Result is annualised forward growth expectation, in percent (e.g. 15.0 = 15%).

function estimateImpliedCAGR(
  epsForward: number | null,
  epsTTM: number | null,
  revenueGrowth: number | null,   // decimal, e.g. 0.22 = 22%
  epsGrowth: number | null,       // decimal, trailing YoY from financialData
): number | null {
  // Best: forward EPS / TTM EPS → NTM implied growth
  if (epsForward != null && epsTTM != null && Math.abs(epsTTM) > 0.01) {
    const growth = (epsForward / epsTTM) - 1
    // Only use if result is plausible (-80% to +300%)
    if (growth >= -0.80 && growth <= 3.0) return growth * 100
  }

  // Fallback: analyst EPS growth from financialData
  if (epsGrowth != null && epsGrowth >= -0.80 && epsGrowth <= 3.0) {
    return epsGrowth * 100
  }

  // Last resort: revenue growth
  if (revenueGrowth != null && revenueGrowth >= -0.80 && revenueGrowth <= 3.0) {
    return revenueGrowth * 100
  }

  return null
}

// ─── Fair value estimate ──────────────────────────────────────────────────────
// Primary: analyst consensus target price (targetMeanPrice from financialData).
// This is the most defensible single-number fair value proxy available without
// a full DCF — it represents the aggregated analyst 12-month target.
// Secondary: simple forward earnings model when target price is unavailable.

function estimateFairValue(
  price: number,
  targetMeanPrice: number | null,
  forwardPE: number | null,       // from quote() — reliable
  epsForward: number | null,
  epsTTM: number | null,
  epsGrowth: number | null,
): number | null {
  // Primary: analyst target price
  if (targetMeanPrice != null && targetMeanPrice > 0 && targetMeanPrice < price * 5) {
    return targetMeanPrice
  }

  // Secondary: forward earnings × exit multiple
  // Uses forwardPE from quote() (not financialData — that field is unreliable)
  if (forwardPE != null && forwardPE > 0 && forwardPE < 150 && epsForward != null && epsForward > 0) {
    // Project forward EPS 2 years at expected growth, apply slight P/E compression
    const growth = (epsGrowth ?? 0.08)
    const clampedGrowth = Math.max(-0.20, Math.min(0.60, growth))
    const futureEPS = epsForward * Math.pow(1 + clampedGrowth, 2)
    const exitPE = Math.max(10, Math.min(40, forwardPE * 0.90))
    const tv = futureEPS * exitPE
    const pv = tv / Math.pow(1.09, 2)
    if (isFinite(pv) && pv > 0) return pv
  }

  // Tertiary: TTM EPS × reasonable multiple
  if (epsTTM != null && epsTTM > 0) {
    const impliedMultiple = Math.min(30, Math.max(12, 20))
    return epsTTM * impliedMultiple
  }

  return null
}

// ─── Fetch and compute ────────────────────────────────────────────────────────

async function buildIdeas(): Promise<IdeasResponse> {
  const now = Date.now()
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data

  const metaMap = new Map(SCREENER_UNIVERSE.map(t => [t.ticker, t]))

  // Batch quote fetch
  const BATCH = 50
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteMap = new Map<string, any>()
  for (let i = 0; i < IDEAS_UNIVERSE.length; i += BATCH) {
    const batch = IDEAS_UNIVERSE.slice(i, i + BATCH)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = await yf.quote(batch, {
        fields: [
          'regularMarketPrice', 'marketCap', 'forwardPE', 'trailingPE',
          'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'longName', 'shortName',
          'epsForward', 'epsTrailingTwelveMonths',
        ]
      }, { validateResult: false })
      for (const q of (Array.isArray(results) ? results : [])) {
        if (q?.symbol) quoteMap.set(q.symbol, q)
      }
    } catch { /* skip batch */ }
  }

  // Enriched fundamentals — smaller batch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryMap = new Map<string, any>()
  const SUMMARY_BATCH = 10
  for (let i = 0; i < IDEAS_UNIVERSE.length; i += SUMMARY_BATCH) {
    const batch = IDEAS_UNIVERSE.slice(i, i + SUMMARY_BATCH)
    await Promise.allSettled(batch.map(async (ticker) => {
      try {
        const s = await yf.quoteSummary(ticker, {
          modules: ['financialData', 'defaultKeyStatistics'],
        }, { validateResult: false })
        summaryMap.set(ticker, s)
      } catch { /* skip */ }
    }))
  }

  // Assemble IdeaStock records
  const stocks: IdeaStock[] = []
  for (const ticker of IDEAS_UNIVERSE) {
    const q = quoteMap.get(ticker)
    if (!q) continue

    const price = q.regularMarketPrice ?? null
    if (!price || price <= 0) continue

    const meta = metaMap.get(ticker)
    const s = summaryMap.get(ticker)
    const fd = s?.financialData ?? null
    const _ks = s?.defaultKeyStatistics ?? null

    const high52  = q.fiftyTwoWeekHigh ?? null
    const pctFrom52WHigh = (high52 != null && high52 > 0)
      ? ((price / high52) - 1) * 100
      : null

    // forwardPE is reliable from quote(), NOT from financialData
    const forwardPE     = q.forwardPE ?? null
    const epsForward    = q.epsForward ?? null
    const epsTTM        = q.epsTrailingTwelveMonths ?? null
    const revenueGrowth = fd?.revenueGrowth ?? null
    const epsGrowth     = fd?.earningsGrowth ?? null
    const targetPrice   = fd?.targetMeanPrice ?? null
    const analystRating = fd?.recommendationMean ?? null

    // TTM revenue growth as a percentage (labelled honestly, not as "3Y CAGR")
    const revenueGrowthPct = revenueGrowth != null ? revenueGrowth * 100 : null

    const impliedCAGR = estimateImpliedCAGR(epsForward, epsTTM, revenueGrowth, epsGrowth)
    const fairValue   = estimateFairValue(price, targetPrice, forwardPE, epsForward, epsTTM, epsGrowth)
    const upsidePct   = (fairValue != null && price > 0) ? (fairValue / price) - 1 : null

    const expectation = impliedCAGR != null
      ? classifyExpectation(impliedCAGR, revenueGrowthPct)
      : null

    stocks.push({
      ticker,
      name: q.longName ?? q.shortName ?? meta?.name ?? ticker,
      sector: meta?.sector ?? null,
      price,
      fairValue,
      upsidePct,
      impliedCAGR,
      historicalCagr3y: revenueGrowthPct,
      expectation,
      marketCap: q.marketCap ?? null,
      pctFrom52WHigh,
      analystRating,
    })
  }

  // ─── Build signals ────────────────────────────────────────────────────────

  const sorted = (arr: IdeaStock[]) => arr.sort((a, b) => (b.upsidePct ?? -99) - (a.upsidePct ?? -99))

  // 1. Most undervalued — upsidePct > 20%, analyst not Strong Sell
  const undervalued = sorted(
    stocks.filter(s =>
      s.upsidePct != null && s.upsidePct > 0.20 &&
      (s.analystRating == null || s.analystRating <= 3.5)
    )
  ).slice(0, 9)

  // 2. Widest margin of safety — biggest gap fair value vs price
  const margin_of_safety = sorted(
    stocks.filter(s => s.upsidePct != null && s.upsidePct > 0.15)
  ).slice(0, 9)

  // 3. Priced for perfection — market expects very high implied CAGR
  const priced_for_perfection = stocks
    .filter(s => s.impliedCAGR != null && s.impliedCAGR >= 25)
    .sort((a, b) => (b.impliedCAGR ?? 0) - (a.impliedCAGR ?? 0))
    .slice(0, 9)

  // 4. Contrarian — implied CAGR well below historical (market underestimates)
  const contrarian = stocks
    .filter(s =>
      s.impliedCAGR != null && s.historicalCagr3y != null &&
      s.impliedCAGR < s.historicalCagr3y * 0.60 &&
      s.historicalCagr3y > 5
    )
    .sort((a, b) => {
      const diffA = (a.historicalCagr3y ?? 0) - (a.impliedCAGR ?? 0)
      const diffB = (b.historicalCagr3y ?? 0) - (b.impliedCAGR ?? 0)
      return diffB - diffA
    })
    .slice(0, 9)

  // 5. Near 52-week low with positive DCF
  const near_52w_low = sorted(
    stocks.filter(s =>
      s.pctFrom52WHigh != null && s.pctFrom52WHigh < -25 &&
      s.upsidePct != null && s.upsidePct > 0
    )
  ).slice(0, 9)

  // 6. High conviction — analyst rating ≤ 2 (Strong Buy / Buy) + positive upside
  const high_conviction = sorted(
    stocks.filter(s =>
      s.analystRating != null && s.analystRating <= 2.2 &&
      s.upsidePct != null && s.upsidePct > 0.10
    )
  ).slice(0, 9)

  const result: IdeasResponse = {
    signals: {
      undervalued,
      margin_of_safety,
      priced_for_perfection,
      contrarian,
      near_52w_low,
      high_conviction,
    },
    updatedAt: new Date().toISOString(),
    totalAnalyzed: stocks.length,
  }

  _cache = { data: result, ts: now }
  return result
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const data = await buildIdeas()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=21600, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[api/ideas]', err)
    return NextResponse.json({ error: 'Failed to load ideas' }, { status: 500 })
  }
}
