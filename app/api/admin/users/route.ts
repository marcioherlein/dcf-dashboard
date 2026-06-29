import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marcioherlein@gmail.com')
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

  const [{ data: users }, { data: viewRows }] = await Promise.all([
    sb.from('users').select('id, email, name, plan, last_seen, created_at').order('last_seen', { ascending: false }),
    sb.from('stock_views').select('user_id, ticker').gte('first_viewed_at', monthStart()),
  ])

  // Count distinct tickers per user this month
  const viewsByUser = new Map<string, Set<string>>()
  for (const row of viewRows ?? []) {
    if (!viewsByUser.has(row.user_id)) viewsByUser.set(row.user_id, new Set())
    viewsByUser.get(row.user_id)!.add(row.ticker)
  }

  const result = (users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    plan: (u.plan === 'pro' ? 'pro' : 'free') as 'free' | 'pro',
    last_seen: u.last_seen ?? null,
    created_at: u.created_at ?? null,
    views_this_month: viewsByUser.get(u.id)?.size ?? 0,
  }))

  return NextResponse.json(result)
}
