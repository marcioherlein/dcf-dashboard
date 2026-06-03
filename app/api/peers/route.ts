import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

export interface PeerData {
  ticker: string
  name: string
  forwardPE: number
  epsGrowth: number       // 1-year forward EPS growth estimate (decimal, e.g. 0.32 = 32%)
  marketCap: number | null
  sector: string | null
  analystCount: number | null  // number of analysts behind the EPS estimate
}

export interface PeersResponse {
  anchor: PeerData
  peers: PeerData[]
}

async function fetchPeerData(ticker: string): Promise<PeerData | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summaryP: Promise<any> = yahooFinance.quoteSummary(ticker, {
      modules: ['defaultKeyStatistics', 'summaryDetail', 'earningsTrend', 'price'],
    }, { validateResult: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quoteP: Promise<any> = yahooFinance.quote(ticker)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [summary, quote]: [any, any] = await Promise.all([
      summaryP.catch(() => null),
      quoteP.catch(() => null),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = summary as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any

    const forwardPE: number | null =
      s?.defaultKeyStatistics?.forwardPE ??
      s?.summaryDetail?.forwardPE ??
      q?.forwardPE ??
      null

    // earningsTrend +1y: rolling 1-year-forward EPS consensus
    const trends = s?.earningsTrend?.trend ?? []
    const trend1y = trends.find((t: { period?: string }) => t.period === '+1y')
    const epsGrowth: number | null = trend1y?.earningsEstimate?.growth ?? null
    const analystCount: number | null = trend1y?.earningsEstimate?.numberOfAnalysts ?? null

    const name: string = s?.price?.longName ?? s?.price?.shortName ?? ticker
    const marketCap: number | null = s?.price?.marketCap ?? q?.marketCap ?? null
    const sector: string | null = s?.price?.sector ?? q?.sector ?? null

    // Filter out bad data: no PE, no growth, PE outside useful scatter range
    if (forwardPE == null || epsGrowth == null) return null
    if (forwardPE <= 0 || forwardPE > 150) return null
    if (epsGrowth < -0.5) return null  // extreme contraction — distorts chart

    return { ticker, name, forwardPE, epsGrowth, marketCap, sector, analystCount }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const CACHE = { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }

  try {
    // 1. Fetch recommendations (People also watch) + anchor data in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recP: Promise<any> = yahooFinance.quoteSummary(ticker, {
      modules: ['recommendationsBySymbol'],
    }, { validateResult: false })

    const [recSummary, anchorData] = await Promise.all([
      recP.catch(() => null),
      fetchPeerData(ticker),
    ])

    if (!anchorData) {
      return NextResponse.json({ error: 'No valuation data available for this ticker' }, { status: 404 })
    }

    // 2. Extract recommended peers sorted by co-view score, cap at 8 candidates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = recSummary as any
    const recommended: string[] = (rec?.recommendationsBySymbol?.recommendedSymbols ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => (r.symbol as string).toUpperCase())
      .filter((s: string) => s !== ticker)
      .slice(0, 8)

    if (recommended.length === 0) {
      return NextResponse.json({ anchor: anchorData, peers: [] }, CACHE)
    }

    // 3. Fetch peer data in parallel
    const peerResults = await Promise.all(recommended.map(fetchPeerData))
    const rawPeers = peerResults.filter((p): p is PeerData => p !== null)

    // 4. Sector filter: prefer same-sector peers when anchor has a known sector
    // Allow cross-sector if fewer than 2 same-sector peers are available
    const sectorPeers = anchorData.sector
      ? rawPeers.filter(p => p.sector === anchorData.sector)
      : []
    const peers = (sectorPeers.length >= 2 ? sectorPeers : rawPeers).slice(0, 6)

    return NextResponse.json({ anchor: anchorData, peers }, CACHE)
  } catch (err) {
    console.error(`[peers/${ticker}]`, err)
    return NextResponse.json({ error: 'Failed to fetch peer data' }, { status: 500 })
  }
}
