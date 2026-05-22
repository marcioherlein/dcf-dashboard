/**
 * Derives Forward P/E and Revenue Multiple assumptions from the /api/financials
 * response (FinancialsData). Generalizes the logic in lib/ai-stack/valuation.ts
 * to work with any stock, not just AI Stack companies.
 *
 * Returns ValuationAssumption[] (for the drawer UI) + EvidenceItem[] (for derivation text).
 */

import type { ValuationAssumption, EvidenceItem, AssumptionSource } from '@/components/valuation/ValuationModelDrawer'
import { VALUATION_CONFIG } from '@/config/valuation.config'
import { getIndustryMultiples } from '@/lib/dcf/calculateMultiples'

// ─── Sector CAGR fallback (when no analyst/historical data available) ─────────

const SECTOR_CAGR: Record<string, number> = {
  'Technology':             0.12,
  'Communication Services': 0.08,
  'Consumer Cyclical':      0.07,
  'Consumer Defensive':     0.04,
  'Healthcare':             0.08,
  'Financial Services':     0.06,
  'Industrials':            0.05,
  'Basic Materials':        0.04,
  'Energy':                 0.03,
  'Utilities':              0.03,
  'Real Estate':            0.05,
}

function pct(v: number): string { return (v * 100).toFixed(1) + '%' }

// ─── CAGR derivation ─────────────────────────────────────────────────────────

function deriveCagr(
  cagrAnalysis: CAGRAnalysisLike | null,
  sectorFallback: number,
): { cagr: number; evidence: string; source: AssumptionSource } {
  if (!cagrAnalysis) {
    return {
      cagr: sectorFallback,
      evidence: `No analyst or historical growth data · using sector default ${pct(sectorFallback)} (adjust manually in Valuation tab)`,
      source: 'sector_fallback',
    }
  }

  const blended = cagrAnalysis.blended ?? sectorFallback
  const numAnalysts = cagrAnalysis.numAnalysts ?? 0
  const source: AssumptionSource = numAnalysts >= 3 ? 'analyst_estimate' : 'historical_3y_median'

  const hist = cagrAnalysis.historicalCagr3y != null ? pct(cagrAnalysis.historicalCagr3y) : '—'
  const a1   = cagrAnalysis.analystEstimate1y != null ? pct(cagrAnalysis.analystEstimate1y) : '—'
  const a2   = cagrAnalysis.analystEstimate2y != null ? pct(cagrAnalysis.analystEstimate2y) : '—'
  const confidence = cagrAnalysis.confidenceLabel ?? 'Low'

  const evidence = numAnalysts >= 3
    ? `${numAnalysts} analysts: FY+1 ${a1}, FY+2 ${a2}; hist 3Y ${hist} → blended ${pct(blended)} (${confidence} confidence)`
    : `Historical 3Y CAGR ${hist}; analyst coverage limited → ${pct(blended)} (${confidence} confidence)`

  return { cagr: blended, evidence, source }
}

// ─── Net margin derivation ────────────────────────────────────────────────────

function deriveNetMargin(
  incomeStatement: IncomeRow[],
): { margin: number; evidence: string; source: AssumptionSource } {
  const actuals = incomeStatement.filter(r => !r.isProjected)
  const withBoth = actuals.filter(r => r.netIncome != null && r.revenue != null && r.revenue > 0)
  if (withBoth.length === 0) {
    return {
      margin: 0.05,
      evidence: 'No net income data → fallback 5% margin',
      source: 'sector_fallback',
    }
  }

  const margins = withBoth.map(r => r.netIncome! / r.revenue!)
  const median  = margins.sort((a, b) => a - b)[Math.floor(margins.length / 2)]
  const last    = margins[margins.length - 1]
  const source: AssumptionSource = withBoth.length >= 3 ? 'historical_3y_median' : 'historical_5y_median'

  const grossMargins = actuals.filter(r => r.grossProfit != null && r.revenue != null && r.revenue > 0)
  const lastGM = grossMargins.length > 0 ? (grossMargins[grossMargins.length - 1].grossProfit! / grossMargins[grossMargins.length - 1].revenue!) : null

  const isHighGrowth = margins.length >= 2 && (last - margins[0]) / Math.abs(margins[0] || 1) > 0.02
  const hasMoat      = lastGM != null && lastGM > 0.40
  const improvement  = (isHighGrowth && hasMoat) ? 0.03 : (isHighGrowth || hasMoat) ? 0.015 : 0.005

  let projectedMargin: number
  let reason: string

  if (last <= 0) {
    projectedMargin = lastGM != null && lastGM >= 0.50 ? 0.08
                    : lastGM != null && lastGM >= 0.30 ? 0.05
                    : 0.03
    reason = `Pre-profit (${pct(last)}) → path to ${pct(projectedMargin)} via gross margin`
  } else {
    projectedMargin = Math.max(0.01, Math.min(0.50, last + improvement))
    reason = isHighGrowth && hasMoat ? `high growth + moat (+3%)`
           : isHighGrowth            ? `improving trend (+1.5%)`
           : hasMoat                 ? `strong gross margin (+1.5%)`
           : `stable (+0.5%)`
    reason = `${pct(last)} trailing → ${pct(projectedMargin)} (${reason})`
  }

  return {
    margin: projectedMargin,
    evidence: `${withBoth.length}Y median ${pct(median)}, last ${pct(last)}; ${reason}`,
    source,
  }
}

