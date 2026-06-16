/**
 * Shadow Mode Logger
 *
 * When shadow mode is enabled, V1 and V2 are both computed.
 * V1 is shown to users. V2 results are logged internally for comparison.
 *
 * No PII is logged. Records:
 *   - V1 blended fair value
 *   - V2 blended fair value
 *   - % difference
 *   - company type
 *   - model statuses
 *   - warnings
 *   - missing inputs
 *   - terminal value share
 *   - confidence
 */

import type { CockpitOutput } from './cockpit'

export interface ShadowComparisonRecord {
  timestamp:         string
  ticker?:           string   // optional — include only if caller explicitly provides
  companyType?:      string
  v1FairValue:       number | null
  v2FairValue:       number | null
  pctDifference:     number | null
  v1Verdict:         string
  v2Verdict:         string
  v1Confidence:      string
  v2Confidence:      string
  v1MethodCount:     number
  v2MethodCount:     number
  v2DataWarnings:    string[]
  terminalValueShare?: number | null
  largeDiscrepancy:  boolean   // |pctDiff| > threshold
}

const LARGE_DISCREPANCY_THRESHOLD = 0.15  // 15% difference flags for review

export function buildShadowRecord(
  v1: CockpitOutput,
  v2: CockpitOutput,
  context?: { ticker?: string; companyType?: string },
): ShadowComparisonRecord {
  const pctDiff = (v1.blendedFairValue != null && v2.blendedFairValue != null && v1.blendedFairValue !== 0)
    ? (v2.blendedFairValue - v1.blendedFairValue) / Math.abs(v1.blendedFairValue)
    : null

  // Extract V2 data warnings from the divergence summary (V2 appends them there)
  const v2Warnings = v2.methods
    .flatMap(m => (m.meta as Record<string, unknown>)?.dataWarnings as string[] ?? [])
    .filter(Boolean)

  const terminalValueShare = v2.methods
    .map(m => (m.meta as Record<string, unknown>)?.terminalValueShare as number | undefined)
    .find(v => v != null) ?? null

  return {
    timestamp:         new Date().toISOString(),
    ticker:            context?.ticker,
    companyType:       context?.companyType,
    v1FairValue:       v1.blendedFairValue,
    v2FairValue:       v2.blendedFairValue,
    pctDifference:     pctDiff != null ? Math.round(pctDiff * 10000) / 10000 : null,
    v1Verdict:         v1.verdict,
    v2Verdict:         v2.verdict,
    v1Confidence:      v1.divergence.overallConfidence,
    v2Confidence:      v2.divergence.overallConfidence,
    v1MethodCount:     v1.methods.filter(m => m.fairValue != null).length,
    v2MethodCount:     v2.methods.filter(m => m.fairValue != null).length,
    v2DataWarnings:    v2Warnings,
    terminalValueShare,
    largeDiscrepancy:  pctDiff != null && Math.abs(pctDiff) > LARGE_DISCREPANCY_THRESHOLD,
  }
}

/**
 * Log the shadow comparison record.
 * In production this would write to a telemetry store.
 * Currently writes to structured console output so it can be captured by log aggregators.
 */
export function logShadowComparison(record: ShadowComparisonRecord): void {
  // Use a structured format that log aggregators can parse
  const output = {
    event:    'valuation_shadow_comparison',
    ...record,
  }

  // Only log in server environments (not in browser bundles)
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output))
  }

  // If a large discrepancy is detected, emit a more visible warning
  if (record.largeDiscrepancy) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ValuationShadow] Large discrepancy detected: ` +
      `V1=${record.v1FairValue?.toFixed(2)} V2=${record.v2FairValue?.toFixed(2)} ` +
      `diff=${record.pctDifference != null ? (record.pctDifference * 100).toFixed(1) + '%' : 'N/A'} ` +
      `companyType=${record.companyType ?? 'unknown'}`
    )
  }
}
