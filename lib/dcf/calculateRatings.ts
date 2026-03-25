export interface RatingMetric {
  name: string
  value: string
  score: number  // 1–5
}

export interface CategoryRating {
  score: number              // 1.0–5.0
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F'
  label: string
  color: 'emerald' | 'green' | 'blue' | 'amber' | 'orange' | 'red'
  metrics: RatingMetric[]
  summary: string
}

export interface StockRatings {
  profitability: CategoryRating
  liquidity: CategoryRating
  growth: CategoryRating
  moat: CategoryRating
  valuation: CategoryRating
  overall: { score: number; grade: string; label: string; color: string }
}

function scoreToGrade(score: number): CategoryRating['grade'] {
  if (score >= 4.7) return 'A+'
  if (score >= 4.0) return 'A'
  if (score >= 3.5) return 'B+'
  if (score >= 2.8) return 'B'
  if (score >= 2.0) return 'C'
  if (score >= 1.3) return 'D'
  return 'F'
}

function scoreToColor(score: number): CategoryRating['color'] {
  if (score >= 4.0) return 'emerald'
  if (score >= 3.5) return 'green'
  if (score >= 2.8) return 'blue'
  if (score >= 2.0) return 'amber'
  if (score >= 1.3) return 'orange'
  return 'red'
}

function scoreToLabel(score: number): string {
  if (score >= 4.0) return 'Excellent'
  if (score >= 3.5) return 'Good'
  if (score >= 2.8) return 'Fair'
  if (score >= 2.0) return 'Weak'
  return 'Poor'
}

