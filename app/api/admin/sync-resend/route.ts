import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marcioherlein@gmail.com')
  .split(',').map(e => e.trim())

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) {
    return NextResponse.json({ error: 'RESEND_AUDIENCE_ID not configured' }, { status: 500 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const sb = createClient(url, key)
  const resend = new Resend(apiKey)

  // Fetch all users from Supabase
  const { data: users, error } = await sb
    .from('users')
    .select('email, name, plan')
    .not('email', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contacts = (users ?? []).filter(u => u.email?.includes('@'))

  let added = 0
  let failed = 0
  const errors: string[] = []

  // Resend contacts API: add one at a time (no batch upsert in their API)
  // Use Promise.allSettled with concurrency of 10
  const CONCURRENCY = 10
  for (let i = 0; i < contacts.length; i += CONCURRENCY) {
    const batch = contacts.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(u => {
        const [firstName, ...rest] = (u.name ?? '').split(' ')
        return resend.contacts.create({
          audienceId,
          email: u.email,
          firstName: firstName || undefined,
          lastName: rest.join(' ') || undefined,
          unsubscribed: false,
        })
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && !r.value.error) {
        added++
      } else {
        failed++
        const msg = r.status === 'rejected'
          ? String(r.reason)
          : r.value.error?.message ?? 'unknown'
        errors.push(msg)
      }
    }
  }

  console.log(`[sync-resend] added=${added} failed=${failed}`)
  return NextResponse.json({ ok: true, total: contacts.length, added, failed, errors: errors.slice(0, 10) })
}
