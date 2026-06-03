import { NextRequest, NextResponse } from 'next/server'
import { searchETF } from '@/lib/data/yahooClient'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])
  try {
    const results = await searchETF(q)
    return NextResponse.json(results)
  } catch (err) {
    console.error('ETF search error:', err)
    return NextResponse.json({ error: 'Search unavailable' }, { status: 500 })
  }
}
