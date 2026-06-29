import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'marcioherlein@gmail.com')
  .split(',').map(e => e.trim())

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(sb: { from: (...args: any[]) => any }, table: string): Promise<boolean> {
  const { error } = await sb.from(table).select('id').limit(1)
  // If error code is 42P01 (undefined_table) the table doesn't exist
  return !error || error.code !== '42P01'
}

type Health = 'healthy' | 'degraded' | 'failing'

function computeHealth(
  failedCount: number,
  stuckCount: number,
  expectedByNow: number,
  actualByNow: number,
  lastPostAt: string | null,
): Health {
  const now = Date.now()
  const isWeekday = [1, 2, 3, 4, 5].includes(new Date().getDay())
  const fourHoursMs = 4 * 60 * 60 * 1000
  const noPostsIn4h =
    isWeekday &&
    (!lastPostAt || now - new Date(lastPostAt).getTime() > fourHoursMs)

  if (failedCount >= 3 || stuckCount > 0 || noPostsIn4h) return 'failing'
  if (failedCount >= 1 && failedCount <= 2) return 'degraded'
  if (expectedByNow > 0 && actualByNow < expectedByNow * 0.8) return 'degraded'
  return 'healthy'
}

export async function GET(req: NextRequest) {
  // Auth: admin session OR Authorization: Bearer <ADMIN_STATUS_KEY>
  const authHeader = req.headers.get('authorization')
  const adminStatusKey = process.env.ADMIN_STATUS_KEY
  const isBearer = adminStatusKey && authHeader === `Bearer ${adminStatusKey}`

  if (!isBearer) {
    const session = await getServerSession(authOptions)
    if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const now = new Date()
  const nowIso = now.toISOString()
  const todayUTC = nowIso.split('T')[0]
  const todayStart = `${todayUTC}T00:00:00Z`
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString().split('T')[0]
  const sevenDaysAgoStart = `${sevenDaysAgo}T00:00:00Z`
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60_000).toISOString()
  const oneHourAgo = new Date(now.getTime() - 60 * 60_000).toISOString()

  const hasPostQueue = await tableExists(sb, 'post_queue')

  // ─── post_queue path ────────────────────────────────────────────────────────
  if (hasPostQueue) {
    // Today's rows
    const { data: todayRows } = await sb
      .from('post_queue')
      .select('id, status, platform, scheduled_for, posted_at, error_code, error_message, next_attempt_at, updated_at')
      .gte('scheduled_for', todayStart)
      .order('scheduled_for', { ascending: true })

    // Last 7 days rows
    const { data: weekRows } = await sb
      .from('post_queue')
      .select('id, status, platform, scheduled_for, posted_at, error_code, next_attempt_at, updated_at')
      .gte('scheduled_for', sevenDaysAgoStart)
      .order('scheduled_for', { ascending: true })

    const today = todayRows ?? []
    const week = weekRows ?? []

    // Stuck jobs: status=running AND updated_at older than 30 min
    const stuckJobs = today.filter(
      r => r.status === 'running' && r.updated_at < thirtyMinAgo,
    )

    // Last worker run: any row whose updated_at is within the last hour
    const recentUpdates = today
      .filter(r => r.updated_at >= oneHourAgo)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    const lastWorkerRun = recentUpdates[0]?.updated_at ?? null

    // Per-status counts
    const countByStatus = (status: string) => today.filter(r => r.status === status).length

    const scheduled       = countByStatus('scheduled')
    const queued          = countByStatus('queued')
    const running         = countByStatus('running')
    const posted          = countByStatus('posted')
    const failed          = countByStatus('failed')
    const skipped         = countByStatus('skipped')
    const permanentlyFailed = countByStatus('cancelled')

    const retryingRows = today.filter(
      r => r.status === 'failed' && r.next_attempt_at && r.next_attempt_at > nowIso,
    )
    const retrying = retryingRows.length

    const nextRetryTimes = retryingRows
      .map(r => r.next_attempt_at as string)
      .sort()
    const nextRetryTime = nextRetryTimes[0] ?? null

    // Expected vs actual by now
    const expectedByNow = today.filter(r => r.scheduled_for <= nowIso).length
    const actualByNow   = today.filter(r => r.status === 'posted' && r.scheduled_for <= nowIso).length

    // Last post per platform
    const postedRows = today.filter(r => r.status === 'posted' && r.posted_at)
    postedRows.sort((a, b) => b.posted_at.localeCompare(a.posted_at))

    const lastXRow = postedRows.find(r => r.platform === 'x' || r.platform === 'twitter')
    const lastLinkedInRow = postedRows.find(r => r.platform === 'linkedin')

    const lastXPost = lastXRow
      ? { id: lastXRow.id, platform: lastXRow.platform, at: lastXRow.posted_at }
      : null
    const lastLinkedInPost = lastLinkedInRow
      ? { id: lastLinkedInRow.id, platform: lastLinkedInRow.platform, at: lastLinkedInRow.posted_at }
      : null

    // Most recent post for health check
    const mostRecentPost = postedRows[0]?.posted_at ?? null

    const health = computeHealth(failed, stuckJobs.length, expectedByNow, actualByNow, mostRecentPost)

    // Week stats
    const weekPosted = week.filter(r => r.status === 'posted')
    const weekFailed = week.filter(r => r.status === 'failed' || r.status === 'cancelled')
    const successRate = week.length > 0
      ? Math.round((weekPosted.length / week.length) * 100)
      : 0

    // Failures by error_code
    const failuresByErrorCode: Record<string, number> = {}
    for (const r of weekFailed) {
      const code = (r.error_code as string | null) ?? 'unknown'
      failuresByErrorCode[code] = (failuresByErrorCode[code] ?? 0) + 1
    }

    // Failures by platform
    const failuresByPlatform = {
      x:        weekFailed.filter(r => r.platform === 'x' || r.platform === 'twitter').length,
      linkedin: weekFailed.filter(r => r.platform === 'linkedin').length,
    }

    // Avg delay seconds
    const delays = weekPosted
      .filter(r => r.posted_at && r.scheduled_for)
      .map(r => (new Date(r.posted_at).getTime() - new Date(r.scheduled_for).getTime()) / 1000)
    const avgDelaySeconds = delays.length > 0
      ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
      : null

    return NextResponse.json({
      status: health,
      asOf: nowIso,
      source: 'post_queue',
      today: {
        date: todayUTC,
        scheduled,
        queued,
        running,
        posted,
        failed,
        skipped,
        retrying,
        permanently_failed: permanentlyFailed,
        next_retry_time: nextRetryTime,
        stuck_jobs: stuckJobs.map(r => ({
          id: r.id,
          platform: r.platform,
          scheduled_for: r.scheduled_for,
          running_since: r.updated_at,
        })),
        last_x_post: lastXPost,
        last_linkedin_post: lastLinkedInPost,
        last_worker_run: lastWorkerRun,
        expected_by_now: expectedByNow,
        actual_by_now: actualByNow,
        health,
      },
      week: {
        success_rate: successRate,
        failures_by_error_code: failuresByErrorCode,
        failures_by_platform: failuresByPlatform,
        avg_delay_seconds: avgDelaySeconds,
      },
      env: {
        buffer_x_configured:        !!process.env.BUFFER_API_KEY && !!process.env.BUFFER_CHANNEL_ID,
        buffer_linkedin_configured:  !!process.env.LINKEDIN_CHANNEL_ID,
        supabase_configured:         !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        resend_configured:           !!process.env.RESEND_API_KEY,
      },
    })
  }

  // ─── legacy posted_tweet_events fallback ────────────────────────────────────
  const { data: todayEvents } = await sb
    .from('posted_tweet_events')
    .select('event_key, tweet_type, posted_at, tweet_text')
    .gte('posted_at', todayStart)
    .order('posted_at', { ascending: false })

  const { data: weekEvents } = await sb
    .from('posted_tweet_events')
    .select('event_key, tweet_type, posted_at')
    .gte('posted_at', sevenDaysAgoStart)
    .order('posted_at', { ascending: false })

  const todayRows = todayEvents ?? []
  const weekRows  = weekEvents  ?? []

  const todayPosted = todayRows.filter(e => !e.event_key.endsWith(':failed'))
  const todayFailed = todayRows.filter(e => e.event_key.endsWith(':failed'))

  const isLinkedIn = (eventKey: string) => eventKey.split(':')[1]?.startsWith('li_')

  const lastXRow = todayPosted.find(e => !isLinkedIn(e.event_key))
  const lastLIRow = todayPosted.find(e => isLinkedIn(e.event_key))

  const weekPosted = weekRows.filter(e => !e.event_key.endsWith(':failed'))
  const weekFailed = weekRows.filter(e => e.event_key.endsWith(':failed'))

  const successRate = weekRows.length > 0
    ? Math.round((weekPosted.length / weekRows.length) * 100)
    : 0

  const failuresByErrorCode: Record<string, number> = {}
  for (const e of weekFailed) {
    const mode = e.event_key.split(':')[1] ?? 'unknown'
    failuresByErrorCode[mode] = (failuresByErrorCode[mode] ?? 0) + 1
  }

  const failuresByPlatform = {
    x:        weekFailed.filter(e => !isLinkedIn(e.event_key)).length,
    linkedin: weekFailed.filter(e => isLinkedIn(e.event_key)).length,
  }

  const mostRecentPost = todayPosted[0]?.posted_at ?? null
  // Legacy table has no scheduled_for so expected_by_now falls back to 0
  const health = computeHealth(todayFailed.length, 0, 0, todayPosted.length, mostRecentPost)

  return NextResponse.json({
    status: health,
    asOf: nowIso,
    source: 'posted_tweet_events_legacy',
    today: {
      date: todayUTC,
      scheduled:           0,
      queued:              0,
      running:             0,
      posted:              todayPosted.length,
      failed:              todayFailed.length,
      skipped:             0,
      retrying:            0,
      permanently_failed:  0,
      next_retry_time:     null,
      stuck_jobs:          [],
      last_x_post: lastXRow
        ? { mode: lastXRow.event_key.split(':')[1], at: lastXRow.posted_at }
        : null,
      last_linkedin_post: lastLIRow
        ? { mode: lastLIRow.event_key.split(':')[1], at: lastLIRow.posted_at }
        : null,
      last_worker_run:   null,
      expected_by_now:   0,
      actual_by_now:     todayPosted.length,
      health,
    },
    week: {
      success_rate:           successRate,
      failures_by_error_code: failuresByErrorCode,
      failures_by_platform:   failuresByPlatform,
      avg_delay_seconds:      null,
    },
    env: {
      buffer_x_configured:        !!process.env.BUFFER_API_KEY && !!process.env.BUFFER_CHANNEL_ID,
      buffer_linkedin_configured:  !!process.env.LINKEDIN_CHANNEL_ID,
      supabase_configured:         !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      resend_configured:           !!process.env.RESEND_API_KEY,
    },
  })
}
