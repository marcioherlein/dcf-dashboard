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
  id: 'valuation' | 'quality' | 'health' | 'growth' | 'integrity' | 'risk' | 'sentiment'
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
  // ── New optional inputs for expanded scoring ──────────────────────────────
  analystRatingTrend?: Array<{
    period?: string
    strongBuy?: number
    buy?: number
    hold?: number
    sell?: number
    strongSell?: number
  }> | null
  earningsSurprises?: Array<{
    epsActual?: number
    epsEstimate?: number
    surprisePercent?: number
  }> | null
  analystTargetMean?: number | null
  insiderPct?: number | null
  institutionalPct?: number | null
  holdingReturns?: {
    stock1y?: number | null
    spy1y?: number | null
    stock3y?: number | null
    spy3y?: number | null
  } | null
  analystForwardPE?: number | null
  priceToBook?: number | null
  currentPrice?: number | null
  // Gross profitability (Novy-Marx 2013) — gross profit / total assets
  // Strongest academically validated quality signal beyond Piotroski/Altman/Beneish
  grossProfitability?: number | null  // decimal, e.g. 0.45 = 45%
  // Accruals ratio (Sloan 1996) — (NI − OCF) / Avg Total Assets
  // Low/negative = cash-backed earnings. High positive = accrual-driven.
  accrualsRatio?: number | null  // decimal, e.g. 0.05 = 5%
  // Analyst revision momentum: direction of consensus EPS revisions over 90 days
  revisionMomentum?: { direction: 'up' | 'down' | 'flat'; magnitude: number; analystsCount?: number | null } | null
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
  grossProfitability: number | null,
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

  // "Gross profitability" — Novy-Marx (2013) factor: gross profit / total assets
  // High values predict outperformance independent of value/cheapness screens
  if (grossProfitability !== null && isFinite(grossProfitability)) {
    const gpPct = (grossProfitability * 100).toFixed(1) + '%'
    const gpStatus: ConvictionSignal['status'] = grossProfitability >= 0.25 ? 'pass'
      : grossProfitability >= 0.10 ? 'na'
      : 'fail'
    signals.push({
      label: 'Asset profitability',
      status: gpStatus,
      value: `${gpPct} gross profit per dollar of assets`,
      technicalName: 'Gross Profitability (Novy-Marx)',
    })
  }

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
  accrualsRatio?: number | null,
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

  // "Earnings backed by cash" — Accruals Ratio (Sloan 1996)
  if (accrualsRatio != null) {
    const pctStr = `${(accrualsRatio * 100).toFixed(1)}% of assets`
    const arLabel = accrualsRatio <= 0.01 ? 'Cash-backed earnings'
      : accrualsRatio <= 0.10 ? 'Moderate accruals'
      : 'Accrual-driven earnings'
    const arStatus: ConvictionSignal['status'] = accrualsRatio <= 0.01 ? 'pass'
      : accrualsRatio <= 0.10 ? 'na'
      : 'fail'
    signals.push({
      label: 'Earnings backed by cash',
      status: arStatus,
      value: `${arLabel} (${pctStr})`,
      technicalName: 'Accruals Ratio (Sloan 1996)',
    })
  }

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

// ─── Sentiment signal builder (Dimension 7) ──────────────────────────────────

