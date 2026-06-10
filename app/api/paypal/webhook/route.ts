import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const BASE_URL = 'https://api-m.paypal.com'

async function getAccessToken(): Promise<string> {
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const d = await res.json()
  return d.access_token
}

async function verifyWebhook(req: NextRequest, rawBody: string): Promise<boolean> {
  try {
    const token = await getAccessToken()
    const res = await fetch(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo:         req.headers.get('paypal-auth-algo'),
        cert_url:          req.headers.get('paypal-cert-url'),
        transmission_id:   req.headers.get('paypal-transmission-id'),
        transmission_sig:  req.headers.get('paypal-transmission-sig'),
        transmission_time: req.headers.get('paypal-transmission-time'),
        webhook_id:        process.env.PAYPAL_WEBHOOK_ID,
        webhook_event:     JSON.parse(rawBody),
      }),
    })
    const d = await res.json()
    return d.verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal/webhook] verification error:', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const valid = await verifyWebhook(req, rawBody)
  if (!valid) {
    console.error('[paypal/webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = JSON.parse(rawBody) as { event_type: string; resource: any }
  const { event_type, resource } = event
  const email: string | undefined = resource?.subscriber?.email_address
  const subscriptionId: string | undefined = resource?.id ? String(resource.id) : undefined

  console.log(`[paypal/webhook] ${event_type} — ${email ?? 'no email'} — ${subscriptionId ?? 'no sub id'}`)

  const sb = getClient()

  switch (event_type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      if (email) {
        await sb.from('users')
          .update({ plan: 'pro', paypal_subscription_id: subscriptionId ?? null })
          .eq('email', email)
        console.log('[paypal/webhook] plan set to pro for', email)
      }
      break

    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED':
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      if (email) {
        await sb.from('users')
          .update({ plan: 'free', paypal_subscription_id: null })
          .eq('email', email)
      } else if (subscriptionId) {
        await sb.from('users')
          .update({ plan: 'free', paypal_subscription_id: null })
          .eq('paypal_subscription_id', subscriptionId)
      }
      console.log('[paypal/webhook] plan set to free for', email ?? subscriptionId)
      break

    default:
      break
  }

  return NextResponse.json({ received: true })
}
