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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscriptionId } = await req.json().catch(() => ({})) as { subscriptionId?: string }
  if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 })

  const sb = getClient()

  const { error } = await sb
    .from('users')
    .update({ plan: 'pro', paypal_subscription_id: subscriptionId })
    .eq('email', userEmail)

  if (error) {
    console.error('[paypal/activate] update error:', error.message)
    return NextResponse.json({ error: 'Failed to activate' }, { status: 500 })
  }

  console.log('[paypal/activate] Pro activated for', userEmail, 'sub', subscriptionId)
  return NextResponse.json({ ok: true })
}
