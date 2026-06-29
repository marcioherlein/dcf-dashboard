// lib/email/sendEmail.ts
// Shared Resend email helper — all auth email sends go through here.
// Never leaks the verification code in logs.
// Returns structured success/failure — never throws.

import { Resend } from 'resend'
import type { ReactElement } from 'react'

export type EmailResult =
  | { ok: true;  provider: 'resend'; providerId: string | null }
  | { ok: false; code: 'RESEND_NOT_CONFIGURED' | 'RESEND_REJECTED' | 'RESEND_EXCEPTION'; message: string; providerError?: string }

const FROM = process.env.RESEND_FROM_EMAIL ?? 'insic <team@insic.app>'

export async function sendEmail({
  to,
  subject,
  react,
  logEvent,
}: {
  to: string
  subject: string
  react: ReactElement
  logEvent: string  // e.g. 'auth.register.email_sent' — never include the code
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error(`[${logEvent}] RESEND_NOT_CONFIGURED: RESEND_API_KEY missing`)
    return { ok: false, code: 'RESEND_NOT_CONFIGURED', message: 'Email service is not configured.' }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({ from: FROM, to, subject, react })

    if (result.error) {
      console.error(`[${logEvent}] RESEND_REJECTED:`, result.error.message)
      return { ok: false, code: 'RESEND_REJECTED', message: result.error.message, providerError: result.error.message }
    }

    console.log(`[${logEvent}] email accepted by Resend id=${result.data?.id ?? 'unknown'} to=${to}`)
    return { ok: true, provider: 'resend', providerId: result.data?.id ?? null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${logEvent}] RESEND_EXCEPTION:`, msg)
    return { ok: false, code: 'RESEND_EXCEPTION', message: msg }
  }
}
