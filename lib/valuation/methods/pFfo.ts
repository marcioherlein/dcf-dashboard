/**
 * Price / FFO Valuation Method — standard for REITs
 *
 * FFO (Funds From Operations) = Net Income + D&A − Gains on property sales
 * Fair Value = (FFO / Shares) × exitPFFOMultiple
 *
 * Unlike Forward P/E, this is a snapshot method (no discounting) — same approach as EV/EBITDA.
 */

export interface PFFOInputs {
  netIncomeDollars: number | null
  dnaDollars: number | null
  propertyGainsDollars?: number | null
  sharesOutstanding: number | null
  exitPFFOMultiple: number | null
  currentPrice: number
}

export interface PFFOResult {
  ffoPerShare: number | null
  fairValueToday: number | null
  upsidePct: number | null
  guardErrors: string[]
}

export function computePFFO(inputs: PFFOInputs): PFFOResult {
  const { netIncomeDollars, dnaDollars, propertyGainsDollars, sharesOutstanding, exitPFFOMultiple, currentPrice } = inputs
  const errors: string[] = []

  if (netIncomeDollars == null) errors.push('Net income missing')
  if (dnaDollars == null)       errors.push('D&A missing')
  if (sharesOutstanding == null || sharesOutstanding <= 0) errors.push('Shares outstanding missing')
  if (exitPFFOMultiple == null || exitPFFOMultiple <= 0)   errors.push('Exit P/FFO multiple missing')

  if (errors.length > 0) return { ffoPerShare: null, fairValueToday: null, upsidePct: null, guardErrors: errors }

  const gains = propertyGainsDollars ?? 0
  const ffo = netIncomeDollars! + dnaDollars! - gains
  if (ffo <= 0) return { ffoPerShare: null, fairValueToday: null, upsidePct: null, guardErrors: ['FFO is non-positive — check net income and D&A inputs'] }

  const ffoPerShare = ffo / sharesOutstanding!
  const fairValueToday = Math.round(ffoPerShare * exitPFFOMultiple! * 100) / 100
  const upsidePct = currentPrice > 0 ? Math.round(((fairValueToday - currentPrice) / currentPrice) * 1000) / 1000 : null

  return { ffoPerShare, fairValueToday, upsidePct, guardErrors: [] }
}
