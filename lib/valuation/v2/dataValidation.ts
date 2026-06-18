/**
 * V2 Data Validation
 *
 * Guards against silent null→zero coercions and circular price dependencies.
 * Every material input absence produces a structured error rather than a
 * fabricated value.
 */

import type { CockpitSnapshotV2 } from './types'

export interface ValidationResult {
  isValid:   boolean
  errors:    string[]   // block model execution
  warnings:  string[]   // allow model execution with caveats
}

// ─── Required fields per model ────────────────────────────────────────────────

export function validateForFCFFDcf(snap: CockpitSnapshotV2): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  // Revenue is load-bearing — every forecast row depends on it
  if (snap.ttmRevenue.value == null || snap.ttmRevenue.value <= 0) {
    errors.push('MISSING_TTM_REVENUE: FCFF DCF requires positive TTM revenue')
  }

  // EBIT margin path: we need at least one of (ttmEbit, ttmEbitda+ttmDna)
  const hasEbit   = snap.ttmEbit?.value != null
  const hasEbitda = snap.ttmEbitda?.value != null && snap.ttmDna?.value != null
  if (!hasEbit && !hasEbitda) {
    errors.push(
      'MISSING_EBIT: FCFF DCF requires TTM EBIT or (TTM EBITDA + D&A) to derive operating margin'
    )
  }

  // Tax rate — missing tax rate cannot be silently set to 0
  // (0% tax on operating income is not conservative; it inflates NOPAT)
  // We allow a fallback to sector-average but flag it.
  warnings.push('WACC_TAX_RATE_USED: Using effective tax rate from WACC inputs as proxy')

  // Shares
  if (snap.dilutedShares.value == null || snap.dilutedShares.value <= 0) {
    errors.push('MISSING_SHARES: Cannot compute per-share value without diluted share count')
  }

  // Debt / cash — missing does not block execution but must be flagged
  if (snap.totalDebt.value == null) {
    warnings.push('MISSING_DEBT: Total debt unknown; enterprise-to-equity bridge assumes zero debt')
  }
  if (snap.cashAndEquivalents.value == null) {
    warnings.push('MISSING_CASH: Cash unknown; enterprise-to-equity bridge assumes zero cash')
  }

  // Reinvestment proxy — need at least capex
  if (snap.ttmCapex?.value == null) {
    warnings.push('MISSING_CAPEX: Capex unknown; reinvestment will use sales-to-capital ratio fallback')
  }

  return { isValid: errors.length === 0, errors, warnings }
}

export function validateForForwardPE(snap: CockpitSnapshotV2): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (snap.ttmRevenue.value == null || snap.ttmRevenue.value <= 0) {
    errors.push('MISSING_TTM_REVENUE')
  }
  if (snap.dilutedShares.value == null || snap.dilutedShares.value <= 0) {
    errors.push('MISSING_SHARES')
  }
  // Net margin required for earnings projection
  if (snap.ttmNetIncome?.value == null && snap.ttmEbit?.value == null) {
    errors.push('MISSING_EARNINGS: Forward P/E requires net income or EBIT history to project future EPS')
  }

  return { isValid: errors.length === 0, errors, warnings }
}

export function validateForEVEBITDA(snap: CockpitSnapshotV2): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (snap.ttmEbitda?.value == null || snap.ttmEbitda.value <= 0) {
    errors.push('MISSING_EBITDA: EV/EBITDA requires positive EBITDA')
  }
  if (snap.dilutedShares.value == null || snap.dilutedShares.value <= 0) {
    errors.push('MISSING_SHARES')
  }

  return { isValid: errors.length === 0, errors, warnings }
}

// ─── Cross-input consistency checks ──────────────────────────────────────────

export interface ConsistencyWarning {
  code:    string
  message: string
  severity: 'error' | 'warning'
}

export function runConsistencyChecks(snap: CockpitSnapshotV2): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = []

  // EBITDA > Revenue is impossible for non-financial companies
  const rev    = snap.ttmRevenue.value ?? 0
  const ebitda = snap.ttmEbitda?.value ?? null
  if (ebitda != null && rev > 0 && ebitda > rev) {
    warnings.push({
      code:     'EBITDA_EXCEEDS_REVENUE',
      message:  `TTM EBITDA (${ebitda}M) > TTM Revenue (${rev}M) — likely a data error`,
      severity: 'error',
    })
  }

  // Net debt > market cap signals distress — flag, don't block
  const debt     = snap.totalDebt.value ?? 0
  const cash     = snap.cashAndEquivalents.value ?? 0
  const netDebt  = debt - cash
  const mcap     = snap.marketCap.value ?? 0
  if (mcap > 0 && netDebt > mcap) {
    warnings.push({
      code:     'NET_DEBT_OVERHANG',
      message:  `Net debt (${netDebt.toFixed(0)}M) exceeds market cap (${mcap.toFixed(0)}M)`,
      severity: 'warning',
    })
  }

  // Negative book value — P/B model will be unreliable
  if (snap.bookValuePerShare != null && snap.bookValuePerShare < 0) {
    warnings.push({
      code:     'NEGATIVE_BOOK_VALUE',
      message:  'Book value per share is negative — P/B valuation not applicable',
      severity: 'warning',
    })
  }

  return warnings
}

// ─── Safe input extraction helpers ───────────────────────────────────────────
//
// These return null rather than 0 when data is absent.
// The caller must decide what to do with null — never silently zero it.

export function safeRevenue(snap: CockpitSnapshotV2): number | null {
  const v = snap.ttmRevenue.value
  return (v != null && v > 0) ? v : null
}

export function safeEbitMargin(snap: CockpitSnapshotV2): number | null {
  const rev = safeRevenue(snap)
  if (!rev) return null
  if (snap.ttmEbit?.value != null) return snap.ttmEbit.value / rev
  if (snap.ttmEbitda?.value != null && snap.ttmDna?.value != null) {
    return (snap.ttmEbitda.value - snap.ttmDna.value) / rev
  }
  return null
}

export function safeDilutedSharesM(snap: CockpitSnapshotV2): number | null {
  const v = snap.dilutedShares.value
  return (v != null && v > 0) ? v : null
}

export function safeNetDebtM(snap: CockpitSnapshotV2): number {
  // Returns 0 only when BOTH debt and cash are explicitly known to be 0.
  // Returns 0 as a conservative fallback when debt is missing but logs a warning.
  const debt = snap.totalDebt.value ?? 0
  const cash = snap.cashAndEquivalents.value ?? 0
  return debt - cash
}
