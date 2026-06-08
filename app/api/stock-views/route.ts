import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const FREE_LIMIT = 3

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

// Validate ticker: uppercase alphanumeric + common punctuation, 1-10 chars
function normalizeTicker(raw: unknown): string | null {
  const t = String(raw ?? '').trim().toUpperCase()
  if (!t || !/^[A-Z0-9.\-]{1,10}$/.test(t)) return null
  return t
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fail-closed: if Supabase is unavailable, deny access
  const sb = getClient()
  if (!sb) return NextResponse.json({ allowed: false, isPro: false, viewCount: 0, limit: FREE_LIMIT }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const ticker = normalizeTicker(body?.ticker)
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Look up user row (includes plan)
  const { data: userRow } = await sb
    .from('users')
    .select('id, plan')
    .eq('email', userEmail)
    .single()

  // Fail-closed: missing user row → deny (user in inconsistent state)
  if (!userRow) return NextResponse.json({ allowed: false, isPro: false, viewCount: 0, limit: FREE_LIMIT }, { status: 403 })

  const { id: userId, plan } = userRow as { id: string; plan: string | null }

  // Pro users always allowed (BETA_MODE removed — was a security risk)
  if (plan === 'pro') {
    return NextResponse.json({ allowed: true, isPro: true, viewCount: 0, limit: FREE_LIMIT })
  }

  const start = monthStart()

  // Attempt atomic insert with unique constraint (user_id, ticker, month_start)
  // ON CONFLICT DO NOTHING prevents race conditions — if the row exists, nothing is inserted
  const { error: insertError } = await sb
    .from('stock_views')
    .insert({ user_id: userId, ticker, month_start: start })

  // Count distinct tickers viewed this month (after the attempted insert)
  const { data: monthRows } = await sb
    .from('stock_views')
    .select('ticker')
    .eq('user_id', userId)
    .gte('first_viewed_at', start)
  const monthCount = new Set(monthRows?.map((r: { ticker: string }) => r.ticker) ?? []).size

  // If insert succeeded (no conflict), this is a new ticker — check against limit
  if (!insertError) {
    // Insert succeeded = new ticker. If count now exceeds limit, this was the +1 that pushed over.
    // We allow it if monthCount <= FREE_LIMIT (insert already happened)
    if (monthCount > FREE_LIMIT) {
      // Delete the row we just inserted — the limit was already reached
      await sb.from('stock_views').delete()
        .eq('user_id', userId).eq('ticker', ticker).eq('month_start', start)
      return NextResponse.json({ allowed: false, isPro: false, viewCount: FREE_LIMIT, limit: FREE_LIMIT })
    }
    return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
  }

  // Insert conflict = ticker already viewed this month OR limit exceeded (no insert occurred)
  // Re-check: does this ticker already exist for this month?
  const { data: existingRow } = await sb
    .from('stock_views')
    .select('id')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .gte('first_viewed_at', start)
    .maybeSingle()

  if (existingRow) {
    // Already viewed — allow re-viewing (doesn't count against limit)
    return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
  }

  // No existing row but insert failed = duplicate key race or limit was hit
  if (monthCount >= FREE_LIMIT) {
    return NextResponse.json({ allowed: false, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
  }

  // Fallback: allow (shouldn't reach here in normal operation)
  return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
}
