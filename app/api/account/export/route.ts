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

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email
  const userId = (session.user as { id?: string }).id ?? ''
  const sb = getClient()

  const [userRes, valuationsRes, stockViewsRes] = await Promise.all([
    sb.from('users').select('email, name, plan, newsletter_opt_in, terms_accepted_at, created_at').eq('email', email).maybeSingle(),
    sb.from('valuations').select('*').eq('user_id', userId),
    sb.from('stock_views').select('ticker, first_viewed_at').eq('user_id', userId),
  ])

  const payload = {
    account: userRes.data,
    valuations: valuationsRes.data ?? [],
    stock_views: stockViewsRes.data ?? [],
    exported_at: new Date().toISOString(),
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="insic-data-export.json"',
    },
  })
}
