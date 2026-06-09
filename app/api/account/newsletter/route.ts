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

  const sb = getClient()
  const { data } = await sb
    .from('users')
    .select('newsletter_opt_in')
    .eq('email', session.user.email)
    .maybeSingle()

  return NextResponse.json({ newsletter_opt_in: data?.newsletter_opt_in ?? false })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { newsletter_opt_in } = await req.json() as { newsletter_opt_in: boolean }
  if (typeof newsletter_opt_in !== 'boolean') {
    return NextResponse.json({ error: 'newsletter_opt_in must be boolean' }, { status: 400 })
  }

  const sb = getClient()
  const { error } = await sb
    .from('users')
    .update({ newsletter_opt_in })
    .eq('email', session.user.email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, newsletter_opt_in })
}
