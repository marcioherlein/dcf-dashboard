import { NextResponse } from 'next/server'
import { SCREENER_UNIVERSE } from '@/lib/data/screenerUniverse'
import { calculateWACC, extractWACCInputs } from '@/lib/dcf/calculateWACC'
import { projectCashFlows, extractFCFInputs } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue } from '@/lib/dcf/calculateFairValue'
import { getCRPByCountry } from '@/lib/dcf/countryRiskPremium'
import { getRfRate } from '@/lib/data/fredClient'
import type {
  IdeaStock,
  SignalId,
  IdeasResponse,
  DataCoverage,
  EvidenceItem,
  RiskFlag,
  RiskFlagType,
  IdeaSnapshot,
} from '@/lib/data/ideasTypes'

export type { IdeaStock, SignalId, IdeasResponse, DataCoverage, EvidenceItem, RiskFlag, RiskFlagType, IdeaSnapshot }

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// ─── Cache — 6-hour TTL ───────────────────────────────────────────────────────

let _cache: { data: IdeasResponse; ts: number } | null = null
const CACHE_TTL = 6 * 60 * 60 * 1000

// ─── Universe ─────────────────────────────────────────────────────────────────

const IDEAS_UNIVERSE = [
  // Mega cap US
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'BRK-B', 'JPM', 'V',
  'UNH', 'JNJ', 'WMT', 'MA', 'HD', 'PG', 'MRK', 'KO', 'PEP', 'CVX',
  'LLY', 'ABBV', 'ORCL', 'BAC', 'XOM', 'COST', 'NFLX', 'CRM', 'ADBE', 'AMD',
  // Large cap tech
  'INTC', 'QCOM', 'TXN', 'IBM', 'NOW', 'UBER', 'SPOT', 'SQ', 'PYPL', 'SNAP',
  'ZM', 'DOCU', 'SHOP', 'MDB', 'SNOW', 'PLTR', 'COIN', 'RBLX',
  'ABNB', 'DASH', 'TSM', 'ASML', 'SAP',
  // Tech additions
  'AMAT', 'MU', 'DELL', 'ACN', 'INTU', 'PANW', 'CRWD', 'NET', 'WDAY', 'DDOG',
  // International
  'TM', 'SONY', 'BHP', 'RIO', 'VALE', 'FCX', 'NEM', 'BIDU', 'BABA', 'JD', 'PDD',
  // Financial
  'GS', 'MS', 'C', 'WFC', 'AXP', 'BLK', 'SCHW', 'CB', 'SPGI', 'ICE', 'COF', 'PNC', 'MMC',
  // Consumer
  'MCD', 'SBUX', 'YUM', 'CMG', 'NKE', 'TGT', 'LOW', 'TJX', 'BKNG', 'MAR', 'HLT', 'LULU', 'F', 'GM',
  // Healthcare
  'ABT', 'BSX', 'SYK', 'MDT', 'ISRG', 'REGN', 'VRTX', 'GILD', 'CVS', 'PFE', 'AMGN', 'CI',
  // Industrials
  'CAT', 'DE', 'HON', 'UPS', 'FDX', 'CSX', 'UNP', 'GE', 'RTX', 'LMT', 'MMM',
  // Media / Telecom
  'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'CHTR', 'EA', 'TTWO',
  // Energy
  'SLB', 'EOG', 'MPC', 'ENB', 'EPD', 'ET',
  // Materials
  'LIN', 'APD', 'DOW',
  // Dividend / REIT
  'MO', 'PM', 'BTI', 'WPC', 'O', 'VICI',
  'SPG', 'PLD', 'AMT', 'CCI', 'DLR', 'EQIX', 'PSA', 'EXR',
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

function deriveMarketCapBucket(marketCap: number | null): IdeaStock['marketCapBucket'] {
  if (marketCap == null) return null
  if (marketCap >= 200e9) return 'mega'
  if (marketCap >= 10e9) return 'large'
  if (marketCap >= 2e9) return 'mid'
  return 'small'
}

// ─── IdeaScore (0–100) ────────────────────────────────────────────────────────

type ScoreInputs = Pick<
  IdeaStock,
  | 'insicUpsidePct'
  | 'upsidePct'
  | 'epsRevision'
  | 'insiderSentiment'
  | 'analystRating'
  | 'sectorContext'
  | 'pctFrom52WHigh'
>

function computeIdeaScore(stock: ScoreInputs): number {
  let score = 0

  // DCF upside component (max +25, min -10)
  if (stock.insicUpsidePct != null) {
    if (stock.insicUpsidePct >= 0.30)      score += 25
    else if (stock.insicUpsidePct >= 0.15) score += 15
    else if (stock.insicUpsidePct >= 0.05) score +=  8
    else if (stock.insicUpsidePct <  0)    score -= 10
  }

  // Analyst target upside component (max +15)
  if (stock.upsidePct != null) {
    if (stock.upsidePct >= 0.20)      score += 15
    else if (stock.upsidePct >= 0.10) score +=  8
  }

  // EPS revision component (max +12, min -8)
  if (stock.epsRevision != null) {
    const { direction, magnitude } = stock.epsRevision
    if (direction === 'up' && magnitude > 0.05)       score += 12
    else if (direction === 'up' && magnitude >= 0.02) score +=  6
    else if (direction === 'down')                    score -=  8
  }

  // Insider sentiment component (max +10, min -8)
  if (stock.insiderSentiment != null) {
    if (stock.insiderSentiment.sentiment === 'net_buyer')  score += 10
    if (stock.insiderSentiment.sentiment === 'net_seller') score -=  8
  }

  // Analyst rating component (max +12, min -6)
  if (stock.analystRating != null) {
    if (stock.analystRating <= 1.8)      score += 12
    else if (stock.analystRating <= 2.5) score +=  6
    else if (stock.analystRating >= 3.8) score -=  6
  }

  // Sector valuation component (max +8)
  if (stock.sectorContext?.pctVsMedianFwdPE != null) {
    const pct = stock.sectorContext.pctVsMedianFwdPE
    if (pct <= -0.20)      score += 8
    else if (pct <= -0.10) score += 4
  }

  // 52-week position component (max +6)
  // pctFrom52WHigh is expressed as a signed percentage (e.g. -30 means 30% below the high)
  if (stock.pctFrom52WHigh != null) {
    if (stock.pctFrom52WHigh <= -30)      score += 6
    else if (stock.pctFrom52WHigh <= -20) score += 3
  }

  return Math.min(100, Math.max(0, score))
}

// ─── Evidence List ────────────────────────────────────────────────────────────

function buildEvidenceList(stock: ScoreInputs & Pick<IdeaStock, 'sector'>): EvidenceItem[] {
  const items: EvidenceItem[] = []

  if (stock.insicUpsidePct != null) {
    const sign = stock.insicUpsidePct >= 0 ? '+' : ''
    items.push({
      label: 'DCF upside',
      value: `${sign}${(stock.insicUpsidePct * 100).toFixed(1)}%`,
      positive: stock.insicUpsidePct > 0,
    })
  }

  if (items.length < 5 && stock.upsidePct != null) {
    const sign = stock.upsidePct >= 0 ? '+' : ''
    items.push({
      label: 'Analyst target',
      value: `${sign}${(stock.upsidePct * 100).toFixed(1)}%`,
      positive: stock.upsidePct > 0,
    })
  }

  if (items.length < 5 && stock.epsRevision != null && stock.epsRevision.direction !== 'flat') {
    const arrow = stock.epsRevision.direction === 'up' ? '↑' : '↓'
    items.push({
      label: 'EPS revision',
      value: `${arrow} ${(Math.abs(stock.epsRevision.magnitude) * 100).toFixed(0)}% (90d)`,
      positive: stock.epsRevision.direction === 'up',
    })
  }

  if (items.length < 5 && stock.insiderSentiment != null) {
    const { sentiment, buyCount, sellCount } = stock.insiderSentiment
    items.push({
      label: 'Insider activity',
      value: `${buyCount}b ${sellCount}s 90d`,
      positive: sentiment === 'net_buyer' ? true : sentiment === 'net_seller' ? false : null,
    })
  }

  if (items.length < 5 && stock.sectorContext?.pctVsMedianFwdPE != null && Math.abs(stock.sectorContext.pctVsMedianFwdPE) >= 0.10) {
    const pct = Math.abs(stock.sectorContext.pctVsMedianFwdPE * 100).toFixed(0)
    const dir = stock.sectorContext.pctVsMedianFwdPE < 0 ? 'cheaper' : 'pricier'
    items.push({
      label: 'vs sector P/E',
      value: `${pct}% ${dir}`,
      positive: stock.sectorContext.pctVsMedianFwdPE < 0,
    })
  }

  if (items.length < 5 && stock.analystRating != null) {
    const rLabel =
      stock.analystRating <= 1.5 ? 'Strong Buy' :
      stock.analystRating <= 2.2 ? 'Buy' :
      stock.analystRating <= 2.5 ? 'Overweight' :
      stock.analystRating <= 3.5 ? 'Hold' : 'Sell'
    items.push({
      label: 'Analyst rating',
      value: `${stock.analystRating.toFixed(1)}/5 ${rLabel}`,
      positive: stock.analystRating <= 2.5,
    })
  }

  if (items.length < 5 && stock.pctFrom52WHigh != null) {
    items.push({
      label: '52W position',
      value: `${stock.pctFrom52WHigh.toFixed(1)}% from high`,
      positive: stock.pctFrom52WHigh < -25,
    })
  }

  return items.slice(0, 5)
}

// ─── Risk Flags ───────────────────────────────────────────────────────────────

type RiskInputs = Pick<IdeaStock, 'insicFairValue' | 'expectation' | 'sectorContext' | 'pctFrom52WHigh' | 'insiderSentiment'>

function buildRiskFlags(stock: RiskInputs): RiskFlag[] {
  const flags: RiskFlag[] = []

  if (stock.insicFairValue == null) {
    flags.push({ type: 'dcf_unavailable' as RiskFlagType, message: 'No DCF estimate available — analyst target only' })
  }

  if (stock.expectation === 'Very Aggressive') {
    flags.push({ type: 'very_aggressive' as RiskFlagType, message: 'Market pricing in >25% EPS growth' })
  }

  if (stock.sectorContext?.pctVsMedianFwdPE != null && stock.sectorContext.pctVsMedianFwdPE > 0.25) {
    const pct = Math.round(stock.sectorContext.pctVsMedianFwdPE * 100)
    flags.push({ type: 'expensive_sector' as RiskFlagType, message: `${pct}% pricier than sector median P/E` })
  }

  if (stock.pctFrom52WHigh != null && stock.pctFrom52WHigh > -5) {
    flags.push({ type: 'near_52w_high' as RiskFlagType, message: 'Trading near 52-week high' })
  }

  if (stock.insiderSentiment?.sentiment === 'net_seller') {
    flags.push({ type: 'insider_selling' as RiskFlagType, message: 'Net insider selling in 90 days' })
  }

  return flags
}

// ─── Lightweight DCF ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeLightweightDCF(s: any, q: any, rfRate: number): number | null {
  try {
    const fd = s?.financialData ?? {}
    const ks = s?.defaultKeyStatistics ?? {}
    const price: number = q?.regularMarketPrice ?? 0
    if (!price || price <= 0) return null

    const country: string | null = (fd.summaryProfile?.country ?? s?.summaryProfile?.country ?? null) as string | null
    const crp = getCRPByCountry(country, 'USD')
    const beta: number = (ks.beta as number | null) ?? 1.0

    const waccInputs = extractWACCInputs(s, rfRate, beta, 1, crp)
    const waccResult = calculateWACC(waccInputs)

    const { baseFCF, cagr, isNegativeFCF } = extractFCFInputs(s, false)
    const terminalGBase = cagr > 0.15 ? 0.025 : cagr > 0.05 ? 0.020 : 0.015
    const terminalG = crp > 0.02
      ? Math.min(Math.max(terminalGBase, rfRate + 0.02), 0.07)
      : terminalGBase
    const growthModel = (cagr > 0.15 || isNegativeFCF) ? 'three-stage' as const : 'two-stage' as const
    const dcfResult = projectCashFlows({ baseFCF, cagr, wacc: waccResult.wacc, terminalG, growthModel })

    const bs = s?.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {}
    const marketCapM = (q.marketCap ?? 0) / 1e6

    const cashRaw: number = (
      bs.cash ?? bs.cashAndCashEquivalents ?? bs.cashAndShortTermInvestments
      ?? bs.cashCashEquivalentsAndShortTermInvestments ?? bs.cashAndCashEquivalentsAtCarryingValue
      ?? fd.totalCash ?? 0
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

    const sharesM = (q.marketCap as number) > 0 && price > 0
      ? (q.marketCap as number) / price / 1e6
      : ((ks.sharesOutstanding ?? 0) as number) / 1e6

    const fvResult = calculateFairValue(dcfResult, cashM, debtM, sharesM, price)
    const fv = fvResult.fairValuePerShare
    // Cap at 4x current price (300% upside max). The full cockpit blends 4 models
    // which pulls extreme DCF-only results down significantly. Without the cap,
    // high-FCF stocks (especially Chinese ADRs with depressed market prices) produce
    // 900%+ numbers that are artifacts of the single-model DCF, not real opportunities.
    if (fv == null || fv <= 0 || fv > price * 4 || isNaN(fv)) return null
    return Math.round(fv * 100) / 100
  } catch {
    return null
  }
}

// ─── EPS revision ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEpsRevision(s: any): IdeaStock['epsRevision'] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const etTrends: any[] = s?.earningsTrend?.trend ?? []
    const trend1y = etTrends.find((t: any) => t?.period === '+1y')
    if (!trend1y) return null
    const currentAvg: number | null = trend1y.earningsEstimate?.avg ?? null
    const ninetyDaysAgo: number | null = trend1y.earningsEstimate?.['90daysAgo'] ?? null
    if (currentAvg == null || ninetyDaysAgo == null || Math.abs(ninetyDaysAgo) < 0.001) return null
    const magnitude = (currentAvg - ninetyDaysAgo) / Math.abs(ninetyDaysAgo)
    const direction: 'up' | 'flat' | 'down' = Math.abs(magnitude) < 0.02 ? 'flat' : magnitude > 0 ? 'up' : 'down'
    return { direction, magnitude: Math.round(magnitude * 1000) / 1000 }
  } catch {
    return null
  }
}