function sentimentSignals(inputs: ConvictionInputs): ConvictionSignal[] {
  const signals: ConvictionSignal[] = []

  // a) Analyst consensus strength
  const trend = inputs.analystRatingTrend
  let consensusValue = 'Not available'
  let consensusStatus: ConvictionSignal['status'] = 'na'
  if (trend && trend.length > 0) {
    const latest = trend[0]
    const sb = latest.strongBuy ?? 0
    const b  = latest.buy ?? 0
    const h  = latest.hold ?? 0
    const s  = latest.sell ?? 0
    const ss = latest.strongSell ?? 0
    const total = sb + b + h + s + ss
    if (total > 0) {
      const rawConsensus = clamp0100((sb * 2 + b * 1 - s * 1 - ss * 2) / total * 50 + 50)
      consensusStatus = rawConsensus >= 65 ? 'pass' : rawConsensus < 45 ? 'fail' : 'na'
      const bullPct = Math.round(((sb + b) / total) * 100)
      consensusValue = `${bullPct}% bullish (${sb + b} of ${total} analysts)`
    }
  }
  signals.push({
    label: 'Analyst consensus',
    status: consensusStatus,
    value: consensusValue,
    technicalName: 'Analyst Rating Trend',
  })

  // b) Earnings beat consistency
  const surprises = inputs.earningsSurprises
  let beatValue = 'Not available'
  let beatStatus: ConvictionSignal['status'] = 'na'
  if (surprises && surprises.length > 0) {
    const last4 = surprises.slice(0, 4)
    const beats = last4.filter(q => {
      const actual = q.epsActual ?? null
      const est    = q.epsEstimate ?? null
      return actual !== null && est !== null && actual > est
    }).length
    const beatRate = beats / last4.length
    beatValue = `${beats} of ${last4.length} quarters beat estimates`
    beatStatus = beatRate >= 0.75 ? 'pass' : beatRate < 0.50 ? 'fail' : 'na'
  }
  signals.push({
    label: 'Earnings beat record',
    status: beatStatus,
    value: beatValue,
    technicalName: 'EPS Surprise History',
  })

  // c) Analyst price target upside
  const targetMean  = inputs.analystTargetMean ?? null
  const currentPrice = inputs.currentPrice ?? null
  let targetValue = 'Not available'
  let targetStatus: ConvictionSignal['status'] = 'na'
  if (targetMean !== null && currentPrice !== null && currentPrice > 0) {
    const gap = (targetMean - currentPrice) / currentPrice
    const gapPct = (gap * 100).toFixed(1)
    if (targetMean > currentPrice) {
      targetValue = `${gapPct}% upside to consensus target`
      targetStatus = gap >= 0.10 ? 'pass' : 'na'
    } else {
      targetValue = `${Math.abs(Number(gapPct))}% above consensus target`
      targetStatus = 'fail'
    }
  }
  signals.push({
    label: 'Price target gap',
    status: targetStatus,
    value: targetValue,
    technicalName: 'Analyst Price Target',
  })

  // d) Insider ownership signal
  const insiderPct = inputs.insiderPct ?? null
  let insiderValue = 'Not available'
  let insiderStatus: ConvictionSignal['status'] = 'na'
  if (insiderPct !== null) {
    const pct = (insiderPct * 100).toFixed(1)
    if (insiderPct >= 0.10) {
      insiderValue = `${pct}% insider-owned — strong alignment`
      insiderStatus = 'pass'
    } else if (insiderPct >= 0.05) {
      insiderValue = `${pct}% insider-owned — moderate alignment`
      insiderStatus = 'pass'
    } else if (insiderPct >= 0.01) {
      insiderValue = `${pct}% insider-owned`
      insiderStatus = 'na'
    } else {
      insiderValue = `${pct}% insider-owned — low alignment`
      insiderStatus = 'fail'
    }
  }
  signals.push({
    label: 'Management skin in the game',
    status: insiderStatus,
    value: insiderValue,
    technicalName: 'Insider Ownership',
  })

  // e) Analyst revision momentum
  const rev = inputs.revisionMomentum ?? null
  if (rev != null) {
    const magPct = `${(rev.magnitude * 100).toFixed(1)}%`
    const revValue = rev.direction === 'up'   ? `Estimates raised ${magPct} in 90 days`
      : rev.direction === 'down' ? `Estimates cut ${magPct} in 90 days`
      : 'Estimates unchanged (90 days)'
    const revStatus: ConvictionSignal['status'] = rev.direction === 'up' ? 'pass'
      : rev.direction === 'down' ? 'fail'
      : 'na'
    signals.push({
      label: 'Analyst estimate revisions',
      status: revStatus,
      value: revValue,
      technicalName: 'EPS Revision Momentum (90d)',
    })
  }

  return signals
}

// ─── Sentiment dimension score ────────────────────────────────────────────────