// ─── Exit P/E derivation ─────────────────────────────────────────────────────

function deriveExitPE(
  sector: string | null,
  industry: string | null,
  currentPE: number | null,
): { pe: number; evidence: string; source: AssumptionSource } {
  const { pe: target, source } = getIndustryMultiples(industry ?? '', sector ?? '')
  const label = industry || sector || 'unknown'
  const companyPEStr = currentPE != null && currentPE > 0 ? `${currentPE.toFixed(0)}×` : 'N/A'
  const evidence = `Damodaran median: ${target}× (${label}); company current P/E: ${companyPEStr}`
  return { pe: target, evidence, source: source === 'industry-median' ? 'historical_3y_median' : 'sector_fallback' }
}

// ─── Dilution derivation ─────────────────────────────────────────────────────

function deriveDilution(
  sector: string | null,
  netMargin: number | null,
): { rate: number; evidence: string; source: AssumptionSource } {
  const sec = sector ?? ''
  const isTech = ['Technology', 'Communication Services', 'Healthcare'].includes(sec)

  let rate: number
  let reason: string
  if (isTech) {
    if (netMargin != null && netMargin > 0.20) { rate = 0.010; reason = 'tech, profitable → ~1.0%/yr (buybacks offset)' }
    else if (netMargin != null && netMargin > 0.10) { rate = 0.020; reason = 'tech, moderate margin → ~2.0%/yr' }
    else { rate = 0.030; reason = 'tech, growth stage → ~3.0%/yr (stock-based comp)' }
  } else {
    rate = netMargin != null && netMargin > 0.15 ? 0.005 : 0.010
    reason = `${sec || 'non-tech'} → ~${pct(rate)}/yr`
  }

  return { rate, evidence: reason, source: 'model_default' }
}

// ─── WACC evidence text ───────────────────────────────────────────────────────

function deriveWACCEvidence(waccInputs: WACCInputsLike, wacc: number): string {
  const { rfRate = 0.045, beta = 1.0, erp = VALUATION_CONFIG.erp, costOfDebt, debtToEquity } = waccInputs
  const wtEq  = debtToEquity != null ? `D/E ${(debtToEquity * 100).toFixed(0)}%` : ''
  const codStr = costOfDebt != null ? `, CoD ${pct(costOfDebt)}` : ''
  return `Beta ${beta.toFixed(2)}, RF ${pct(rfRate)}, ERP ${pct(erp)}${codStr}${wtEq ? ', ' + wtEq : ''} → WACC ${pct(wacc)}`
}

// ─── LTM Revenue ─────────────────────────────────────────────────────────────

function ltmRevenue(incomeStatement: IncomeRow[]): number | null {
  const actuals = incomeStatement.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
  if (actuals.length === 0) return null
  return actuals[actuals.length - 1].revenue!
}

// ─── Type shapes (subset of FinancialsData needed here) ──────────────────────

interface IncomeRow {
  year: string
  isProjected: boolean
  revenue: number | null
  netIncome: number | null
  grossProfit: number | null
}

interface CAGRAnalysisLike {
  blended: number
  historicalCagr3y: number | null
  analystEstimate1y: number | null
  analystEstimate2y: number | null
  confidenceLabel?: 'High' | 'Medium' | 'Low'
  numAnalysts?: number
}

interface WACCInputsLike {
  rfRate?: number
  beta?: number
  erp?: number
  costOfDebt?: number
  taxRate?: number
  debtToEquity?: number
}

export interface DerivedForwardPEAssumptions {
  ltvRevenue: number | null
  sharesOutstanding: number | null
  revenueCAGR: number
  netMargin: number
  exitPE: number
  dilutionRate: number
  discountRate: number
  currentPrice: number
  dividendYield: number | null
  assumptions: ValuationAssumption[]
  evidence: EvidenceItem[]
}

export interface DerivedRevenueMultipleAssumptions {
  ltvRevenue: number | null
  sharesOutstanding: number | null
  revenueCAGR: number
  exitEVRevenue: number
  netDebt: number | null
  dilutionRate: number
  discountRate: number
  currentPrice: number
  dividendYield: number | null
  assumptions: ValuationAssumption[]
  evidence: EvidenceItem[]
}

