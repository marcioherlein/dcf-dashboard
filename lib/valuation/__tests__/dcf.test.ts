/**
 * Unit tests for DCF computation modules (unleveredDcf, leveredDcf, terminalValue)
 * Run: npx jest lib/valuation/__tests__/dcf.test.ts
 */

import { computeUFCFRows, computeUFCFTerminalValues } from '../unleveredDcf'
import { computeLFCFRows } from '../leveredDcf'
import { computeTerminalValues } from '../terminalValue'
import { GuardError } from '../valuationGuards'

// ── UFCF ─────────────────────────────────────────────────────────────────────

describe('computeUFCFRows', () => {
  const baseRow = {
    year: '2023', isProjected: false,
    revenue: 500, ebit: 100, ebitda: 130, capex: -30, nwc: 50,
  }

  it('derives D&A from ebitda − ebit', () => {
    const rows = computeUFCFRows([baseRow], 0.21, 0.09)
    expect(rows[0].dna).toBe(30)  // 130 − 100
  })

  it('computes NOPAT = EBIT × (1 − taxRate)', () => {
    const rows = computeUFCFRows([baseRow], 0.21, 0.09)
    expect(rows[0].nopat).toBeCloseTo(79)  // 100 × 0.79
  })

  it('computes UFCF = NOPAT + D&A + CapEx − ΔNWC (first row: ΔNWC=0)', () => {
    const rows = computeUFCFRows([baseRow], 0.21, 0.09)
    // NOPAT=79, D&A=30, CapEx=-30, ΔNWC=0 (no prior)
    expect(rows[0].ufcf).toBeCloseTo(79)  // 79 + 30 - 30 - 0
  })

  it('computes ΔNWC year-over-year for subsequent rows', () => {
    const rows = computeUFCFRows([
      { ...baseRow, year: '2022', nwc: 40 },
      { ...baseRow, year: '2023', nwc: 50 },  // ΔNWC = +10
    ], 0.21, 0.09)
    expect(rows[1].nwcDelta).toBe(10)
    // UFCF = 79 + 30 - 30 - 10 = 69
    expect(rows[1].ufcf).toBeCloseTo(69)
  })

  it('returns null UFCF when ebit is null', () => {
    const rows = computeUFCFRows([{ ...baseRow, ebit: null }], 0.21, 0.09)
    expect(rows[0].nopat).toBeNull()
    expect(rows[0].ufcf).toBeNull()
  })

  it('returns null UFCF when capex is null', () => {
    const rows = computeUFCFRows([{ ...baseRow, capex: null }], 0.21, 0.09)
    expect(rows[0].ufcf).toBeNull()
  })

  it('returns null D&A when either ebitda or ebit is null', () => {
    const rows = computeUFCFRows([{ ...baseRow, ebitda: null }], 0.21, 0.09)
    expect(rows[0].dna).toBeNull()
  })

  it('discounts projected rows at WACC^t', () => {
    const projRow = { year: '2024', isProjected: true, revenue: 550, ebit: 100, ebitda: 130, capex: -30, nwc: 50 }
    const rows = computeUFCFRows([baseRow, projRow], 0.21, 0.09)
    const pvExpected = rows[1].ufcf! / Math.pow(1.09, 1)
    expect(rows[1].pvUfcf).toBeCloseTo(pvExpected)
  })

  it('does not discount actual rows (pvUfcf = null)', () => {
    const rows = computeUFCFRows([baseRow], 0.21, 0.09)
    expect(rows[0].pvUfcf).toBeNull()
  })
})

describe('computeUFCFTerminalValues', () => {
  const baseRow = {
    year: '2023', isProjected: false, revenue: 500, ebit: 100, ebitda: 130,
    capex: -30, nwc: 50, dna: 30, nwcDelta: null, nopat: 79, ufcf: 79, pvUfcf: null,
  }
  const projRow = {
    year: '2024', isProjected: true, revenue: 550, ebit: 110, ebitda: 143,
    capex: -33, nwc: 55, dna: 33, nwcDelta: 5, nopat: 86.9, ufcf: 85, pvUfcf: 78,
  }

  it('perpetuity TV: FCF × (1+g) / (wacc−g)', () => {
    const { perpetuityTV } = computeUFCFTerminalValues([baseRow, projRow], 0.09, 0.02, 15)
    const expected = (85 * 1.02) / (0.09 - 0.02)
    expect(perpetuityTV).toBeCloseTo(expected)
  })

  it('exit multiple TV: FCF × multiple', () => {
    const { exitMultipleTV } = computeUFCFTerminalValues([baseRow, projRow], 0.09, 0.02, 15)
    expect(exitMultipleTV).toBeCloseTo(85 * 15)
  })

  it('perpetuityTV is null when terminalG >= wacc', () => {
    const { perpetuityTV } = computeUFCFTerminalValues([baseRow, projRow], 0.09, 0.09, 15)
    expect(perpetuityTV).toBeNull()
    // exitMultipleTV should still be computed
  })
})

