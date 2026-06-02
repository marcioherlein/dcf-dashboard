import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const FREE_LIMIT = 3

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
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

  if (plan === 'pro') {
    return NextResponse.json({ allowed: true, isPro: true, viewCount: 0, limit: FREE_LIMIT })
  }

  // Check if this ticker was already viewed by this user
  const { data: existing } = await sb
    .from('stock_views')
    .select('id')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .maybeSingle()

  if (existing) {
    // Already unlocked — count how many they have
    const { count } = await sb
      .from('stock_views')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    return NextResponse.json({ allowed: true, isPro: false, viewCount: count ?? FREE_LIMIT, limit: FREE_LIMIT })
  }

  // Count unique tickers viewed so far
  const { count: currentCount } = await sb
    .from('stock_views')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const total = currentCount ?? 0

  if (total >= FREE_LIMIT) {
    return NextResponse.json({ allowed: false, isPro: false, viewCount: total, limit: FREE_LIMIT })
  }

  // Record the new view
  await sb.from('stock_views').insert({ user_id: userId, ticker })

  return NextResponse.json({ allowed: true, isPro: false, viewCount: total + 1, limit: FREE_LIMIT })
}
