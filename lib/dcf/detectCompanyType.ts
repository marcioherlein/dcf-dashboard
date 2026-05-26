export type CompanyType = 'financial' | 'dividend' | 'growth' | 'startup' | 'standard' | 'etf'

export function detectCompanyType(input: {
  sector: string
  industry: string
  dividendYield: number | null
  payoutRatio: number | null
  historicalCagr3y: number
  analystEstimate1y: number
  isNegativeFCF: boolean
  revenueM: number
  quoteType?: string
}): CompanyType {
  const { sector, industry, dividendYield, payoutRatio, historicalCagr3y, analystEstimate1y, isNegativeFCF, revenueM, quoteType } = input
  const haystack = (sector + ' ' + industry).toLowerCase()

  // 0. ETF / fund: no DCF applicable
  if (quoteType === 'ETF' || quoteType === 'MUTUALFUND' || quoteType === 'INDEX') {
    return 'etf'
  }

  // 1. Financial: OCF is distorted by loan/fund flows — FCFE + DDM preferred
  if (/bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/.test(haystack)) {
    return 'financial'
  }

  // 2. Dividend: mature company with meaningful payout — DDM applicable
  if ((dividendYield ?? 0) > 0.01 && (payoutRatio ?? 0) > 0.20) {
    return 'dividend'
  }

  // 3. Startup: pre-profitability, small revenue — relative multiples most reliable
  if (isNegativeFCF && revenueM < 500) {
    return 'startup'
  }

  // 4. Growth: high-growth — FCFF + EV multiples
  if (historicalCagr3y > 0.20 || analystEstimate1y > 0.20) {
    return 'growth'
  }

  // 5. Standard: FCFF primary
  return 'standard'
}

export function primaryModelLabel(type: CompanyType, hasDividend: boolean): string {
  switch (type) {
    case 'etf':      return 'N/A — ETF / Fund'
    case 'financial': return hasDividend ? 'FCFE + DDM blend' : 'FCFE (Equity DCF)'
    case 'dividend':  return 'DDM + DCF blend'
    case 'growth':    return 'DCF (FCFF) + EV Multiples'
    case 'startup':   return 'Revenue Multiples + DCF'
    case 'standard':  return hasDividend ? 'DCF (FCFF) + DDM' : 'DCF (FCFF)'
  }
}

export function companyTypeLabel(type: CompanyType): string {
  switch (type) {
    case 'etf':      return 'ETF / Fund'
    case 'financial': return 'Financial'
    case 'dividend':  return 'Dividend'
    case 'growth':    return 'High Growth'
    case 'startup':   return 'Pre-Profit'
    case 'standard':  return 'Standard'
  }
}

export function companyTypeIntrinsico(type: CompanyType): string {
  switch (type) {
    case 'etf':
      return 'ETFs and funds are portfolios of assets, not operating companies. Intrinsic valuation models (DCF, DDM) are not applicable. Value is determined by the net asset value of underlying holdings.'
    case 'financial':
      return 'Banks, insurers, and fintechs have operating cash flows distorted by loan book changes and client fund flows. FCFE (using net income as the equity cash flow proxy) and DDM are preferred over FCFF for these companies.'
    case 'dividend':
      return 'Mature dividend payers are best valued with the Gordon Growth DDM, where the dividend stream represents the investor\'s direct cash return. FCFF DCF serves as a cross-check.'
    case 'growth':
      return 'High-growth companies are valued primarily on FCFF DCF with a high CAGR assumption. EV/EBITDA and EV/Revenue multiples provide a market-based sanity check against sector peers.'
    case 'startup':
      return 'Pre-profitability companies have speculative cash flows. Revenue-based multiples (P/S, EV/Revenue) reflect how the market is pricing growth potential. DCF uses a revenue-seeded FCF estimate.'
    case 'standard':
      return 'Standard companies are valued with FCFF DCF as the primary model. Relative multiples (P/E, EV/EBITDA) cross-check the intrinsic value against how peers are priced in the market.'
  }
}

