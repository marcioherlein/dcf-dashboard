/**
 * Graham Number (Benjamin Graham)
 *
 * Graham Number = √(22.5 × EPS × BVPS)
 *
 * Graham's conservative valuation ceiling:
 * — Max P/E of 15× AND max P/B of 1.5× simultaneously
 * — 15 × 1.5 = 22.5
 *
 * Only meaningful for mature, profitable companies trading near book value.
 * Explicitly not applicable for high-multiple growth stocks.
 */

export interface GrahamNumberInputs {
  eps: number | null             // current EPS
  normalizedEps: number | null   // 5-year average EPS
  bvps: number | null            // book value per share
  currentPrice: number
  peRatio: number | null         // trailing P/E for applicability check
  sector: string | null
}

export interface GrahamNumberResult {
  grahamNumber: number | null
  upsidePct: number | null
  isApplicable: boolean
  inapplicabilityReason: string | null
  isNormalized: boolean
  isCyclical: boolean
  guardErrors: string[]
}

function checkApplicability(
  eps: number | null,
  bvps: number | null,
  peRatio: number | null,
  sector: string | null,
): { applicable: boolean; reason: string | null } {
  if (eps == null) return { applicable: false, reason: 'EPS unavailable' }
  if (eps <= 0) return { applicable: false, reason: 'Negative or zero EPS — Graham Number requires positive earnings' }
  if (bvps == null || bvps <= 0) return { applicable: false, reason: 'Negative or zero book value — Graham Number not applicable' }

  // High-multiple growth stocks explicitly flagged
  if (peRatio != null && peRatio > 60) {
    return {
      applicable: false,
      reason: `P/E ${peRatio.toFixed(0)}× — Graham's screen is designed for mature companies near book value, not high-multiple growth stocks`,
    }
  }
  const growthSectors = ['Technology', 'Communication Services']
  if (sector && growthSectors.includes(sector) && peRatio != null && peRatio > 35) {
    return {
      applicable: false,
      reason: `P/E ${peRatio.toFixed(0)}× in ${sector} — Graham's conservative screen is not designed for growth compounders. Use EPV or DCF instead.`,
    }
  }

  return { applicable: true, reason: null }
}

export function computeGrahamNumber(inputs: GrahamNumberInputs): GrahamNumberResult {
  const { eps, normalizedEps, bvps, currentPrice, peRatio, sector } = inputs

  const isCyclical = (
    eps != null && normalizedEps != null && normalizedEps !== 0 &&
    Math.abs((eps - normalizedEps) / Math.abs(normalizedEps)) > 0.50
  )
  const isNormalized = isCyclical && normalizedEps != null
  const effectiveEps = isNormalized ? normalizedEps : eps

  const { applicable, reason } = checkApplicability(effectiveEps, bvps, peRatio, sector)

  if (!applicable || effectiveEps == null || bvps == null || effectiveEps <= 0 || bvps <= 0) {
    return {
      grahamNumber: null,
      upsidePct: null,
      isApplicable: false,
      inapplicabilityReason: reason,
      isNormalized,
      isCyclical,
      guardErrors: [],
    }
  }

  const grahamNumber = Math.sqrt(22.5 * effectiveEps * bvps)
  const upsidePct = currentPrice > 0 ? (grahamNumber - currentPrice) / currentPrice : null

  return {
    grahamNumber,
    upsidePct,
    isApplicable: true,
    inapplicabilityReason: null,
    isNormalized,
    isCyclical,
    guardErrors: [],
  }
}
