import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export const revalidate = 300

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export type ChartPoint = { date: string; [symbol: string]: number | string }

function periodToDates(period: string): { period1: string; period2: string; interval: '1d' | '1wk' } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const sub = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); return d }
  const subM = (months: number) => { const d = new Date(now); d.setMonth(d.getMonth() - months); return d }
  const subY = (years: number) => { const d = new Date(now); d.setFullYear(d.getFullYear() - years); return d }

  switch (period) {
    case '5D':  return { period1: fmt(sub(7)),    period2: fmt(now), interval: '1d' }
    case '1M':  return { period1: fmt(subM(1)),   period2: fmt(now), interval: '1d' }
    case '3M':  return { period1: fmt(subM(3)),   period2: fmt(now), interval: '1d' }
    case '6M':  return { period1: fmt(subM(6)),   period2: fmt(now), interval: '1d' }
    case 'YTD': return { period1: `${now.getFullYear()}-01-01`, period2: fmt(now), interval: '1d' }
    case '1Y':  return { period1: fmt(subY(1)),   period2: fmt(now), interval: '1d' }
    case '3Y':  return { period1: fmt(subY(3)),   period2: fmt(now), interval: '1wk' }
    case '5Y':  return { period1: fmt(subY(5)),   period2: fmt(now), interval: '1wk' }
    default:    return { period1: `${now.getFullYear()}-01-01`, period2: fmt(now), interval: '1d' }
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const symbols = (url.searchParams.get('symbols') ?? '^GSPC,^DJI,^IXIC,IWM').split(',').filter(Boolean)
    const period = url.searchParams.get('period') ?? 'YTD'

    const { period1, period2, interval } = periodToDates(period)

    const hists = await Promise.allSettled(
      symbols.map(s => yf.historical(s, { period1, period2, interval }).catch(() => []))
    )

    // Build a unified date index from all series
    const dateMap = new Map<string, Record<string, number>>()
    symbols.forEach((sym, i) => {
      const r = hists[i]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = r.status === 'fulfilled' ? (r as PromiseFulfilledResult<any[]>).value : []
      rows.forEach(row => {
        const date = typeof row.date === 'string' ? row.date.split('T')[0] : new Date(row.date).toISOString().split('T')[0]
        const price = row.close ?? row.adjClose ?? null
        if (price == null) return
        if (!dateMap.has(date)) dateMap.set(date, {})
        dateMap.get(date)![sym] = price
      })
    })

    // Sort dates and normalize each series to 0% at first data point
    const sortedDates = Array.from(dateMap.keys()).sort()
    const firstPrices: Record<string, number> = {}

    const points: ChartPoint[] = sortedDates.map(date => {
      const row: ChartPoint = { date }
      const prices = dateMap.get(date)!
      for (const sym of symbols) {
        const price = prices[sym]
        if (price == null) continue
        if (firstPrices[sym] == null) firstPrices[sym] = price
        const base = firstPrices[sym]
        row[sym] = base > 0 ? +((price - base) / base * 100).toFixed(2) : 0
      }
      return row
    })

    return NextResponse.json({ points, symbols, period })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