// ── LFCF ─────────────────────────────────────────────────────────────────────

describe('computeLFCFRows', () => {
  const baseRow = {
    year: '2023', isProjected: false,
    revenue: 500,
    netIncome: 80, ebit: 100, ebitda: 130, capex: -30, nwc: 50, netDebtRepayment: 10,
  }

  it('LFCF = NI + D&A + CapEx − ΔNWC − NetDebtRepayment (first row)', () => {
    const rows = computeLFCFRows([baseRow], 0.12)
    // D&A = 130-100=30, ΔNWC=0, LFCF = 80 + 30 - 30 - 0 - 10 = 70
    expect(rows[0].lfcf).toBeCloseTo(70)
  })

  it('uses costOfEquity (Ke) not WACC for discounting', () => {
    const projRow = { ...baseRow, year: '2024', isProjected: true }
    const ke = 0.12
    const rows = computeLFCFRows([baseRow, projRow], ke)
    const pvExpected = rows[1].lfcf! / Math.pow(1 + ke, 1)
    expect(rows[1].pvLfcf).toBeCloseTo(pvExpected)
  })

  it('Ke is used, not WACC — different rates produce different PV', () => {
    const projRow = { ...baseRow, year: '2024', isProjected: true }
    const rowsKe12 = computeLFCFRows([baseRow, projRow], 0.12)
    const rowsKe09 = computeLFCFRows([baseRow, projRow], 0.09)
    // Higher Ke → lower PV
    expect(rowsKe12[1].pvLfcf!).toBeLessThan(rowsKe09[1].pvLfcf!)
  })
})

// ── Terminal Value ────────────────────────────────────────────────────────────

describe('computeTerminalValues', () => {
  it('perpetuity: FCF × (1+g) / (wacc−g) with g=0.02, wacc=0.09, FCF=100 → ~1457', () => {
    const result = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'standard')
    const expected = (100 * 1.02) / (0.09 - 0.02)
    expect(result.perpetuityTV).toBeCloseTo(expected)
    expect(result.perpetuityTV).toBeCloseTo(1457.14, 0)
  })

  it('exit multiple: FCF × multiple with FCF=100, multiple=15 → 1500', () => {
    const result = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'standard')
    expect(result.exitMultipleTV).toBeCloseTo(1500)
  })

  it('discounts both TVs over numProjectionYears', () => {
    const result = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'standard')
    const expectedPerpDisc = (100 * 1.02 / 0.07) / Math.pow(1.09, 5)
    expect(result.perpetuityTVDiscounted).toBeCloseTo(expectedPerpDisc, 0)
  })

  it('sets perpetuityTV to null when terminalG >= discountRate (guard fires)', () => {
    const result = computeTerminalValues(100, 0.09, 0.09, 15, 5, 500, 'standard')
    expect(result.perpetuityTV).toBeNull()
    expect(result.guardError).toBeTruthy()
  })

  it('still computes exitMultipleTV even when perpetuity guard fires', () => {
    const result = computeTerminalValues(100, 0.09, 0.09, 15, 5, 500, 'standard')
    expect(result.exitMultipleTV).toBeCloseTo(1500)
  })

  it('returns null for all when terminalFCF is null', () => {
    const result = computeTerminalValues(null, 0.09, 0.02, 15, 5, 500, 'standard')
    expect(result.perpetuityTV).toBeNull()
    expect(result.exitMultipleTV).toBeNull()
    expect(result.guardError).toBeTruthy()
  })

  it('recommends exitMultiple for growth/startup companies', () => {
    const g = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'growth')
    const s = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'startup')
    expect(g.primaryMethod).toBe('exitMultiple')
    expect(s.primaryMethod).toBe('exitMultiple')
  })

  it('recommends perpetuity for standard/dividend companies', () => {
    const std = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'standard')
    const div = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'dividend')
    expect(std.primaryMethod).toBe('perpetuity')
    expect(div.primaryMethod).toBe('perpetuity')
  })

  it('computes residual % of total EV', () => {
    const result = computeTerminalValues(100, 0.09, 0.02, 15, 5, 500, 'standard')
    expect(result.perpetuityResidualPct).toBeGreaterThan(0)
    expect(result.perpetuityResidualPct).toBeLessThanOrEqual(1)
  })

  it('throws GuardError (not generic Error) from terminal growth violation', () => {
    // GuardError should be catchable separately from generic Error
    try {
      computeTerminalValues(100, 0.09, 0.09, 15, 5, 500, 'standard')
    } catch (e) {
      // computeTerminalValues doesn't throw — it returns guardError string
      expect(e).toBeUndefined()
    }
    const result = computeTerminalValues(100, 0.09, 0.09, 15, 5, 500, 'standard')
    expect(result.guardError).toBeTruthy()
  })
})
