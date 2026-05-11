/**
 * EV/EBITDA Exit Multiple Valuation
 *
 * Enterprise Value = TTM EBITDA × Exit Multiple
 * Equity Value    = EV − Net Debt
 * Fair Value/Share = Equity Value / Shares
 */

// ── Sector EV/EBITDA exit multiples ─────────────────────────────────────────

const SECTOR_EV_EBITDA: Record<string, number> = {
  'Technology':             20,
  'Communication Services': 15,
  'Consumer Cyclical':      12,
  'Consumer Defensive':     14,
  'Healthcare':             16,
  'Financial Services':     12,
  'Industrials':            12,
  'Basic Materials':        10,
  'Energy':                  8,
  'Utilities':              12,
  'Real Estate':            20,
}

export function getDefaultEVEBITDAMultiple(sector: string | null): number {
  return SECTOR_EV_EBITDA[sector ?? ''] ?? 13
}

// ── Input / Output types ─────────────────────────────────────────────────────

export interface EVEBITDAInputs {
  ttmEbitda: number | null
  netDebt: number | null        // totalDebt − cash (negative = net cash)
  shares: number | null
  exitMultiple: number          // EV/EBITDA multiple
  currentPrice: number
}

export interface EVEBITDAResult {
  enterpriseValue: number | null
  equityValue: number | null
  fairValuePerShare: number | null
  upsidePct: number | null
  guardErrors: string[]
}

// ── Engine ───────────────────────────────────────────────────────────────────

export function computeEVEBITDA(inputs: EVEBITDAInputs): EVEBITDAResult {
  const { ttmEbitda, netDebt, shares, exitMultiple, currentPrice } = inputs
  const errors: string[] = []

  if (ttmEbitda == null)    errors.push('TTM EBITDA is missing')
  if (shares == null)       errors.push('Shares outstanding is missing')
  if (exitMultiple <= 0)    errors.push('Exit multiple must be positive')
  if (ttmEbitda != null && ttmEbitda <= 0) errors.push('TTM EBITDA must be positive for this method')

  if (errors.length > 0 || ttmEbitda == null || shares == null || ttmEbitda <= 0) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null, upsidePct: null, guardErrors: errors }
  }

  const enterpriseValue = ttmEbitda * exitMultiple
  const equityValue     = enterpriseValue - (netDebt ?? 0)
  const fairValuePerShare = shares > 0 ? equityValue / shares : null

  if (fairValuePerShare == null || fairValuePerShare <= 0) {
    return { enterpriseValue, equityValue, fairValuePerShare: null, upsidePct: null, guardErrors: ['Implied fair value is non-positive'] }
  }

  const upsidePct = currentPrice > 0 ? (fairValuePerShare - currentPrice) / currentPrice : null

  return { enterpriseValue, equityValue, fairValuePerShare, upsidePct, guardErrors: [] }
}
