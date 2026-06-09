import type { StockRatings } from '@/lib/dcf/calculateRatings'
import type { VerdictResult } from '@/lib/verdict/computeVerdict'
import type { PiotroskiResult, AltmanResult, BeneishResult } from '@/lib/dcf/calculateScores'

// ─── RiskDimension (mirrors the interface in RiskRadar.tsx) ───────────────────

export interface RiskDimension {
  label: string
  level: 'Low' | 'Moderate' | 'Elevated' | 'High'
  score: number // 0 (low risk) → 3 (high risk)
  detail: string
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ConvictionSignal {
  label: string          // plain-English (NO jargon)
  status: 'pass' | 'fail' | 'na'
  value: string          // plain-English formatted value
  technicalName?: string // original term, for tooltip only
}

export interface ConvictionDimension {
  id: 'valuation' | 'quality' | 'health' | 'growth' | 'integrity' | 'risk'
  label: string          // plain-English dimension name
  question: string       // plain-English question this dimension answers
  score: number          // 0–100
  color: 'green' | 'amber' | 'red' | 'neutral'
  signals: ConvictionSignal[]
}

export interface ConvictionScore {
  score: number          // 0–100 integer
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  gradeFull: string      // 'A+', 'A', 'B+', 'B', 'C', 'D', 'F'
  label: string          // e.g. "Good business, reasonable price"
  verdictSentence: string // one-sentence plain-English summary
  dimensions: ConvictionDimension[]
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface ConvictionInputs {
  ratings: StockRatings
  verdict: VerdictResult | null
  piotroski: PiotroskiResult | null
  altman: AltmanResult | null
  beneish: BeneishResult | null
  riskDimensions: RiskDimension[]
  upsidePct: number | null
  ticker?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a 1–5 CategoryRating score to 0–100 */
function normalizeRating(score: number): number {
  return ((score - 1) / 4) * 100
}

function clamp0100(v: number): number {
  return Math.max(0, Math.min(100, v))
}

function dimColor(score: number): 'green' | 'amber' | 'red' | 'neutral' {
  if (score >= 65) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

/** Upside % (decimal) → 0–100 signal score */
function upsideSignalScore(upsidePct: number | null): number {
  if (upsidePct === null) return 50
  if (upsidePct > 0.25)  return 100
  if (upsidePct >= 0.10) return 80
  if (upsidePct >= 0.00) return 60
  if (upsidePct >= -0.10) return 40
  if (upsidePct >= -0.25) return 20
  return 0
}

function verdictDimPassRate(verdict: VerdictResult | null, id: string): number | null {
  if (!verdict) return null
  const dim = verdict.dimensions.find(d => d.id === id)
  if (!dim) return null
  const eligible = dim.signals.filter(s => s.status !== 'na').length
  if (eligible === 0) return null
  return dim.passingCount / eligible
}

// ─── Signal builders ──────────────────────────────────────────────────────────

function valuationSignals(
  upsidePct: number | null,
  verdict: VerdictResult | null,
): ConvictionSignal[] {
  const signals: ConvictionSignal[] = []

  // "Buying at a discount?"
  let upsideValue = 'Not available'
  let upsideStatus: ConvictionSignal['status'] = 'na'
  if (upsidePct !== null) {
    const pct = Math.abs(upsidePct * 100).toFixed(0)
    if (upsidePct >= 0) {
      upsideValue = `${pct}% below estimated value`
      upsideStatus = upsidePct >= 0.10 ? 'pass' : 'na'
    } else {
      upsideValue = `${pct}% above estimated value`
      upsideStatus = 'fail'
    }
  }
  signals.push({
    label: 'Buying at a discount?',
    status: upsideStatus,
    value: upsideValue,
    technicalName: 'DCF Upside',
  })

  // "Analyst opinion"
  const analystSignal = verdict?.dimensions.find(d => d.id === 'valuation')
    ?.signals.find(s => s.label.toLowerCase().includes('analyst'))
  if (analystSignal) {
    const raw = analystSignal.value.toLowerCase().replace(/_/g, ' ')
    let readableRec = 'Hold'
    if (raw.includes('strong') && raw.includes('buy')) readableRec = 'Strong buy'
    else if (raw.includes('buy')) readableRec = 'Buy'
    else if (raw.includes('sell')) readableRec = 'Sell'
    else if (raw.includes('hold')) readableRec = 'Hold'
    else if (raw !== 'n/a' && raw !== '') readableRec = analystSignal.value.trim()
    signals.push({
      label: 'Analyst opinion',
      status: analystSignal.status,
      value: readableRec,
      technicalName: 'Analyst Recommendation',
    })
  }

  return signals
}

function qualitySignals(
  ratings: StockRatings,
  verdict: VerdictResult | null,
): ConvictionSignal[] {
  const signals: ConvictionSignal[] = []

  // "Competitive strength" from moat grade
  const moatLabel = ratings.moat.label
  const moatReadable = moatLabel === 'Excellent' || moatLabel === 'Good' ? 'Wide'
    : moatLabel === 'Fair' ? 'Moderate'
    : moatLabel === 'Weak' ? 'Narrow'
    : 'None'
  signals.push({
    label: 'Competitive strength',
    status: ratings.moat.score >= 3.5 ? 'pass' : ratings.moat.score >= 2 ? 'na' : 'fail',
    value: moatReadable,
    technicalName: 'Economic Moat',
  })

  // "Returns above hurdle rate" from verdict ROIC > WACC signal
  const roicSignal = verdict?.dimensions.find(d => d.id === 'valuation')
    ?.signals.find(s => s.label.toLowerCase().includes('roic'))
  if (roicSignal) {
    let roicValue = roicSignal.value
    if (roicSignal.status === 'pass') {
      const match = roicSignal.value.match(/spread\s*([+-]?\d+\.?\d*)%/)
      if (match) roicValue = `+${match[1]} pp above required return`
    } else if (roicSignal.status === 'fail') {
      roicValue = 'Below required return'
    }
    signals.push({
      label: 'Returns above hurdle rate',
      status: roicSignal.status,
      value: roicValue,
      technicalName: 'ROIC vs WACC',
    })
  }

  // "Profit quality"
  signals.push({
    label: 'Profit quality',
    status: ratings.profitability.score >= 3 ? 'pass' : ratings.profitability.score >= 2 ? 'na' : 'fail',
    value: ratings.profitability.label,
    technicalName: 'Profitability Grade',
  })

  return signals
}

function healthSignals(
  ratings: StockRatings,
  altman: AltmanResult | null,
  piotroski: PiotroskiResult | null,
): ConvictionSignal[] {
  const signals: ConvictionSignal[] = []

  // "Bankruptcy risk"
  const altmanReadable = altman == null ? 'Not available'
    : altman.zone === 'Safe' ? 'Low'
    : altman.zone === 'Grey' ? 'Watch zone'
    : 'Danger zone'
  signals.push({
    label: 'Bankruptcy risk',
    status: altman == null ? 'na' : altman.zone === 'Safe' ? 'pass' : altman.zone === 'Distress' ? 'fail' : 'na',
    value: altmanReadable,
    technicalName: 'Altman Z-Score',
  })

  // "Balance sheet strength"
  signals.push({
    label: 'Balance sheet strength',
    status: ratings.liquidity.score >= 3 ? 'pass' : ratings.liquidity.score >= 2 ? 'na' : 'fail',
    value: ratings.liquidity.label,
    technicalName: 'Liquidity Grade',
  })

  // "Financial momentum"
  const pioReadable = piotroski == null ? 'Not available'
    : piotroski.label === 'Strong' ? 'Improving'
    : piotroski.label === 'Mixed' ? 'Stable'
    : 'Deteriorating'
  signals.push({
    label: 'Financial momentum',
    status: piotroski == null ? 'na' : piotroski.label === 'Strong' ? 'pass' : piotroski.label === 'Weak' ? 'fail' : 'na',
    value: pioReadable,
    technicalName: 'Piotroski F-Score',
  })

  return signals
}

function growthSignals(ratings: StockRatings): ConvictionSignal[] {
  return [
    {
      label: 'Revenue trend',
      status: ratings.growth.score >= 3 ? 'pass' : ratings.growth.score >= 2 ? 'na' : 'fail',
      value: ratings.growth.label,
      technicalName: 'Growth Grade',
    },
  ]
}

function integritySignals(
  beneish: BeneishResult | null,
  piotroski: PiotroskiResult | null,
): ConvictionSignal[] {
  const signals: ConvictionSignal[] = []

  // "Accounting reliability"
  const beneishReadable = beneish == null ? 'Not available'
    : beneish.flag === 'Clean' ? 'Clean'
    : beneish.flag === 'Warning' ? 'Some concerns'
    : 'Red flag'
  signals.push({
    label: 'Accounting reliability',
    status: beneish == null ? 'na' : beneish.flag === 'Clean' ? 'pass' : beneish.flag === 'Manipulator' ? 'fail' : 'na',
    value: beneishReadable,
    technicalName: 'Beneish M-Score',
  })

  // "Cash flow vs reported profit"
  const accrualCriterion = piotroski?.criteria.find(c =>
    c.name.toLowerCase().includes('accrual')
  )
  const accrualReadable = accrualCriterion == null
    ? 'Not available'
    : accrualCriterion.pass === true
      ? 'Cash flow confirms earnings'
      : accrualCriterion.pass === false
        ? 'Cash flow lags reported earnings'
        : 'Not available'
  signals.push({
    label: 'Cash flow vs reported profit',
    status: accrualCriterion == null || accrualCriterion.pass === null
      ? 'na'
      : accrualCriterion.pass
        ? 'pass'
        : 'fail',
    value: accrualReadable,
    technicalName: 'Accrual Quality',
  })

  return signals
}

function riskSignals(riskDimensions: RiskDimension[]): ConvictionSignal[] {
  const signals: ConvictionSignal[] = []

  const findDim = (fragment: string) =>
    riskDimensions.find(d => d.label.toLowerCase().includes(fragment.toLowerCase()))

  const valRisk = findDim('valuation')
  signals.push({
    label: 'Price risk level',
    status: valRisk == null ? 'na' : valRisk.level === 'Low' ? 'pass' : valRisk.level === 'High' ? 'fail' : 'na',
    value: valRisk?.level ?? 'Not available',
    technicalName: 'Valuation Risk',
  })

  const finStability = findDim('financial stability')
  signals.push({
    label: 'Financial stability',
    status: finStability == null ? 'na' : finStability.level === 'Low' ? 'pass' : finStability.level === 'High' ? 'fail' : 'na',
    value: finStability?.level ?? 'Not available',
    technicalName: 'Financial Stability',
  })

  const mktSensitivity = findDim('market sensitivity')
  signals.push({
    label: 'Market sensitivity',
    status: mktSensitivity == null ? 'na' : mktSensitivity.level === 'Low' ? 'pass' : mktSensitivity.level === 'High' ? 'fail' : 'na',
    value: mktSensitivity?.level ?? 'Not available',
    technicalName: 'Market Sensitivity',
  })

  return signals
}

// ─── Grade logic ──────────────────────────────────────────────────────────────

function computeGrade(score: number): { grade: ConvictionScore['grade']; gradeFull: string; label: string } {
  if (score >= 90) return { grade: 'A', gradeFull: 'A+', label: 'Exceptional buy' }
  if (score >= 80) return { grade: 'A', gradeFull: 'A',  label: 'Exceptional buy' }
  if (score >= 72) return { grade: 'B', gradeFull: 'B+', label: 'Good business, reasonable price' }
  if (score >= 65) return { grade: 'B', gradeFull: 'B',  label: 'Good business, reasonable price' }
  if (score >= 50) return { grade: 'C', gradeFull: 'C',  label: 'Mixed picture — proceed carefully' }
  if (score >= 35) return { grade: 'D', gradeFull: 'D',  label: 'More risks than rewards' }
  return              { grade: 'F', gradeFull: 'F',  label: 'High risk — significant concerns' }
}

function buildVerdictSentence(grade: ConvictionScore['grade'], ticker?: string | null): string {
  const subject = ticker ? ticker.toUpperCase() : 'This stock'
  switch (grade) {
    case 'A': return `${subject} looks like a compelling buy — strong fundamentals and meaningful upside.`
    case 'B': return `${subject} shows solid fundamentals at a reasonable valuation.`
    case 'C': return `${subject} has notable strengths but trade-offs worth reviewing before buying.`
    case 'D': return `${subject} has more concerns than positives at current levels.`
    case 'F': return `${subject} carries significant risks — strong thesis required before buying.`
  }
}

// ─── Main computation ─────────────────────────────────────────────────────────

export function computeConvictionScore(inputs: ConvictionInputs): ConvictionScore {
  const { ratings, verdict, piotroski, altman, beneish, riskDimensions, upsidePct, ticker } = inputs

  // ── Dimension 1: Valuation Attractiveness (weight 30%) ────────────────────
  const valRatingNorm = normalizeRating(ratings.valuation.score)
  const upsideScore   = upsideSignalScore(upsidePct)
  let valDimScore = valRatingNorm * 0.60 + upsideScore * 0.40

  const valPassRate = verdictDimPassRate(verdict, 'valuation')
  if (valPassRate !== null) {
    // Blend in verdict valuation pass rate at 20%, re-weight others
    valDimScore = valRatingNorm * 0.48 + upsideScore * 0.32 + valPassRate * 100 * 0.20
  }

  // ── Dimension 2: Business Quality (weight 25%) ────────────────────────────
  const moatNorm  = normalizeRating(ratings.moat.score)
  const profNorm  = normalizeRating(ratings.profitability.score)
  let qualDimScore = moatNorm * 0.50 + profNorm * 0.50

  const qualPassRate = verdictDimPassRate(verdict, 'quality')
  if (qualPassRate !== null) {
    if (qualPassRate >= 0.75) qualDimScore = clamp0100(qualDimScore + 5)
    else if (qualPassRate < 0.50) qualDimScore = clamp0100(qualDimScore - 5)
  }

  // ── Dimension 3: Financial Health (weight 20%) ────────────────────────────
  const liqNorm     = normalizeRating(ratings.liquidity.score)
  const altmanMod   = altman == null ? 50 : altman.zone === 'Safe' ? 100 : altman.zone === 'Grey' ? 50 : 0
  const pioMod      = piotroski == null ? 50 : (piotroski.score / 9) * 100
  const healthDimScore = liqNorm * 0.50 + altmanMod * 0.30 + pioMod * 0.20

  // ── Dimension 4: Growth Momentum (weight 15%) ─────────────────────────────
  const growthNorm = normalizeRating(ratings.growth.score)
  let growthDimScore: number

  const growthPassRate = verdictDimPassRate(verdict, 'growth')
  if (growthPassRate !== null) {
    growthDimScore = growthNorm * 0.70 + growthPassRate * 100 * 0.30
  } else {
    growthDimScore = growthNorm
  }

  // ── Dimension 5: Earnings Integrity (weight 5%) ───────────────────────────
  const beneishMod = beneish == null ? 60 : beneish.flag === 'Clean' ? 100 : beneish.flag === 'Warning' ? 40 : 0
  const accrualCriterion = piotroski?.criteria.find(c => c.name.toLowerCase().includes('accrual'))
  const accrualMod = accrualCriterion == null || accrualCriterion.pass === null
    ? 60
    : accrualCriterion.pass ? 100 : 0
  const integrityDimScore = beneishMod * 0.50 + accrualMod * 0.50

  // ── Dimension 6: Risk Profile (weight 5%) ─────────────────────────────────
  let riskDimScore = 50
  if (riskDimensions.length > 0) {
    const avgRiskScore = riskDimensions.reduce((s, d) => s + d.score, 0) / riskDimensions.length
    riskDimScore = (1 - avgRiskScore / 3) * 100
  }

  // ── Weighted conviction score ──────────────────────────────────────────────
  const rawScore =
    valDimScore      * 0.30 +
    qualDimScore     * 0.25 +
    healthDimScore   * 0.20 +
    growthDimScore   * 0.15 +
    integrityDimScore * 0.05 +
    riskDimScore     * 0.05

  const finalScore = Math.round(clamp0100(rawScore))
  const { grade, gradeFull, label } = computeGrade(finalScore)

  // ── Build dimension objects ────────────────────────────────────────────────
  const dimensions: ConvictionDimension[] = [
    {
      id: 'valuation',
      label: 'Valuation Attractiveness',
      question: 'Am I paying a fair price?',
      score: Math.round(clamp0100(valDimScore)),
      color: dimColor(clamp0100(valDimScore)),
      signals: valuationSignals(upsidePct, verdict),
    },
    {
      id: 'quality',
      label: 'Business Quality',
      question: 'Is this a good business?',
      score: Math.round(clamp0100(qualDimScore)),
      color: dimColor(clamp0100(qualDimScore)),
      signals: qualitySignals(ratings, verdict),
    },
    {
      id: 'health',
      label: 'Financial Health',
      question: 'Is the balance sheet strong?',
      score: Math.round(clamp0100(healthDimScore)),
      color: dimColor(clamp0100(healthDimScore)),
      signals: healthSignals(ratings, altman, piotroski),
    },
    {
      id: 'growth',
      label: 'Growth Momentum',
      question: 'Is the business growing?',
      score: Math.round(clamp0100(growthDimScore)),
      color: dimColor(clamp0100(growthDimScore)),
      signals: growthSignals(ratings),
    },
    {
      id: 'integrity',
      label: 'Earnings Integrity',
      question: 'Can I trust the reported numbers?',
      score: Math.round(clamp0100(integrityDimScore)),
      color: dimColor(clamp0100(integrityDimScore)),
      signals: integritySignals(beneish, piotroski),
    },
    {
      id: 'risk',
      label: 'Risk Profile',
      question: 'How much risk am I taking on?',
      score: Math.round(clamp0100(riskDimScore)),
      color: dimColor(clamp0100(riskDimScore)),
      signals: riskSignals(riskDimensions),
    },
  ]

  return {
    score: finalScore,
    grade,
    gradeFull,
    label,
    verdictSentence: buildVerdictSentence(grade, ticker),
    dimensions,
  }
}

export default computeConvictionScore
