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
 * @param netIncomeM     Net income to common stockholders in millions
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
  if (netIncomeM <= 0) {
    return {
      fairValuePerShare: 0,
      upsidePct: 0,
      baseFCFE: netIncomeM,
      discountRate: costOfEquity,
      applicable: false,
      reason: 'Net income is negative — FCFE model not applicable',
    }
  }

  const baseFCFE = netIncomeM * 0.90

  // Discount at cost of equity (not WACC) — equity-only model
  const dcfResult = projectCashFlows({
    baseFCF: baseFCFE,
    cagr,
    wacc: costOfEquity,
    terminalG,
  })

  // FCFE already represents equity value — pass debt=0, cash=0 to avoid double counting
  // (debt is already excluded because we started from net income, not EBIT)
  const fvResult = calculateFairValue(dcfResult, 0, 0, shares, currentPrice)

  return {
    fairValuePerShare: Math.round(fvResult.fairValuePerShare * 100) / 100,
    upsidePct: Math.round(fvResult.upsidePct * 1000) / 1000,
    baseFCFE: Math.round(baseFCFE),
    discountRate: Math.round(costOfEquity * 10000) / 10000,
    applicable: true,
    reason: `Net Income × 0.90 as FCFE proxy, discounted at Ke = ${(costOfEquity * 100).toFixed(1)}%`,
  }
}
