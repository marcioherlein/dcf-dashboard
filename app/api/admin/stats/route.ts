import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'marcioherlein@gmail.com')
  .split(',').map(e => e.trim())

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = getClient()
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  const start = monthStart()

  const [
    { count: totalUsers },
    { count: proUsers },
    { data: monthViews },
  ] = await Promise.all([
    sb.from('users').select('id', { count: 'exact', head: true }),
    sb.from('users').select('id', { count: 'exact', head: true }).eq('plan', 'pro'),
    sb.from('stock_views').select('user_id, ticker').gte('first_viewed_at', start),
  ])

  // MAU = distinct users who viewed any stock this month
  const mauSet = new Set((monthViews ?? []).map(r => r.user_id))

  // Top tickers = most-viewed tickers all time
  const { data: allViews } = await sb.from('stock_views').select('ticker')
  const tickerCounts = new Map<string, number>()
  for (const row of allViews ?? []) {
    tickerCounts.set(row.ticker, (tickerCounts.get(row.ticker) ?? 0) + 1)
  }
  const topTickers = Array.from(tickerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ticker, views]) => ({ ticker, views }))

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    proUsers: proUsers ?? 0,
    mau: mauSet.size,
    topTickers,
  })
}
