export type CompanyType = 'financial' | 'dividend' | 'growth' | 'startup' | 'standard' | 'etf' | 'reit' | 'utility' | 'energy' | 'mining' | 'fintech' | 'alt_asset' | 'mreeit' | 'bdc'

const MINING_INDUSTRIES = new Set([
  'Gold', 'Silver', 'Copper', 'Coal', 'Uranium',
  'Other Precious Metals & Mining', 'Aluminum', 'Steel',
  'Bitcoin Mining', 'Crypto Mining', 'Digital Mining', 'Blockchain Infrastructure',
])

export function detectCompanyType(input: {
  sector: string
  industry: string
  dividendYield: number | null
  payoutRatio: number | null
  historicalCagr3y: number | null
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
    // 1a. Mortgage REITs: interest-rate spread businesses — P/B method, not P/FFO
    if (/REIT.*mortgage|mortgage.*REIT|mREIT/i.test(industry)) return 'mreeit'

    // 1b. BDCs: by law distribute 90%+ of income — DDM/income model
    if (/business development|BDC/i.test(industry)) return 'bdc'

    // 1c. Alt-asset managers (Blackstone, KKR, Apollo, Ares): fee-related earnings model
    if (/capital market|alternative asset|private equity|asset management/i.test(industry) &&
        !(/bank|insurance|credit|lending/i.test(industry))) return 'alt_asset'

    // 1d. High-growth financial companies (neobanks, digital lenders, fintech platforms) —
    // Yahoo often labels them "Banks - Regional" or "Credit Services" despite 25%+ revenue CAGR.
    // Growth-stage digital finance is fundamentally different from a mature regional bank:
    // it should use fintech exit multiples (25–35×) not bank multiples (10–14×).
    if ((historicalCagr3y ?? 0) > 0.20 || (analystEstimate1y ?? 0) > 0.20) return 'fintech'

    return 'financial'
  }

  // 1b. REIT: P/FFO is the standard method; P/E is distorted by real estate depreciation
  // Mortgage REITs are routed to 'mreeit' above (financial sector check fires first)
  if (/REIT/i.test(industry) || (sector === 'Real Estate' && !/services/i.test(industry))) {
    return 'reit'
  }

  // 1c. Utility: DDM is appropriate; stable regulated cash flows with high payout ratios
  if (sector === 'Utilities') {
    return 'utility'
  }

  // 1d. Energy: commodity-cycle revenue; CAGR capped to avoid cyclical over-projection
  if (sector === 'Energy') {
    return 'energy'
  }

  // 1e. Mining: commodity prices drive reported revenue; same CAGR cap as energy
  if (sector === 'Basic Materials' && MINING_INDUSTRIES.has(industry)) {
    return 'mining'
  }

  // 1f. Crypto/Bitcoin mining: revenue is Bitcoin-price-denominated, not a technology business.
  // Yahoo often classifies miners under Technology or Financial Services, but the economics
  // are commodity-like (hash rate as "production capacity", BTC price as the commodity).
  // Use 'mining' type so energy-style EV/EBITDA + exit multiple weighting applies and
  // the 8% cyclical CAGR cap prevents peak-cycle extrapolation.
  if (/bitcoin.*min|crypto.*min|digital.*min|blockchain.*min|BTC.*min|min.*bitcoin|min.*crypto/i.test(haystack) ||
      /bitcoin mining|crypto mining|digital mining|blockchain infrastructure/i.test(industry)) {
    return 'mining'
  }

  // 2. Dividend: mature company with meaningful payout — DDM applicable
  // MLPs and royalty trusts: high-distribution income vehicles — route to dividend for DDM weighting
  if (/MLP|master limited partnership|royalty trust|income trust/i.test(industry)) {
    return 'dividend'
  }
  if ((dividendYield ?? 0) > 0.01 && (payoutRatio ?? 0) > 0.20) {
    return 'dividend'
  }

  // 3. Startup: pre-profitability, small revenue — relative multiples most reliable
  if (isNegativeFCF && revenueM < 500) {
    return 'startup'
  }

  // 4. Growth: high-growth — FCFF + EV multiples
  if ((historicalCagr3y ?? 0) > 0.20 || analystEstimate1y > 0.20) {
    return 'growth'
  }

  // 5. Standard: FCFF primary
  return 'standard'
}

