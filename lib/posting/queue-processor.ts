/**
 * Queue Processor — processes the post_queue table and publishes due posts.
 *
 * Responsibilities:
 *  - Atomically claim due posts via claim_post RPC
 *  - Publish each post to Buffer (X or LinkedIn)
 *  - Mark posts as posted or failed via RPCs
 *  - Classify errors and decide retry eligibility
 *
 * Content generation stays in x-post.mjs. This module handles queue management only.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PostQueueRow = {
  id: string
  platform: 'x' | 'linkedin'
  mode: string
  ticker?: string
  scheduled_for: string
  status: string
  content?: string
  attempts: number
  max_attempts: number
  next_attempt_at?: string
  last_attempt_at?: string
  posted_at?: string
  provider: string
  provider_post_id?: string
  provider_response?: Record<string, unknown>
  error_code?: string
  error_message?: string
  idempotency_key: string
}

export type ProcessResult = {
  processed: number
  posted: number
  failed: number
  skipped: number
  errors: Array<{ id: string; mode: string; platform: string; error: string }>
}

// ─── Internal types ───────────────────────────────────────────────────────────

type PublishSuccess = {
  success: true
  postId: string
}

type ErrorCode =
  | 'AUTH_FAILED'
  | 'CONFIG_MISSING'
  | 'CONTENT_INVALID'
  | 'DUPLICATE'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'NETWORK_TIMEOUT'
  | 'UNKNOWN'

type ClassifiedError = {
  code: ErrorCode
  message: string
  retryable: boolean
  /** Backoff in minutes before the next attempt. 0 = no retry. */
  backoffMinutes: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BUFFER_API_URL = 'https://api.buffer.com'
/** Maximum posts to claim per processQueue() invocation. */
const DEFAULT_BATCH_SIZE = 10
/** How far back to look for missed posts (in hours). */
const CATCHUP_WINDOW_HOURS = 4
/** Fetch timeout for Buffer API calls (ms). */
const BUFFER_FETCH_TIMEOUT_MS = 20_000
/** X / Twitter hard character limit. */
const X_MAX_CHARS = 280

// ─── Supabase client ──────────────────────────────────────────────────────────

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new ConfigError('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(url, key)
}

// ─── Custom errors ────────────────────────────────────────────────────────────

class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

class ContentInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentInvalidError'
  }
}

// ─── Error classifier ─────────────────────────────────────────────────────────

/**
 * Classify any thrown error into a structured ClassifiedError with retry
 * semantics and a canonical error_code for the database.
 */
function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err)
  const lc = message.toLowerCase()

  // Config / env var missing
  if (
    err instanceof ConfigError ||
    lc.includes('not set') ||
    lc.includes('not configured') ||
    lc.includes('missing env')
  ) {
    return { code: 'CONFIG_MISSING', message, retryable: false, backoffMinutes: 0 }
  }

  // Content validation failure
  if (
    err instanceof ContentInvalidError ||
    lc.includes('too long') ||
    lc.includes('exceeds') ||
    lc.includes('content_invalid') ||
    lc.includes('invalid input')
  ) {
    return { code: 'CONTENT_INVALID', message, retryable: false, backoffMinutes: 0 }
  }

  // Buffer duplicate / already scheduled
  if (lc.includes('already got this one scheduled') || lc.includes('duplicate')) {
    return { code: 'DUPLICATE', message, retryable: false, backoffMinutes: 0 }
  }

  // Auth failure
  if (
    lc.includes('unauthorized') ||
    lc.includes('403') ||
    lc.includes('401') ||
    lc.includes('auth_failed') ||
    lc.includes('forbidden')
  ) {
    return { code: 'AUTH_FAILED', message, retryable: false, backoffMinutes: 0 }
  }

  // Rate limit
  if (lc.includes('429') || lc.includes('rate limit') || lc.includes('limitreached')) {
    return { code: 'RATE_LIMIT', message, retryable: true, backoffMinutes: 60 }
  }

  // Server error (5xx)
  if (lc.includes('500') || lc.includes('502') || lc.includes('503') || lc.includes('504') || lc.includes('server error')) {
    return { code: 'SERVER_ERROR', message, retryable: true, backoffMinutes: 5 }
  }

  // Network / timeout
  if (
    lc.includes('timeout') ||
    lc.includes('econnrefused') ||
    lc.includes('enotfound') ||
    lc.includes('network') ||
    lc.includes('fetch failed') ||
    lc.includes('aborted')
  ) {
    return { code: 'NETWORK_TIMEOUT', message, retryable: true, backoffMinutes: 5 }
  }

  // Default: unknown, retry with short backoff
  return { code: 'UNKNOWN', message, retryable: true, backoffMinutes: 5 }
}

