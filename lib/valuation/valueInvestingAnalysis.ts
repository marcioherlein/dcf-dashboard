/**
 * Value Investing Analysis
 *
 * Aggregates EPV, Graham Number, Magic Formula, Owner Earnings,
 * and DDM outputs from a stock's apiData. Intended for client-side
 * computation from the existing /api/financials response.
 */

import { computeEPV, type EPVResult } from './methods/epv'
import { computeGrahamNumber, type GrahamNumberResult } from './methods/grahamNumber'
import { computeMagicFormula, type MagicFormulaResult } from './methods/magicFormula'
import { computeOwnerEarnings, type OwnerEarningsResult } from './methods/ownerEarnings'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = Record<string, any>

export interface DDMResult {
  fairValuePerShare: number | null
  upsidePct: number | null
  dividendPerShare: number | null
  isApplicable: boolean
  inapplicabilityReason: string | null
}

export interface ValueInvestingData {
  epv: EPVResult
  grahamNumber: GrahamNumberResult
  magicFormula: MagicFormulaResult
  ownerEarnings: OwnerEarningsResult
  ddm: DDMResult

  // Context signals
  normalizedEarningsWarning: boolean     // current EPS >50% above 5Y avg
  countryRiskDisclaimer: string | null   // high CRP (>8%)
  structuralRiskDisclaimer: string | null // VIE / state-controlled ADR

