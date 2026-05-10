/**
 * Unit tests for valuationGuards.ts
 * Run: npx jest lib/valuation/__tests__/guards.test.ts
 */

import { GuardError, assertNotNull, assertPositive, assertTerminalGrowth, clampTerminalG, nullable } from '../valuationGuards'

describe('assertNotNull', () => {
  it('returns the value when present', () => {
    expect(assertNotNull(42, 'field')).toBe(42)
    expect(assertNotNull('hello', 'field')).toBe('hello')
    expect(assertNotNull(0, 'field')).toBe(0)   // 0 is not null
    expect(assertNotNull(false, 'field')).toBe(false) // false is not null
  })

  it('throws GuardError for null', () => {
    expect(() => assertNotNull(null, 'baseFCF')).toThrow(GuardError)
    expect(() => assertNotNull(null, 'baseFCF')).toThrow('baseFCF is required but was null or undefined')
  })

  it('throws GuardError for undefined', () => {
    expect(() => assertNotNull(undefined, 'shares')).toThrow(GuardError)
  })

  it('null !== 0: zero should NOT throw', () => {
    // This is the critical bug we fixed in validator.ts — 0 is valid data, not absent
    expect(() => assertNotNull(0, 'baseFCF')).not.toThrow()
    expect(assertNotNull(0, 'baseFCF')).toBe(0)
  })
})

describe('assertPositive', () => {
  it('returns positive value', () => {
    expect(assertPositive(5, 'shares')).toBe(5)
    expect(assertPositive(0.01, 'wacc')).toBe(0.01)
  })

  it('throws for zero', () => {
    expect(() => assertPositive(0, 'wacc')).toThrow(GuardError)
    expect(() => assertPositive(0, 'wacc')).toThrow('must be positive')
  })

  it('throws for negative', () => {
    expect(() => assertPositive(-5, 'shares')).toThrow(GuardError)
  })

  it('throws for null', () => {
    expect(() => assertPositive(null, 'shares')).toThrow(GuardError)
  })
})

describe('assertTerminalGrowth', () => {
  it('passes when terminalG < wacc', () => {
    expect(() => assertTerminalGrowth(0.02, 0.09)).not.toThrow()
    expect(() => assertTerminalGrowth(0.025, 0.085)).not.toThrow()
  })

  it('throws when terminalG === wacc', () => {
    expect(() => assertTerminalGrowth(0.09, 0.09)).toThrow(GuardError)
    try {
      assertTerminalGrowth(0.09, 0.09)
    } catch (e) {
      expect((e as GuardError).rule).toBe('TERMINAL_G_LT_WACC')
    }
  })

  it('throws when terminalG > wacc', () => {
    expect(() => assertTerminalGrowth(0.10, 0.09)).toThrow(GuardError)
  })

  it('error message includes percentages', () => {
    try {
      assertTerminalGrowth(0.09, 0.085)
    } catch (e) {
      expect(e).toBeInstanceOf(GuardError)
      expect((e as GuardError).message).toContain('9.00%')
      expect((e as GuardError).message).toContain('8.50%')
    }
  })
})

describe('clampTerminalG', () => {
  it('clamps to wacc - margin', () => {
    expect(clampTerminalG(0.10, 0.09)).toBeCloseTo(0.085)      // 0.09 - 0.005
    expect(clampTerminalG(0.08, 0.09)).toBeCloseTo(0.08)        // already below ceiling
    expect(clampTerminalG(0.085, 0.09)).toBeCloseTo(0.085)      // exactly at ceiling
  })

  it('clamps to 0 minimum', () => {
    expect(clampTerminalG(-0.01, 0.09)).toBe(0)
  })

  it('supports custom margin', () => {
    expect(clampTerminalG(0.10, 0.09, 0.01)).toBe(0.08)  // 0.09 - 0.01
  })
})

describe('nullable', () => {
  it('returns value when present', () => {
    expect(nullable(5)).toBe(5)
    expect(nullable(0)).toBe(0)
    expect(nullable('')).toBe('')
  })

  it('returns null for null/undefined', () => {
    expect(nullable(null)).toBeNull()
    expect(nullable(undefined)).toBeNull()
  })
})
