/**
 * GET /api/admin/posting-selftest
 *
 * Read-only self-test that validates the entire posting system without
 * publishing anything. Intended as an interactive debugging tool for admins.
 * All checks are safe to run at any time.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { BufferAdapter, getBufferConfig } from '@/lib/posting/buffer-adapter'

// ─── Auth ──────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marciofabrizio@gmail.com')
  .split(',')
  .map((e) => e.trim())

// ─── Types ─────────────────────────────────────────────────────────────────────

type Status = 'pass' | 'fail' | 'warn' | 'skip'

interface CheckResult {
  status: Status
  message: string
  details?: string
}

interface NextScheduledPost {
  mode: string
  platform: string
  scheduledFor: string
}

interface SelfTestResponse {
  timestamp: string
  overall: 'pass' | 'fail' | 'degraded'
  checks: {
    envVars: CheckResult
    supabaseConnection: CheckResult
    postQueueTableExists: CheckResult
    bufferXConnection: CheckResult
    bufferLinkedInConnection: CheckResult
    resendConnection: CheckResult
    stuckJobs: CheckResult
    todayQueueExists: CheckResult
    nextScheduledPost: NextScheduledPost | null
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pass(message: string, details?: string): CheckResult {
  return { status: 'pass', message, ...(details ? { details } : {}) }
}

function fail(message: string, details?: string): CheckResult {
  return { status: 'fail', message, ...(details ? { details } : {}) }
}

function warn(message: string, details?: string): CheckResult {
  return { status: 'warn', message, ...(details ? { details } : {}) }
}

function skip(message: string): CheckResult {
  return { status: 'skip', message }
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function todayRange(): { start: string; end: string } {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  return {
    start: `${dateStr}T00:00:00.000Z`,
    end: `${dateStr}T23:59:59.999Z`,
  }
}

// ─── Individual checks ─────────────────────────────────────────────────────────

function checkEnvVars(): CheckResult {
  const required = [
    'BUFFER_API_KEY',
    'BUFFER_CHANNEL_ID',
    'LINKEDIN_CHANNEL_ID',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length === 0) {
    return pass(`All ${required.length} required env vars are set`)
  }

  return fail(
    `${missing.length} env var(s) missing`,
    `Missing: ${missing.join(', ')}`
  )
}

async function checkSupabaseConnection(): Promise<CheckResult> {
  const sb = getServiceClient()
  if (!sb) {
    return fail('Supabase client could not be created — check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  try {
    const { error } = await sb.rpc('pg_sleep', { seconds: 0 }).maybeSingle()
    // pg_sleep may not be exposed via rpc; fall back to a simple table query
    if (error && error.message.includes('not exist')) {
      // Try a direct query instead
      const { error: e2 } = await sb
        .from('post_queue')
        .select('id')
        .limit(0)
      if (e2 && !e2.message.includes('does not exist')) {
        return fail('Supabase query failed', e2.message)
      }
    } else if (error) {
      return fail('Supabase query failed', error.message)
    }
    return pass('Supabase connection is healthy')
  } catch (err: unknown) {
    return fail('Supabase connection threw', err instanceof Error ? err.message : String(err))
  }
}

async function checkPostQueueTable(): Promise<CheckResult> {
  const sb = getServiceClient()
  if (!sb) return skip('Supabase not configured')

  try {
    const { count, error } = await sb
      .from('post_queue')
      .select('*', { count: 'exact', head: true })
      .limit(1)

    if (error) {
      return fail('post_queue table query failed', error.message)
    }

    return pass(`post_queue table exists (${count ?? 0} total row(s))`)
  } catch (err: unknown) {
    return fail('post_queue check threw', err instanceof Error ? err.message : String(err))
  }
}

async function checkBufferConnection(platform: 'x' | 'linkedin'): Promise<CheckResult> {
  const config = getBufferConfig(platform)
  if (!config) {
    const envKey = platform === 'x' ? 'BUFFER_CHANNEL_ID_X' : 'BUFFER_CHANNEL_ID_LINKEDIN'
    return skip(`${envKey} or BUFFER_API_KEY not set`)
  }

  try {
    const adapter = new BufferAdapter(config)
    const result = await adapter.validateConnection()
    if (result.valid) {
      return pass(`Buffer ${platform.toUpperCase()} channel is reachable`)
    }
    return fail(`Buffer ${platform.toUpperCase()} connection failed`, result.error)
  } catch (err: unknown) {
    return fail(`Buffer ${platform.toUpperCase()} check threw`, err instanceof Error ? err.message : String(err))
  }
}

async function checkResendConnection(): Promise<CheckResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return skip('RESEND_API_KEY not set')

  try {
    const res = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (res.status === 401) {
      return fail('Resend API key is invalid or unauthorised')
    }

    if (res.status === 429) {
      return warn('Resend is reachable but rate-limited', `HTTP ${res.status}`)
    }

    if (!res.ok) {
      return fail('Resend domains endpoint returned an error', `HTTP ${res.status}`)
    }

    return pass('Resend API is reachable and key is valid')
  } catch (err: unknown) {
    return fail('Resend connection check threw', err instanceof Error ? err.message : String(err))
  }
}

async function checkStuckJobs(): Promise<CheckResult> {
  const sb = getServiceClient()
  if (!sb) return skip('Supabase not configured')

  try {
    const { count, error } = await sb
      .from('stuck_jobs')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return fail('stuck_jobs view query failed', error.message)
    }

    const n = count ?? 0
    if (n === 0) {
      return pass('No stuck jobs found')
    }
    return warn(`${n} stuck job(s) detected`, 'Jobs in running state for >30 minutes')
  } catch (err: unknown) {
    return fail('Stuck jobs check threw', err instanceof Error ? err.message : String(err))
  }
}

async function checkTodayQueue(): Promise<CheckResult> {
  const sb = getServiceClient()
  if (!sb) return skip('Supabase not configured')

  const { start, end } = todayRange()

  try {
    const { count, error } = await sb
      .from('post_queue')
      .select('*', { count: 'exact', head: true })
      .gte('scheduled_for', start)
      .lte('scheduled_for', end)

    if (error) {
      return fail('Today queue query failed', error.message)
    }

    const n = count ?? 0
    if (n > 0) {
      return pass(`${n} post(s) queued for today`)
    }
    return warn('No posts queued for today', 'Queue may not have been seeded for this week')
  } catch (err: unknown) {
    return fail('Today queue check threw', err instanceof Error ? err.message : String(err))
  }
}

async function getNextScheduledPost(): Promise<NextScheduledPost | null> {
  const sb = getServiceClient()
  if (!sb) return null

  try {
    const { data, error } = await sb
      .from('post_queue')
      .select('mode, platform, scheduled_for')
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    return {
      mode: data.mode,
      platform: data.platform,
      scheduledFor: data.scheduled_for,
    }
  } catch {
    return null
  }
}

// ─── Overall status derivation ─────────────────────────────────────────────────

function deriveOverall(
  checks: Omit<SelfTestResponse['checks'], 'nextScheduledPost'>
): 'pass' | 'fail' | 'degraded' {
  const values = Object.values(checks) as CheckResult[]
  const statuses = values.map((c) => c.status)

  if (statuses.includes('fail')) {
    // A single failing critical check makes the whole thing fail
    const criticalFails = ['envVars', 'supabaseConnection', 'postQueueTableExists']
    const criticalKeys = criticalFails as Array<keyof typeof checks>
    const hasCriticalFail = criticalKeys.some(
      (key) => checks[key].status === 'fail'
    )
    return hasCriticalFail ? 'fail' : 'degraded'
  }

  if (statuses.includes('warn')) return 'degraded'
  return 'pass'
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [
    envVars,
    supabaseConnection,
    postQueueTableExists,
    bufferXConnection,
    bufferLinkedInConnection,
    resendConnection,
    stuckJobs,
    todayQueueExists,
    nextScheduledPost,
  ] = await Promise.all([
    Promise.resolve(checkEnvVars()),
    checkSupabaseConnection(),
    checkPostQueueTable(),
    checkBufferConnection('x'),
    checkBufferConnection('linkedin'),
    checkResendConnection(),
    checkStuckJobs(),
    checkTodayQueue(),
    getNextScheduledPost(),
  ])

  const checksWithoutNext = {
    envVars,
    supabaseConnection,
    postQueueTableExists,
    bufferXConnection,
    bufferLinkedInConnection,
    resendConnection,
    stuckJobs,
    todayQueueExists,
  }

  const overall = deriveOverall(checksWithoutNext)

  const body: SelfTestResponse = {
    timestamp: new Date().toISOString(),
    overall,
    checks: {
      ...checksWithoutNext,
      nextScheduledPost,
    },
  }

  return NextResponse.json(body)
}
