/**
 * Unit tests for Forward P/E, Revenue Multiple, Reverse DCF, and Scenario Blend
 * Run: npx jest lib/valuation/__tests__/methods.test.ts
 */

import { computeForwardPE } from '../methods/forwardPE'
import { computeRevenueMultiple } from '../methods/revenueMultiple'
import { computeReverseDCF } from '../methods/reverseDcf'
import { computeScenarioBlend } from '../methods/scenarioBlend'

// ── Forward P/E ───────────────────────────────────────────────────────────────

describe('computeForwardPE', () => {
  const base = {
    ltvRevenue: 100e9,         // $100B
    sharesOutstanding: 1e9,    // 1B shares
    revenueCAGR: 0.10,         // 10%/yr
    netMargin: 0.20,           // 20%
    exitPE: 20,
    dilutionRate: 0.01,
    discountRate: 0.09,
    currentPrice: 150,
    dividendYield: null,
    yearsToTarget: 5,
  }

  it('computes futureRevenue = LTM × (1+CAGR)^5', () => {
    const r = computeForwardPE(base)
    expect(r.futureRevenue).toBeCloseTo(100e9 * Math.pow(1.10, 5), -3)
  })

  it('computes futureNetIncome = futureRevenue × netMargin', () => {
    const r = computeForwardPE(base)
    expect(r.futureNetIncome).toBeCloseTo(r.futureRevenue! * 0.20, -3)
  })

  it('computes futureShares with dilution', () => {
    const r = computeForwardPE(base)
    expect(r.futureShares).toBeCloseTo(1e9 * Math.pow(1.01, 5), -3)
  })

  it('fairValueToday = targetPrice / (1+wacc)^5', () => {
    const r = computeForwardPE(base)
    expect(r.fairValueToday).toBeCloseTo(r.futureTargetPrice! / Math.pow(1.09, 5), 0)
  })

  it('target1Y = targetPrice discounted by 4 years', () => {
    const r = computeForwardPE(base)
    expect(r.target1Y).toBeCloseTo(r.futureTargetPrice! / Math.pow(1.09, 4), 0)
  })

  it('upsidePct = (fairValue - price) / price', () => {
    const r = computeForwardPE(base)
    expect(r.upsidePct).toBeCloseTo((r.fairValueToday! - 150) / 150, 4)
  })

  it('returns null results when any key input is null', () => {
    const r = computeForwardPE({ ...base, ltvRevenue: null })
    expect(r.fairValueToday).toBeNull()
    expect(r.guardErrors.length).toBeGreaterThan(0)
  })

  it('returns null when exitPE <= 0', () => {
    const r = computeForwardPE({ ...base, exitPE: 0 })
    expect(r.fairValueToday).toBeNull()
    expect(r.guardErrors).toContain('Exit P/E must be positive')
  })

  it('negative netMargin warns but does not crash', () => {
    const r = computeForwardPE({ ...base, netMargin: -0.10 })
    // result should be null or negative targetPrice guard
    expect(r.guardErrors.length).toBeGreaterThan(0)
  })

  it('does NOT convert null inputs to 0', () => {
    const r = computeForwardPE({ ...base, ltvRevenue: null })
    expect(r.futureRevenue).toBeNull()
    expect(r.futureNetIncome).toBeNull()
    expect(r.futureTargetPrice).toBeNull()
    expect(r.fairValueToday).toBeNull()
  })

  it('expectedReturnWithDivPct adds dividend yield to expected return', () => {
    const r1 = computeForwardPE({ ...base, dividendYield: 0.02 })
    const r2 = computeForwardPE({ ...base, dividendYield: null })
    expect(r1.expectedReturnWithDivPct).toBeCloseTo((r2.expectedReturnPct ?? 0) + 0.02, 4)
  })
})

// ── Revenue Multiple ──────────────────────────────────────────────────────────

