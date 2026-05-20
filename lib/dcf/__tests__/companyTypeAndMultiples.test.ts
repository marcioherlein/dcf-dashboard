/**
 * Company type detection tests
 * Covers: all 5 types, edge cases, priority ordering
 */

import { detectCompanyType, getModelWeights, getGrowthModel } from '../detectCompanyType'
import { calculateMultiples } from '../calculateMultiples'
import { getCRP } from '../countryRiskPremium'

// ── detectCompanyType ─────────────────────────────────────────────────────────

const baseInput = {
  sector: 'Technology',
  industry: 'Software—Application',
  dividendYield: 0,
  payoutRatio: 0,
  historicalCagr3y: 0.10,
  analystEstimate1y: 0.12,
  isNegativeFCF: false,
  revenueM: 5_000,
}

describe('detectCompanyType', () => {
  it('detects financial sector by sector string', () => {
    expect(detectCompanyType({ ...baseInput, sector: 'Financial Services', industry: 'Banks—Diversified' })).toBe('financial')
  })

  it('detects financial sector by industry keyword (bank)', () => {
    expect(detectCompanyType({ ...baseInput, sector: 'Financials', industry: 'Regional Banks' })).toBe('financial')
  })

  it('detects financial sector even when CAGR > 20%', () => {
    // financial check is priority 1 — should not fall through to 'growth'
    expect(detectCompanyType({
      ...baseInput, sector: 'Financial Services', industry: 'Fintech',
      historicalCagr3y: 0.35, analystEstimate1y: 0.40,
    })).toBe('financial')
  })

  it('detects dividend type when yield > 1% and payout > 20%', () => {
    expect(detectCompanyType({
      ...baseInput, sector: 'Consumer Defensive', industry: 'Packaged Foods',
      dividendYield: 0.035, payoutRatio: 0.55,
    })).toBe('dividend')
  })

  it('does NOT detect dividend when yield too low (< 1%)', () => {
    const type = detectCompanyType({ ...baseInput, dividendYield: 0.008, payoutRatio: 0.60 })
    expect(type).not.toBe('dividend')
  })

  it('does NOT detect dividend when payout too low (< 20%)', () => {
    const type = detectCompanyType({ ...baseInput, dividendYield: 0.025, payoutRatio: 0.10 })
    expect(type).not.toBe('dividend')
  })

  it('detects startup when isNegativeFCF and revenue < $500M', () => {
    expect(detectCompanyType({ ...baseInput, isNegativeFCF: true, revenueM: 200 })).toBe('startup')
  })

  it('does NOT detect startup when revenue ≥ $500M even with negative FCF', () => {
    const type = detectCompanyType({ ...baseInput, isNegativeFCF: true, revenueM: 600 })
    expect(type).not.toBe('startup')
  })

  it('detects growth when historical CAGR > 20%', () => {
    expect(detectCompanyType({ ...baseInput, historicalCagr3y: 0.25 })).toBe('growth')
  })

  it('detects growth when analyst estimate1y > 20%', () => {
    expect(detectCompanyType({ ...baseInput, analystEstimate1y: 0.22 })).toBe('growth')
  })

  it('detects standard for moderate-growth profitable companies', () => {
    expect(detectCompanyType(baseInput)).toBe('standard')
  })
})

describe('getModelWeights', () => {
  it('financial without dividend: FCFE 65%, multiples 30%', () => {
    const w = getModelWeights('financial', false)
    expect(w.fcfe).toBe(0.65)
    expect(w.multiples).toBe(0.30)
    expect(w.fcff).toBe(0.05)
  })

  it('financial with dividend: FCFE 50%, DDM 25%', () => {
    const w = getModelWeights('financial', true)
    expect(w.fcfe).toBe(0.50)
    expect(w.ddm).toBe(0.25)
  })

  it('dividend: DDM 50%, FCFF 30%', () => {
    const w = getModelWeights('dividend', false)
    expect(w.ddm).toBe(0.50)
    expect(w.fcff).toBe(0.30)
  })

  it('startup: multiples 70%', () => {
    const w = getModelWeights('startup', false)
    expect(w.multiples).toBe(0.70)
  })

  it('all weights sum to 1.0 for every company type', () => {
    const types = ['financial', 'dividend', 'growth', 'startup', 'standard'] as const
    for (const type of types) {
      for (const hasDividend of [true, false]) {
        const w = getModelWeights(type, hasDividend)
        const sum = w.fcff + w.fcfe + w.ddm + w.multiples
        expect(sum).toBeCloseTo(1.0, 5)
      }
    }
  })
})

describe('getGrowthModel', () => {
  it('uses three-stage for growth companies', () => {
    expect(getGrowthModel('growth', 0.10)).toBe('three-stage')
  })

  it('uses three-stage for startup companies', () => {
    expect(getGrowthModel('startup', 0.05)).toBe('three-stage')
  })

  it('uses three-stage when CAGR > 15% regardless of type', () => {
    expect(getGrowthModel('standard', 0.20)).toBe('three-stage')
  })

  it('uses two-stage for standard companies with low CAGR', () => {
    expect(getGrowthModel('standard', 0.08)).toBe('two-stage')
  })
})

