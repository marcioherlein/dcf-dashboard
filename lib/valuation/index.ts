/**
 * Public API for the valuation module.
 *
 * Usage:
 *   import { runValuation } from '@/lib/valuation'
 *   const result = runValuation(ticker, financialsApiResponse)
 *
 * Architecture:
 *   1. adapter.ts     — maps /api/financials output → ValuationInput
 *   2. validator.ts   — enforces hard rules; produces structured errors
 *   3. engine.ts      — runs models (FCFF, FCFE, DDM, multiples, triangulation)
 *   4. interpreter.ts — generates human-readable interpretation text
 *
 * Research sources:
 *   /research/valuation_framework.json   — 10 DCF methods + 9 VTS theories
 *   /research/model_selection_rules.json — when to use each model
 *   /research/assumption_hierarchy.json  — input source priority
 *   /research/validation_rules.json      — hard errors + warnings
 */

export { adaptFinancialsToValuationInput } from './adapter'
export { validateValuationInput, guardTerminalGrowth } from './validator'
export { runValuationEngine } from './engine'
export { buildValuationInterpretation } from './interpreter'

export type {
  ValuationInput,
  ValuationResult,
  ValuationError,
  ModelResult,
  MultiplesResult,
  TriangulatedResult,
  ValuationInterpretation,
  ScenarioOutput,
} from './types'

// Convenience entry point: adapter + engine in one call
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runValuation(ticker: string, financialsData: any) {
  const { adaptFinancialsToValuationInput: adapt } = require('./adapter')
  const { runValuationEngine: run } = require('./engine')
  const input = adapt(ticker, financialsData)
  return run(input)
}
