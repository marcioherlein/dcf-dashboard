import { DCFResult, projectCashFlows } from './projectCashFlows'
import { WACCResult } from './calculateWACC'

export interface FairValueResult {
  ev: number
  cash: number
  debt: number
  marketCap: number
  equityValue: number
  sharesOutstanding: number
  fairValuePerShare: number
  currentPrice: number
  upsidePct: number
  irr: number
}

export function calculateFairValue(
  dcf: DCFResult,
  cash: number,     // millions
  debt: number,     // millions
  shares: number,   // millions (shares outstanding)
  currentPrice: number,
): FairValueResult {
  const equityValue = dcf.ev + cash - debt
  const fairValuePerShare = shares > 0 ? equityValue / shares : 0
  const upsidePct = currentPrice > 0 ? (fairValuePerShare - currentPrice) / currentPrice : 0

  // Simple IRR approximation: annual return from current price to fair value over 5 years
  const irr = currentPrice > 0 && fairValuePerShare > 0
    ? Math.pow(fairValuePerShare / currentPrice, 1 / 5) - 1
    : 0
  const marketCap = Math.round(currentPrice * shares)

  return {
    ev: Math.round(dcf.ev),
    cash: Math.round(cash),
    debt: Math.round(debt),
    marketCap,
    equityValue: Math.round(equityValue),
    sharesOutstanding: shares,
    fairValuePerShare: Math.round(fairValuePerShare * 100) / 100,
    currentPrice,
    upsidePct: Math.round(upsidePct * 1000) / 1000,
    irr: Math.round(irr * 1000) / 1000,
  }
}

export interface Scenarios {
  bull: { fairValue: number; wacc: number; cagr: number; terminalG: number }
  base: { fairValue: number; wacc: number; cagr: number; terminalG: number }
  bear: { fairValue: number; wacc: number; cagr: number; terminalG: number }
}

export function buildScenarios(
  wacc: WACCResult,
  baseCagr: number,
  baseTerminalG: number,
  baseFCF: number,
  cash: number,
  debt: number,
  shares: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _currentPrice: number,
): Scenarios {
  const scenarios = [
    { label: 'bull', waccAdj: -0.01, cagrAdj: +0.02, tgAdj: +0.005 },
    { label: 'base', waccAdj: 0, cagrAdj: 0, tgAdj: 0 },
    { label: 'bear', waccAdj: +0.01, cagrAdj: -0.02, tgAdj: -0.005 },
  ] as const

  const result: Partial<Scenarios> = {}
  for (const s of scenarios) {
    const w = Math.max(wacc.wacc + s.waccAdj, 0.04)
    const c = Math.max(baseCagr + s.cagrAdj, -0.05)
    const g = Math.min(Math.max(baseTerminalG + s.tgAdj, 0), w - 0.005)
    const dcf = projectCashFlows({ baseFCF, cagr: c, wacc: w, terminalG: g })
    const equityValue = dcf.ev + cash - debt
    const fv = shares > 0 ? Math.round((equityValue / shares) * 100) / 100 : 0
    result[s.label] = { fairValue: fv, wacc: w, cagr: c, terminalG: g }
  }
  return result as Scenarios
}
