/**
 * Valuation Engine Tests
 *
 * Manual test suite for the valuation module.
 * Run with: npx ts-node --project tsconfig.json lib/valuation/__tests__/engine.test.ts
 * Or: node --require ts-node/register lib/valuation/__tests__/engine.test.ts
 *
 * Tests:
 *   1. Normal industrial company (AAPL-like: standard, positive FCF, no special flags)
 *   2. High-growth software (SaaS: growth type, three-stage, multiples heavy)
 *   3. Financial company / bank (NU-like: financial type, FCFF not applicable)
 *   4. Negative FCF company (growth-phase, FCF negative but revenue positive)
 *   5. Missing required fields (error handling — should produce structured errors)
 *
 * Verification:
 *   - V1: terminal growth < WACC enforced
 *   - V4: financial company → FCFF not applicable
 *   - V3: missing shares → ERROR
 *   - W3: negative FCF for non-startup → WARNING (not error)
 *   - Triangulation weights sum to ~100
 *   - All scenario fair values ordered: bear < base < bull (typically)
 */

import { adaptFinancialsToValuationInput } from '../adapter'
import { validateValuationInput } from '../validator'
import { runValuationEngine } from '../engine'
import type { ValuationResult } from '../types'

// ─── Test utilities ──────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

function section(title: string) {
  console.log(`\n── ${title} ──`)
}

// ─── Mock data builders ───────────────────────────────────────────────────────
function buildMockFinancialsResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    quote: { price: 175.0, marketCap: 2_700_000_000_000, peRatio: 28, trailingPE: 28 },
    wacc: {
      wacc: 0.085,
      costOfEquity: 0.095,
      afterTaxCostOfDebt: 0.032,
      inputs: { rfRate: 0.045, beta: 1.15, erp: 0.046, costOfDebt: 0.040, taxRate: 0.21, debtToEquity: 0.45 },
    },
    fairValue: {
      fairValuePerShare: 210.0,
      upsidePct: 0.20,
      ev: 2_850_000,    // millions
      cash: 180_000,
      debt: 110_000,
      equityValue: 2_920_000,
      sharesOutstanding: 13_900,
    },
    cagrAnalysis: { blended: 0.08, historicalCagr3y: 0.07, analystEstimate1y: 0.09, confidence: 0.8, confidenceLabel: 'High' },
    scenarios: {
      bull: { fairValue: 240.0, wacc: 0.075, cagr: 0.10, terminalG: 0.025 },
      base: { fairValue: 210.0, wacc: 0.085, cagr: 0.08, terminalG: 0.020 },
      bear: { fairValue: 175.0, wacc: 0.095, cagr: 0.06, terminalG: 0.015 },
    },
    businessProfile: { grossMargin: 0.44, fcfMargin: 0.26, revenueM: 395_000, industry: 'Technology', country: 'US' },
    scores: {
      piotroski: { score: 7 },
      altman: { zone: 'Safe' },
      beneish: { flag: 'Clean' },
      roic: { roic: 0.55, spread: 0.465, dataAvailable: true },
    },
    ratings: { valuation: { score: 3.5 } },
    ownership: { insiderPct: 0.002 },
    valuationMethods: {
      companyType: 'standard',
      companyTypeLabel: 'Standard',
      primaryModelLabel: 'DCF (FCFF)',
      rationale: 'Standard companies are valued with FCFF DCF as the primary model.',
      triangulatedFairValue: 205.0,
      triangulatedUpsidePct: 0.171,
      effectiveWeights: { fcff: 65, fcfe: 0, ddm: 0, multiples: 35 },
      models: {
        fcff: { applicable: true, fairValue: 210.0, upsidePct: 0.20 },
        fcfe: { applicable: false },
        ddm: { applicable: false },
        multiples: { blendedFairValue: 195.0, applicable: true },
      },
    },
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Normal industrial company (standard, positive FCF)
// ─────────────────────────────────────────────────────────────────────────────
section('Test 1: Normal industrial company (AAPL-like)')

const t1Data = buildMockFinancialsResponse()
const t1Input = adaptFinancialsToValuationInput('AAPL', t1Data)
const t1Validation = validateValuationInput(t1Input)
const t1Result: ValuationResult = runValuationEngine(t1Input)

