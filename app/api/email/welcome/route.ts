import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import WelcomeEmail from '@/emails/WelcomeEmail'

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })

    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: 'insic <team@insic.app>',
      to: email,
      subject: 'Welcome to insic — your first stock analysis awaits',
      react: WelcomeEmail({ name: name ?? null }),
    })

    if (result.error) {
      console.error('[welcome-email] Resend error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: result.data?.id })
  } catch (err) {
    console.error('[welcome-email] exception:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
