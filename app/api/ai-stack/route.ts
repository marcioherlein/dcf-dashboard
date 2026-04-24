import { NextResponse } from 'next/server'
import { AI_STACK_TICKERS } from '@/lib/ai-stack/tickers'
import { computeValueScore, ValuationMetrics } from '@/lib/ai-stack/scoring'
import { computeForwardValuation } from '@/lib/ai-stack/valuation'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

const BATCH_SIZE = 15

async function fetchSummary(ticker: string) {
  return yf.quoteSummary(ticker, {
    modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'price'],
  })
}

// Fetch TWD→USD, EUR→USD, CAD→USD, etc.
// Uses yf.quote() (the right method for live prices/FX, not quoteSummary which validates schemas)
// Yahoo FX ticker format: "TWDUSD=X" → regularMarketPrice ≈ 0.031 (how many USD per 1 TWD)
async function fetchFxRates(currencies: string[]): Promise<Map<string, number>> {
  const unique = Array.from(new Set(currencies.map(c => c.toUpperCase()).filter(c => c !== 'USD')))
  const map = new Map<string, number>([['USD', 1.0]])
  if (!unique.length) return map

  const settled = await Promise.allSettled(
    unique.map(cur =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (yf as any).quote(`${cur}USD=X`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((q: any) => {
          const rate = q?.regularMarketPrice ?? null
          // Sanity-check: TWD/USD should be < 1, EUR/USD < 3, etc.
          // If rate > 100 it's almost certainly inverted (USD/TWD ≈ 32) — invert it
          const corrected = rate && rate > 10 ? 1 / rate : rate
          return { cur, rate: corrected as number | null }
        })
        .catch(() => ({ cur, rate: null as number | null }))
    )
  )
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.rate && r.value.rate > 0) {
      map.set(r.value.cur, r.value.rate)
    }
  }
  return map
}

