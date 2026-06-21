import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import WeeklyDigestEmail, { type DigestEntry } from '@/emails/WeeklyDigestEmail'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function weekLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  // Fetch all users who have saved valuations, plus their email and name
  // Uses a join: valuations → users
  const { data: rows, error } = await sb
    .from('valuations')
    .select(`
      ticker,
      snapshot,
      user_id,
      users!inner ( id, email, name, newsletter_opt_in )
    `)
    .order('saved_at', { ascending: false })

  if (error) {
    console.error('[weekly-digest] fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No saved valuations found' })
  }

  // Group valuations by user
  const byUser = new Map<string, {
    email: string
    name: string | null
    entries: DigestEntry[]
  }>()

  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (row as any).users
    if (!user?.email) continue

    // Respect newsletter opt-out (null = opted in by default)
    if (user.newsletter_opt_in === false) continue

    if (!byUser.has(user.id)) {
      byUser.set(user.id, { email: user.email, name: user.name ?? null, entries: [] })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snap = (row as any).snapshot ?? {}
    byUser.get(user.id)!.entries.push({
      ticker: (row as { ticker: string }).ticker,
      companyName: snap.companyName ?? snap.name ?? (row as { ticker: string }).ticker,
      fairValue: snap.fairValue ?? null,
      currentPrice: snap.price ?? null,
      upsidePct: snap.upsidePct ?? null,
      currency: snap.currency ?? 'USD',
    })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const week = weekLabel()
  let sent = 0
  let failed = 0

  for (const [, { email, name, entries }] of Array.from(byUser)) {
    // Only send to users who have at least one valuation with a fair value
    const validEntries = entries.filter(e => e.fairValue != null)
    if (validEntries.length === 0) continue

    try {
      await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: email,
        subject: `Your insic watchlist — week of ${week}`,
        react: WeeklyDigestEmail({ name, entries: validEntries.slice(0, 10), weekOf: week }),
      })
      sent++
    } catch (err) {
      console.error(`[weekly-digest] failed to send to ${email}:`, err instanceof Error ? err.message : err)
      failed++
    }
  }

  console.log(`[weekly-digest] done — sent: ${sent}, failed: ${failed}`)
  return NextResponse.json({ sent, failed, week })
}
