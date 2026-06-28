import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'
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
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function sendCodeEmail(email: string, name: string, code: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // Reuse VerificationEmail but pass the code as the verifyUrl for simplicity
    // We override the template to show the code
    await resend.emails.send({
      from: 'insic <team@insic.app>',
      to: email,
      subject: `${code} is your insic verification code`,
      react: VerificationEmail({ name, verifyUrl: '', code }),
    })
  } catch (err) {
    console.error('[register] email send error:', err)
  }
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

    // Check email not already taken
    const { data: existing } = await sb
      .from('users')
      .select('id, email_verified_at, auth_method')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing?.email_verified_at) {
      // Give a specific message depending on how they signed up
      if (existing.auth_method === 'google') {
        return NextResponse.json({
          error: 'This email is linked to a Google account. Please sign in with Google instead.',
          code: 'USE_GOOGLE',
        }, { status: 409 })
      }
      return NextResponse.json({
        error: 'An account with this email already exists. Try signing in instead.',
        code: 'ALREADY_EXISTS',
      }, { status: 409 })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    if (existing) {
      // Unverified account exists — update password hash in case they're retrying
      await sb.from('users').update({ password_hash, name: name.trim() }).eq('email', normalizedEmail)
    } else {
      // Create new unverified user
      const { error: insertError } = await sb.from('users').insert({
        email:       normalizedEmail,
        name:        name.trim(),
        password_hash,
        auth_method: 'email',
        plan:        'free',
      })
      if (insertError) {
        console.error('[register] insert error:', insertError.message, insertError.code)
        return NextResponse.json({ error: 'Failed to create account: ' + insertError.message }, { status: 500 })
      }
    }

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
      email: normalizedEmail,
      token: code,
      type: 'verify_email',
      expires_at,
    })

    if (tokenError) {
      console.error('[register] token insert error:', tokenError.message, tokenError.code, tokenError.details)
      // Return a user-facing error so they know to contact support
      return NextResponse.json({
        error: `Failed to create verification code: ${tokenError.message}. Please contact support.`,
      }, { status: 500 })
    }

    // Token saved — send the email
    await sendCodeEmail(normalizedEmail, name.trim(), code)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[register] exception:', msg)
    return NextResponse.json({ error: 'Something went wrong: ' + msg }, { status: 500 })
  }
}
