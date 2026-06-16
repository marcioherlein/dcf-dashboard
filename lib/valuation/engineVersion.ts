/**
 * Valuation Engine Version Feature Flag
 *
 * Controls which valuation engine version is used for computing CockpitOutput.
 *
 * SAFETY RULES:
 * - Default is always 'v1' unless VALUATION_ENGINE_VERSION env var is explicitly set.
 * - V2 is only active in local development and staging unless explicitly overridden.
 * - Kill switch: set VALUATION_ENGINE_VERSION=v1 to immediately revert to V1.
 * - Never switches users to V2 automatically.
 *
 * Rollout stages:
 *   Stage 1: tests only (VALUATION_ENGINE_VERSION=v2 in test env)
 *   Stage 2: local development (set in .env.local)
 *   Stage 3: staging environment
 *   Stage 4: shadow mode (V1 shown, V2 calculated in parallel)
 *   Stage 5: opt-in user toggle (not yet implemented)
 *   Stage 6: small production cohort
 *   Stage 7: V2 default, V1 fallback
 *   Stage 8: V1 retired
 */

export type ValuationEngineVersion = 'v1' | 'v2'

export interface ValuationEngineOptions {
  /** Which engine version to use. Overrides environment/config defaults. */
  version?: ValuationEngineVersion
  /** If true, also run V2 in parallel for shadow comparison (never shown to user). */
  shadowMode?: boolean
}

/**
 * Returns the configured engine version.
 * Priority: explicit options.version > env var > hardcoded default ('v1').
 */
export function getConfiguredValuationEngineVersion(): ValuationEngineVersion {
  // Environment variable kill switch — accepts 'v1' or 'v2'
  const envVar = (
    typeof process !== 'undefined'
      ? process.env.VALUATION_ENGINE_VERSION
      : undefined
  )?.toLowerCase()

  if (envVar === 'v2') return 'v2'
  // Any other value (including 'v1', undefined, or empty) returns v1.
  // This makes v1 the safe default — a misconfigured env var cannot accidentally enable v2.
  return 'v1'
}

/**
 * Returns true if shadow mode is enabled — V2 should be calculated in parallel
 * for comparison purposes but its output should NOT be shown to users.
 */
export function isShadowModeEnabled(): boolean {
  if (typeof process === 'undefined') return false
  return process.env.VALUATION_SHADOW_MODE === 'true'
}

/**
 * Returns true if V2 is active (either directly selected or shadowing).
 */
export function isV2Active(options?: ValuationEngineOptions): boolean {
  const version = options?.version ?? getConfiguredValuationEngineVersion()
  return version === 'v2'
}