// ─── Content generation ───────────────────────────────────────────────────────

/**
 * generateContent is a no-op in this module.
 *
 * Content generation lives in x-post.mjs. When a post_queue row has content
 * already set the publisher uses it as-is. When content is null the row is
 * skipped (the queue inserter should always pre-populate content or the
 * x-post.mjs pipeline handles generation before enqueueing).
 */
async function generateContent(
  _mode: string,
  _ticker: string | undefined,
  _platform: 'x' | 'linkedin',
): Promise<string | null> {
  // Content generation intentionally delegated to x-post.mjs.
  return null
}

// ─── Buffer publisher ─────────────────────────────────────────────────────────

/**
 * Build the channel-specific Buffer GraphQL mutation.
 */
function buildMutation(channelId: string, text: string): string {
  return `mutation {
    createPost(input: {
      channelId: ${JSON.stringify(channelId)}
      text: ${JSON.stringify(text)}
      schedulingType: automatic
      mode: shareNow
    }) {
      ... on PostActionSuccess { post { id status } }
      ... on InvalidInputError { message }
      ... on UnauthorizedError { message }
      ... on LimitReachedError { message }
      ... on RestProxyError    { message code }
      ... on UnexpectedError   { message }
    }
  }`
}

/**
 * Validate content length before sending to Buffer.
 * Throws ContentInvalidError so it is classified as non-retryable.
 */
function validateContent(text: string, platform: 'x' | 'linkedin'): void {
  if (!text || text.trim().length === 0) {
    throw new ContentInvalidError('Post content is empty')
  }
  if (platform === 'x' && text.length > X_MAX_CHARS) {
    throw new ContentInvalidError(
      `X post exceeds ${X_MAX_CHARS} chars (${text.length}). Shorten the content.`,
    )
  }
}

/**
 * Call Buffer's GraphQL API with an AbortController timeout.
 * Returns the raw parsed JSON body or throws on network / HTTP error.
 */
