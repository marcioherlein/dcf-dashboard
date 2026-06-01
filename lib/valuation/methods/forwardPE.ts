/**
 * Forward P/E Valuation Engine
 *
 * Fair Value = FutureTargetPrice / (1+discountRate)^N
 * FutureTargetPrice = (LTMRevenue × (1+CAGR)^N × NetMargin × ExitPE)
 *                   / (Shares × (1+Dilution)^N)
 */

export interface ForwardPEInputs {
  ltvRevenue: number | null        // LTM revenue in $ (not millions)
  sharesOutstanding: number | null // raw share count
  revenueCAGR: number | null       // decimal, e.g. 0.15 for 15%
  netMargin: number | null         // decimal, e.g. 0.20 for 20%
  exitPE: number | null            // P/E multiple at target year
  dilutionRate: number | null      // annual dilution decimal, e.g. 0.02
  discountRate: number | null      // WACC decimal
  currentPrice: number             // current market price
  dividendYield: number | null     // annual dividend yield decimal
  yearsToTarget?: number           // default 5
  terminalCAGR?: number            // long-run growth rate to fade toward (default 0.04)
}

export interface ForwardPEResult {
  futureRevenue: number | null
  futureNetIncome: number | null
  futureShares: number | null
  futureMarketCap: number | null
  futureTargetPrice: number | null
  fairValueToday: number | null
  target1Y: number | null
  upsidePct: number | null
  expectedReturnPct: number | null // annualized CAGR from current price to fair value
  expectedReturnWithDivPct: number | null
  guardErrors: string[]
}

export function computeForwardPE(inputs: ForwardPEInputs): ForwardPEResult {
  const {
    ltvRevenue, sharesOutstanding, revenueCAGR, netMargin,
    exitPE, dilutionRate, discountRate, currentPrice, dividendYield,
  } = inputs
  const N = inputs.yearsToTarget ?? 5

  const errors: string[] = []

  // Validate required inputs
  if (ltvRevenue == null)       errors.push('LTM Revenue is missing')
  if (sharesOutstanding == null) errors.push('Shares outstanding is missing')
  if (revenueCAGR == null)       errors.push('Revenue CAGR is missing')
  if (netMargin == null)         errors.push('Net margin is missing')
  if (exitPE == null)            errors.push('Exit P/E is missing')
  if (dilutionRate == null)      errors.push('Dilution rate is missing')
  if (discountRate == null)      errors.push('Discount rate is missing')

  if (ltvRevenue != null && ltvRevenue <= 0) errors.push('LTM Revenue must be positive')
  if (sharesOutstanding != null && sharesOutstanding <= 0) errors.push('Shares outstanding must be positive')
  if (exitPE != null && exitPE <= 0) errors.push('Exit P/E must be positive')
  if (discountRate != null && discountRate <= -1) errors.push('Discount rate must be > −100%')
  if (netMargin != null && (netMargin < -1 || netMargin > 1)) errors.push('Net margin outside expected range (−100% to 100%)')

  if (errors.length > 0 || ltvRevenue == null || sharesOutstanding == null ||
      revenueCAGR == null || netMargin == null || exitPE == null ||
      dilutionRate == null || discountRate == null) {
    return {
      futureRevenue: null, futureNetIncome: null, futureShares: null,
      futureMarketCap: null, futureTargetPrice: null, fairValueToday: null,
      target1Y: null, upsidePct: null, expectedReturnPct: null,
      expectedReturnWithDivPct: null, guardErrors: errors,
    }
  }

  // Fade growth linearly from revenueCAGR → terminalCAGR over N years.
  // Prevents high initial CAGR from compounding at full speed for all 5 years.
  const terminalGrowth = inputs.terminalCAGR ?? 0.04
  let futureRevenue: number
  if (revenueCAGR > terminalGrowth && N > 1) {
    futureRevenue = ltvRevenue
    for (let yr = 1; yr <= N; yr++) {
      const t = (yr - 1) / (N - 1)
      const yearGrowth = revenueCAGR * (1 - t) + terminalGrowth * t
      futureRevenue *= (1 + yearGrowth)
    }
  } else {
    futureRevenue = ltvRevenue * Math.pow(1 + revenueCAGR, N)
  }
  const futureNetIncome   = futureRevenue * netMargin
  const futureShares      = sharesOutstanding * Math.pow(1 + dilutionRate, N)
  const futureMarketCap   = futureNetIncome * exitPE
  const futureTargetPrice = futureShares > 0 ? futureMarketCap / futureShares : null

  if (futureTargetPrice == null || futureTargetPrice <= 0) {
    return {
      futureRevenue, futureNetIncome, futureShares, futureMarketCap,
      futureTargetPrice: null, fairValueToday: null, target1Y: null,
      upsidePct: null, expectedReturnPct: null, expectedReturnWithDivPct: null,
      guardErrors: ['Implied target price is non-positive — check net margin or exit P/E'],
    }
  }

  const fairValueToday = futureTargetPrice / Math.pow(1 + discountRate, N)
  const target1Y       = N > 1 ? futureTargetPrice / Math.pow(1 + discountRate, N - 1) : futureTargetPrice

  const upsidePct = currentPrice > 0 ? (fairValueToday - currentPrice) / currentPrice : null
  const expectedReturnPct = (upsidePct != null && N > 0)
    ? Math.pow(1 + upsidePct, 1 / N) - 1
    : null
  const expectedReturnWithDivPct = (expectedReturnPct != null && dividendYield != null)
    ? expectedReturnPct + dividendYield
    : expectedReturnPct

  return {
    futureRevenue, futureNetIncome, futureShares, futureMarketCap,
    futureTargetPrice, fairValueToday, target1Y,
    upsidePct, expectedReturnPct, expectedReturnWithDivPct,
    guardErrors: [],
  }
}
