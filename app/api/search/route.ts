import { NextRequest, NextResponse } from 'next/server'
import { searchTicker } from '@/lib/data/yahooClient'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 10, 60000, 'search')
  if (limited) return limited

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])
  try {
    const results = await searchTicker(q)
    return NextResponse.json(results)
  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json([], { status: 500 })
  }
}
