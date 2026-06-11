import { NextRequest, NextResponse } from 'next/server'
import { SCREENER_UNIVERSE } from '@/lib/data/screenerUniverse'
import { rateLimit } from '@/lib/rateLimit'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// ─── Types ────────────────────────────────────────────────────────────────────

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
  // Valuation
  trailingPE: number | null
  forwardPE: number | null
  priceToBook: number | null
  priceToSales: number | null
  priceFCF: number | null
  evEbitda: number | null
  // Profitability
  grossMargin: number | null
  operatingMargin: number | null
  netMargin: number | null
  returnOnEquity: number | null
  returnOnAssets: number | null
  // Growth
  revenueGrowth: number | null
  epsGrowth: number | null
  // Financial health
  debtToEquity: number | null
  currentRatio: number | null
  // Technical
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  twoHundredDayAverage: number | null
  // Derived
  pctFrom52WHigh: number | null     // negative = below
  pctVsSma200: number | null        // positive = above
  // Analyst
  analystRating: number | null      // 1=Strong Buy … 5=Strong Sell
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let _cache: { data: ScreenerStock[]; ts: number } | null = null
const CACHE_TTL = 15 * 60 * 1000

// ─── Market cap tiers ─────────────────────────────────────────────────────────

const CAP_BOUNDS: Record<string, { min?: number; max?: number }> = {
  mega:  { min: 200e9 },
  large: { min: 10e9,  max: 200e9 },
  mid:   { min: 2e9,   max: 10e9  },
  small: { min: 300e6, max: 2e9   },
}

// ─── Quote fields ─────────────────────────────────────────────────────────────

const QUOTE_FIELDS = [
  'regularMarketPrice', 'marketCap', 'trailingPE', 'forwardPE',
  'dividendYield', 'beta', 'exchange', 'longName', 'shortName',
  'priceToBook', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
  'twoHundredDayAverage',
] as const

// ─── Fetch all quotes + enriched fundamentals ─────────────────────────────────

