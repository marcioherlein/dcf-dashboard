import { NextRequest, NextResponse } from 'next/server'
import { getFinancials } from '@/lib/data/yahooClient'

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json([], { status: 400 })
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await getFinancials(ticker) as any
    const transactions = data.insiderTransactions?.transactions ?? []
    return NextResponse.json(transactions.slice(0, 15))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