// ─── Insider sentiment ────────────────────────────────────────────────────────
// Uses Yahoo's insiderTransactions module — same source as /api/stock/insiders.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractInsiderSentiment(s: any): IdeaStock['insiderSentiment'] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txns: any[] = s?.insiderTransactions?.transactions ?? []
    if (!Array.isArray(txns) || txns.length === 0) return null

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)

    let buyCount = 0, sellCount = 0
    for (const t of txns) {
      const dateStr: string = t.startDate?.fmt ?? t.startDate ?? ''
      if (!dateStr || new Date(dateStr) < cutoff) continue
      const desc = (t.transactionDescription ?? '').toLowerCase()
      if (desc.includes('purchase') || desc.includes(' buy')) buyCount++
      else if (desc.includes('sale') || desc.includes('sell')) sellCount++
    }

    if (buyCount === 0 && sellCount === 0) return null
    const sentiment: 'net_buyer' | 'net_seller' | 'neutral' =
      buyCount > sellCount * 1.5 ? 'net_buyer'
      : sellCount > buyCount * 1.5 ? 'net_seller'
      : 'neutral'
    return { sentiment, buyCount, sellCount }
  } catch {
    return null
  }
}

// ─── Sector median forward P/E ────────────────────────────────────────────────

function computeSectorMedians(stocks: Array<{ sector: string | null; fwdPE: number | null }>): Map<string, number> {
  const byS = new Map<string, number[]>()
  for (const s of stocks) {
    if (!s.sector || s.fwdPE == null || s.fwdPE <= 0 || s.fwdPE > 200) continue
    if (!byS.has(s.sector)) byS.set(s.sector, [])
    byS.get(s.sector)!.push(s.fwdPE)
  }
  const medians = new Map<string, number>()
  Array.from(byS.entries()).forEach(([sector, pes]) => {
    if (pes.length < 3) return
    const sorted = [...pes].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    medians.set(sector, Math.round(median * 10) / 10)
  })
  return medians
}

