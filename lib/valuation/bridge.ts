/**
 * Bridge from Enterprise Value to Equity Value to Fair Value per share.
 *
 * EV  +  Cash  −  Debt  =  Equity Value
 * Equity Value  /  Shares × 1000  =  Fair Value per share
 *   (the ×1000 factor scales $M / millions-of-shares  →  $/share)
 *
 * Null propagation: if any required upstream input is null the downstream
 * outputs are also null.  Never uses `?? 0` to avoid masking missing data.
 * The functions always return a result object — individual fields are null
 * when they cannot be computed.
 */

export interface BridgeResult {
  enterpriseValue: number | null    // EV (sum of PV FCFs + terminal value)
  cashM: number | null              // + Cash & equivalents
  debtM: number | null              // - Total debt
  equityValue: number | null        // = Equity value (in $M)
  sharesM: number | null            // / Shares outstanding (in millions)
  fairValuePerShare: number | null  // = Fair value per share
  upsidePct: number | null          // (fair - current) / current
  currentPrice: number
}

/**
 * Full EV → equity → per-share bridge (UFCF / FCFF path).
 *
 * Always returns a BridgeResult.  Individual downstream fields are null
 * when any required upstream input is null or sharesM is 0.
 */
export function computeBridge(
  enterpriseValue: number | null,
  cashM: number | null,
  debtM: number | null,
  sharesM: number | null,
  currentPrice: number,
): BridgeResult {
  const equityValue =
    enterpriseValue != null && cashM != null && debtM != null
      ? enterpriseValue + cashM - debtM
      : null

  const fairValuePerShare =
    equityValue != null && sharesM != null && sharesM !== 0
      ? (equityValue / sharesM) * 1000
      : null

  const upsidePct =
    fairValuePerShare != null && currentPrice > 0
      ? (fairValuePerShare - currentPrice) / currentPrice
      : null

  return {
    enterpriseValue,
    cashM,
    debtM,
    equityValue,
    sharesM,
    fairValuePerShare,
    upsidePct,
    currentPrice,
  }
}

/**
 * Equity-only bridge (LFCF / FCFE path — no EV step).
 *
 * Always returns the result object.  fairValuePerShare and upsidePct are
 * null when equityValue is null or sharesM is null/0.
 */
export function computeEquityBridge(
  equityValue: number | null,
  sharesM: number | null,
  currentPrice: number,
): Pick<BridgeResult, 'equityValue' | 'sharesM' | 'fairValuePerShare' | 'upsidePct' | 'currentPrice'> {
  const fairValuePerShare =
    equityValue != null && sharesM != null && sharesM !== 0
      ? (equityValue / sharesM) * 1000
      : null

  const upsidePct =
    fairValuePerShare != null && currentPrice > 0
      ? (fairValuePerShare - currentPrice) / currentPrice
      : null

  return {
    equityValue,
    sharesM,
    fairValuePerShare,
    upsidePct,
    currentPrice,
  }
}
