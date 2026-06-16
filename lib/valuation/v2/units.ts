/**
 * V2 Unit Safety Helpers
 *
 * Centralises all raw↔millions conversions so that scattered `/ 1_000_000`
 * calls cannot silently mix units.
 */

import type { RawDollars, Millions, Percentage, PerShare } from './types'

// ─── Constructors (cast helpers) ──────────────────────────────────────────────

export function rawDollars(n: number): RawDollars {
  return n as RawDollars
}

export function millions(n: number): Millions {
  return n as Millions
}

export function percentage(n: number): Percentage {
  return n as Percentage
}

export function perShare(n: number): PerShare {
  return n as PerShare
}

// ─── Conversions ──────────────────────────────────────────────────────────────

/** Convert raw dollar amount to millions. */
export function toMillions(raw: RawDollars): Millions {
  return (raw / 1_000_000) as Millions
}

/** Convert millions to raw dollars. */
export function toRaw(m: Millions): RawDollars {
  return (m * 1_000_000) as RawDollars
}

/** Convert per-share value to equity value (millions) given shares in millions. */
export function perShareToMillions(ps: PerShare, sharesM: Millions): Millions {
  return (ps * sharesM) as Millions
}

/** Convert equity value (millions) to per-share value given shares in millions. */
export function millionsToPerShare(equityM: Millions, sharesM: Millions): PerShare {
  if (sharesM <= 0) throw new Error('sharesM must be positive')
  return (equityM / sharesM) as PerShare
}

// ─── Null-safe versions ───────────────────────────────────────────────────────

export function nullableToMillions(raw: number | null | undefined): Millions | null {
  if (raw == null || !isFinite(raw)) return null
  return toMillions(raw as RawDollars)
}

export function nullableMillionsToPerShare(
  equityM: Millions | null,
  sharesM: Millions | null,
): PerShare | null {
  if (equityM == null || sharesM == null || sharesM <= 0) return null
  return millionsToPerShare(equityM, sharesM)
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Assert that a value claimed to be in millions is plausible.
 * Catches the classic ADR / unit bug where shares are passed as raw units
 * instead of millions, producing a fair value 1000× too low.
 */
export function assertReasonableSharesM(sharesM: number, companyName?: string): void {
  // Very few companies have > 1 trillion shares outstanding even in millions.
  // If sharesM > 1_000_000 it is almost certainly in raw units, not millions.
  if (sharesM > 1_000_000) {
    throw new Error(
      `sharesM=${sharesM} appears to be in raw units, not millions` +
      (companyName ? ` for ${companyName}` : '') +
      '. Divide by 1_000_000 before passing to the engine.',
    )
  }
  // A company with < 0.001M diluted shares outstanding is also suspicious.
  if (sharesM > 0 && sharesM < 0.001) {
    throw new Error(
      `sharesM=${sharesM} is implausibly small` +
      (companyName ? ` for ${companyName}` : '') +
      '. Verify units.',
    )
  }
}