// ─── Main exports ─────────────────────────────────────────────────────────────

export function deriveForwardPEAssumptions(data: {
  quote: { price: number; sector?: string | null; industry?: string | null; peRatio?: number | null; currency?: string }
  wacc: { wacc: number; inputs: WACCInputsLike }
  cagrAnalysis: CAGRAnalysisLike | null
  fairValue: { sharesOutstanding: number | null }
  financialStatements?: { incomeStatement: IncomeRow[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}): DerivedForwardPEAssumptions {
  const sector       = data.quote?.sector ?? null
  const industry     = data.quote?.industry ?? null
  const currentPrice = data.quote?.price ?? 0
  const wacc         = data.wacc?.wacc ?? 0.10
  const shares       = data.fairValue?.sharesOutstanding ?? null
  const incomeRows   = data.financialStatements?.incomeStatement ?? []

  const sectorFallback = SECTOR_CAGR[sector ?? ''] ?? 0.07

  const cagrDerived     = deriveCagr(data.cagrAnalysis, sectorFallback)
  const marginDerived   = deriveNetMargin(incomeRows)
  const peDerived       = deriveExitPE(sector, industry, data.quote?.peRatio ?? null)
  const dilutionDerived = deriveDilution(sector, marginDerived.margin)
  const waccEvidence    = deriveWACCEvidence(data.wacc?.inputs ?? {}, wacc)
  const ltmRev          = ltmRevenue(incomeRows)

  const assumptions: ValuationAssumption[] = [
    {
      key: 'ltvRevenue', label: 'LTM Revenue', editable: false,
      value: ltmRev, unit: '$', source: 'historical_3y_median',
    },
    {
      key: 'sharesOutstanding', label: 'Shares Outstanding', editable: false,
      value: shares, unit: 'shares', source: 'model_default',
    },
    {
      key: 'revenueCAGR', label: '5Y Revenue CAGR', description: 'Annual revenue growth rate',
      value: cagrDerived.cagr, unit: '%', min: -0.10, max: 1.00, step: 0.5,
      editable: true, source: cagrDerived.source, sourceExplanation: cagrDerived.evidence,
    },
    {
      key: 'netMargin', label: 'Net Margin (exit year)', description: 'Projected net profit margin',
      value: marginDerived.margin, unit: '%', min: -0.50, max: 0.70, step: 0.5,
      editable: true, source: marginDerived.source, sourceExplanation: marginDerived.evidence,
    },
    {
      key: 'exitPE', label: 'Exit P/E', description: 'Sector-normalized P/E multiple at exit',
      value: peDerived.pe, unit: 'x', min: 1, max: 100, step: 1,
      editable: true, source: peDerived.source, sourceExplanation: peDerived.evidence,
    },
    {
      key: 'dilutionRate', label: 'Annual Dilution', description: 'Stock-based comp / share count growth',
      value: dilutionDerived.rate, unit: '%', min: 0, max: 0.15, step: 0.5,
      editable: true, source: dilutionDerived.source, sourceExplanation: dilutionDerived.evidence,
    },
    {
      key: 'discountRate', label: 'Discount Rate (WACC)', description: 'Required return on equity + debt',
      value: wacc, unit: '%', min: 0.03, max: 0.30, step: 0.5,
      editable: true, source: 'model_default', sourceExplanation: waccEvidence,
    },
  ]

  const evidence: EvidenceItem[] = [
    { label: 'Revenue CAGR',     text: cagrDerived.evidence },
    { label: 'Net Margin',       text: marginDerived.evidence },
    { label: 'Exit P/E',         text: peDerived.evidence },
    { label: 'Share Dilution',   text: dilutionDerived.evidence },
    { label: 'WACC',             text: waccEvidence },
  ]

  return {
    ltvRevenue: ltmRev, sharesOutstanding: shares,
    revenueCAGR: cagrDerived.cagr, netMargin: marginDerived.margin,
    exitPE: peDerived.pe, dilutionRate: dilutionDerived.rate,
    discountRate: wacc, currentPrice,
    dividendYield: null,
    assumptions, evidence,
  }
}

export function deriveRevenueMultipleAssumptions(data: {
  quote: { price: number; sector?: string | null; industry?: string | null; currency?: string }
  wacc: { wacc: number; inputs: WACCInputsLike }
  cagrAnalysis: CAGRAnalysisLike | null
  fairValue: { sharesOutstanding: number | null; cash: number | null; debt: number | null }
  financialStatements?: { incomeStatement: IncomeRow[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}): DerivedRevenueMultipleAssumptions {
  const sector       = data.quote?.sector ?? null
  const industry     = data.quote?.industry ?? null
  const currentPrice = data.quote?.price ?? 0
  const wacc         = data.wacc?.wacc ?? 0.10
  const shares       = data.fairValue?.sharesOutstanding ?? null
  const incomeRows   = data.financialStatements?.incomeStatement ?? []

  const cagrDerived     = deriveCagr(data.cagrAnalysis, SECTOR_CAGR[sector ?? ''] ?? 0.07)
  const marginDerived   = deriveNetMargin(incomeRows)
  const dilutionDerived = deriveDilution(sector, marginDerived.margin)
  const waccEvidence    = deriveWACCEvidence(data.wacc?.inputs ?? {}, wacc)
  const ltmRev          = ltmRevenue(incomeRows)

  const { evRevenue: sectorEVRev, source: evRevBenchmarkSource } = getIndustryMultiples(industry ?? '', sector ?? '')
  const evRevSource: AssumptionSource = evRevBenchmarkSource === 'industry-median' ? 'historical_3y_median' : 'sector_fallback'
  const label = industry || sector || 'unknown'
  const multEstimates: Array<{ multiple: string; actualValue: number }> =
    (data as { valuationMethods?: { models?: { multiples?: { estimates?: unknown[] } } } })
      ?.valuationMethods?.models?.multiples?.estimates as Array<{ multiple: string; actualValue: number }> ?? []
  const actualEvRevenue = multEstimates.find(e => e.multiple === 'EV/Revenue')?.actualValue ?? null
  const companyEVRevStr = actualEvRevenue != null && actualEvRevenue > 0 ? `${actualEvRevenue.toFixed(1)}×` : 'N/A'
  const evRevEvidence   = `Damodaran median: ${sectorEVRev}× (${label}); company current EV/Revenue: ${companyEVRevStr}`

  const cashM    = data.fairValue?.cash ?? null
  const debtM    = data.fairValue?.debt ?? null
  // Fallback from balance sheet rows (already in millions, already FX-converted)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bsRow    = (data.financialStatements as any)?.balanceSheet?.find((r: { isProjected?: boolean }) => !r.isProjected)
  const cashBSM  = (bsRow?.cash  as number | null | undefined) ?? null
  const debtBSM  = (bsRow?.longTermDebt as number | null | undefined) ?? null
  const netDebt  = (cashM != null && debtM != null)
    ? (debtM - cashM) * 1e6
    : (cashBSM != null && debtBSM != null ? (debtBSM - cashBSM) * 1e6 : null)

  const assumptions: ValuationAssumption[] = [
    {
      key: 'ltvRevenue', label: 'LTM Revenue', editable: false,
      value: ltmRev, unit: '$', source: 'historical_3y_median',
    },
    {
      key: 'sharesOutstanding', label: 'Shares Outstanding', editable: false,
      value: shares, unit: 'shares', source: 'model_default',
    },
    {
      key: 'revenueCAGR', label: '5Y Revenue CAGR', description: 'Annual revenue growth rate',
      value: cagrDerived.cagr, unit: '%', min: -0.10, max: 1.00, step: 0.5,
      editable: true, source: cagrDerived.source, sourceExplanation: cagrDerived.evidence,
    },
    {
      key: 'exitEVRevenue', label: 'Exit EV/Revenue', description: 'Enterprise value multiple at exit year',
      value: sectorEVRev, unit: 'x', min: 0.5, max: 50, step: 0.5,
      editable: true, source: evRevSource as AssumptionSource, sourceExplanation: evRevEvidence,
    },
    {
      key: 'netDebt', label: 'Net Debt', description: 'Total debt minus cash (negative = net cash)',
      value: netDebt, unit: '$', editable: false,
      source: 'historical_3y_median',
    },
    {
      key: 'dilutionRate', label: 'Annual Dilution', description: 'Stock-based comp / share count growth',
      value: dilutionDerived.rate, unit: '%', min: 0, max: 0.15, step: 0.5,
      editable: true, source: dilutionDerived.source, sourceExplanation: dilutionDerived.evidence,
    },
    {
      key: 'discountRate', label: 'Discount Rate (WACC)', description: 'Required return on equity + debt',
      value: wacc, unit: '%', min: 0.03, max: 0.30, step: 0.5,
      editable: true, source: 'model_default', sourceExplanation: waccEvidence,
    },
  ]

  const evidence: EvidenceItem[] = [
    { label: 'Revenue CAGR',    text: cagrDerived.evidence },
    { label: 'EV/Revenue',      text: evRevEvidence },
    { label: 'Share Dilution',  text: dilutionDerived.evidence },
    { label: 'WACC',            text: waccEvidence },
  ]

  return {
    ltvRevenue: ltmRev, sharesOutstanding: shares,
    revenueCAGR: cagrDerived.cagr, exitEVRevenue: sectorEVRev,
    netDebt, dilutionRate: dilutionDerived.rate,
    discountRate: wacc, currentPrice,
    dividendYield: null,
    assumptions, evidence,
  }
}
