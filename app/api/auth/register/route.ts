import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import VerificationEmail from '@/emails/VerificationEmail'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://insic.app'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json().catch(() => ({})) as {
      name?: string
      email?: string
      password?: string
    }

    // Validation
    if (!name?.trim())                    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!email || !isValidEmail(email))   return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    const normalizedEmail = email.toLowerCase().trim()
    const sb = getClient()

    // Check if email already taken
    const { data: existing } = await sb
      .from('users')
      .select('id, auth_method')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      )
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    // Create user (unverified)
    const { error: insertError } = await sb.from('users').insert({
      email:       normalizedEmail,
      name:        name.trim(),
      password_hash,
      auth_method: 'email',
      plan:        'free',
    })

    if (insertError) {
      console.error('[register] insert error:', insertError.message, insertError.code, insertError.details)
      // Column doesn't exist = migration not run
      if (insertError.message?.includes('column') || insertError.code === '42703') {
        return NextResponse.json({ error: 'Database setup incomplete. Please contact support.' }, { status: 500 })
      }
      return NextResponse.json({ error: 'Failed to create account: ' + insertError.message }, { status: 500 })
    }

    // Generate verification token (32 hex bytes = 64 chars)
    const token = randomBytes(32).toString('hex')
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // +24h

    const { error: tokenError } = await sb.from('auth_tokens').insert({
      email: normalizedEmail,
      token,
      type: 'verify_email',
      expires_at,
    })

    if (tokenError) {
      console.error('[register] token insert error:', tokenError.message)
      // Non-fatal — account is created, user can request a new verification email
    }

    // Send verification email — non-fatal, account is already created
    if (process.env.RESEND_API_KEY && !tokenError) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`
        const result = await resend.emails.send({
          from: 'insic <team@insic.app>',
          to: normalizedEmail,
          subject: 'Confirm your insic email address',
          react: VerificationEmail({ name: name.trim(), verifyUrl }),
        })
        if (result.error) {
          console.error('[register] resend error:', result.error)
        }
      } catch (emailErr) {
        console.error('[register] email send exception:', emailErr)
        // Account created successfully — email failure is non-fatal
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[register] exception:', msg)
    return NextResponse.json({ error: 'Something went wrong: ' + msg }, { status: 500 })
  }
}
