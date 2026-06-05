import { NextRequest, NextResponse } from 'next/server'

interface Bucket {
  tokens: number
  lastRefill: number
}

// In-memory store. On Vercel each lambda instance has its own map,
// so this is a best-effort limit rather than a hard global cap.
// It still prevents single-instance floods and accidental hammering.
const store = new Map<string, Bucket>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/**
 * Token-bucket rate limiter.
 * @param req       incoming request
 * @param limit     max requests per window
 * @param windowMs  window duration in ms
 * @param key       optional extra key (e.g. route name) to namespace buckets
 * @returns NextResponse 429 if over limit, otherwise null (continue)
 */
export function rateLimit(
  req: NextRequest,
  limit: number,
  windowMs: number,
  key = '',
): NextResponse | null {
  const ip = getIp(req)
  const bucketKey = `${key}:${ip}`
  const now = Date.now()

  let bucket = store.get(bucketKey)
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now }
    store.set(bucketKey, bucket)
  }

  // Refill tokens proportionally to elapsed time
  const elapsed = now - bucket.lastRefill
  const refill = Math.floor((elapsed / windowMs) * limit)
  if (refill > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + refill)
    bucket.lastRefill = now
  }

  if (bucket.tokens <= 0) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } },
    )
  }

  bucket.tokens -= 1
  return null
}