describe('computeRevenueMultiple', () => {
  const base = {
    ltvRevenue: 50e9,
    revenueCAGR: 0.15,
    exitEVRevenue: 6,
    netDebt: 5e9,
    sharesOutstanding: 500e6,
    dilutionRate: 0.02,
    discountRate: 0.10,
    currentPrice: 100,
    dividendYield: null,
    yearsToTarget: 5,
  }

  it('computes futureEV = futureRevenue × multiple', () => {
    const r = computeRevenueMultiple(base)
    const expectedFutRev = 50e9 * Math.pow(1.15, 5)
    expect(r.futureEV).toBeCloseTo(expectedFutRev * 6, -3)
  })

  it('subtracts net debt from futureEV to get futureEquityValue', () => {
    const r = computeRevenueMultiple(base)
    expect(r.futureEquityValue).toBeCloseTo(r.futureEV! - 5e9, -3)
  })

  it('returns guard error when futureEquityValue is negative', () => {
    const r = computeRevenueMultiple({ ...base, netDebt: 1e15 }) // absurd debt
    expect(r.futureTargetPrice).toBeNull()
    expect(r.guardErrors.length).toBeGreaterThan(0)
  })

  it('null ltvRevenue → all null outputs', () => {
    const r = computeRevenueMultiple({ ...base, ltvRevenue: null })
    expect(r.fairValueToday).toBeNull()
    expect(r.futureRevenue).toBeNull()
  })

  it('handles netDebt=null by treating as 0 (unknown → no adjustment)', () => {
    const r1 = computeRevenueMultiple({ ...base, netDebt: null })
    const r2 = computeRevenueMultiple({ ...base, netDebt: 0 })
    expect(r1.fairValueToday).toBeCloseTo(r2.fairValueToday!, 0)
  })

  it('net cash (negative netDebt) increases fair value', () => {
    const rDebt  = computeRevenueMultiple({ ...base, netDebt: 5e9 })
    const rCash  = computeRevenueMultiple({ ...base, netDebt: -5e9 })
    expect(rCash.fairValueToday!).toBeGreaterThan(rDebt.fairValueToday!)
  })
})

// ── Reverse DCF ───────────────────────────────────────────────────────────────

describe('computeReverseDCF', () => {
  const base = {
    currentPrice: 200,
    sharesOutstanding: 1e9,
    cashM: 50e3,       // $50B cash (in millions → 50000)
    debtM: 20e3,       // $20B debt
    lastRevenue: 100e9,
    lastFCFMargin: 0.20,
    wacc: 0.09,
    terminalG: 0.025,
    historicalCAGR: 0.10,
  }

  it('returns a non-null impliedCAGR when inputs are valid', () => {
    const r = computeReverseDCF(base)
    expect(r.impliedCAGR).not.toBeNull()
    expect(r.guardErrors).toHaveLength(0)
  })

  it('impliedCAGR is a reasonable number (between -10% and 100%)', () => {
    const r = computeReverseDCF(base)
    expect(r.impliedCAGR!).toBeGreaterThanOrEqual(-0.10)
    expect(r.impliedCAGR!).toBeLessThanOrEqual(1.00)
  })

  it('higher price → higher required CAGR', () => {
    const rLow  = computeReverseDCF({ ...base, currentPrice: 100 })
    const rHigh = computeReverseDCF({ ...base, currentPrice: 400 })
    expect(rHigh.impliedCAGR!).toBeGreaterThan(rLow.impliedCAGR!)
  })

  it('returns not_meaningful when sharesOutstanding is null', () => {
    const r = computeReverseDCF({ ...base, sharesOutstanding: null })
    expect(r.interpretation).toBe('not_meaningful')
    expect(r.impliedCAGR).toBeNull()
  })

  it('returns not_meaningful when FCF margin is negative', () => {
    const r = computeReverseDCF({ ...base, lastFCFMargin: -0.05 })
    expect(r.interpretation).toBe('not_meaningful')
  })

  it('interpretation = conservative when implied CAGR << historicalCAGR', () => {
    // Small company priced cheaply → negative implied CAGR → below hist − 5pp
    const r = computeReverseDCF({
      currentPrice: 5, sharesOutstanding: 200e6,
      cashM: 500, debtM: 200,   // net cash so EV is very low
      lastRevenue: 2e9, lastFCFMargin: 0.15,
      wacc: 0.09, terminalG: 0.025,
      historicalCAGR: 0.15,
    })
    expect(r.interpretation).toBe('conservative')
  })

  it('interpretation = very_aggressive when implied CAGR >> historicalCAGR', () => {
    // Expensive company vs tiny revenue → very high implied CAGR
    const r = computeReverseDCF({
      currentPrice: 300, sharesOutstanding: 500e6,
      cashM: 500, debtM: 1000,
      lastRevenue: 1e9, lastFCFMargin: 0.05,
      wacc: 0.09, terminalG: 0.025,
      historicalCAGR: 0.05,
    })
    expect(r.interpretation).toBe('very_aggressive')
  })

  it('returns guardError when terminalG >= wacc', () => {
    const r = computeReverseDCF({ ...base, terminalG: 0.09, wacc: 0.09 })
    expect(r.guardErrors.length).toBeGreaterThan(0)
    expect(r.interpretation).toBe('not_meaningful')
  })
})

