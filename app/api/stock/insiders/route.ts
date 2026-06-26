import { NextRequest, NextResponse } from 'next/server'

export interface InsiderTransaction {
  date: string
  insiderName: string
  title: string
  transactionType: 'buy' | 'sell' | 'grant' | 'other'
  shares: number | null
  pricePerShare: number | null
  totalValue: number | null
  secUrl: string | null
}

export interface InsidersResponse {
  transactions: InsiderTransaction[]
  sentiment: 'net_buyer' | 'net_seller' | 'neutral' | 'insufficient_data'
  netShares90d: number      // positive = net bought, negative = net sold
  buyCount90d: number
  sellCount90d: number
  daysBack: number
}

// Cache — 6h TTL
const _cache = new Map<string, { data: InsidersResponse; ts: number }>()
const TTL = 6 * 60 * 60 * 1000

// SEC EDGAR full-text search for Form 4 filings — kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _fetchEdgarForm4(ticker: string, daysBack = 90): Promise<InsiderTransaction[]> {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)
  const startdt = since.toISOString().split('T')[0]

  // EDGAR EFTS search — returns Form 4 filings mentioning the ticker
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&forms=4&dateRange=custom&startdt=${startdt}&_source=file_date,display_date_filed,display_names,entity_name,file_num`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'insic.app research/1.0 contact@insic.app' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hits: any[] = data?.hits?.hits ?? []

  const transactions: InsiderTransaction[] = []

  for (const hit of hits.slice(0, 20)) {
    const src = hit._source ?? {}
    const filed = src.file_date ?? src.display_date_filed ?? null
    if (!filed) continue

    // Try to get accession number from _id for SEC link
    const accessionRaw = hit._id as string | null
    const accession = accessionRaw?.replace(/\//g, '-') ?? null
    const secUrl = accession
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${src.file_num}&type=4&dateb=&owner=include&count=10`
      : null

    // Display names typically: "John Smith [Director] (12345678)"
    const displayNames: string[] = src.display_names ?? []
    const insiderName = displayNames[0]?.replace(/\s*\[.*?\]\s*\(.*?\)/, '').trim() ?? 'Insider'
    const titleMatch = displayNames[0]?.match(/\[([^\]]+)\]/)
    const title = titleMatch?.[1] ?? ''

    // We can't reliably extract transaction type, shares, or price from EFTS metadata alone.
    // Mark as 'other' and let the UI show the link — users can click through.
    // For a richer implementation, parse the actual Form 4 XML via EDGAR /Archives.
    transactions.push({
      date: filed,
      insiderName,
      title,
      transactionType: 'other',
      shares: null,
      pricePerShare: null,
      totalValue: null,
      secUrl,
    })
  }

  return transactions
}

// Yahoo Finance insider transactions as richer fallback
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

async function fetchYahooInsiders(ticker: string): Promise<InsiderTransaction[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any = await yf.quoteSummary(ticker, {
      modules: ['insiderTransactions'],
    }, { validateResult: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txns: any[] = summary?.insiderTransactions?.transactions ?? []
    return txns.slice(0, 15).map(t => {
      const typeStr = (t.transactionDescription ?? '').toLowerCase()
      const transactionType: InsiderTransaction['transactionType'] =
        typeStr.includes('sale') || typeStr.includes('sell') ? 'sell'
        : typeStr.includes('purchase') || typeStr.includes('buy') ? 'buy'
        : typeStr.includes('award') || typeStr.includes('grant') || typeStr.includes('option') ? 'grant'
        : 'other'

      const shares = t.shares?.raw ?? t.shares ?? null
      const price  = t.value?.raw != null && shares != null && shares > 0
        ? t.value.raw / shares
        : null
      const value  = t.value?.raw ?? null

      return {
        date: t.startDate?.fmt ?? t.startDate ?? '',
        insiderName: t.filerName ?? 'Insider',
        title: t.filerRelation ?? '',
        transactionType,
        shares: typeof shares === 'number' ? Math.round(shares) : null,
        pricePerShare: typeof price === 'number' ? Math.round(price * 100) / 100 : null,
        totalValue: typeof value === 'number' ? Math.round(value) : null,
        secUrl: t.link ?? null,
      }
    })
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const cached = _cache.get(ticker)
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    // Yahoo is richer (has actual transaction type + shares + value)
    const transactions = await fetchYahooInsiders(ticker)

    // Compute 90-day sentiment from buys vs sells
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const recent = transactions.filter(t => t.date && new Date(t.date) >= cutoff)

    const buys  = recent.filter(t => t.transactionType === 'buy')
    const sells = recent.filter(t => t.transactionType === 'sell')

    const netShares = buys.reduce((s, t) => s + (t.shares ?? 0), 0)
                    - sells.reduce((s, t) => s + (t.shares ?? 0), 0)

    const sentiment: InsidersResponse['sentiment'] =
      recent.length === 0 ? 'insufficient_data'
      : buys.length > sells.length * 1.5 ? 'net_buyer'
      : sells.length > buys.length * 1.5 ? 'net_seller'
      : 'neutral'

    const result: InsidersResponse = {
      transactions: transactions.slice(0, 10),
      sentiment,
      netShares90d: netShares,
      buyCount90d: buys.length,
      sellCount90d: sells.length,
      daysBack: 90,
    }

    _cache.set(ticker, { data: result, ts: Date.now() })
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[insiders]', err)
    return NextResponse.json({ error: 'Failed to fetch insider data' }, { status: 500 })
  }
}
