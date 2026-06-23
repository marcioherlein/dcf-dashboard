export interface ScoreBreakdown {
  pe: number
  pb: number
  yieldPts: number
  expensePenalty: number
}

export interface ScoreResult {
  score: number
  breakdown: ScoreBreakdown
  label: string
}

/**
 * Compute the ETF value score (0-100).
 *
 * Returns score = 0 with label "Growth-Priced" when both P/E and P/B are null
 * (commodity, bond, thematic ETFs) so they are not falsely labeled "Expensive".
 *
 * P/E recalibrated: PE=12 → 30pts, PE=18 → 22.5pts, PE=36 → 0pts.
 * Old formula treated PE=18 as 67% cheap; corrected formula treats it as fair.
 */
export function computeETFScore(
  peRatio: number | null,
  pbRatio: number | null,
  yieldVal: number | null,
  expenseRatio: number | null,
): ScoreResult {
  // If both equity multiples are missing, this is a non-equity ETF — don't score it as "Expensive"
  const noEquityData = (peRatio == null || peRatio <= 0) && (pbRatio == null || pbRatio <= 0)
  if (noEquityData && (yieldVal == null || yieldVal <= 0)) {
    // Commodity / pure-price ETF — not applicable
    return {
      score: 0,
      breakdown: { pe: 0, pb: 0, yieldPts: 0, expensePenalty: 0 },
      label: 'Not rated',
    }
  }

  // P/E: 0–30 pts. Recalibrated: PE≤12 → 30, PE=18 → 22.5, PE≥36 → 0
  let pe = 0
  if (peRatio != null && peRatio > 0)
    pe = Math.max(0, Math.min(30, 30 * (1 - (peRatio - 12) / 24)))

  // P/B: 0–25 pts (≤1.0 → 25, ≥6.0 → 0)
  let pb = 0
  if (pbRatio != null && pbRatio > 0)
    pb = Math.max(0, Math.min(25, 25 * (1 - (pbRatio - 1) / 5)))

  // Yield: 0–25 pts (≥3% → 25, proportional below)
  let yieldPts = 0
  if (yieldVal != null && yieldVal > 0)
    yieldPts = Math.min(25, (yieldVal / 0.03) * 25)

  // Expense ratio penalty: 0–20 pts (≤0.05% → 0, ≥0.75% → 20)
  let expensePenalty = 0
  if (expenseRatio != null && expenseRatio > 0.0005)
    expensePenalty = Math.min(20, ((expenseRatio - 0.0005) / 0.007) * 20)

  const score = Math.round(Math.max(0, Math.min(100, pe + pb + yieldPts - expensePenalty)))

  return {
    score,
    breakdown: {
      pe: Math.round(pe),
      pb: Math.round(pb),
      yieldPts: Math.round(yieldPts),
      expensePenalty: Math.round(expensePenalty),
    },
    label: scoreLabel(score, peRatio, pbRatio),
  }
}

/**
 * Score label. "Growth-Priced" replaces "Expensive" when the ETF has
 * high multiples that indicate a structural growth premium, not mispricing.
 * "Not rated" for commodity/non-equity ETFs.
 */
export function scoreLabel(
  score: number,
  peRatio?: number | null,
  pbRatio?: number | null,
): string {
  if (score === 0 && (peRatio == null || peRatio <= 0) && (pbRatio == null || pbRatio <= 0)) {
    return 'Not rated'
  }
  if (score >= 70) return 'Deep Value'
  if (score >= 50) return 'Fair Value'
  if (score >= 30) return 'Stretched'
  // Distinguish "Growth-Priced" (high multiples by design) from "Expensive" (value looked worse)
  if ((peRatio != null && peRatio > 28) || (pbRatio != null && pbRatio > 5)) {
    return 'Growth-Priced'
  }
  return 'Expensive'
}

