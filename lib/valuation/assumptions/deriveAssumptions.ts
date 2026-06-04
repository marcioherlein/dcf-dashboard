/**
 * Derives Forward P/E and Revenue Multiple assumptions from the /api/financials
 * response (FinancialsData). Generalizes the logic in lib/ai-stack/valuation.ts
 * to work with any stock, not just AI Stack companies.
 *
 * Returns ValuationAssumption[] (for the drawer UI) + EvidenceItem[] (for derivation text).
 */

import type { ValuationAssumption, EvidenceItem, AssumptionSource } from '@/components/valuation/ValuationModelDrawer'
import { VALUATION_CONFIG } from '@/config/valuation.config'
import { getIndustryMultiples } from '@/lib/dcf/calculateMultiples'

// Fintech / neobank / digital finance industries — used for P/E floor in deriveExitPE
const FINTECH_INDUSTRY_RE = /fintech|neobank|digital.?bank|payment|credit.?service|consumer.?finance|insurtech/i

// ─── Sector CAGR fallback (when no analyst/historical data available) ─────────

const SECTOR_CAGR: Record<string, number> = {
  'Technology':             0.12,
  'Communication Services': 0.08,
  'Consumer Cyclical':      0.07,
  'Consumer Defensive':     0.04,
  'Healthcare':             0.08,
  'Financial Services':     0.06,
  'Industrials':            0.05,
  'Basic Materials':        0.04,
  'Energy':                 0.03,
  'Utilities':              0.03,
  'Real Estate':            0.05,
}

function pct(v: number): string { return (v * 100).toFixed(1) + '%' }

// ─── CAGR derivation ─────────────────────────────────────────────────────────

function deriveCagr(
  cagrAnalysis: CAGRAnalysisLike | null,
  sectorFallback: number,
): { cagr: number; evidence: string; source: AssumptionSource } {
  if (!cagrAnalysis) {
    return {
      cagr: sectorFallback,
      evidence: `No analyst or historical growth data · using sector default ${pct(sectorFallback)} (adjust manually in Valuation tab)`,
      source: 'sector_fallback',
    }
  }

  const blended = cagrAnalysis.blended ?? sectorFallback
  const numAnalysts = cagrAnalysis.numAnalysts ?? 0
  const source: AssumptionSource = numAnalysts >= 3 ? 'analyst_estimate' : 'historical_3y_median'

  const hist = cagrAnalysis.historicalCagr3y != null ? pct(cagrAnalysis.historicalCagr3y) : '—'
  const a1   = cagrAnalysis.analystEstimate1y != null ? pct(cagrAnalysis.analystEstimate1y) : '—'
  const a2   = cagrAnalysis.analystEstimate2y != null ? pct(cagrAnalysis.analystEstimate2y) : '—'
  const confidence = cagrAnalysis.confidenceLabel ?? 'Low'

  const evidence = numAnalysts >= 3
    ? `${numAnalysts} analysts: FY+1 ${a1}, FY+2 ${a2}; hist 3Y ${hist} → blended ${pct(blended)} (${confidence} confidence)`
    : `Historical 3Y CAGR ${hist}; analyst coverage limited → ${pct(blended)} (${confidence} confidence)`

  return { cagr: blended, evidence, source }
}

// ─── Net margin derivation ────────────────────────────────────────────────────

