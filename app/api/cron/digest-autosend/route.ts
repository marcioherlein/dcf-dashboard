import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  // Auth check: CRON_SECRET header (set automatically by Vercel for cron routes)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  // Find drafts due for auto-send: status = 'draft' and auto_send_at <= now()
  const now = new Date().toISOString()
  const { data: drafts, error } = await sb
    .from('digest_drafts')
    .select('id')
    .eq('status', 'draft')
    .lte('auto_send_at', now)

  if (error) {
    console.error('[digest-autosend] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ triggered: 0 })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://insic.app'
  let triggered = 0

  for (const draft of drafts) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/digest-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ digestId: draft.id }),
      })

      if (res.ok) {
        triggered++
        console.log(`[digest-autosend] triggered send for draft ${draft.id}`)
      } else {
        const body = await res.text()
        console.error(`[digest-autosend] send failed for draft ${draft.id}: ${res.status} ${body}`)
      }
    } catch (err) {
      console.error(
        `[digest-autosend] fetch error for draft ${draft.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  return NextResponse.json({ triggered })
}
