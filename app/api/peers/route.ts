import { NextRequest, NextResponse } from 'next/server'
import { getRecommendedPeers, getQuoteSummaryForPeer } from '@/lib/data/yahooClient'
import { rateLimit } from '@/lib/rateLimit'

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
    const summary: any = await getQuoteSummaryForPeer(ticker)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = summary as any

    const forwardPE: number | null =
      s?.defaultKeyStatistics?.forwardPE ??
      s?.summaryDetail?.forwardPE ??
      null

    // earningsTrend +1y: rolling 1-year-forward EPS consensus
    const trends = s?.earningsTrend?.trend ?? []
    const trend1y = trends.find((t: { period?: string }) => t.period === '+1y')
    const epsGrowth: number | null = trend1y?.earningsEstimate?.growth ?? null
    const analystCount: number | null = trend1y?.earningsEstimate?.numberOfAnalysts ?? null

    const name: string = s?.price?.longName ?? s?.price?.shortName ?? ticker
    const marketCap: number | null = s?.price?.marketCap ?? null
    const sector: string | null = s?.price?.sector ?? null

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
  const limited = rateLimit(req, 3, 60000, 'peers')
  if (limited) return limited

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const CACHE = { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }

  try {
    // 1. Fetch recommendations (People also watch) + anchor data in parallel
    const [recommended, anchorData] = await Promise.all([
      getRecommendedPeers(ticker),
      fetchPeerData(ticker),
    ])

    if (!anchorData) {
      return NextResponse.json({ error: 'No valuation data available for this ticker' }, { status: 404 })
    }

    // 2. Filter self from recommended list
    const candidatePeers = recommended.filter(s => s !== ticker)

    if (candidatePeers.length === 0) {
      return NextResponse.json({ anchor: anchorData, peers: [] }, CACHE)
    }

    // 3. Fetch peer data in parallel
    const peerResults = await Promise.all(candidatePeers.map(fetchPeerData))
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
