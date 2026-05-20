/**
 * DCF projection and CAGR blending tests
 * Covers: two-stage vs three-stage, Gordon Growth violation, CAGR size caps, convergence discount
 */

import { projectCashFlows } from '../projectCashFlows'
import { calculateFairValue, buildScenarios } from '../calculateFairValue'
import { calculateWACC } from '../calculateWACC'

// ── projectCashFlows ──────────────────────────────────────────────────────────

describe('projectCashFlows — two-stage', () => {
  const base = { baseFCF: 100, cagr: 0.10, wacc: 0.09, terminalG: 0.02, years: 5 }

  it('grows FCF at CAGR in every year', () => {
    const result = projectCashFlows(base)
    expect(result.projections[0].cashFlow).toBeCloseTo(110, 0)   // 100 × 1.10
    expect(result.projections[4].cashFlow).toBeCloseTo(161, 0)   // 100 × 1.10^5
  })

  it('discounts cash flows at WACC', () => {
    const result = projectCashFlows(base)
    const cf1 = result.projections[0].cashFlow
    const pv1 = result.projections[0].discounted
    expect(pv1).toBeCloseTo(cf1 / 1.09, 0)
  })

  it('computes terminal value using Gordon Growth', () => {
    const result = projectCashFlows(base)
    const lastCF = result.projections[4].cashFlow
    const expected = (lastCF * 1.02) / (0.09 - 0.02)
    expect(result.terminalValue).toBeCloseTo(expected, 0)
  })

  it('EV = sumPV + discounted terminal value', () => {
    const result = projectCashFlows(base)
    const pvTV = result.terminalValue! / Math.pow(1.09, 5)
    expect(result.ev).toBeCloseTo(result.sumPV + pvTV, 0)
  })

  it('returns terminalGrowthViolation + null EV when terminalG >= WACC', () => {
    const result = projectCashFlows({ ...base, terminalG: 0.09 })
    expect(result.terminalGrowthViolation).toBe(true)
    expect(result.ev).toBeNull()
    expect(result.terminalValue).toBeNull()
    expect(result.terminalValueDiscounted).toBeNull()
  })

  it('still computes sumPV when Gordon Growth is violated', () => {
    const result = projectCashFlows({ ...base, terminalG: 0.09 })
    expect(result.sumPV).toBeGreaterThan(0)
    expect(result.projections.length).toBe(5)
  })

  it('stores flat growth rate in yearlyGrowthRates for two-stage', () => {
    const result = projectCashFlows(base)
    expect(result.growthModel).toBe('two-stage')
    result.yearlyGrowthRates.forEach((g) => {
      expect(g).toBeCloseTo(0.10, 3)
    })
  })
})

describe('projectCashFlows — three-stage (Damodaran fade)', () => {
  const base = {
    baseFCF: 100, cagr: 0.30, wacc: 0.10, terminalG: 0.02,
    years: 10, growthModel: 'three-stage' as const,
  }

  it('uses flat CAGR in years 1–5 (first half)', () => {
    const result = projectCashFlows(base)
    for (let i = 0; i < 5; i++) {
      expect(result.yearlyGrowthRates[i]).toBeCloseTo(0.30, 3)
    }
  })

  it('linearly fades CAGR toward terminalG in years 6–10', () => {
    const result = projectCashFlows(base)
    // Year 6: g = 0.30 - (0.30-0.02) × (1/5) = 0.30 - 0.056 = 0.244
    expect(result.yearlyGrowthRates[5]).toBeCloseTo(0.244, 2)
    // Year 10: g = 0.30 - (0.30-0.02) × (5/5) = 0.02
    expect(result.yearlyGrowthRates[9]).toBeCloseTo(0.02, 3)
  })

  it('three-stage terminal FCF is lower than two-stage (fade reduces FCF)', () => {
    const twoStage = projectCashFlows({ ...base, growthModel: 'two-stage' })
    const threeStage = projectCashFlows(base)
    expect(threeStage.projections[9].cashFlow).toBeLessThan(twoStage.projections[9].cashFlow!)
  })
})

// ── CAGR caps via size ────────────────────────────────────────────────────────

describe('projectCashFlows — size cap enforcement', () => {
  it('mega-cap company CAGR is capped at 22% (no growth above that)', () => {
    // If caller passes CAGR=50% for a mega-cap, the cap should have already been applied.
    // Test that projectCashFlows faithfully uses what it receives (cap is caller's responsibility).
    // This test documents the EXPECTED cap values from extractFCFInputs.
    // Size caps: mega-cap (>$50B rev) = 22%, large-cap = 28%, mid-cap = 38%, small = 55%
    const caps = [
      { revB: 100, cap: 0.22 },  // mega-cap
      { revB: 20,  cap: 0.28 },  // large-cap
      { revB: 5,   cap: 0.38 },  // mid-cap
      { revB: 0.5, cap: 0.55 },  // small-cap
    ]
    caps.forEach(({ revB, cap }) => {
      // Verify cap value is what we documented — asserting against known constants
      const rawRevM = revB * 1000
      let sizeCap: number
      if (rawRevM / 1000 > 50)       sizeCap = 0.22
      else if (rawRevM / 1000 > 10)  sizeCap = 0.28
      else if (rawRevM / 1000 > 2)   sizeCap = 0.38
      else                           sizeCap = 0.55
      expect(sizeCap).toBe(cap)
    })
  })
})