async function fetchAllQuotes(): Promise<ScreenerStock[]> {
  const now = Date.now()
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data

  const tickers = SCREENER_UNIVERSE.map(t => t.ticker)
  const metaMap = new Map(SCREENER_UNIVERSE.map(t => [t.ticker, t]))

  // ── Phase 1: batch quote() for price + basic metrics ──────────────────────
  const BATCH = 100
  const batches: string[][] = []
  for (let i = 0; i < tickers.length; i += BATCH) batches.push(tickers.slice(i, i + BATCH))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteMap = new Map<string, any>()
  for (const batch of batches) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quotes: any[] = await yf.quote(batch, { fields: QUOTE_FIELDS }, { validateResult: false })
      for (const q of (Array.isArray(quotes) ? quotes : [])) {
        quoteMap.set(q.symbol, q)
      }
    } catch (err) {
      console.error('[screener] batch quote error:', err)
    }
  }

  // ── Phase 2: quoteSummary for enriched fundamentals ───────────────────────
  // Fetch in batches of 10 — quoteSummary is heavier
  const SUMMARY_BATCH = 10
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryMap = new Map<string, any>()
  for (let i = 0; i < tickers.length; i += SUMMARY_BATCH) {
    const batch = tickers.slice(i, i + SUMMARY_BATCH)
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          const summary = await yf.quoteSummary(ticker, {
            modules: ['financialData', 'defaultKeyStatistics'],
          }, { validateResult: false })
          summaryMap.set(ticker, summary)
        } catch {
          // silently skip — null fields will pass through filters
        }
      })
    )
  }

  // ── Phase 3: assemble ScreenerStock records ───────────────────────────────
  const results: ScreenerStock[] = []

  for (const ticker of tickers) {
    const meta = metaMap.get(ticker)
    if (!meta) continue

    const q = quoteMap.get(ticker)
    const s = summaryMap.get(ticker)
    const fd = s?.financialData ?? null
    const ks = s?.defaultKeyStatistics ?? null

    const price    = q?.regularMarketPrice ?? null
    const mktCap   = q?.marketCap ?? null
    const high52   = q?.fiftyTwoWeekHigh ?? null
    const sma200   = q?.twoHundredDayAverage ?? null

    // Dividend: Yahoo returns as decimal fraction (0.03 = 3%), already correct
    const divYield = (q?.dividendYield != null && q.dividendYield > 0)
      ? q.dividendYield
      : null

    // Price/FCF derived: marketCap / freeCashflow
    const fcf = fd?.freeCashflow ?? null
    const priceFCF = (mktCap != null && fcf != null && fcf !== 0)
      ? mktCap / fcf
      : null

    // Derived: % from 52W high (0 or negative)
    const pctFrom52WHigh = (price != null && high52 != null && high52 > 0)
      ? ((price / high52) - 1) * 100
      : null

    // Derived: % vs 200-day SMA (positive = above)
    const pctVsSma200 = (price != null && sma200 != null && sma200 > 0)
      ? ((price / sma200) - 1) * 100
      : null

    // Debt/Equity: Yahoo returns as e.g. 150 meaning 1.5 — normalize to ratio
    const deRaw = fd?.debtToEquity ?? null
    const debtToEquity = deRaw != null ? deRaw / 100 : null

    results.push({
      ticker,
      name:          q?.longName ?? q?.shortName ?? meta.name,
      sector:        meta.sector,
      industry:      meta.industry,
      price,
      marketCap:     mktCap,
      beta:          q?.beta ?? null,
      dividendYield: divYield,
      exchange:      meta.exchange,
      // Valuation
      trailingPE:    q?.trailingPE ?? null,
      forwardPE:     q?.forwardPE ?? null,
      priceToBook:   q?.priceToBook ?? null,
      priceToSales:  ks?.priceToSalesTrailing12Months ?? null,
      priceFCF,
      evEbitda:      ks?.enterpriseToEbitda ?? null,
      // Profitability
      grossMargin:   fd?.grossMargins ?? null,
      operatingMargin: fd?.operatingMargins ?? null,
      netMargin:     fd?.profitMargins ?? null,
      returnOnEquity: fd?.returnOnEquity ?? null,
      returnOnAssets: fd?.returnOnAssets ?? null,
      // Growth
      revenueGrowth: fd?.revenueGrowth ?? null,
      epsGrowth:     fd?.earningsGrowth ?? null,
      // Financial health
      debtToEquity,
      currentRatio:  fd?.currentRatio ?? null,
      // Technical
      fiftyTwoWeekHigh: high52,
      fiftyTwoWeekLow:  q?.fiftyTwoWeekLow ?? null,
      twoHundredDayAverage: sma200,
      pctFrom52WHigh,
      pctVsSma200,
      // Analyst
      analystRating: fd?.recommendationMean ?? null,
    })
  }

  results.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
  _cache = { data: results, ts: now }
  return results
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function applyRangeBucket(value: number | null, bucket: string): boolean {
  if (!bucket || bucket === 'any') return true
  if (value == null) return true  // nulls always pass through
  if (bucket === 'negative') return value < 0
  const underM = bucket.match(/^under_(.+)$/)
  if (underM) { const n = parseFloat(underM[1]); return value > 0 && value < n }
  const overM = bucket.match(/^over_(.+)$/)
  if (overM)  { const n = parseFloat(overM[1]); return value > n }
  return true
}

