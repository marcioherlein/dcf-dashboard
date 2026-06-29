import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendEmail } from '@/lib/email/sendEmail'
import VerificationEmail from '@/emails/VerificationEmail'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateCode(): string {
  return String(randomInt(100000, 1000000))
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json().catch(() => ({})) as {
      name?: string
      email?: string
      password?: string
    }

    if (!name?.trim())                    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!email || !isValidEmail(email))   return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    const normalizedEmail = email.toLowerCase().trim()
    const sb = getClient()

    console.log('[auth.register.started]', { email: normalizedEmail })

    // Check email not already taken
    const { data: existing } = await sb
      .from('users')
      .select('id, email_verified_at, auth_method')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing?.auth_method === 'google') {
      return NextResponse.json({
        error: 'This email is linked to a Google account. Please sign in with Google instead.',
        code: 'USE_GOOGLE',
      }, { status: 409 })
    }

    if (existing?.email_verified_at) {
      return NextResponse.json({
        error: 'An account with this email already exists. Try signing in instead.',
        code: 'ALREADY_EXISTS',
      }, { status: 409 })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    if (existing) {
      // Unverified account exists — update password hash if they're retrying
      await sb.from('users').update({
        password_hash,
        name: name.trim(),
        terms_accepted_at: new Date().toISOString(),
      }).eq('email', normalizedEmail)
    } else {
      // Create new unverified user
      const { error: insertError } = await sb.from('users').insert({
        email:             normalizedEmail,
        name:              name.trim(),
        password_hash,
        auth_method:       'email',
        plan:              'free',
        terms_accepted_at: new Date().toISOString(),
      })
      if (insertError) {
        console.error('[auth.register.user_created] insert error:', insertError.message, insertError.code)
        if (insertError.code === '23505') {
          return NextResponse.json({
            error: 'An account with this email already exists. Try signing in instead.',
            code: 'ALREADY_EXISTS',
          }, { status: 409 })
        }
        return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
      }
    }

    console.log('[auth.register.user_created]', { email: normalizedEmail, isRetry: !!existing })

    // Invalidate any existing unused codes for this email
    await sb
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('email', normalizedEmail)
      .eq('type', 'verify_email')
      .is('used_at', null)

    // Generate 6-digit code, expires in 15 minutes
    const code = generateCode()
    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: tokenError } = await sb.from('auth_tokens').insert({
      email:           normalizedEmail,
      token:           code,
      type:            'verify_email',
      expires_at,
      failed_attempts: 0,
    })

    if (tokenError) {
      console.error('[auth.register.token_created] token insert error:', tokenError.message, tokenError.code)
      return NextResponse.json({ error: 'Failed to create verification code. Please try again.' }, { status: 500 })
    }

    console.log('[auth.register.token_created]', { email: normalizedEmail, expires_at })

    // Send verification email — failure blocks the response (caller must know)
    const emailResult = await sendEmail({
      to:       normalizedEmail,
      subject:  `${code} is your insic verification code`,
      react:    VerificationEmail({ name: name.trim(), verifyUrl: '', code }),
      logEvent: 'auth.register.email_sent',
    })

    if (!emailResult.ok) {
      console.error('[auth.register.email_failed]', {
        email:   normalizedEmail,
        code:    emailResult.code,
        message: emailResult.message,
      })
      return NextResponse.json({
        ok:        false,
        emailSent: false,
        code:      'VERIFICATION_EMAIL_FAILED',
        error:     'Could not send verification code. Please try again or contact support.',
      }, { status: 502 })
    }

    console.log('[auth.register.email_sent]', { email: normalizedEmail, providerId: emailResult.providerId })

    return NextResponse.json({ ok: true, emailSent: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[auth.register.exception]', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
