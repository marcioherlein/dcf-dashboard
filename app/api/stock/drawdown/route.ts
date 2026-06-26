import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export interface DrawdownResult {
  maxDrawdown: number        // worst peak-to-trough as a negative decimal, e.g. -0.65
  drawdownDuration: number   // calendar months from peak to trough
  recoveryTime: number | null // months from trough to new all-time high, null if not recovered
  peakDate: string
  troughDate: string
  recoveryDate: string | null
  dataYears: number          // years of history used
}

// In-memory cache — drawdown is stable, 24h TTL
const _cache = new Map<string, { data: DrawdownResult; ts: number }>()
const TTL = 24 * 60 * 60 * 1000

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round(
    (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  ))
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const cached = _cache.get(ticker)
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    // Fetch 5Y of daily prices
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chart: any = await yf.chart(ticker, {
      period1: fiveYearsAgo,
      interval: '1d',
    }, { validateResult: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes: Array<{ date: Date; close: number | null }> = (chart?.quotes ?? [])
      .filter((q: { close?: number | null }) => q.close != null && isFinite(q.close as number) && (q.close as number) > 0)

    if (quotes.length < 60) {
      return NextResponse.json({ error: 'Insufficient price history' }, { status: 404 })
    }

    // Find max drawdown using O(n) running peak algorithm
    let runningPeak = quotes[0].close!
    let runningPeakDate = quotes[0].date
    let maxDrawdown = 0
    let peakDate = quotes[0].date
    let troughDate = quotes[0].date

    for (const q of quotes) {
      const price = q.close!
      if (price > runningPeak) {
        runningPeak = price
        runningPeakDate = q.date
      }
      const dd = (price - runningPeak) / runningPeak
      if (dd < maxDrawdown) {
        maxDrawdown = dd
        peakDate = runningPeakDate
        troughDate = q.date
      }
    }

    // Find recovery: first date after trough where price exceeds peakPrice at peakDate
    const peakPrice = quotes.find(q => q.date.getTime() === peakDate.getTime())?.close ?? runningPeak
    const afterTrough = quotes.filter(q => q.date > troughDate)
    const recoveryQ = afterTrough.find(q => (q.close ?? 0) >= peakPrice)
    const recoveryDate = recoveryQ?.date ?? null

    const result: DrawdownResult = {
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      drawdownDuration: monthsBetween(peakDate, troughDate),
      recoveryTime: recoveryDate ? monthsBetween(troughDate, recoveryDate) : null,
      peakDate: peakDate.toISOString().split('T')[0],
      troughDate: troughDate.toISOString().split('T')[0],
      recoveryDate: recoveryDate ? recoveryDate.toISOString().split('T')[0] : null,
      dataYears: Math.round(monthsBetween(quotes[0].date, quotes[quotes.length - 1].date) / 12 * 10) / 10,
    }

    _cache.set(ticker, { data: result, ts: Date.now() })
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[drawdown]', err)
    return NextResponse.json({ error: 'Failed to compute drawdown' }, { status: 500 })
  }
}
