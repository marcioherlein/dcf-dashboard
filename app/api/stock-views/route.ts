import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { FREE_STOCK_ANALYSES_PER_MONTH } from '@/lib/constants'
import { getUserEntitlement, currentMonthStart } from '@/lib/entitlements'

const FREE_LIMIT = FREE_STOCK_ANALYSES_PER_MONTH

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
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

  if (!userEmail) {
    return NextResponse.json({ allowed: false, code: 'UNAUTHORIZED', viewCount: 0, limit: FREE_LIMIT }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const ticker = normalizeTicker(body?.ticker)
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // ── Authoritative entitlement check via lib/entitlements.ts ──────────────
  const entitlement = await getUserEntitlement(userEmail)

  if (!entitlement.ok) {
    // System/config error — FAIL OPEN for authenticated users.
    // Do NOT show upgrade wall for backend errors — that would punish Pro users.
    console.error('[stock-views] entitlement check failed:', entitlement.code, 'for', userEmail)
    return NextResponse.json({
      allowed: true,
      code: entitlement.code,           // SESSION_EXPIRED | USER_NOT_FOUND | DB_UNAVAILABLE | ENTITLEMENT_CHECK_FAILED
      isPro: false,
      viewCount: 0,
      limit: FREE_LIMIT,
      systemError: true,                 // client can detect this and skip showing upgrade wall
    })
  }

  const { userId, plan } = entitlement

  // Pro users: always allowed, no counting needed
  if (plan === 'pro') {
    return NextResponse.json({ allowed: true, isPro: true, viewCount: 0, limit: FREE_LIMIT })
  }

  // ── Free user: count this month's views ───────────────────────────────────
  const sb = getClient()
  if (!sb) {
    // DB unavailable — fail open, return system error code
    return NextResponse.json({
      allowed: true,
      code: 'DB_UNAVAILABLE',
      isPro: false,
      viewCount: 0,
      limit: FREE_LIMIT,
      systemError: true,
    })
  }

  const start = currentMonthStart()  // UTC-consistent month boundary

  // Attempt atomic insert — ON CONFLICT (user_id, ticker, month_start) DO NOTHING
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

  if (!insertError) {
    // New ticker inserted successfully
    if (monthCount > FREE_LIMIT) {
      // Rolled over limit — delete the just-inserted row
      await sb.from('stock_views').delete()
        .eq('user_id', userId).eq('ticker', ticker).eq('month_start', start)
      return NextResponse.json({
        allowed: false,
        code: 'VIEW_LIMIT_REACHED',
        isPro: false,
        viewCount: FREE_LIMIT,
        limit: FREE_LIMIT,
      })
    }
    return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
  }

  // Insert conflict — check if ticker was already viewed this month (revisit is always allowed)
  const { data: existingRow } = await sb
    .from('stock_views')
    .select('id')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .gte('first_viewed_at', start)
    .maybeSingle()

  if (existingRow) {
    return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
  }

  // Limit reached (no existing row for this ticker, no insert succeeded)
  if (monthCount >= FREE_LIMIT) {
    return NextResponse.json({
      allowed: false,
      code: 'VIEW_LIMIT_REACHED',
      isPro: false,
      viewCount: monthCount,
      limit: FREE_LIMIT,
    })
  }

  // Fallback: allow (unexpected state — err on the side of access)
  return NextResponse.json({ allowed: true, isPro: false, viewCount: monthCount, limit: FREE_LIMIT })
}
