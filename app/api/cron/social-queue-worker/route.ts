import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Safety net catch-up worker — runs every 30 minutes via Vercel cron.
// Primary scheduling is GitHub Actions (48 cron entries in x-post.yml).
// This route finds posts that were due in the last 4 hours but never ran
// and re-dispatches them to GitHub Actions.

export const maxDuration = 30

const MAX_DISPATCHES_PER_RUN = 5
const CATCHUP_WINDOW_HOURS   = 4
// Workflow ID for x-post.yml (same as used in /api/cron/x-post)
const GH_WORKFLOW_ID = '289941116'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function dispatchToGitHubActions(mode: string, ghToken: string, ghRepo: string): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/repos/${ghRepo}/actions/workflows/${GH_WORKFLOW_ID}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        ref:    'main',
        inputs: { mode, ticker: '', dry_run: 'false' },
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[social-queue-worker] GitHub dispatch failed mode=${mode}: ${res.status} ${body}`)
    return false
  }

  return true
}

export async function GET(req: NextRequest) {
  // Auth: Vercel passes Authorization: Bearer <CRON_SECRET> on scheduled calls.
  // Manual calls must include the same header.
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ghToken = process.env.GH_DISPATCH_TOKEN
  const ghRepo  = process.env.GH_REPO ?? 'marcioherlein/dcf-dashboard'

  if (!ghToken) {
    return NextResponse.json({ error: 'GH_DISPATCH_TOKEN not configured' }, { status: 500 })
  }

  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const now          = new Date()
  const windowStart  = new Date(now.getTime() - CATCHUP_WINDOW_HOURS * 60 * 60 * 1000)

  // Query missed posts: due within the catchup window, not yet completed/processing,
  // and either never attempted or past their next_attempt_at backoff.
  let rows: Array<{ id: string; mode: string; platform: string; scheduled_for: string }> = []

  try {
    const { data, error } = await sb
      .from('post_queue')
      .select('id, mode, platform, scheduled_for')
      .in('status', ['scheduled', 'queued', 'failed'])
      .gte('scheduled_for', windowStart.toISOString())
      .lte('scheduled_for', now.toISOString())
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
      .order('scheduled_for', { ascending: true })
      .limit(MAX_DISPATCHES_PER_RUN)

    if (error) {
      // Distinguish "table doesn't exist" from other errors
      const msg: string = error.message ?? ''
      if (
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        (error as { code?: string }).code === '42P01'
      ) {
        console.log('[social-queue-worker] post_queue table not initialized — skipping')
        return NextResponse.json({ dispatched: 0, message: 'Queue table not initialized' })
      }

      console.error('[social-queue-worker] Supabase query error:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    rows = data ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('does not exist') || msg.includes('relation')) {
      return NextResponse.json({ dispatched: 0, message: 'Queue table not initialized' })
    }
    console.error('[social-queue-worker] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (rows.length === 0) {
    console.log('[social-queue-worker] No missed posts found in catchup window')
    return NextResponse.json({ dispatched: 0, posts: [] })
  }

  // Dispatch each missed post to GitHub Actions
  const dispatched: Array<{ mode: string; platform: string; scheduledFor: string }> = []
  const dispatchErrors: Array<{ mode: string; error: string }> = []

  for (const row of rows) {
    const ok = await dispatchToGitHubActions(row.mode, ghToken, ghRepo)

    if (ok) {
      dispatched.push({
        mode:         row.mode,
        platform:     row.platform,
        scheduledFor: row.scheduled_for,
      })

      // Mark as re-queued so we don't dispatch it again on the next run
      const { error: updateErr } = await sb
        .from('post_queue')
        .update({
          status:          'queued',
          next_attempt_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), // +10 min backoff
        })
        .eq('id', row.id)

      if (updateErr) {
        console.warn(`[social-queue-worker] Could not update status for id=${row.id}: ${updateErr.message}`)
      }

      console.log(`[social-queue-worker] Dispatched mode=${row.mode} platform=${row.platform} scheduled_for=${row.scheduled_for}`)
    } else {
      dispatchErrors.push({ mode: row.mode, error: 'GitHub dispatch returned non-OK' })
    }
  }

  return NextResponse.json({
    dispatched:      dispatched.length,
    posts:           dispatched,
    errors:          dispatchErrors.length > 0 ? dispatchErrors : undefined,
    catchupWindowHr: CATCHUP_WINDOW_HOURS,
  })
}
