import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import PasswordResetEmail from '@/emails/PasswordResetEmail'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://insic.app'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({})) as { email?: string }

  // Always return ok — never reveal whether email exists (prevents enumeration)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: true })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const sb = getClient()

  try {
    const { data: user } = await sb
      .from('users')
      .select('id, name, auth_method')
      .eq('email', normalizedEmail)
      .maybeSingle()

    // Only send reset if user exists and signed up via email (not Google)
    if (user && user.auth_method === 'email' && process.env.RESEND_API_KEY) {
      const token = randomBytes(32).toString('hex')
      const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1h

      await sb.from('auth_tokens').insert({
        email: normalizedEmail,
        token,
        type: 'reset_password',
        expires_at,
      })

      const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: normalizedEmail,
        subject: 'Reset your insic password',
        react: PasswordResetEmail({
          name: (user as { name?: string | null }).name ?? null,
          resetUrl,
        }),
      })
    }
  } catch (err) {
    console.error('[forgot-password] error:', err)
    // Still return ok to prevent enumeration
  }

  return NextResponse.json({ ok: true })
}
