import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json([], { status: 401 })

  const client = getClient()
  if (!client) return NextResponse.json([])

  try {
    const { data, error } = await client
      .from('etf_watchlist')
      .select('*')
      .eq('user_id', userEmail)
      .order('added_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = getClient()
  if (!client) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  try {
    const body = await req.json()
    const { ticker, name, value_score, expense_ratio, yield: yieldVal, pe_ratio, pb_ratio, total_assets } = body

    if (typeof ticker !== 'string' || ticker.length === 0 || ticker.length > 10) {
      return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
    }

    const { data, error } = await client
      .from('etf_watchlist')
      .upsert(
        {
          user_id: userEmail,
          ticker: String(ticker).toUpperCase(),
          name: name ?? null,
          value_score: value_score ?? null,
          expense_ratio: expense_ratio ?? null,
          yield: yieldVal ?? null,
          pe_ratio: pe_ratio ?? null,
          pb_ratio: pb_ratio ?? null,
          total_assets: total_assets ?? null,
        },
        { onConflict: 'user_id,ticker' },
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const client = getClient()
  if (!client) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  try {
    const { error } = await client
      .from('etf_watchlist')
      .delete()
      .eq('user_id', userEmail)
      .eq('ticker', ticker)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
