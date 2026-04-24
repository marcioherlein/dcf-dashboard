import { NextResponse } from 'next/server'
import { AI_STACK_TICKERS } from '@/lib/ai-stack/tickers'
import { computeValueScore, ValuationMetrics } from '@/lib/ai-stack/scoring'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

const BATCH_SIZE = 15

async function fetchSummary(ticker: string) {
  return yf.quoteSummary(ticker, {
    modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'price'],
  })
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

  // Allow negative P/FCF — negative FCF IS the signal (company is burning cash)
  const pfcf      = (marketCap != null && fcf != null) ? marketCap / fcf : null
  // Allow negative FCF yield — shows how much cash is being burned vs market cap
  const fcfYield  = (marketCap != null && fcf != null && marketCap > 0) ? fcf / marketCap : null

  const totalRevenue = fd.totalRevenue ?? null
  const ebitda       = fd.ebitda       ?? null
  const totalCash    = fd.totalCash    ?? null
  const totalDebt    = fd.totalDebt    ?? null

  // Net Debt = Debt - Cash. Negative = net cash position (great sign)
  const netDebt = (totalDebt != null && totalCash != null) ? totalDebt - totalCash : null

  // Net Debt / EBITDA: leverage quality signal. < 0 = net cash. > 4x = dangerously leveraged.
  const netDebtToEbitda = (netDebt != null && ebitda != null && ebitda > 0) ? netDebt / ebitda : null

  // FCF Margin = FCF / Revenue. Shows how much cash the business generates per dollar of sales.
  const fcfMargin = (fcf != null && totalRevenue != null && totalRevenue > 0) ? fcf / totalRevenue : null

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
    ps:          fd.priceToSalesTrailing12Months ?? null,
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
        valueScore: score, scoreBreakdown: breakdown,
      }
    }

    const metrics = extractMetrics(ticker, raw)
    const { score, breakdown } = computeValueScore(metrics)
    return { ...metrics, valueScore: score, scoreBreakdown: breakdown }
  })

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  })
}
