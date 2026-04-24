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

// Map Yahoo exchange codes to human-readable market names
function mapExchange(code: string | null | undefined): string | null {
  if (!code) return null
  const c = code.toUpperCase()
  if (c === 'NMS' || c === 'NGM' || c === 'NCM' || c.includes('NASDAQ')) return 'NASDAQ'
  if (c === 'NYQ' || c === 'ASE' || c.includes('NYSE')) return 'NYSE'
  return code
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMetrics(ticker: string, raw: any): Omit<ValuationMetrics, 'valueScore' | 'scoreBreakdown'> {
  const { name, layer, layerLabel, sublayer } = AI_STACK_TICKERS.find(t => t.ticker === ticker)!
  const fd  = raw?.financialData       ?? {}
  const ks  = raw?.defaultKeyStatistics ?? {}
  const sd  = raw?.summaryDetail       ?? {}
  const pr  = raw?.price               ?? {}

  const price     = pr.regularMarketPrice ?? fd.currentPrice ?? null
  const marketCap = pr.marketCap          ?? sd.marketCap    ?? null
  const fcf       = fd.freeCashflow       ?? null
  const sharesRaw = (ks.sharesOutstanding ?? ks.impliedSharesOutstanding ?? null) as number | null
  const financialCurrency = (fd.financialCurrency ?? pr.currency ?? 'USD') as string
  const exchange   = mapExchange(pr.exchange ?? pr.exchangeName)
  const isADR      = financialCurrency.toUpperCase() !== 'USD'

  const totalRevenue = fd.totalRevenue ?? null
  const ebitda       = fd.ebitda       ?? null
  const totalCash    = fd.totalCash    ?? null
  const totalDebt    = fd.totalDebt    ?? null
  const ps           = fd.priceToSalesTrailing12Months ?? null

  // Net Debt = Debt − Cash (same currency → ratio is valid even for ADRs)
  const netDebt = (totalDebt != null && totalCash != null) ? totalDebt - totalCash : null

  // Net Debt / EBITDA: both same currency → ratio is always valid
  const netDebtToEbitda = (netDebt != null && ebitda != null && ebitda > 0) ? netDebt / ebitda : null

  // FCF Margin = FCF / Revenue — both in reporting currency → currency-neutral, always valid
  const fcfMargin = (fcf != null && totalRevenue != null && totalRevenue > 0) ? fcf / totalRevenue : null

  // ── P/FCF and FCF Yield ───────────────────────────────────────────────────
  // For ADRs: Yahoo's FCF & revenue are in reporting currency (TWD, EUR, CAD…) but
  // marketCap is in USD (the ADR quote currency). Direct division is invalid.
  //
  // Fix: use Yahoo's P/S ratio (already USD-adjusted by Yahoo) to derive USD revenue,
  // then use the currency-neutral fcfMargin to get USD-equivalent FCF.
  //   usdRevenue = marketCap(USD) / PS          ← Yahoo's PS is always USD-consistent
  //   usdFcf     = fcfMargin × usdRevenue       ← fcfMargin is currency-neutral
  //   pfcf       = marketCap / usdFcf
  //   fcfYield   = usdFcf / marketCap
  let pfcf: number | null = null
  let fcfYield: number | null = null

  if (isADR && fcfMargin !== null && ps !== null && ps > 0 && marketCap !== null && marketCap > 0) {
    const usdRevenue = marketCap / ps
    const usdFcf = fcfMargin * usdRevenue
    pfcf     = usdFcf !== 0 ? marketCap / usdFcf : null
    fcfYield = usdFcf / marketCap
  } else if (!isADR && marketCap != null && fcf != null) {
    // USD company: direct calculation is valid
    pfcf     = marketCap / fcf
    fcfYield = marketCap > 0 ? fcf / marketCap : null
  }

  return {
    ticker,
    name,
    layer,
    layerLabel,
    sublayer,
    error: false,

    price,
    marketCap,
    change1d:    pr.regularMarketChangePercent ?? null,
    change52w:   ks['52WeekChange']            ?? null,

    pe:          ks.trailingPE   ?? sd.trailingPE   ?? null,
    forwardPe:   ks.forwardPE    ?? null,
    peg:         ks.pegRatio     ?? null,
    pb:          ks.priceToBook  ?? null,
    ps,
    pfcf,
    evEbitda:    ks.enterpriseToEbitda  ?? null,
    evRevenue:   ks.enterpriseToRevenue ?? null,

    freeCashflow:      fcf,
    operatingCashflow: fd.operatingCashflow ?? null,
    totalRevenue,
    ebitda,

    grossMargin:     fd.grossMargins     ?? null,
    operatingMargin: fd.operatingMargins ?? null,
    profitMargin:    fd.profitMargins    ?? null,
    fcfMargin,
    roe:  fd.returnOnEquity ?? null,
    roa:  fd.returnOnAssets ?? null,

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
    beta:          sd.beta          ?? ks.beta ?? null,
    fcfYield,
    financialCurrency,
    exchange,
    // Forward valuation fields — populated by GET handler after extractMetrics
    sharesOutstanding: sharesRaw,
    fairValue:         null,
    priceTarget1Y:     null,
    upside:            null,
    valAssumptions:    null,
  }
}

export async function GET() {
  const tickers = AI_STACK_TICKERS.map(t => t.ticker)

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
      if (r.status === 'fulfilled') {
        rawMap.set(r.value.ticker, r.value.data)
      }
    }
  }

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

    const metrics = extractMetrics(ticker, raw)
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