// Damodaran 4-model DCF weights by company type.
// Variants: UFCF+PGM, UFCF+EM, LFCF+PGM, LFCF+EM.
// Source: Damodaran "Investment Valuation" §12–15.
export const FOUR_MODEL_DCF_WEIGHTS: Record<CompanyType, { ufcfPGM: number; ufcfEM: number; lfcfPGM: number; lfcfEM: number }> = {
  standard:  { ufcfPGM: 0.35, ufcfEM: 0.35, lfcfPGM: 0.15, lfcfEM: 0.15 },
  dividend:  { ufcfPGM: 0.40, ufcfEM: 0.25, lfcfPGM: 0.25, lfcfEM: 0.10 },
  growth:    { ufcfPGM: 0.30, ufcfEM: 0.40, lfcfPGM: 0.10, lfcfEM: 0.20 },
  startup:   { ufcfPGM: 0.20, ufcfEM: 0.50, lfcfPGM: 0.10, lfcfEM: 0.20 },
  financial: { ufcfPGM: 0.05, ufcfEM: 0.05, lfcfPGM: 0.45, lfcfEM: 0.45 },
  etf:       { ufcfPGM: 0.00, ufcfEM: 0.00, lfcfPGM: 0.00, lfcfEM: 0.00 },
}

export function getDCFModelRationale(type: CompanyType): string {
  switch (type) {
    case 'financial':
      return 'Levered DCF (LFCF/FCFE) dominates (90%) because operating cash flows for banks, insurers, and fintechs are distorted by loan book and fund flows. Unlevered FCF understates true equity value.'
    case 'dividend':
      return 'Unlevered perpetuity growth model leads (40%) — stable cash flows closely match Gordon Growth assumptions. Levered DCF adds a 35% cross-check.'
    case 'growth':
      return 'Exit multiples weighted more heavily (60%) because perpetuity growth rate assumptions become unreliable when near-term CAGR far exceeds the long-run stable rate.'
    case 'startup':
      return 'Predominantly exit multiple (70%) — perpetuity growth models are highly sensitive to terminal assumptions for companies still scaling toward profitability.'
    case 'standard':
      return 'Balanced equally between perpetuity growth and exit multiple for unlevered DCF (70%), with a 30% levered DCF cross-check for robustness.'
    case 'etf':
      return 'DCF does not apply to ETFs/funds. Value is determined by the net asset value of underlying holdings.'
  }
}

// Growth model selection per Damodaran's life-cycle framework:
// Three-stage (high growth → linear fade → terminal) applies when current growth >> stable growth.
// Two-stage (constant CAGR → terminal) applies when growth is already near sustainable levels.
import type { GrowthModel } from './projectCashFlows'

export function getGrowthModel(companyType: CompanyType, cagr: number): GrowthModel {
  if (companyType === 'growth' || companyType === 'startup') return 'three-stage'
  if (cagr > 0.15) return 'three-stage'
  return 'two-stage'
}

// Triangulation weights by company type
export function getModelWeights(type: CompanyType, hasDividend: boolean): {
  fcff: number; fcfe: number; ddm: number; multiples: number
} {
  switch (type) {
    case 'etf':
      return { fcff: 0.00, fcfe: 0.00, ddm: 0.00, multiples: 1.00 }
    case 'financial':
      return hasDividend
        ? { fcff: 0.05, fcfe: 0.50, ddm: 0.25, multiples: 0.20 }
        : { fcff: 0.05, fcfe: 0.65, ddm: 0.00, multiples: 0.30 }
    case 'dividend':
      return { fcff: 0.30, fcfe: 0.00, ddm: 0.50, multiples: 0.20 }
    case 'growth':
      return { fcff: 0.65, fcfe: 0.00, ddm: 0.00, multiples: 0.35 }
    case 'startup':
      return { fcff: 0.30, fcfe: 0.00, ddm: 0.00, multiples: 0.70 }
    case 'standard':
      return hasDividend
        ? { fcff: 0.55, fcfe: 0.00, ddm: 0.15, multiples: 0.30 }
        : { fcff: 0.65, fcfe: 0.00, ddm: 0.00, multiples: 0.35 }
  }
}
