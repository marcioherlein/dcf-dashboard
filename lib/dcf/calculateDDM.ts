export interface DDMResult {
  fairValuePerShare: number
  upsidePct: number
  dividendPerShare: number   // D0 — current annual dividend
  impliedGrowthRate: number  // sustainable g = ROE × (1 − payoutRatio)
  costOfEquity: number       // Ke from CAPM
  applicable: boolean
  reason: string
}

/**
 * Gordon Growth DDM: P = D1 / (Ke − g)
 * where D1 = D0 × (1 + g)
 *
 * @param dividendPerShare  Annual dividend per share (D0)
 * @param costOfEquity      Cost of equity from CAPM (e.g. 0.098)
 * @param roe               Return on equity (e.g. 0.25); used to compute sustainable g
 * @param payoutRatio       Dividend / EPS (e.g. 0.45)
 * @param currentPrice      Current stock price
 */
export function calculateDDM(
  dividendPerShare: number,
  costOfEquity: number,
  roe: number | null,
  payoutRatio: number,
  currentPrice: number,
): DDMResult {
  // No dividend — model not applicable
  if (dividendPerShare <= 0) {
    return {
      fairValuePerShare: 0,
      upsidePct: 0,
      dividendPerShare: 0,
      impliedGrowthRate: 0,
      costOfEquity,
      applicable: false,
      reason: 'Company does not pay dividends',
    }
  }

  // Sustainable growth = ROE × retention ratio
  // Fallback to a conservative 2% if ROE is unavailable
  const retention = Math.max(0, 1 - payoutRatio)
  let g = roe !== null && roe > 0
    ? roe * retention
    : 0.02

  // Cap g so the Gordon Growth denominator stays positive (g must be < Ke)
  g = Math.min(g, costOfEquity - 0.01, 0.10)
  g = Math.max(g, 0.005)  // floor: at least 0.5% growth

  const ke = costOfEquity
  const D1 = dividendPerShare * (1 + g)
  const fairValuePerShare = Math.round((D1 / (ke - g)) * 100) / 100
  const upsidePct = currentPrice > 0 ? (fairValuePerShare - currentPrice) / currentPrice : 0

  return {
    fairValuePerShare,
    upsidePct: Math.round(upsidePct * 1000) / 1000,
    dividendPerShare: Math.round(dividendPerShare * 100) / 100,
    impliedGrowthRate: Math.round(g * 1000) / 1000,
    costOfEquity: Math.round(ke * 10000) / 10000,
    applicable: true,
    reason: `Gordon Growth DDM: D₁ / (Ke − g) = $${D1.toFixed(2)} / (${(ke * 100).toFixed(1)}% − ${(g * 100).toFixed(1)}%)`,
  }
}