// ─── Quick conviction band ────────────────────────────────────────────────────

function quickConvictionBand(
  insicUpsidePct: number | null,
  analystRating: number | null,
  epsDir: 'up' | 'flat' | 'down' | null,
  pctFrom52WHigh: number | null,
  insiderSentiment: IdeaStock['insiderSentiment'],
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
  if (insiderSentiment?.sentiment === 'net_buyer') score += 1
  else if (insiderSentiment?.sentiment === 'net_seller') score -= 1

  if (score >= 5) return 'A'
  if (score >= 3) return 'B'
  if (score >= 1) return 'C'
  return 'D'
}

// ─── Narrative hooks ──────────────────────────────────────────────────────────

function buildNarrativeHook(stock: IdeaStock, signalId: SignalId): string | null {
  const fmtAbs = (v: number) => `${Math.abs(v).toFixed(0)}%`
  const fmt = (v: number) => v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`

  const sectorSnippet = (() => {
    const sc = stock.sectorContext
    if (sc?.pctVsMedianFwdPE == null || Math.abs(sc.pctVsMedianFwdPE) < 0.10) return ''
    const dir = sc.pctVsMedianFwdPE < 0 ? 'cheaper' : 'pricier'
    const pct = fmtAbs(sc.pctVsMedianFwdPE * 100)
    return ` ${pct} ${dir} than ${stock.sector ?? 'sector'} median P/E.`
  })()

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
      return `Trading ${up} below insic's intrinsic value estimate.${revPart}${sectorSnippet}`
    }
    case 'estimate_upgrades': {
      if (stock.epsRevision == null) return null
      const revUp = fmtAbs(stock.epsRevision.magnitude * 100)
      const dcfPart = stock.insicUpsidePct != null
        ? ` Stock still ${fmtAbs(stock.insicUpsidePct * 100)} below insic fair value.`
        : ''
      return `EPS estimates revised up ${revUp} over 90 days.${dcfPart}${sectorSnippet}`
    }
    case 'insider_buying': {
      const ins = stock.insiderSentiment
      if (ins == null) return null
      const buys = ins.buyCount === 1 ? '1 insider purchase' : `${ins.buyCount} insider purchases`
      const dcfPart = stock.insicUpsidePct != null
        ? ` Stock trades ${fmtAbs(stock.insicUpsidePct * 100)} below insic fair value.`
        : ''
      return `${buys} in the last 90 days.${dcfPart}${sectorSnippet}`
    }
    case 'undervalued': {
      const primary = stock.insicUpsidePct ?? stock.upsidePct
      if (primary == null) return null
      const source = stock.insicUpsidePct != null ? 'insic DCF' : 'analyst consensus'
      return `${fmtAbs(primary * 100)} upside vs ${source}.${sectorSnippet}`
    }
    case 'contrarian': {
      if (stock.impliedCAGR == null || stock.historicalCagr3y == null) return null
      return `Market pricing in ${stock.impliedCAGR.toFixed(0)}% EPS growth — revenue grew ${stock.historicalCagr3y.toFixed(0)}% last year.${sectorSnippet}`
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
      return `${downStr} from 52-week high.${targetPart}${sectorSnippet}`
    }
    case 'high_conviction': {
      if (stock.analystRating == null) return null
      const ratingLabel = stock.analystRating <= 1.5 ? 'Strong Buy' : stock.analystRating <= 2.2 ? 'Buy' : 'Overweight'
      const dcfPart = stock.insicFairValue != null
        ? ` insic fair value: $${stock.insicFairValue.toFixed(2)}.`
        : ''
      return `Analyst consensus: ${ratingLabel}.${dcfPart}${sectorSnippet}`
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
  const rfRate = await getRfRate()

  // ── Load stored cockpit valuations from daily_valuations ──────────────────
  // The valuation-batch cron runs nightly and stores the real 4-model blended
  // fair value for each ticker. We prefer these over the single-model DCF below.
  // Fall back to computeLightweightDCF for tickers not yet in the table.
  const storedValuations = new Map<string, { fairValue: number; upsidePct: number }>()
  try {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (sbUrl && sbKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(sbUrl, sbKey)
      // Accept rows from the last 3 days — weekends / holidays skip batch runs
      const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
      const { data } = await sb
        .from('daily_valuations')
        .select('ticker, fair_value, upside_pct, date')
        .gte('date', cutoff)
        .not('fair_value', 'is', null)
        .order('date', { ascending: false })
      if (data) {
        // Keep the most recent row per ticker
        const seen = new Set<string>()
        for (const row of data) {
          if (!seen.has(row.ticker) && row.fair_value != null && row.upside_pct != null) {
            storedValuations.set(row.ticker, {
              fairValue: row.fair_value,
              upsidePct: row.upside_pct,
            })
            seen.add(row.ticker)
          }
        }
      }
    }
  } catch {
    // Non-fatal — falls back to lightweight DCF for all tickers
  }

  // Batch quote fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteMap = new Map<string, any>()
  const failedQuoteTickers: string[] = []
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
    } catch {
      failedQuoteTickers.push(...batch)
    }
  }

  // Enriched fundamentals — DCF modules + insider transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryMap = new Map<string, any>()
  const failedSummaryTickers: string[] = []
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
            'insiderTransactions',
          ],
        }, { validateResult: false })
        summaryMap.set(ticker, s)
      } catch {
        failedSummaryTickers.push(ticker)
      }
    }))
  }

  // ─── Pass 1: assemble stocks (sectorContext added in pass 2) ─────────────

  type StockWithFwdPE = Omit<IdeaStock, 'ideaScore' | 'evidenceList' | 'riskFlags'> & {
    _fwdPE: number | null
    sectorContext: IdeaStock['sectorContext']
  }
  const stocksWithFwdPE: StockWithFwdPE[] = []

  for (const ticker of IDEAS_UNIVERSE) {
    const q = quoteMap.get(ticker)
    if (!q) continue
    const price = q.regularMarketPrice ?? null
    if (!price || price <= 0) continue

    const meta = metaMap.get(ticker)
    const s = summaryMap.get(ticker)
    const fd = s?.financialData ?? null

    const high52 = q.fiftyTwoWeekHigh ?? null
    const pctFrom52WHigh = (high52 != null && high52 > 0) ? ((price / high52) - 1) * 100 : null

    const epsForward    = q.epsForward ?? null
    const epsTTM        = q.epsTrailingTwelveMonths ?? null
    const revenueGrowth = fd?.revenueGrowth ?? null
    const epsGrowth     = fd?.earningsGrowth ?? null
    const targetPrice   = fd?.targetMeanPrice ?? null
    const analystRating = fd?.recommendationMean ?? null
    const revenueGrowthPct = revenueGrowth != null ? revenueGrowth * 100 : null

    const impliedCAGR  = estimateImpliedCAGR(epsForward, epsTTM, revenueGrowth, epsGrowth)
    const analystTarget = getAnalystTarget(targetPrice, price)
    const upsidePct    = (analystTarget != null && price > 0) ? (analystTarget / price) - 1 : null
    const expectation  = impliedCAGR != null ? classifyExpectation(impliedCAGR, revenueGrowthPct) : null

    // Prefer stored cockpit valuation (real 4-model blend from nightly batch).
    // Fall back to single-model lightweight DCF if no stored value available.
    const stored = storedValuations.get(ticker)
    const lightweightFV = stored == null && s ? computeLightweightDCF(s, q, rfRate) : null
    const insicFairValue   = stored?.fairValue ?? lightweightFV
    const insicUpsidePct   = stored?.upsidePct ?? (lightweightFV != null && price > 0 ? (lightweightFV / price) - 1 : null)
    const epsRevision      = s ? extractEpsRevision(s) : null
    const insiderSentiment = s ? extractInsiderSentiment(s) : null
    const fwdPE: number | null = (q.forwardPE != null && q.forwardPE > 0 && q.forwardPE < 200) ? q.forwardPE : null
    const trailingPE: number | null = (q.trailingPE != null && q.trailingPE > 0 && q.trailingPE < 500) ? q.trailingPE : null

    const convictionBand = quickConvictionBand(
      insicUpsidePct, analystRating, epsRevision?.direction ?? null, pctFrom52WHigh, insiderSentiment
    )

    const sector = meta?.sector ?? null
    const marketCap: number | null = q.marketCap ?? null
    const marketCapBucket = deriveMarketCapBucket(marketCap)

    stocksWithFwdPE.push({
      ticker,
      name: q.longName ?? q.shortName ?? meta?.name ?? ticker,
      sector,
      price,
      analystTarget,
      upsidePct,
      insicFairValue,
      insicUpsidePct,
      convictionBand,
      epsRevision,
      insiderSentiment,
      sectorContext: null,
      narrativeHook: null,
      impliedCAGR,
      historicalCagr3y: revenueGrowthPct,
      expectation,
      marketCap,
      pctFrom52WHigh,
      analystRating,
      fwdPE,
      trailingPE,
      marketCapBucket,
      _fwdPE: fwdPE,
    })
  }

  // ─── Pass 2: add sector context ───────────────────────────────────────────

  const sectorMedians = computeSectorMedians(
    stocksWithFwdPE.map(s => ({ sector: s.sector, fwdPE: s._fwdPE }))
  )

  const stocksBase = stocksWithFwdPE.map(s => {
    const medianFwdPE   = s.sector ? sectorMedians.get(s.sector) ?? null : null
    const stockFwdPE    = s._fwdPE
    const pctVsMedianFwdPE = (stockFwdPE != null && medianFwdPE != null)
      ? (stockFwdPE - medianFwdPE) / medianFwdPE
      : null
    const { _fwdPE: _unused, ...rest } = s
    void _unused
    return { ...rest, sectorContext: { medianFwdPE, stockFwdPE, pctVsMedianFwdPE } }
  })

  // ─── Pass 3: compute ideaScore, evidenceList, riskFlags ───────────────────

  const stocks: IdeaStock[] = stocksBase.map(s => ({
    ...s,
    ideaScore: computeIdeaScore(s),
    evidenceList: buildEvidenceList(s),
    riskFlags: buildRiskFlags(s),
  }))

  // ─── Build signals ────────────────────────────────────────────────────────

  const byInsicUpside = (arr: IdeaStock[]) =>
    arr.sort((a, b) => (b.insicUpsidePct ?? b.upsidePct ?? -99) - (a.insicUpsidePct ?? a.upsidePct ?? -99))
  const byAnalystUpside = (arr: IdeaStock[]) =>
    arr.sort((a, b) => (b.upsidePct ?? -99) - (a.upsidePct ?? -99))

  const withHooks = (arr: IdeaStock[], signalId: SignalId): IdeaStock[] =>
    arr.map(s => ({ ...s, narrativeHook: buildNarrativeHook(s, signalId) }))

  const insic_dcf = withHooks(
    byInsicUpside(stocks.filter(s => s.insicUpsidePct != null && s.insicUpsidePct > 0.20)).slice(0, 9),
    'insic_dcf'
  )

  const estimate_upgrades = withHooks(
    byInsicUpside(stocks.filter(s =>
      s.epsRevision?.direction === 'up' && s.insicUpsidePct != null && s.insicUpsidePct > 0.10
    )).slice(0, 9),
    'estimate_upgrades'
  )

  // Insider buying: net buyer in 90 days AND DCF discount exists
  const insider_buying = withHooks(
    byInsicUpside(stocks.filter(s =>
      s.insiderSentiment?.sentiment === 'net_buyer' &&
      (s.insicUpsidePct != null ? s.insicUpsidePct > 0 : s.upsidePct != null && s.upsidePct > 0)
    )).slice(0, 9),
    'insider_buying'
  )

  const undervalued = withHooks(
    byInsicUpside(stocks.filter(s => {
      const upside = s.insicUpsidePct ?? s.upsidePct
      return upside != null && upside > 0.20 && (s.analystRating == null || s.analystRating <= 3.5)
    })).slice(0, 9),
    'undervalued'
  )

  const priced_for_perfection = withHooks(
    stocks.filter(s => s.impliedCAGR != null && s.impliedCAGR >= 25)
      .sort((a, b) => (b.impliedCAGR ?? 0) - (a.impliedCAGR ?? 0)).slice(0, 9),
    'priced_for_perfection'
  )

  const contrarian = withHooks(
    stocks.filter(s =>
      s.impliedCAGR != null && s.historicalCagr3y != null &&
      s.impliedCAGR < s.historicalCagr3y * 0.60 && s.historicalCagr3y > 5
    ).sort((a, b) =>
      ((b.historicalCagr3y ?? 0) - (b.impliedCAGR ?? 0)) - ((a.historicalCagr3y ?? 0) - (a.impliedCAGR ?? 0))
    ).slice(0, 9),
    'contrarian'
  )

  const near_52w_low = withHooks(
    byAnalystUpside(stocks.filter(s =>
      s.pctFrom52WHigh != null && s.pctFrom52WHigh < -25 &&
      (s.insicUpsidePct != null ? s.insicUpsidePct > 0 : s.upsidePct != null && s.upsidePct > 0)
    )).slice(0, 9),
    'near_52w_low'
  )

  const high_conviction = withHooks(
    byInsicUpside(stocks.filter(s =>
      s.analystRating != null && s.analystRating <= 2.2 &&
      (s.insicUpsidePct != null ? s.insicUpsidePct > 0.10 : s.upsidePct != null && s.upsidePct > 0.10)
    )).slice(0, 9),
    'high_conviction'
  )

  // ─── DataCoverage ─────────────────────────────────────────────────────────

  const dcfAvailableCount = stocks.filter(s => s.insicFairValue != null).length
  const requestedCount = IDEAS_UNIVERSE.length
  const quoteSuccessCount = quoteMap.size
  const summarySuccessCount = summaryMap.size

  // Collect failed tickers: explicit failures + tickers with no quote at all
  const failedSet = new Set([...failedQuoteTickers, ...failedSummaryTickers])
  for (const ticker of IDEAS_UNIVERSE) {
    if (!quoteMap.has(ticker)) failedSet.add(ticker)
  }

  const dataCoverage: DataCoverage = {
    requestedCount,
    quoteSuccessCount,
    summarySuccessCount,
    dcfAvailableCount,
    dataCoveragePct: Math.round((summarySuccessCount / requestedCount) * 100),
    failedTickers: Array.from(failedSet),
  }

  const result: IdeasResponse = {
    signals: {
      insic_dcf,
      estimate_upgrades,
      insider_buying,
      undervalued,
      priced_for_perfection,
      contrarian,
      near_52w_low,
      high_conviction,
    },
    updatedAt: new Date().toISOString(),
    totalAnalyzed: stocks.length,
    dataCoverage,
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