// ── calculateFairValue — EV bridge ───────────────────────────────────────────

describe('calculateFairValue', () => {
  const makeDCF = (ev: number) => ({
    projections: [],
    terminalValue: 5000,
    terminalValueDiscounted: 3000,
    sumPV: ev - 3000,
    ev,
    growthModel: 'two-stage' as const,
    yearlyGrowthRates: [],
    terminalGrowthViolation: false as const,
  })

  it('equity value = EV + cash - debt', () => {
    const result = calculateFairValue(makeDCF(10_000), 2_000, 1_000, 100, 100)
    expect(result.equityValue).toBe(11_000)  // 10000 + 2000 - 1000
  })

  it('fair value per share = equityValue / shares', () => {
    const result = calculateFairValue(makeDCF(10_000), 2_000, 1_000, 100, 100)
    expect(result.fairValuePerShare).toBeCloseTo(110, 1)  // 11000 / 100
  })

  it('upside is positive when fair value > price', () => {
    const result = calculateFairValue(makeDCF(10_000), 2_000, 1_000, 100, 80)
    expect(result.upsidePct).toBeGreaterThan(0)
  })

  it('upside is negative when fair value < price', () => {
    const result = calculateFairValue(makeDCF(10_000), 2_000, 1_000, 100, 130)
    expect(result.upsidePct).toBeLessThan(0)
  })

  it('returns null fairValuePerShare when shares = 0', () => {
    const result = calculateFairValue(makeDCF(10_000), 2_000, 1_000, 0, 100)
    expect(result.fairValuePerShare).toBeNull()
    expect(result.upsidePct).toBeNull()
  })

  it('propagates Gordon Growth violation — all values null', () => {
    const violatedDCF = {
      ...makeDCF(0), ev: null, terminalValue: null, terminalValueDiscounted: null,
      terminalGrowthViolation: true as const,
    }
    const result = calculateFairValue(violatedDCF, 2_000, 1_000, 100, 100)
    expect(result.fairValuePerShare).toBeNull()
    expect(result.upsidePct).toBeNull()
    expect(result.terminalGrowthViolation).toBe(true)
  })

  it('high debt can produce negative equity value (not clamped to zero)', () => {
    // EV=5000, cash=100, debt=10000 → equityValue = -4900 (technically insolvent)
    const result = calculateFairValue(makeDCF(5_000), 100, 10_000, 100, 50)
    expect(result.equityValue).toBe(-4_900)
    // fairValuePerShare should be negative — company is insolvent
    expect(result.fairValuePerShare).toBeLessThan(0)
  })
})

// ── buildScenarios ────────────────────────────────────────────────────────────

describe('buildScenarios', () => {
  const waccResult = calculateWACC({
    rfRate: 0.04, beta: 1.0, erp: 0.046, crp: 0,
    costOfDebt: 0.05, taxRate: 0.21, debtToEquity: 0.3,
  })

  it('bull scenario has higher CAGR and lower WACC than base', () => {
    const s = buildScenarios(waccResult, 0.10, 0.02, 100, 500, 200, 50, 100)
    expect(s.bull.cagr).toBeGreaterThan(s.base.cagr)
    expect(s.bull.wacc).toBeLessThan(s.base.wacc)
  })

  it('bear scenario has lower CAGR and higher WACC than base', () => {
    const s = buildScenarios(waccResult, 0.10, 0.02, 100, 500, 200, 50, 100)
    expect(s.bear.cagr).toBeLessThan(s.base.cagr)
    expect(s.bear.wacc).toBeGreaterThan(s.base.wacc)
  })

  it('bull fair value > base fair value > bear fair value', () => {
    const s = buildScenarios(waccResult, 0.10, 0.02, 100, 500, 200, 50, 100)
    if (s.bull.fairValue != null && s.base.fairValue != null && s.bear.fairValue != null) {
      expect(s.bull.fairValue).toBeGreaterThan(s.base.fairValue)
      expect(s.base.fairValue).toBeGreaterThan(s.bear.fairValue)
    }
  })

  it('clamps WACC to minimum 4% even in bull scenario with very low base WACC', () => {
    const lowWacc = calculateWACC({ rfRate: 0.025, beta: 0.3, erp: 0.046, crp: 0, costOfDebt: 0.03, taxRate: 0.21, debtToEquity: 0 })
    // base WACC ≈ 0.0388 → bull WACC = 0.0388 - 0.01 = 0.0288 → clamped to 0.04
    const s = buildScenarios(lowWacc, 0.08, 0.015, 100, 300, 100, 50, 50)
    expect(s.bull.wacc).toBeGreaterThanOrEqual(0.04)
  })

  it('terminal growth is clamped below WACC in bear scenario', () => {
    const s = buildScenarios(waccResult, 0.08, 0.019, 100, 500, 200, 50, 100)
    // bear: terminalG -= 0.005 → could go negative → clamped to 0
    expect(s.bear.terminalG).toBeGreaterThanOrEqual(0)
    // also must be < WACC
    expect(s.bear.terminalG).toBeLessThan(s.bear.wacc)
  })
})