  // For QualityPanel
  roic: number | null
  roicSpread: number | null
  wacc: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize5Y(rows: any[], getValue: (r: ApiData) => number | null): number | null {
  const actuals = rows.filter(r => !r.isProjected)
  const vals = actuals.map(getValue).filter((v): v is number => v != null && isFinite(v))
  if (vals.length < 2) return null
  return median(vals.slice(-5))
}

function computeDDM(
  currentPrice: number,
  dividendPerShare: number | null,
  dividendYield: number | null,
  costOfEquity: number,
  terminalG: number,
): DDMResult {
  const d0 = dividendPerShare ?? (dividendYield != null && dividendYield > 0 ? dividendYield * currentPrice : null)

  if (d0 == null || d0 <= 0) {
    return {
      fairValuePerShare: null, upsidePct: null, dividendPerShare: d0,
      isApplicable: false, inapplicabilityReason: 'No dividend paid — DDM not applicable',
    }
  }

  const spread = costOfEquity - terminalG
  if (spread <= 0.005) {
    return {
      fairValuePerShare: null, upsidePct: null, dividendPerShare: d0,
      isApplicable: false, inapplicabilityReason: 'Terminal growth rate too close to cost of equity',
    }
  }

  const d1 = d0 * (1 + terminalG)
  const fairValuePerShare = d1 / spread
  const upsidePct = currentPrice > 0 ? (fairValuePerShare - currentPrice) / currentPrice : null

  return { fairValuePerShare, upsidePct, dividendPerShare: d0, isApplicable: true, inapplicabilityReason: null }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function buildValueInvestingData(
  apiData: ApiData,
  wacc: number,
  terminalG: number,
): ValueInvestingData {
  // ── Core scalars ─────────────────────────────────────────────────────────────
  const currentPrice: number  = apiData.quote?.price ?? 0
  const sharesM: number       = apiData.fairValue?.sharesOutstanding ?? 0
  const cashM: number         = apiData.fairValue?.cash ?? 0
  const debtM: number         = apiData.fairValue?.debt ?? 0
  const netDebtM              = debtM - cashM
  const marketCapRaw: number  = apiData.quote?.marketCap ?? 0        // raw $
  const marketCapM            = marketCapRaw / 1e6
  const taxRate: number       = apiData.wacc?.inputs?.taxRate ?? 0.21
  const rfRate: number        = apiData.wacc?.inputs?.rfRate ?? 0.045
  const crp: number           = apiData.wacc?.crp ?? apiData.wacc?.inputs?.crp ?? 0
  const peRatio: number | null = apiData.quote?.peRatio ?? null
  const sector: string | null  = apiData.quote?.sector ?? null
  const country: string | null = apiData.quote?.country ?? null

  // Cost of equity (CAPM approximation from existing inputs)
  const beta: number   = apiData.quote?.beta ?? 1.0
  const erp: number    = apiData.wacc?.inputs?.erp ?? 0.05
  const costOfEquity   = rfRate + beta * erp + crp

  // ── Financial statement rows ──────────────────────────────────────────────
  const incomeRows: ApiData[] = apiData.financialStatements?.incomeStatement ?? []
  const cashRows: ApiData[]   = apiData.financialStatements?.cashFlow ?? []
  const bsRows: ApiData[]     = apiData.financialStatements?.balanceSheet ?? []

  const incomeActuals = incomeRows.filter((r: ApiData) => !r.isProjected)
  const cashActuals   = cashRows.filter((r: ApiData) => !r.isProjected)
  const bsActuals     = bsRows.filter((r: ApiData) => !r.isProjected)

  const lastIncome = incomeActuals[incomeActuals.length - 1] ?? null
  const lastCash   = cashActuals[cashActuals.length - 1] ?? null
  const lastBS     = bsActuals[bsActuals.length - 1] ?? null

  // ── Current-year figures ──────────────────────────────────────────────────
  const operatingIncomeM: number | null = lastIncome?.operatingIncome ?? null
  const netIncomeM: number | null       = lastIncome?.netIncome ?? null
  const ebitM                           = operatingIncomeM  // EBIT ≈ operating income

  const rawDna  = lastCash?.depreciationAndAmortization ?? lastCash?.dna ?? null
  const dnaM: number | null = rawDna != null ? Math.abs(rawDna) : null

  const rawCapex  = lastCash?.capex ?? null
  const capexM: number | null = rawCapex != null ? rawCapex : null

  const totalEquityM: number | null = lastBS?.totalEquity ?? null
  const bvps: number | null = (totalEquityM != null && sharesM > 0) ? totalEquityM / sharesM : null
  const currentEPS: number | null   = (netIncomeM != null && sharesM > 0) ? netIncomeM / sharesM : null
  const epsDerivedPE: number | null = (currentEPS != null && currentEPS > 0 && currentPrice > 0) ? currentPrice / currentEPS : null
  const effectivePE = peRatio ?? epsDerivedPE

  // ── Enterprise Value ──────────────────────────────────────────────────────
  // Prefer from existing multiples estimates (more precise); fall back to market cap + net debt
  const multEst: ApiData[] = apiData.valuationMethods?.models?.multiples?.estimates ?? []
  const evEbitdaActual  = multEst.find((e: ApiData) => e.multiple === 'EV/EBITDA')?.actualValue ?? null
  const lastEbitdaM     = lastIncome?.ebitda ?? null
  const evFromMultiple  = (evEbitdaActual != null && lastEbitdaM != null) ? evEbitdaActual * lastEbitdaM : null
  const evM: number | null = evFromMultiple ?? (marketCapM + netDebtM > 0 ? marketCapM + netDebtM : null)

  // ── Normalized (5-year average) figures ───────────────────────────────────
  const normalizedOperatingIncomeM = normalize5Y(incomeActuals, (r: ApiData) => r.operatingIncome ?? null)
  const normalizedNetIncomeM       = normalize5Y(incomeActuals, (r: ApiData) => r.netIncome ?? null)
  const normalizedEPS = (normalizedNetIncomeM != null && sharesM > 0) ? normalizedNetIncomeM / sharesM : null

  // ── ROIC (prefer FMP pre-computed) ───────────────────────────────────────
  const roic: number | null  = apiData.scores?.roic?.roic ?? null
  const roicSpread: number | null = apiData.scores?.roic?.spread ?? (roic != null ? roic - wacc : null)

  // ── Compute models ────────────────────────────────────────────────────────
  const epv = computeEPV({
    operatingIncomeM,
    normalizedOperatingIncomeM,
    taxRate,
    wacc,
    netDebtM,
    sharesM,
    currentPrice,
    currentEPS,
    normalizedEPS,
  })

  const grahamNumber = computeGrahamNumber({
    eps: currentEPS,
    normalizedEps: normalizedEPS,
    bvps,
    currentPrice,
    peRatio: effectivePE,
    sector,
  })

  const magicFormula = computeMagicFormula({
    ebitM,
    enterpriseValueM: evM,
    roic,
    riskFreeRate: rfRate,
    currentPrice,
  })

  const ownerEarnings = computeOwnerEarnings({
    netIncomeM,
    normalizedNetIncomeM,
    depreciationAmortizationM: dnaM,
    capitalExpendituresM: capexM,
    maintenanceCapexRatio: 0.70,
    wacc,
    terminalG,
    marketCapM,
    sharesM,
    currentPrice,
    currentEPS,
    normalizedEPS,
  })

  const dividendPerShare: number | null = apiData.quote?.dividendPerShare ?? null
  const dividendYield: number | null    = apiData.quote?.dividendYield ?? null
  const ddm = computeDDM(currentPrice, dividendPerShare, dividendYield, costOfEquity, terminalG)

  // ── Normalized earnings warning ───────────────────────────────────────────
  const normalizedEarningsWarning = (
    currentEPS != null && normalizedEPS != null && normalizedEPS !== 0 &&
    (currentEPS - normalizedEPS) / Math.abs(normalizedEPS) > 0.50
  )

  // ── Disclaimers ───────────────────────────────────────────────────────────
  const countryRiskDisclaimer: string | null = crp > 0.08
    ? `High country risk (CRP ${(crp * 100).toFixed(1)}%) significantly increases the discount rate. Model outputs are sensitive to this assumption — treat as directional.`
    : null

  const isChina = country === 'China' || country === 'CN'
  const structuralRiskDisclaimer: string | null = isChina
    ? `This company uses a VIE structure. Quantitative models treat reported financials at face value and do not reflect ownership structure risk, CCP regulatory exposure, or potential ADR delisting risk.`
    : null

  return {
    epv,
    grahamNumber,
    magicFormula,
    ownerEarnings,
    ddm,
    normalizedEarningsWarning,
    countryRiskDisclaimer,
    structuralRiskDisclaimer,
    roic,
    roicSpread,
    wacc,
  }
}

// ── Star rating ───────────────────────────────────────────────────────────────

export type StarRating = 1 | 2 | 3 | 4 | 5

export interface StarRatingResult {
  stars: StarRating
  label: string
  description: string
}

export function computeStarRating(
  currentPrice: number,
  blendedFairValue: number | null,
): StarRatingResult | null {
  if (blendedFairValue == null || blendedFairValue <= 0 || currentPrice <= 0) return null
  const ratio = currentPrice / blendedFairValue

  if (ratio < 0.70)  return { stars: 5, label: 'Strong Buy',    description: 'Significant discount to fair value' }
  if (ratio < 0.85)  return { stars: 4, label: 'Buy',           description: 'Trading below fair value' }
  if (ratio <= 1.10) return { stars: 3, label: 'Hold',          description: 'Near fair value' }
  if (ratio <= 1.25) return { stars: 2, label: 'Sell',          description: 'Trading above fair value' }
  return               { stars: 1, label: 'Strong Sell',  description: 'Significant premium to fair value' }
}

// ── Uncertainty band ─────────────────────────────────────────────────────────

export type UncertaintyLevel = 'Low' | 'Medium' | 'High' | 'Very High'

export function computeUncertainty(
  methodFairValues: (number | null)[],
  blendedFairValue: number,
): UncertaintyLevel {
  const valid = methodFairValues.filter((v): v is number => v != null && v > 0)
  if (valid.length < 2) return 'High'

  const mean = valid.reduce((s, v) => s + v, 0) / valid.length
  const stdDev = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length)
  const cv = stdDev / blendedFairValue

  if (cv < 0.15) return 'Low'
  if (cv < 0.30) return 'Medium'
  if (cv < 0.50) return 'High'
  return 'Very High'
}