function applyPctRangeBucket(value: number | null, bucket: string): boolean {
  // value is decimal (0.15 = 15%), bucket is "over_10" meaning >10%
  if (!bucket || bucket === 'any') return true
  if (value == null) return true
  if (bucket === 'negative') return value < 0
  const overM = bucket.match(/^over_(.+)$/)
  if (overM) { const n = parseFloat(overM[1]) / 100; return value > n }
  const underM = bucket.match(/^under_(.+)$/)
  if (underM) { const n = parseFloat(underM[1]) / 100; return value < n }
  return true
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 2, 300000, 'screener')
  if (limited) return limited

  const p = req.nextUrl.searchParams

  // Existing filters
  const sector    = p.get('sector')    || undefined
  const capTier   = p.get('capTier')   || undefined
  const dividends = p.get('dividends') === '1'
  const exchange  = p.get('exchange')  || undefined
  const industry  = p.get('industry')  || undefined

  // New range/select filters — bucket strings like 'under_20', 'over_15', 'any'
  const trailingPEBucket   = p.get('trailingPE')   || 'any'
  const forwardPEBucket    = p.get('forwardPE')    || 'any'
  const ptbBucket          = p.get('priceToBook')  || 'any'
  const ptsBucket          = p.get('priceToSales') || 'any'
  const pfcfBucket         = p.get('priceFCF')     || 'any'
  const evEbitdaBucket     = p.get('evEbitda')     || 'any'
  const roeBucket          = p.get('roe')          || 'any'
  const roaBucket          = p.get('roa')          || 'any'
  const grossMarginBucket  = p.get('grossMargin')  || 'any'
  const opMarginBucket     = p.get('opMargin')     || 'any'
  const netMarginBucket    = p.get('netMargin')    || 'any'
  const debtEqBucket       = p.get('debtToEquity') || 'any'
  const crBucket           = p.get('currentRatio') || 'any'
  const revGrowthBucket    = p.get('revGrowth')    || 'any'
  const epsGrowthBucket    = p.get('epsGrowth')    || 'any'
  const analystBucket      = p.get('analyst')      || 'any'
  const hi52Bucket         = p.get('fiftyTwoWk')   || 'any'
  const sma200Bucket       = p.get('sma200')       || 'any'
  const betaBucket         = p.get('beta')         || 'any'
  const divYieldBucket     = p.get('divYield')     || 'any'

  try {
    const all = await fetchAllQuotes()

    let filtered = all

    // ── Descriptive ──────────────────────────────────────────────────────────
    if (sector) filtered = filtered.filter(s => s.sector === sector)
    if (industry) filtered = filtered.filter(s => s.industry === industry)
    if (exchange && exchange !== 'all') filtered = filtered.filter(s => s.exchange === exchange)

    if (capTier && CAP_BOUNDS[capTier]) {
      const { min, max } = CAP_BOUNDS[capTier]
      filtered = filtered.filter(s => {
        if (s.marketCap == null) return false
        if (min != null && s.marketCap < min) return false
        if (max != null && s.marketCap >= max) return false
        return true
      })
    }

    // ── Dividends ────────────────────────────────────────────────────────────
    if (dividends) filtered = filtered.filter(s => s.dividendYield != null && s.dividendYield > 0)

    if (divYieldBucket !== 'any') {
      if (divYieldBucket === 'none') {
        filtered = filtered.filter(s => !s.dividendYield)
      } else {
        filtered = filtered.filter(s => applyPctRangeBucket(s.dividendYield, divYieldBucket))
      }
    }

    // ── Valuation ────────────────────────────────────────────────────────────
    if (trailingPEBucket !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.trailingPE, trailingPEBucket))
    if (forwardPEBucket  !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.forwardPE, forwardPEBucket))
    if (ptbBucket        !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.priceToBook, ptbBucket))
    if (ptsBucket        !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.priceToSales, ptsBucket))
    if (pfcfBucket       !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.priceFCF, pfcfBucket))
    if (evEbitdaBucket   !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.evEbitda, evEbitdaBucket))

    // ── Profitability (decimal values × 100 for pct comparison) ──────────────
    if (roeBucket        !== 'any')  filtered = filtered.filter(s => applyPctRangeBucket(s.returnOnEquity, roeBucket))
    if (roaBucket        !== 'any')  filtered = filtered.filter(s => applyPctRangeBucket(s.returnOnAssets, roaBucket))
    if (grossMarginBucket !== 'any') filtered = filtered.filter(s => applyPctRangeBucket(s.grossMargin, grossMarginBucket))
    if (opMarginBucket   !== 'any')  filtered = filtered.filter(s => applyPctRangeBucket(s.operatingMargin, opMarginBucket))
    if (netMarginBucket  !== 'any')  filtered = filtered.filter(s => applyPctRangeBucket(s.netMargin, netMarginBucket))

    // ── Financial health ─────────────────────────────────────────────────────
    if (debtEqBucket !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.debtToEquity, debtEqBucket))
    if (crBucket     !== 'any')  filtered = filtered.filter(s => applyRangeBucket(s.currentRatio, crBucket))

    // ── Growth (decimal) ──────────────────────────────────────────────────────
    if (revGrowthBucket !== 'any') filtered = filtered.filter(s => applyPctRangeBucket(s.revenueGrowth, revGrowthBucket))
    if (epsGrowthBucket !== 'any') filtered = filtered.filter(s => applyPctRangeBucket(s.epsGrowth, epsGrowthBucket))

    // ── Technical ────────────────────────────────────────────────────────────
    if (betaBucket !== 'any') filtered = filtered.filter(s => applyRangeBucket(s.beta, betaBucket))

    if (hi52Bucket !== 'any') {
      if (hi52Bucket === 'new_high') {
        filtered = filtered.filter(s => s.pctFrom52WHigh != null && s.pctFrom52WHigh >= -2)
      } else if (hi52Bucket === 'below_10') {
        filtered = filtered.filter(s => s.pctFrom52WHigh != null && s.pctFrom52WHigh >= -10)
      } else if (hi52Bucket === 'below_20') {
        filtered = filtered.filter(s => s.pctFrom52WHigh != null && s.pctFrom52WHigh >= -20)
      } else if (hi52Bucket === 'below_50') {
        filtered = filtered.filter(s => s.pctFrom52WHigh != null && s.pctFrom52WHigh < -20)
      }
    }

    if (sma200Bucket !== 'any') {
      if (sma200Bucket === 'above') {
        filtered = filtered.filter(s => s.pctVsSma200 != null && s.pctVsSma200 > 0)
      } else if (sma200Bucket === 'below') {
        filtered = filtered.filter(s => s.pctVsSma200 != null && s.pctVsSma200 < 0)
      } else if (sma200Bucket === 'above_10') {
        filtered = filtered.filter(s => s.pctVsSma200 != null && s.pctVsSma200 > 10)
      } else if (sma200Bucket === 'above_20') {
        filtered = filtered.filter(s => s.pctVsSma200 != null && s.pctVsSma200 > 20)
      } else if (sma200Bucket === 'below_10') {
        filtered = filtered.filter(s => s.pctVsSma200 != null && s.pctVsSma200 < -10)
      } else if (sma200Bucket === 'below_20') {
        filtered = filtered.filter(s => s.pctVsSma200 != null && s.pctVsSma200 < -20)
      }
    }

    // ── Analyst ───────────────────────────────────────────────────────────────
    if (analystBucket !== 'any') {
      if (analystBucket === 'strong_buy')  filtered = filtered.filter(s => s.analystRating != null && s.analystRating <= 1.5)
      if (analystBucket === 'buy')         filtered = filtered.filter(s => s.analystRating != null && s.analystRating > 1.5 && s.analystRating <= 2.5)
      if (analystBucket === 'hold')        filtered = filtered.filter(s => s.analystRating != null && s.analystRating > 2.5 && s.analystRating <= 3.5)
      if (analystBucket === 'sell')        filtered = filtered.filter(s => s.analystRating != null && s.analystRating > 3.5)
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
