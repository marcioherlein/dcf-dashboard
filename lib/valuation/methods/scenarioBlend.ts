/**
 * Scenario Blend Engine
 *
 * Runs Bear / Base / Bull scenarios using Forward P/E or Revenue Multiple
 * and computes a probability-weighted fair value.
 */

import { computeForwardPE, type ForwardPEInputs } from './forwardPE'
import { computeRevenueMultiple, type RevenueMultipleInputs } from './revenueMultiple'

export type ScenarioMethodId = 'forward_pe' | 'revenue_multiple'

export interface ScenarioDefinition {
  label: 'bear' | 'base' | 'bull'
  probability: number           // 0–1; all three must sum to ~1.0
  methodId: ScenarioMethodId
  assumptions: ForwardPEInputs | RevenueMultipleInputs
}

export interface ScenarioOutcome {
  label: 'bear' | 'base' | 'bull'
  probability: number
  fairValue: number | null
  upsidePct: number | null
  guardErrors: string[]
}

export interface ScenarioBlendResult {
  scenarios: ScenarioOutcome[]
  weightedFairValue: number | null
  weightedUpsidePct: number | null
  currentPrice: number
  guardErrors: string[]
}

function runScenario(def: ScenarioDefinition): ScenarioOutcome {
  let fv: number | null = null
  let upside: number | null = null
  let errs: string[] = []

  if (def.methodId === 'forward_pe') {
    const r = computeForwardPE(def.assumptions as ForwardPEInputs)
    fv = r.fairValueToday; upside = r.upsidePct; errs = r.guardErrors
  } else {
    const r = computeRevenueMultiple(def.assumptions as RevenueMultipleInputs)
    fv = r.fairValueToday; upside = r.upsidePct; errs = r.guardErrors
  }

  return { label: def.label, probability: def.probability, fairValue: fv, upsidePct: upside, guardErrors: errs }
}

export function computeScenarioBlend(
  scenarios: ScenarioDefinition[],
  currentPrice: number,
): ScenarioBlendResult {
  const errors: string[] = []

  const totalProb = scenarios.reduce((s, sc) => s + sc.probability, 0)
  if (Math.abs(totalProb - 1.0) > 0.001) {
    errors.push(`Scenario probabilities sum to ${(totalProb * 100).toFixed(1)}% — must equal 100%`)
  }

  const outcomes = scenarios.map(runScenario)

  let weightedFV: number | null = null
  const allValid = outcomes.every(o => o.fairValue != null)
  if (allValid) {
    weightedFV = outcomes.reduce((sum, o) => sum + (o.fairValue! * o.probability), 0)
  }

  const weightedUpsidePct = weightedFV != null && currentPrice > 0
    ? (weightedFV - currentPrice) / currentPrice
    : null

  return {
    scenarios: outcomes,
    weightedFairValue: weightedFV,
    weightedUpsidePct,
    currentPrice,
    guardErrors: errors,
  }
}
