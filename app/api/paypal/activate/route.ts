import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserEntitlement } from '@/lib/entitlements'
import { createClient } from '@supabase/supabase-js'

const PAYPAL_BASE = 'https://api-m.paypal.com'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getPayPalToken(): Promise<string | null> {
  try {
    const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    })
    const d = await res.json()
    return d.access_token ?? null
  } catch {
    return null
  }
}

async function verifySubscription(subscriptionId: string, expectedEmail: string): Promise<{ valid: boolean; status?: string; reason?: string }> {
  const token = await getPayPalToken()
  if (!token) return { valid: false, reason: 'PAYPAL_TOKEN_UNAVAILABLE' }

  try {
    const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      console.error('[paypal/activate] subscription fetch failed:', res.status)
      return { valid: false, reason: 'PAYPAL_SUBSCRIPTION_NOT_FOUND' }
    }

    const sub = await res.json()
    const status: string = sub.status ?? ''
    const subEmail: string = (sub.subscriber?.email_address ?? '').toLowerCase().trim()
    const normalizedExpected = expectedEmail.toLowerCase().trim()

    if (status !== 'ACTIVE') {
      console.warn('[paypal/activate] subscription not active:', status, 'for', expectedEmail)
      return { valid: false, status, reason: 'PAYPAL_STATUS_NOT_ACTIVE' }
    }

    if (subEmail && subEmail !== normalizedExpected) {
      console.warn('[paypal/activate] email mismatch — sub:', subEmail, 'session:', normalizedExpected)
      return { valid: false, reason: 'PAYPAL_EMAIL_MISMATCH' }
    }

    return { valid: true, status }
  } catch (err) {
    console.error('[paypal/activate] verification exception:', err)
    return { valid: false, reason: 'PAYPAL_STATUS_UNKNOWN' }
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscriptionId } = await req.json().catch(() => ({})) as { subscriptionId?: string }
  if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 })

  // Verify subscription status with PayPal before granting Pro
  const verification = await verifySubscription(subscriptionId, userEmail)
  if (!verification.valid) {
    console.warn('[paypal/activate] verification failed:', verification.reason, 'for', userEmail, 'sub', subscriptionId)
    return NextResponse.json({
      error: 'Subscription verification failed',
      code: verification.reason ?? 'PAYPAL_STATUS_UNKNOWN',
      status: verification.status,
    }, { status: 402 })
  }

  const sb = getClient()
  const normalizedEmail = userEmail.toLowerCase().trim()

  const { error } = await sb
    .from('users')
    .update({ plan: 'pro', paypal_subscription_id: subscriptionId })
    .eq('email', normalizedEmail)

  if (error) {
    console.error('[paypal/activate] DB update error:', error.message)
    return NextResponse.json({ error: 'Failed to activate' }, { status: 500 })
  }

  console.log('[paypal/activate] Pro activated for', normalizedEmail, 'sub', subscriptionId)

  // Verify the update took effect
  const entitlement = await getUserEntitlement(normalizedEmail)
  if (entitlement.ok && entitlement.plan === 'pro') {
    console.log('[paypal/activate] entitlement confirmed pro for', normalizedEmail)
  } else {
    console.error('[paypal/activate] entitlement mismatch after update for', normalizedEmail, entitlement)
  }

  // Return refreshSession: true to signal client to call useSession.update()
  return NextResponse.json({ ok: true, refreshSession: true })
}
