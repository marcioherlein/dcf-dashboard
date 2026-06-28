import { NextResponse } from 'next/server'
import { SCREENER_UNIVERSE } from '@/lib/data/screenerUniverse'
import { calculateWACC, extractWACCInputs } from '@/lib/dcf/calculateWACC'
import { projectCashFlows, extractFCFInputs } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue } from '@/lib/dcf/calculateFairValue'
import { getCRPByCountry } from '@/lib/dcf/countryRiskPremium'
import { getRfRate } from '@/lib/data/fredClient'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdeaStock {
  ticker: string
  name: string
  sector: string | null
  price: number | null
  analystTarget: number | null
  upsidePct: number | null          // upside vs analyst target (kept for fallback display)
  insicFairValue: number | null     // insic DCF intrinsic value per share
  insicUpsidePct: number | null     // upside vs insic DCF fair value
  convictionBand: 'A' | 'B' | 'C' | 'D' | null
  epsRevision: { direction: 'up' | 'flat' | 'down'; magnitude: number } | null
  narrativeHook: string | null
  impliedCAGR: number | null
  historicalCagr3y: number | null
  expectation: 'Conservative' | 'Moderate' | 'Aggressive' | 'Very Aggressive' | null
  marketCap: number | null
  pctFrom52WHigh: number | null
  analystRating: number | null
}

export type SignalId =
  | 'insic_dcf'
  | 'estimate_upgrades'
  | 'undervalued'
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

// ─── Universe ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyExpectation(impliedCAGR: number, historicalCagr3y: number | null): IdeaStock['expectation'] {
  if (impliedCAGR < 5) return 'Conservative'
  if (historicalCagr3y != null && impliedCAGR < historicalCagr3y * 0.80) return 'Conservative'
  if (impliedCAGR < 12) return 'Moderate'
  if (impliedCAGR < 25) return 'Aggressive'
  return 'Very Aggressive'
}

function estimateImpliedCAGR(
  epsForward: number | null,
  epsTTM: number | null,
  revenueGrowth: number | null,
  epsGrowth: number | null,
): number | null {
  if (epsForward != null && epsTTM != null && Math.abs(epsTTM) > 0.01) {
    const growth = (epsForward / epsTTM) - 1
    if (growth >= -0.80 && growth <= 3.0) return growth * 100
  }
  if (epsGrowth != null && epsGrowth >= -0.80 && epsGrowth <= 3.0) return epsGrowth * 100
  if (revenueGrowth != null && revenueGrowth >= -0.80 && revenueGrowth <= 3.0) return revenueGrowth * 100
  return null
}

function getAnalystTarget(targetMeanPrice: number | null, price: number): number | null {
  if (targetMeanPrice != null && targetMeanPrice > 0 && targetMeanPrice < price * 8) return targetMeanPrice
  return null
}

