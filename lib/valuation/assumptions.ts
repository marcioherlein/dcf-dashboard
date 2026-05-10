/**
 * assumptions.ts
 *
 * Derives default assumption values with provenance labels.
 * Source hierarchy: analyst → 3Y historical median → fallback constant.
 *
 * Returns an `AssumptionSet` that the `AssumptionPanel` component renders,
 * showing users where each number came from.
 */

export type AssumptionSource = 'analyst' | '3y_median' | 'model' | 'fallback'

export interface Assumption<T = number> {
  value: T
  source: AssumptionSource
  label: string      // human-readable source description (e.g. "Analyst consensus FY+1")
  editable: boolean
}

export interface AssumptionSet {
  cagr: Assumption
  terminalG: Assumption
  wacc: Assumption
  taxRate: Assumption
  exitMultiple: Assumption
  revenueGrowthByYear: Assumption[]  // one per projected year
  ebitMarginByYear: Assumption[]     // one per projected year
  capexPctRevByYear: Assumption[]    // one per projected year
  dnaGrowthRate: Assumption          // D&A as % of revenue, used for projection
  nwcPctRevenue: Assumption          // ΔNWC as % of revenue change (for projection)
}

export interface AssumptionInputs {
  cagr: number
  terminalG: number
  wacc: number
  taxRate: number
  analystEstimate1y: number | null
  analystEstimate2y: number | null
  historicalCagr3y: number | null
  fundamentalGrowth: number | null
  numProjectionYears: number
  // Historical data for medians
  historicalRevenues: number[]            // 3–4 actuals
  historicalEbitMargins: (number | null)[]
  historicalCapexPctRev: (number | null)[]
  historicalDnaPctRev: (number | null)[]
  historicalNwcPctRevChg: (number | null)[]
  companyType: 'standard' | 'growth' | 'financial' | 'dividend' | 'startup'
}

export function buildAssumptionSet(inputs: AssumptionInputs): AssumptionSet {
  const {
    cagr, terminalG, wacc, taxRate,
    analystEstimate1y, analystEstimate2y, historicalCagr3y,
    numProjectionYears,
    historicalEbitMargins, historicalCapexPctRev, historicalDnaPctRev, historicalNwcPctRevChg,
    companyType,
  } = inputs

  // CAGR source
  const cagrSource: AssumptionSource = analystEstimate1y != null ? 'analyst' : (historicalCagr3y != null ? '3y_median' : 'fallback')
  const cagrLabel = cagrSource === 'analyst'
    ? `Analyst consensus FY+1/FY+2 blend (${analystEstimate1y != null ? (analystEstimate1y * 100).toFixed(1) + '%' : 'N/A'} / ${analystEstimate2y != null ? (analystEstimate2y * 100).toFixed(1) + '%' : 'N/A'})`
    : cagrSource === '3y_median'
    ? `3-year historical CAGR (${historicalCagr3y != null ? (historicalCagr3y * 100).toFixed(1) + '%' : 'N/A'})`
    : 'Fallback constant (5%)'

  // Year-by-year revenue growth — blend from analyst estimates then fade to CAGR
  const revenueGrowthByYear: Assumption[] = []
  for (let i = 0; i < numProjectionYears; i++) {
    const isYear1 = i === 0
    const isYear2 = i === 1
    const src: AssumptionSource = isYear1 && analystEstimate1y != null ? 'analyst' : isYear2 && analystEstimate2y != null ? 'analyst' : cagrSource === '3y_median' ? '3y_median' : 'fallback'
    const val = isYear1 && analystEstimate1y != null ? analystEstimate1y : isYear2 && analystEstimate2y != null ? analystEstimate2y : cagr
    revenueGrowthByYear.push({
      value: val,
      source: src,
      label: src === 'analyst' ? `Analyst FY+${i + 1}` : `Blended CAGR`,
      editable: true,
    })
  }

  // EBIT margins — 3Y median of historical
  const validEbitMargins = historicalEbitMargins.filter((v): v is number => v != null)
  const medianEbitMargin = validEbitMargins.length > 0 ? median(validEbitMargins) : 0.15
  const ebitMarginSource: AssumptionSource = validEbitMargins.length >= 2 ? '3y_median' : 'fallback'
  const ebitMarginByYear: Assumption[] = Array.from({ length: numProjectionYears }, (_, i) => ({
    value: Math.min(medianEbitMargin + i * 0.002, medianEbitMargin * 1.15), // slight expansion
    source: ebitMarginSource,
    label: ebitMarginSource === '3y_median' ? `3Y median EBIT margin ${(medianEbitMargin * 100).toFixed(1)}%` : 'Fallback margin',
    editable: true,
  }))

  // CapEx / Revenue
  const validCapex = historicalCapexPctRev.filter((v): v is number => v != null)
  const medianCapex = validCapex.length > 0 ? median(validCapex) : -0.05
  const capexPctRevByYear: Assumption[] = Array.from({ length: numProjectionYears }, () => ({
    value: medianCapex,
    source: (validCapex.length >= 2 ? '3y_median' : 'fallback') as AssumptionSource,
    label: `3Y median CapEx/Rev ${(Math.abs(medianCapex) * 100).toFixed(1)}%`,
    editable: true,
  }))

  // D&A growth rate
  const validDna = historicalDnaPctRev.filter((v): v is number => v != null)
  const medianDna = validDna.length > 0 ? median(validDna) : 0.04
  const dnaGrowthRate: Assumption = {
    value: medianDna,
    source: validDna.length >= 2 ? '3y_median' : 'fallback',
    label: `3Y median D&A/Rev ${(medianDna * 100).toFixed(1)}%`,
    editable: true,
  }

  // NWC % revenue change
  const validNwc = historicalNwcPctRevChg.filter((v): v is number => v != null)
  const medianNwc = validNwc.length > 0 ? median(validNwc) : 0.02
  const nwcPctRevenue: Assumption = {
    value: medianNwc,
    source: validNwc.length >= 2 ? '3y_median' : 'fallback',
    label: `3Y median ΔNWC/ΔRev ${(medianNwc * 100).toFixed(1)}%`,
    editable: true,
  }

  // Terminal growth
  const terminalGSource: AssumptionSource = 'model'
  const terminalGLabel = terminalG > 0.025
    ? `Model (${(terminalG * 100).toFixed(1)}%) — above typical long-run GDP`
    : `Model (${(terminalG * 100).toFixed(1)}%) — within typical long-run GDP range`

  // Exit multiple — sector-based default
  const defaultExitMultiple = getDefaultExitMultiple(companyType)
  const exitMultiple: Assumption = {
    value: defaultExitMultiple,
    source: 'fallback',
    label: `Sector default (${companyType}) — ${defaultExitMultiple}x FCF`,
    editable: true,
  }

  return {
    cagr: { value: cagr, source: cagrSource, label: cagrLabel, editable: true },
    terminalG: { value: terminalG, source: terminalGSource, label: terminalGLabel, editable: true },
    wacc: { value: wacc, source: 'model', label: 'CAPM + WACC (computed)', editable: true },
    taxRate: { value: taxRate, source: 'model', label: 'From financial statements', editable: false },
    exitMultiple,
    revenueGrowthByYear,
    ebitMarginByYear,
    capexPctRevByYear,
    dnaGrowthRate,
    nwcPctRevenue,
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function getDefaultExitMultiple(companyType: AssumptionInputs['companyType']): number {
  switch (companyType) {
    case 'growth':   return 25
    case 'startup':  return 20
    case 'financial': return 12
    case 'dividend': return 15
    default:         return 18
  }
}
