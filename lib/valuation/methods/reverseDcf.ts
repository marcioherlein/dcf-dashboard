/**
 * Reverse DCF Engine
 *
 * Answers: "What revenue CAGR must occur to justify today's price?"
 *
 * Solves for CAGR using binary search where:
 *   impliedEV = currentPrice × shares + debt - cash
 *   sumPV(FCF) + PV(TV) ≈ impliedEV
 *   FCF_t = revenue_t × fcfMargin
 *   TV = FCF_n × (1+terminalG) / (wacc - terminalG)
 */

import { assertTerminalGrowth } from '../valuationGuards'

export interface ReverseDCFInputs {
  currentPrice: number
  sharesOutstanding: number | null // raw share count
  cashM: number | null             // cash in millions
  debtM: number | null             // total debt in millions
  lastRevenue: number | null       // LTM revenue in $ (not millions)
  lastFCFMargin: number | null     // FCF / Revenue (decimal)
  wacc: number
  terminalG: number
  historicalCAGR?: number | null   // for interpretation benchmarking
  yearsToTarget?: number
}

export type ReverseDCFInterpretation =
  | 'conservative'
  | 'reasonable'
  | 'aggressive'
  | 'very_aggressive'
  | 'not_meaningful'

export interface ReverseDCFResult {
  impliedEV: number | null
  impliedCAGR: number | null
  impliedFCFMargin: number | null  // same as input (fixed)
  interpretation: ReverseDCFInterpretation
  interpretationText: string
  guardErrors: string[]
}

function calcEV(
  lastRevenue: number,
  fcfMargin: number,
  cagr: number,
  wacc: number,
  terminalG: number,
  N: number,
): number {
  let sumPv = 0
  for (let t = 1; t <= N; t++) {
    const rev = lastRevenue * Math.pow(1 + cagr, t)
    const fcf = rev * fcfMargin
    sumPv += fcf / Math.pow(1 + wacc, t)
  }
  const lastFCF = lastRevenue * Math.pow(1 + cagr, N) * fcfMargin
  const tv      = (lastFCF * (1 + terminalG)) / (wacc - terminalG)
  const pvTv    = tv / Math.pow(1 + wacc, N)
  return sumPv + pvTv
}

function interpretCAGR(impliedCAGR: number, historicalCAGR: number | null | undefined): {
  interpretation: ReverseDCFInterpretation
  text: string
} {
  const hist = historicalCAGR ?? 0.05
  const diff = impliedCAGR - hist

  let interpretation: ReverseDCFInterpretation
  let qualifier: string
  if (diff < -0.05) {
    interpretation = 'conservative'
    qualifier = 'conservative relative to its track record'
  } else if (diff < 0.05) {
    interpretation = 'reasonable'
    qualifier = 'broadly in line with its historical growth profile'
  } else if (diff < 0.15) {
    interpretation = 'aggressive'
    qualifier = 'aggressive relative to its historical growth'
  } else {
    interpretation = 'very_aggressive'
    qualifier = 'very aggressive and appears priced for perfection'
  }

  const pct = (impliedCAGR * 100).toFixed(1)
  const text = `At today's price, the market implies ~${pct}% 5Y revenue CAGR — ${qualifier}.`
  return { interpretation, text }
}

export function computeReverseDCF(inputs: ReverseDCFInputs): ReverseDCFResult {
  const {
    currentPrice, sharesOutstanding, cashM, debtM,
    lastRevenue, lastFCFMargin, wacc, terminalG, historicalCAGR,
  } = inputs
  const N = inputs.yearsToTarget ?? 5

  const errors: string[] = []

  if (sharesOutstanding == null) errors.push('Shares outstanding is missing')
  if (lastRevenue == null)        errors.push('LTM Revenue is missing')
  if (lastFCFMargin == null)      errors.push('FCF margin is missing')
  if (currentPrice <= 0)          errors.push('Current price must be positive')

  try {
    assertTerminalGrowth(terminalG, wacc)
  } catch {
    errors.push(`Terminal growth (${(terminalG * 100).toFixed(1)}%) must be less than WACC (${(wacc * 100).toFixed(1)}%)`)
  }

  if (errors.length > 0 || sharesOutstanding == null || lastRevenue == null || lastFCFMargin == null) {
    return {
      impliedEV: null, impliedCAGR: null, impliedFCFMargin: lastFCFMargin,
      interpretation: 'not_meaningful',
      interpretationText: 'Cannot compute implied CAGR — required inputs are missing.',
      guardErrors: errors,
    }
  }

  // Convert cash/debt from millions to dollars to match revenue units
  const cashDollars = (cashM ?? 0) * 1e6
  const debtDollars = (debtM ?? 0) * 1e6

  const impliedEquityValue = currentPrice * sharesOutstanding
  const impliedEV          = impliedEquityValue + debtDollars - cashDollars

  if (impliedEV <= 0) {
    return {
      impliedEV, impliedCAGR: null, impliedFCFMargin: lastFCFMargin,
      interpretation: 'not_meaningful',
      interpretationText: 'Implied EV is negative (net cash exceeds market cap) — reverse DCF not meaningful.',
      guardErrors: ['Implied EV ≤ 0'],
    }
  }

  if (lastFCFMargin <= 0) {
    return {
      impliedEV, impliedCAGR: null, impliedFCFMargin: lastFCFMargin,
      interpretation: 'not_meaningful',
      interpretationText: 'FCF margin is negative — cannot solve for implied CAGR with perpetuity model.',
      guardErrors: ['FCF margin must be positive for reverse DCF'],
    }
  }

  // Defensive ceiling: FCF margins above 45% are distortion artifacts (fintechs with
  // loan-origination-distorted OCF, one-off working-capital releases, etc.) that make
  // the model over-produce EV at zero growth and force a spuriously negative implied CAGR.
  const effectiveFcfMargin = Math.min(lastFCFMargin, 0.45)

  // Binary search for CAGR
  let lo = -0.10
  let hi = 2.00
  let mid = 0
  const target = impliedEV
  const tolerance = target * 0.001

  for (let i = 0; i < 100; i++) {
    mid = (lo + hi) / 2
    const ev = calcEV(lastRevenue, effectiveFcfMargin, mid, wacc, terminalG, N)
    if (Math.abs(ev - target) < tolerance) break
    if (ev < target) lo = mid
    else hi = mid
  }

  const impliedCAGR = mid
  const { interpretation, text } = interpretCAGR(impliedCAGR, historicalCAGR)

  return {
    impliedEV,
    impliedCAGR,
    impliedFCFMargin: lastFCFMargin,
    interpretation,
    interpretationText: text,
    guardErrors: [],
  }
}