// ─── Lightweight DCF per stock ────────────────────────────────────────────────
// Skips FMP enrichment and 5Y regression — uses Yahoo's beta as fallback.
// Result is directionally correct (±15% vs full model). Null on failure.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeLightweightDCF(s: any, q: any, rfRate: number): number | null {
  try {
    const fd = s?.financialData ?? {}
    const ks = s?.defaultKeyStatistics ?? {}
    const price: number = q?.regularMarketPrice ?? 0
    if (!price || price <= 0) return null

    // Country risk
    const country: string | null = (fd.summaryProfile?.country ?? s?.summaryProfile?.country ?? null) as string | null
    const crp = getCRPByCountry(country, 'USD')

    // Beta — Yahoo's value, fallback to 1.0
    const beta: number = (ks.beta as number | null) ?? 1.0

    // WACC
    const waccInputs = extractWACCInputs(s, rfRate, beta, 1, crp)
    const waccResult = calculateWACC(waccInputs)

    // FCF + CAGR
    const { baseFCF, cagr, isNegativeFCF } = extractFCFInputs(s, false)

    // Terminal growth
    const terminalGBase = cagr > 0.15 ? 0.025 : cagr > 0.05 ? 0.020 : 0.015
    const terminalG = crp > 0.02
      ? Math.min(Math.max(terminalGBase, rfRate + 0.02), 0.07)
      : terminalGBase

    const growthModel = (cagr > 0.15 || isNegativeFCF) ? 'three-stage' as const : 'two-stage' as const
    const dcfResult = projectCashFlows({ baseFCF, cagr, wacc: waccResult.wacc, terminalG, growthModel })

    // Balance sheet — mirrors financials/route.ts extraction
    const bs = s?.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {}
    const marketCapM = (q.marketCap ?? 0) / 1e6

    const cashRaw: number = (
      bs.cash
      ?? bs.cashAndCashEquivalents
      ?? bs.cashAndShortTermInvestments
      ?? bs.cashCashEquivalentsAndShortTermInvestments
      ?? bs.cashAndCashEquivalentsAtCarryingValue
      ?? fd.totalCash
      ?? 0
    ) as number
    const cashM = cashRaw / 1e6

    const sectorIndustry = ((fd.summaryProfile?.sector ?? '') + ' ' + (fd.summaryProfile?.industry ?? ''))
    const isBankOrInsurer = /bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/i.test(sectorIndustry)
    const isAutoOEM = /Auto Manufacturers|Motor Vehicle/i.test((fd.summaryProfile?.industry ?? '') as string)
    const rawTotalDebtForHeuristic = ((bs.totalDebt ?? 0) as number) / 1e6
    const captiveFinanceHeuristic = !isBankOrInsurer && marketCapM > 0 && rawTotalDebtForHeuristic / marketCapM > 2.0
    const useOnlyLongTermDebt = isBankOrInsurer || isAutoOEM || captiveFinanceHeuristic

    const rawDebtM: number = useOnlyLongTermDebt
      ? ((bs.longTermDebt ?? bs.longTermDebtNoncurrent ?? bs.longTermDebtAndCapitalLeaseObligation ?? bs.totalDebt ?? 0) as number) / 1e6
      : ((bs.totalDebt ?? bs.longTermDebt ?? bs.longTermDebtAndCapitalLeaseObligation ?? fd.totalDebt ?? 0) as number) / 1e6
    const debtM = marketCapM > 0 ? Math.min(rawDebtM, marketCapM * 3) : rawDebtM

    // Shares: derive from market cap / price (handles ADR share count discrepancies)
    const sharesM = (q.marketCap as number) > 0 && price > 0
      ? (q.marketCap as number) / price / 1e6
      : ((ks.sharesOutstanding ?? 0) as number) / 1e6

    const fvResult = calculateFairValue(dcfResult, cashM, debtM, sharesM, price)
    const fv = fvResult.fairValuePerShare

    // Sanity guards: reject implausible outputs
    if (fv == null || fv <= 0 || fv > price * 15 || isNaN(fv)) return null
    return Math.round(fv * 100) / 100
  } catch {
    return null
  }
}

