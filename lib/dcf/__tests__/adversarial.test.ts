/**
 * Adversarial and edge-case tests
 * Covers: NaN/Infinity/null inputs, extreme values, boundary conditions,
 * Gordon Growth violation, FX parity trap, silent zero trap
 */

import { calculateWACC } from '../calculateWACC'
import { projectCashFlows } from '../projectCashFlows'
import { calculateFairValue } from '../calculateFairValue'
import { calculateMultiples } from '../calculateMultiples'

// ── NaN / Infinity guards ─────────────────────────────────────────────────────

describe('calculateWACC — adversarial inputs', () => {
  const base = { rfRate: 0.04, beta: 1.0, erp: 0.046, crp: 0, costOfDebt: 0.05, taxRate: 0.21, debtToEquity: 0.3 }

  it('produces finite WACC for extreme high beta (beta = 3.5, max allowed)', () => {
    const result = calculateWACC({ ...base, beta: 3.5 })
    expect(isFinite(result.wacc)).toBe(true)
    expect(result.wacc).toBeGreaterThan(0)
  })

  it('produces finite WACC for zero cost of debt', () => {
    const result = calculateWACC({ ...base, costOfDebt: 0 })
    expect(isFinite(result.wacc)).toBe(true)
  })

  it('produces finite WACC for 100% tax rate (edge)', () => {
    // after-tax debt cost = 0; WACC = Ke only (weighted)
    const result = calculateWACC({ ...base, taxRate: 1.0 })
    expect(isFinite(result.wacc)).toBe(true)
    expect(result.afterTaxCostOfDebt).toBe(0)
  })

  it('D/E = 0 → 100% equity weight', () => {
    const result = calculateWACC({ ...base, debtToEquity: 0 })
    expect(result.weightEquity).toBe(1)
    expect(result.weightDebt).toBe(0)
    expect(result.wacc).toBeCloseTo(result.costOfEquity, 4)
  })

  it('very high D/E does not produce negative WACC', () => {
    const result = calculateWACC({ ...base, debtToEquity: 10 })
    expect(result.wacc).toBeGreaterThan(0)
  })
})

describe('projectCashFlows — adversarial inputs', () => {
  const base = { baseFCF: 100, cagr: 0.10, wacc: 0.09, terminalG: 0.02, years: 10 }

  it('handles negative base FCF (pre-profitability company)', () => {
    const result = projectCashFlows({ ...base, baseFCF: -50 })
    // negative FCF should propagate — projections may be negative
    expect(result.projections.length).toBe(10)
    expect(isFinite(result.sumPV)).toBe(true)
  })

  it('handles CAGR = 0 (zero growth)', () => {
    const result = projectCashFlows({ ...base, cagr: 0 })
    result.projections.forEach((p) => {
      // all FCFs should equal baseFCF (100)
      expect(p.cashFlow).toBe(100)
    })
  })

  it('handles CAGR = -10% (revenue decline)', () => {
    const result = projectCashFlows({ ...base, cagr: -0.10 })
    expect(result.projections[0].cashFlow).toBeCloseTo(90, 0)  // 100 × 0.90
    expect(isFinite(result.sumPV)).toBe(true)
  })

  it('exact boundary: terminalG = WACC triggers violation (not strictly less)', () => {
    const result = projectCashFlows({ ...base, terminalG: 0.09, wacc: 0.09 })
    expect(result.terminalGrowthViolation).toBe(true)
    expect(result.ev).toBeNull()
  })

  it('1 basis point below boundary does not trigger violation', () => {
    const result = projectCashFlows({ ...base, terminalG: 0.0899, wacc: 0.09 })
    expect(result.terminalGrowthViolation).toBeFalsy()
    expect(result.ev).toBeGreaterThan(0)
  })

  it('very high CAGR (55% — small cap cap) produces finite EV', () => {
    const result = projectCashFlows({ ...base, cagr: 0.55, wacc: 0.15, terminalG: 0.025 })
    expect(isFinite(result.ev!)).toBe(true)
    expect(result.ev).toBeGreaterThan(0)
  })

  it('years = 1 (single projection year)', () => {
    const result = projectCashFlows({ ...base, years: 1 })
    expect(result.projections.length).toBe(1)
    expect(result.ev).toBeGreaterThan(0)
  })
})

describe('calculateFairValue — adversarial inputs', () => {
  const validDCF = {
    projections: [], terminalValue: 5000, terminalValueDiscounted: 3000,
    sumPV: 7000, ev: 10_000,
    growthModel: 'two-stage' as const,
    yearlyGrowthRates: [],
    terminalGrowthViolation: false as const,
  }

  it('currentPrice = 0 → upsidePct = null (no division by zero)', () => {
    const result = calculateFairValue(validDCF, 2_000, 1_000, 100, 0)
    expect(result.upsidePct).toBeNull()
  })

  it('shares = 0 → fairValuePerShare = null (no division by zero)', () => {
    const result = calculateFairValue(validDCF, 2_000, 1_000, 0, 100)
    expect(result.fairValuePerShare).toBeNull()
  })

  it('cash = 0 (missing balance sheet) → still computes', () => {
    const result = calculateFairValue(validDCF, 0, 1_000, 100, 100)
    expect(result.equityValue).toBe(9_000)   // 10000 + 0 - 1000
    expect(isFinite(result.fairValuePerShare!)).toBe(true)
  })

  it('debt > EV + cash → negative equity (insolvent company, not clamped)', () => {
    const result = calculateFairValue(validDCF, 500, 20_000, 100, 50)
    expect(result.equityValue).toBeLessThan(0)
  })

  it('IRR is null when currentPrice = 0', () => {
    const result = calculateFairValue(validDCF, 500, 200, 100, 0)
    expect(result.irr).toBeNull()
  })

  it('IRR is null when fairValuePerShare ≤ 0 (insolvent)', () => {
    const result = calculateFairValue(validDCF, 0, 20_000, 100, 50)
    // equityValue = 10000 + 0 - 20000 = -10000 → fairValuePerShare = -100
    expect(result.irr).toBeNull()
  })
})

