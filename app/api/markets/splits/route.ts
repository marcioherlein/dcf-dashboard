import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export const revalidate = 3600

export interface SplitItem {
  ticker: string
  company: string
  date: string
  numerator: number
  denominator: number
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000, 'splits-calendar')
  if (limited) return limited

  const p    = req.nextUrl.searchParams
  const from = p.get('from') ?? new Date().toISOString().split('T')[0]
  const to   = p.get('to')   ?? new Date(Date.now() + 14 * 864e5).toISOString().split('T')[0]
  const key  = process.env.FMP_API_KEY

  if (!key) return NextResponse.json({ splits: [], missingKey: true })

  try {
    const url = `https://financialmodelingprep.com/stable/splits-calendar?from=${from}&to=${to}&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({ splits: [] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()
    if (!Array.isArray(data)) return NextResponse.json({ splits: [] })

    const splits: SplitItem[] = data
      .filter(d => d.date && d.symbol)
      .map(d => ({
        ticker:      String(d.symbol ?? ''),
        company:     String(d.name ?? d.symbol ?? ''),
        date:        String(d.date ?? '').split('T')[0],
        numerator:   Number(d.numerator   ?? 0),
        denominator: Number(d.denominator ?? 1),
      }))
      .filter(s => s.numerator > 0 && s.denominator > 0)
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ splits, fetchedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ splits: [] })
  }
}
