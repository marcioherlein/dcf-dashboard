/**
 * Revenue Multiple Valuation Engine
 *
 * FutureEV = FutureRevenue × ExitEV/Revenue
 * FutureEquity = FutureEV - NetDebt
 * FairValue = FutureEquity / FutureShares / (1+discountRate)^N
 *
 * Best for pre-profit companies where P/E is not meaningful.
 */

export interface RevenueMultipleInputs {
  ltvRevenue: number | null       // LTM revenue in $ (not millions)
  revenueCAGR: number | null      // decimal
  exitEVRevenue: number | null    // exit EV/Revenue multiple, e.g. 8.0
  netDebt: number | null          // net debt in $ (debt - cash; negative = net cash)
  sharesOutstanding: number | null
  dilutionRate: number | null
  discountRate: number | null
  currentPrice: number
  dividendYield: number | null
  yearsToTarget?: number
}

export interface RevenueMultipleResult {
  futureRevenue: number | null
  futureEV: number | null
  futureEquityValue: number | null
  futureShares: number | null
  futureTargetPrice: number | null
  fairValueToday: number | null
  target1Y: number | null
  upsidePct: number | null
  expectedReturnPct: number | null
  expectedReturnWithDivPct: number | null
  guardErrors: string[]
}

export function computeRevenueMultiple(inputs: RevenueMultipleInputs): RevenueMultipleResult {
  const {
    ltvRevenue, revenueCAGR, exitEVRevenue, netDebt,
    sharesOutstanding, dilutionRate, discountRate, currentPrice, dividendYield,
  } = inputs
  const N = inputs.yearsToTarget ?? 5

  const errors: string[] = []

  if (ltvRevenue == null)        errors.push('LTM Revenue is missing')
  if (revenueCAGR == null)        errors.push('Revenue CAGR is missing')
  if (exitEVRevenue == null)      errors.push('Exit EV/Revenue multiple is missing')
  if (netDebt == null)            errors.push('Net debt data unavailable — equity bridge cannot be computed. Check balance sheet.')
  if (sharesOutstanding == null)  errors.push('Shares outstanding is missing')
  if (dilutionRate == null)       errors.push('Dilution rate is missing')
  if (discountRate == null)       errors.push('Discount rate is missing')

  if (ltvRevenue != null && ltvRevenue <= 0) errors.push('LTM Revenue must be positive')
  if (exitEVRevenue != null && exitEVRevenue <= 0) errors.push('Exit EV/Revenue multiple must be positive')
  if (sharesOutstanding != null && sharesOutstanding <= 0) errors.push('Shares outstanding must be positive')
  if (discountRate != null && discountRate <= -1) errors.push('Discount rate must be > −100%')

  if (errors.length > 0 || ltvRevenue == null || revenueCAGR == null ||
      exitEVRevenue == null || netDebt == null || sharesOutstanding == null ||
      dilutionRate == null || discountRate == null) {
    return {
      futureRevenue: null, futureEV: null, futureEquityValue: null,
      futureShares: null, futureTargetPrice: null, fairValueToday: null,
      target1Y: null, upsidePct: null, expectedReturnPct: null,
      expectedReturnWithDivPct: null, guardErrors: errors,
    }
  }

  const futureRevenue     = ltvRevenue * Math.pow(1 + revenueCAGR, N)
  const futureEV          = futureRevenue * exitEVRevenue
  const futureEquityValue = futureEV - netDebt
  const futureShares      = sharesOutstanding * Math.pow(1 + dilutionRate, N)

  if (futureEquityValue <= 0) {
    const warn = `Implied equity value is negative (net debt exceeds enterprise value)`
    return {
      futureRevenue, futureEV, futureEquityValue,
      futureShares, futureTargetPrice: null, fairValueToday: null,
      target1Y: null, upsidePct: null, expectedReturnPct: null,
      expectedReturnWithDivPct: null, guardErrors: [warn],
    }
  }

  const futureTargetPrice = futureEquityValue / futureShares
  const fairValueToday    = futureTargetPrice / Math.pow(1 + discountRate, N)
  const target1Y          = N > 1 ? futureTargetPrice / Math.pow(1 + discountRate, N - 1) : futureTargetPrice

  const upsidePct = currentPrice > 0 ? (fairValueToday - currentPrice) / currentPrice : null
  const expectedReturnPct = (upsidePct != null && N > 0)
    ? Math.pow(1 + upsidePct, 1 / N) - 1
    : null
  const expectedReturnWithDivPct = (expectedReturnPct != null && dividendYield != null)
    ? expectedReturnPct + dividendYield
    : expectedReturnPct

  return {
    futureRevenue, futureEV, futureEquityValue, futureShares, futureTargetPrice,
    fairValueToday, target1Y, upsidePct, expectedReturnPct, expectedReturnWithDivPct,
    guardErrors: [],
  }
}
