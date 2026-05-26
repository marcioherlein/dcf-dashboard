import { computeForwardPE } from './methods/forwardPE'
import { computeEVEBITDA } from './methods/evEbitda'
import { computeRevenueMultiple } from './methods/revenueMultiple'
import { computeReverseDCF } from './methods/reverseDcf'
import { projectCashFlows } from '../dcf/projectCashFlows'

export interface ValuationAssumptions {
  wacc: number           // e.g. 0.10
  cagr: number           // 5Y revenue CAGR e.g. 0.12
  terminalG: number      // e.g. 0.03
  netMargin: number      // e.g. 0.18
  dilutionRate: number   // e.g. 0.015
  exitPE: number         // Forward P/E exit multiple e.g. 22
  exitMultiple: number   // EV/EBITDA exit multiple e.g. 14
  revenueMultiple: number // EV/Revenue e.g. 4.5
}

// Fixed financial data extracted from apiData — does NOT change with assumptions
export interface CockpitSnapshot {
  currentPrice: number
  currency: string
  // Raw dollar values (not millions) for PE, EV/EBITDA, Revenue Multiple methods
  ltvRevenueDollars: number | null
  sharesRaw: number | null
  ttmEbitdaDollars: number | null
  netDebtDollars: number | null
  dividendYield: number | null
  // Millions-based values for DCF and Reverse DCF
  baseFCF: number
  cashM: number
  debtM: number
  sharesM: number
  // Reverse DCF inputs
  fcfMargin: number | null
  historicalCAGR: number | null
  // Analyst consensus (display only)
  analystTargetMean: number | null
  analystRating: string | null
}

export interface CockpitMethodResult {
  id: string
  method: string
  fairValue: number | null
  weight: number
  confidence: 'high' | 'medium' | 'low'
  description: string
  upsidePct: number | null
  errors: string[]
}

export interface CockpitOutput {
  blendedFairValue: number | null
  methods: CockpitMethodResult[]
  scenarios: {
    bull: { fairValue: number | null; wacc: number; cagr: number }
    base: { fairValue: number | null; wacc: number; cagr: number }
    bear: { fairValue: number | null; wacc: number; cagr: number }
  }
  verdict: 'Undervalued' | 'Fairly Valued' | 'Overvalued' | 'Insufficient Data'
  upsidePct: number | null
  marketImpliedGrowth: number | null
  marketImpliedText: string
}

const WEIGHTS = {
  forward_pe: 0.35,
  ev_ebitda: 0.30,
  revenue_multiple: 0.25,
  core_dcf: 0.10,
} as const

function scenarioDcfFV(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
  waccDelta: number,
  cagrDelta: number,
): number | null {
  if (snapshot.baseFCF <= 0 || snapshot.sharesM <= 0) return null
  const w = Math.max(assumptions.wacc + waccDelta, 0.04)
  const c = Math.max(assumptions.cagr + cagrDelta, -0.05)
  const g = Math.min(Math.max(assumptions.terminalG, 0.005), w - 0.005)
  const dcf = projectCashFlows({ baseFCF: snapshot.baseFCF, cagr: c, wacc: w, terminalG: g, growthModel: 'two-stage' })
  if (dcf.ev == null) return null
  const equity = dcf.ev + snapshot.cashM - snapshot.debtM
  return Math.round((equity / snapshot.sharesM) * 100) / 100
}

