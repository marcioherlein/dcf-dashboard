import { NextRequest, NextResponse } from 'next/server'
import { getHistorical } from '@/lib/data/yahooClient'

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  const period = (req.nextUrl.searchParams.get('period') ?? '1y') as '1mo' | '3mo' | '1y' | '5y'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  try {
    const data = await getHistorical(ticker, period)
    // Return full OHLCV so the chart can compute technical indicators client-side
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json(data.map((p: any) => ({
      date: p.date,
      open: p.open ?? p.close,
      high: p.high ?? p.close,
      low: p.low ?? p.close,
      close: p.close ?? p.adjClose ?? 0,
      volume: p.volume ?? 0,
    })))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
