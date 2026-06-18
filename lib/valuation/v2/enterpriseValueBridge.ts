/**
 * V2 Enterprise-to-Equity Bridge
 *
 * Corrects the V1 bridge which only used cashM and debtM.
 * V2 supports the full balance-sheet bridge with optional items.
 *
 * All inputs and outputs are in MILLIONS unless noted.
 *
 * Formula:
 *   Equity Value =
 *     Enterprise Value
 *     + Cash & Equivalents
 *     + Marketable Securities
 *     + Non-operating Investments
 *     + Associates Value
 *     − Total Debt
 *     − Lease Liabilities
 *     − Preferred Stock
 *     − Minority Interest
 *     − Pension Deficit
 *
 * Per-share = Equity Value / Diluted Shares (both in millions)
 */


export interface EnterpriseBridgeInputs {
  enterpriseValueM:         number

  // Assets (increase equity value)
  cashM:                    number        // always required; use 0 only if explicitly known to be 0
  marketableSecuritiesM?:   number | null
  nonOpInvestmentsM?:       number | null
  associatesValueM?:        number | null

  // Liabilities (reduce equity value)
  totalDebtM:               number        // always required; use 0 only if explicitly known to be 0
  leaseLiabilitiesM?:       number | null
  preferredStockM?:         number | null
  minorityInterestM?:       number | null
  pensionDeficitM?:         number | null

  // Shares
  dilutedSharesM:           number        // diluted shares in millions

  // Context
  currentPrice:             number
}

export interface EnterpriseBridgeResult {
  enterpriseValueM:   number
  equityValueM:       number | null
  fairValuePerShare:  number | null
  upsidePct:          number | null
  bridgeItems:        BridgeItem[]
  debtOverhang:       boolean
  warnings:           string[]
}

interface BridgeItem {
  label:    string
  valueM:   number
  sign:     '+' | '-'
}

export function computeEnterpriseBridgeV2(
  inputs: EnterpriseBridgeInputs,
): EnterpriseBridgeResult {
  const warnings: string[] = []
  const bridgeItems: BridgeItem[] = []

  let equityValueM = inputs.enterpriseValueM
  bridgeItems.push({ label: 'Enterprise Value', valueM: inputs.enterpriseValueM, sign: '+' })

  // ── Add assets ────────────────────────────────────────────────────────────

  equityValueM += inputs.cashM
  bridgeItems.push({ label: 'Cash & Equivalents', valueM: inputs.cashM, sign: '+' })

  if (inputs.marketableSecuritiesM != null && inputs.marketableSecuritiesM > 0) {
    equityValueM += inputs.marketableSecuritiesM
    bridgeItems.push({ label: 'Marketable Securities', valueM: inputs.marketableSecuritiesM, sign: '+' })
  }

  if (inputs.nonOpInvestmentsM != null && inputs.nonOpInvestmentsM !== 0) {
    equityValueM += inputs.nonOpInvestmentsM
    bridgeItems.push({ label: 'Non-operating Investments', valueM: inputs.nonOpInvestmentsM, sign: '+' })
  }

  if (inputs.associatesValueM != null && inputs.associatesValueM > 0) {
    equityValueM += inputs.associatesValueM
    bridgeItems.push({ label: 'Associates Value', valueM: inputs.associatesValueM, sign: '+' })
  }

  // ── Subtract liabilities ──────────────────────────────────────────────────

  equityValueM -= inputs.totalDebtM
  bridgeItems.push({ label: 'Total Debt', valueM: inputs.totalDebtM, sign: '-' })

  if (inputs.leaseLiabilitiesM != null && inputs.leaseLiabilitiesM > 0) {
    equityValueM -= inputs.leaseLiabilitiesM
    bridgeItems.push({ label: 'Lease Liabilities', valueM: inputs.leaseLiabilitiesM, sign: '-' })
  }

  if (inputs.preferredStockM != null && inputs.preferredStockM > 0) {
    equityValueM -= inputs.preferredStockM
    bridgeItems.push({ label: 'Preferred Stock', valueM: inputs.preferredStockM, sign: '-' })
  }

  if (inputs.minorityInterestM != null && inputs.minorityInterestM > 0) {
    equityValueM -= inputs.minorityInterestM
    bridgeItems.push({ label: 'Minority Interest', valueM: inputs.minorityInterestM, sign: '-' })
  }

  if (inputs.pensionDeficitM != null && inputs.pensionDeficitM > 0) {
    equityValueM -= inputs.pensionDeficitM
    bridgeItems.push({ label: 'Pension Deficit', valueM: inputs.pensionDeficitM, sign: '-' })
    warnings.push('PENSION_DEFICIT_DEDUCTED: Pension deficit reduces equity value')
  }

  // ── Guard: negative equity (debt overhang) ────────────────────────────────

  const debtOverhang = equityValueM <= 0

  if (debtOverhang) {
    warnings.push(
      `DEBT_OVERHANG: Equity value (${equityValueM.toFixed(0)}M) is negative — ` +
      'net liabilities exceed enterprise value. DCF model not applicable at current assumptions.'
    )
    return {
      enterpriseValueM: inputs.enterpriseValueM,
      equityValueM:     null,
      fairValuePerShare: null,
      upsidePct:        null,
      bridgeItems,
      debtOverhang:     true,
      warnings,
    }
  }

  // ── Per-share calculation ─────────────────────────────────────────────────

  if (inputs.dilutedSharesM <= 0) {
    warnings.push('MISSING_SHARES: Cannot compute per-share value — diluted shares unavailable')
    return {
      enterpriseValueM: inputs.enterpriseValueM,
      equityValueM,
      fairValuePerShare: null,
      upsidePct:        null,
      bridgeItems,
      debtOverhang:     false,
      warnings,
    }
  }

  const fairValuePerShare = equityValueM / inputs.dilutedSharesM
  const upsidePct = inputs.currentPrice > 0
    ? (fairValuePerShare - inputs.currentPrice) / inputs.currentPrice
    : null

  return {
    enterpriseValueM: inputs.enterpriseValueM,
    equityValueM,
    fairValuePerShare: Math.round(fairValuePerShare * 100) / 100,
    upsidePct,
    bridgeItems,
    debtOverhang: false,
    warnings,
  }
}

/**
 * Backward-compatible adapter — converts V1 (cashM, debtM only) to V2 bridge.
 * Used internally so V2 DCF can produce bridge results without requiring
 * callers to supply the full V2 input shape immediately.
 */
export function computeEnterpriseBridgeV1Compat(
  enterpriseValueM: number,
  cashM: number,
  debtM: number,
  sharesM: number,
  currentPrice: number,
): EnterpriseBridgeResult {
  return computeEnterpriseBridgeV2({
    enterpriseValueM,
    cashM,
    totalDebtM:    debtM,
    dilutedSharesM: sharesM,
    currentPrice,
  })
}
