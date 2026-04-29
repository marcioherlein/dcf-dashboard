/**
 * Valuation engine.
 *
 * Orchestrates model computation:
 *   1. Validate inputs (validator.ts)
 *   2. Run FCFF DCF (D2: FCF/WACC — primary for non-financial companies)
 *   3. Run FCFE (D6 proxy — primary for financial companies)
 *   4. Run DDM (for dividend payers)
 *   5. Collect multiples (from pre-computed data)
 *   6. Triangulate weighted fair value
 *   7. Build interpretation (interpreter.ts)
 *
 * Source formulas:
 *   - D2 FCFF: ssrn-256987 eq[4],[5]; ssrn-1620871 eq[4],[5]
 *   - D6 FCFE proxy: ssrn-256987 eq[10]
 *   - DDM: Gordon Growth Model
 *   - Consistency check: ssrn-256987 §3; model_selection_rules R9
 */

import type {
  ValuationInput,
  ValuationResult,
  ModelResult,
  MultiplesResult,
  TriangulatedResult,
} from './types'
import { validateValuationInput, guardTerminalGrowth } from './validator'
import { buildValuationInterpretation } from './interpreter'
import { VALUATION_CONFIG } from '@/config/valuation.config'

export function runValuationEngine(input: ValuationInput): ValuationResult {
  const validation = validateValuationInput(input)

  // If hard errors exist, return immediately — no computation
  if (!validation.canCompute) {
    return {
      input,
      errors: validation.errors,
      warnings: validation.warnings,
      computed: false,
      fcff: null,
      fcfe: null,
      ddm: null,
      multiples: null,
      triangulated: null,
      interpretation: {
        summary: `Valuation could not be computed: ${validation.errors.map(e => e.message).join('; ')}`,
        primaryMethod: 'N/A',
        rationale: '',
        scenarioRange: '—',
        keyRisk: '',
        marginOfSafetyRecommendation: '',
      },
    }
  }

  // ── FCFF DCF (D2: FCF/WACC) ───────────────────────────────────────────────
  const fcffResult = computeFCFF(input)

  // ── FCFE proxy (for financial companies and when fcfeApplicable) ──────────
  const fcfeResult = computeFCFEProxy(input)

  // ── DDM ───────────────────────────────────────────────────────────────────
  const ddmResult = computeDDM(input)

  // ── Multiples ─────────────────────────────────────────────────────────────
  const multiplesResult = buildMultiplesResult(input)

  // ── Triangulation ─────────────────────────────────────────────────────────
  const triangulated = computeTriangulation(input, fcffResult, fcfeResult, ddmResult, multiplesResult)

  // ── Interpretation ─────────────────────────────────────────────────────────
  const interpretation = buildValuationInterpretation(input, { fcff: fcffResult, fcfe: fcfeResult, ddm: ddmResult, multiples: multiplesResult, triangulated })

  return {
    input,
    errors: validation.errors,
    warnings: validation.warnings,
    computed: true,
    fcff: fcffResult,
    fcfe: fcfeResult,
    ddm: ddmResult,
    multiples: multiplesResult,
    triangulated,
    interpretation,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FCFF/WACC DCF (Method D2 per ssrn-256987)
// Formula: E0+D0 = Σ FCFt / Π(1+WACCi)
// Consistency: Et+Dt = (Et-1+Dt-1)(1+WACCt) - FCFt
// ─────────────────────────────────────────────────────────────────────────────
function computeFCFF(input: ValuationInput): ModelResult {
  const { baseFCF, cagr, wacc, terminalG, cashM, totalDebtM, sharesOutstanding, currentPrice, growthModel, companyType } = input

  // For financial companies, FCFF is not the primary model — still compute but flag
  const notApplicable = companyType === 'financial'
  if (notApplicable) {
    return {
      modelId: 'D2_FCF_WACC',
      label: 'FCFF / WACC DCF',
      applicable: false,
      notApplicableReason: 'Financial company — FCFF distorted by loan book flows. Use FCFE. Source: ssrn-743229 §3.4; R1 in model_selection_rules.json.',
      fairValuePerShare: null,
      upsidePct: null,
      evM: null,
      equityValueM: null,
      assumptions: {},
      sourceFormula: 'ssrn-256987 eq[4],[5]; ssrn-1620871 eq[4],[5]',
    }
  }

  // If adapter already ran DCF (from /api/financials), reuse those results
  if (input.fairValuePerShareFCFF != null && input.fairValuePerShareFCFF > 0) {
    return {
      modelId: 'D2_FCF_WACC',
      label: 'FCFF / WACC DCF',
      applicable: true,
      fairValuePerShare: input.fairValuePerShareFCFF,
      upsidePct: input.upsidePctFCFF ?? null,
      evM: input.evFromFCFF ?? null,
      equityValueM: input.equityValueFromFCFF ?? null,
      assumptions: {
        baseFCF_M: baseFCF,
        cagr: cagr,
        wacc: wacc,
        terminalG: guardTerminalGrowth(terminalG, wacc),
        growthModel,
        cashM,
        debtM: totalDebtM,
      },
      sourceFormula: 'ssrn-256987 eq[4],[5]; ssrn-1620871 eq[4],[5]',
    }
  }

  // Fallback: compute DCF inline (simplified two-stage Gordon Growth)
  const g = guardTerminalGrowth(terminalG, wacc)
  const fcfYear1 = baseFCF * (1 + cagr)
  const stagePeriods = growthModel === 'three_stage' ? 10 : 5
  let pv = 0
  let projFCF = baseFCF

  for (let t = 1; t <= stagePeriods; t++) {
    projFCF = projFCF * (1 + cagr)
    pv += projFCF / Math.pow(1 + wacc, t)
  }

  // Terminal value (Gordon Growth): TV = FCF_{n+1} / (WACC - g)
  const terminalFCF = projFCF * (1 + g)
  const tv = terminalFCF / (wacc - g)
  const pvTV = tv / Math.pow(1 + wacc, stagePeriods)

  const evM = pv + pvTV
  const equityValueM = evM + cashM - totalDebtM
  const fairValuePerShare = sharesOutstanding > 0 ? equityValueM / sharesOutstanding : 0
  const upsidePct = currentPrice > 0 ? (fairValuePerShare - currentPrice) / currentPrice : 0

  return {
    modelId: 'D2_FCF_WACC',
    label: 'FCFF / WACC DCF',
    applicable: true,
    fairValuePerShare: Math.round(fairValuePerShare * 100) / 100,
    upsidePct: Math.round(upsidePct * 1000) / 1000,
    evM: Math.round(evM),
    equityValueM: Math.round(equityValueM),
    assumptions: {
      baseFCF_M: baseFCF,
      cagr,
      wacc,
      terminalG: g,
      growthModel,
      stagePeriods,
      terminalValue_M: Math.round(tv),
      tvAsPctOfEV: Math.round(pvTV / evM * 100),
      cashM,
      debtM: totalDebtM,
      fcfYear1_M: Math.round(fcfYear1),
    },
    sourceFormula: 'ssrn-256987 eq[4],[5]; ssrn-1620871 eq[4],[5]',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FCFE proxy (primary for financial companies)
// Uses net income as equity cash flow proxy — standard for banks.
// Source: detectCompanyType.ts primaryModelLabel; calculateFCFE.ts
// ─────────────────────────────────────────────────────────────────────────────
function computeFCFEProxy(input: ValuationInput): ModelResult {
  if (!input.fcfeApplicable) {
    return {
      modelId: 'D6_ECF_Ke',
      label: 'FCFE (Equity DCF)',
      applicable: false,
      notApplicableReason: 'FCFE not applicable or inputs unavailable.',
      fairValuePerShare: null,
      upsidePct: null,
      evM: null,
      equityValueM: null,
      assumptions: {},
      sourceFormula: 'ssrn-256987 eq[10]',
    }
  }

  // Reuse pre-computed FCFE from adapter (from api/financials)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fcfeData = (input as any).fcfeModel

  if (fcfeData?.fairValuePerShare != null) {
    return {
      modelId: 'D6_ECF_Ke',
      label: 'FCFE (Equity DCF)',
      applicable: true,
      fairValuePerShare: fcfeData.fairValuePerShare,
      upsidePct: fcfeData.upsidePct ?? null,
      evM: null,
      equityValueM: fcfeData.equityValueM ?? null,
      assumptions: {
        netIncomeM: input.netIncomeM,
        cagr: input.cagr,
        costOfEquity: input.costOfEquity,
        terminalG: input.terminalG,
      },
      sourceFormula: 'ssrn-256987 eq[10]; calculateFCFE.ts',
    }
  }

  return {
    modelId: 'D6_ECF_Ke',
    label: 'FCFE (Equity DCF)',
    applicable: false,
    notApplicableReason: 'FCFE data not returned from financials API.',
    fairValuePerShare: null,
    upsidePct: null,
    evM: null,
    equityValueM: null,
    assumptions: {},
    sourceFormula: 'ssrn-256987 eq[10]',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DDM (Gordon Growth)
// Formula: P = D1 / (Ke - g)
// Source: calculateDDM.ts
// ─────────────────────────────────────────────────────────────────────────────
function computeDDM(input: ValuationInput): ModelResult {
  if (!input.ddmApplicable || input.dividendPerShare <= 0) {
    return {
      modelId: 'DDM',
      label: 'Dividend Discount Model',
      applicable: false,
      notApplicableReason: input.dividendPerShare <= 0
        ? 'Company does not pay dividends.'
        : 'DDM not applicable.',
      fairValuePerShare: null,
      upsidePct: null,
      evM: null,
      equityValueM: null,
      assumptions: {},
      sourceFormula: 'Gordon Growth: P = D1 / (Ke - g)',
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ddmData = (input as any).ddmModel
  if (ddmData?.fairValuePerShare != null) {
    return {
      modelId: 'DDM',
      label: 'Dividend Discount Model',
      applicable: true,
      fairValuePerShare: ddmData.fairValuePerShare,
      upsidePct: ddmData.upsidePct ?? null,
      evM: null,
      equityValueM: null,
      assumptions: {
        dividendPerShare: input.dividendPerShare,
        dividendYield: input.dividendYield ?? 0,
        costOfEquity: input.costOfEquity,
        terminalG: input.terminalG,
      },
      sourceFormula: 'Gordon Growth: P = D1 / (Ke - g); calculateDDM.ts',
    }
  }

  return {
    modelId: 'DDM',
    label: 'Dividend Discount Model',
    applicable: false,
    notApplicableReason: 'DDM data not returned from financials API.',
    fairValuePerShare: null,
    upsidePct: null,
    evM: null,
    equityValueM: null,
    assumptions: {},
    sourceFormula: 'Gordon Growth: P = D1 / (Ke - g)',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiples cross-check
// Source: calculateMultiples.ts; research/model_selection_rules.json GROUP_B
// ─────────────────────────────────────────────────────────────────────────────
function buildMultiplesResult(input: ValuationInput): MultiplesResult | null {
  if (!input.multiplesApplicable) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (input as any).multiplesModel
  if (!m) return null

  const blendedFairValue = m.blendedFairValue ?? null
  const blendedUpsidePct = blendedFairValue != null && input.currentPrice > 0
    ? (blendedFairValue - input.currentPrice) / input.currentPrice
    : null

  return {
    peImplied: m.peImplied ?? null,
    pbImplied: m.pbImplied ?? null,
    evEbitdaImplied: m.evEbitdaImplied ?? null,
    evRevenueImplied: m.evRevenueImplied ?? null,
    blendedFairValue,
    blendedUpsidePct,
    source: 'calculateMultiples.ts; Damodaran Jan 2025 industry benchmarks',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Triangulation
// Applies weights from model_selection_rules.json multi_model_weights
// ─────────────────────────────────────────────────────────────────────────────
function computeTriangulation(
  input: ValuationInput,
  fcff: ModelResult,
  fcfe: ModelResult,
  ddm: ModelResult,
  multiples: MultiplesResult | null,
): TriangulatedResult | null {
  // Use pre-computed triangulation from adapter if available
  if (input.triangulatedFairValue != null && input.triangulatedFairValue > 0) {
    const fv = input.triangulatedFairValue
    const upside = input.triangulatedUpsidePct ?? 0
    const zone = getUpsideZone(upside)
    return {
      fairValue: fv,
      upsidePct: upside,
      weights: input.effectiveWeights ?? { fcff: 100, fcfe: 0, ddm: 0, multiples: 0 },
      upsideZone: zone.label,
      zoneColor: zone.color,
    }
  }

  // Fallback triangulation
  const candidates: Array<{ weight: number; value: number }> = []
  if (fcff.applicable && fcff.fairValuePerShare != null) {
    candidates.push({ weight: 65, value: fcff.fairValuePerShare })
  }
  if (fcfe.applicable && fcfe.fairValuePerShare != null) {
    candidates.push({ weight: input.companyType === 'financial' ? 65 : 0, value: fcfe.fairValuePerShare })
  }
  if (ddm.applicable && ddm.fairValuePerShare != null) {
    candidates.push({ weight: 15, value: ddm.fairValuePerShare })
  }
  if (multiples?.blendedFairValue != null) {
    candidates.push({ weight: 35, value: multiples.blendedFairValue })
  }

  if (candidates.length === 0) return null

  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0)
  const fv = candidates.reduce((s, c) => s + c.value * c.weight / totalWeight, 0)
  const roundedFV = Math.round(fv * 100) / 100
  const upside = input.currentPrice > 0 ? (roundedFV - input.currentPrice) / input.currentPrice : 0
  const zone = getUpsideZone(upside)

  return {
    fairValue: roundedFV,
    upsidePct: Math.round(upside * 1000) / 1000,
    weights: {
      fcff: fcff.applicable ? Math.round((65 / totalWeight) * 100) : 0,
      fcfe: fcfe.applicable ? Math.round((65 / totalWeight) * 100) : 0,
      ddm: ddm.applicable ? Math.round((15 / totalWeight) * 100) : 0,
      multiples: multiples?.blendedFairValue != null ? Math.round((35 / totalWeight) * 100) : 0,
    },
    upsideZone: zone.label,
    zoneColor: zone.color,
  }
}

function getUpsideZone(upsidePct: number): { label: 'Attractive' | 'Fair Value' | 'Expensive'; color: string } {
  const { attractive, fairValue } = VALUATION_CONFIG.upsideZones
  if (upsidePct >= attractive) return { label: 'Attractive', color: '#1f6feb' }
  if (upsidePct >= fairValue) return { label: 'Fair Value', color: '#9a6700' }
  return { label: 'Expensive', color: '#cf222e' }
}