function deriveNetMargin(
  incomeStatement: IncomeRow[],
  cagr: number = 0,
): { margin: number; evidence: string; source: AssumptionSource } {
  const actuals = incomeStatement.filter(r => !r.isProjected)
  const withBoth = actuals.filter(r => r.netIncome != null && r.revenue != null && r.revenue > 0)
  if (withBoth.length === 0) {
    return {
      margin: 0.05,
      evidence: 'No net income data → fallback 5% margin',
      source: 'sector_fallback',
    }
  }

  const margins = withBoth.map(r => r.netIncome! / r.revenue!)
  const median  = margins.sort((a, b) => a - b)[Math.floor(margins.length / 2)]
  const last    = margins[margins.length - 1]
  const source: AssumptionSource = withBoth.length >= 3 ? 'historical_3y_median' : 'historical_5y_median'

  const grossMargins = actuals.filter(r => r.grossProfit != null && r.revenue != null && r.revenue > 0)
  const lastGM = grossMargins.length > 0 ? (grossMargins[grossMargins.length - 1].grossProfit! / grossMargins[grossMargins.length - 1].revenue!) : null

  // Convergence model for high-growth, high-gross-margin, thin-net-margin companies.
  // Additive bumps systematically undershoot for DUOL-type SaaS: 6% + 3% = 9% when the
  // realistic 5-year steady state is 15–20%. Use a 70/30 blend toward a sector target instead.
  const isHighGrowthSaaS = cagr > 0.15 && lastGM != null && lastGM > 0.60 && last > 0 && last < 0.10

  const isHighGrowth = margins.length >= 2 && (last - margins[0]) / Math.abs(margins[0] || 1) > 0.02
  const hasMoat      = lastGM != null && lastGM > 0.40
  const improvement  = (isHighGrowth && hasMoat) ? 0.03 : (isHighGrowth || hasMoat) ? 0.015 : 0.005

  let projectedMargin: number
  let reason: string

  if (last <= 0) {
    projectedMargin = lastGM != null && lastGM >= 0.50 ? 0.08
                    : lastGM != null && lastGM >= 0.30 ? 0.05
                    : 0.03
    reason = `Pre-profit (${pct(last)}) → path to ${pct(projectedMargin)} via gross margin`
  } else if (isHighGrowthSaaS) {
    // 70% pull toward 18% SaaS steady-state target + 30% anchor on today's margin.
    // This reflects that high-GM software companies reliably expand margins as scale grows,
    // but landing exactly at target in 5 years is not guaranteed.
    const targetMargin = 0.18
    projectedMargin = Math.max(0.01, last * 0.30 + targetMargin * 0.70)
    reason = `high-growth SaaS convergence: ${pct(last)} trailing × 30% + ${pct(targetMargin)} target × 70% → ${pct(projectedMargin)}`
  } else {
    projectedMargin = Math.max(0.01, Math.min(0.70, last + improvement))
    // 70% cap: allows ultra-high-margin businesses (NVDA at 55%, Visa at 52%) to project
    // their actual margins forward. The old 50% cap was silently suppressing NVDA's real
    // earnings power in the Forward P/E model.
    reason = isHighGrowth && hasMoat ? `high growth + moat (+3%)`
           : isHighGrowth            ? `improving trend (+1.5%)`
           : hasMoat                 ? `strong gross margin (+1.5%)`
           : `stable (+0.5%)`
    reason = `${pct(last)} trailing → ${pct(projectedMargin)} (${reason})`
  }

  return {
    margin: projectedMargin,
    evidence: `${withBoth.length}Y median ${pct(median)}, last ${pct(last)}; ${reason}`,
    source,
  }
}

// ─── Exit multiple blending ───────────────────────────────────────────────────
// Blends current trading multiple (55%) with geo-discounted sector median (35%).
// Prevents Damodaran sector values from dominating when the company trades at a
// very different multiple (e.g. PAGS at 6× P/E vs 18× fintech sector median).

export function blendExitMultiple(
  sectorMedian: number,
  currentMultiple: number | null,
  crp: number,
): { blended: number; geoDiscount: number } {
  const geoDiscount = Math.max(0.45, 1 - crp * 5)
  const discountedSector = sectorMedian * geoDiscount

  if (currentMultiple != null && currentMultiple > 0 && currentMultiple < 500) {
    let blended = currentMultiple * 0.55 + discountedSector * 0.35
    blended = Math.min(blended, currentMultiple * 2.5) // cap at 2.5× current (stops wild sector pull-up)
    // Floor: when the current multiple is below 40% of sector median (e.g. DELL at 0.7×
    // EV/Revenue vs 2.0× sector), anchoring the floor to the sector median overstates
    // fair value by 40–100%. Instead, use the current multiple as the floor when it is
    // below the sector median — this preserves the structure of low-multiple businesses.
    const sectorFloor = currentMultiple < sectorMedian * 0.40
      ? currentMultiple * 0.90  // stay close to actual for structurally low-multiple companies
      : sectorMedian * 0.40     // normal floor for companies near sector median
    blended = Math.max(blended, sectorFloor)
    return { blended: Math.round(blended * 2) / 2, geoDiscount }
  }

  // No current multiple: geo-discounted sector only
  const blended = Math.max(sectorMedian * 0.40, Math.round(discountedSector * 2) / 2)
  return { blended, geoDiscount }
}