export function computeCockpitOutput(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
): CockpitOutput {
  const { currentPrice } = snapshot

  // 1. Forward P/E
  const fwdPE = computeForwardPE({
    ltvRevenue: snapshot.ltvRevenueDollars,
    sharesOutstanding: snapshot.sharesRaw,
    revenueCAGR: assumptions.cagr,
    netMargin: assumptions.netMargin,
    exitPE: assumptions.exitPE,
    dilutionRate: assumptions.dilutionRate,
    discountRate: assumptions.wacc,
    currentPrice,
    dividendYield: snapshot.dividendYield,
  })

  // 2. EV/EBITDA
  const evEbitda = computeEVEBITDA({
    ttmEbitda: snapshot.ttmEbitdaDollars,
    netDebt: snapshot.netDebtDollars,
    shares: snapshot.sharesRaw,
    exitMultiple: assumptions.exitMultiple,
    currentPrice,
  })

  // 3. Revenue Multiple
  const revMult = computeRevenueMultiple({
    ltvRevenue: snapshot.ltvRevenueDollars,
    revenueCAGR: assumptions.cagr,
    exitEVRevenue: assumptions.revenueMultiple,
    netDebt: snapshot.netDebtDollars,
    sharesOutstanding: snapshot.sharesRaw,
    dilutionRate: assumptions.dilutionRate,
    discountRate: assumptions.wacc,
    currentPrice,
    dividendYield: snapshot.dividendYield,
  })

  // 4. Core DCF (UFCF + PGM)
  let dcfFV: number | null = null
  let dcfErrors: string[] = []
  if (snapshot.baseFCF > 0 && snapshot.sharesM > 0) {
    const g = Math.min(Math.max(assumptions.terminalG, 0.005), assumptions.wacc - 0.005)
    const dcf = projectCashFlows({
      baseFCF: snapshot.baseFCF,
      cagr: assumptions.cagr,
      wacc: assumptions.wacc,
      terminalG: g,
      growthModel: 'two-stage',
    })
    if (dcf.ev != null) {
      const equity = dcf.ev + snapshot.cashM - snapshot.debtM
      dcfFV = Math.round((equity / snapshot.sharesM) * 100) / 100
      if (dcfFV <= 0) { dcfFV = null; dcfErrors = ['Implied equity value non-positive'] }
    } else {
      dcfErrors = ['Terminal growth violation']
    }
  } else {
    dcfErrors = ['Insufficient FCF or share data']
  }

  const upside = (fv: number | null) =>
    fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null

  const methods: CockpitMethodResult[] = [
    {
      id: 'forward_pe',
      method: 'Forward P/E',
      fairValue: fwdPE.fairValueToday ?? null,
      weight: WEIGHTS.forward_pe,
      confidence: fwdPE.guardErrors.length === 0 ? 'high' : 'low',
      description: 'Discounts 5Y earnings at exit P/E multiple back to present value',
      upsidePct: upside(fwdPE.fairValueToday ?? null),
      errors: fwdPE.guardErrors,
    },
    {
      id: 'ev_ebitda',
      method: 'EV/EBITDA',
      fairValue: evEbitda.fairValuePerShare ?? null,
      weight: WEIGHTS.ev_ebitda,
      confidence: evEbitda.guardErrors.length === 0 ? 'high' : 'low',
      description: 'Values the enterprise at a multiple of operating cash profit',
      upsidePct: upside(evEbitda.fairValuePerShare ?? null),
      errors: evEbitda.guardErrors,
    },
    {
      id: 'revenue_multiple',
      method: 'Revenue Multiple',
      fairValue: revMult.fairValueToday ?? null,
      weight: WEIGHTS.revenue_multiple,
      confidence: revMult.guardErrors.length === 0 ? 'medium' : 'low',
      description: 'Projects revenue to exit year and applies EV/Revenue multiple',
      upsidePct: upside(revMult.fairValueToday ?? null),
      errors: revMult.guardErrors,
    },
    {
      id: 'core_dcf',
      method: 'Core DCF',
      fairValue: dcfFV,
      weight: WEIGHTS.core_dcf,
      confidence: dcfFV != null ? 'medium' : 'low',
      description: 'Unlevered free cash flow DCF with perpetuity growth terminal value',
      upsidePct: upside(dcfFV),
      errors: dcfErrors,
    },
  ]

  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  const totalWeight = valid.reduce((s, m) => s + m.weight, 0)
  const blendedFairValue = totalWeight > 0
    ? Math.round(valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / totalWeight * 100) / 100
    : null

  const upsidePct = blendedFairValue != null && currentPrice > 0
    ? (blendedFairValue - currentPrice) / currentPrice
    : null

  let verdict: CockpitOutput['verdict'] = 'Insufficient Data'
  if (upsidePct != null) {
    if (upsidePct > 0.15) verdict = 'Undervalued'
    else if (upsidePct < -0.15) verdict = 'Overvalued'
    else verdict = 'Fairly Valued'
  }

  // Reverse DCF for market-implied growth
  const safeTG = Math.min(Math.max(assumptions.terminalG, 0.005), assumptions.wacc - 0.005)
  const reverseDcf = computeReverseDCF({
    currentPrice,
    sharesOutstanding: snapshot.sharesRaw,
    cashM: snapshot.cashM,
    debtM: snapshot.debtM,
    lastRevenue: snapshot.ltvRevenueDollars,
    lastFCFMargin: snapshot.fcfMargin,
    wacc: assumptions.wacc,
    terminalG: safeTG,
    historicalCAGR: snapshot.historicalCAGR,
  })

  return {
    blendedFairValue,
    methods,
    scenarios: {
      bull: { fairValue: scenarioDcfFV(assumptions, snapshot, -0.01, +0.02), wacc: assumptions.wacc - 0.01, cagr: assumptions.cagr + 0.02 },
      base: { fairValue: blendedFairValue, wacc: assumptions.wacc, cagr: assumptions.cagr },
      bear: { fairValue: scenarioDcfFV(assumptions, snapshot, +0.01, -0.02), wacc: assumptions.wacc + 0.01, cagr: assumptions.cagr - 0.02 },
    },
    verdict,
    upsidePct,
    marketImpliedGrowth: reverseDcf.impliedCAGR,
    marketImpliedText: reverseDcf.interpretationText,
  }
}
