import { NextRequest, NextResponse } from 'next/server'
import { getInstrumentMeta } from '@/lib/markets/instrumentMeta'

export const revalidate = 60

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export interface InstrumentDetail {
  symbol: string
  name: string
  type: string
  assetClass: string
  description: string
  region?: string
  category?: string
  relatedSymbols?: string[]
  expenseRatio?: number | null
  // Live quote
  price: number | null
  change: number | null
  changePct: number | null
  currency: string
  exchange?: string
  // Key stats
  previousClose: number | null
  open: number | null
  dayLow: number | null
  dayHigh: number | null
  fiftyTwoWeekLow: number | null
  fiftyTwoWeekHigh: number | null
  volume: number | null
  avgVolume: number | null
  marketCap: number | null
  updatedAt: string
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote: any = await yf.quote(symbol)
    const meta = getInstrumentMeta(symbol)

    const detail: InstrumentDetail = {
      symbol,
      name: (quote?.longName ?? quote?.shortName ?? meta.assetClass) as string,
      type: meta.type,
      assetClass: meta.assetClass,
      description: meta.description,
      region: meta.region,
      category: meta.category,
      relatedSymbols: meta.relatedSymbols,
      expenseRatio: (meta.expenseRatio ?? quote?.annualReportExpenseRatio ?? null) as number | null,
      // Live quote
      price: (quote?.regularMarketPrice ?? null) as number | null,
      change: (quote?.regularMarketChange ?? null) as number | null,
      changePct: (quote?.regularMarketChangePercent ?? null) as number | null,
      currency: (quote?.currency ?? 'USD') as string,
      exchange: (quote?.fullExchangeName ?? quote?.exchange ?? undefined) as string | undefined,
      // Key stats
      previousClose: (quote?.regularMarketPreviousClose ?? null) as number | null,
      open: (quote?.regularMarketOpen ?? null) as number | null,
      dayLow: (quote?.regularMarketDayLow ?? null) as number | null,
      dayHigh: (quote?.regularMarketDayHigh ?? null) as number | null,
      fiftyTwoWeekLow: (quote?.fiftyTwoWeekLow ?? null) as number | null,
      fiftyTwoWeekHigh: (quote?.fiftyTwoWeekHigh ?? null) as number | null,
      volume: (quote?.regularMarketVolume ?? null) as number | null,
      avgVolume: (quote?.averageDailyVolume3Month ?? quote?.averageDailyVolume10Day ?? null) as number | null,
      marketCap: (quote?.marketCap ?? null) as number | null,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(detail)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
