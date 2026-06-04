import { NextResponse } from 'next/server'
import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST() {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY! })

  const sb = getClient()
  const { data: userRow } = await sb
    .from('users')
    .select('lemonsqueezy_subscription_id')
    .eq('email', userEmail)
    .single()

  // If no subscription, send them to the store to subscribe
  if (!userRow?.lemonsqueezy_subscription_id) {
    return NextResponse.json({ url: `https://app.lemonsqueezy.com/my-orders` })
  }

  // LS customer portal: pre-signed URL via API
  const res = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${userRow.lemonsqueezy_subscription_id}`,
    { headers: { Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`, Accept: 'application/vnd.api+json' } },
  )
  const json = await res.json()
  const portalUrl: string | undefined = json?.data?.attributes?.urls?.customer_portal

  return NextResponse.json({ url: portalUrl ?? 'https://app.lemonsqueezy.com/my-orders' })
}
