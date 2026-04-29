/**
 * Valuation interpretation layer.
 *
 * Generates structured, data-driven text for each part of the valuation UI.
 * No API calls. Pure functions. All text derived from input values.
 *
 * Source: ssrn-1025424 §I (context for what matters in each section)
 */

import type {
  ValuationInput,
  ValuationInterpretation,
  ModelResult,
  MultiplesResult,
  TriangulatedResult,
} from './types'
import { VALUATION_CONFIG } from '@/config/valuation.config'

interface AllResults {
  fcff: ModelResult | null
  fcfe: ModelResult | null
  ddm: ModelResult | null
  multiples: MultiplesResult | null
  triangulated: TriangulatedResult | null
}

export function buildValuationInterpretation(
  input: ValuationInput,
  results: AllResults,
): ValuationInterpretation {
  const { currentPrice, companyName, companyType } = input
  const tri = results.triangulated
  const fv = tri?.fairValue ?? input.fairValuePerShareFCFF ?? null
  const upside = tri?.upsidePct ?? input.upsidePctFCFF ?? null

  // Primary method label
  const primaryMethod = getPrimaryMethodLabel(companyType, input.ddmApplicable)

  // Rationale
  const rationale = getModelRationale(companyType)

  // Scenario range
  const bull = input.scenarios?.bull?.fairValue
  const bear = input.scenarios?.bear?.fairValue
  const scenarioRange = (bull != null && bear != null)
    ? `$${bear.toFixed(2)} – $${bull.toFixed(2)} (bear–bull)`
    : fv != null ? `Base case: $${fv.toFixed(2)}` : '—'

  // Key risk
  const keyRisk = buildKeyRisk(input)

  // Upside zone
  const zone = tri?.upsideZone ?? getUpsideZoneLabel(upside)

  // Summary paragraph (2–3 sentences)
  const upsideStr = upside != null
    ? `${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(1)}%`
    : '—'
  const fvStr = fv != null ? `$${fv.toFixed(2)}` : '—'
  const priceStr = currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'

  let summary = `At the current price of ${priceStr}, `
  if (fv != null && upside != null) {
    summary += `the ${primaryMethod} model implies a fair value of ${fvStr} (${upsideStr} upside), placing ${companyName} in the ${zone} zone. `
  } else {
    summary += `the valuation model could not produce a reliable fair value estimate. `
  }

  // Add WACC + growth context
  summary += `The analysis uses a WACC of ${(input.wacc * 100).toFixed(1)}% and a ${(input.cagr * 100).toFixed(1)}% growth assumption, converging to a ${(input.terminalG * 100).toFixed(1)}% terminal rate. `

  // Add confidence signal from residual value / scores
  if (input.piotroskiScore != null) {
    summary += input.piotroskiScore >= 7
      ? `A Piotroski F-Score of ${input.piotroskiScore}/9 supports financial quality of the underlying assumptions.`
      : input.piotroskiScore <= 3
      ? `A low Piotroski F-Score of ${input.piotroskiScore}/9 introduces uncertainty into the quality of projected cash flows.`
      : ''
  }

  // Margin of safety recommendation
  const mosRecommendation = buildMoSRecommendation(upside, zone, input)

  return {
    summary: summary.trim(),
    primaryMethod,
    rationale,
    scenarioRange,
    keyRisk,
    marginOfSafetyRecommendation: mosRecommendation,
  }
}

function getPrimaryMethodLabel(companyType: ValuationInput['companyType'], hasDividend: boolean): string {
  switch (companyType) {
    case 'financial': return hasDividend ? 'FCFE + DDM blend' : 'FCFE (Equity DCF)'
    case 'dividend':  return 'DDM + DCF blend'
    case 'growth':    return 'DCF (FCFF) + EV Multiples'
    case 'startup':   return 'Revenue Multiples + DCF'
    case 'standard':  return hasDividend ? 'DCF (FCFF) + DDM' : 'DCF (FCFF)'
  }
}

