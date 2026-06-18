/**
 * V2 Engine Tests
 *
 * Tests for the corrected FCFF DCF, enterprise bridge, and unit safety helpers.
 * These are hand-calculated examples to verify financial formula correctness.
 */

import { computeFCFFDcfV2, buildGrowthCurveFromLegacyCagr, type FCFFDcfInputsV2 } from '../v2/fcffDcf'
import { computeEnterpriseBridgeV2, computeEnterpriseBridgeV1Compat } from '../v2/enterpriseValueBridge'
import { validateForFCFFDcf, safeEbitMargin } from '../v2/dataValidation'
import type { CockpitSnapshotV2 } from '../v2/types'

// ─── FCFF DCF formula tests ───────────────────────────────────────────────────

describe('FCFF DCF V2 — formula correctness', () => {
  /**
   * Hand-calculated test case:
   *   Base revenue:    $1,000M
   *   Revenue growth:  20% all years (flat for simplicity)
   *   EBIT margin:     15% constant
   *   Cash tax rate:   21%
   *   Sales-to-capital: 1.5
   *   WACC:            10%
   *   Terminal G:      2.5%
   *   Projection years: 5 (short for manual verification)
   *
   * Year 1:
   *   Revenue = 1000 × 1.20 = 1200
   *   EBIT    = 1200 × 0.15 = 180
   *   NOPAT   = 180 × 0.79 = 142.2
   *   ΔRev    = 200
   *   Reinvest = 200 / 1.5 = 133.33
   *   FCFF    = 142.2 - 133.33 = 8.87
   *   PV      = 8.87 / (1.10)^1 = 8.06
   */
  it('Year 1 FCFF calculation is correct', () => {
    const inputs: FCFFDcfInputsV2 = {
      baseRevenueM:        1_000,
      baseEbitMarginPct:   0.15,
      cashTaxRate:         0.21,
      revenueGrowthByYear: [0.20, 0.20, 0.20, 0.20, 0.20],
      wacc:                0.10,
      terminalG:           0.025,
      salesToCapitalRatio: 1.5,
      cashM:               0,
      debtM:               0,
      dilutedSharesM:      100,
      currentPrice:        0,
      projectionYears:     5,
    }

    const result = computeFCFFDcfV2(inputs)

    const year1 = result.projectionRows[0]
    expect(year1.year).toBe(1)
    expect(year1.revenue).toBeCloseTo(1200, 1)
    expect(year1.ebit).toBeCloseTo(180, 1)
    expect(year1.nopat).toBeCloseTo(142.2, 0)
    expect(year1.reinvestment).toBeCloseTo(133.33, 0)
    expect(year1.fcff).toBeCloseTo(8.87, 0)
    expect(year1.pvFcff).toBeCloseTo(8.06, 0)
  })

  it('Terminal value Gordon Growth: TV = FCFF10×(1+g)/(WACC-g)', () => {
    const inputs: FCFFDcfInputsV2 = {
      baseRevenueM:        100,
      baseEbitMarginPct:   0.20,
      cashTaxRate:         0.21,
      revenueGrowthByYear: Array(10).fill(0.10),
      wacc:                0.09,
      terminalG:           0.025,
      salesToCapitalRatio: 1.5,
      cashM:               10,
      debtM:               5,
      dilutedSharesM:      10,
      currentPrice:        100,
      projectionYears:     10,
    }

    const result = computeFCFFDcfV2(inputs)

    expect(result.terminalValueGordon).not.toBeNull()
    expect(result.pvTerminalGordon).not.toBeNull()
    expect(result.enterpriseValueGordon).not.toBeNull()
    // TV should be positive
    expect(result.terminalValueGordon!).toBeGreaterThan(0)
    // PV of TV should be less than TV (discounted)
    expect(result.pvTerminalGordon!).toBeLessThan(result.terminalValueGordon!)
    // EV = sumPvFcff + pvTerminalGordon
    expect(result.enterpriseValueGordon!).toBeCloseTo(
      result.sumPvFcff + result.pvTerminalGordon!,
      0,
    )
  })

  it('Terminal growth capped at WACC - minSpread', () => {
    const inputs: FCFFDcfInputsV2 = {
      baseRevenueM:        1_000,
      baseEbitMarginPct:   0.20,
      cashTaxRate:         0.21,
      revenueGrowthByYear: Array(10).fill(0.10),
      wacc:                0.09,
      terminalG:           0.09,   // EQUAL to WACC — must be rejected
      salesToCapitalRatio: 1.5,
      cashM:               0,
      debtM:               0,
      dilutedSharesM:      100,
      currentPrice:        0,
    }

    const result = computeFCFFDcfV2(inputs)

    // Should have a warning about terminal growth being capped
    const hasCap = result.warnings.some(w => w.includes('TERMINAL_G_CAPPED'))
    expect(hasCap).toBe(true)

    // Terminal value should still be computed (capped to wacc - 150bps = 7.5%)
    expect(result.terminalValueGordon).not.toBeNull()
  })

  it('Exit multiple applied to EBITDA not FCFF', () => {
    // With D&A provided, exit multiple should use EBITDA (EBIT + D&A) × multiple
    const inputs: FCFFDcfInputsV2 = {
      baseRevenueM:          1_000,
      baseEbitMarginPct:     0.20,
      cashTaxRate:           0.21,
      revenueGrowthByYear:   Array(10).fill(0.10),
      dnaM:                  50,   // $50M D&A at base → 5% D&A margin
      wacc:                  0.09,
      terminalG:             0.025,
      salesToCapitalRatio:   1.5,
      exitEVEBITDAMultiple:  12,
      cashM:                 0,
      debtM:                 0,
      dilutedSharesM:        100,
      currentPrice:          0,
    }

    const result = computeFCFFDcfV2(inputs)

    expect(result.terminalValueExit).not.toBeNull()
    expect(result.pvTerminalExit).not.toBeNull()
    expect(result.enterpriseValueExit).not.toBeNull()

    // Terminal year revenue = 1000 × 1.10^10 ≈ 2593
    // Terminal EBIT margin = 20% (constant)
    // Terminal D&A margin ≈ 5% (same as base year)
    // Terminal EBITDA ≈ 2593 × 0.25 ≈ 648
    // Exit TV = 648 × 12 ≈ 7776
    expect(result.terminalValueExit!).toBeGreaterThan(4000)  // rough sanity check
    expect(result.terminalValueExit!).toBeLessThan(15000)
  })

  it('Negative FCFF produces a warning, not an exception', () => {
    const inputs: FCFFDcfInputsV2 = {
      baseRevenueM:        100,
      baseEbitMarginPct:   -0.30,   // deeply loss-making
      cashTaxRate:         0.00,
      revenueGrowthByYear: Array(10).fill(0.40),
      wacc:                0.12,
      terminalG:           0.03,
      salesToCapitalRatio: 0.5,    // very capital intensive
      cashM:               200,
      debtM:               50,
      dilutedSharesM:      50,
      currentPrice:        100,
    }

    expect(() => computeFCFFDcfV2(inputs)).not.toThrow()

    const result = computeFCFFDcfV2(inputs)
    // Terminal FCFF is negative → Gordon Growth not applicable
    const hasNegativeTVWarning = result.warnings.some(
      w => w.includes('NEGATIVE_TERMINAL_FCFF')
    )
    if (result.terminalValueGordon === null) {
      expect(hasNegativeTVWarning).toBe(true)
    }
  })
})

