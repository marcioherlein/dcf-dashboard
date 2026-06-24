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

  if (!tokenRow)                                       return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  if (tokenRow.used_at)                                return NextResponse.json({ error: 'This link has already been used' }, { status: 400 })
  if (new Date(tokenRow.expires_at) < new Date())      return NextResponse.json({ error: 'This link has expired. Request a new one.' }, { status: 400 })

  const password_hash = await bcrypt.hash(password, 12)

  await sb
    .from('users')
    .update({ password_hash })
    .eq('email', tokenRow.email)

  await sb
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  return NextResponse.json({ ok: true })
}