function computeSentimentDimScore(inputs: ConvictionInputs): number {
  // a) Analyst consensus strength (40%)
  let consensusScore = 50
  const trend = inputs.analystRatingTrend
  if (trend && trend.length > 0) {
    const latest = trend[0]
    const sb = latest.strongBuy ?? 0
    const b  = latest.buy ?? 0
    const s  = latest.sell ?? 0
    const ss = latest.strongSell ?? 0
    const total = sb + b + (latest.hold ?? 0) + s + ss
    if (total > 0) {
      consensusScore = clamp0100((sb * 2 + b * 1 - s * 1 - ss * 2) / total * 50 + 50)
    }
  }

  // b) Earnings beat consistency (30%)
  let beatScore = 50
  const surprises = inputs.earningsSurprises
  if (surprises && surprises.length > 0) {
    const last4 = surprises.slice(0, 4)
    const beats = last4.filter(q => {
      const actual = q.epsActual ?? null
      const est    = q.epsEstimate ?? null
      return actual !== null && est !== null && actual > est
    }).length
    beatScore = (beats / last4.length) * 100
  }

  // c) Analyst price target upside (20%)
  let targetScore = 50
  const targetMean   = inputs.analystTargetMean ?? null
  const currentPrice = inputs.currentPrice ?? null
  if (targetMean !== null && currentPrice !== null && currentPrice > 0) {
    const gap = (targetMean - currentPrice) / currentPrice
    if (targetMean > currentPrice) {
      targetScore = clamp0100(gap * 200)
    } else {
      targetScore = clamp0100(50 + gap * 100)
    }
  }

  // d) Insider ownership signal (10%)
  let insiderScore = 50
  const insiderPct = inputs.insiderPct ?? null
  if (insiderPct !== null) {
    if (insiderPct >= 0.10)      insiderScore = 85
    else if (insiderPct >= 0.05) insiderScore = 70
    else if (insiderPct >= 0.01) insiderScore = 50
    else                          insiderScore = 35
  }

  return clamp0100(
    consensusScore * 0.40 +
    beatScore      * 0.30 +
    targetScore    * 0.20 +
    insiderScore   * 0.10,
  )
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

  // ── Dimension 1: Valuation Attractiveness (weight 27%) ────────────────────
  const valRatingNorm = normalizeRating(ratings.valuation.score)
  const upsideScore   = upsideSignalScore(upsidePct)
  let valDimScore = valRatingNorm * 0.60 + upsideScore * 0.40

  const valPassRate = verdictDimPassRate(verdict, 'valuation')
  if (valPassRate !== null) {
    // Blend in verdict valuation pass rate at 20%, re-weight others
    valDimScore = valRatingNorm * 0.48 + upsideScore * 0.32 + valPassRate * 100 * 0.20
  }

  // Forward PE discount modifier
  const analystForwardPE = inputs.analystForwardPE ?? null
  if (analystForwardPE !== null && analystForwardPE > 0 && analystForwardPE < 100) {
    // Forward PE < 20 (growing earnings) gives a small positive nudge
    if (analystForwardPE < 20) {
      valDimScore = clamp0100(valDimScore + 5)
    } else if (analystForwardPE > 40) {
      valDimScore = clamp0100(valDimScore - 3)
    }
  }

  // Price-to-book modifier
  const priceToBook = inputs.priceToBook ?? null
  if (priceToBook !== null && priceToBook > 0) {
    if (priceToBook < 1) {
      valDimScore = clamp0100(valDimScore + 5)
    } else if (priceToBook > 5) {
      valDimScore = clamp0100(valDimScore - 5)
    }
  }

  // ── Dimension 2: Business Quality (weight 23%) ────────────────────────────
  const moatNorm  = normalizeRating(ratings.moat.score)
  const profNorm  = normalizeRating(ratings.profitability.score)
  let qualDimScore = moatNorm * 0.50 + profNorm * 0.50

  const qualPassRate = verdictDimPassRate(verdict, 'quality')
  if (qualPassRate !== null) {
    if (qualPassRate >= 0.75) qualDimScore = clamp0100(qualDimScore + 5)
    else if (qualPassRate < 0.50) qualDimScore = clamp0100(qualDimScore - 5)
  }

  // Gross profitability modifier (Novy-Marx 2013) — ±7 pts
  // GP/Assets ≥ 0.33 (top tercile) → strong quality signal; < 0.10 → weak
  if (inputs.grossProfitability !== null && inputs.grossProfitability !== undefined && isFinite(inputs.grossProfitability)) {
    const gp = inputs.grossProfitability
    if (gp >= 0.33) qualDimScore = clamp0100(qualDimScore + 7)
    else if (gp >= 0.20) qualDimScore = clamp0100(qualDimScore + 3)
    else if (gp < 0.10) qualDimScore = clamp0100(qualDimScore - 5)
  }

  // ── Dimension 3: Financial Health (weight 18%) ────────────────────────────
  const liqNorm     = normalizeRating(ratings.liquidity.score)
  const altmanMod   = altman == null ? 50 : altman.zone === 'Safe' ? 100 : altman.zone === 'Grey' ? 50 : 0
  const pioMod      = piotroski == null ? 50 : (piotroski.score / 9) * 100
  const healthDimScore = liqNorm * 0.50 + altmanMod * 0.30 + pioMod * 0.20

  // ── Dimension 4: Growth Momentum (weight 14%) ─────────────────────────────
  const growthNorm = normalizeRating(ratings.growth.score)
  let growthDimScore: number

  const growthPassRate = verdictDimPassRate(verdict, 'growth')
  if (growthPassRate !== null) {
    growthDimScore = growthNorm * 0.70 + growthPassRate * 100 * 0.30
  } else {
    growthDimScore = growthNorm
  }

  // Relative performance alpha modifier
  const holdingReturns = inputs.holdingReturns ?? null
  if (holdingReturns) {
    const stock1y = holdingReturns.stock1y ?? null
    const spy1y   = holdingReturns.spy1y ?? null
    if (stock1y !== null && spy1y !== null) {
      const alpha = stock1y - spy1y
      if (alpha > 0.10) {
        growthDimScore = clamp0100(growthDimScore + 5)
      } else if (alpha < -0.10) {
        growthDimScore = clamp0100(growthDimScore - 5)
      }
    }
  }

  // ── Dimension 5: Earnings Integrity (weight 5%) ───────────────────────────
  const beneishMod = beneish == null ? 60 : beneish.flag === 'Clean' ? 100 : beneish.flag === 'Warning' ? 40 : 0
  const accrualCriterion = piotroski?.criteria.find(c => c.name.toLowerCase().includes('accrual'))
  const accrualMod = accrualCriterion == null || accrualCriterion.pass === null
    ? 60
    : accrualCriterion.pass ? 100 : 0
  // Accruals ratio modifier: cash-backed earnings boost integrity score
  const accrualsRatio = inputs.accrualsRatio ?? null
  const accrualRatioMod = accrualsRatio == null ? 60
    : accrualsRatio <= 0.01 ? 100   // cash-backed
    : accrualsRatio <= 0.10 ? 65    // moderate
    : 20                            // accrual-driven
  let integrityDimScore = beneishMod * 0.40 + accrualMod * 0.35 + accrualRatioMod * 0.25

  // Earnings surprise magnitude modifier
  const surprises = inputs.earningsSurprises ?? null
  if (surprises && surprises.length > 0) {
    const last4 = surprises.slice(0, 4)
    // Count negative surprises
    const negativeBeats = last4.filter(q => {
      const actual = q.epsActual ?? null
      const est    = q.epsEstimate ?? null
      return actual !== null && est !== null && actual < est
    }).length
    if (negativeBeats > 2) {
      integrityDimScore = clamp0100(integrityDimScore - 5)
    }
    // Average surprise magnitude boost
    const validSurprises = last4
      .map(q => q.surprisePercent ?? null)
      .filter((v): v is number => v !== null)
    if (validSurprises.length > 0) {
      const avgSurprise = validSurprises.reduce((a, b) => a + b, 0) / validSurprises.length
      if (avgSurprise > 5) {
        integrityDimScore = clamp0100(integrityDimScore + 3)
      }
    }
  }

  // ── Dimension 6: Risk Profile (weight 5%) ─────────────────────────────────
  let riskDimScore = 50
  if (riskDimensions.length > 0) {
    const avgRiskScore = riskDimensions.reduce((s, d) => s + d.score, 0) / riskDimensions.length
    riskDimScore = (1 - avgRiskScore / 3) * 100
  }

  // ── Dimension 7: Analyst & Market Sentiment (weight 8%) ───────────────────
  const sentimentDimScore = computeSentimentDimScore(inputs)

  // ── Weighted conviction score (rebalanced) ────────────────────────────────
  const rawScore =
    valDimScore       * 0.27 +
    qualDimScore      * 0.23 +
    healthDimScore    * 0.18 +
    growthDimScore    * 0.14 +
    integrityDimScore * 0.05 +
    riskDimScore      * 0.05 +
    sentimentDimScore * 0.08

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
      signals: qualitySignals(ratings, verdict, inputs.grossProfitability ?? null),
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
      signals: integritySignals(beneish, piotroski, inputs.accrualsRatio ?? null),
    },
    {
      id: 'risk',
      label: 'Risk Profile',
      question: 'How much risk am I taking on?',
      score: Math.round(clamp0100(riskDimScore)),
      color: dimColor(clamp0100(riskDimScore)),
      signals: riskSignals(riskDimensions),
    },
    {
      id: 'sentiment',
      label: 'Analyst & Market Sentiment',
      question: 'What do analysts and insiders think?',
      score: Math.round(clamp0100(sentimentDimScore)),
      color: dimColor(clamp0100(sentimentDimScore)),
      signals: sentimentSignals(inputs),
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