// ─── Exit P/E derivation ─────────────────────────────────────────────────────

function deriveExitPE(
  sector: string | null,
  industry: string | null,
  currentPE: number | null,
  crp: number = 0,
  trailingMargin: number | null = null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any,
): { pe: number; sectorPE: number; evidence: string; source: AssumptionSource } {
  // Pre-revenue biotech guard: no revenue base means Forward P/E is unreliable.
  // Return exitPE = 0 to signal the cockpit should exclude this method from the blend.
  const isPreRevenueBiotech =
    (sector === 'Healthcare' || (industry ?? '').toLowerCase().includes('biotech')) &&
    (data?.businessProfile?.revenueM ?? 0) < 50
  if (isPreRevenueBiotech) {
    return {
      pe: 0,
      sectorPE: 0,
      evidence: 'Pre-revenue biotech — Forward P/E excluded from blend (no revenue base to project from)',
      source: 'sector_fallback',
    }
  }

  const { pe: sectorPE, source } = getIndustryMultiples(industry ?? '', sector ?? '')

  // Cap the current P/E anchor when it is inflated by thin margins.
  // A tiny earnings denominator pushes P/E to 100×+ even at a "fair" price.
  // Dual condition: current P/E > 2× sector median AND trailing net margin < 10%.
  // Skip for auto-industry stocks (e.g. TSLA is Consumer Cyclical + Auto Manufacturers
  // but uses a fundamentally different P/E structure than software).
  const isAutoIndustry = /Auto Manufacturers|Motor Vehicle/i.test(industry ?? '')
  const isThinMargin   = trailingMargin != null && trailingMargin < 0.10
  const isPEElevated   = currentPE != null && currentPE > 0 && currentPE > sectorPE * 2
  const shouldCapPE    = isThinMargin && isPEElevated && !isAutoIndustry

  const effectivePE = shouldCapPE ? Math.min(currentPE!, sectorPE * 1.5) : currentPE
  const { blended, geoDiscount } = blendExitMultiple(sectorPE, effectivePE, crp)

  const label = industry || sector || 'unknown'
  const companyPEStr  = currentPE != null && currentPE > 0 ? `${currentPE.toFixed(0)}×` : 'N/A'
  const effectivePEStr = effectivePE != null && effectivePE > 0 ? `${effectivePE.toFixed(0)}×` : 'N/A'
  const geoStr = geoDiscount < 0.99 ? ` (geo-discounted ${(geoDiscount * 100).toFixed(0)}%)` : ''
  const capNote = shouldCapPE ? ` [capped from ${companyPEStr} — thin margin inflates current P/E]` : ''

  // Phase 1: Fintech floor — prevents blend from anchoring to traditional bank/credit P/Es (10–14×)
  // Triggered two ways:
  //   (a) Industry name matches fintech/neobank pattern (e.g. "Credit Services", "Consumer Finance")
  //   (b) Financial sector company with CAGR > 20% — Yahoo labels neobanks "Banks - Regional"
  //       but their growth trajectory is fundamentally different from a mature bank
  const isFintechIndustry = FINTECH_INDUSTRY_RE.test(industry ?? '')
  const historicalCagr = data?.cagrAnalysis?.historicalCagr3y ?? 0
  const blendedCagr    = data?.cagrAnalysis?.blended ?? data?.cagrAnalysis?.analystEstimate1y ?? 0
  const effectiveCagrForPE = Math.max(historicalCagr, blendedCagr)
  const isHighGrowthFinancial =
    (sector ?? '').toLowerCase().includes('financ') &&
    effectiveCagrForPE > 0.20
  let finalPE = blended
  let floorNote = ''
  if ((isFintechIndustry || isHighGrowthFinancial) && finalPE < 22) {
    finalPE = 22
    floorNote = isHighGrowthFinancial && !isFintechIndustry
      ? ` [high-growth fintech floor: 22× — ${(effectiveCagrForPE * 100).toFixed(0)}% CAGR in financial sector]`
      : ` [fintech floor applied: 22×]`
  }

  // Phase 1b: Growth premium for high-CAGR fintechs/neobanks.
  // The sector median P/E (22× floor) prices a mature digital bank. A company growing
  // 30%+ for 3+ years with expanding margins deserves a growth premium on exit multiple.
  // Formula: premium = min(15, (CAGR - 0.20) × 50) — adds up to 15× for 50%+ CAGR names.
  // Only applies when CAGR > 25% and the company is fintech/high-growth financial.
  // Rationale: StoneCo at maturity 20×, Nubank at maturity with 35%+ CAGR → 30-35×.
  if ((isFintechIndustry || isHighGrowthFinancial) && effectiveCagrForPE > 0.25) {
    const growthPremium = Math.min(15, (effectiveCagrForPE - 0.20) * 50)
    const premiumPE = Math.max(finalPE, sectorPE + growthPremium)
    if (premiumPE > finalPE) {
      floorNote += ` [growth premium +${growthPremium.toFixed(0)}× for ${(effectiveCagrForPE * 100).toFixed(0)}% CAGR]`
      finalPE = premiumPE
    }
  }

  // Phase 2: AI semiconductor premium — high-CAGR semis trade at 30–40×, not the 26× sector median.
  // Uses the higher of historicalCagr3y and analystEstimate1y so that cyclical semis (MU) where
  // the 3-year historical CAGR was suppressed by a trough year but analysts signal strong growth
  // (HBM/AI DRAM thesis) correctly receive the premium.
  //
  // Floor raised from 32× to 38× to reflect the AI Semiconductors table entry (pe=40×) that
  // Yahoo's 'Semiconductors' industry classification can never reach. NVDA, TSM, and AI-exposed
  // semis realistically exit at 35-45×, not 28-32× like mature chip makers.
  const analystCagrForSemi = data?.cagrAnalysis?.analystEstimate1y ?? 0
  const isAISemi = (industry ?? '').toLowerCase().includes('semiconductor') &&
    (Math.max(data?.cagrAnalysis?.historicalCagr3y ?? 0, analystCagrForSemi) > 0.25)
  if (isAISemi && finalPE < 38) {
    finalPE = 38
    floorNote += ` [AI semi premium applied: floor 38×]`
  }

  const evidence = currentPE != null && currentPE > 0
    ? `Blend: anchor ${effectivePEStr}${capNote} × 55% + sector ${sectorPE}×${geoStr} × 35% → ${finalPE.toFixed(1)}× exit P/E${floorNote}`
    : `No current P/E; sector median ${sectorPE}× (${label})${geoStr} → ${finalPE.toFixed(1)}×${floorNote}`

  return { pe: finalPE, sectorPE, evidence, source: source === 'industry-median' ? 'historical_3y_median' : 'sector_fallback' }
}

