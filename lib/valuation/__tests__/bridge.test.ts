// Unit tests for lib/valuation/bridge.ts
// bridge.ts computes the EV → equity → per-share bridge.
//
// Unit conventions (matching bridge.ts):
//   enterpriseValue / cashM / debtM: in $M
//   sharesM: in millions of shares
//   fairValuePerShare: (equityValueM / sharesM) * 1000
//     e.g. equityValue=$1 100M, shares=10M → (1100/10)*1000 = $110 000
//     The *1000 factor scales M/M to $/share for the internal representation.
//
// The function always returns a BridgeResult object (never null).
// Individual fields are null when inputs are insufficient.

import { computeBridge, computeEquityBridge } from '../bridge'

describe('computeBridge', () => {
  it('computes equity value and fair value per share from valid inputs', () => {
    // equityValue = 1000 + 200 - 100 = 1100 ($M)
    // fairValuePerShare = (1100 / 10) * 1000 = 110 000
    // upsidePct = (110000 - 50) / 50 = 2199
    const result = computeBridge(1000, 200, 100, 10, 50)
    expect(result.equityValue).toBeCloseTo(1100, 4)
    expect(result.fairValuePerShare).toBeCloseTo(110000, 0)
    expect(result.upsidePct).not.toBeNull()
  })

  it('propagates null fairValuePerShare and upsidePct when EV is null', () => {
    const result = computeBridge(null, 200, 100, 10, 50)
    expect(result.equityValue).toBeNull()
    expect(result.fairValuePerShare).toBeNull()
    expect(result.upsidePct).toBeNull()
    // passthrough inputs are preserved
    expect(result.cashM).toBe(200)
  })

  it('propagates null equityValue and fairValuePerShare when cash is null', () => {
    const result = computeBridge(1000, null, 100, 10, 50)
    expect(result.equityValue).toBeNull()
    expect(result.fairValuePerShare).toBeNull()
    expect(result.upsidePct).toBeNull()
  })

  it('returns null fairValuePerShare when shares is 0 (division by zero guard)', () => {
    const result = computeBridge(1000, 200, 100, 0, 50)
    // equityValue is computable but per-share is not
    expect(result.equityValue).toBeCloseTo(1100, 4)
    expect(result.fairValuePerShare).toBeNull()
    expect(result.upsidePct).toBeNull()
  })

  it('preserves currentPrice on the result', () => {
    const result = computeBridge(1000, 200, 100, 10, 50)
    expect(result.currentPrice).toBe(50)
  })
})

describe('computeEquityBridge', () => {
  it('computes fair value from equity value and shares (no EV step)', () => {
    // fairValuePerShare = (500 / 10) * 1000 = 50 000
    // upsidePct = (50000 - 50) / 50 = 999
    const result = computeEquityBridge(500, 10, 50)
    expect(result.fairValuePerShare).toBeCloseTo(50000, 0)
    expect(result.upsidePct).not.toBeNull()
  })

  it('returns null fairValuePerShare when equity value is null', () => {
    const result = computeEquityBridge(null, 10, 50)
    expect(result.fairValuePerShare).toBeNull()
    expect(result.upsidePct).toBeNull()
  })

  it('returns null fairValuePerShare when shares is 0', () => {
    const result = computeEquityBridge(500, 0, 50)
    expect(result.fairValuePerShare).toBeNull()
    expect(result.upsidePct).toBeNull()
  })

  it('preserves currentPrice on the result', () => {
    const result = computeEquityBridge(500, 10, 75)
    expect(result.currentPrice).toBe(75)
  })
})