async function callBufferApi(
  apiKey: string,
  query: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BUFFER_FETCH_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(BUFFER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    // Wrap abort as a timeout message so the classifier picks it up
    const msg = err instanceof Error && err.name === 'AbortError'
      ? 'Request timeout after 20s'
      : (err instanceof Error ? err.message : String(err))
    throw new Error(`Network error calling Buffer API: ${msg}`)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Buffer API returned ${res.status} Unauthorized`)
  }
  if (res.status === 429) {
    throw new Error(`Buffer API returned 429 rate limit`)
  }
  if (res.status >= 500) {
    throw new Error(`Buffer API returned ${res.status} server error`)
  }

  const body = (await res.json()) as Record<string, unknown>
  return body
}

/**
 * Publish a single post to Buffer.
 * Resolves with { success: true, postId } or throws a classified-friendly Error.
 */
export async function publishPost(
  row: PostQueueRow,
  contentOverride?: string,
): Promise<PublishSuccess> {
  const apiKey = process.env.BUFFER_API_KEY
  if (!apiKey) {
    throw new ConfigError('BUFFER_API_KEY is not set')
  }

  const channelId = row.platform === 'x'
    ? process.env.BUFFER_CHANNEL_ID
    : process.env.LINKEDIN_CHANNEL_ID

  if (!channelId) {
    throw new ConfigError(
      `${row.platform === 'x' ? 'BUFFER_CHANNEL_ID' : 'LINKEDIN_CHANNEL_ID'} is not set`,
    )
  }

  const text = contentOverride ?? row.content
  if (!text) {
    throw new ContentInvalidError('No content available for post — row.content is null')
  }

  validateContent(text, row.platform)

  const query = buildMutation(channelId, text)
  const body = await callBufferApi(apiKey, query)

  const result = (body as { data?: { createPost?: Record<string, unknown> } })
    ?.data?.createPost as Record<string, unknown> | undefined

  // Success
  if (
    result &&
    typeof result.post === 'object' &&
    result.post !== null
  ) {
    const p = result.post as { id?: string; status?: string }
    if (p.status === 'sent' || p.status === 'buffer') {
      return { success: true, postId: p.id ?? '' }
    }
  }

  // Known non-success responses from Buffer's union type
  const errorMessage: string = (result?.message as string | undefined) ?? JSON.stringify(body)

  if (errorMessage.includes('already got this one scheduled')) {
    // Treat as success — idempotent duplicate
    throw new Error(`duplicate: ${errorMessage}`)
  }

  if (
    errorMessage.toLowerCase().includes('unauthorized') ||
    typeof result?.code === 'string'
  ) {
    throw new Error(`Buffer returned error: ${errorMessage}`)
  }

  throw new Error(`Buffer post failed: ${errorMessage}`)
}

// ─── Supabase RPC wrappers ────────────────────────────────────────────────────

/**
 * Atomically claim up to `batchSize` due posts via the claim_post RPC.
 *
 * Due criteria (handled server-side by the RPC):
 *   - status IN ('scheduled','queued') AND scheduled_for <= now()
 *   - OR status = 'failed' AND next_attempt_at <= now() AND attempts < max_attempts
 *   - AND scheduled_for >= now() - CATCHUP_WINDOW_HOURS (miss recovery window)
 */
async function claimDuePosts(
  supabase: SupabaseClient,
  batchSize: number,
): Promise<PostQueueRow[]> {
  const { data, error } = await supabase.rpc('claim_post', {
    batch_size: batchSize,
    catchup_hours: CATCHUP_WINDOW_HOURS,
  })

  if (error) {
    throw new Error(`claim_post RPC failed: ${error.message}`)
  }

  return (data as PostQueueRow[]) ?? []
}

/**
 * Mark a post as successfully published.
 */
async function markPosted(
  supabase: SupabaseClient,
  id: string,
  providerPostId: string,
  providerResponse: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc('mark_posted', {
    post_id: id,
    p_provider_post_id: providerPostId,
    p_provider_response: providerResponse,
  })
  if (error) {
    // Log but don't rethrow — the post was actually published; losing the mark
    // is less catastrophic than surfacing it as a failure.
    console.error(`[queue-processor] mark_posted RPC failed for ${id}: ${error.message}`)
  }
}

/**
 * Mark a post as failed. Passes retry metadata so the RPC can schedule
 * the next attempt or move the row to a terminal failed state.
 */
async function markFailed(
  supabase: SupabaseClient,
  id: string,
  classified: ClassifiedError,
): Promise<void> {
  const nextAttemptAt = classified.retryable && classified.backoffMinutes > 0
    ? new Date(Date.now() + classified.backoffMinutes * 60 * 1000).toISOString()
    : null

  const { error } = await supabase.rpc('mark_failed', {
    post_id: id,
    p_error_code: classified.code,
    p_error_message: classified.message.slice(0, 2000), // guard against huge stack traces
    p_retryable: classified.retryable,
    p_next_attempt_at: nextAttemptAt,
  })
  if (error) {
    console.error(`[queue-processor] mark_failed RPC failed for ${id}: ${error.message}`)
  }
}

// ─── Single-post processor ────────────────────────────────────────────────────

type PostOutcome =
  | { status: 'posted'; id: string }
  | { status: 'skipped'; id: string; reason: string }
  | { status: 'failed'; id: string; mode: string; platform: string; error: string }

async function processOne(
  supabase: SupabaseClient,
  row: PostQueueRow,
): Promise<PostOutcome> {
  const tag = `[${row.id} ${row.platform} ${row.mode}]`

  // 1. Resolve content. generateContent is a no-op here; if content is null,
  //    skip rather than publish empty.
  let content = row.content ?? null
  if (!content) {
    const generated = await generateContent(row.mode, row.ticker, row.platform)
    if (!generated) {
      // No content and no generator — skip this row
      const reason = 'content is null and no generator available'
      console.warn(`[queue-processor] ${tag} skipping — ${reason}`)
      // Move out of claimed state so it doesn't sit in limbo
      await markFailed(supabase, row.id, {
        code: 'CONTENT_INVALID',
        message: reason,
        retryable: false,
        backoffMinutes: 0,
      })
      return { status: 'skipped', id: row.id, reason }
    }
    content = generated
  }

  // 2. Publish
  try {
    const result = await publishPost(row, content)
    console.log(`[queue-processor] ${tag} posted — provider_post_id=${result.postId}`)

    await markPosted(supabase, row.id, result.postId, {
      postId: result.postId,
      platform: row.platform,
      idempotency_key: row.idempotency_key,
      published_at: new Date().toISOString(),
    })

    return { status: 'posted', id: row.id }
  } catch (err) {
    const classified = classifyError(err)

    // "duplicate" is a special case — treat as success to avoid retry loops
    if (classified.code === 'DUPLICATE') {
      console.warn(`[queue-processor] ${tag} duplicate — treating as success`)
      await markPosted(supabase, row.id, 'duplicate', {
        duplicate: true,
        original_error: classified.message,
      })
      return { status: 'posted', id: row.id }
    }

    console.error(
      `[queue-processor] ${tag} failed — code=${classified.code} retryable=${classified.retryable}: ${classified.message}`,
    )
    await markFailed(supabase, row.id, classified)

    return {
      status: 'failed',
      id: row.id,
      mode: row.mode,
      platform: row.platform,
      error: `[${classified.code}] ${classified.message}`,
    }
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Process the post_queue table: claim up to `batchSize` due posts, publish
 * them in parallel, and return a ProcessResult summary.
 *
 * Safe to call from a cron job or API route; uses atomic claim_post RPC so
 * multiple concurrent invocations will not double-post.
 */
export async function processQueue(batchSize = DEFAULT_BATCH_SIZE): Promise<ProcessResult> {
  const supabase = getSupabase()

  // 1. Claim due posts atomically
  let rows: PostQueueRow[]
  try {
    rows = await claimDuePosts(supabase, batchSize)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[queue-processor] Failed to claim posts: ${msg}`)
    return { processed: 0, posted: 0, failed: 0, skipped: 0, errors: [] }
  }

  if (rows.length === 0) {
    return { processed: 0, posted: 0, failed: 0, skipped: 0, errors: [] }
  }

  console.log(`[queue-processor] Claimed ${rows.length} post(s) for processing`)

  // 2. Process all claimed posts in parallel
  const settled = await Promise.allSettled(
    rows.map((row) => processOne(supabase, row)),
  )

  // 3. Aggregate results
  const result: ProcessResult = {
    processed: rows.length,
    posted: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      // processOne should never reject — it catches internally — but be safe
      result.failed++
      result.errors.push({
        id: 'unknown',
        mode: 'unknown',
        platform: 'unknown',
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      })
      continue
    }

    const val = outcome.value
    if (val.status === 'posted') {
      result.posted++
    } else if (val.status === 'skipped') {
      result.skipped++
    } else {
      result.failed++
      result.errors.push({
        id: val.id,
        mode: val.mode,
        platform: val.platform,
        error: val.error,
      })
    }
  }

  console.log(
    `[queue-processor] Done — processed=${result.processed} posted=${result.posted} failed=${result.failed} skipped=${result.skipped}`,
  )

  return result
}
