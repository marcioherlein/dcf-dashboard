import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'marciofabrizio@gmail.com')
  .split(',').map(e => e.trim())

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
  const session = await getServerSession(authOptions)
  return ADMIN_EMAILS.includes(session?.user?.email ?? '')
}

// ---------------------------------------------------------------------------
// POST /api/admin/replay-posts
// Safe manual replay: resets failed/cancelled queue rows to 'scheduled' state
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  let body: {
    platform?: 'x' | 'linkedin' | 'all'
    date?: string
    status?: 'failed' | 'cancelled' | 'all'
    mode?: string
    dryRun?: boolean
  } = {}

  try {
    body = await req.json()
  } catch {
    // default body is fine
  }

  const platform = body.platform ?? 'all'
  const dryRun   = body.dryRun ?? false
  const modeFilter = body.mode ?? null
  const statusFilter = body.status ?? 'failed'

  // Resolve target date (YYYY-MM-DD, default today UTC)
  const targetDate = body.date ?? new Date().toISOString().split('T')[0]

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'Invalid date format, expected YYYY-MM-DD' }, { status: 400 })
  }

  // Build query — fetch candidate rows for this calendar day
  let query = sb
    .from('post_queue')
    .select('id, mode, platform, scheduled_for, status')
    .gte('scheduled_for', `${targetDate}T00:00:00Z`)
    .lt('scheduled_for',  `${targetDate}T23:59:59.999Z`)

  if (platform !== 'all') {
    query = query.eq('platform', platform)
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  } else {
    query = query.in('status', ['failed', 'cancelled'])
  }

  if (modeFilter) {
    query = query.eq('mode', modeFilter)
  }

  const { data: candidates, error: fetchError } = await query.order('scheduled_for', { ascending: true })

  if (fetchError) {
    console.error('[replay-posts] fetch error', fetchError)
    return NextResponse.json({ error: 'Failed to query post_queue' }, { status: 500 })
  }

  const rows = candidates ?? []

  // For each candidate, check idempotency: does a 'done' row already exist
  // for the same mode+platform on this day?
  const posts: Array<{
    id: string
    mode: string
    platform: string
    scheduledFor: string
    action: 'reset' | 'skipped'
  }> = []

  let replayed = 0
  let skipped  = 0

  for (const row of rows) {
    // Idempotency check: look for a done row for same mode+platform on same day
    const { data: doneRows } = await sb
      .from('post_queue')
      .select('id')
      .eq('mode', row.mode)
      .eq('platform', row.platform)
      .eq('status', 'done')
      .gte('scheduled_for', `${targetDate}T00:00:00Z`)
      .lt('scheduled_for',  `${targetDate}T23:59:59.999Z`)
      .limit(1)

    if (doneRows && doneRows.length > 0) {
      // Already posted successfully — skip
      posts.push({
        id:           row.id,
        mode:         row.mode,
        platform:     row.platform,
        scheduledFor: row.scheduled_for,
        action:       'skipped',
      })
      skipped++
      continue
    }

    // Not yet posted — reset to scheduled state
    if (!dryRun) {
      const { error: updateError } = await sb
        .from('post_queue')
        .update({
          status:          'pending',
          next_attempt_at: null,
          last_error:      null,
          attempts:        0,
        })
        .eq('id', row.id)

      if (updateError) {
        console.error(`[replay-posts] update failed for id=${row.id}`, updateError)
        // Continue processing other rows; surface partial failure in logs
      }
    }

    posts.push({
      id:           row.id,
      mode:         row.mode,
      platform:     row.platform,
      scheduledFor: row.scheduled_for,
      action:       'reset',
    })
    replayed++
  }

  return NextResponse.json({ replayed, skipped, dryRun, posts })
}

// ---------------------------------------------------------------------------
// GET /api/admin/replay-posts?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns all post_queue rows for a date range, grouped by date and status
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const now = new Date()
  const defaultTo   = now.toISOString().split('T')[0]
  const defaultFrom = new Date(now.getTime() - 6 * 86400000).toISOString().split('T')[0]

  const params = req.nextUrl.searchParams
  const fromDate = params.get('from') ?? defaultFrom
  const toDate   = params.get('to')   ?? defaultTo

  // Validate
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(fromDate) || !dateRe.test(toDate)) {
    return NextResponse.json({ error: 'Invalid date format, expected YYYY-MM-DD' }, { status: 400 })
  }

  const { data: rows, error } = await sb
    .from('post_queue')
    .select('id, mode, platform, scheduled_for, status, attempts, last_error, posted_at, buffer_post_id')
    .gte('scheduled_for', `${fromDate}T00:00:00Z`)
    .lte('scheduled_for', `${toDate}T23:59:59.999Z`)
    .order('scheduled_for', { ascending: false })

  if (error) {
    console.error('[replay-posts GET] fetch error', error)
    return NextResponse.json({ error: 'Failed to query post_queue' }, { status: 500 })
  }

  // Group by date, then by status
  type PostRow = {
    id: string
    mode: string
    platform: string
    scheduled_for: string
    status: string
    attempts: number
    last_error: string | null
    posted_at: string | null
    buffer_post_id: string | null
    // derived idempotency key: mode:platform:date — what a replay would check
    idempotencyKey: string
  }

  const grouped: Record<string, Record<string, PostRow[]>> = {}

  for (const r of rows ?? []) {
    const date = r.scheduled_for.split('T')[0]
    const idempotencyKey = `${r.mode}:${r.platform}:${date}`
    const enriched: PostRow = { ...r, idempotencyKey }

    if (!grouped[date]) grouped[date] = {}
    if (!grouped[date][r.status]) grouped[date][r.status] = []
    grouped[date][r.status].push(enriched)
  }

  // Summary per date
  const summary = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, byStatus]) => {
      const allRows = Object.values(byStatus).flat()
      return {
        date,
        total: allRows.length,
        byStatus: Object.fromEntries(
          Object.entries(byStatus).map(([status, statusRows]) => [
            status,
            { count: statusRows.length, posts: statusRows },
          ])
        ),
        replayable: allRows.filter(r =>
          (r.status === 'failed' || r.status === 'cancelled') &&
          !allRows.some(d => d.mode === r.mode && d.platform === r.platform && d.status === 'done')
        ).length,
      }
    })

  return NextResponse.json({
    from: fromDate,
    to:   toDate,
    totalRows: (rows ?? []).length,
    dates: summary,
  })
}
