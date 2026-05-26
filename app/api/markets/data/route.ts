import { NextResponse } from 'next/server'
import { getYieldCurve } from '@/lib/data/fredClient'
import type { YieldCurvePoint } from '@/lib/data/fredClient'

export const revalidate = 120

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
  url: string
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
  { symbol: '^GSPC',   name: 'S&P 500',          group: 'indices' },
  { symbol: '^IXIC',   name: 'Nasdaq Composite',  group: 'indices' },
  { symbol: '^NDX',    name: 'Nasdaq 100',        group: 'indices' },
  { symbol: '^DJI',    name: 'Dow Jones',         group: 'indices' },
  { symbol: 'IWM',     name: 'Russell 2000',      group: 'indices' },
  { symbol: '^VIX',    name: 'CBOE VIX',          group: 'indices' },
  { symbol: '^TNX',    name: '10Y Treasury',      group: 'indices' },
  // Sectors
  { symbol: 'XLY',  name: 'Cons. Discretionary', group: 'sectors' },
  { symbol: 'XLP',  name: 'Cons. Staples',        group: 'sectors' },
  { symbol: 'XLE',  name: 'Energy',               group: 'sectors' },
  { symbol: 'XLF',  name: 'Financials',           group: 'sectors' },
  { symbol: 'XLV',  name: 'Health Care',          group: 'sectors' },
  { symbol: 'XLI',  name: 'Industrials',          group: 'sectors' },
  { symbol: 'XLB',  name: 'Materials',            group: 'sectors' },
  { symbol: 'XLRE', name: 'Real Estate',          group: 'sectors' },
  { symbol: 'XLK',  name: 'Technology',           group: 'sectors' },
  { symbol: 'XLC',  name: 'Communications',       group: 'sectors' },
  { symbol: 'XLU',  name: 'Utilities',            group: 'sectors' },
  // Fixed Income ETFs
  { symbol: 'TLT', name: 'U.S. Treasuries', group: 'fixedIncome' },
  { symbol: 'IEF', name: '7-10Y Treasury',  group: 'fixedIncome' },
  { symbol: 'MUB', name: 'Municipals',      group: 'fixedIncome' },
  { symbol: 'HYG', name: 'High Yield',      group: 'fixedIncome' },
  { symbol: 'LQD', name: 'High Grade',      group: 'fixedIncome' },
  { symbol: 'TIP', name: 'T.I.P.S',         group: 'fixedIncome' },
  // Currencies
  { symbol: 'DX-Y.NYB', name: 'U.S. Dollar Index', group: 'currencies' },
  { symbol: 'EURUSD=X', name: 'Euro',               group: 'currencies' },
  { symbol: 'USDJPY=X', name: 'Japanese Yen',       group: 'currencies' },
  { symbol: 'GBPUSD=X', name: 'British Pound',      group: 'currencies' },
  { symbol: 'BTC-USD',  name: 'Bitcoin',             group: 'currencies' },
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
  { symbol: 'GC=F', name: 'Gold',        group: 'commodities' },
  { symbol: 'CL=F', name: 'Crude Oil',   group: 'commodities' },
  { symbol: 'NG=F', name: 'Natural Gas', group: 'commodities' },
  { symbol: 'BZ=F', name: 'Brent Crude', group: 'commodities' },
  { symbol: 'SI=F', name: 'Silver',      group: 'commodities' },
]

// ── RSS feed sources (22 feeds) ────────────────────────────────────────────
const RSS_FEEDS: { url: string; source: string }[] = [
  { url: 'https://feeds.reuters.com/reuters/businessNews',                         source: 'Reuters' },
  { url: 'https://feeds.reuters.com/reuters/finance',                              source: 'Reuters Finance' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                        source: 'BBC Business' },
  { url: 'https://www.theguardian.com/business/rss',                               source: 'The Guardian' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',                  source: 'MarketWatch' },
  { url: 'https://feeds.marketwatch.com/marketwatch/realtimeheadlines/',           source: 'MarketWatch RT' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',                 source: 'CNBC' },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',                  source: 'CNBC Investing' },
  { url: 'https://finance.yahoo.com/news/rssindex',                                source: 'Yahoo Finance' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',                         source: 'WSJ Markets' },
  { url: 'https://rss.cnn.com/rss/money_latest.rss',                              source: 'CNN Business' },
  { url: 'https://www.investopedia.com/feedbuilder/feed/getfeed/?feedName=rss_headline', source: 'Investopedia' },
  { url: 'https://www.barrons.com/xml/rss/3_7028.xml',                            source: "Barron's" },
  { url: 'https://www.nasdaq.com/feed/rssoutbound?category=Markets',              source: 'Nasdaq' },
  { url: 'https://www.forbes.com/investing/feed2/',                                source: 'Forbes' },
  { url: 'https://www.thestreet.com/rss/main/markets.xml',                        source: 'TheStreet' },
  { url: 'https://seekingalpha.com/market_currents.xml',                           source: 'Seeking Alpha' },
  { url: 'https://www.fool.com/feeds/index.aspx',                                  source: 'Motley Fool' },
  { url: 'https://kiplinger.com/feeds/rss/investing',                              source: 'Kiplinger' },
  { url: 'https://markets.businessinsider.com/rss/news',                           source: 'Business Insider' },
  { url: 'https://www.zacks.com/stock/news.php?output=rss',                       source: 'Zacks' },
  { url: 'https://feeds.bloomberg.com/markets/news.rss',                           source: 'Bloomberg' },
]

// ── RSS helpers ────────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
    })
  } finally {
    clearTimeout(t)
  }
}

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!m) return null
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function extractLink(itemXml: string): string | null {
  const std = extractTag(itemXml, 'link')
  if (std && std.startsWith('http')) return std
  const atom = itemXml.match(/<link[^>]+href="([^"]+)"/)
  if (atom) return atom[1]
  const guid = extractTag(itemXml, 'guid')
  if (guid && guid.startsWith('http')) return guid
  return null
}