// ─── Enterprise bridge tests ──────────────────────────────────────────────────

describe('Enterprise-to-Equity Bridge V2', () => {
  it('standard bridge: EV + cash - debt = equity', () => {
    const result = computeEnterpriseBridgeV2({
      enterpriseValueM:  1_000,
      cashM:             200,
      totalDebtM:        300,
      dilutedSharesM:    100,
      currentPrice:      9.00,
    })

    expect(result.equityValueM).toBeCloseTo(900, 0)  // 1000 + 200 - 300 = 900
    expect(result.fairValuePerShare).toBeCloseTo(9.00, 2)  // 900 / 100 = 9.00
    expect(result.debtOverhang).toBe(false)
  })

  it('full bridge with all optional items', () => {
    const result = computeEnterpriseBridgeV2({
      enterpriseValueM:       1_000,
      cashM:                  100,
      marketableSecuritiesM:  50,
      nonOpInvestmentsM:      25,
      totalDebtM:             200,
      leaseLiabilitiesM:      30,
      preferredStockM:        20,
      minorityInterestM:      10,
      pensionDeficitM:        15,
      dilutedSharesM:         100,
      currentPrice:           9.00,
    })

    // Equity = 1000 + 100 + 50 + 25 - 200 - 30 - 20 - 10 - 15 = 900
    expect(result.equityValueM).toBeCloseTo(900, 0)
    expect(result.debtOverhang).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)  // pension deficit warning
  })

  it('debt overhang returns null fair value', () => {
    const result = computeEnterpriseBridgeV2({
      enterpriseValueM:  100,
      cashM:             10,
      totalDebtM:        200,   // debt > EV + cash
      dilutedSharesM:    50,
      currentPrice:      5.00,
    })

    expect(result.debtOverhang).toBe(true)
    expect(result.fairValuePerShare).toBeNull()
    expect(result.equityValueM).toBeNull()
  })

  it('V1-compat bridge matches simple formula', () => {
    const r = computeEnterpriseBridgeV1Compat(500, 100, 50, 50, 10)
    // EV=500 + cash=100 - debt=50 = equity=550 / shares=50 = $11/share
    expect(r.fairValuePerShare).toBeCloseTo(11.00, 2)
  })
})

