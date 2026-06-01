/**
 * Earnings Power Value (Greenwald)
 *
 * EPV = NOPAT / WACC
 * NOPAT = EBIT × (1 − taxRate)
 *
 * Assumes zero growth — shows what the business earns today
 * if it simply maintains current operations. The gap between
 * EPV and current price is the growth premium you are paying.
 */

export interface EPVInputs {
  operatingIncomeM: number | null         // EBIT in $M (current year)
  normalizedOperatingIncomeM: number | null // 5-year average EBIT in $M
  taxRate: number                          // e.g. 0.21
  wacc: number                             // e.g. 0.10
  netDebtM: number                         // total debt − cash in $M
  sharesM: number                          // shares in millions
  currentPrice: number
  currentEPS: number | null               // for cyclicality detection
  normalizedEPS: number | null            // 5-year average EPS
}

export interface EPVResult {
  nopat: number | null                    // current NOPAT in $M
  normalizedNopat: number | null          // normalized NOPAT in $M
  effectiveNopat: number | null           // which was used
  epvPerShare: number | null
  upsidePct: number | null
  growthPremiumPct: number | null         // (price − EPV) / price — what you pay for growth
  isNormalized: boolean                   // true if normalized inputs were used
  isCyclical: boolean                     // current deviates >50% from normalized
  cyclicalWarning: string | null
  guardErrors: string[]
}

export function computeEPV(inputs: EPVInputs): EPVResult {
  const {
    operatingIncomeM, normalizedOperatingIncomeM, taxRate, wacc,
    netDebtM, sharesM, currentPrice, currentEPS, normalizedEPS,
  } = inputs

  const isCyclical = (
    currentEPS != null && normalizedEPS != null && normalizedEPS !== 0 &&
    Math.abs((currentEPS - normalizedEPS) / Math.abs(normalizedEPS)) > 0.50
  )

  const cyclicalWarning = isCyclical
    ? `Current earnings appear ${currentEPS! > normalizedEPS! ? 'above' : 'below'} 5Y average — using normalized figures for EPV.`
    : null

  const nopat = operatingIncomeM != null ? operatingIncomeM * (1 - taxRate) : null
  const normalizedNopat = normalizedOperatingIncomeM != null ? normalizedOperatingIncomeM * (1 - taxRate) : null
  const isNormalized = isCyclical && normalizedNopat != null
  const effectiveNopat = isNormalized ? normalizedNopat : nopat

  const errors: string[] = []
  if (effectiveNopat == null) errors.push('Operating income unavailable')
  else if (effectiveNopat <= 0) errors.push('NOPAT is negative or zero — EPV not applicable')
  if (wacc <= 0) errors.push('WACC must be positive')

  if (errors.length > 0 || effectiveNopat == null || effectiveNopat <= 0) {
    return {
      nopat, normalizedNopat, effectiveNopat: effectiveNopat ?? null,
      epvPerShare: null, upsidePct: null, growthPremiumPct: null,
      isNormalized, isCyclical, cyclicalWarning, guardErrors: errors,
    }
  }

  const epvEnterpriseM = effectiveNopat / wacc
  const epvEquityM = epvEnterpriseM - netDebtM
  const epvPerShare = sharesM > 0 ? epvEquityM / sharesM : null

  if (epvPerShare == null) {
    return {
      nopat, normalizedNopat, effectiveNopat,
      epvPerShare: null, upsidePct: null, growthPremiumPct: null,
      isNormalized, isCyclical, cyclicalWarning, guardErrors: ['Shares outstanding unavailable'],
    }
  }

  const upsidePct = currentPrice > 0 ? (epvPerShare - currentPrice) / currentPrice : null
  const growthPremiumPct = currentPrice > 0 && epvPerShare < currentPrice
    ? (currentPrice - Math.max(0, epvPerShare)) / currentPrice
    : null

  return {
    nopat, normalizedNopat, effectiveNopat,
    epvPerShare, upsidePct, growthPremiumPct,
    isNormalized, isCyclical, cyclicalWarning, guardErrors: [],
  }
}
