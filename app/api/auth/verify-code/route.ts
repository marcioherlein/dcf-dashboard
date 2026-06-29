import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// BUG-11 FIX: max failed attempts before locking OTP
const MAX_FAILED_ATTEMPTS = 10

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const { email, code } = await req.json().catch(() => ({})) as {
    email?: string
    code?: string
  }

  if (!email || !code) return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()
  const normalizedCode  = code.trim()

  // Validate code is 6 digits
  if (!/^\d{6}$/.test(normalizedCode)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const sb = getClient()

  // BUG-11 FIX: look up the most recent unused, unexpired token for this email
  // and check failed_attempts before comparing the code
  const { data: tokenRow } = await sb
    .from('auth_tokens')
    .select('id, token, used_at, expires_at, failed_attempts')
    .eq('email', normalizedEmail)
    .eq('type', 'verify_email')
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Generic error for missing/expired — do not distinguish (anti-enumeration)
  if (!tokenRow) {
    return NextResponse.json({ error: 'Code not found or already used. Request a new one.' }, { status: 400 })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code has expired. Request a new one.' }, { status: 400 })
  }

  // BUG-11 FIX: lock after MAX_FAILED_ATTEMPTS
  const failedAttempts = (tokenRow.failed_attempts as number) ?? 0
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many attempts. Request a new verification code.' }, { status: 429 })
  }

  // Compare the actual code
  if (tokenRow.token !== normalizedCode) {
    // Increment failed attempts
    await sb
      .from('auth_tokens')
      .update({ failed_attempts: failedAttempts + 1 })
      .eq('id', tokenRow.id)

    const remaining = MAX_FAILED_ATTEMPTS - failedAttempts - 1
    return NextResponse.json({
      error: remaining > 0
        ? `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Too many attempts. Request a new verification code.',
    }, { status: 400 })
  }

  // Mark token used first (prevents race-condition double-verification)
  const { error: useError } = await sb
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)
    .is('used_at', null)  // only update if still unused (idempotency guard)

  if (useError) {
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }

  // Mark email verified
  await sb
    .from('users')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('email', normalizedEmail)

  // BUG-04 FIX: send welcome email via the idempotent helper in auth.ts logic
  // We do a direct atomic update here to ensure exactly-once delivery
  if (process.env.RESEND_API_KEY) {
    try {
      const { data: updated } = await sb
        .from('users')
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq('email', normalizedEmail)
        .is('welcome_email_sent_at', null)
        .select('name')
        .maybeSingle()

      if (updated) {
        // Only send if we won the atomic update race
        const { Resend } = await import('resend')
        const { default: WelcomeEmail } = await import('@/emails/WelcomeEmail')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'insic <team@insic.app>',
          to: normalizedEmail,
          subject: 'Welcome to insic — your first stock analysis awaits',
          react: WelcomeEmail({ name: (updated as { name?: string | null }).name ?? null }),
        })
        console.log('[verify-code] welcome email sent to', normalizedEmail)
      }
    } catch (err) {
      console.error('[verify-code] welcome email error:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ ok: true })
}
