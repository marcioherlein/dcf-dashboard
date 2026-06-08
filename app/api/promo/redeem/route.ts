import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per 10 minutes per IP to prevent brute-force enumeration
  const limited = rateLimit(req, 5, 10 * 60_000, 'promo-redeem')
  if (limited) return limited

  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getClient()
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const code = String(body?.code ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  // Check if this user already redeemed any promo code
  const { data: userRow } = await sb
    .from('users')
    .select('id, plan')
    .eq('email', userEmail)
    .single()

  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 403 })

  // Already on pro — idempotent
  if ((userRow as { plan?: string }).plan === 'pro') {
    return NextResponse.json({ ok: true })
  }

  // Look up code — check it's active AND not yet redeemed
  const { data: promoRow } = await sb
    .from('promo_codes')
    .select('id, max_uses, uses_count')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (!promoRow) {
    return NextResponse.json({ error: 'Code not recognised or no longer active.' }, { status: 404 })
  }

  const promo = promoRow as { id: string; max_uses?: number | null; uses_count?: number | null }

  // Enforce max_uses if set
  if (promo.max_uses != null && (promo.uses_count ?? 0) >= promo.max_uses) {
    return NextResponse.json({ error: 'This code has reached its usage limit.' }, { status: 410 })
  }

  // Check per-user redemption (prevent same user redeeming multiple codes)
  const { data: existingRedemption } = await sb
    .from('promo_redemptions')
    .select('id')
    .eq('user_id', (userRow as { id: string }).id)
    .maybeSingle()

  if (existingRedemption) {
    return NextResponse.json({ error: 'You have already redeemed a promo code.' }, { status: 409 })
  }

  // Atomically record redemption and upgrade user in sequence
  const { error: redemptionError } = await sb
    .from('promo_redemptions')
    .insert({ user_id: (userRow as { id: string }).id, promo_code_id: promo.id })

  if (redemptionError) {
    // Unique constraint violation = race condition, another request got there first
    return NextResponse.json({ error: 'Code already redeemed.' }, { status: 409 })
  }

  // Increment uses_count on the promo code
  await sb
    .from('promo_codes')
    .update({ uses_count: (promo.uses_count ?? 0) + 1 })
    .eq('id', promo.id)

  // Upgrade user to pro
  const { error: updateError } = await sb
    .from('users')
    .update({ plan: 'pro' })
    .eq('email', userEmail)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to activate Pro. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