// Map Yahoo exchange codes → readable market names
function mapExchange(code: string | null | undefined): string | null {
  if (!code) return null
  const c = code.toUpperCase()
  if (c === 'NMS' || c === 'NGM' || c === 'NCM' || c.includes('NASDAQ')) return 'NASDAQ'
  if (c === 'NYQ' || c === 'ASE' || c.includes('NYSE')) return 'NYSE'
  return code
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMetrics(
  ticker: string,
  raw: any,
  fxRate: number,           // local→USD rate (1.0 for USD companies)
  financialCurrency: string,
): Omit<ValuationMetrics, 'valueScore' | 'scoreBreakdown'> {
  const { name, layer, layerLabel, sublayer } = AI_STACK_TICKERS.find(t => t.ticker === ticker)!
  const fd  = raw?.financialData       ?? {}
  const ks  = raw?.defaultKeyStatistics ?? {}
  const sd  = raw?.summaryDetail       ?? {}
  const pr  = raw?.price               ?? {}

  const price     = pr.regularMarketPrice ?? fd.currentPrice ?? null
  const marketCap = pr.marketCap          ?? sd.marketCap    ?? null
  const exchange  = mapExchange(pr.exchange ?? pr.exchangeName)
  const psRaw     = fd.priceToSalesTrailing12Months ?? ks.priceToSalesTrailing12Months ?? null

  // Convert local-currency amounts to USD.
  // fxRate is passed in from the pre-fetched Yahoo FX pair (e.g. TWDUSD=X ≈ 0.031).
  // Fallback: if fxRate is 0 (fetch failed), derive USD revenue from P/S ratio as a
  // secondary bridge — Yahoo computes P/S in USD-consistent terms for US-listed ADRs,
  // so marketCap(USD) / PS gives USD-equivalent revenue.
  let effectiveFxRate = fxRate
  if (effectiveFxRate === 0 && psRaw && psRaw > 0 && marketCap && marketCap > 0) {
    const usdRev = marketCap / psRaw
    const localRev = fd.totalRevenue ?? null
    // Derive implied FX rate from the P/S bridge
    if (localRev && localRev > 0) effectiveFxRate = usdRev / localRev
  }

  const toUSD = (v: number | null | undefined): number | null => {
    if (v == null) return null
    if (effectiveFxRate === 0) return null  // no conversion available → don't show wrong currency
    return v * effectiveFxRate
  }

  const totalRevenue       = toUSD(fd.totalRevenue)
  const fcf                = toUSD(fd.freeCashflow)
  const operatingCashflow  = toUSD(fd.operatingCashflow)
  const ebitda             = toUSD(fd.ebitda)
  const totalCash          = toUSD(fd.totalCash)
  const totalDebt          = toUSD(fd.totalDebt)

  // Shares: derive from marketCap / price — gives ADR-equivalent share count.
  // Yahoo's sharesOutstanding for TSMC returns ~25.9B underlying shares,
  // but the ADR price represents 5 underlying shares → we need ~5.18B ADR shares.
  // marketCap(USD) / ADR_price(USD) = ADR share count, always correct.
  const sharesADR: number | null =
    marketCap != null && price != null && price > 0
      ? marketCap / price
      : (ks.sharesOutstanding ?? ks.impliedSharesOutstanding ?? null) as number | null

  // Ratios — computed directly from now-USD values
  const pfcf     = marketCap != null && fcf != null ? marketCap / fcf : null
  const fcfYield = marketCap != null && fcf != null && marketCap > 0 ? fcf / marketCap : null

  const netDebt          = totalDebt != null && totalCash != null ? totalDebt - totalCash : null
  const netDebtToEbitda  = netDebt != null && ebitda != null && ebitda > 0 ? netDebt / ebitda : null
  const fcfMargin        = fcf != null && totalRevenue != null && totalRevenue > 0 ? fcf / totalRevenue : null

  return {
    ticker,
    name,
    layer,
    layerLabel,
    sublayer,
    error: false,

    price,
    marketCap,
    change1d:   pr.regularMarketChangePercent ?? null,
    change52w:  ks['52WeekChange']            ?? null,

    // These multiples are pre-computed by Yahoo with correct currency handling
    pe:        ks.trailingPE  ?? sd.trailingPE ?? null,
    forwardPe: ks.forwardPE   ?? null,
    peg:       ks.pegRatio    ?? null,
    pb:        ks.priceToBook ?? null,
    ps:        fd.priceToSalesTrailing12Months ?? null,
    pfcf,
    evEbitda:  ks.enterpriseToEbitda  ?? null,
    evRevenue: ks.enterpriseToRevenue ?? null,

    // All converted to USD
    freeCashflow:     fcf,
    operatingCashflow,
    totalRevenue,
    ebitda,

    // Pure ratios — currency-neutral
    grossMargin:     fd.grossMargins     ?? null,
    operatingMargin: fd.operatingMargins ?? null,
    profitMargin:    fd.profitMargins    ?? null,
    fcfMargin,
    roe: fd.returnOnEquity ?? null,
    roa: fd.returnOnAssets ?? null,

    // Balance sheet — all USD
    totalCash,
    totalDebt,
    netDebt,
    netDebtToEbitda,
    debtToEquity: fd.debtToEquity  ?? null,
    currentRatio: fd.currentRatio  ?? null,
    quickRatio:   fd.quickRatio    ?? null,

    revenueGrowth:  fd.revenueGrowth  ?? null,
    earningsGrowth: fd.earningsGrowth ?? null,

    dividendYield: sd.dividendYield ?? null,
    beta:          sd.beta ?? ks.beta ?? null,
    fcfYield,
    financialCurrency,
    exchange,

    // Forward valuation fields — populated by GET handler
    sharesOutstanding: sharesADR,
    fairValue:         null,
    priceTarget1Y:     null,
    upside:            null,
    valAssumptions:    null,
  }
}

export async function GET() {
  const tickers = AI_STACK_TICKERS.map(t => t.ticker)

  // ── 1. Batch-fetch all Yahoo summaries ───────────────────────────────────
  const rawMap = new Map<string, unknown>()

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(ticker =>
        fetchSummary(ticker)
          .then(data => ({ ticker, data }))
          .catch(() => ({ ticker, data: null }))
      )
    )
    for (const r of settled) {
      if (r.status === 'fulfilled') rawMap.set(r.value.ticker, r.value.data)
    }
  }

  // ── 2. Collect unique non-USD reporting currencies, then fetch FX rates ──
  const currencies: string[] = ['USD']
  for (const [, raw] of Array.from(rawMap)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = raw as any
    const cur = (r?.financialData?.financialCurrency ?? r?.price?.currency ?? 'USD') as string
    currencies.push(cur.toUpperCase())
  }
  const fxRates = await fetchFxRates(currencies)

  // ── 3. Build results ──────────────────────────────────────────────────────
  const results: ValuationMetrics[] = AI_STACK_TICKERS.map(({ ticker, name, layer, layerLabel, sublayer }) => {
    const raw = rawMap.get(ticker)

    if (!raw) {
      const { score, breakdown } = computeValueScore({})
      return {
        ticker, name, layer, layerLabel, sublayer,
        error: true,
        price: null, marketCap: null, change1d: null, change52w: null,
        pe: null, forwardPe: null, peg: null, pb: null, ps: null,
        pfcf: null, evEbitda: null, evRevenue: null,
        freeCashflow: null, operatingCashflow: null, totalRevenue: null, ebitda: null,
        grossMargin: null, operatingMargin: null, profitMargin: null, fcfMargin: null,
        roe: null, roa: null,
        totalCash: null, totalDebt: null, netDebt: null, netDebtToEbitda: null,
        debtToEquity: null, currentRatio: null, quickRatio: null,
        revenueGrowth: null, earningsGrowth: null,
        dividendYield: null, beta: null, fcfYield: null,
        financialCurrency: 'USD', exchange: null,
        sharesOutstanding: null, fairValue: null, priceTarget1Y: null, upside: null, valAssumptions: null,
        valueScore: score, scoreBreakdown: breakdown,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = raw as any
    const financialCurrency = (
      r?.financialData?.financialCurrency ?? r?.price?.currency ?? 'USD'
    ).toUpperCase() as string

    // Pass fxRate = 1.0 for USD companies, fetched rate for non-USD,
    // or 0 if the fetch failed (extractMetrics handles 0 → returns null for amounts)
    const fxRate = financialCurrency === 'USD'
      ? 1.0
      : (fxRates.get(financialCurrency) ?? 0)  // 0 = failed; extractMetrics will use P/S fallback

    const metrics = extractMetrics(ticker, raw, fxRate, financialCurrency)
    const { score, breakdown } = computeValueScore(metrics)
    const val = computeForwardValuation(metrics, metrics.sharesOutstanding)
    return {
      ...metrics,
      valueScore: score,
      scoreBreakdown: breakdown,
      fairValue:      val?.fairValue      ?? null,
      priceTarget1Y:  val?.priceTarget1Y  ?? null,
      upside:         val?.upside         ?? null,
      valAssumptions: val ?? null,
    }
  })

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  })
}