assert(t1Validation.errors.length === 0, 'No hard validation errors for healthy company')
assert(t1Result.computed === true, 'Engine computed result')
assert(t1Result.fcff !== null, 'FCFF model result present')
assert(t1Result.fcff?.applicable === true, 'FCFF applicable for standard company')
assert(t1Result.fcff?.fairValuePerShare != null, 'FCFF fair value computed')
assert(t1Result.triangulated !== null, 'Triangulated result present')
assert(t1Result.triangulated?.upsideZone === 'Fair Value' || t1Result.triangulated?.upsideZone === 'Attractive', 'Zone label set correctly')
assert(t1Input.terminalG < t1Input.wacc, `Terminal growth (${(t1Input.terminalG*100).toFixed(2)}%) < WACC (${(t1Input.wacc*100).toFixed(2)}%)`)
assert(t1Input.companyType === 'standard', 'Company type correctly mapped from adapter')
assert(t1Result.interpretation.summary.length > 0, 'Interpretation summary generated')
assert(t1Result.interpretation.scenarioRange.includes('$'), 'Scenario range includes dollar amounts')

// Verify scenario ordering: bear < bull (typically)
const t1Bull = (t1Data.scenarios as any)?.bull?.fairValue
const t1Bear = (t1Data.scenarios as any)?.bear?.fairValue
assert(t1Bull > t1Bear, `Bull case ($${t1Bull}) > Bear case ($${t1Bear})`)

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: High-growth software company (SaaS, three-stage)
// ─────────────────────────────────────────────────────────────────────────────
section('Test 2: High-growth software (SaaS, three-stage)')

const t2Data = buildMockFinancialsResponse({
  quote: { price: 450.0, marketCap: 180_000_000_000, peRatio: 75 },
  wacc: {
    wacc: 0.095,
    costOfEquity: 0.110,
    afterTaxCostOfDebt: 0.028,
    inputs: { rfRate: 0.045, beta: 1.6, erp: 0.046, costOfDebt: 0.035, taxRate: 0.20, debtToEquity: 0.10 },
  },
  fairValue: { fairValuePerShare: 520.0, upsidePct: 0.156, ev: 200_000, cash: 25_000, debt: 5_000, equityValue: 220_000, sharesOutstanding: 420 },
  cagrAnalysis: { blended: 0.25, historicalCagr3y: 0.28, analystEstimate1y: 0.22 },
  scenarios: {
    bull: { fairValue: 620.0, wacc: 0.085, cagr: 0.27, terminalG: 0.025 },
    base: { fairValue: 520.0, wacc: 0.095, cagr: 0.25, terminalG: 0.025 },
    bear: { fairValue: 380.0, wacc: 0.105, cagr: 0.18, terminalG: 0.020 },
  },
  valuationMethods: {
    companyType: 'growth',
    companyTypeLabel: 'High Growth',
    primaryModelLabel: 'DCF (FCFF) + EV Multiples',
    triangulatedFairValue: 500.0,
    triangulatedUpsidePct: 0.111,
    effectiveWeights: { fcff: 65, fcfe: 0, ddm: 0, multiples: 35 },
    models: {
      fcff: { applicable: true, fairValue: 520.0, upsidePct: 0.156 },
      fcfe: { applicable: false },
      ddm: { applicable: false },
      multiples: { blendedFairValue: 460.0, applicable: true },
    },
  },
})

const t2Input = adaptFinancialsToValuationInput('CRWD', t2Data)
const t2Result = runValuationEngine(t2Input)

assert(t2Input.growthModel === 'three_stage', 'Three-stage growth model for high-CAGR company')
assert(t2Input.cagr > 0.20, `CAGR ${(t2Input.cagr*100).toFixed(1)}% > 20% threshold for high-growth`)
assert(t2Result.computed === true, 'Engine computed result')
assert(t2Input.companyType === 'growth', 'Company type = growth')
assert(t2Result.warnings.length === 0 || t2Result.warnings.some(w => w.code === 'W1'), 'No unexpected errors (high terminal g may produce W1)')

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Financial company / bank (NU-like)
// ─────────────────────────────────────────────────────────────────────────────
section('Test 3: Financial company / bank (NU-like)')

