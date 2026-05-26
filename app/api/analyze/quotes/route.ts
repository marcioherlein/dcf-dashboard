import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

export const dynamic = 'force-dynamic'

export type FeaturedQuote = {
  ticker: string
  name: string
  fairValue: number
  impliedCagr: number
  historicalCagr3y: number
  expectation: 'Conservative' | 'Moderate' | 'Aggressive'
  interpretation: string
  sparkData: number[]
  price: number | null
  change: number | null
  changePct: number | null
  upsidePct: number | null
}

const FEATURED: Omit<FeaturedQuote, 'price' | 'change' | 'changePct' | 'upsidePct'>[] = [
  {
    ticker: 'NVDA', name: 'NVIDIA Corporation', fairValue: 125,
    impliedCagr: 45.4, historicalCagr3y: 60.0, expectation: 'Aggressive',
    interpretation: 'Market expects extreme growth to continue.',
    sparkData: [78, 85, 92, 88, 105, 115, 108, 118],
  },
  {
    ticker: 'MELI', name: 'MercadoLibre, Inc.', fairValue: 3760,
    impliedCagr: -7.5, historicalCagr3y: 40.0, expectation: 'Conservative',
    interpretation: 'Market is pricing in a deceleration.',
    sparkData: [1420, 1510, 1480, 1560, 1590, 1620, 1650, 1665],
  },
  {
    ticker: 'MSFT', name: 'Microsoft Corporation', fairValue: 497,
    impliedCagr: 12.1, historicalCagr3y: 14.0, expectation: 'Moderate',
    interpretation: 'Expectations are reasonable.',
    sparkData: [380, 392, 405, 398, 410, 415, 412, 416],
  },
  {
    ticker: 'AMZN', name: 'Amazon.com, Inc.', fairValue: 156,
    impliedCagr: 9.8, historicalCagr3y: 11.0, expectation: 'Moderate',
    interpretation: 'Expectations are reasonable.',
    sparkData: [168, 175, 172, 180, 185, 182, 187, 186],
  },
  {
    ticker: 'AAPL', name: 'Apple Inc.', fairValue: 180,
    impliedCagr: 6.2, historicalCagr3y: 8.0, expectation: 'Moderate',
    interpretation: 'Growth expectations are fully priced in.',
    sparkData: [168, 172, 169, 175, 178, 174, 180, 179],
  },
  {
    ticker: 'TSLA', name: 'Tesla, Inc.', fairValue: 245,
    impliedCagr: 25.0, historicalCagr3y: 9.0, expectation: 'Aggressive',
    interpretation: 'Market expects a strong acceleration.',
    sparkData: [175, 182, 195, 188, 205, 215, 208, 220],
  },
]

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await Promise.allSettled(FEATURED.map((f) => (yahooFinance as any).quote(f.ticker)))

  const enriched: FeaturedQuote[] = FEATURED.map((f, i) => {
    const r = results[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = r.status === 'fulfilled' ? (r.value as any) : null
    const price     = (q?.regularMarketPrice         as number | undefined) ?? null
    const change    = (q?.regularMarketChange        as number | undefined) ?? null
    const changePct = (q?.regularMarketChangePercent as number | undefined) ?? null
    const upsidePct = price != null ? (f.fairValue - price) / price : null
    return { ...f, price, change, changePct, upsidePct }
  })

  return NextResponse.json({ quotes: enriched, updatedAt: new Date().toISOString() })
}