function stripHTML(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

function formatAge(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const diff = Date.now() - d.getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

type RawItem = NewsItem & { timestamp: number }

async function fetchRSS(feedUrl: string, sourceName: string): Promise<RawItem[]> {
  try {
    const res = await fetchWithTimeout(feedUrl)
    if (!res.ok) return []
    const xml = await res.text()
    const items: RawItem[] = []
    const re = /<item>([\s\S]*?)<\/item>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const content = m[1]
      const title = extractTag(content, 'title')
      if (!title) continue
      const url   = extractLink(content) ?? ''
      const date  = extractTag(content, 'pubDate')
             ?? extractTag(content, 'dc:date')
             ?? extractTag(content, 'published')
             ?? ''
      const ts = date ? new Date(date).getTime() : 0
      items.push({
        title: stripHTML(title),
        url,
        source: sourceName,
        time: date ? formatAge(date) : '',
        timestamp: isNaN(ts) ? 0 : ts,
      })
    }
    return items
  } catch {
    return []
  }
}

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

    // Fetch market data, Yahoo news, yield curve, and all RSS feeds in parallel
    const [quoteResults, yfNewsResult, yieldCurve, ...rssResults] = await Promise.all([
      Promise.allSettled(symbols.map(s => yf.quote(s).catch(() => null))),
      yf.search('stock market finance', { newsCount: 20, quotesCount: 0 }).catch(() => ({ news: [] })),
      getYieldCurve(),
      ...RSS_FEEDS.map(f => fetchRSS(f.url, f.source)),
    ])

    // Map quote results
    const quoteMap = new Map<string, MarketInstrument>()
    symbols.forEach((sym, i) => {
      const r = quoteResults[i]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = r.status === 'fulfilled' ? (r as PromiseFulfilledResult<any>).value : null
      const def = INSTRUMENTS.find(x => x.symbol === sym)!
      quoteMap.set(sym, toInstrument(def, q))
    })

    const group = (g: string) => INSTRUMENTS.filter(i => i.group === g).map(i => quoteMap.get(i.symbol)!)

    // Collect all news items
    const allItems: RawItem[] = []

    // Yahoo Finance search results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawYf: any[] = (yfNewsResult as any).news ?? []
    rawYf.forEach((n: any) => {
      if (!n.title) return
      const ts = n.providerPublishTime ? (n.providerPublishTime as number) * 1000 : 0
      allItems.push({
        title: n.title,
        url: (n.link ?? n.url ?? '') as string,
        source: (n.publisher ?? n.source ?? 'Yahoo Finance') as string,
        time: ts ? formatAge(new Date(ts).toISOString()) : '',
        timestamp: ts,
      })
    })

    // RSS feed results
    for (const result of rssResults as RawItem[][]) {
      allItems.push(...result)
    }

    // Deduplicate: prefer items with URLs, then by title prefix
    const seenUrls  = new Set<string>()
    const seenTitles = new Set<string>()
    const deduped = allItems.filter(item => {
      if (!item.title) return false
      const titleKey = item.title.toLowerCase().slice(0, 72)
      if (seenTitles.has(titleKey)) return false
      if (item.url && seenUrls.has(item.url)) return false
      seenTitles.add(titleKey)
      if (item.url) seenUrls.add(item.url)
      return true
    })

    // Sort newest first, take top 40
    const news: NewsItem[] = deduped
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 40)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ timestamp: _t, ...rest }) => rest)

    const data: MarketsData = {
      indices:         group('indices'),
      sectors:         group('sectors'),
      fixedIncome:     group('fixedIncome'),
      currencies:      group('currencies'),
      globalBroad:     group('globalBroad'),
      globalDeveloped: group('globalDeveloped'),
      globalEmerging:  group('globalEmerging'),
      commodities:     group('commodities'),
      yieldCurve,
      news,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