function avg(scores: number[]): number {
  const valid = scores.filter((s) => !isNaN(s) && isFinite(s))
  if (!valid.length) return 2.5
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function pct(v: number | null): string {
  return v !== null ? `${(v * 100).toFixed(1)}%` : 'N/A'
}

function clamp(v: number, min = 1, max = 5): number {
  return Math.max(min, Math.min(max, v))
}

// ─── Profitability ────────────────────────────────────────────────────────────

function scoreGrossMargin(v: number | null): number {
  if (v === null) return 2.5
  if (v >= 0.55) return 5
  if (v >= 0.40) return 4.5
  if (v >= 0.25) return 3.5
  if (v >= 0.15) return 2.5
  if (v >= 0.05) return 1.5
  return 1
}

function scoreNetMargin(v: number | null): number {
  if (v === null) return 2.5
  if (v >= 0.25) return 5
  if (v >= 0.15) return 4
  if (v >= 0.08) return 3
  if (v >= 0.03) return 2
  if (v >= 0) return 1.5
  return 1
}

function scoreFCFMargin(v: number | null): number {
  if (v === null) return 2.5
  if (v >= 0.20) return 5
  if (v >= 0.12) return 4
  if (v >= 0.06) return 3
  if (v >= 0.02) return 2
  if (v >= 0) return 1.5
  return 1
}

function scoreROE(v: number | null): number {
  if (v === null) return 2.5
  if (v >= 0.25) return 5
  if (v >= 0.15) return 4
  if (v >= 0.08) return 3
  if (v >= 0.02) return 2
  if (v >= 0) return 1.5
  return 1
}

function scoreROA(v: number | null): number {
  if (v === null) return 2.5
  if (v >= 0.12) return 5
  if (v >= 0.07) return 4
  if (v >= 0.04) return 3
  if (v >= 0.01) return 2
  return 1
}

// ─── Liquidity ────────────────────────────────────────────────────────────────

function scoreCurrentRatio(v: number | null): number {
  if (v === null) return 2.5
  if (v >= 2.5) return 5
  if (v >= 1.8) return 4
  if (v >= 1.2) return 3
  if (v >= 0.8) return 2
  return 1
}

function scoreQuickRatio(v: number | null): number {
  if (v === null) return 2.5
  if (v >= 2.0) return 5
  if (v >= 1.2) return 4
  if (v >= 0.8) return 3
  if (v >= 0.5) return 2
  return 1
}

function scoreCashDebt(cashM: number, debtM: number): number {
  if (debtM <= 0) return 5
  const ratio = cashM / debtM
  if (ratio >= 1.5) return 5
  if (ratio >= 0.8) return 4
  if (ratio >= 0.4) return 3
  if (ratio >= 0.1) return 2
  return 1
}

// ─── Growth ───────────────────────────────────────────────────────────────────

function scoreGrowthRate(v: number): number {
  if (v >= 0.30) return 5
  if (v >= 0.20) return 4.5
  if (v >= 0.12) return 4
  if (v >= 0.07) return 3
  if (v >= 0.03) return 2
  if (v >= 0) return 1.5
  return 1
}

// ─── Main function ────────────────────────────────────────────────────────────

export function calculateRatings(input: {
  grossMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
  operatingMargin: number | null
  roe: number | null
  roa: number | null
  currentRatio: number | null
  quickRatio: number | null
  cashM: number
  debtM: number
  historicalCagr3y: number
  analystGrowth1y: number
  earningsGrowth: number | null          // used for scoring (may be null to suppress distorted TTM)
  earningsGrowthDisplay?: number | null  // raw value shown in UI; falls back to earningsGrowth
  beta: number
  marketCapB: number
  upsidePct: number
}): StockRatings {
  const { grossMargin, netMargin, fcfMargin, operatingMargin, roe, roa,
          currentRatio, quickRatio, cashM, debtM,
          historicalCagr3y, analystGrowth1y, earningsGrowth,
          earningsGrowthDisplay,
          beta, marketCapB, upsidePct } = input
  // Raw TTM value for display — may differ from earningsGrowth (which is scoring-adjusted)
  const egDisplay = earningsGrowthDisplay !== undefined ? earningsGrowthDisplay : earningsGrowth

  // ── Profitability ──
  const profScores = [
    scoreGrossMargin(grossMargin),
    scoreNetMargin(netMargin),
    scoreFCFMargin(fcfMargin),
    scoreROE(roe),
    scoreROA(roa),
  ]
  const profScore = clamp(avg(profScores))
  const profitability: CategoryRating = {
    score: Math.round(profScore * 10) / 10,
    grade: scoreToGrade(profScore),
    label: scoreToLabel(profScore),
    color: scoreToColor(profScore),
    metrics: [
      { name: 'Gross Margin', value: pct(grossMargin), score: clamp(scoreGrossMargin(grossMargin)) },
      { name: 'Net Margin', value: pct(netMargin), score: clamp(scoreNetMargin(netMargin)) },
      { name: 'FCF Margin', value: pct(fcfMargin), score: clamp(scoreFCFMargin(fcfMargin)) },
      { name: 'Return on Equity', value: pct(roe), score: clamp(scoreROE(roe)) },
      { name: 'Return on Assets', value: pct(roa), score: clamp(scoreROA(roa)) },
      { name: 'Operating Margin', value: pct(operatingMargin), score: clamp(scoreNetMargin(operatingMargin)) },
    ],
    summary: profScore >= 4
      ? 'Highly profitable with strong cash generation and returns on capital.'
      : profScore >= 3
      ? 'Solid profitability metrics with room for margin expansion.'
      : profScore >= 2
      ? 'Moderate profitability; margins under pressure or below sector norms.'
      : 'Weak profitability — company struggles to generate consistent earnings.',
  }

  // ── Liquidity ──
  const cashDebtScore = scoreCashDebt(cashM, debtM)
  const liqScores = [scoreCurrentRatio(currentRatio), scoreQuickRatio(quickRatio), cashDebtScore]
  const liqScore = clamp(avg(liqScores))
  const cashDebtRatio = debtM > 0 ? (cashM / debtM).toFixed(2) : '∞'
  const liquidity: CategoryRating = {
    score: Math.round(liqScore * 10) / 10,
    grade: scoreToGrade(liqScore),
    label: scoreToLabel(liqScore),
    color: scoreToColor(liqScore),
    metrics: [
      { name: 'Current Ratio', value: currentRatio !== null ? currentRatio.toFixed(2) : 'N/A', score: clamp(scoreCurrentRatio(currentRatio)) },
      { name: 'Quick Ratio', value: quickRatio !== null ? quickRatio.toFixed(2) : 'N/A', score: clamp(scoreQuickRatio(quickRatio)) },
      { name: 'Cash / Debt', value: cashDebtRatio.toString(), score: clamp(cashDebtScore) },
      { name: 'Net Cash ($M)', value: cashM > 0 && debtM > 0 ? `$${Math.round(cashM - debtM).toLocaleString()}M` : 'N/A', score: clamp(cashDebtScore) },
    ],
    summary: liqScore >= 4
      ? 'Strong balance sheet with ample liquidity to weather downturns.'
      : liqScore >= 3
      ? 'Adequate liquidity; balance sheet is manageable.'
      : liqScore >= 2
      ? 'Liquidity concerns — debt levels relative to cash warrant monitoring.'
      : 'Elevated financial risk from high leverage or low cash reserves.',
  }

  // ── Growth ──
  const growScores = [
    scoreGrowthRate(historicalCagr3y),
    scoreGrowthRate(analystGrowth1y),
    earningsGrowth !== null ? scoreGrowthRate(earningsGrowth) : 2.5,
  ]
  const growScore = clamp(avg(growScores))
  const growth: CategoryRating = {
    score: Math.round(growScore * 10) / 10,
    grade: scoreToGrade(growScore),
    label: scoreToLabel(growScore),
    color: scoreToColor(growScore),
    metrics: [
      { name: '3Y Revenue CAGR', value: pct(historicalCagr3y), score: clamp(scoreGrowthRate(historicalCagr3y)) },
      { name: 'Analyst Revenue +1Y', value: pct(analystGrowth1y), score: clamp(scoreGrowthRate(analystGrowth1y)) },
      { name: 'Earnings Growth (TTM)', value: egDisplay !== null ? pct(egDisplay) : 'N/A', score: earningsGrowth !== null ? clamp(scoreGrowthRate(earningsGrowth)) : 2.5 },
    ],
    summary: growScore >= 4
      ? 'Exceptional growth trajectory with strong analyst conviction.'
      : growScore >= 3
      ? 'Solid growth profile — outpacing the broader market.'
      : growScore >= 2
      ? 'Moderate growth; expansion is slowing or below market expectations.'
      : 'Growth stagnation or contraction — headwinds weigh on the outlook.',
  }

  // ── MOAT ──
  // Proxy: gross margin durability, scale, FCF generation, stability (beta)
  let moatPoints = 0
  const moatFactors: RatingMetric[] = []

  const gmScore = scoreGrossMargin(grossMargin)
  moatPoints += (gmScore / 5) * 1.5  // weight: 1.5/5
  moatFactors.push({ name: 'Pricing Power (Gross Margin)', value: pct(grossMargin), score: clamp(gmScore) })

  const fcfScore = scoreFCFMargin(fcfMargin)
  moatPoints += (fcfScore / 5) * 1.2
  moatFactors.push({ name: 'Cash Generation (FCF Margin)', value: pct(fcfMargin), score: clamp(fcfScore) })

  const roeScore = scoreROE(roe)
  moatPoints += (roeScore / 5) * 1.0
  moatFactors.push({ name: 'Capital Efficiency (ROE)', value: pct(roe), score: clamp(roeScore) })

  // Scale advantage: market cap >$100B adds up to 0.8 pts
  const scaleScore = marketCapB >= 500 ? 5 : marketCapB >= 100 ? 4 : marketCapB >= 20 ? 3 : marketCapB >= 5 ? 2 : 1
  moatPoints += (scaleScore / 5) * 0.8
  moatFactors.push({ name: 'Scale Advantage (Market Cap)', value: `$${marketCapB.toFixed(0)}B`, score: clamp(scaleScore) })

  // Stability (low beta = defensive moat): beta <0.7 = strong, >1.5 = weak
  const betaScore = beta <= 0.7 ? 5 : beta <= 0.9 ? 4 : beta <= 1.1 ? 3 : beta <= 1.4 ? 2 : 1
  moatPoints += (betaScore / 5) * 0.5
  moatFactors.push({ name: 'Business Stability (Beta)', value: beta.toFixed(2), score: clamp(betaScore) })

  // Normalize to 1–5 (max possible moatPoints = 1.5+1.2+1.0+0.8+0.5 = 5.0)
  const moatScore = clamp(moatPoints)
  const moat: CategoryRating = {
    score: Math.round(moatScore * 10) / 10,
    grade: scoreToGrade(moatScore),
    label: scoreToLabel(moatScore),
    color: scoreToColor(moatScore),
    metrics: moatFactors,
    summary: moatScore >= 4
      ? 'Wide economic moat — pricing power, scale, and durable cash flows suggest sustained competitive advantage.'
      : moatScore >= 3
      ? 'Moderate moat — competitive advantages exist but may face pressure over time.'
      : moatScore >= 2
      ? 'Narrow or uncertain moat — limited differentiation, susceptible to competitive disruption.'
      : 'No discernible moat — commoditized business with thin margins and high competition.',
  }

  // ── Valuation ──
  let valScore: number
  if (upsidePct >= 0.50) valScore = 5
  else if (upsidePct >= 0.25) valScore = 4.5
  else if (upsidePct >= 0.10) valScore = 4
  else if (upsidePct >= 0.00) valScore = 3
  else if (upsidePct >= -0.15) valScore = 2
  else if (upsidePct >= -0.30) valScore = 1.5
  else valScore = 1

  const valLabel = valScore >= 4.5 ? 'Strong Buy'
    : valScore >= 4 ? 'Buy'
    : valScore >= 3 ? 'Hold'
    : valScore >= 1.5 ? 'Sell'
    : 'Strong Sell'

  const valuation: CategoryRating = {
    score: Math.round(valScore * 10) / 10,
    grade: scoreToGrade(valScore),
    label: valLabel,
    color: scoreToColor(valScore),
    metrics: [
      { name: 'DCF Upside', value: `${upsidePct >= 0 ? '+' : ''}${(upsidePct * 100).toFixed(1)}%`, score: clamp(valScore) },
    ],
    summary: valScore >= 4
      ? 'Materially undervalued vs intrinsic DCF value — attractive entry point.'
      : valScore >= 3
      ? 'Fairly valued — trading close to intrinsic value.'
      : 'Appears overvalued vs DCF model — risk/reward skewed to the downside.',
  }

  // ── Overall ──
  const overallScore = clamp(avg([profScore, liqScore, growScore, moatScore, valScore]))
  const overallGrade = scoreToGrade(overallScore)
  const overallLabel = overallScore >= 4.5 ? 'Strong Buy'
    : overallScore >= 4.0 ? 'Buy'
    : overallScore >= 3.5 ? 'Accumulate'
    : overallScore >= 2.8 ? 'Hold'
    : overallScore >= 2.0 ? 'Reduce'
    : 'Sell'

  return {
    profitability,
    liquidity,
    growth,
    moat,
    valuation,
    overall: {
      score: Math.round(overallScore * 10) / 10,
      grade: overallGrade,
      label: overallLabel,
      color: scoreToColor(overallScore),
    },
  }
}