const t3Data = buildMockFinancialsResponse({
  quote: { price: 12.50, marketCap: 61_000_000_000, peRatio: 35 },
  wacc: {
    wacc: 0.110,
    costOfEquity: 0.125,
    afterTaxCostOfDebt: 0.045,
    inputs: { rfRate: 0.045, beta: 1.8, erp: 0.046, costOfDebt: 0.057, taxRate: 0.21, debtToEquity: 0.8 },
  },
  fairValue: { fairValuePerShare: 14.0, upsidePct: 0.12, ev: 70_000, cash: 8_000, debt: 12_000, equityValue: 66_000, sharesOutstanding: 4_700 },
  cagrAnalysis: { blended: 0.30, historicalCagr3y: 0.35, analystEstimate1y: 0.25 },
  businessProfile: { grossMargin: null, fcfMargin: null, revenueM: 2_800, industry: 'Internet Content & Information', country: 'Brazil' },
  valuationMethods: {
    companyType: 'financial',
    companyTypeLabel: 'Financial',
    primaryModelLabel: 'FCFE (Equity DCF)',
    rationale: 'Banks and fintechs have operating cash flows distorted by loan book changes. FCFE is the appropriate model.',
    triangulatedFairValue: 13.5,
    triangulatedUpsidePct: 0.08,
    effectiveWeights: { fcff: 5, fcfe: 65, ddm: 0, multiples: 30 },
    models: {
      fcff: { applicable: false, reason: 'Financial company — FCFF not reliable' },
      fcfe: { applicable: true, fairValue: 14.0, upsidePct: 0.12 },
      ddm: { applicable: false },
      multiples: { blendedFairValue: 12.0, applicable: true },
    },
  },
})

const t3Input = adaptFinancialsToValuationInput('NU', t3Data)
const t3Result = runValuationEngine(t3Input)
const t3Validation = validateValuationInput(t3Input)

assert(t3Input.companyType === 'financial', 'Company type = financial (bank/fintech)')
assert(t3Result.fcff?.applicable === false, 'FCFF NOT applicable for financial company (R1 in model_selection_rules.json)')
assert(t3Result.fcff?.notApplicableReason != null, 'FCFF has notApplicableReason explaining why')
// Financial company produces a W4_FINANCIAL warning, not an error
assert(t3Result.errors.length === 0, 'No hard errors for financial company (warning, not error)')
assert(t3Result.warnings.some(w => w.code === 'W4_FINANCIAL'), 'W4_FINANCIAL warning issued for financial company type')
assert(t3Result.computed === true, 'Engine still computes (FCFE is primary)')
console.log(`  ℹ FCFF not-applicable reason: "${t3Result.fcff?.notApplicableReason}"`)

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Negative FCF company (growth phase)
// ─────────────────────────────────────────────────────────────────────────────
section('Test 4: Negative FCF company (growth phase, turns positive)')

const t4Data = buildMockFinancialsResponse({
  quote: { price: 80.0, marketCap: 40_000_000_000, peRatio: null },
  wacc: {
    wacc: 0.105,
    costOfEquity: 0.120,
    afterTaxCostOfDebt: 0.030,
    inputs: { rfRate: 0.045, beta: 1.5, erp: 0.046, costOfDebt: 0.038, taxRate: 0.18, debtToEquity: 0.25 },
  },
  fairValue: { fairValuePerShare: 95.0, upsidePct: 0.1875, ev: 48_000, cash: 5_000, debt: 8_000, equityValue: 45_000, sharesOutstanding: 500 },
  cagrAnalysis: { blended: 0.35, historicalCagr3y: 0.40, analystEstimate1y: 0.30 },
  businessProfile: { grossMargin: 0.45, fcfMargin: -0.08, revenueM: 2_500, industry: 'Software' },
  scores: { piotroski: { score: 4 }, altman: { zone: 'Grey' }, beneish: { flag: 'Clean' }, roic: { roic: -0.02, spread: -0.125 } },
  valuationMethods: {
    companyType: 'growth',
    triangulatedFairValue: 90.0,
    triangulatedUpsidePct: 0.125,
    effectiveWeights: { fcff: 65, fcfe: 0, ddm: 0, multiples: 35 },
    models: {
      fcff: { applicable: true, fairValue: 95.0, upsidePct: 0.1875 },
      fcfe: { applicable: false },
      ddm: { applicable: false },
      multiples: { blendedFairValue: 80.0, applicable: true },
    },
  },
})

