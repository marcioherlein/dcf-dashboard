import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'
import { createElement } from 'react'
import VerificationEmail from '@/emails/VerificationEmail'
import { sendEmail } from '@/lib/email/sendEmail'

const RESEND_COOLDOWN_SECONDS = 60

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function generateCode(): string {
  return String(randomInt(100000, 1000000))
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({})) as { email?: string }
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()
  const sb = getClient()

  console.log('[auth.resend.started] email=<redacted>')

  // Check user exists and is not already verified
  const { data: user } = await sb
    .from('users')
    .select('name, email_verified_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (!user)                  return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (user.email_verified_at) return NextResponse.json({ error: 'Email already verified' }, { status: 400 })

  // Enforce cooldown — check most recent unused code
  const { data: recent } = await sb
    .from('auth_tokens')
    .select('created_at')
    .eq('email', normalizedEmail)
    .eq('type', 'verify_email')
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent) {
    const secondsAgo = (Date.now() - new Date(recent.created_at).getTime()) / 1000
    if (secondsAgo < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsAgo)
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting a new code`, cooldown: waitSeconds }, { status: 429 })
    }
  }

  // Invalidate old codes
  await sb
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('email', normalizedEmail)
    .eq('type', 'verify_email')
    .is('used_at', null)

  // New code, expires 15 min
  const code = generateCode()
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await sb.from('auth_tokens').insert({
    email:           normalizedEmail,
    token:           code,
    type:            'verify_email',
    expires_at,
    failed_attempts: 0,
  })

  // Send verification email — cooldown is NOT started if this fails
  const sendResult = await sendEmail({
    to:       normalizedEmail,
    subject:  `Your insic verification code`,
    react:    createElement(VerificationEmail, { name: user.name ?? null, verifyUrl: '', code }),
    logEvent: 'auth.resend',
  })

  if (!sendResult.ok) {
    console.error('[auth.resend.email_failed] code=' + sendResult.code)
    return NextResponse.json(
      { ok: false, emailSent: false, code: sendResult.code, error: sendResult.message },
      { status: 502 },
    )
  }

  console.log('[auth.resend.email_sent]')
  return NextResponse.json({ ok: true, emailSent: true })
}
