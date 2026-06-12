import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export const revalidate = 120

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export type NewsItem = {
  title: string
  source: string
  time: string
  url: string
}

// Reduced to most reliable feeds to minimise timeout exposure.
// Timeout per feed: 2s (was 5s). Slow feeds are dropped silently.
const RSS_FEEDS: { url: string; source: string }[] = [
  { url: 'https://feeds.reuters.com/reuters/businessNews',       source: 'Reuters' },
  { url: 'https://feeds.reuters.com/reuters/finance',            source: 'Reuters Finance' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC' },
  { url: 'https://finance.yahoo.com/news/rssindex',              source: 'Market News' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',       source: 'WSJ Markets' },
  { url: 'https://www.nasdaq.com/feed/rssoutbound?category=Markets', source: 'Nasdaq' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml',      source: 'BBC Business' },
]

async function fetchWithTimeout(url: string, ms = 2000): Promise<Response> {
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
      const url  = extractLink(content) ?? ''
      const date = extractTag(content, 'pubDate')
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

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000, 'markets-news')
  if (limited) return limited

  try {
    const [yfNewsResult, ...rssResults] = await Promise.all([
      yf.search('stock market finance', { newsCount: 20, quotesCount: 0 }).catch(() => ({ news: [] })),
      ...RSS_FEEDS.map(f => fetchRSS(f.url, f.source)),
    ])

    const allItems: RawItem[] = []

    // Yahoo Finance news
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawYf: any[] = (yfNewsResult as any).news ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawYf.forEach((n: any) => {
      if (!n.title) return
      const ts = n.providerPublishTime ? (n.providerPublishTime as number) * 1000 : 0
      allItems.push({
        title: n.title,
        url: (n.link ?? n.url ?? '') as string,
        source: (n.publisher ?? n.source ?? 'Market News') as string,
        time: ts ? formatAge(new Date(ts).toISOString()) : '',
        timestamp: ts,
      })
    })

    // RSS feeds
    for (const result of rssResults as RawItem[][]) {
      allItems.push(...result)
    }

    // Deduplicate by URL then title prefix
    const seenUrls   = new Set<string>()
    const seenTitles = new Set<string>()
    const news: NewsItem[] = allItems
      .filter(item => {
        if (!item.title) return false
        const titleKey = item.title.toLowerCase().slice(0, 72)
        if (seenTitles.has(titleKey)) return false
        if (item.url && seenUrls.has(item.url)) return false
        seenTitles.add(titleKey)
        if (item.url) seenUrls.add(item.url)
        return true
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 40)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ timestamp: _t, ...rest }) => rest)

    return NextResponse.json({ news })
  } catch (e) {
    return NextResponse.json({ news: [], error: String(e) })
  }
}
