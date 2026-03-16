export type CompanyType = 'financial' | 'dividend' | 'growth' | 'startup' | 'standard'

export function detectCompanyType(input: {
  sector: string
  industry: string
  dividendYield: number | null
  payoutRatio: number | null
  historicalCagr3y: number
  analystEstimate1y: number
  isNegativeFCF: boolean
  revenueM: number
}): CompanyType {
  const { sector, industry, dividendYield, payoutRatio, historicalCagr3y, analystEstimate1y, isNegativeFCF, revenueM } = input
  const haystack = (sector + ' ' + industry).toLowerCase()

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
    case 'financial': return hasDividend ? 'FCFE + DDM blend' : 'FCFE (Equity DCF)'
    case 'dividend':  return 'DDM + DCF blend'
    case 'growth':    return 'DCF (FCFF) + EV Multiples'
    case 'startup':   return 'Revenue Multiples + DCF'
    case 'standard':  return hasDividend ? 'DCF (FCFF) + DDM' : 'DCF (FCFF)'
  }
}

export function companyTypeLabel(type: CompanyType): string {
  switch (type) {
    case 'financial': return 'Financial'
    case 'dividend':  return 'Dividend'
    case 'growth':    return 'High Growth'
    case 'startup':   return 'Pre-Profit'
    case 'standard':  return 'Standard'
  }
}

export function companyTypeRationale(type: CompanyType): string {
  switch (type) {
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

// Triangulation weights by company type
export function getModelWeights(type: CompanyType, hasDividend: boolean): {
  fcff: number; fcfe: number; ddm: number; multiples: number
} {
  switch (type) {
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
