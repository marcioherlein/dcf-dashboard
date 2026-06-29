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

export async function GET(req: NextRequest) {
  // Auth: admin session or CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const session = await getServerSession(authOptions)
    if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const now = new Date()
  const todayUTC = now.toISOString().split('T')[0]
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

  // Today's events
  const { data: todayEvents } = await sb
    .from('posted_tweet_events')
    .select('event_key, tweet_type, posted_at, tweet_text')
    .gte('posted_at', `${todayUTC}T00:00:00Z`)
    .order('posted_at', { ascending: false })

  // Last 7 days events
  const { data: weekEvents } = await sb
    .from('posted_tweet_events')
    .select('event_key, tweet_type, posted_at')
    .gte('posted_at', `${sevenDaysAgo}T00:00:00Z`)
    .order('posted_at', { ascending: false })

  const todayRows = todayEvents ?? []
  const weekRows  = weekEvents  ?? []

  // Parse today
  const todayPosted  = todayRows.filter(e => !e.event_key.endsWith(':failed'))
  const todayFailed  = todayRows.filter(e => e.event_key.endsWith(':failed'))

  const lastXPost = todayPosted.find(e => {
    const mode = e.event_key.split(':')[1]
    return mode && !mode.startsWith('li_')
  })
  const lastLIPost = todayPosted.find(e => {
    const mode = e.event_key.split(':')[1]
    return mode?.startsWith('li_')
  })

  // Week stats
  const weekPosted = weekRows.filter(e => !e.event_key.endsWith(':failed'))
  const weekFailed = weekRows.filter(e => e.event_key.endsWith(':failed'))

  // Platform breakdown
  const xPostsToday  = todayPosted.filter(e => !e.event_key.split(':')[1]?.startsWith('li_')).length
  const liPostsToday = todayPosted.filter(e => e.event_key.split(':')[1]?.startsWith('li_')).length

  // Failures with error messages
  const failureDetails = todayFailed.map(e => ({
    mode: e.event_key.split(':')[1],
    error: e.tweet_text ?? 'unknown',
    at: e.posted_at,
  }))

  // Stuck jobs: posted_tweet_events doesn't have running state, but check if
  // any mode has been running for >30 min (not directly trackable without post_queue)
  // This is a best-effort check using the absence of a success within expected window
  const successRate7d = weekRows.length > 0
    ? Math.round((weekPosted.length / weekRows.length) * 100)
    : 0

  return NextResponse.json({
    status: todayFailed.length === 0 ? 'healthy' : 'degraded',
    asOf: now.toISOString(),
    today: {
      date: todayUTC,
      total: todayPosted.length,
      x: xPostsToday,
      linkedin: liPostsToday,
      failed: todayFailed.length,
      lastX: lastXPost ? {
        mode: lastXPost.event_key.split(':')[1],
        at: lastXPost.posted_at,
      } : null,
      lastLinkedIn: lastLIPost ? {
        mode: lastLIPost.event_key.split(':')[1],
        at: lastLIPost.posted_at,
      } : null,
      failures: failureDetails,
    },
    week: {
      successRate: `${successRate7d}%`,
      totalPosted: weekPosted.length,
      totalFailed: weekFailed.length,
      failuresByMode: weekFailed.reduce((acc: Record<string, number>, e) => {
        const mode = e.event_key.split(':')[1] ?? 'unknown'
        acc[mode] = (acc[mode] ?? 0) + 1
        return acc
      }, {}),
    },
    env: {
      bufferConfigured:    !!process.env.BUFFER_API_KEY && !!process.env.BUFFER_CHANNEL_ID,
      linkedinConfigured:  !!process.env.LINKEDIN_CHANNEL_ID,
      supabaseConfigured:  !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  })
}