/** Generate a human-readable sentence explaining a score breakdown. */
export function explainScore(
  breakdown: ScoreBreakdown,
  score: number,
  metrics: { peRatio: number | null; pbRatio: number | null; yieldVal: number | null; expenseRatio: number | null },
): string {
  // Non-equity ETF
  if (score === 0 && breakdown.pe === 0 && breakdown.pb === 0 && breakdown.yieldPts === 0) {
    return 'Value scoring not applicable for this asset class. Use Income or Momentum mode.'
  }

  const parts: string[] = []

  if (metrics.peRatio != null) {
    const pePct = breakdown.pe / 30
    if (pePct >= 0.8) parts.push(`cheap P/E of ${metrics.peRatio.toFixed(1)}×`)
    else if (pePct >= 0.5) parts.push(`fair P/E of ${metrics.peRatio.toFixed(1)}×`)
    else parts.push(`elevated P/E of ${metrics.peRatio.toFixed(1)}×`)
  }

  if (metrics.pbRatio != null) {
    const pbPct = breakdown.pb / 25
    if (pbPct >= 0.8) parts.push(`attractive P/B of ${metrics.pbRatio.toFixed(1)}×`)
    else if (pbPct >= 0.5) parts.push(`moderate P/B of ${metrics.pbRatio.toFixed(1)}×`)
    else parts.push(`stretched P/B of ${metrics.pbRatio.toFixed(1)}×`)
  }

  if (metrics.yieldVal != null && metrics.yieldVal > 0) {
    const pct = (metrics.yieldVal * 100).toFixed(1)
    if (breakdown.yieldPts >= 20) parts.push(`strong ${pct}% yield`)
    else if (breakdown.yieldPts >= 10) parts.push(`modest ${pct}% yield`)
    else parts.push(`low ${pct}% yield`)
  }

  if (metrics.expenseRatio != null && breakdown.expensePenalty > 5) {
    const er = (metrics.expenseRatio * 100).toFixed(2)
    parts.push(`${er}% expense ratio dragging score by ${breakdown.expensePenalty} pts`)
  } else if (metrics.expenseRatio != null && breakdown.expensePenalty <= 1) {
    parts.push(`near-zero cost at ${(metrics.expenseRatio * 100).toFixed(2)}%`)
  }

  if (parts.length === 0) return `Composite score of ${score}/100.`

  const intro = score >= 70 ? 'Trading at a discount' : score >= 50 ? 'Trading near fair value' : score >= 30 ? 'Trading at a premium' : 'Significantly overvalued'
  return `${intro}: ${parts.join(', ')}.`
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-[#11875D]'
  if (score >= 50) return 'text-[#2563EB]'
  if (score >= 30) return 'text-[#92580A]'
  if (score === 0) return 'text-[#9B9B9B]'
  return 'text-[#D83B3B]'
}

export function scoreBgCell(score: number): string {
  if (score >= 70) return 'bg-[#F4FBF7] border-[#C8EAD8]'
  if (score >= 50) return 'bg-white border-[#E3E1DA]'
  if (score >= 30) return 'bg-[#FFFBEB] border-[#FDE68A]'
  if (score === 0) return 'bg-[#F5F5F5] border-[#E5E5E5]'
  return 'bg-[#FEF2F2] border-[#FECACA]'
}

export function scoreBadge(score: number): string {
  if (score >= 70) return 'bg-[#DCFCE7] text-[#11875D]'
  if (score >= 50) return 'bg-[#EAF1FF] text-[#2563EB]'
  if (score >= 30) return 'bg-[#FFF4DA] text-[#92580A]'
  if (score === 0) return 'bg-[#F5F5F5] text-[#767676]'
  return 'bg-[#FCEAEA] text-[#D83B3B]'
}

export function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-[#11875D]'
  if (score >= 50) return 'bg-[#2563EB]'
  if (score >= 30) return 'bg-[#92580A]'
  if (score === 0) return 'bg-[#9B9B9B]'
  return 'bg-[#D83B3B]'
}
