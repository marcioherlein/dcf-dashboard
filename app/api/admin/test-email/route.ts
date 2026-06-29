import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email/sendEmail'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marciofabrizio@gmail.com').split(',').map(e => e.trim())

export async function POST(req: NextRequest) {
  // Admin auth OR static key for CI
  const session = await getServerSession(authOptions)
  const adminKey = req.headers.get('x-admin-key')
  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email ?? '') || adminKey === process.env.ADMIN_STATUS_KEY

  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { to } = await req.json().catch(() => ({})) as { to?: string }
  if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 })

  // Import React and VerificationEmail dynamically to avoid SSR issues
  const { createElement } = await import('react')
  const { default: VerificationEmail } = await import('@/emails/VerificationEmail')

  const result = await sendEmail({
    to,
    subject: '000000 is your insic test verification code',
    react: createElement(VerificationEmail, { name: 'Test', verifyUrl: '', code: '000000' }),
    logEvent: 'auth.admin.test_email',
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code, error: result.message, providerError: result.providerError }, { status: 502 })
  }

  return NextResponse.json({ ok: true, providerId: result.providerId, to })
}
