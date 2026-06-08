import { NextRequest, NextResponse } from 'next/server'
import { getQuoteSummaryForPeer } from '@/lib/data/yahooClient'
import { rateLimit } from '@/lib/rateLimit'

export interface QuotePeerData {
  ticker: string
  name: string
  forwardPE: number | null
  epsGrowth: number | null
  marketCap: number | null
  sector: string | null
  analystCount: number | null
  /** true when forwardPE or epsGrowth is missing — caller decides whether to reject or plot anyway */
  hasEstimates: boolean
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 6, 60_000, 'stock-quote-peer')
  if (limited) return limited

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()?.trim()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Whether to relax the extreme-contraction filter for manually added tickers
  const relaxed = req.nextUrl.searchParams.get('relaxed') === '1'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any = await getQuoteSummaryForPeer(ticker)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = summary as any

    const forwardPE: number | null =
      s?.defaultKeyStatistics?.forwardPE ??
      s?.summaryDetail?.forwardPE ??
      null

    const trends = s?.earningsTrend?.trend ?? []
    const trend1y = trends.find((t: { period?: string }) => t.period === '+1y')
    const epsGrowthRaw: number | null = trend1y?.earningsEstimate?.growth ?? null
    const analystCount: number | null = trend1y?.earningsEstimate?.numberOfAnalysts ?? null

    const name: string = s?.price?.longName ?? s?.price?.shortName ?? ticker
    const marketCap: number | null = s?.price?.marketCap ?? null
    const sector: string | null = s?.price?.sector ?? null

    // For standard (non-relaxed) calls, apply the same validity checks as /api/peers
    let forwardPEFiltered = forwardPE
    let epsGrowthFiltered = epsGrowthRaw
    if (!relaxed) {
      if (forwardPE != null && (forwardPE <= 0 || forwardPE > 150)) forwardPEFiltered = null
      if (epsGrowthRaw != null && epsGrowthRaw < -0.5) epsGrowthFiltered = null
    }

    const hasEstimates = forwardPEFiltered != null && epsGrowthFiltered != null

    const data: QuotePeerData = {
      ticker,
      name,
      forwardPE: forwardPEFiltered,
      epsGrowth: epsGrowthFiltered,
      marketCap,
      sector,
      analystCount,
      hasEstimates,
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch data for this ticker' }, { status: 500 })
  }
}
