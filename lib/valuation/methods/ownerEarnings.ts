/**
 * Owner Earnings (Warren Buffett)
 *
 * Owner Earnings = Net Income + D&A − Maintenance CapEx
 *
 * Buffett's insight: reported earnings overstate distributable cash for
 * capital-intensive businesses that must continually reinvest just to
 * maintain competitive position. D&A is added back (non-cash), then
 * maintenance CapEx is subtracted (the real cost of staying in business).
 *
 * The Owner Earnings / Net Income ratio is the capital intensity signal:
 * — > 0.85: Asset-light (fabless, software, payments)
 * — 0.55–0.85: Moderate CapEx
 * — < 0.55: Capital-intensive (fabs, manufacturing, mining, energy)
 */

export interface OwnerEarningsInputs {
  netIncomeM: number | null               // current net income in $M
  normalizedNetIncomeM: number | null     // 5-year average net income in $M
  depreciationAmortizationM: number | null // D&A in $M (positive value)
  capitalExpendituresM: number | null     // CapEx in $M (may be negative — sign normalized internally)
  maintenanceCapexRatio: number           // 0.70 default (70% of total CapEx = maintenance)
  wacc: number
  terminalG: number
  marketCapM: number | null               // market cap in $M
  sharesM: number                         // shares in millions
  currentPrice: number
  currentEPS: number | null              // for cyclicality detection
  normalizedEPS: number | null
}

export interface OwnerEarningsResult {
  ownerEarningsM: number | null
  ownerEarningsFVPerShare: number | null
  ownerEarningsYield: number | null
  ownerEarningsToNetIncomeRatio: number | null  // OE / NI — capital intensity gauge
  isAssetLight: boolean
  isCapitalIntensive: boolean
  capitalIntensityLabel: string
  upsidePct: number | null
  isNormalized: boolean
  isCyclical: boolean
  guardErrors: string[]
}

export function computeOwnerEarnings(inputs: OwnerEarningsInputs): OwnerEarningsResult {
  const {
    netIncomeM, normalizedNetIncomeM, depreciationAmortizationM,
    capitalExpendituresM, maintenanceCapexRatio,
    wacc, terminalG, marketCapM, sharesM, currentPrice,
    currentEPS, normalizedEPS,
  } = inputs

  const isCyclical = (
    currentEPS != null && normalizedEPS != null && normalizedEPS !== 0 &&
    Math.abs((currentEPS - normalizedEPS) / Math.abs(normalizedEPS)) > 0.50
  )
  const isNormalized = isCyclical && normalizedNetIncomeM != null
  const effectiveNetIncome = isNormalized ? normalizedNetIncomeM : netIncomeM

  // Normalize CapEx to positive magnitude regardless of sign convention
  const capexAbs = capitalExpendituresM != null ? Math.abs(capitalExpendituresM) : null
  const maintenanceCapex = capexAbs != null ? capexAbs * maintenanceCapexRatio : 0
  const dna = depreciationAmortizationM != null ? Math.abs(depreciationAmortizationM) : 0

  const errors: string[] = []
  if (effectiveNetIncome == null) errors.push('Net income unavailable')

  if (effectiveNetIncome == null) {
    return {
      ownerEarningsM: null, ownerEarningsFVPerShare: null, ownerEarningsYield: null,
      ownerEarningsToNetIncomeRatio: null, isAssetLight: false, isCapitalIntensive: false,
      capitalIntensityLabel: 'Unknown', upsidePct: null, isNormalized, isCyclical, guardErrors: errors,
    }
  }

  const ownerEarningsM = effectiveNetIncome + dna - maintenanceCapex

  // Capital intensity ratio
  const ratio = effectiveNetIncome !== 0 ? ownerEarningsM / effectiveNetIncome : null
  const isAssetLight = ratio != null && ratio >= 0.85
  const isCapitalIntensive = ratio != null && ratio < 0.55
  const capitalIntensityLabel = isAssetLight
    ? 'Asset-light'
    : isCapitalIntensive
      ? 'Capital-intensive'
      : 'Moderate CapEx'

  // Fair value: perpetuity capitalization OE / (WACC − g)
  const spread = wacc - terminalG
  let ownerEarningsFVPerShare: number | null = null
  if (spread > 0.01 && sharesM > 0 && ownerEarningsM > 0) {
    ownerEarningsFVPerShare = (ownerEarningsM / spread) / sharesM
  }

  const ownerEarningsYield = (marketCapM != null && marketCapM > 0)
    ? ownerEarningsM / marketCapM
    : null

  const upsidePct = (ownerEarningsFVPerShare != null && currentPrice > 0)
    ? (ownerEarningsFVPerShare - currentPrice) / currentPrice
    : null

  return {
    ownerEarningsM, ownerEarningsFVPerShare, ownerEarningsYield,
    ownerEarningsToNetIncomeRatio: ratio,
    isAssetLight, isCapitalIntensive, capitalIntensityLabel,
    upsidePct, isNormalized, isCyclical, guardErrors: [],
  }
}
