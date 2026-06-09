import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email
  const sb = getClient()

  // Delete user content in dependency order, then the user row itself.
  // Supabase cascades may handle some of this, but explicit deletion is safer.
  await sb.from('valuations').delete().eq('user_id', (session.user as { id?: string }).id ?? '')
  await sb.from('stock_views').delete().eq('user_id', (session.user as { id?: string }).id ?? '')
  await sb.from('etf_watchlist').delete().eq('user_id', (session.user as { id?: string }).id ?? '')
  await sb.from('promo_redemptions').delete().eq('user_id', (session.user as { id?: string }).id ?? '')
  await sb.from('users').delete().eq('email', email)

  return NextResponse.json({ ok: true })
}