// ── Scenario Blend ────────────────────────────────────────────────────────────

describe('computeScenarioBlend', () => {
  const baseAssumptions = {
    ltvRevenue: 100e9, sharesOutstanding: 1e9, revenueCAGR: 0.10,
    netMargin: 0.20, exitPE: 20, dilutionRate: 0.01,
    discountRate: 0.09, currentPrice: 150, dividendYield: null,
  }

  const scenarios = [
    { label: 'bear' as const, probability: 0.25, methodId: 'forward_pe' as const, assumptions: { ...baseAssumptions, revenueCAGR: 0.05, netMargin: 0.15 } },
    { label: 'base' as const, probability: 0.50, methodId: 'forward_pe' as const, assumptions: { ...baseAssumptions, revenueCAGR: 0.10, netMargin: 0.20 } },
    { label: 'bull' as const, probability: 0.25, methodId: 'forward_pe' as const, assumptions: { ...baseAssumptions, revenueCAGR: 0.18, netMargin: 0.25 } },
  ]

  it('computes weighted fair value = Σ(fv × prob)', () => {
    const r = computeScenarioBlend(scenarios, 150)
    const [bear, base2, bull] = r.scenarios
    const expected = bear.fairValue! * 0.25 + base2.fairValue! * 0.50 + bull.fairValue! * 0.25
    expect(r.weightedFairValue).toBeCloseTo(expected, 0)
  })

  it('bull fair value > base fair value > bear fair value', () => {
    const r = computeScenarioBlend(scenarios, 150)
    const [bear, base2, bull] = r.scenarios
    expect(bull.fairValue!).toBeGreaterThan(base2.fairValue!)
    expect(base2.fairValue!).toBeGreaterThan(bear.fairValue!)
  })

  it('returns guard error when probabilities do not sum to 1', () => {
    const bad = scenarios.map((s, i) => ({ ...s, probability: i === 2 ? 0.35 : s.probability }))
    const r = computeScenarioBlend(bad, 150)
    expect(r.guardErrors.length).toBeGreaterThan(0)
  })

  it('weightedFairValue is null when any scenario has null fair value', () => {
    const brokenScenarios = [
      { label: 'bear' as const, probability: 0.25, methodId: 'forward_pe' as const, assumptions: { ...baseAssumptions, ltvRevenue: null } },
      { label: 'base' as const, probability: 0.50, methodId: 'forward_pe' as const, assumptions: baseAssumptions },
      { label: 'bull' as const, probability: 0.25, methodId: 'forward_pe' as const, assumptions: baseAssumptions },
    ]
    const r = computeScenarioBlend(brokenScenarios, 150)
    expect(r.weightedFairValue).toBeNull()
  })

  it('user assumption overrides produce different fair values', () => {
    const r1 = computeScenarioBlend(scenarios, 150)
    const modified = scenarios.map(s => ({
      ...s, assumptions: { ...s.assumptions, revenueCAGR: (s.assumptions.revenueCAGR as number) + 0.05 }
    }))
    const r2 = computeScenarioBlend(modified, 150)
    expect(r2.weightedFairValue!).toBeGreaterThan(r1.weightedFairValue!)
  })
})
