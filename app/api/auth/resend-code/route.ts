import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'  // BUG-02 FIX
import { Resend } from 'resend'
import VerificationEmail from '@/emails/VerificationEmail'

const RESEND_COOLDOWN_SECONDS = 60

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// BUG-02 FIX: cryptographically secure
function generateCode(): string {
  return String(randomInt(100000, 1000000))
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({})) as { email?: string }
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()
  const sb = getClient()

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
    failed_attempts: 0,  // BUG-11 FIX: reset attempt counter on new code
  })

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: normalizedEmail,
        subject: `${code} is your insic verification code`,
        react: VerificationEmail({ name: user.name ?? null, verifyUrl: '', code }),
      })
    } catch (err) {
      console.error('[resend-code] email error:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
