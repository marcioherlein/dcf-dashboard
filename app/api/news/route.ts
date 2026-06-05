import { NextRequest, NextResponse } from 'next/server'
import { getNews } from '@/lib/data/yahooClient'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 5, 60000, 'news')
  if (limited) return limited

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json([], { status: 400 })
  try {
    const news = await getNews(ticker)
    return NextResponse.json(news)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
