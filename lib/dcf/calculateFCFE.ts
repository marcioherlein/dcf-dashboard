import { projectCashFlows } from './projectCashFlows'
import { calculateFairValue } from './calculateFairValue'

export interface FCFEResult {
  fairValuePerShare: number
  upsidePct: number
  baseFCFE: number      // net income × 0.90 used as FCFE proxy (millions)
  discountRate: number  // cost of equity (not WACC)
  applicable: boolean
  reason: string
}

/**
 * FCFE DCF: projects Free Cash Flow to Equity discounted at cost of equity.
 *
 * For financial companies, net income × 0.90 is used as the FCFE proxy because:
 * - Capital expenditure is minimal (software/people businesses)
 * - Net income ≈ the cash available to equity holders after reinvestment
 *
 * @param netIncomeM     Net income to common stockholders in millions (normalized, 2-year avg)
 * @param cagr           Annual growth rate for projections
 * @param costOfEquity   Discount rate (cost of equity, NOT WACC)
 * @param terminalG      Terminal growth rate
 * @param cash           Cash and equivalents in millions
 * @param debt           Total debt in millions
 * @param shares         Shares outstanding in millions
 * @param currentPrice   Current stock price
 */
export function calculateFCFE(
  netIncomeM: number,
  cagr: number,
  costOfEquity: number,
  terminalG: number,
  cash: number,
  debt: number,
  shares: number,
  currentPrice: number,
): FCFEResult {
  // Net income must be positive for FCFE to be meaningful.
  // If it's ≤ 0 after all our fallback chains, the model cannot run.
  if (netIncomeM <= 0) {
    return {
      fairValuePerShare: 0,
      upsidePct: 0,
      baseFCFE: netIncomeM,
      discountRate: costOfEquity,
      applicable: false,
      reason: 'Net income not available — FCFE model not applicable',
    }
  }

  const baseFCFE = netIncomeM * 0.90

  // Guard: if FCFE yield (baseFCFE / implied equity) is implausibly high,
  // cap baseFCFE to prevent model explosion.
  // Equity value proxy = currentPrice × shares; 20% yield floor before capping.
  const impliedEquityM = currentPrice > 0 && shares > 0 ? currentPrice * shares : null
  const cappedBaseFCFE = (impliedEquityM && baseFCFE / impliedEquityM > 0.20)
    ? impliedEquityM * 0.15
    : baseFCFE

  // Discount at cost of equity (not WACC) — equity-only model
  const dcfResult = projectCashFlows({
    baseFCF: cappedBaseFCFE,
    cagr,
    wacc: costOfEquity,
    terminalG,
  })

  // FCFE already represents equity value — pass debt=0, cash=0 to avoid double counting
  // (debt is already excluded because we started from net income, not EBIT)
  const fvResult = calculateFairValue(dcfResult, 0, 0, shares, currentPrice)

  // Sanity check: if fair value > 10× current price, something is still miscalibrated.
  // Cap at 5× and flag with a note rather than silently inflating the result.
  const rawFV = fvResult.fairValuePerShare
  const maxFV = currentPrice > 0 ? currentPrice * 5 : rawFV
  const clampedFV = Math.min(rawFV, maxFV)
  const wasCapped = clampedFV < rawFV

  const finalFV = Math.round(clampedFV * 100) / 100
  const finalUpside = currentPrice > 0 ? (finalFV - currentPrice) / currentPrice : 0

  const baseReason = cappedBaseFCFE < baseFCFE
    ? `Net Income × 0.90 (yield-capped), discounted at Ke = ${(costOfEquity * 100).toFixed(1)}%`
    : `Net Income × 0.90 as FCFE proxy, discounted at Ke = ${(costOfEquity * 100).toFixed(1)}%`

  return {
    fairValuePerShare: finalFV,
    upsidePct: Math.round(finalUpside * 1000) / 1000,
    baseFCFE: Math.round(cappedBaseFCFE),
    discountRate: Math.round(costOfEquity * 10000) / 10000,
    applicable: true,
    reason: wasCapped
      ? `${baseReason} (result capped at 5× price — verify inputs)`
      : baseReason,
  }
}