function getModelRationale(companyType: ValuationInput['companyType']): string {
  switch (companyType) {
    case 'financial':
      return 'Banks and fintechs have operating cash flows distorted by loan book changes. FCFE (net income as equity CF proxy) and DDM are the appropriate models. FCFF/WACC DCF is not reliable for financial companies. Source: ssrn-743229 §3.4.'
    case 'dividend':
      return 'Mature dividend payers are best valued with the Gordon Growth DDM (P = D₁/(Ke−g)), where the dividend stream represents the investor\'s direct cash return. FCFF DCF serves as a cross-check.'
    case 'growth':
      return 'High-growth companies are valued primarily on FCFF DCF with a high CAGR assumption and three-stage growth model. EV/EBITDA and EV/Revenue multiples provide a market-based sanity check.'
    case 'startup':
      return 'Pre-profitability companies have speculative cash flows. Revenue-based multiples (P/S, EV/Revenue) reflect market pricing of growth potential. DCF uses a revenue-seeded FCF estimate and should be treated as directional only.'
    case 'standard':
      return 'Standard companies are valued with FCFF DCF (discounting free cash flows at WACC) as the primary model. Relative multiples (P/E, EV/EBITDA) cross-check intrinsic value against peer pricing.'
  }
}

function buildKeyRisk(input: ValuationInput): string {
  const risks: string[] = []

  if (input.altmanZone === 'Distress') {
    risks.push('Altman Z-Score signals financial distress — going concern risk may not be fully captured by DCF.')
  }
  if (input.beneishFlag === 'Manipulator') {
    risks.push('Beneish M-Score flags potential earnings manipulation — reported FCF may overstate true cash generation.')
  }
  if (input.debtToEquity > 2) {
    risks.push(`High leverage (D/E: ${input.debtToEquity.toFixed(1)}x) amplifies downside in bear scenarios.`)
  }
  if (input.baseFCF < 0) {
    risks.push('Negative current FCF — valuation depends entirely on projected future profitability turning positive.')
  }
  if (input.terminalG > 0.025) {
    risks.push(`Terminal growth of ${(input.terminalG * 100).toFixed(1)}% is above long-run nominal GDP — terminal value assumptions are aggressive.`)
  }
  if (input.companyType === 'financial') {
    risks.push('Financial sector: FCFF not reliable. FCFE model depends on stable net income as equity CF proxy.')
  }

  // Residual value dominance
  if (input.evFromFCFF && input.evFromFCFF > 0 && input.projectedFCFs) {
    const explicitPV = input.projectedFCFs.reduce((s, p) => s + p.discounted, 0)
    const residualPct = 1 - explicitPV / input.evFromFCFF
    if (residualPct > 0.80) {
      risks.push(`Terminal value represents ~${(residualPct * 100).toFixed(0)}% of EV — small changes in g or WACC have outsized impact. Source: ssrn-1025424 §I.7.`)
    }
  }

  if (risks.length === 0) {
    return 'No critical risks flagged by automated checks. Standard DCF limitations apply (garbage-in, garbage-out).'
  }

  return risks.slice(0, 2).join(' ')
}

function buildMoSRecommendation(
  upsidePct: number | null,
  zone: 'Attractive' | 'Fair Value' | 'Expensive' | string,
  input: ValuationInput,
): string {
  const { attractive, fairValue } = VALUATION_CONFIG.upsideZones

  if (upsidePct == null) return 'Insufficient data to provide a margin of safety recommendation.'

  if (zone === 'Attractive') {
    const mosBuffer = upsidePct - attractive
    return `Stock appears undervalued with ${(upsidePct * 100).toFixed(1)}% upside. Provides a ${(mosBuffer * 100).toFixed(1)}% buffer beyond the ${(attractive * 100).toFixed(0)}% attractiveness threshold. Consider position sizing based on conviction in CAGR assumptions.`
  }

  if (zone === 'Fair Value') {
    return `Stock appears fairly valued (+${(upsidePct * 100).toFixed(1)}% upside). Limited margin of safety at current price. Consider waiting for a price decline to add a buffer, or assign a higher weight to bear-case scenario.`
  }

  // Expensive
  return `Stock appears overvalued (${(upsidePct * 100).toFixed(1)}% implied upside/downside). Current price exceeds the base-case fair value estimate. Bull scenario must materialize to justify current valuation.`
}

function getUpsideZoneLabel(upside: number | null): 'Attractive' | 'Fair Value' | 'Expensive' {
  if (upside == null) return 'Fair Value'
  if (upside >= VALUATION_CONFIG.upsideZones.attractive) return 'Attractive'
  if (upside >= VALUATION_CONFIG.upsideZones.fairValue) return 'Fair Value'
  return 'Expensive'
}
