import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export const revalidate = 3600

export interface IpoItem {
  ticker: string
  company: string
  date: string
  exchange: string
  priceRange: string | null
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000, 'ipo-calendar')
  if (limited) return limited

  const p    = req.nextUrl.searchParams
  const from = p.get('from') ?? new Date().toISOString().split('T')[0]
  const to   = p.get('to')   ?? new Date(Date.now() + 14 * 864e5).toISOString().split('T')[0]
  const key  = process.env.FMP_API_KEY

  if (!key) return NextResponse.json({ ipos: [] })

  try {
    const url = `https://financialmodelingprep.com/api/v3/ipo_calendar?from=${from}&to=${to}&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({ ipos: [] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()
    if (!Array.isArray(data)) return NextResponse.json({ ipos: [] })

    const ipos: IpoItem[] = data
      .filter(d => d.date)
      .map(d => {
        const low  = d.priceRangeLow  != null ? `$${Number(d.priceRangeLow).toFixed(2)}`  : null
        const high = d.priceRangeHigh != null ? `$${Number(d.priceRangeHigh).toFixed(2)}` : null
        const priceRange = low && high ? `${low} – ${high}` : (low ?? high ?? null)

        return {
          ticker:     String(d.symbol     ?? ''),
          company:    String(d.company    ?? ''),
          date:       String(d.date       ?? '').split(' ')[0],
          exchange:   String(d.exchange   ?? ''),
          priceRange,
        }
      })
      .filter(i => i.company)
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ ipos, fetchedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ipos: [] })
  }
}
