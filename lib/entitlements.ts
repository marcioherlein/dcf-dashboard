import { createClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro'

export interface UserEntitlement {
  userId: string
  email: string
  plan: Plan
  source: 'db'
}

export type EntitlementErrorCode =
  | 'UNAUTHORIZED'
  | 'USER_NOT_FOUND'
  | 'DB_UNAVAILABLE'
  | 'ENTITLEMENT_CHECK_FAILED'

export type EntitlementResult =
  | ({ ok: true } & UserEntitlement)
  | { ok: false; code: EntitlementErrorCode; detail?: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Single authoritative entitlement lookup for all server routes.
 * Always reads from DB — never trusts session.user.plan (can be stale).
 * Normalizes email to lowercase/trim before lookup.
 */
export async function getUserEntitlement(
  email: string | null | undefined,
): Promise<EntitlementResult> {
  if (!email?.trim()) {
    return { ok: false, code: 'UNAUTHORIZED' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const sb = getServiceClient()

  if (!sb) {
    console.error('[entitlements] DB client unavailable — missing env vars')
    return { ok: false, code: 'DB_UNAVAILABLE' }
  }

  try {
    const { data, error } = await sb
      .from('users')
      .select('id, plan')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (error) {
      console.error('[entitlements] DB error for', normalizedEmail, ':', error.message)
      return { ok: false, code: 'DB_UNAVAILABLE', detail: error.message }
    }

    if (!data) {
      console.warn('[entitlements] user not found:', normalizedEmail)
      return { ok: false, code: 'USER_NOT_FOUND', detail: normalizedEmail }
    }

    const plan: Plan = data.plan === 'pro' ? 'pro' : 'free'

    if (plan !== data.plan) {
      // Unexpected plan value — log for monitoring
      console.warn('[entitlements] unexpected plan value for', normalizedEmail, ':', data.plan, '→ treating as free')
    }

    return {
      ok: true,
      userId: data.id as string,
      email: normalizedEmail,
      plan,
      source: 'db',
    }
  } catch (err) {
    console.error('[entitlements] exception for', normalizedEmail, ':', err)
    return { ok: false, code: 'ENTITLEMENT_CHECK_FAILED', detail: String(err) }
  }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Returns true only if the DB explicitly confirms plan = 'pro'. Fails closed. */
export async function isProUser(email: string | null | undefined): Promise<boolean> {
  const result = await getUserEntitlement(email)
  return result.ok && result.plan === 'pro'
}

/** Returns UTC midnight of the first day of the current month — consistent across timezones. */
export function currentMonthStart(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}
