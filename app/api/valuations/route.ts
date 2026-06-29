import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { FREE_SAVES_PER_MONTH } from '@/lib/constants'
import { currentMonthStart } from '@/lib/entitlements'

const FREE_SAVE_LIMIT = FREE_SAVES_PER_MONTH

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json([], { status: 401 })

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json([], { status: 400 })

  try {
    const sb = getServiceClient()
    if (!sb) return NextResponse.json([])

    const { data: userRow } = await sb.from('users').select('id').eq('email', userEmail).single()
    if (!userRow) return NextResponse.json([])

    const { data, error } = await sb
      .from('valuations')
      .select('*')
      .eq('ticker', ticker)
      .eq('user_id', (userRow as { id: string }).id)
      .order('saved_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: String(error) }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email ?? null
    if (!userEmail) return NextResponse.json({ error: 'Login required to save valuations' }, { status: 401 })

    const sb = getServiceClient()
    if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })

    const { data: userRow } = await sb.from('users').select('id, plan').eq('email', userEmail).single()
    if (!userRow) return NextResponse.json({ error: 'User account not found' }, { status: 403 })

    const isPro = (userRow as { plan?: string }).plan === 'pro'
    const userId = (userRow as { id: string }).id
    const body = await req.json()
    const ticker = (body?.ticker as string | undefined)?.toUpperCase()

    if (!isPro) {
      const monthStart = currentMonthStart()

      // Rule 1: The ticker must have been viewed this month.
      // If they haven't viewed it, they haven't unlocked it — can't save it.
      if (ticker) {
        const { data: viewRow } = await sb
          .from('stock_views')
          .select('id')
          .eq('user_id', userId)
          .eq('ticker', ticker)
          .gte('first_viewed_at', monthStart)
          .maybeSingle()

        if (!viewRow) {
          return NextResponse.json({
            error: 'You need to view this stock first before saving it.',
            code: 'NOT_VIEWED_THIS_MONTH',
          }, { status: 402 })
        }
      }

      // Rule 2: Monthly save count cannot exceed the view limit.
      // Saves are capped to the same 5-per-month as views — if you've used
      // your 5 views, you can't save a 6th stock either.
      const { data: savedThisMonth } = await sb
        .from('valuations')
        .select('ticker')
        .eq('user_id', userId)
        .gte('saved_at', monthStart)

      // Count distinct tickers saved this month
      const savedTickers = new Set((savedThisMonth ?? []).map((r: { ticker: string }) => r.ticker))

      // Allow re-saving the same ticker (updating an existing save)
      if (ticker && !savedTickers.has(ticker) && savedTickers.size >= FREE_SAVE_LIMIT) {
        return NextResponse.json({
          error: 'Monthly save limit reached. Upgrade to Pro for unlimited saves.',
          code: 'LIMIT_REACHED',
          limit: FREE_SAVE_LIMIT,
        }, { status: 402 })
      }
    }

    const { data: saved, error: insertError } = await sb
      .from('valuations')
      .insert([{ ...body, user_id: userId, saved_at: new Date().toISOString() }])
      .select()
      .single()

    if (insertError) throw insertError
    return NextResponse.json(saved, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
