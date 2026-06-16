/**
 * V2 → V1 CockpitOutput Adapter
 *
 * Converts V2 internal results to the V1 CockpitOutput contract so that
 * existing frontend components continue to work without changes.
 *
 * Additional V2 information is carried in optional fields only:
 *   - engineVersion: 'v2' marker
 *   - divergence.summary: appended with V2 diagnostics
 *
 * This adapter is the ONLY bridge between V2 outputs and existing consumers.
 * Do not access V2 internals directly from UI components.
 */

import type {
  CockpitOutput,
  ValuationAssumptions,
  CockpitSnapshot as CockpitSnapshotV1,
  CockpitMethodResult,
  DivergenceAnalysis,
} from '../cockpit'
import {
  computeFCFFDcfV2,
  buildFCFFInputsFromV1Snapshot,
  type FCFFDcfResultV2,
} from './fcffDcf'
import { computeEnterpriseBridgeV1Compat } from './enterpriseValueBridge'
import { computeCockpitOutput as computeCockpitOutputV1 } from '../cockpit'

// ─── V2 implementation (stub — progressively replaces V1 models) ──────────────

/**
 * The V2 implementation.
 * Currently: runs the corrected FCFF DCF and blends it with V1 for remaining methods.
 * Output shape is always the V1 CockpitOutput contract (backward compatible).
 *
 * @internal — called by computeCockpitOutputV2 in cockpit.ts
 */
export function computeCockpitOutputV2Impl(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshotV1,
): CockpitOutput {
  const dataWarnings: string[] = []

  // ── 1. Run V1 as baseline (all methods except core DCF) ──────────────────

  const v1Result = computeCockpitOutputV1(assumptions, snapshot)

  // ── 2. Attempt V2 corrected FCFF DCF ─────────────────────────────────────

  const fcffInputs = buildFCFFInputsFromV1Snapshot(snapshot, assumptions)
  let v2FcffResult: FCFFDcfResultV2 | null = null

  if (fcffInputs != null) {
    try {
      v2FcffResult = computeFCFFDcfV2(fcffInputs)
      dataWarnings.push(...v2FcffResult.warnings)
    } catch (err) {
      dataWarnings.push(`V2_FCFF_ERROR: ${String(err)}`)
    }
  } else {
    dataWarnings.push('V2_FCFF_SKIPPED: Insufficient revenue data for V2 FCFF DCF')
  }

  // ── 3. Build updated methods array ────────────────────────────────────────
  //
  // Replace the 'core_dcf' method result with the V2 FCFF result.
  // All other methods (forward_pe, ev_ebitda, revenue_multiple, epv) stay as V1.

  let updatedMethods = [...v1Result.methods]

  if (v2FcffResult != null && v2FcffResult.fairValuePerShareGordon != null) {
    const v2DcfFairValue = v2FcffResult.fairValuePerShareGordon
    const v2Upside = snapshot.currentPrice > 0
      ? (v2DcfFairValue - snapshot.currentPrice) / snapshot.currentPrice
      : null

    // Find and replace the core_dcf method, or append if not present
    const dcfIdx = updatedMethods.findIndex(m => m.id === 'core_dcf')
    const v2DcfMethod: CockpitMethodResult = {
      id:          'core_dcf_v2',
      method:      'FCFF DCF (V2)',
      fairValue:   v2DcfFairValue,
      weight:      dcfIdx >= 0 ? updatedMethods[dcfIdx].weight : 0.15,
      confidence:  confidenceFromDiagnostics(v2FcffResult),
      description: 'Corrected FCFF DCF: NOPAT − Reinvestment, terminal value via Gordon Growth on FCFF₁₀',
      upsidePct:   v2Upside,
      errors:      [],
      meta:        {
        terminalValueShare:      v2FcffResult.terminalValueShareGordon,
        impliedTerminalEVEBITDA: v2FcffResult.impliedTerminalEVEBITDA,
        enterpriseValueM:        v2FcffResult.enterpriseValueGordon,
        dataWarnings:            v2FcffResult.warnings,
        engineVersion:           'v2',
      },
    }

    if (dcfIdx >= 0) {
      updatedMethods[dcfIdx] = v2DcfMethod
    } else {
      updatedMethods.push(v2DcfMethod)
    }
  }

  // ── 4. Recompute blended fair value with V2 DCF ───────────────────────────

  const validMethods = updatedMethods.filter(m => m.fairValue != null && m.fairValue > 0)
  const totalWeight  = validMethods.reduce((s, m) => s + m.weight, 0)

  let blendedFairValue: number | null = v1Result.blendedFairValue
  if (validMethods.length > 0 && totalWeight > 0) {
    blendedFairValue = validMethods.reduce((s, m) => s + (m.fairValue ?? 0) * m.weight, 0) / totalWeight
    blendedFairValue = Math.round(blendedFairValue * 100) / 100
  }

  // ── 5. Recompute upside / verdict ─────────────────────────────────────────

  const upsidePct = blendedFairValue != null && snapshot.currentPrice > 0
    ? (blendedFairValue - snapshot.currentPrice) / snapshot.currentPrice
    : v1Result.upsidePct

  let verdict: CockpitOutput['verdict'] = 'Insufficient Data'
  if (upsidePct != null) {
    if (upsidePct >= 0.20)      verdict = 'Undervalued'
    else if (upsidePct >= 0.00) verdict = 'Fairly Valued'
    else                         verdict = 'Overvalued'
  }

  // ── 6. Carry V2 diagnostics in divergence summary (backward compat) ───────

  const v2DiagNote = v2FcffResult != null
    ? ` | V2 FCFF DCF: ${v2FcffResult.fairValuePerShareGordon?.toFixed(2) ?? 'N/A'}`
    : ' | V2 FCFF DCF: skipped (insufficient data)'

  const updatedDivergence: DivergenceAnalysis = {
    ...v1Result.divergence,
    summary: v1Result.divergence.summary + v2DiagNote,
  }

  // ── 7. Return V1-compatible output ────────────────────────────────────────

  return {
    ...v1Result,
    blendedFairValue,
    methods:   updatedMethods,
    upsidePct,
    verdict,
    divergence: updatedDivergence,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceFromDiagnostics(result: FCFFDcfResultV2): 'high' | 'medium' | 'low' {
  const tvShare = result.terminalValueShareGordon ?? 0
  const hasWarnings = result.warnings.length > 0

  if (tvShare > 0.85 || hasWarnings) return 'low'
  if (tvShare > 0.70)                return 'medium'
  return 'high'
}
