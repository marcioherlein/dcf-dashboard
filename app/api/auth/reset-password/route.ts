import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({})) as {
    token?: string
    password?: string
  }

  if (!token)                            return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const sb = getClient()

  const { data: tokenRow } = await sb
    .from('auth_tokens')
    .select('id, email, used_at, expires_at')
    .eq('token', token)
    .eq('type', 'reset_password')
    .maybeSingle()

  if (!tokenRow)                                  return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  if (tokenRow.used_at)                           return NextResponse.json({ error: 'This link has already been used' }, { status: 400 })
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: 'This link has expired. Request a new one.' }, { status: 400 })

  // BUG-10 FIX: verify the target account is an email account, not Google-only
  const { data: userRow } = await sb
    .from('users')
    .select('auth_method')
    .eq('email', tokenRow.email)
    .maybeSingle()

  if (!userRow) return NextResponse.json({ error: 'Account not found.' }, { status: 400 })
  if (userRow.auth_method === 'google') {
    // Should never happen via normal flow (forgot-password blocks Google accounts)
    // but protects against stale tokens or direct API abuse
    console.warn('[reset-password] blocked attempt to set password on Google account:', tokenRow.email)
    return NextResponse.json({ error: 'This account uses Google sign-in. Password reset is not applicable.' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 12)

  // Mark token used first (single-use guarantee — BUG-10 defence in depth)
  const { error: useError } = await sb
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)
    .is('used_at', null)

  if (useError) {
    return NextResponse.json({ error: 'Reset failed. Please request a new link.' }, { status: 500 })
  }

  await sb
    .from('users')
    .update({ password_hash })
    .eq('email', tokenRow.email)

  return NextResponse.json({ ok: true })
}