// ─── Dilution derivation ─────────────────────────────────────────────────────

function deriveDilution(
  sector: string | null,
  netMargin: number | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any,
): { rate: number; evidence: string; source: AssumptionSource } {
  const sec = sector ?? ''
  const isTech = ['Technology', 'Communication Services', 'Healthcare'].includes(sec)

  // Net buyback detection: if the company is buying back shares faster than it issues SBC,
  // effective dilution is 0% (we don't model negative dilution since the model uses
  // futureShares = shares × (1+rate)^n which doesn't handle rate < 0 cleanly).
  // Proxy: mega-cap tech with net margin > 25% are canonical net-buyback companies (AAPL, GOOGL).
  // Using 0% rather than +1% correctly stops the model from inflating future share counts.
  const isMegaCapNetBuyback = isTech &&
    (netMargin != null && netMargin > 0.25) &&
    ((data?.businessProfile?.revenueM ?? 0) > 100_000)  // revenue > $100B proxy for mega-cap

  let rate: number
  let reason: string
  if (isMegaCapNetBuyback) {
    rate = 0.0  // net buybacks offset SBC — share count flat to declining
    reason = 'mega-cap tech, net margin >25% → net buyback program; 0% dilution assumed'
  } else if (isTech) {
    if (netMargin != null && netMargin > 0.20) { rate = 0.010; reason = 'tech, profitable → ~1.0%/yr (buybacks partially offset SBC)' }
    else if (netMargin != null && netMargin > 0.10) { rate = 0.020; reason = 'tech, moderate margin → ~2.0%/yr' }
    else { rate = 0.030; reason = 'tech, growth stage → ~3.0%/yr (stock-based comp)' }
  } else {
    rate = netMargin != null && netMargin > 0.15 ? 0.005 : 0.010
    reason = `${sec || 'non-tech'} → ~${pct(rate)}/yr`
  }

  return { rate, evidence: reason, source: 'model_default' }
}

