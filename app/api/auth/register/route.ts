import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import { createElement } from 'react'
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

async function sendVerificationCode(to: string, name: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[auth.register.email_failed] RESEND_API_KEY not set')
    return { ok: false, error: 'Email service is not configured.' }
  }
  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: 'insic <team@insic.app>',
      to,
      subject: `${code} is your insic verification code`,
      react: createElement(VerificationEmail, { name, verifyUrl: '', code }),
    })
    if (result.error) {
      console.error('[auth.register.email_failed]', result.error.message)
      return { ok: false, error: result.error.message }
    }
    console.log('[auth.register.email_sent] id=' + result.data?.id)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[auth.register.email_failed] exception:', msg)
    return { ok: false, error: msg }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json().catch(() => ({})) as {
      name?: string; email?: string; password?: string
    }

    if (!name?.trim())                    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!email || !isValidEmail(email))   return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    const normalizedEmail = email.toLowerCase().trim()
    const sb = getClient()

    const { data: existing } = await sb
      .from('users').select('id, email_verified_at, auth_method').eq('email', normalizedEmail).maybeSingle()

    if (existing?.auth_method === 'google') {
      return NextResponse.json({ error: 'This email is linked to a Google account. Please sign in with Google instead.', code: 'USE_GOOGLE' }, { status: 409 })
    }
    if (existing?.email_verified_at) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.', code: 'ALREADY_EXISTS' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 10)

    if (existing) {
      await sb.from('users').update({ password_hash, name: name.trim(), terms_accepted_at: new Date().toISOString() }).eq('email', normalizedEmail)
    } else {
      const { error: insertError } = await sb.from('users').insert({
        email: normalizedEmail, name: name.trim(), password_hash,
        auth_method: 'email', plan: 'free', terms_accepted_at: new Date().toISOString(),
      })
      if (insertError) {
        if (insertError.code === '23505') return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.', code: 'ALREADY_EXISTS' }, { status: 409 })
        return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
      }
    }

    await sb.from('auth_tokens').update({ used_at: new Date().toISOString() })
      .eq('email', normalizedEmail).eq('type', 'verify_email').is('used_at', null)

    const code = generateCode()
    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: tokenError } = await sb.from('auth_tokens').insert({
      email: normalizedEmail, token: code, type: 'verify_email', expires_at, failed_attempts: 0,
    })
    if (tokenError) {
      return NextResponse.json({ error: 'Failed to create verification code. Please try again.' }, { status: 500 })
    }

    const emailResult = await sendVerificationCode(normalizedEmail, name.trim(), code)
    if (!emailResult.ok) {
      return NextResponse.json({
        ok: false, emailSent: false, code: 'VERIFICATION_EMAIL_FAILED',
        error: 'Could not send verification code. Please try again or contact support.',
      }, { status: 502 })
    }

    return NextResponse.json({ ok: true, emailSent: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[auth.register.exception]', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
