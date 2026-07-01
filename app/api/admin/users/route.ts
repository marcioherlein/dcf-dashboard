import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { createElement } from 'react'
import { Resend } from 'resend'
import ProWelcomeEmail from '@/emails/ProWelcomeEmail'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marciofabrizio@gmail.com')
  .split(',').map(e => e.trim())

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = getClient()
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  const [{ data: users }, { data: viewRows }] = await Promise.all([
    sb.from('users').select('id, email, name, plan, last_seen, created_at').order('last_seen', { ascending: false }),
    sb.from('stock_views').select('user_id, ticker').gte('first_viewed_at', monthStart()),
  ])

  // Count distinct tickers per user this month
  const viewsByUser = new Map<string, Set<string>>()
  for (const row of viewRows ?? []) {
    if (!viewsByUser.has(row.user_id)) viewsByUser.set(row.user_id, new Set())
    viewsByUser.get(row.user_id)!.add(row.ticker)
  }

  const result = (users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    plan: (u.plan === 'pro' ? 'pro' : 'free') as 'free' | 'pro',
    last_seen: u.last_seen ?? null,
    created_at: u.created_at ?? null,
    views_this_month: viewsByUser.get(u.id)?.size ?? 0,
  }))

  return NextResponse.json(result)
}

// PATCH /api/admin/users — update a user's plan and optionally send Pro welcome email
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, plan } = await req.json().catch(() => ({})) as { email?: string; plan?: string }
  if (!email || !plan) return NextResponse.json({ error: 'email and plan required' }, { status: 400 })
  if (!['free', 'pro'].includes(plan)) return NextResponse.json({ error: 'plan must be free or pro' }, { status: 400 })

  const sb = getClient()
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  const normalizedEmail = email.toLowerCase().trim()

  const { data: userRow } = await sb.from('users').select('name, plan').eq('email', normalizedEmail).maybeSingle()
  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const wasAlreadyPro = userRow.plan === 'pro'

  await sb.from('users').update({ plan }).eq('email', normalizedEmail)

  // Send Pro welcome email if upgrading to pro (and wasn't already pro)
  let emailSent = false
  if (plan === 'pro' && !wasAlreadyPro && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const result = await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: normalizedEmail,
        subject: "You're on insic Pro — unlimited access is active",
        react: createElement(ProWelcomeEmail, { name: userRow.name ?? null, plan: 'monthly' }),
      })
      emailSent = !result.error
      if (result.error) console.error('[admin/users] pro email failed:', result.error.message)
    } catch (err) {
      console.error('[admin/users] pro email exception:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ ok: true, plan, emailSent })
}
