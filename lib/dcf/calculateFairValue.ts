import { DCFResult, projectCashFlows, GrowthModel } from './projectCashFlows'
import { WACCResult } from './calculateWACC'

export interface FairValueResult {
  ev: number | null
  cash: number
  debt: number
  marketCap: number
  equityValue: number | null
  sharesOutstanding: number
  fairValuePerShare: number | null
  currentPrice: number
  upsidePct: number | null
  irr: number | null
  terminalGrowthViolation?: boolean
  debtOverhang?: boolean
}

export function calculateFairValue(
  dcf: DCFResult,
  cash: number,     // millions
  debt: number,     // millions
  shares: number,   // millions (shares outstanding)
  currentPrice: number,
): FairValueResult {
  const marketCap = Math.round(currentPrice * shares)

  // If DCF has a Gordon Growth violation, propagate null rather than producing garbage output
  if (dcf.terminalGrowthViolation || dcf.ev == null) {
    return {
      ev: null, cash: Math.round(cash), debt: Math.round(debt), marketCap,
      equityValue: null, sharesOutstanding: shares,
      fairValuePerShare: null, currentPrice, upsidePct: null, irr: null,
      terminalGrowthViolation: true,
    }
  }

  if (shares <= 0) {
    return {
      ev: Math.round(dcf.ev), cash: Math.round(cash), debt: Math.round(debt), marketCap,
      equityValue: null, sharesOutstanding: shares,
      fairValuePerShare: null, currentPrice, upsidePct: null, irr: null,
    }
  }

  const equityValue = dcf.ev + cash - debt
  const debtOverhang = equityValue < 0
  const fairValuePerShare = debtOverhang ? 0 : equityValue / shares
  const upsidePct = currentPrice > 0 ? (fairValuePerShare - currentPrice) / currentPrice : null
  const irr = (currentPrice > 0 && fairValuePerShare > 0)
    ? Math.pow(fairValuePerShare / currentPrice, 1 / 5) - 1
    : null

  return {
    ev: Math.round(dcf.ev),
    cash: Math.round(cash),
    debt: Math.round(debt),
    marketCap,
    equityValue: Math.round(equityValue),
    sharesOutstanding: shares,
    fairValuePerShare: Math.round(fairValuePerShare * 100) / 100,
    currentPrice,
    upsidePct: upsidePct != null ? Math.round(upsidePct * 1000) / 1000 : null,
    irr: irr != null ? Math.round(irr * 1000) / 1000 : null,
    debtOverhang,
  }
}

export interface ModelMethodology {
  companyType: string
  companyTypeLabel: string
  rationale: string
  weights: { ufcfPGM: number; ufcfEM: number; lfcfPGM: number; lfcfEM: number }
}

export interface Scenarios {
  bull: { fairValue: number | null; wacc: number; cagr: number; terminalG: number }
  base: { fairValue: number | null; wacc: number; cagr: number; terminalG: number }
  bear: { fairValue: number | null; wacc: number; cagr: number; terminalG: number }
  modelMethodology?: ModelMethodology
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
  growthModel: GrowthModel = 'two-stage',
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
    const dcf = projectCashFlows({ baseFCF, cagr: c, wacc: w, terminalG: g, growthModel })
    const fv = (dcf.ev != null && shares > 0)
      ? Math.max(0, Math.round(((dcf.ev + cash - debt) / shares) * 100) / 100)
      : null
    result[s.label] = { fairValue: fv, wacc: w, cagr: c, terminalG: g }
  }
  return result as Scenarios
}
