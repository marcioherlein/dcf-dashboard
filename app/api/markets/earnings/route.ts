import { NextResponse } from 'next/server'
import { rateLimit as _rateLimit } from '@/lib/rateLimit'

export const revalidate = 3600

export type EarningsItem = {
  ticker: string
  company: string
  date: string          // ISO date string YYYY-MM-DD
  epsEstimate: number | null
  revenueEstimate: number | null
  timeOfDay: 'BMO' | 'AMC' | 'TAS' | null  // Before Market Open, After Market Close, Time As Specified
}

// Major S&P 500 companies to check — broad sector coverage
const MAJOR_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'JPM', 'V',
  'XOM', 'UNH', 'AVGO', 'WMT', 'TSLA', 'JNJ', 'MA', 'PG', 'HD', 'ORCL',
  'MRK', 'COST', 'ABBV', 'BAC', 'KO', 'CVX', 'PEP', 'NFLX', 'AMD', 'CSCO',
  'ADBE', 'TMO', 'QCOM', 'TXN', 'ACN', 'DHR', 'UNP', 'NEE', 'IBM', 'GS',
]

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export async function GET() {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

  try {
    const results = await Promise.allSettled(
      MAJOR_TICKERS.map(ticker =>
        yf.quoteSummary(ticker, { modules: ['calendarEvents', 'price'] }).catch(() => null)
      )
    )

    const items: EarningsItem[] = []

    results.forEach((r, i) => {
      if (r.status !== 'fulfilled' || !r.value) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = r.value
      const cal = data.calendarEvents?.earnings
      const priceData = data.price

      const earningsDate = cal?.earningsDate?.[0]
      if (!earningsDate) return

      const d = new Date(earningsDate)
      if (isNaN(d.getTime()) || d < now || d > windowEnd) return

      items.push({
        ticker: MAJOR_TICKERS[i],
        company: priceData?.longName ?? priceData?.shortName ?? MAJOR_TICKERS[i],
        date: d.toISOString().split('T')[0],
        epsEstimate: cal.earningsAverage ?? null,
        revenueEstimate: null,
        timeOfDay: null,
      })
    })

    // Sort by date ascending
    items.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ items, fetchedAt: now.toISOString() })
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [] }, { status: 500 })
  }
}
