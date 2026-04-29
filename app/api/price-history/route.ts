import { NextRequest, NextResponse } from 'next/server'

const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// Returns normalized price series for the stock AND SPY, both rebased to 100
// at the start of the selected period, so they're directly comparable.
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const range = req.nextUrl.searchParams.get('range') ?? '1Y' // YTD|1Y|3Y|5Y|10Y|MAX

  const now = new Date()
  function periodStart(r: string): Date {
    const d = new Date(now)
    switch (r) {
      case 'YTD': return new Date(d.getFullYear(), 0, 1)
      case '1Y':  d.setFullYear(d.getFullYear() - 1); return d
      case '3Y':  d.setFullYear(d.getFullYear() - 3); return d
      case '5Y':  d.setFullYear(d.getFullYear() - 5); return d
      case '10Y': d.setFullYear(d.getFullYear() - 10); return d
      case 'MAX': d.setFullYear(d.getFullYear() - 20); return d
      default:    d.setFullYear(d.getFullYear() - 1); return d
    }
  }

  const period1 = periodStart(range).toISOString().split('T')[0]
  const period2 = now.toISOString().split('T')[0]
  // Weekly for longer ranges to keep payload small; daily for ≤1Y
  const interval = (range === 'YTD' || range === '1Y') ? '1d' : '1wk'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function normalize(rows: any[]): { date: string; value: number }[] {
    const valid = rows.filter((r: any) => r.close > 0)
    if (valid.length === 0) return []
    const base = valid[0].close as number
    return valid.map((r: any) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      value: Math.round((r.close / base) * 10000) / 100, // rebased to 100
    }))
  }

  try {
    const [stockHistory, spyHistory] = await Promise.all([
      yf.historical(ticker, { period1, period2, interval }),
      yf.historical('SPY',   { period1, period2, interval }),
    ])

    return NextResponse.json({
      ticker,
      range,
      stock: normalize(stockHistory),
      spy:   normalize(spyHistory),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
