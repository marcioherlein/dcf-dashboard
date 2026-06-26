import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import WelcomeEmail from '@/emails/WelcomeEmail'

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
  const sb = getClient()

  const { data: tokenRow } = await sb
    .from('auth_tokens')
    .select('id, used_at, expires_at')
    .eq('email', normalizedEmail)
    .eq('token', normalizedCode)
    .eq('type', 'verify_email')
    .maybeSingle()

  if (!tokenRow)                                       return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  if (tokenRow.used_at)                                return NextResponse.json({ error: 'This code has already been used' }, { status: 400 })
  if (new Date(tokenRow.expires_at) < new Date())      return NextResponse.json({ error: 'Code expired — request a new one' }, { status: 400 })

  // Mark email verified
  await sb
    .from('users')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('email', normalizedEmail)

  // Mark token used
  await sb
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  // Send welcome email
  if (process.env.RESEND_API_KEY) {
    try {
      const { data: userRow } = await sb.from('users').select('name').eq('email', normalizedEmail).maybeSingle()
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: normalizedEmail,
        subject: 'Welcome to insic — your first stock analysis awaits',
        react: WelcomeEmail({ name: (userRow as { name?: string | null } | null)?.name ?? null }),
      })
    } catch (err) {
      console.error('[verify-code] welcome email error:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
