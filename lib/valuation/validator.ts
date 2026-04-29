/**
 * Valuation input validator.
 *
 * Applies rules from research/validation_rules.json.
 * Returns structured errors (hard) and warnings (soft).
 * Callers must check errors.length === 0 before proceeding with computation.
 */

import type { ValuationInput, ValuationError } from './types'
import { VALUATION_CONFIG } from '@/config/valuation.config'

export interface ValidationResult {
  errors: ValuationError[]
  warnings: ValuationError[]
  canCompute: boolean
}

export function validateValuationInput(input: ValuationInput): ValidationResult {
  const errors: ValuationError[] = []
  const warnings: ValuationError[] = []
  const v = VALUATION_CONFIG.validation

  function addError(code: string, field: string, message: string, sourceRule: string) {
    errors.push({ code, severity: 'ERROR', field, message, sourceRule })
  }
  function addWarning(code: string, field: string, message: string, sourceRule: string) {
    warnings.push({ code, severity: 'WARNING', field, message, sourceRule })
  }

  // V1: terminal growth < WACC
  if (input.terminalG >= input.wacc) {
    addError(
      'V1',
      'terminalG',
      `Terminal growth rate (${(input.terminalG * 100).toFixed(2)}%) must be strictly less than WACC (${(input.wacc * 100).toFixed(2)}%). Value would be infinite.`,
      'ssrn-1025424 Error I.6.1; research/validation_rules.json V1',
    )
  }

  // V2: WACC positive
  if (input.wacc <= 0) {
    addError('V2', 'wacc', `WACC must be positive. Got ${input.wacc}.`, 'ssrn-1620871; research/validation_rules.json V2')
  }

  // V3: shares positive
  if (input.sharesOutstanding <= 0) {
    addError('V3', 'sharesOutstanding', 'Shares outstanding must be positive. Cannot compute per-share value.', 'research/validation_rules.json V3')
  }

  // V4: financial company + FCFF model
  if (input.companyType === 'financial' && input.baseFCF !== 0) {
    // Not a hard error — we still run FCFF but weight it at 5%. Issue a warning.
    addWarning(
      'W4_FINANCIAL',
      'companyType',
      `${input.companyName} is classified as a financial company. FCFF DCF is unreliable (distorted by loan flows). FCFE is the primary model. Source: ssrn-743229 §3.4; R1 in model_selection_rules.json`,
      'ssrn-743229 §3.4; research/model_selection_rules.json R1',
    )
  }

  // V5: RF rate bounds
  if (input.rfRate <= 0 || input.rfRate > v.maxRfRate) {
    addError('V5', 'rfRate', `Risk-free rate ${(input.rfRate * 100).toFixed(2)}% is outside plausible bounds [0.1%, 20%]. Check FRED data.`, 'ssrn-1025424 Error 1.A; research/validation_rules.json V5')
  }

  // W1: terminal growth > 3%
  if (input.terminalG > 0.03 && errors.find(e => e.code === 'V1') == null) {
    addWarning('W1', 'terminalG', `Terminal growth rate ${(input.terminalG * 100).toFixed(2)}% exceeds 3%. This implies perpetual growth faster than most economies.`, 'ssrn-1025424 Error I.6; research/validation_rules.json W1')
  }

  // W2: residual value dominance (estimated)
  if (input.evFromFCFF != null && input.evFromFCFF > 0 && input.baseFCF > 0) {
    const explicitPV = input.projectedFCFs
      ? input.projectedFCFs.reduce((s, p) => s + p.discounted, 0)
      : null
    if (explicitPV != null) {
      const residualPct = 1 - explicitPV / input.evFromFCFF
      if (residualPct > v.maxResidualValuePct) {
        addWarning('W2', 'residualValuePct', `Residual (terminal) value is ${(residualPct * 100).toFixed(0)}% of total EV. Small changes in terminal assumptions have outsized impact. Run sensitivity analysis.`, 'ssrn-1025424 §I.7; research/validation_rules.json W2')
      }
    }
  }

  // W3: negative FCF for non-startup/growth
  if (input.baseFCF < 0 && input.companyType !== 'startup' && input.companyType !== 'growth') {
    addWarning('W3', 'baseFCF', `Base FCF is negative ($${input.baseFCF.toFixed(0)}M) for a ${input.companyType} company. Valuation assumes FCF turns positive within the forecast period.`, 'ssrn-1025424 Error I.3; research/validation_rules.json W3')
  }

  // W4: extreme D/E
  if (input.debtToEquity > v.maxDebtToEquity) {
    addWarning('W4', 'debtToEquity', `D/E ratio of ${input.debtToEquity.toFixed(1)}x is very high. Verify that deposit liabilities (banks) or operating leases are not included as financial debt.`, 'calculateWACC.ts; ssrn-1620871; research/validation_rules.json W4')
  }

  // W5: extreme upside
  if (input.upsidePctFCFF != null && Math.abs(input.upsidePctFCFF) > v.maxUpsideMagnitude) {
    addWarning('W5', 'upsidePct', `Computed upside/downside of ${(input.upsidePctFCFF * 100).toFixed(0)}% is extreme. Verify FCF normalization and input data quality.`, 'ssrn-1025424 Error I.1; research/validation_rules.json W5')
  }

  // W6: consistency check (if both FCFF and FCFE are available)
  // Deferred — would require running both models first; done in engine.ts

  // W7: beta bounds
  if (input.beta < v.minBeta || input.beta > v.maxBeta) {
    addWarning('W7', 'beta', `Beta of ${input.beta.toFixed(2)} is outside typical range [${v.minBeta}, ${v.maxBeta}]. Regression may have insufficient history or the stock has very low liquidity.`, 'ssrn-1025424 Error 1.C; research/validation_rules.json W7')
  }

  // Additional: current price must be positive
  if (input.currentPrice <= 0) {
    addError('V_PRICE', 'currentPrice', 'Current price must be positive. Cannot compute upside.', 'basic')
  }

  return {
    errors,
    warnings,
    canCompute: errors.length === 0,
  }
}

/** Validate that terminal growth < WACC with configured buffer. Used inline in engine. */
export function guardTerminalGrowth(terminalG: number, wacc: number): number {
  const floor = Math.max(terminalG, 0)
  const ceiling = wacc - VALUATION_CONFIG.terminalGrowth.waccBuffer
  return Math.min(Math.max(floor, 0), ceiling)
}