// ── Country Risk Premium ──────────────────────────────────────────────────────

describe('getCRP', () => {
  it('returns 0 for USD (US — mature market)', () => {
    expect(getCRP('USD')).toBe(0)
  })

  it('returns Damodaran Jan 2025 value for ARS (Argentina)', () => {
    expect(getCRP('ARS')).toBe(0.1541)
  })

  it('returns 0.034 for BRL (Brazil)', () => {
    expect(getCRP('BRL')).toBe(0.034)
  })

  it('is case-insensitive', () => {
    expect(getCRP('brl')).toBe(getCRP('BRL'))
  })

  it('returns 1% fallback for unknown currencies', () => {
    expect(getCRP('XYZ')).toBe(0.01)
  })
})

// ── calculateMultiples ────────────────────────────────────────────────────────

describe('calculateMultiples — industry median lookup', () => {
  const baseMultInput = {
    sector: 'Technology',
    industry: 'Semiconductors',
    companyType: 'growth' as const,
    currentPrice: 100,
    trailingPE: 20,
    priceToBook: 5,
    priceToSales: 6,
    evToEbitda: 15,
    evToRevenue: 7,
  }

  it('uses Semiconductors industry median PE = 26×', () => {
    const result = calculateMultiples(baseMultInput)
    const pe = result.estimates.find(e => e.multiple === 'P/E')!
    expect(pe.sectorMedian).toBe(26)
    expect(pe.applicable).toBe(true)
  })

  it('implied fair value = currentPrice × benchmarkMedian / actual', () => {
    const result = calculateMultiples(baseMultInput)
    const pe = result.estimates.find(e => e.multiple === 'P/E')!
    const expected = (100 * 26) / 20
    expect(pe.impliedFairValue).toBeCloseTo(expected, 1)
  })

  it('EV/EBITDA not applicable for financial companies', () => {
    const result = calculateMultiples({ ...baseMultInput, companyType: 'financial' })
    const evEbitda = result.estimates.find(e => e.multiple === 'EV/EBITDA')!
    expect(evEbitda.applicable).toBe(false)
  })

  it('P/Book is applicable for financial companies', () => {
    const result = calculateMultiples({ ...baseMultInput, companyType: 'financial', sector: 'Financial Services', industry: 'Banks—Diversified' })
    const pb = result.estimates.find(e => e.multiple === 'P/Book')!
    expect(pb.applicable).toBe(true)
  })

  it('blendedFairValue is equal-weight average of applicable estimates', () => {
    const result = calculateMultiples(baseMultInput)
    const applicable = result.estimates.filter(e => e.applicable && e.impliedFairValue > 0)
    if (applicable.length > 0) {
      const expected = applicable.reduce((s, e) => s + e.impliedFairValue, 0) / applicable.length
      expect(result.blendedFairValue).toBeCloseTo(expected, 1)
    }
  })

  it('returns blendedFairValue = null when no applicable multiples', () => {
    const result = calculateMultiples({
      ...baseMultInput,
      trailingPE: null, priceToBook: null, priceToSales: null, evToEbitda: null, evToRevenue: null,
    })
    expect(result.blendedFairValue).toBeNull()
  })

  it('falls back to sector median when industry not in table', () => {
    const result = calculateMultiples({ ...baseMultInput, industry: 'Unknown New Industry XYZ' })
    const pe = result.estimates.find(e => e.multiple === 'P/E')!
    // Should use Technology sector median (28×)
    expect(pe.sectorMedian).toBe(28)
    expect(pe.benchmarkSource).toBe('sector-fallback')
  })

  it('ignores negative or infinite actual multiples', () => {
    const result = calculateMultiples({ ...baseMultInput, trailingPE: -5, evToEbitda: Infinity })
    const pe = result.estimates.find(e => e.multiple === 'P/E')!
    const evEbitda = result.estimates.find(e => e.multiple === 'EV/EBITDA')!
    expect(pe.applicable).toBe(false)
    expect(evEbitda.applicable).toBe(false)
  })

  it('live peers (≥3) override static industry median', () => {
    const livePeers = [
      { ticker: 'PEER1', trailingPE: 30, priceToBook: null, priceToSales: null, evToEbitda: null, evToRevenue: null },
      { ticker: 'PEER2', trailingPE: 32, priceToBook: null, priceToSales: null, evToEbitda: null, evToRevenue: null },
      { ticker: 'PEER3', trailingPE: 28, priceToBook: null, priceToSales: null, evToEbitda: null, evToRevenue: null },
    ]
    const result = calculateMultiples({ ...baseMultInput, livePeers })
    const pe = result.estimates.find(e => e.multiple === 'P/E')!
    expect(pe.benchmarkSource).toBe('live-peers')
    expect(pe.sectorMedian).toBe(30)  // median of [28, 30, 32]
  })
})
