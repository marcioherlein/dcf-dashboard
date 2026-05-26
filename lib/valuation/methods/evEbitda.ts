/**
 * EV/EBITDA Exit Multiple Valuation
 *
 * Enterprise Value = TTM EBITDA × Exit Multiple
 * Equity Value    = EV − Net Debt
 * Fair Value/Share = Equity Value / Shares
 */

import { getIndustryMultiples } from '@/lib/dcf/calculateMultiples'

export function getDefaultEVEBITDAMultiple(sector: string | null, industry?: string | null): number {
  return getIndustryMultiples(industry ?? '', sector ?? '').evEbitda
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

  const warnings: string[] = []
  if (netDebt == null) warnings.push('Net debt unavailable — assumed 0 (equity value equals enterprise value)')

  if (errors.length > 0 || ttmEbitda == null || shares == null || ttmEbitda <= 0) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null, upsidePct: null, guardErrors: [...errors, ...warnings] }
  }

  const effectiveNetDebt = netDebt ?? 0
  const enterpriseValue = ttmEbitda * exitMultiple
  const equityValue     = enterpriseValue - effectiveNetDebt
  const fairValuePerShare = shares > 0 ? equityValue / shares : null

  if (fairValuePerShare == null || fairValuePerShare <= 0) {
    return { enterpriseValue, equityValue, fairValuePerShare: null, upsidePct: null, guardErrors: ['Implied fair value is non-positive'] }
  }

  const upsidePct = currentPrice > 0 ? (fairValuePerShare - currentPrice) / currentPrice : null

  return { enterpriseValue, equityValue, fairValuePerShare, upsidePct, guardErrors: warnings }
}
