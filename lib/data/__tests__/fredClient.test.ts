// Unit tests for fredClient — specifically verifying decimal vs percent units
// These tests mock fetch so they don't require a FRED API key.
//
// IMPORTANT: We set process.env.FRED_API_KEY = 'test' so the module does not
// short-circuit at the `if (!apiKey) return 0.0429` guard and actually calls
// fetch (the mock). Without this, all tests would pass trivially because the
// fallback is always returned before fetch is invoked.

jest.mock('node-fetch', () => jest.fn(), { virtual: true })

describe('getRfRate', () => {
  const originalFetch = global.fetch
  const originalKey = process.env.FRED_API_KEY

  beforeEach(() => {
    // Force the code to call fetch so the mocks are exercised
    process.env.FRED_API_KEY = 'test_key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.FRED_API_KEY = originalKey
  })

  it('returns decimal (not percent) when FRED API succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [{ value: '4.29' }, { value: '4.28' }]
      })
    }) as unknown as typeof fetch

    jest.resetModules()
    const { getRfRate } = await import('../fredClient')
    const rate = await getRfRate()
    expect(rate).toBeCloseTo(0.0429, 4)
    expect(rate).toBeLessThan(1) // must be decimal, not percent
  })

  it('returns decimal fallback when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch

    jest.resetModules()
    const { getRfRate } = await import('../fredClient')
    const rate = await getRfRate()
    expect(rate).toBeCloseTo(0.0429, 4)
    expect(rate).toBeLessThan(1)
  })

  it('returns decimal fallback when HTTP error', async () => {
    // Documents the fixed behavior: original code had `return 4.29` (percent bug).
    // After the fix, !res.ok returns 0.0429 (decimal), matching the other fallbacks.
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch

    jest.resetModules()
    const { getRfRate } = await import('../fredClient')
    const rate = await getRfRate()
    expect(rate).toBeLessThan(1) // must not be 4.29 (percent)
    expect(rate).toBeCloseTo(0.0429, 4)
  })
})
