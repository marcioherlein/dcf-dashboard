import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import ProWelcomeEmail from '@/emails/ProWelcomeEmail'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) return false
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
  const signature = req.headers.get('x-signature')

  if (!verifySignature(rawBody, signature)) {
    console.error('[lemonsqueezy/webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = JSON.parse(rawBody) as { meta: { event_name: string; custom_data?: Record<string, unknown> }; data: any }
  const eventName = event.meta?.event_name
  // Email pre-filled at checkout creation is available in custom_data or attributes
  const email: string | undefined =
    (event.meta?.custom_data?.user_email as string | undefined) ??
    event.data?.attributes?.user_email ??
    event.data?.attributes?.user_name  // fallback

  const subscriptionId: string | undefined = event.data?.id ? String(event.data.id) : undefined

  console.log(`[lemonsqueezy/webhook] ${eventName} — ${email ?? 'no email'} — sub ${subscriptionId ?? 'n/a'}`)

  const sb = getClient()

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_resumed':
      if (email) {
        const { data: userData } = await sb
          .from('users')
          .select('name')
          .eq('email', email)
          .maybeSingle()

        await sb
          .from('users')
          .update({ plan: 'pro', lemonsqueezy_subscription_id: subscriptionId ?? null })
          .eq('email', email)
        console.log('[lemonsqueezy/webhook] plan set to pro for', email)

        if (eventName === 'subscription_created' && process.env.RESEND_API_KEY) {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY)
            const billingInterval: string | undefined = event.data?.attributes?.billing_anchor
              ? event.data?.attributes?.renewal_email_enabled
              : event.data?.attributes?.variant_name
            const plan = typeof billingInterval === 'string' && billingInterval.toLowerCase().includes('annual')
              ? 'annual'
              : 'monthly'
            await resend.emails.send({
              from: 'insic <team@insic.app>',
              to: email,
              subject: 'Your insic Pro subscription is active',
              react: ProWelcomeEmail({ name: userData?.name ?? null, plan }),
            })
          } catch (err) {
            console.error('[lemonsqueezy/webhook] pro welcome email failed:', err instanceof Error ? err.message : err)
          }
        }
      }
      break

    case 'subscription_cancelled':
    case 'subscription_expired':
    case 'subscription_paused':
      if (email) {
        await sb
          .from('users')
          .update({ plan: 'free', lemonsqueezy_subscription_id: null })
          .eq('email', email)
        console.log('[lemonsqueezy/webhook] plan set to free for', email)
      } else if (subscriptionId) {
        await sb
          .from('users')
          .update({ plan: 'free', lemonsqueezy_subscription_id: null })
          .eq('lemonsqueezy_subscription_id', subscriptionId)
        console.log('[lemonsqueezy/webhook] plan set to free by sub id', subscriptionId)
      }
      break

    case 'subscription_payment_failed':
      // LS retries automatically; subscription_expired fires if all retries fail
      console.warn('[lemonsqueezy/webhook] payment failed for sub', subscriptionId)
      break

    default:
      break
  }

  return NextResponse.json({ received: true })
}
