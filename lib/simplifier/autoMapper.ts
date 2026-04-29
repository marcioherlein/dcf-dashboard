import type { SimplifierAutoMap, AutoHint, Answer } from './types'

/**
 * Shape of the data returned by /api/financials — only the fields we need.
 * Using a loose interface so we don't break if the API adds/removes fields.
 */
export interface FinancialsData {
  businessProfile?: {
    grossMargin?: number | null
    fcfMargin?: number | null
    industry?: string
    country?: string
  }
  wacc?: {
    inputs?: { beta?: number }
  }
  scores?: {
    roic?: { roic?: number; spread?: number; dataAvailable?: boolean }
    altman?: { zone?: 'Safe' | 'Grey' | 'Distress' }
    beneish?: { flag?: 'Clean' | 'Warning' | 'Manipulator' }
    piotroski?: {
      score?: number
      criteria?: Array<{ name: string; pass: boolean }>
    }
  }
  ratings?: {
    moat?: { score?: number }
    growth?: { score?: number }
    valuation?: { score?: number }
  }
  cagrAnalysis?: {
    historicalCagr3y?: number
    analystEstimate1y?: number
    blended?: number
    analystEstimate2y?: number
    fundamentalGrowth?: number | null
    confidence?: number
    confidenceLabel?: string
    numAnalysts?: number
  }
  ownership?: {
    insiderPct?: number | null
  }
  fairValue?: {
    upsidePct?: number
  }
  scenarios?: {
    base?: { upside?: number }
  }
  financialStatements?: {
    incomeStatement?: Array<{
      year: string
      revenue?: number | null
      grossProfit?: number | null
      operatingIncome?: number | null
      netIncome?: number | null
      eps?: number | null
      operatingMargin?: number | null
      isProjected?: boolean
    }>
    cashFlow?: Array<{
      year: string
      freeCashFlow?: number | null
      operatingCF?: number | null
      dividendsPaid?: number | null
      buybacks?: number | null
      financingCF?: number | null
      isProjected?: boolean
    }>
    balanceSheet?: Array<{
      year: string
      cash?: number | null
      totalEquity?: number | null
      longTermDebt?: number | null
      isProjected?: boolean
    }>
  }
}

