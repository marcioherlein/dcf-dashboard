import { NextResponse } from 'next/server'
import { getYieldCurve } from '@/lib/data/fredClient'
import type { YieldCurvePoint } from '@/lib/data/fredClient'

export const revalidate = 60

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export type MarketInstrument = {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePct: number | null
}

export type NewsItem = {
  title: string
  source: string
  time: string
}

export type MarketsData = {
  indices: MarketInstrument[]
  sectors: MarketInstrument[]
  fixedIncome: MarketInstrument[]
  currencies: MarketInstrument[]
  globalBroad: MarketInstrument[]
  globalDeveloped: MarketInstrument[]
  globalEmerging: MarketInstrument[]
  commodities: MarketInstrument[]
  yieldCurve: YieldCurvePoint[]
  news: NewsItem[]
  fetchedAt: string
}

const INSTRUMENTS: { symbol: string; name: string; group: string }[] = [
  // Indices
  { symbol: '^GSPC',   name: 'S&P 500',        group: 'indices' },
  { symbol: '^IXIC',   name: 'Nasdaq Composite', group: 'indices' },
  { symbol: '^NDX',    name: 'Nasdaq 100',      group: 'indices' },
  { symbol: '^DJI',    name: 'Dow Jones',       group: 'indices' },
  { symbol: 'IWM',     name: 'Russell 2000',    group: 'indices' },
  { symbol: '^VIX',    name: 'CBOE VIX',        group: 'indices' },
  // Sectors
  { symbol: 'XLY',  name: 'Cons. Discretionary', group: 'sectors' },
  { symbol: 'XLP',  name: 'Cons. Staples',       group: 'sectors' },
  { symbol: 'XLE',  name: 'Energy',              group: 'sectors' },
  { symbol: 'XLF',  name: 'Financials',          group: 'sectors' },
  { symbol: 'XLV',  name: 'Health Care',         group: 'sectors' },
  { symbol: 'XLI',  name: 'Industrials',         group: 'sectors' },
  { symbol: 'XLB',  name: 'Materials',           group: 'sectors' },
  { symbol: 'XLRE', name: 'Real Estate',         group: 'sectors' },
  { symbol: 'XLK',  name: 'Technology',          group: 'sectors' },
  { symbol: 'XLC',  name: 'Communications',      group: 'sectors' },
  { symbol: 'XLU',  name: 'Utilities',           group: 'sectors' },
  // Fixed Income ETFs
  { symbol: 'TLT', name: 'U.S. Treasuries',  group: 'fixedIncome' },
  { symbol: 'IEF', name: '7-10Y Treasury',   group: 'fixedIncome' },
  { symbol: 'MUB', name: 'Municipals',       group: 'fixedIncome' },
  { symbol: 'HYG', name: 'High Yield',       group: 'fixedIncome' },
  { symbol: 'LQD', name: 'High Grade',       group: 'fixedIncome' },
  { symbol: 'TIP', name: 'T.I.P.S',          group: 'fixedIncome' },
  // Currencies
  { symbol: 'DX-Y.NYB', name: 'U.S. Dollar Index', group: 'currencies' },
  { symbol: 'EURUSD=X', name: 'Euro',              group: 'currencies' },
  { symbol: 'USDJPY=X', name: 'Japanese Yen',      group: 'currencies' },
  { symbol: 'GBPUSD=X', name: 'British Pound',     group: 'currencies' },
  { symbol: 'BTC-USD',  name: 'Bitcoin',           group: 'currencies' },
  // Global Broad
  { symbol: 'ACWI', name: 'World',          group: 'globalBroad' },
  { symbol: 'EFA',  name: 'Developed',      group: 'globalBroad' },
  { symbol: 'VEA',  name: 'Developed Blend', group: 'globalBroad' },
  { symbol: 'EEM',  name: 'Emerging',       group: 'globalBroad' },
  // Global Developed
  { symbol: '^GDAXI', name: 'Germany',        group: 'globalDeveloped' },
  { symbol: '^FTSE',  name: 'United Kingdom', group: 'globalDeveloped' },
  { symbol: '^FCHI',  name: 'France',         group: 'globalDeveloped' },
  { symbol: '^AXJO',  name: 'Australia',      group: 'globalDeveloped' },
  { symbol: '^N225',  name: 'Japan',          group: 'globalDeveloped' },
  // Global Emerging
  { symbol: 'EWZ',  name: 'Brazil',       group: 'globalEmerging' },
  { symbol: 'EWW',  name: 'Mexico',       group: 'globalEmerging' },
  { symbol: 'EZA',  name: 'South Africa', group: 'globalEmerging' },
  { symbol: 'FXI',  name: 'China',        group: 'globalEmerging' },
  { symbol: 'INDA', name: 'India',        group: 'globalEmerging' },
  { symbol: 'EWY',  name: 'South Korea',  group: 'globalEmerging' },
  // Commodities
  { symbol: 'GC=F', name: 'Gold',         group: 'commodities' },
  { symbol: 'CL=F', name: 'Crude Oil',    group: 'commodities' },
  { symbol: 'NG=F', name: 'Natural Gas',  group: 'commodities' },
  { symbol: 'BZ=F', name: 'Brent Crude',  group: 'commodities' },
  { symbol: 'SI=F', name: 'Silver',       group: 'commodities' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInstrument(sym: { symbol: string; name: string }, q: any): MarketInstrument {
  return {
    symbol: sym.symbol,
    name: sym.name,
    price: q?.regularMarketPrice ?? null,
    change: q?.regularMarketChange ?? null,
    changePct: q?.regularMarketChangePercent ?? null,
  }
}

export async function GET() {
  try {
    const symbols = INSTRUMENTS.map(i => i.symbol)

    // Batch quote + news in parallel
    const [quoteResults, newsResult, yieldCurve] = await Promise.all([
      Promise.allSettled(symbols.map(s => yf.quote(s).catch(() => null))),
      yf.search('stock market', { newsCount: 6, quotesCount: 0 }).catch(() => ({ news: [] })),
      getYieldCurve(),
    ])

    // Map results to instruments
    const quoteMap = new Map<string, MarketInstrument>()
    symbols.forEach((sym, i) => {
      const r = quoteResults[i]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = r.status === 'fulfilled' ? (r as PromiseFulfilledResult<any>).value : null
      const def = INSTRUMENTS.find(x => x.symbol === sym)!
      quoteMap.set(sym, toInstrument(def, q))
    })

    const group = (g: string) => INSTRUMENTS.filter(i => i.group === g).map(i => quoteMap.get(i.symbol)!)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawNews: any[] = (newsResult as any).news ?? []
    const news: NewsItem[] = rawNews.slice(0, 5).map((n: any) => ({
      title: n.title ?? '',
      source: n.publisher ?? n.source ?? '',
      time: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '',
    }))

    const data: MarketsData = {
      indices:        group('indices'),
      sectors:        group('sectors'),
      fixedIncome:    group('fixedIncome'),
      currencies:     group('currencies'),
      globalBroad:    group('globalBroad'),
      globalDeveloped: group('globalDeveloped'),
      globalEmerging: group('globalEmerging'),
      commodities:    group('commodities'),
      yieldCurve,
      news,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
