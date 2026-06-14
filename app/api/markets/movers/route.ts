import { NextResponse } from 'next/server'
import { rateLimit as _rateLimit } from '@/lib/rateLimit'

export const revalidate = 120

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

const UNIVERSE = [
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'PLTR',
  'MELI', 'COST', 'LLY', 'JPM', 'BAC', 'V', 'NFLX', 'CRM', 'AVGO',
  'ASML', 'ORCL', 'ADBE', 'QCOM', 'MU', 'TSM', 'PYPL', 'INTC',
]

export type Mover = {
  symbol: string
  name: string
  price: number
  changePct: number
  change: number
  volume?: number
  avgVolume?: number
  volumeRatio?: number
}

export type MoversData = {
  gainers: Mover[]
  losers: Mover[]
  unusual: Mover[]
  fetchedAt: number
}

export async function GET() {
  try {
    const results = await Promise.all(
      UNIVERSE.map(symbol =>
        yf.quote(symbol, {
          fields: ['regularMarketPrice', 'regularMarketChangePercent', 'regularMarketChange',
                   'regularMarketVolume', 'averageDailyVolume3Month', 'shortName', 'symbol'],
        }).catch(() => null)
      )
    )

    const movers: Mover[] = results
      .filter(Boolean)
      .map(q => {
        const vol    = (q!.regularMarketVolume ?? 0) as number
        const avgVol = (q!.averageDailyVolume3Month ?? 0) as number
        return {
          symbol: q!.symbol as string,
          name: (q!.shortName ?? q!.symbol) as string,
          price: (q!.regularMarketPrice ?? 0) as number,
          changePct: (q!.regularMarketChangePercent ?? 0) as number,
          change: (q!.regularMarketChange ?? 0) as number,
          volume: vol,
          avgVolume: avgVol,
          volumeRatio: avgVol > 0 ? vol / avgVol : undefined,
        }
      })
      .filter(m => m.price > 0)

    const sorted = [...movers].sort((a, b) => b.changePct - a.changePct)

    return NextResponse.json({
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
      unusual: [...movers]
        .filter(m => m.volumeRatio != null && m.volumeRatio > 1.5)
        .sort((a, b) => (b.volumeRatio ?? 0) - (a.volumeRatio ?? 0))
        .slice(0, 5),
      fetchedAt: Date.now(),
    } satisfies MoversData)
  } catch {
    return NextResponse.json(
      { gainers: [], losers: [], unusual: [], fetchedAt: Date.now() } satisfies MoversData,
      { status: 500 }
    )
  }
}
