import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const FREE_LIMIT = 5

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getClient()
  if (!sb) return NextResponse.json({ allowed: true, isPro: false, viewCount: 0, limit: FREE_LIMIT })

  const { ticker: rawTicker } = await req.json()
  const ticker = String(rawTicker ?? '').toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Look up user row (includes plan)
  const { data: userRow } = await sb
    .from('users')
    .select('id, plan')
    .eq('email', userEmail)
    .single()

  if (!userRow) return NextResponse.json({ allowed: true, isPro: false, viewCount: 0, limit: FREE_LIMIT })

  const { id: userId, plan } = userRow as { id: string; plan: string | null }

  // BETA: all logged-in users get full access
  if (plan === 'pro' || process.env.NEXT_PUBLIC_BETA_MODE === 'true') {
    return NextResponse.json({ allowed: true, isPro: true, viewCount: 0, limit: FREE_LIMIT })
  }

  const start = monthStart()

  // Check if this ticker was already viewed this month
  const { data: existingThisMonth } = await sb
    .from('stock_views')
    .select('id')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .gte('first_viewed_at', start)
    .maybeSingle()

  if (existingThisMonth) {
    // Already unlocked this month — count how many distinct tickers this month
    const { data: monthRows } = await sb
      .from('stock_views')
      .select('ticker')
      .eq('user_id', userId)
      .gte('first_viewed_at', start)
    const monthCount = new Set(monthRows?.map(r => r.ticker) ?? []).size
    return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
  }

  // Count distinct tickers viewed this month
  const { data: monthRows } = await sb
    .from('stock_views')
    .select('ticker')
    .eq('user_id', userId)
    .gte('first_viewed_at', start)
  const monthCount = new Set(monthRows?.map(r => r.ticker) ?? []).size

  if (monthCount >= FREE_LIMIT) {
    return NextResponse.json({ allowed: false, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
  }

  // Record the new view
  await sb.from('stock_views').insert({ user_id: userId, ticker })

  return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount + 1, limit: FREE_LIMIT })
}
