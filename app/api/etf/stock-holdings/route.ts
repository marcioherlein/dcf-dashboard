import { NextRequest, NextResponse } from 'next/server'
import { ALL_TICKERS } from '@/lib/data/etfUniverse'

interface HoldingResult {
  etfTicker: string
  etfName: string
  weight: number
  valueScore: number | null
}

const CONCURRENCY = 8

async function fetchProfileWithTimeout(ticker: string): Promise<{ ticker: string; profile: Record<string, unknown> | null }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/etf/profile?ticker=${ticker}`,
      { signal: controller.signal },
    )
    if (!res.ok) return { ticker, profile: null }
    const profile = await res.json()
    return { ticker, profile }
  } catch {
    return { ticker, profile: null }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function GET(req: NextRequest) {
  const stockTicker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()?.trim()
  if (!stockTicker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const results: HoldingResult[] = []

  for (let i = 0; i < ALL_TICKERS.length; i += CONCURRENCY) {
    const batch = ALL_TICKERS.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map((t) => fetchProfileWithTimeout(t)))
    for (const r of settled) {
      if (r.status !== 'fulfilled' || !r.value.profile) continue
      const profile = r.value.profile
      const holdings = (profile.holdings as Array<{ symbol: string; weight: number | null }> | undefined) ?? []
      const match = holdings.find((h) => h.symbol?.toUpperCase() === stockTicker)
      if (match) {
        results.push({
          etfTicker: r.value.ticker,
          etfName: (profile.name as string) ?? r.value.ticker,
          weight: match.weight ?? 0,
          valueScore: (profile.valueScore as number | null) ?? null,
        })
      }
    }
  }

  results.sort((a, b) => b.weight - a.weight)

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  })
}
