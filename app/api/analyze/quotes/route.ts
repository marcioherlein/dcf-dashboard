import { NextResponse } from 'next/server'
import { getQuote } from '@/lib/data/yahooClient'

export const dynamic = 'force-dynamic'

export type FeaturedQuote = {
  ticker: string
  name: string
  etfSource: 'SPY' | 'QQQ' | 'DIA'
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
  // ── SPY top 3 (S&P 500 by weight) ────────────────────────────────────────
  {
    ticker: 'AAPL', name: 'Apple Inc.', etfSource: 'SPY',
    fairValue: 180, impliedCagr: 6.2, historicalCagr3y: 8.0, expectation: 'Moderate',
    interpretation: 'Growth expectations are fully priced in.',
    sparkData: [168, 172, 169, 175, 178, 174, 180, 179],
  },
  {
    ticker: 'NVDA', name: 'NVIDIA Corporation', etfSource: 'SPY',
    fairValue: 125, impliedCagr: 45.4, historicalCagr3y: 60.0, expectation: 'Aggressive',
    interpretation: 'Market expects extreme AI-driven growth to continue.',
    sparkData: [78, 85, 92, 88, 105, 115, 108, 118],
  },
  {
    ticker: 'MSFT', name: 'Microsoft Corporation', etfSource: 'SPY',
    fairValue: 497, impliedCagr: 12.1, historicalCagr3y: 14.0, expectation: 'Moderate',
    interpretation: 'Expectations are reasonable for a mature compounder.',
    sparkData: [380, 392, 405, 398, 410, 415, 412, 416],
  },
  // ── QQQ top 3 (Nasdaq-100, no SPY overlap) ───────────────────────────────
  {
    ticker: 'AMZN', name: 'Amazon.com, Inc.', etfSource: 'QQQ',
    fairValue: 156, impliedCagr: 9.8, historicalCagr3y: 11.0, expectation: 'Moderate',
    interpretation: 'AWS + ads make expectations look achievable.',
    sparkData: [168, 175, 172, 180, 185, 182, 187, 186],
  },
  {
    ticker: 'META', name: 'Meta Platforms, Inc.', etfSource: 'QQQ',
    fairValue: 520, impliedCagr: 16.5, historicalCagr3y: 28.0, expectation: 'Moderate',
    interpretation: 'Market prices in continued ad and AI-driven growth.',
    sparkData: [420, 440, 462, 448, 490, 515, 538, 552],
  },
  {
    ticker: 'TSLA', name: 'Tesla, Inc.', etfSource: 'QQQ',
    fairValue: 245, impliedCagr: 25.0, historicalCagr3y: 9.0, expectation: 'Aggressive',
    interpretation: 'Market expects a strong robotaxi/energy acceleration.',
    sparkData: [175, 182, 195, 188, 205, 215, 208, 220],
  },
  // ── DIA top 3 (Dow Jones, no prior overlaps) ─────────────────────────────
  {
    ticker: 'UNH', name: 'UnitedHealth Group Inc.', etfSource: 'DIA',
    fairValue: 420, impliedCagr: 5.8, historicalCagr3y: 12.0, expectation: 'Conservative',
    interpretation: 'Market prices in a significant slowdown from peak growth.',
    sparkData: [530, 490, 455, 420, 380, 345, 315, 330],
  },
  {
    ticker: 'GS', name: 'Goldman Sachs Group, Inc.', etfSource: 'DIA',
    fairValue: 530, impliedCagr: 6.2, historicalCagr3y: 9.0, expectation: 'Conservative',
    interpretation: 'Market prices in steady investment banking earnings.',
    sparkData: [375, 400, 420, 440, 465, 492, 512, 538],
  },
  {
    ticker: 'HD', name: 'Home Depot, Inc.', etfSource: 'DIA',
    fairValue: 350, impliedCagr: 5.5, historicalCagr3y: 4.0, expectation: 'Conservative',
    interpretation: 'Market prices in modest recovery as housing improves.',
    sparkData: [318, 332, 340, 328, 348, 360, 362, 368],
  },
]

export async function GET() {
  const results = await Promise.allSettled(FEATURED.map((f) => getQuote(f.ticker)))

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
