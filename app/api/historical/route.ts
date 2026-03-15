import { NextRequest, NextResponse } from 'next/server'
import { getHistorical } from '@/lib/data/yahooClient'

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  const period = (req.nextUrl.searchParams.get('period') ?? '1y') as '1mo' | '3mo' | '1y' | '5y'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  try {
    const data = await getHistorical(ticker, period)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
