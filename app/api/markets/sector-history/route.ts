import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export const revalidate = 3600

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

const RANGE_MAP: Record<string, string> = {
  '5d': '5d', '1mo': '1mo', '6mo': '6mo', 'ytd': 'ytd', '1y': '1y',
}

async function getSectorReturn(symbol: string, range: string): Promise<number | null> {
  try {
    const period2 = new Date().toISOString().slice(0, 10)
    const result = await yf.historical(symbol, { period1: getStartDate(range), period2 })
    if (!result || result.length < 2) return null
    const first = result[0].close
    const last  = result[result.length - 1].close
    if (!first || !last || first === 0) return null
    return ((last - first) / first) * 100
  } catch { return null }
}

function getStartDate(range: string): string {
  const d = new Date()
  if (range === 'ytd') { d.setMonth(0); d.setDate(1) }
  else if (range === '5d')  d.setDate(d.getDate() - 5)
  else if (range === '1mo') d.setMonth(d.getMonth() - 1)
  else if (range === '6mo') d.setMonth(d.getMonth() - 6)
  else if (range === '1y')  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000, 'markets-sector-history')
  if (limited) return limited

  const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? ''
  const range = RANGE_MAP[req.nextUrl.searchParams.get('range') ?? '1mo'] ?? '1mo'
  const symbols = symbolsParam.split(',').filter(Boolean).slice(0, 20)

  if (symbols.length === 0) return NextResponse.json({})

  const results = await Promise.all(symbols.map(s => getSectorReturn(s, range)))
  const out: Record<string, number | null> = {}
  symbols.forEach((s, i) => { out[s] = results[i] })

  return NextResponse.json(out)
}
