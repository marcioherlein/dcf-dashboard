import { NextResponse } from 'next/server'
import { buildSnapshot, seedAssumptions } from '@/lib/valuation/cockpitBuilders'
import { computeCockpitOutput } from '@/lib/valuation/cockpit'

export const dynamic = 'force-dynamic'

export type FeaturedQuote = {
  ticker: string
  name: string
  etfSource: 'SPY' | 'QQQ' | 'DIA'
  fairValue: number | null
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

// Static metadata — labels, CAGR context, spark shapes. Fair value and upside
// are always overwritten by the live computation below.
const FEATURED: Omit<FeaturedQuote, 'fairValue' | 'price' | 'change' | 'changePct' | 'upsidePct'>[] = [
  { ticker: 'AAPL', name: 'Apple Inc.',             etfSource: 'SPY', impliedCagr: 6.2,  historicalCagr3y: 8.0,  expectation: 'Moderate',     interpretation: 'Growth expectations are fully priced in.',                   sparkData: [168, 172, 169, 175, 178, 174, 180, 179] },
  { ticker: 'NVDA', name: 'NVIDIA Corporation',     etfSource: 'SPY', impliedCagr: 45.4, historicalCagr3y: 60.0, expectation: 'Aggressive',    interpretation: 'Market expects extreme AI-driven growth to continue.',       sparkData: [78,  85,  92,  88,  105, 115, 108, 118] },
  { ticker: 'MSFT', name: 'Microsoft Corporation',  etfSource: 'SPY', impliedCagr: 12.1, historicalCagr3y: 14.0, expectation: 'Moderate',     interpretation: 'Expectations are reasonable for a mature compounder.',      sparkData: [380, 392, 405, 398, 410, 415, 412, 416] },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.',       etfSource: 'QQQ', impliedCagr: 9.8,  historicalCagr3y: 11.0, expectation: 'Moderate',     interpretation: 'AWS + ads make expectations look achievable.',               sparkData: [168, 175, 172, 180, 185, 182, 187, 186] },
  { ticker: 'META', name: 'Meta Platforms, Inc.',   etfSource: 'QQQ', impliedCagr: 16.5, historicalCagr3y: 28.0, expectation: 'Moderate',     interpretation: 'Market prices in continued ad and AI-driven growth.',        sparkData: [420, 440, 462, 448, 490, 515, 538, 552] },
  { ticker: 'TSLA', name: 'Tesla, Inc.',            etfSource: 'QQQ', impliedCagr: 25.0, historicalCagr3y: 9.0,  expectation: 'Aggressive',   interpretation: 'Market expects a strong robotaxi/energy acceleration.',      sparkData: [175, 182, 195, 188, 205, 215, 208, 220] },
  { ticker: 'UNH',  name: 'UnitedHealth Group Inc.',etfSource: 'DIA', impliedCagr: 5.8,  historicalCagr3y: 12.0, expectation: 'Conservative', interpretation: 'Market prices in a significant slowdown from peak growth.',  sparkData: [530, 490, 455, 420, 380, 345, 315, 330] },
  { ticker: 'GS',   name: 'Goldman Sachs Group, Inc.',etfSource: 'DIA', impliedCagr: 6.2, historicalCagr3y: 9.0, expectation: 'Conservative', interpretation: 'Market prices in steady investment banking earnings.',        sparkData: [375, 400, 420, 440, 465, 492, 512, 538] },
  { ticker: 'HD',   name: 'Home Depot, Inc.',       etfSource: 'DIA', impliedCagr: 5.5,  historicalCagr3y: 4.0,  expectation: 'Conservative', interpretation: 'Market prices in modest recovery as housing improves.',      sparkData: [318, 332, 340, 328, 348, 360, 362, 368] },
]

function getBaseUrl(): string {
  // Vercel sets VERCEL_URL (no protocol); NEXTAUTH_URL has full URL in .env
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  return 'http://localhost:3000'
}

async function fetchBlendedFairValue(ticker: string, baseUrl: string): Promise<{ fairValue: number | null; price: number | null; change: number | null; changePct: number | null }> {
  try {
    // Reuse the already-computed financials API response (cached at edge for 1h)
    const res = await fetch(`${baseUrl}/api/financials?ticker=${ticker}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return { fairValue: null, price: null, change: null, changePct: null }

    const apiData = await res.json()
    if (apiData.error) return { fairValue: null, price: null, change: null, changePct: null }

    // Compute the same cockpit blended fair value the stock page uses
    const snapshot    = buildSnapshot(apiData)
    const assumptions = seedAssumptions(apiData)
    const output      = computeCockpitOutput(assumptions, snapshot)

    const price     = (apiData.quote?.price     as number | null) ?? null
    const change    = (apiData.quote?.change    as number | null) ?? null
    const changePct = (apiData.quote?.changePct as number | null) ?? null

    return { fairValue: output.blendedFairValue ?? null, price, change, changePct }
  } catch {
    return { fairValue: null, price: null, change: null, changePct: null }
  }
}

export async function GET() {
  const baseUrl = getBaseUrl()

  const results = await Promise.allSettled(
    FEATURED.map((f) => fetchBlendedFairValue(f.ticker, baseUrl))
  )

  const enriched: FeaturedQuote[] = FEATURED.map((f, i) => {
    const r = results[i]
    const live = r.status === 'fulfilled' ? r.value : { fairValue: null, price: null, change: null, changePct: null }
    const upsidePct = live.fairValue != null && live.price != null && live.price > 0
      ? (live.fairValue - live.price) / live.price
      : null
    return { ...f, fairValue: live.fairValue, price: live.price, change: live.change, changePct: live.changePct, upsidePct }
  })

  return NextResponse.json({ quotes: enriched, updatedAt: new Date().toISOString() })
}
