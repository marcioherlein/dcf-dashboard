import { NextRequest, NextResponse } from 'next/server'
import { getNews } from '@/lib/data/yahooClient'

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json([], { status: 400 })
  try {
    const news = await getNews(ticker)
    return NextResponse.json(news)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
