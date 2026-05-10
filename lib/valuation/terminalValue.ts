/**
 * Terminal value calculations.
 *
 * Two methods:
 *   Perpetuity Growth: FCF × (1+g) / (discount−g)   [Gordon Growth — requires g < discount]
 *   Exit Multiple:     FCF × multiple                 [market-based]
 *
 * Both are computed and returned; the UI shows them side-by-side.
 */

import { assertTerminalGrowth } from './valuationGuards'

export interface TerminalValueResult {
  perpetuityTV: number | null
  perpetuityTVDiscounted: number | null
  exitMultipleTV: number | null
  exitMultipleTVDiscounted: number | null
  /** Which method is recommended as primary for this company type */
  primaryMethod: 'perpetuity' | 'exitMultiple'
  /** Residual % of total EV (how much comes from TV) */
  perpetuityResidualPct: number | null
  exitMultipleResidualPct: number | null
  guardError: string | null
}

/**
 * Compute both terminal value methods.
 *
 * @param terminalFCF  The final-year FCF (UFCF or LFCF) in $M
 * @param discountRate WACC for UFCF path, costOfEquity for LFCF path
 * @param terminalG    Perpetual growth rate (must be < discountRate)
 * @param exitMultiple EV/FCF or P/FCF multiple
 * @param numProjectionYears  How many projection years (for discounting TV back)
 * @param sumPvFcf     Sum of PV of projection-year FCFs (for residual % calc)
 * @param companyType  Informs which method is recommended
 */
export function computeTerminalValues(
  terminalFCF: number | null,
  discountRate: number,
  terminalG: number,
  exitMultiple: number,
  numProjectionYears: number,
  sumPvFcf: number,
  companyType: 'standard' | 'growth' | 'financial' | 'dividend' | 'startup',
): TerminalValueResult {
  if (terminalFCF == null) {
    return {
      perpetuityTV: null,
      perpetuityTVDiscounted: null,
      exitMultipleTV: null,
      exitMultipleTVDiscounted: null,
      primaryMethod: 'perpetuity',
      perpetuityResidualPct: null,
      exitMultipleResidualPct: null,
      guardError: 'Terminal FCF is null — cannot compute terminal value',
    }
  }

  let guardError: string | null = null
  let perpetuityTV: number | null = null
  let perpetuityTVDiscounted: number | null = null

  try {
    assertTerminalGrowth(terminalG, discountRate)
    perpetuityTV = (terminalFCF * (1 + terminalG)) / (discountRate - terminalG)
    perpetuityTVDiscounted = perpetuityTV / Math.pow(1 + discountRate, numProjectionYears)
  } catch (e) {
    guardError = e instanceof Error ? e.message : 'Terminal growth guard failed'
  }

  const exitMultipleTV = terminalFCF * exitMultiple
  const exitMultipleTVDiscounted = exitMultipleTV / Math.pow(1 + discountRate, numProjectionYears)

  const perpetuityResidualPct = perpetuityTVDiscounted != null && (sumPvFcf + perpetuityTVDiscounted) > 0
    ? perpetuityTVDiscounted / (sumPvFcf + perpetuityTVDiscounted)
    : null

  const exitMultipleResidualPct = (sumPvFcf + exitMultipleTVDiscounted) > 0
    ? exitMultipleTVDiscounted / (sumPvFcf + exitMultipleTVDiscounted)
    : null

  // Recommend exit multiple for growth/startup (terminal FCF may be artificially high);
  // perpetuity growth for stable/dividend companies
  const primaryMethod: 'perpetuity' | 'exitMultiple' =
    companyType === 'growth' || companyType === 'startup' ? 'exitMultiple' : 'perpetuity'

  return {
    perpetuityTV,
    perpetuityTVDiscounted,
    exitMultipleTV,
    exitMultipleTVDiscounted,
    primaryMethod,
    perpetuityResidualPct,
    exitMultipleResidualPct,
    guardError,
  }
}
