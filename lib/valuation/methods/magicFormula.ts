/**
 * Magic Formula (Joel Greenblatt)
 *
 * Two-factor screen:
 *   1. Earnings Yield = EBIT / EV   (value: higher is better)
 *   2. ROIC                          (quality: higher is better)
 *
 * Greenblatt's thesis: buy good businesses (high ROIC) cheaply (high earnings yield).
 * An earnings yield above the risk-free rate means the business is producing
 * more return than a risk-free bond — a necessary (not sufficient) condition for value.
 */

export interface MagicFormulaInputs {
  ebitM: number | null              // EBIT in $M
  enterpriseValueM: number | null   // EV in $M (market cap + net debt)
  roic: number | null               // ROIC as decimal e.g. 0.18 (from scores.roic)
  riskFreeRate: number              // e.g. 0.045
  currentPrice: number
}

export type MagicFormulaAttractiveness = 'high' | 'moderate' | 'low'

export interface MagicFormulaResult {
  earningsYield: number | null       // EBIT/EV as decimal
  roic: number | null
  earningsYieldVsRFR: number | null  // excess yield above risk-free rate
  impliedMaxPE: number | null        // 1 / earningsYield
  attractiveness: MagicFormulaAttractiveness | null
  attractivenessReason: string | null
  guardErrors: string[]
}

export function computeMagicFormula(inputs: MagicFormulaInputs): MagicFormulaResult {
  const { ebitM, enterpriseValueM, roic, riskFreeRate } = inputs

  const errors: string[] = []
  if (ebitM == null) errors.push('EBIT unavailable')
  if (enterpriseValueM == null || enterpriseValueM <= 0) errors.push('Enterprise value unavailable or non-positive')

  if (errors.length > 0 || ebitM == null || enterpriseValueM == null || enterpriseValueM <= 0) {
    return {
      earningsYield: null, roic, earningsYieldVsRFR: null, impliedMaxPE: null,
      attractiveness: null, attractivenessReason: null, guardErrors: errors,
    }
  }

  const earningsYield = ebitM / enterpriseValueM
  const earningsYieldVsRFR = earningsYield - riskFreeRate
  const impliedMaxPE = earningsYield > 0 ? 1 / earningsYield : null

  const highYield = earningsYield > riskFreeRate * 1.5
  const highRoic = roic != null && roic > 0.15

  let attractiveness: MagicFormulaAttractiveness
  let attractivenessReason: string

  if (highYield && highRoic) {
    attractiveness = 'high'
    attractivenessReason = `High earnings yield (${(earningsYield * 100).toFixed(1)}%) + strong ROIC (${(roic! * 100).toFixed(0)}%) — Greenblatt's ideal combination`
  } else if (highYield || highRoic) {
    attractiveness = 'moderate'
    attractivenessReason = highYield
      ? `Earnings yield (${(earningsYield * 100).toFixed(1)}%) above risk-free rate — value signal present, ROIC needs improvement`
      : `Strong ROIC (${(roic! * 100).toFixed(0)}%) — quality present, but earnings yield (${(earningsYield * 100).toFixed(1)}%) is modest`
  } else {
    attractiveness = 'low'
    attractivenessReason = earningsYield <= riskFreeRate
      ? `Earnings yield (${(earningsYield * 100).toFixed(1)}%) at or below risk-free rate — market is not compensating you for equity risk`
      : `Both earnings yield and ROIC below Greenblatt's thresholds`
  }

  return { earningsYield, roic, earningsYieldVsRFR, impliedMaxPE, attractiveness, attractivenessReason, guardErrors: [] }
}
