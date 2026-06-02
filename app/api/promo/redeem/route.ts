import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getClient()
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  const { code: rawCode } = await req.json()
  const code = String(rawCode ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  // Check if promo code exists and is active
  const { data: promoRow } = await sb
    .from('promo_codes')
    .select('id')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (!promoRow) {
    return NextResponse.json({ error: 'Code not recognised or no longer active.' }, { status: 404 })
  }

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