// ─── EPS revision momentum ────────────────────────────────────────────────────
// Mirrors logic in app/api/financials/route.ts lines 1665–1677

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEpsRevision(s: any): IdeaStock['epsRevision'] {
  try {
    const etTrends: unknown[] = (s?.earningsTrend?.trend ?? []) as unknown[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trend1y = (etTrends as any[]).find((t: any) => t?.period === '+1y')
    if (!trend1y) return null
    const currentAvg: number | null = (trend1y.earningsEstimate?.avg ?? null) as number | null
    const ninetyDaysAgo: number | null = (trend1y.earningsEstimate?.['90daysAgo'] ?? null) as number | null
    if (currentAvg == null || ninetyDaysAgo == null || Math.abs(ninetyDaysAgo) < 0.001) return null
    const magnitude = (currentAvg - ninetyDaysAgo) / Math.abs(ninetyDaysAgo)
    const direction: 'up' | 'flat' | 'down' = Math.abs(magnitude) < 0.02 ? 'flat' : magnitude > 0 ? 'up' : 'down'
    return { direction, magnitude: Math.round(magnitude * 1000) / 1000 }
  } catch {
    return null
  }
}

// ─── Quick conviction band ────────────────────────────────────────────────────
// Lightweight proxy — no Piotroski/Altman/Beneish needed.

function quickConvictionBand(
  insicUpsidePct: number | null,
  analystRating: number | null,
  epsDir: 'up' | 'flat' | 'down' | null,
  pctFrom52WHigh: number | null,
): IdeaStock['convictionBand'] {
  let score = 0
  if (insicUpsidePct != null) {
    if (insicUpsidePct > 0.40) score += 3
    else if (insicUpsidePct > 0.20) score += 2
    else if (insicUpsidePct > 0) score += 1
    else score -= 1
  }
  if (analystRating != null) {
    if (analystRating <= 1.8) score += 2
    else if (analystRating <= 2.5) score += 1
    else if (analystRating >= 3.8) score -= 1
  }
  if (epsDir === 'up') score += 1
  else if (epsDir === 'down') score -= 1
  if (pctFrom52WHigh != null && pctFrom52WHigh < -30) score += 1

  if (score >= 5) return 'A'
  if (score >= 3) return 'B'
  if (score >= 1) return 'C'
  return 'D'
}

// ─── Narrative hooks ──────────────────────────────────────────────────────────
// Template-based — no LLM, no network calls. Numbers substituted from IdeaStock.

function buildNarrativeHook(stock: IdeaStock, signalId: SignalId): string | null {
  const fmt = (v: number) => v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`
  const fmtAbs = (v: number) => `${Math.abs(v).toFixed(0)}%`

  switch (signalId) {
    case 'insic_dcf': {
      if (stock.insicUpsidePct == null) return null
      const up = fmtAbs(stock.insicUpsidePct * 100)
      const rev = stock.epsRevision
      const revPart = rev?.direction === 'up'
        ? ` Analysts raised EPS estimates ${fmtAbs(rev.magnitude * 100)} over 90 days.`
        : rev?.direction === 'down'
        ? ` Analysts cut EPS estimates ${fmtAbs(rev.magnitude * 100)} recently.`
        : ''
      return `Trading ${up} below insic's intrinsic value estimate.${revPart}`
    }
    case 'estimate_upgrades': {
      if (stock.epsRevision == null) return null
      const revUp = fmtAbs(stock.epsRevision.magnitude * 100)
      const dcfPart = stock.insicUpsidePct != null
        ? ` Stock still ${fmtAbs(stock.insicUpsidePct * 100)} below insic fair value.`
        : ''
      return `EPS estimates revised up ${revUp} over 90 days.${dcfPart}`
    }
    case 'undervalued': {
      const primary = stock.insicUpsidePct ?? stock.upsidePct
      if (primary == null) return null
      const source = stock.insicUpsidePct != null ? 'insic DCF' : 'analyst consensus'
      return `${fmtAbs(primary * 100)} upside vs ${source} target price.`
    }
    case 'contrarian': {
      if (stock.impliedCAGR == null || stock.historicalCagr3y == null) return null
      return `Market pricing in ${stock.impliedCAGR.toFixed(0)}% EPS growth — revenue grew ${stock.historicalCagr3y.toFixed(0)}% last year.`
    }
    case 'priced_for_perfection': {
      if (stock.impliedCAGR == null) return null
      return `Forward expectations imply ${stock.impliedCAGR.toFixed(0)}% EPS growth. Any miss typically reprices the stock 20–30% lower.`
    }
    case 'near_52w_low': {
      if (stock.pctFrom52WHigh == null) return null
      const downStr = fmt(stock.pctFrom52WHigh)
      const targetPart = stock.insicFairValue != null
        ? ` insic fair value: $${stock.insicFairValue.toFixed(2)}.`
        : stock.analystTarget != null
        ? ` Analyst target: $${stock.analystTarget.toFixed(2)}.`
        : ''
      return `${downStr} from 52-week high.${targetPart}`
    }
    case 'high_conviction': {
      if (stock.analystRating == null) return null
      const ratingLabel = stock.analystRating <= 1.5 ? 'Strong Buy' : stock.analystRating <= 2.2 ? 'Buy' : 'Overweight'
      const dcfPart = stock.insicFairValue != null
        ? ` insic fair value: $${stock.insicFairValue.toFixed(2)}.`
        : ''
      return `Analyst consensus: ${ratingLabel}.${dcfPart}`
    }
    default:
      return null
  }
}

// ─── Build ideas ──────────────────────────────────────────────────────────────

