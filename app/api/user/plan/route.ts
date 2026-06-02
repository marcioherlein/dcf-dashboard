import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getClient()
  if (!sb) return NextResponse.json({ plan: 'free', stockViewCount: 0 })

  const { data: userRow } = await sb
    .from('users')
    .select('id, plan')
    .eq('email', userEmail)
    .single()

  if (!userRow) return NextResponse.json({ plan: 'free', stockViewCount: 0 })

  const { id: userId, plan } = userRow as { id: string; plan: string | null }

  const { count } = await sb
    .from('stock_views')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  return NextResponse.json({ plan: plan ?? 'free', stockViewCount: count ?? 0 })
}
