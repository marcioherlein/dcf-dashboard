import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marciofabrizio@gmail.com')
  .split(',').map(e => e.trim())

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function buildHtml(subject: string, message: string): string {
  const paragraphs = message
    .split('\n')
    .filter(l => l.trim())
    .map(l => `<p style="margin:0 0 16px;color:#e2e8f0;font-size:15px;line-height:1.6">${l}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:32px 40px;background:#1e293b;border-bottom:1px solid #334155">
            <span style="font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px">insic</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 28px">
            <h2 style="margin:0 0 24px;font-size:20px;font-weight:600;color:#f8fafc">${subject}</h2>
            ${paragraphs}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#0f172a;border-top:1px solid #334155">
            <p style="margin:0;font-size:12px;color:#64748b">
              You're receiving this because you have an insic account. &nbsp;·&nbsp;
              <a href="https://insic.app" style="color:#64748b">insic.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { subject, message, audience } = await req.json() as {
    subject: string
    message: string
    audience: 'all' | 'free' | 'pro'
  }

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
  }

  const sb = getClient()
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  let query = sb.from('users').select('email')
  if (audience === 'pro') query = query.eq('plan', 'pro')
  // plan IS NULL means free (default) — neq('plan','pro') would silently drop NULLs in Postgres
  if (audience === 'free') query = query.or('plan.is.null,plan.eq.free')

  const { data: users, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const emails = (users ?? []).map(u => u.email).filter(Boolean)
  if (emails.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })

  const resend = new Resend(apiKey)
  const html = buildHtml(subject, message)

  // Resend batch: max 100 per call
  const BATCH_SIZE = 100
  let sent = 0
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE).map(to => ({
      from: 'insic <team@insic.app>',
      to,
      subject,
      html,
    }))
    const result = await resend.batch.send(batch)
    if (result.error) {
      console.error('[admin/broadcast] Resend batch error:', result.error)
      return NextResponse.json({ error: result.error.message, sent }, { status: 500 })
    }
    sent += batch.length
  }

  console.log(`[admin/broadcast] sent to ${sent} users (audience: ${audience})`)
  return NextResponse.json({ ok: true, sent })
}