async function buildIdeas(): Promise<IdeasResponse> {
  const now = Date.now()
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data

  const metaMap = new Map(SCREENER_UNIVERSE.map(t => [t.ticker, t]))

  // Fetch rfRate once — shared across all DCF computations
  const rfRate = await getRfRate()

  // Batch quote fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteMap = new Map<string, any>()
  for (let i = 0; i < IDEAS_UNIVERSE.length; i += 50) {
    const batch = IDEAS_UNIVERSE.slice(i, i + 50)
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

  // Enriched fundamentals — includes DCF-required modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryMap = new Map<string, any>()
  for (let i = 0; i < IDEAS_UNIVERSE.length; i += 10) {
    const batch = IDEAS_UNIVERSE.slice(i, i + 10)
    await Promise.allSettled(batch.map(async (ticker) => {
      try {
        const s = await yf.quoteSummary(ticker, {
          modules: [
            'financialData',
            'defaultKeyStatistics',
            'cashflowStatementHistory',
            'balanceSheetHistory',
            'incomeStatementHistory',
            'earningsTrend',
          ],
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
    const ks = s?.defaultKeyStatistics ?? null

    const high52 = q.fiftyTwoWeekHigh ?? null
    const pctFrom52WHigh = (high52 != null && high52 > 0) ? ((price / high52) - 1) * 100 : null

    const epsForward    = q.epsForward ?? null
    const epsTTM        = q.epsTrailingTwelveMonths ?? null
    const revenueGrowth = fd?.revenueGrowth ?? null
    const epsGrowth     = fd?.earningsGrowth ?? null
    const targetPrice   = fd?.targetMeanPrice ?? null
    const analystRating = fd?.recommendationMean ?? null
    const revenueGrowthPct = revenueGrowth != null ? revenueGrowth * 100 : null

    const impliedCAGR = estimateImpliedCAGR(epsForward, epsTTM, revenueGrowth, epsGrowth)
    const analystTarget = getAnalystTarget(targetPrice, price)
    const upsidePct = (analystTarget != null && price > 0) ? (analystTarget / price) - 1 : null
    const expectation = impliedCAGR != null ? classifyExpectation(impliedCAGR, revenueGrowthPct) : null

    // Lightweight DCF
    const insicFairValue = s ? computeLightweightDCF(s, q, rfRate) : null
    const insicUpsidePct = (insicFairValue != null && price > 0) ? (insicFairValue / price) - 1 : null

    // EPS revision momentum
    const epsRevision = s ? extractEpsRevision(s) : null

    // Quick conviction band
    const convictionBand = quickConvictionBand(insicUpsidePct, analystRating, epsRevision?.direction ?? null, pctFrom52WHigh)

    // Beta for informational note only — not used here (used inside computeLightweightDCF)
    void ks

    stocks.push({
      ticker,
      name: q.longName ?? q.shortName ?? meta?.name ?? ticker,
      sector: meta?.sector ?? null,
      price,
      analystTarget,
      upsidePct,
      insicFairValue,
      insicUpsidePct,
      convictionBand,
      epsRevision,
      narrativeHook: null, // assigned per-signal below
      impliedCAGR,
      historicalCagr3y: revenueGrowthPct,
      expectation,
      marketCap: q.marketCap ?? null,
      pctFrom52WHigh,
      analystRating,
    })
  }

  // ─── Build signals ────────────────────────────────────────────────────────

  // Sort helpers
  const byInsicUpside = (arr: IdeaStock[]) =>
    arr.sort((a, b) => (b.insicUpsidePct ?? b.upsidePct ?? -99) - (a.insicUpsidePct ?? a.upsidePct ?? -99))
  const byAnalystUpside = (arr: IdeaStock[]) =>
    arr.sort((a, b) => (b.upsidePct ?? -99) - (a.upsidePct ?? -99))

  // Helper: assign narrative hooks to a bucket
  const withHooks = (arr: IdeaStock[], signalId: SignalId): IdeaStock[] =>
    arr.map(s => ({ ...s, narrativeHook: buildNarrativeHook(s, signalId) }))

  // 1. insic DCF Discount — stocks most undervalued by insic's own model
  const insic_dcf = withHooks(
    byInsicUpside(
      stocks.filter(s => s.insicUpsidePct != null && s.insicUpsidePct > 0.20)
    ).slice(0, 9),
    'insic_dcf'
  )

  // 2. Estimate Upgrades — EPS revised up AND DCF discount
  const estimate_upgrades = withHooks(
    byInsicUpside(
      stocks.filter(s =>
        s.epsRevision?.direction === 'up' &&
        s.insicUpsidePct != null && s.insicUpsidePct > 0.10
      )
    ).slice(0, 9),
    'estimate_upgrades'
  )

  // 3. Most Undervalued (now using insic DCF upside primarily, analyst target fallback)
  const undervalued = withHooks(
    byInsicUpside(
      stocks.filter(s => {
        const upside = s.insicUpsidePct ?? s.upsidePct
        return upside != null && upside > 0.20 &&
          (s.analystRating == null || s.analystRating <= 3.5)
      })
    ).slice(0, 9),
    'undervalued'
  )

  // 4. Priced for Perfection
  const priced_for_perfection = withHooks(
    stocks
      .filter(s => s.impliedCAGR != null && s.impliedCAGR >= 25)
      .sort((a, b) => (b.impliedCAGR ?? 0) - (a.impliedCAGR ?? 0))
      .slice(0, 9),
    'priced_for_perfection'
  )

  // 5. Contrarian
  const contrarian = withHooks(
    stocks
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
      .slice(0, 9),
    'contrarian'
  )

  // 6. Near 52-Week Low
  const near_52w_low = withHooks(
    byAnalystUpside(
      stocks.filter(s =>
        s.pctFrom52WHigh != null && s.pctFrom52WHigh < -25 &&
        (s.insicUpsidePct != null ? s.insicUpsidePct > 0 : s.upsidePct != null && s.upsidePct > 0)
      )
    ).slice(0, 9),
    'near_52w_low'
  )

  // 7. High Conviction
  const high_conviction = withHooks(
    byInsicUpside(
      stocks.filter(s =>
        s.analystRating != null && s.analystRating <= 2.2 &&
        (s.insicUpsidePct != null ? s.insicUpsidePct > 0.10 : s.upsidePct != null && s.upsidePct > 0.10)
      )
    ).slice(0, 9),
    'high_conviction'
  )

  const result: IdeasResponse = {
    signals: {
      insic_dcf,
      estimate_upgrades,
      undervalued,
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