export function primaryModelLabel(type: CompanyType, hasDividend: boolean): string {
  switch (type) {
    case 'etf':       return 'N/A — ETF / Fund'
    case 'financial': return hasDividend ? 'FCFE + DDM blend' : 'FCFE (Equity DCF)'
    case 'fintech':   return 'FCFE + Revenue Multiple'
    case 'alt_asset': return 'Fee-Related Earnings Multiple'
    case 'mreeit':    return 'P/B (Book Value) + DDM'
    case 'bdc':       return 'DDM (Net Investment Income)'
    case 'reit':      return 'P/FFO + Core DCF'
    case 'utility':   return 'DDM + DCF blend'
    case 'energy':    return 'EV/EBITDA + DCF (FCFF)'
    case 'mining':    return 'EV/EBITDA + DCF (FCFF)'
    case 'dividend':  return 'DDM + DCF blend'
    case 'growth':    return 'DCF (FCFF) + EV Multiples'
    case 'startup':   return 'Revenue Multiples + DCF'
    case 'standard':  return hasDividend ? 'DCF (FCFF) + DDM' : 'DCF (FCFF)'
  }
}

export function companyTypeLabel(type: CompanyType): string {
  switch (type) {
    case 'etf':       return 'ETF / Fund'
    case 'financial': return 'Financial'
    case 'fintech':   return 'Fintech'
    case 'alt_asset': return 'Alt Asset Mgr'
    case 'mreeit':    return 'Mortgage REIT'
    case 'bdc':       return 'BDC'
    case 'reit':      return 'REIT'
    case 'utility':   return 'Utility'
    case 'energy':    return 'Energy'
    case 'mining':    return 'Mining'
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
    case 'fintech':
      return 'High-growth digital finance companies (neobanks, payments, credit platforms) are valued on FCFE DCF and revenue multiples. P/E is de-emphasized while margins are still scaling toward maturity.'
    case 'alt_asset':
      return 'Alternative asset managers (Blackstone, KKR, Apollo) derive value from Fee-Related Earnings (FRE) and carried interest, not from free cash flow. A FRE multiple (15–25×) and P/E on distributable earnings are the primary valuation anchors.'
    case 'mreeit':
      return 'Mortgage REITs earn net interest spread on agency/non-agency MBS. Real estate depreciation is irrelevant — P/B (book value) and DDM are the correct frameworks, as earnings are driven by leverage, spread compression, and book value changes.'
    case 'bdc':
      return 'Business Development Companies by law distribute 90%+ of net investment income. DDM (Gordon Growth on distributions) and P/B on net asset value (NAV) are the primary models. FCF-based DCF overstates value since distributions are legally mandated.'
    case 'reit':
      return 'REITs must distribute 90%+ of taxable income, making real estate depreciation distort net income. Price/FFO (Funds From Operations = NI + D&A − property gains) is the industry standard. Core DCF anchors the range.'
    case 'utility':
      return 'Regulated utilities have predictable cash flows and high, stable dividend payout ratios. Gordon Growth DDM is the theoretically correct model. DCF provides a cross-check on the discounted cash flow basis.'
    case 'energy':
      return 'Energy companies\' revenue is driven by commodity price cycles. Historical CAGR is capped at 8% to prevent cycle peaks from inflating 5-year projections. EV/EBITDA is preferred over P/E due to heavy depreciation in upstream assets.'
    case 'mining':
      return 'Mining revenues track commodity prices. Same cyclical CAGR cap as Energy (8%). EV/EBITDA accounts for the capital-intensive, depreciation-heavy nature of mining operations better than P/E.'
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
  fintech:   { ufcfPGM: 0.05, ufcfEM: 0.10, lfcfPGM: 0.40, lfcfEM: 0.45 },  // LFCF-dominant; UFCF-EM for revenue exit
  alt_asset: { ufcfPGM: 0.10, ufcfEM: 0.15, lfcfPGM: 0.35, lfcfEM: 0.40 },  // FRE-based levered
  mreeit:    { ufcfPGM: 0.05, ufcfEM: 0.05, lfcfPGM: 0.50, lfcfEM: 0.40 },  // almost pure LFCF (spread business)
  bdc:       { ufcfPGM: 0.05, ufcfEM: 0.05, lfcfPGM: 0.50, lfcfEM: 0.40 },  // net investment income driven
  reit:      { ufcfPGM: 0.20, ufcfEM: 0.30, lfcfPGM: 0.25, lfcfEM: 0.25 },
  utility:   { ufcfPGM: 0.35, ufcfEM: 0.25, lfcfPGM: 0.20, lfcfEM: 0.20 },
  energy:    { ufcfPGM: 0.25, ufcfEM: 0.45, lfcfPGM: 0.15, lfcfEM: 0.15 },
  mining:    { ufcfPGM: 0.25, ufcfEM: 0.45, lfcfPGM: 0.15, lfcfEM: 0.15 },
  etf:       { ufcfPGM: 0.00, ufcfEM: 0.00, lfcfPGM: 0.00, lfcfEM: 0.00 },
}

export function getDCFModelRationale(type: CompanyType): string {
  switch (type) {
    case 'financial':
      return 'Levered DCF (LFCF/FCFE) dominates (90%) because operating cash flows for banks, insurers, and fintechs are distorted by loan book and fund flows. Unlevered FCF understates true equity value.'
    case 'fintech':
      return 'LFCF-dominant (85%) because digital finance margins are still scaling. FCFE (equity DCF) captures the compounding effect of growing net income better than UFCF for companies reinvesting in user acquisition.'
    case 'alt_asset':
      return 'LFCF-dominant (75%) anchored on distributable earnings (fee-related earnings + realized carry). UFCF overstates value for managers whose revenue is mark-to-market fund performance, not cash generation.'
    case 'mreeit':
      return 'Almost entirely LFCF (90%) — mortgage REITs are levered spread vehicles. Book value and net interest income drive returns. UFCF is essentially meaningless; equity DCF on NII distributions is the correct lens.'
    case 'bdc':
      return 'LFCF-dominant (90%) — BDCs must distribute 90%+ of net investment income by law. Equity cash flows (NII-based FCFE) and DDM dominate. UFCF is not applicable for a regulated investment vehicle.'
    case 'reit':
      return 'Balanced split between exit multiple and perpetuity growth for both levered and unlevered — REITs\' regulated income streams make both approaches valid. P/FFO is the primary method outside DCF.'
    case 'utility':
      return 'Gordon Growth DDM is primary for regulated utilities with stable, high payout ratios. DCF uses perpetuity growth model (35%) because dividends closely approximate free cash flow for regulated utilities.'
    case 'energy':
      return 'Exit multiples dominate (60%) because commodity-cycle CAGRs make terminal growth rate assumptions unreliable. EV/EBITDA exit multiple is more stable across the commodity cycle.'
    case 'mining':
      return 'Same as energy: exit multiples dominate (60%) due to commodity price cycle distortions in long-run growth rate assumptions.'
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
  if (companyType === 'growth' || companyType === 'startup' || companyType === 'fintech') return 'three-stage'
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
    case 'fintech':
      return { fcff: 0.05, fcfe: 0.55, ddm: 0.00, multiples: 0.40 }
    case 'alt_asset':
      return { fcff: 0.10, fcfe: 0.45, ddm: 0.15, multiples: 0.30 }
    case 'mreeit':
      return { fcff: 0.05, fcfe: 0.40, ddm: 0.40, multiples: 0.15 }
    case 'bdc':
      return { fcff: 0.05, fcfe: 0.30, ddm: 0.50, multiples: 0.15 }
    case 'reit':
      return { fcff: 0.30, fcfe: 0.00, ddm: 0.00, multiples: 0.70 }
    case 'utility':
      return { fcff: 0.30, fcfe: 0.00, ddm: 0.50, multiples: 0.20 }
    case 'energy':
      return { fcff: 0.50, fcfe: 0.00, ddm: 0.00, multiples: 0.50 }
    case 'mining':
      return { fcff: 0.50, fcfe: 0.00, ddm: 0.00, multiples: 0.50 }
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
