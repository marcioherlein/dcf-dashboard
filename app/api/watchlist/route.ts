import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

async function getUserId(email: string): Promise<string | null> {
  const sb = createServiceClient()
  const { data } = await sb.from('users').select('id').eq('email', email).single()
  return data?.id ?? null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json([], { status: 200 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  if (!body.ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('watchlist')
    .upsert(
      {
        user_id: userId,
        ticker: body.ticker.toUpperCase(),
        name: body.name ?? null,
        asset_type: body.asset_type ?? 'stock',
        notes: body.notes ?? null,
        tags: body.tags ?? [],
      },
      { onConflict: 'user_id,ticker' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  if (!body.ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 })

  const sb = createServiceClient()
  const { error } = await sb
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('ticker', body.ticker.toUpperCase())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
