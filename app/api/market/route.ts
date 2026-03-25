import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export const revalidate = 300 // cache 5 minutes

const INSTRUMENTS = [
  { ticker: '^GSPC',   label: 'S&P 500' },
  { ticker: '^NDX',    label: 'Nasdaq 100' },
  { ticker: '^DJI',    label: 'Dow Jones' },
  { ticker: '^TNX',    label: '10Y Treasury' },
  { ticker: 'CL=F',   label: 'Oil WTI' },
  { ticker: 'BZ=F',   label: 'Oil Brent' },
  { ticker: 'GC=F',   label: 'Gold' },
  { ticker: 'BTC-USD', label: 'Bitcoin' },
  { ticker: 'ETH-USD', label: 'Ethereum' },
  { ticker: 'EURUSD=X', label: 'EUR/USD' },
]

const HOT_POOL = [
  'NVDA', 'TSLA', 'META', 'AMD', 'NFLX', 'PLTR',
  'SMCI', 'COIN', 'SHOP', 'ARM', 'RDDT', 'CRWD', 'MELI', 'UBER',
]

export async function GET() {
  try {
    const period2 = new Date().toISOString().split('T')[0]
    const d1 = new Date(); d1.setMonth(d1.getMonth() - 1)
    const period1 = d1.toISOString().split('T')[0]

    // All fetches in parallel: instrument quotes + sparklines + hot pool
    const [quoteRes, histRes, hotRes] = await Promise.all([
      Promise.allSettled(INSTRUMENTS.map((i) => yf.quote(i.ticker))),
      Promise.allSettled(
        INSTRUMENTS.map((i) =>
          yf.historical(i.ticker, { period1, period2, interval: '1d' }).catch(() => [])
        )
      ),
      Promise.allSettled(HOT_POOL.map((t) => yf.quote(t))),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = INSTRUMENTS.map((inst, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = quoteRes[i].status === 'fulfilled' ? (quoteRes[i] as PromiseFulfilledResult<any>).value : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hist = histRes[i].status === 'fulfilled' ? (histRes[i] as PromiseFulfilledResult<any[]>).value : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sparkline: number[] = (hist ?? []).map((r: any) => r.close ?? r.adjClose).filter((v: unknown) => typeof v === 'number')
      return {
        ticker: inst.ticker,
        label: inst.label,
        price: (q?.regularMarketPrice ?? 0) as number,
        change: (q?.regularMarketChange ?? 0) as number,
        changePct: (q?.regularMarketChangePercent ?? 0) as number,
        sparkline,
      }
    })

    const hotStocks = hotRes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .flatMap((r, i) => {
        if (r.status !== 'fulfilled') return []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = (r as PromiseFulfilledResult<any>).value
        if (!q?.regularMarketPrice) return []
        return [{
          ticker: HOT_POOL[i],
          name: (q.shortName ?? q.longName ?? HOT_POOL[i]) as string,
          price: q.regularMarketPrice as number,
          changePct: (q.regularMarketChangePercent ?? 0) as number,
        }]
      })
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 3)

    return NextResponse.json({ items, hotStocks })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