// ─── WACC evidence text ───────────────────────────────────────────────────────

function deriveWACCEvidence(waccInputs: WACCInputsLike, wacc: number): string {
  const { rfRate = 0.045, beta = 1.0, erp = VALUATION_CONFIG.erp, costOfDebt, debtToEquity } = waccInputs
  const wtEq  = debtToEquity != null ? `D/E ${(debtToEquity * 100).toFixed(0)}%` : ''
  const codStr = costOfDebt != null ? `, CoD ${pct(costOfDebt)}` : ''
  return `Beta ${beta.toFixed(2)}, RF ${pct(rfRate)}, ERP ${pct(erp)}${codStr}${wtEq ? ', ' + wtEq : ''} → WACC ${pct(wacc)}`
}

// ─── LTM Revenue ─────────────────────────────────────────────────────────────

function ltmRevenue(incomeStatement: IncomeRow[]): number | null {
  const actuals = incomeStatement.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
  if (actuals.length === 0) return null
  return actuals[actuals.length - 1].revenue!
}

// ─── Type shapes (subset of FinancialsData needed here) ──────────────────────

interface IncomeRow {
  year: string
  isProjected: boolean
  revenue: number | null
  netIncome: number | null
  grossProfit: number | null
}

interface CAGRAnalysisLike {
  blended: number
  historicalCagr3y: number | null
  analystEstimate1y: number | null
  analystEstimate2y: number | null
  confidenceLabel?: 'High' | 'Medium' | 'Low'
  numAnalysts?: number
}

interface WACCInputsLike {
  rfRate?: number
  beta?: number
  erp?: number
  costOfDebt?: number
  taxRate?: number
  debtToEquity?: number
}

export interface DerivedForwardPEAssumptions {
  ltvRevenue: number | null
  sharesOutstanding: number | null
  revenueCAGR: number
  netMargin: number
  exitPE: number
  dilutionRate: number
  discountRate: number
  currentPrice: number
  dividendYield: number | null
  assumptions: ValuationAssumption[]
  evidence: EvidenceItem[]
}

export interface DerivedRevenueMultipleAssumptions {
  ltvRevenue: number | null
  sharesOutstanding: number | null
  revenueCAGR: number
  exitEVRevenue: number
  netDebt: number | null
  dilutionRate: number
  discountRate: number
  currentPrice: number
  dividendYield: number | null
  assumptions: ValuationAssumption[]
  evidence: EvidenceItem[]
}

// ─── Main exports ─────────────────────────────────────────────────────────────

