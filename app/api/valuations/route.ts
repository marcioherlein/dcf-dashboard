import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveValuation, getValuations } from '@/lib/data/supabaseClient'
import { createClient } from '@supabase/supabase-js'

const FREE_SAVE_LIMIT = 3

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json([], { status: 400 })
  try {
    const data = await getValuations(ticker)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email ?? null

    // Check Pro plan and save limit for logged-in users
    if (userEmail) {
      const sb = getServiceClient()
      if (sb) {
        const { data: userRow } = await sb.from('users').select('id, plan').eq('email', userEmail).single()
        const isPro = (userRow as { plan?: string } | null)?.plan === 'pro'
        if (!isPro && userRow) {
          const { count } = await sb
            .from('valuations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', (userRow as { id: string }).id)
          if ((count ?? 0) >= FREE_SAVE_LIMIT) {
            return NextResponse.json({ error: 'Free limit reached', code: 'LIMIT_REACHED', limit: FREE_SAVE_LIMIT }, { status: 402 })
          }
        }
      }
    }

    const body = await req.json()
    const saved = await saveValuation(body, userEmail)
    return NextResponse.json(saved, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
