import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import WelcomeEmail from '@/emails/WelcomeEmail'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://insic.app'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(`${APP_URL}/auth/sign-in?error=invalid_token`)
  }

  const sb = getClient()

  // Look up token
  const { data: tokenRow } = await sb
    .from('auth_tokens')
    .select('id, email, used_at, expires_at')
    .eq('token', token)
    .eq('type', 'verify_email')
    .maybeSingle()

  if (!tokenRow) {
    return NextResponse.redirect(`${APP_URL}/auth/sign-in?error=invalid_token`)
  }
  if (tokenRow.used_at) {
    return NextResponse.redirect(`${APP_URL}/auth/sign-in?error=token_used`)
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.redirect(`${APP_URL}/auth/sign-in?error=token_expired`)
  }

  // Mark email as verified
  await sb
    .from('users')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('email', tokenRow.email)

  // Mark token used
  await sb
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  // Fetch user name for welcome email
  const { data: userRow } = await sb
    .from('users')
    .select('name')
    .eq('email', tokenRow.email)
    .maybeSingle()

  // Send welcome email
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: tokenRow.email,
        subject: 'Welcome to insic — your first stock analysis awaits',
        react: WelcomeEmail({ name: (userRow as { name?: string | null } | null)?.name ?? null }),
      })
    } catch (err) {
      console.error('[verify-email] welcome email failed:', err)
    }
  }

  return NextResponse.redirect(`${APP_URL}/auth/sign-in?verified=true`)
}