function pctStr(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function hint(suggestedAnswer: Answer, rationale: string, displayValue: string): AutoHint {
  return { suggestedAnswer, rationale, displayValue }
}

/**
 * Maps financial data to yes/partial/no suggestions for each question.
 * Returns a flat map of questionId → AutoHint.
 * Questions with no financial signal are omitted from the map.
 */
export function buildAutoMap(data: FinancialsData): SimplifierAutoMap {
  const map: SimplifierAutoMap = {}

  const gm     = data.businessProfile?.grossMargin ?? null
  const fcfM   = data.businessProfile?.fcfMargin ?? null
  const beta   = data.wacc?.inputs?.beta ?? null
  const roic   = data.scores?.roic?.roic ?? null
  const spread = data.scores?.roic?.spread ?? null
  const moatScore = data.ratings?.moat?.score ?? null
  const cagr3y = data.cagrAnalysis?.historicalCagr3y ?? null
  const analystGrowth = data.cagrAnalysis?.analystEstimate1y ?? null
  const insiderPct = data.ownership?.insiderPct ?? null
  const altmanZone = data.scores?.altman?.zone ?? null
  const beneishFlag = data.scores?.beneish?.flag ?? null
  const piotroski = data.scores?.piotroski ?? null
  const upsidePct = data.fairValue?.upsidePct ?? null

  // ── Phase 1: Business Quality ──────────────────────────────────────

  // Revenue predictability: use 3Y CAGR as a proxy for consistency
  if (cagr3y !== null) {
    const ans: Answer = cagr3y >= 0.08 ? 'yes' : cagr3y >= 0.03 ? 'partial' : 'no'
    map['bq_revenue_predictability'] = hint(
      ans,
      `3Y Revenue CAGR ${pctStr(cagr3y)} suggests ${ans === 'yes' ? 'consistent' : ans === 'partial' ? 'moderate' : 'inconsistent'} revenue growth`,
      `3Y CAGR: ${pctStr(cagr3y)}`
    )
  }

  // Pricing power: gross margin
  if (gm !== null) {
    const ans: Answer = gm >= 0.4 ? 'yes' : gm >= 0.25 ? 'partial' : 'no'
    map['bq_pricing_power'] = hint(
      ans,
      `Gross margin ${pctStr(gm)} — ${ans === 'yes' ? 'strong' : ans === 'partial' ? 'moderate' : 'thin'} pricing power`,
      `Gross Margin: ${pctStr(gm)}`
    )
  }

  // Recession-proof: beta
  if (beta !== null) {
    const ans: Answer = beta < 0.8 ? 'yes' : beta < 1.1 ? 'partial' : 'no'
    map['bq_recession_proof'] = hint(
      ans,
      `Beta ${beta.toFixed(2)} — ${ans === 'yes' ? 'low market sensitivity' : ans === 'partial' ? 'moderate sensitivity' : 'high market sensitivity'}`,
      `Beta: ${beta.toFixed(2)}`
    )
  }

  // Unit economics: FCF margin or gross margin
  if (fcfM !== null) {
    const ans: Answer = fcfM >= 0.15 ? 'yes' : fcfM >= 0.06 ? 'partial' : 'no'
    map['bq_unit_economics'] = hint(
      ans,
      `FCF margin ${pctStr(fcfM)} — ${ans === 'yes' ? 'strong' : ans === 'partial' ? 'developing' : 'weak'} cash generation`,
      `FCF Margin: ${pctStr(fcfM)}`
    )
  } else if (gm !== null) {
    const ans: Answer = gm >= 0.5 ? 'partial' : 'no'
    map['bq_unit_economics'] = hint(
      ans,
      `No FCF margin data; gross margin ${pctStr(gm)} — ${ans === 'partial' ? 'potential path to strong economics' : 'limited visibility on unit economics'}`,
      `Gross Margin: ${pctStr(gm)} (FCF N/A)`
    )
  }

  // ── Phase 2: Competitive Moat ──────────────────────────────────────

  // Intangibles: moat score as proxy
  if (moatScore !== null) {
    const ans: Answer = moatScore >= 4.0 ? 'yes' : moatScore >= 3.0 ? 'partial' : 'no'
    map['moat_intangibles'] = hint(
      ans,
      `Overall moat rating ${moatScore.toFixed(1)}/5 — ${ans === 'yes' ? 'strong evidence of intangible assets' : ans === 'partial' ? 'some intangible value' : 'limited evidence of intangible moat'}`,
      `Moat Score: ${moatScore.toFixed(1)}/5`
    )
  }

  // Cost advantage: ROIC spread
  if (spread !== null) {
    const ans: Answer = spread >= 0.08 ? 'yes' : spread >= 0.03 ? 'partial' : 'no'
    map['moat_cost_advantage'] = hint(
      ans,
      `ROIC spread ${pctStr(spread)} above WACC — ${ans === 'yes' ? 'clear cost/returns advantage' : ans === 'partial' ? 'modest advantage' : 'no excess returns above cost of capital'}`,
      `ROIC Spread: ${pctStr(spread)}`
    )
  } else if (roic !== null) {
    const ans: Answer = roic >= 0.15 ? 'partial' : 'no'
    map['moat_cost_advantage'] = hint(
      ans,
      `ROIC ${pctStr(roic)} (WACC unavailable for spread)`,
      `ROIC: ${pctStr(roic)}`
    )
  }

  // ── Phase 3: Growth ────────────────────────────────────────────────

  // Organic growth: no share dilution (piotroski criterion 7) + cagr
  if (piotroski?.criteria) {
    const noDilution = piotroski.criteria.find((c) => c.name.toLowerCase().includes('dilu'))
    if (noDilution) {
      const ans: Answer = noDilution.pass ? 'yes' : 'partial'
      map['growth_organic_vs_acquisition'] = hint(
        ans,
        noDilution.pass
          ? 'No share dilution detected — growth appears organic'
          : 'Share count increased — acquisition-driven growth possible',
        noDilution.pass ? 'No dilution' : 'Dilution detected'
      )
    }
  }

  // Margin expansion: compare operating margins across historical IS rows
  const isRows = (data.financialStatements?.incomeStatement ?? [])
    .filter((r) => !r.isProjected && r.operatingMargin != null)
    .slice(0, 4)
  if (isRows.length >= 2) {
    const oldest = isRows[isRows.length - 1].operatingMargin!
    const newest = isRows[0].operatingMargin!
    const improving = newest > oldest + 0.01
    const stable   = Math.abs(newest - oldest) <= 0.01
    const ans: Answer = improving ? 'yes' : stable ? 'partial' : 'no'
    map['growth_margin_expansion'] = hint(
      ans,
      `Operating margin ${pctStr(oldest)} → ${pctStr(newest)} — ${improving ? 'expanding' : stable ? 'stable' : 'compressing'}`,
      `Op. Margin trend: ${pctStr(oldest)} → ${pctStr(newest)}`
    )
  }

  // Reinvestment quality: ROIC spread
  if (spread !== null) {
    const ans: Answer = spread >= 0.05 ? 'yes' : spread >= 0.0 ? 'partial' : 'no'
    map['growth_reinvestment_quality'] = hint(
      ans,
      `ROIC spread ${pctStr(spread)} — ${ans === 'yes' ? 'reinvesting above cost of capital' : ans === 'partial' ? 'marginal excess returns' : 'reinvesting below cost of capital'}`,
      `ROIC Spread: ${pctStr(spread)}`
    )
  }

  // Analyst confidence
  if (analystGrowth !== null) {
    const ans: Answer = analystGrowth >= 0.1 ? 'yes' : analystGrowth >= 0.05 ? 'partial' : 'no'
    map['growth_analyst_confidence'] = hint(
      ans,
      `Analyst consensus growth estimate ${pctStr(analystGrowth)} — ${ans === 'yes' ? 'strong forward growth expected' : ans === 'partial' ? 'moderate growth expected' : 'muted growth expectations'}`,
      `Analyst Est.: ${pctStr(analystGrowth)}`
    )
  }

  // ── Phase 4: Management ────────────────────────────────────────────

  // Insider ownership
  if (insiderPct !== null) {
    const ans: Answer = insiderPct >= 0.1 ? 'yes' : insiderPct >= 0.03 ? 'partial' : 'no'
    map['mgmt_insider_ownership'] = hint(
      ans,
      `Insiders own ${pctStr(insiderPct)} — ${ans === 'yes' ? 'strong alignment' : ans === 'partial' ? 'modest alignment' : 'minimal insider ownership'}`,
      `Insider %: ${pctStr(insiderPct)}`
    )
  }

  // Capital allocation: piotroski — no dilution AND leverage falling
  if (piotroski?.criteria) {
    const noDilution   = piotroski.criteria.find((c) => c.name.toLowerCase().includes('dilu'))
    const levFalling   = piotroski.criteria.find((c) => c.name.toLowerCase().includes('lever'))
    if (noDilution && levFalling) {
      const both = noDilution.pass && levFalling.pass
      const one  = noDilution.pass || levFalling.pass
      const ans: Answer = both ? 'yes' : one ? 'partial' : 'no'
      map['mgmt_capital_allocation'] = hint(
        ans,
        `No dilution: ${noDilution.pass ? '✓' : '✗'}, Leverage falling: ${levFalling.pass ? '✓' : '✗'}`,
        `Dilution: ${noDilution.pass ? 'None' : 'Yes'} | Leverage: ${levFalling.pass ? 'Falling' : 'Rising'}`
      )
    }
  }

  // Track record: piotroski score as proxy
  if (piotroski?.score != null) {
    const ans: Answer = piotroski.score >= 7 ? 'yes' : piotroski.score >= 4 ? 'partial' : 'no'
    map['mgmt_track_record'] = hint(
      ans,
      `Piotroski F-Score ${piotroski.score}/9 — ${ans === 'yes' ? 'strong financial track record' : ans === 'partial' ? 'mixed track record' : 'weak financial track record'}`,
      `Piotroski: ${piotroski.score}/9`
    )
  }

  // Transparency: Beneish M-Score
  if (beneishFlag) {
    const ans: Answer = beneishFlag === 'Clean' ? 'yes' : beneishFlag === 'Warning' ? 'partial' : 'no'
    map['mgmt_transparency'] = hint(
      ans,
      `Beneish M-Score: ${beneishFlag} — ${ans === 'yes' ? 'no earnings manipulation signals' : ans === 'partial' ? 'some accounting red flags' : 'potential earnings manipulation detected'}`,
      `Beneish: ${beneishFlag}`
    )
  }

  // ── Phase 5: Risk & Valuation ──────────────────────────────────────

  // Financial health: Altman Z
  if (altmanZone) {
    const ans: Answer = altmanZone === 'Safe' ? 'yes' : altmanZone === 'Grey' ? 'partial' : 'no'
    map['risk_financial_health'] = hint(
      ans,
      `Altman Z-Score zone: ${altmanZone} — ${ans === 'yes' ? 'low insolvency risk' : ans === 'partial' ? 'some financial stress signals' : 'high insolvency risk'}`,
      `Altman: ${altmanZone}`
    )
  }

  // Macro exposure: beta
  if (beta !== null) {
    const ans: Answer = beta < 1.0 ? 'yes' : beta < 1.3 ? 'partial' : 'no'
    map['risk_macro_exposure'] = hint(
      ans,
      `Beta ${beta.toFixed(2)} — ${ans === 'yes' ? 'relatively macro-insulated' : ans === 'partial' ? 'moderate macro exposure' : 'high macro sensitivity'}`,
      `Beta: ${beta.toFixed(2)}`
    )
  }

  // Price reasonable: DCF upside
  if (upsidePct !== null) {
    const ans: Answer = upsidePct >= 0.15 ? 'yes' : upsidePct >= 0 ? 'partial' : 'no'
    map['val_price_reasonable'] = hint(
      ans,
      `DCF upside ${pctStr(upsidePct)} — ${ans === 'yes' ? 'trading below intrinsic value' : ans === 'partial' ? 'fairly valued' : 'trading above intrinsic value'}`,
      `DCF Upside: ${pctStr(upsidePct)}`
    )
  }

  // Margin of safety: base case upside > 25%
  if (upsidePct !== null) {
    const ans: Answer = upsidePct >= 0.25 ? 'yes' : upsidePct >= 0.1 ? 'partial' : 'no'
    map['val_margin_of_safety'] = hint(
      ans,
      `Base-case DCF upside ${pctStr(upsidePct)} — ${ans === 'yes' ? 'strong margin of safety' : ans === 'partial' ? 'limited margin of safety' : 'no margin of safety'}`,
      `Upside: ${pctStr(upsidePct)}`
    )
  }

  return map
}
