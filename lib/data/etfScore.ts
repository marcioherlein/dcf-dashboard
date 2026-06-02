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

export function computeETFScore(
  peRatio: number | null,
  pbRatio: number | null,
  yieldVal: number | null,
  expenseRatio: number | null,
): ScoreResult {
  // P/E: 0–30 pts (≤12 → 30, ≥30 → 0)
  let pe = 0
  if (peRatio != null && peRatio > 0)
    pe = Math.max(0, Math.min(30, ((30 - peRatio) / 18) * 30))

  // P/B: 0–25 pts (≤1.0 → 25, ≥4.0 → 0)
  let pb = 0
  if (pbRatio != null && pbRatio > 0)
    pb = Math.max(0, Math.min(25, ((4 - pbRatio) / 3) * 25))

  // Yield: 0–25 pts (≥4% → 25, 0% → 0)
  let yieldPts = 0
  if (yieldVal != null && yieldVal > 0)
    yieldPts = Math.min(25, (yieldVal / 0.04) * 25)

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
    label: scoreLabel(score),
  }
}

export function scoreLabel(score: number): string {
  if (score >= 70) return 'Deep Value'
  if (score >= 50) return 'Fair Value'
  if (score >= 30) return 'Stretched'
  return 'Expensive'
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 50) return 'text-blue-600'
  if (score >= 30) return 'text-amber-600'
  return 'text-red-600'
}

export function scoreBgCell(score: number): string {
  if (score >= 70) return 'bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'bg-white border-slate-200'
  if (score >= 30) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

export function scoreBadge(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700'
  if (score >= 50) return 'bg-blue-100 text-blue-700'
  if (score >= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}
