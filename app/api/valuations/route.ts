import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { FREE_SAVES_PER_MONTH } from '@/lib/constants'

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

    // Fail-closed: if service client unavailable, deny the save
    const sb = getServiceClient()
    if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })

    const { data: userRow } = await sb.from('users').select('id, plan').eq('email', userEmail).single()

    // Fail-closed: missing user row is an error state, not a bypass
    if (!userRow) return NextResponse.json({ error: 'User account not found' }, { status: 403 })

    const isPro = (userRow as { plan?: string }).plan === 'pro'

    if (!isPro) {
      const { count } = await sb
        .from('valuations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', (userRow as { id: string }).id)
      if ((count ?? 0) >= FREE_SAVE_LIMIT) {
        return NextResponse.json({ error: 'Free limit reached', code: 'LIMIT_REACHED', limit: FREE_SAVE_LIMIT }, { status: 402 })
      }
    }

    const body = await req.json()

    // INSERT using service-role client — bypasses RLS correctly since this is
    // a server-side route with a validated session. user_id comes from the
    // server-resolved userRow.id, never from client-supplied body.
    const userId = (userRow as { id: string }).id
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
