import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import WelcomeEmail from '@/emails/WelcomeEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    await resend.emails.send({
      from: 'insic <team@insic.app>',
      to: email,
      subject: 'Welcome to insic — your first stock analysis awaits',
      react: WelcomeEmail({ name: name ?? null }),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[welcome-email]', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