// ─── Data validation tests ────────────────────────────────────────────────────

describe('Data validation', () => {
  function makeV2Snapshot(overrides: Partial<CockpitSnapshotV2> = {}): CockpitSnapshotV2 {
    const datum = (v: number) => ({
      value: v, currency: 'USD', unit: 'millions' as const, source: 'test',
    })

    const base: CockpitSnapshotV2 = {
      ticker:            'TEST',
      currency:          'USD',
      valuationDate:     '2025-01-01',
      currentPrice:      100,
      marketCap:         datum(10_000),
      ttmRevenue:        datum(1_000),
      ttmEbit:           datum(200),
      ttmEbitda:         datum(250),
      ttmNetIncome:      datum(150),
      ttmDna:            datum(50),
      ttmCapex:          datum(80),
      ttmNwcDelta:       datum(20),
      cashAndEquivalents: datum(500),
      totalDebt:         datum(300),
      dilutedShares:     datum(100),
      basicShares:       datum(95),
      companyType:       'standard',
      sector:            'Technology',
      industry:          'Software',
      historicalCagr3y:  0.15,
      analystCagr1y:     0.18,
      analystCagr2y:     0.16,
    }
    return { ...base, ...overrides }
  }

  it('valid snapshot passes FCFF validation', () => {
    const snap = makeV2Snapshot()
    const result = validateForFCFFDcf(snap)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('missing revenue fails validation', () => {
    const snap = makeV2Snapshot({
      ttmRevenue: { value: null, currency: 'USD', unit: 'millions', source: 'test' },
    })
    const result = validateForFCFFDcf(snap)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('MISSING_TTM_REVENUE'))).toBe(true)
  })

  it('safeEbitMargin returns null when revenue is null', () => {
    const snap = makeV2Snapshot({
      ttmRevenue: { value: null, currency: 'USD', unit: 'millions', source: 'test' },
    })
    expect(safeEbitMargin(snap)).toBeNull()
  })

  it('safeEbitMargin correctly computes EBIT margin', () => {
    const snap = makeV2Snapshot()  // revenue=1000, ebit=200
    const margin = safeEbitMargin(snap)
    expect(margin).toBeCloseTo(0.20, 4)
  })
})

// ─── Growth curve builder ─────────────────────────────────────────────────────

describe('Growth curve from legacy CAGR', () => {
  it('produces correct length array', () => {
    const curve = buildGrowthCurveFromLegacyCagr(0.20, 0.03, 10)
    expect(curve).toHaveLength(10)
  })

  it('first half is flat at CAGR', () => {
    const curve = buildGrowthCurveFromLegacyCagr(0.20, 0.03, 10)
    // Years 1-5 should be ~20%
    for (let i = 0; i < 5; i++) {
      expect(curve[i]).toBeCloseTo(0.20, 4)
    }
  })

  it('last year converges to terminal growth', () => {
    const curve = buildGrowthCurveFromLegacyCagr(0.20, 0.03, 10)
    // Last year should be close to terminal growth
    expect(curve[9]).toBeCloseTo(0.03, 2)
  })

  it('maintains monotonic decline from cagr to terminalG', () => {
    const curve = buildGrowthCurveFromLegacyCagr(0.20, 0.03, 10)
    // In the fade period, growth should be non-increasing
    for (let i = 5; i < 9; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i + 1] - 0.001)
    }
  })
})
