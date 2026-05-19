import { NextRequest, NextResponse } from 'next/server'
import { getHistorical } from '@/lib/data/yahooClient'
import type { HistoricalPeriod } from '@/lib/data/yahooClient'

export const revalidate = 300

const PERIOD_MAP: Record<string, HistoricalPeriod> = {
  '5D':  '5d',
  '1M':  '1mo',
  '3M':  '3mo',
  '6M':  '6mo',
  'YTD': 'ytd',
  '1Y':  '1y',
  '3Y':  '3y',
  '5Y':  '5y',
}

export interface HistoryPoint {
  date: string
  close: number
  volume?: number
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const periodParam = (req.nextUrl.searchParams.get('period') ?? '1Y').toUpperCase()

  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  const yahooPeriod: HistoricalPeriod = PERIOD_MAP[periodParam] ?? '1y'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await getHistorical(symbol, yahooPeriod)

    const points: HistoryPoint[] = raw
      .filter(r => r.close != null && isFinite(r.close))
      .map(r => ({
        date: r.date instanceof Date
          ? r.date.toISOString().split('T')[0]
          : String(r.date).split('T')[0],
        close: r.adjClose ?? r.close,
        volume: r.volume ?? undefined,
      }))

    return NextResponse.json({ symbol, period: periodParam, points })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