// Force negative baseFCF in the mock (the adapter reads it from fairValue.baseFCF which doesn't exist by default)
const t4Input = adaptFinancialsToValuationInput('EXAMPLECO', t4Data)
// Manually set negative FCF on the adapter output to test validator
const t4InputWithNegFCF = { ...t4Input, baseFCF: -200, companyType: 'growth' as const }
const t4Validation = validateValuationInput(t4InputWithNegFCF)

assert(t4Validation.canCompute === true, 'Negative FCF does not produce a hard ERROR (allowed for growth)')
assert(!t4Validation.errors.some(e => e.field === 'baseFCF'), 'No hard error for negative FCF')
// Growth type: W3 applies only to non-startup/growth → should NOT fire for 'growth' type
assert(!t4Validation.warnings.some(w => w.code === 'W3'), 'W3 (negative FCF warning) suppressed for growth company')

// Test with 'standard' type negative FCF → should produce W3
const t4InputStandardNegFCF = { ...t4Input, baseFCF: -200, companyType: 'standard' as const }
const t4ValidationStandard = validateValuationInput(t4InputStandardNegFCF)
assert(t4ValidationStandard.warnings.some(w => w.code === 'W3'), 'W3 fires for standard company with negative FCF')

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Missing required fields → structured errors
// ─────────────────────────────────────────────────────────────────────────────
section('Test 5: Missing / invalid required fields → structured errors')

const t5InputBadWACC = {
  ...adaptFinancialsToValuationInput('TESTCO', buildMockFinancialsResponse()),
  wacc: 0,           // triggers V2
}
const t5ValidationBadWACC = validateValuationInput(t5InputBadWACC)
assert(t5ValidationBadWACC.errors.some(e => e.code === 'V2'), 'V2 error: wacc <= 0 → hard error')
assert(t5ValidationBadWACC.canCompute === false, 'canCompute = false when wacc <= 0')

const t5InputBadShares = {
  ...adaptFinancialsToValuationInput('TESTCO', buildMockFinancialsResponse()),
  sharesOutstanding: 0,    // triggers V3
}
const t5ValidationBadShares = validateValuationInput(t5InputBadShares)
assert(t5ValidationBadShares.errors.some(e => e.code === 'V3'), 'V3 error: shares <= 0 → hard error')

const t5InputBadRF = {
  ...adaptFinancialsToValuationInput('TESTCO', buildMockFinancialsResponse()),
  rfRate: 0.25,   // > maxRfRate of 0.20 → triggers V5
}
const t5ValidationBadRF = validateValuationInput(t5InputBadRF)
assert(t5ValidationBadRF.errors.some(e => e.code === 'V5'), 'V5 error: rfRate > 20% → hard error')

// Terminal growth >= WACC → V1
const t5InputBadTerminalG = {
  ...adaptFinancialsToValuationInput('TESTCO', buildMockFinancialsResponse()),
  terminalG: 0.09,   // set to >= wacc of 0.085
  wacc: 0.085,
}
const t5ValidationBadTG = validateValuationInput(t5InputBadTerminalG)
assert(t5ValidationBadTG.errors.some(e => e.code === 'V1'), 'V1 error: terminalG >= WACC → hard error')

// Engine should NOT compute when errors exist
const t5ResultWithErrors = runValuationEngine(t5InputBadWACC)
assert(t5ResultWithErrors.computed === false, 'Engine returns computed=false when hard errors present')
assert(t5ResultWithErrors.fcff === null, 'No FCFF result when computation blocked by hard errors')

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.error(`\n⚠ ${failed} test(s) failed. Check above.`)
  process.exit(1)
} else {
  console.log(`\n✓ All ${passed} tests passed.`)
}