export function deriveForwardPEAssumptions(data: {
  quote: { price: number; sector?: string | null; industry?: string | null; peRatio?: number | null; currency?: string }
  wacc: { wacc: number; inputs: WACCInputsLike; crp?: number }
  cagrAnalysis: CAGRAnalysisLike | null
  fairValue: { sharesOutstanding: number | null }
  financialStatements?: { incomeStatement: IncomeRow[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}): DerivedForwardPEAssumptions {
  const sector       = data.quote?.sector ?? null
  const industry     = data.quote?.industry ?? null
  const currentPrice = data.quote?.price ?? 0
  const wacc         = data.wacc?.wacc ?? 0.10
  const crp          = data.wacc?.crp  ?? 0
  const shares       = data.fairValue?.sharesOutstanding ?? null
  const incomeRows   = data.financialStatements?.incomeStatement ?? []

  const sectorFallback = SECTOR_CAGR[sector ?? ''] ?? 0.07

  const cagrDerived     = deriveCagr(data.cagrAnalysis, sectorFallback)

  // Phase 2: CAGR cap for energy and mining — commodity cycles inflate historical rates
  const cyclicalSectors = new Set(['Energy', 'Basic Materials'])
  let effectiveCagr = cagrDerived.cagr
  let cagrCapNote = ''
  if (cyclicalSectors.has(sector ?? '') && effectiveCagr > 0.08) {
    effectiveCagr = 0.08
    cagrCapNote = ' [capped at 8% — commodity cycles inflate historical CAGR]'
  }

  // Alt-asset managers (BX, KKR, Apollo): CAGR from AUM/FRE growth, not revenue cycles
  const FINTECH_INDUSTRY_RE_LOCAL = /fintech|neobank|digital.?bank|payment|credit.?service|consumer.?finance|insurtech/i
  const isAltAsset = (industry ?? '').toLowerCase().includes('capital market') ||
    ((industry ?? '').toLowerCase().includes('asset management') && (data?.cagrAnalysis?.historicalCagr3y ?? 0) > 0.12)
  if (isAltAsset && effectiveCagr > 0.25 && !FINTECH_INDUSTRY_RE_LOCAL.test(industry ?? '')) {
    // Cap alt-asset CAGR at 25% — AUM growth doesn't compound indefinitely
    effectiveCagr = Math.min(effectiveCagr, 0.25)
    if (effectiveCagr !== cagrDerived.cagr) cagrCapNote = ' [capped at 25% — alt-asset AUM growth cap]'
  }

  const marginDerived   = deriveNetMargin(incomeRows, effectiveCagr)
  const trailingMargin  = incomeRows
    .filter(r => !r.isProjected && r.netIncome != null && r.revenue != null && r.revenue! > 0)
    .map(r => r.netIncome! / r.revenue!).slice(-1)[0] ?? null
  const peDerived       = deriveExitPE(sector, industry, data.quote?.peRatio ?? null, crp, trailingMargin, data)
  const dilutionDerived = deriveDilution(sector, marginDerived.margin, data)
  const waccEvidence    = deriveWACCEvidence(data.wacc?.inputs ?? {}, wacc)
  const ltmRev          = ltmRevenue(incomeRows)
  const currentPE       = data.quote?.peRatio ?? null
  const cagrEvidence    = cagrCapNote ? cagrDerived.evidence + cagrCapNote : cagrDerived.evidence

  const assumptions: ValuationAssumption[] = [
    {
      key: 'ltvRevenue', label: 'LTM Revenue', editable: false,
      value: ltmRev, unit: '$', source: 'historical_3y_median',
    },
    {
      key: 'sharesOutstanding', label: 'Shares Outstanding', editable: false,
      value: shares, unit: 'shares', source: 'model_default',
    },
    {
      key: 'revenueCAGR', label: '5Y Revenue CAGR', description: 'How fast you expect revenue to grow each year for the next 5 years. This is your most important assumption — small changes here have a big impact on fair value.',
      value: effectiveCagr, unit: '%', min: -0.10, max: 1.00, step: 0.5,
      editable: true, source: cagrDerived.source, sourceExplanation: cagrEvidence,
    },
    {
      key: 'netMargin', label: 'Net Margin (exit year)', description: 'What fraction of revenue becomes profit by year 5. Higher margin = more valuable company. Mature tech companies often land at 15–30%.',
      value: marginDerived.margin, unit: '%', min: -0.50, max: 0.70, step: 0.5,
      editable: true, source: marginDerived.source, sourceExplanation: marginDerived.evidence,
    },
    {
      key: 'exitPE', label: 'Exit P/E', description: 'The price-to-earnings ratio you expect the stock to trade at when you\'d sell (year 5). Lower = more conservative. Most mature companies trade at 15–25×.',
      value: peDerived.pe, unit: 'x', min: 1, max: 100, step: 1,
      editable: true, source: peDerived.source, sourceExplanation: peDerived.evidence,
      benchmarks: [
        { label: 'Sector', value: peDerived.sectorPE },
        ...(currentPE != null && currentPE > 0 && currentPE < 200 ? [{ label: 'Current P/E', value: currentPE }] : []),
      ],
    },
    {
      key: 'dilutionRate', label: 'Annual Dilution', description: 'How much your ownership shrinks each year as the company issues new shares (stock compensation). 1–3% is typical for tech; lower for mature companies.',
      value: dilutionDerived.rate, unit: '%', min: 0, max: 0.15, step: 0.5,
      editable: true, source: dilutionDerived.source, sourceExplanation: dilutionDerived.evidence,
    },
    {
      key: 'discountRate', label: 'Discount Rate (WACC)', description: 'The annual return you demand for the risk of owning this stock. Higher = riskier company = lower fair value. Ranges from ~7% (blue chip) to ~15%+ (speculative).',
      value: wacc, unit: '%', min: 0.03, max: 0.30, step: 0.5,
      editable: true, source: 'model_default', sourceExplanation: waccEvidence,
    },
  ]

  const evidence: EvidenceItem[] = [
    { label: 'Revenue CAGR',     text: cagrEvidence },
    { label: 'Net Margin',       text: marginDerived.evidence },
    { label: 'Exit P/E',         text: peDerived.evidence },
    { label: 'Share Dilution',   text: dilutionDerived.evidence },
    { label: 'WACC',             text: waccEvidence },
  ]

  return {
    ltvRevenue: ltmRev, sharesOutstanding: shares,
    revenueCAGR: effectiveCagr, netMargin: marginDerived.margin,
    exitPE: peDerived.pe, dilutionRate: dilutionDerived.rate,
    discountRate: wacc, currentPrice,
    dividendYield: null,
    assumptions, evidence,
  }
}

export function deriveRevenueMultipleAssumptions(data: {
  quote: { price: number; sector?: string | null; industry?: string | null; currency?: string }
  wacc: { wacc: number; inputs: WACCInputsLike; crp?: number }
  cagrAnalysis: CAGRAnalysisLike | null
  fairValue: { sharesOutstanding: number | null; cash: number | null; debt: number | null }
  financialStatements?: { incomeStatement: IncomeRow[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}): DerivedRevenueMultipleAssumptions {
  const sector       = data.quote?.sector ?? null
  const industry     = data.quote?.industry ?? null
  const currentPrice = data.quote?.price ?? 0
  const wacc         = data.wacc?.wacc ?? 0.10
  const crp          = data.wacc?.crp  ?? 0
  const shares       = data.fairValue?.sharesOutstanding ?? null
  const incomeRows   = data.financialStatements?.incomeStatement ?? []

  const cagrDerived     = deriveCagr(data.cagrAnalysis, SECTOR_CAGR[sector ?? ''] ?? 0.07)
  const marginDerived   = deriveNetMargin(incomeRows, cagrDerived.cagr)
  const dilutionDerived = deriveDilution(sector, marginDerived.margin, data)
  const waccEvidence    = deriveWACCEvidence(data.wacc?.inputs ?? {}, wacc)
  const ltmRev          = ltmRevenue(incomeRows)

  const { evRevenue: sectorEVRev, source: evRevBenchmarkSource } = getIndustryMultiples(industry ?? '', sector ?? '')
  const evRevSource: AssumptionSource = evRevBenchmarkSource === 'industry-median' ? 'historical_3y_median' : 'sector_fallback'
  const label = industry || sector || 'unknown'
  const multEstimates: Array<{ multiple: string; actualValue: number }> =
    (data as { valuationMethods?: { models?: { multiples?: { estimates?: unknown[] } } } })
      ?.valuationMethods?.models?.multiples?.estimates as Array<{ multiple: string; actualValue: number }> ?? []
  const actualEvRevenue = multEstimates.find(e => e.multiple === 'EV/Revenue')?.actualValue ?? null

  // Three-signal blend: current EV/Revenue (55%) + geo-discounted sector (35%)
  const { blended: blendedEvRev, geoDiscount: evRevGeoDiscount } = blendExitMultiple(sectorEVRev, actualEvRevenue, crp)
  const companyEVRevStr = actualEvRevenue != null && actualEvRevenue > 0 ? `${actualEvRevenue.toFixed(1)}×` : 'N/A'
  const geoStr = evRevGeoDiscount < 0.99 ? ` (geo-discounted ${(evRevGeoDiscount * 100).toFixed(0)}%)` : ''
  const evRevEvidence = actualEvRevenue != null && actualEvRevenue > 0
    ? `Blend: current ${companyEVRevStr} × 55% + sector ${sectorEVRev}×${geoStr} × 35% → ${blendedEvRev.toFixed(1)}× EV/Revenue`
    : `No current EV/Revenue; sector median ${sectorEVRev}× (${label})${geoStr} → ${blendedEvRev.toFixed(1)}×`

  const cashM    = data.fairValue?.cash ?? null
  const debtM    = data.fairValue?.debt ?? null
  // Fallback from balance sheet rows (already in millions, already FX-converted)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bsRow    = (data.financialStatements as any)?.balanceSheet?.find((r: { isProjected?: boolean }) => !r.isProjected)
  const cashBSM  = (bsRow?.cash  as number | null | undefined) ?? null
  const debtBSM  = (bsRow?.longTermDebt as number | null | undefined) ?? null
  const netDebt  = (cashM != null && debtM != null)
    ? (debtM - cashM) * 1e6
    : (cashBSM != null && debtBSM != null ? (debtBSM - cashBSM) * 1e6 : null)

  const assumptions: ValuationAssumption[] = [
    {
      key: 'ltvRevenue', label: 'LTM Revenue', editable: false,
      value: ltmRev, unit: '$', source: 'historical_3y_median',
    },
    {
      key: 'sharesOutstanding', label: 'Shares Outstanding', editable: false,
      value: shares, unit: 'shares', source: 'model_default',
    },
    {
      key: 'revenueCAGR', label: '5Y Revenue CAGR', description: 'How fast you expect revenue to grow each year for the next 5 years. This is your most important assumption — small changes here have a big impact on fair value.',
      value: cagrDerived.cagr, unit: '%', min: -0.10, max: 1.00, step: 0.5,
      editable: true, source: cagrDerived.source, sourceExplanation: cagrDerived.evidence,
    },
    {
      key: 'exitEVRevenue', label: 'Exit EV/Revenue', description: 'How many times annual revenue the entire company is worth at exit. Tech companies typically trade at 3–10×; mature businesses at 1–3×.',
      value: blendedEvRev, unit: 'x', min: 0.5, max: 50, step: 0.5,
      editable: true, source: evRevSource as AssumptionSource, sourceExplanation: evRevEvidence,
      benchmarks: [
        { label: 'Sector', value: sectorEVRev },
        ...(actualEvRevenue != null && actualEvRevenue > 0 ? [{ label: 'Current EV/Rev', value: actualEvRevenue }] : []),
      ],
    },
    {
      key: 'netDebt', label: 'Net Debt', description: 'Total debt minus cash (negative = net cash)',
      value: netDebt, unit: '$', editable: false,
      source: 'historical_3y_median',
    },
    {
      key: 'dilutionRate', label: 'Annual Dilution', description: 'How much your ownership shrinks each year as the company issues new shares (stock compensation). 1–3% is typical for tech; lower for mature companies.',
      value: dilutionDerived.rate, unit: '%', min: 0, max: 0.15, step: 0.5,
      editable: true, source: dilutionDerived.source, sourceExplanation: dilutionDerived.evidence,
    },
    {
      key: 'discountRate', label: 'Discount Rate (WACC)', description: 'The annual return you demand for the risk of owning this stock. Higher = riskier company = lower fair value. Ranges from ~7% (blue chip) to ~15%+ (speculative).',
      value: wacc, unit: '%', min: 0.03, max: 0.30, step: 0.5,
      editable: true, source: 'model_default', sourceExplanation: waccEvidence,
    },
  ]

  const evidence: EvidenceItem[] = [
    { label: 'Revenue CAGR',    text: cagrDerived.evidence },
    { label: 'EV/Revenue',      text: evRevEvidence },
    { label: 'Share Dilution',  text: dilutionDerived.evidence },
    { label: 'WACC',            text: waccEvidence },
  ]

  return {
    ltvRevenue: ltmRev, sharesOutstanding: shares,
    revenueCAGR: cagrDerived.cagr, exitEVRevenue: blendedEvRev,
    netDebt, dilutionRate: dilutionDerived.rate,
    discountRate: wacc, currentPrice,
    dividendYield: null,
    assumptions, evidence,
  }
}