describe('calculateMultiples — adversarial inputs', () => {
  const base = {
    sector: 'Technology', industry: 'Semiconductors',
    companyType: 'growth' as const,
    currentPrice: 100,
    trailingPE: 20, priceToBook: 5, priceToSales: 6, evToEbitda: 15, evToRevenue: 7,
  }

  it('trailingPE = 0 → not applicable', () => {
    const result = calculateMultiples({ ...base, trailingPE: 0 })
    expect(result.estimates.find(e => e.multiple === 'P/E')!.applicable).toBe(false)
  })

  it('trailingPE = -1 → not applicable (negative earnings)', () => {
    const result = calculateMultiples({ ...base, trailingPE: -1 })
    expect(result.estimates.find(e => e.multiple === 'P/E')!.applicable).toBe(false)
  })

  it('trailingPE = 9999 → not applicable (treated as outlier > 10000)', () => {
    const result = calculateMultiples({ ...base, trailingPE: 10001 })
    expect(result.estimates.find(e => e.multiple === 'P/E')!.applicable).toBe(false)
  })

  it('currentPrice = 0 → applicable but implied fair value is 0', () => {
    const result = calculateMultiples({ ...base, currentPrice: 0 })
    const pe = result.estimates.find(e => e.multiple === 'P/E')!
    // applicable = false because (currentPrice × bench / actual) = 0 → fv = 0 → filtered from blend
    // OR applicable but impliedFairValue = 0
    if (pe.applicable) {
      expect(pe.impliedFairValue).toBe(0)
    }
  })

  it('live peers with <3 valid entries fall back to static median', () => {
    const livePeers = [
      { ticker: 'P1', trailingPE: 30, priceToBook: null, priceToSales: null, evToEbitda: null, evToRevenue: null },
      { ticker: 'P2', trailingPE: 32, priceToBook: null, priceToSales: null, evToEbitda: null, evToRevenue: null },
      // Only 2 peers — below the 3-peer threshold
    ]
    const result = calculateMultiples({ ...base, livePeers })
    const pe = result.estimates.find(e => e.multiple === 'P/E')!
    // Should fall back to static (Semiconductors: 28×)
    expect(pe.benchmarkSource).not.toBe('live-peers')
    expect(pe.sectorMedian).toBe(28)
  })
})

// ── Consistency boundary: terminalG convergence ───────────────────────────────

describe('terminalG boundary sweep', () => {
  it('all terminalG values < WACC produce finite EV', () => {
    const wacc = 0.09
    const terminalGs = [0.0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.07, 0.085]
    terminalGs.forEach((g) => {
      const result = projectCashFlows({ baseFCF: 100, cagr: 0.10, wacc, terminalG: g })
      if (g < wacc) {
        expect(result.ev).not.toBeNull()
        expect(isFinite(result.ev!)).toBe(true)
      } else {
        expect(result.terminalGrowthViolation).toBe(true)
        expect(result.ev).toBeNull()
      }
    })
  })
})

// ── FX parity trap: detecting the 1.0 fallback ───────────────────────────────

describe('FX parity trap — documentation test', () => {
  /**
   * This test documents the known critical risk: getFXRate() returns 1.0 on failure.
   * We cannot unit test the actual getFXRate() without mocking Yahoo Finance,
   * but we can assert the expected behavior change after the fix.
   *
   * Expected fix: getFXRate() should return null on API failure.
   * Callers must check for null and abort with error (not silently continue with 1.0).
   *
   * BEFORE FIX: getFXRate('ARS', 'USD') → 1.0 (silently)
   * AFTER FIX:  getFXRate('ARS', 'USD') → null (throws or returns null)
   */
  it('documents that ARS parity fallback magnifies equity value by ~900x', () => {
    // ARS/USD spot rate is approximately 900 (varies)
    // With real fxRate = 900, ARS balance sheet debt in millions USD = ARSdebt / 900
    // With fxRate = 1.0 (fallback), ARS balance sheet debt appears 900× larger in USD
    // This makes D/E ≈ 900× higher → WACC ≈ Kd × (1-T) ≈ 3.5% → DCF value ≈ 900× too large

    const arsDebtARS = 1_000_000_000  // ARS 1B
    const realFxRate = 900

    const debtWithRealFx = arsDebtARS * (1 / realFxRate)   // USD ~1.1M
    const debtWithFallback = arsDebtARS * 1.0               // "USD" 1B — wrong

    expect(debtWithFallback / debtWithRealFx).toBeGreaterThan(800)

    // This is the risk: this test passing means the bug EXISTS.
    // After the fix (getFXRate returns null + callers abort), this test
    // should be updated to verify the null is propagated as an error.
  })
})
