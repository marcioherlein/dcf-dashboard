import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export const revalidate = 3600  // 1 hour

export type EconomicEvent = {
  date: string       // ISO date string
  time: string       // e.g. "8:30 AM ET"
  event: string      // e.g. "CPI YoY"
  country: string
  impact: 'High' | 'Medium' | 'Low'
  previous: string | null
  estimate: string | null
  actual: string | null
}

// FMP economic calendar
async function fetchFMPCalendar(from: string, to: string): Promise<EconomicEvent[]> {
  const key = process.env.FMP_API_KEY
  if (!key) return []
  try {
    const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()
    if (!Array.isArray(data)) return []

    return data
      .filter(e => e.country === 'US' && e.impact !== 'Low')
      .map(e => ({
        date: e.date?.split(' ')[0] ?? e.date,
        time: e.date?.split(' ')[1] ? formatTime(e.date.split(' ')[1]) : '',
        event: e.event ?? '',
        country: e.country ?? 'US',
        impact: (e.impact === 'High' ? 'High' : e.impact === 'Medium' ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
        previous: e.previous != null ? String(e.previous) : null,
        estimate: e.estimate != null ? String(e.estimate) : null,
        actual: e.actual != null ? String(e.actual) : null,
      }))
      .filter(e => e.event)
  } catch {
    return []
  }
}

function formatTime(t: string): string {
  // FMP returns time like "12:30:00" in UTC — convert to ET (UTC-4 during DST)
  try {
    const [h, m] = t.split(':').map(Number)
    const etH = ((h - 4 + 24) % 24)
    const suffix = etH >= 12 ? 'PM' : 'AM'
    const h12 = etH % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${suffix} ET`
  } catch {
    return t
  }
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000, 'economic-calendar')
  if (limited) return limited

  const p   = req.nextUrl.searchParams
  const now = new Date()
  const from = p.get('from') ?? now.toISOString().split('T')[0]
  const to   = p.get('to')   ?? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const events = await fetchFMPCalendar(from, to)
  return NextResponse.json({ events, fetchedAt: now.toISOString() }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  })
}
