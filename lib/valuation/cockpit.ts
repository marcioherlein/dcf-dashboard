import { computeForwardPE } from './methods/forwardPE'
import { computeEVEBITDA } from './methods/evEbitda'
import { computeRevenueMultiple } from './methods/revenueMultiple'
import { computeReverseDCF, type ReverseDCFInterpretation } from './methods/reverseDcf'
import { computePFFO } from './methods/pFfo'
import { computeEPV } from './methods/epv'
import { projectCashFlows } from '../dcf/projectCashFlows'
import { calculateDDM } from '../dcf/calculateDDM'

const FINANCIAL_SECTORS = new Set(['Financial Services', 'Banks', 'Insurance', 'Financial'])

type AdaptiveMethod = 'pb' | 'evEbitda' | 'pffo' | 'ddm'

function resolveAdaptiveMethod(companyType: string, sector: string | null | undefined): AdaptiveMethod {
  if (companyType === 'reit')    return 'pffo'
  if (companyType === 'utility' || companyType === 'bdc') return 'ddm'
  if (companyType === 'mreeit') return 'pb'  // mortgage REITs: P/B is the anchor
  if (companyType === 'financial' || companyType === 'fintech' || companyType === 'alt_asset' || FINANCIAL_SECTORS.has(sector ?? '')) return 'pb'
  return 'evEbitda'
}

function computePBValuation(
  snapshot: CockpitSnapshot,
  assumptions: ValuationAssumptions,
): { fairValuePerShare: number | null; guardErrors: string[] } {
  if (snapshot.bookValuePerShare == null || snapshot.bookValuePerShare <= 0) {
    return { fairValuePerShare: null, guardErrors: ['Book value per share unavailable'] }
  }

  // Justified P/B = (ROE − g) / (Ke − g): theoretically correct for financial companies.
  // High-ROE fintechs (ROE ~20%) justify P/B 3–5×; mature banks (ROE ~12%) justify P/B ~1.3×.
  //
  // g must be the long-run nominal growth rate — identical to the DCF terminalG.
  // Using wacc − 0.02 produced g ~7% for BBVA (WACC 9%), which is 2–3× the realistic
  // long-run growth for a European bank (2–3%). That inflated justified P/B from ~1.4× to ~2.9×.
  const roe = snapshot.roe ?? null
  const ke  = assumptions.ke ?? assumptions.wacc * 1.2  // fallback: ke ≈ 120% of wacc
  const g   = Math.max(0.01, Math.min(assumptions.terminalG, assumptions.wacc - 0.02))
  // 200bps minimum spread (wacc-0.02): consistent with the DCF path (line 308).
  // The old 100bps minimum was too tight — at ke=9.5% and g=9%, the justified P/B
  // denominator (ke-g)=0.005 made the formula extremely sensitive to small input changes.
  const justifiedPB = roe != null && roe > 0 && ke > g && ke > 0
    ? Math.max(0.8, Math.min(10, (roe - g) / (ke - g)))
    : null

  const marketMult = assumptions.priceToBookMultiple ?? (justifiedPB ?? 1.5)
  const blendedMult = justifiedPB != null
    ? justifiedPB * 0.60 + marketMult * 0.40
    : marketMult

  if (blendedMult <= 0) return { fairValuePerShare: null, guardErrors: ['Invalid P/B multiple'] }
  const fv = Math.round(snapshot.bookValuePerShare * blendedMult * 100) / 100
  return { fairValuePerShare: fv > 0 ? fv : null, guardErrors: fv > 0 ? [] : ['P/B fair value ≤ 0'] }
}

export interface ValuationAssumptions {
  wacc: number           // e.g. 0.10
  ke: number             // cost of equity — used to discount equity-level P/E estimates
  cagr: number           // 5Y revenue CAGR e.g. 0.12
  terminalG: number      // e.g. 0.03
  netMargin: number      // e.g. 0.18
  dilutionRate: number   // e.g. 0.015
  exitPE: number         // Forward P/E exit multiple e.g. 22
  exitMultiple: number   // EV/EBITDA exit multiple e.g. 14
  revenueMultiple: number // EV/Revenue e.g. 4.5
  priceToBookMultiple?: number // P/B target multiple (financial companies only)
  exitPFFOMultiple?: number    // P/FFO target multiple (REITs only)
  taxRate?: number             // Effective tax rate for EPV (reuses WACC pipeline value)
}

// Fixed financial data extracted from apiData — does NOT change with assumptions
export interface CockpitSnapshot {
  currentPrice: number
  currency: string
  // Raw dollar values (not millions) for PE, EV/EBITDA, Revenue Multiple methods
  ltvRevenueDollars: number | null
  // Yahoo TTM revenue — used exclusively for reverse DCF to match SummaryTab path
  ttmRevenueDollars?: number | null
  sharesRaw: number | null
  ttmEbitdaDollars: number | null
  netDebtDollars: number | null
  dividendYield: number | null
  // Millions-based values for DCF and Reverse DCF
  baseFCF: number
  cashM: number
  debtM: number
  sharesM: number
  growthModel: 'two-stage' | 'three-stage'
  // Reverse DCF inputs
  fcfMargin: number | null
  historicalCAGR: number | null
  // Analyst consensus (display only)
  analystTargetMean: number | null
  analystRating: string | null
  // Company classification (determines method blend weights)
  companyType?: string
  // Sector name — determines whether P/B replaces EV/EBITDA for financial companies
  sector?: string | null
  // Industry name — used for fintech auto-detection within the financial sector
  industry?: string | null
  // Book value per share (raw dollars) — for P/B valuation method
  bookValuePerShare?: number | null
  // Return on equity (trailing) — for justified P/B formula: (ROE−g)/(Ke−g)
  roe?: number | null
  // TTM net income (dollars) and D&A (dollars) — for P/FFO method (REITs)
  netIncomeDollars?: number | null
  dnaDollars?: number | null
  // Dividend per share and payout ratio — for DDM method (utilities/dividend companies)
  dividendPerShare?: number | null
  payoutRatio?: number | null
  // Pre-computed 4-model DCF blend from Full DCF Table (scenarios.base.fairValue).
  // When present, Core DCF uses this directly instead of re-running the UFCF-only blend.
  fullDcfFairValue?: number | null
  // EPV inputs — TTM operating income and 5Y normalized operating income (dollars)
  ttmOperatingIncomeDollars?: number | null
  normalizedOperatingIncomeDollars?: number | null
  // EPS for cyclicality detection
  currentEPS?: number | null
  normalizedEPS?: number | null
}

export interface CockpitMethodResult {
  id: string
  method: string
  fairValue: number | null
  weight: number
  confidence: 'high' | 'medium' | 'low'
  description: string
  upsidePct: number | null
  errors: string[]
  // Optional metadata for EPV (growth premium, cyclicality, NOPAT display)
  meta?: {
    growthPremiumPct?: number | null
    isCyclical?: boolean
    cyclicalWarning?: string | null
    effectiveNopatM?: number | null
    // V2 engine enrichments
    terminalValueShare?: number | null
    impliedTerminalEVEBITDA?: number | null
    enterpriseValueM?: number | null
    dataWarnings?: string[]
    engineVersion?: string
  }
}

export interface MethodExplanation {
  methodId: string
  methodName: string
  direction: 'above' | 'below' | 'inline'   // vs blended
  deviationPct: number                       // how far from blended, 0–1
  confidence: 'high' | 'medium' | 'low'
  reason: string                             // single sentence explaining why
}

export interface DivergenceAnalysis {
  cv: number                        // coefficient of variation across valid fair values
  spreadVsPrice: number             // (max - min) / currentPrice
  level: 'low' | 'moderate' | 'high'
  overallConfidence: 'high' | 'medium' | 'low'
  summary: string                   // 1–2 sentence overview
  methodExplanations: MethodExplanation[]
}

export interface CockpitOutput {
  blendedFairValue: number | null
  methods: CockpitMethodResult[]
  scenarios: {
    bull: { fairValue: number | null; wacc: number; cagr: number }
    base: { fairValue: number | null; wacc: number; cagr: number }
    bear: { fairValue: number | null; wacc: number; cagr: number }
  }
  verdict: 'Undervalued' | 'Fairly Valued' | 'Overvalued' | 'Insufficient Data'
  upsidePct: number | null
  marketImpliedGrowth: number | null
  marketImpliedText: string
  marketImpliedInterpretation: ReverseDCFInterpretation
  divergence: DivergenceAnalysis
}

type MethodWeights = { forward_pe: number; ev_ebitda: number; revenue_multiple: number; core_dcf: number; epv: number }

const COCKPIT_WEIGHTS: Record<string, MethodWeights> = {
  // standard: EPV 10% (taken from forward_pe 35→30 and core_dcf 10→05)
  standard:  { forward_pe: 0.30, ev_ebitda: 0.30, revenue_multiple: 0.25, core_dcf: 0.05, epv: 0.10 },
  growth:    { forward_pe: 0.25, ev_ebitda: 0.25, revenue_multiple: 0.35, core_dcf: 0.15, epv: 0.00 },
  startup:   { forward_pe: 0.10, ev_ebitda: 0.15, revenue_multiple: 0.45, core_dcf: 0.30, epv: 0.00 },
  financial: { forward_pe: 0.50, ev_ebitda: 0.35, revenue_multiple: 0.00, core_dcf: 0.15, epv: 0.00 },
  fintech:   { forward_pe: 0.20, ev_ebitda: 0.25, revenue_multiple: 0.25, core_dcf: 0.30, epv: 0.00 },
  alt_asset: { forward_pe: 0.40, ev_ebitda: 0.30, revenue_multiple: 0.10, core_dcf: 0.20, epv: 0.00 },
  mreeit:    { forward_pe: 0.15, ev_ebitda: 0.50, revenue_multiple: 0.00, core_dcf: 0.35, epv: 0.00 },
  bdc:       { forward_pe: 0.15, ev_ebitda: 0.55, revenue_multiple: 0.00, core_dcf: 0.30, epv: 0.00 },
  // dividend: EPV 10% (mature stable earnings; taken from ev_ebitda 25→15)
  dividend:  { forward_pe: 0.35, ev_ebitda: 0.15, revenue_multiple: 0.15, core_dcf: 0.25, epv: 0.10 },
  reit:      { forward_pe: 0.00, ev_ebitda: 0.55, revenue_multiple: 0.15, core_dcf: 0.30, epv: 0.00 },
  // utility: EPV 15% (regulated stable earnings ideal for EPV; taken from ev_ebitda 50→35)
  utility:   { forward_pe: 0.20, ev_ebitda: 0.35, revenue_multiple: 0.00, core_dcf: 0.30, epv: 0.15 },
  // energy: EPV 15% (cycle normalization is EPV's strength; taken from forward_pe 25→10)
  energy:    { forward_pe: 0.10, ev_ebitda: 0.45, revenue_multiple: 0.15, core_dcf: 0.15, epv: 0.15 },
  // mining: same as energy
  mining:    { forward_pe: 0.10, ev_ebitda: 0.45, revenue_multiple: 0.15, core_dcf: 0.15, epv: 0.15 },
  etf:       { forward_pe: 0.25, ev_ebitda: 0.25, revenue_multiple: 0.25, core_dcf: 0.25, epv: 0.00 },
}

const FINTECH_INDUSTRY_RE = /fintech|neobank|digital.?bank|payment|credit.?service|consumer.?finance|insurtech/i

// For growth/startup companies with thin EBITDA margins, the TTM EBITDA is a noisy anchor —
// a company spending heavily on growth will show near-zero EBITDA while its revenue trajectory
// is the real signal. Reduce EV/EBITDA weight to 8% and redistribute to revenue_multiple.
function getEffectiveWeights(snapshot: CockpitSnapshot): MethodWeights {
  const companyType = snapshot.companyType ?? 'standard'

  // Auto-promote financial companies that match fintech characteristics to the `fintech` type,
  // which reduces the Forward P/E dominance that is unreliable for early-stage
  // digital finance companies where margins are still scaling. P/B and Revenue Multiple get
  // higher weight instead, which better captures the growth premium.
  // Also: 'fintech' type (from detectCompanyType) stays fintech even if sector says Financial.
  const effectiveType = (companyType === 'financial') &&
    FINANCIAL_SECTORS.has(snapshot.sector ?? '') &&
    FINTECH_INDUSTRY_RE.test(snapshot.industry ?? '')
    ? 'fintech'
    : companyType

  const base = COCKPIT_WEIGHTS[effectiveType] ?? COCKPIT_WEIGHTS.standard
  // Also include fintech: loss-making fintechs (AFRM, HOOD) with negative EBITDA carry
  // the full 25% EV/EBITDA weight with no reduction, despite P/B being the adaptive method.
  // Including fintech in isGrowthType ensures the EBITDA margin guard fires for them too.
  const isGrowthType = effectiveType === 'growth' || effectiveType === 'startup' || effectiveType === 'fintech'
  if (!isGrowthType) return base
  const revDollars    = snapshot.ltvRevenueDollars
  const ebitdaDollars = snapshot.ttmEbitdaDollars
  const ebitdaMargin  = revDollars && revDollars > 0 && ebitdaDollars != null
    ? ebitdaDollars / revDollars : null
  if (ebitdaMargin != null && ebitdaMargin < 0.08) {
    const reduction = base.ev_ebitda - 0.08
    return { ...base, ev_ebitda: 0.08, revenue_multiple: base.revenue_multiple + reduction }
  }
  return base
}

// Dynamic terminal growth fade — scales with initial CAGR so high-growth companies
// aren't unfairly penalised by fading to a 4% terminal rate that's too low for their stage.
// Dynamic terminal growth fade for the Forward P/E method.
// After a high-growth period, the company's terminal revenue growth converges toward GDP.
// These rates represent an intermediate plateau, not the final terminal steady-state.
//
// BUG GUARD: the fade rates must be capped at (ke - 200bps) to prevent the Gordon Growth
// denominator in computeForwardPE from going to zero or negative. 12% > WACC for any tech
// stock with WACC ≤ 12%. The function now accepts wacc/ke so it can enforce a safe spread.
function dynamicTerminalFade(cagr: number, terminalG: number, ke?: number): number {
  const keSafe = ke ?? 0.12
  const maxSafe = Math.max(terminalG, Math.min(keSafe - 0.02, 0.10))  // cap at min(ke-200bps, 10%)
  if (cagr > 0.35) return Math.min(0.08, maxSafe)  // was 0.12 — no public company terminal at 12%
  if (cagr > 0.25) return Math.min(0.07, maxSafe)  // was 0.08
  if (cagr > 0.15) return Math.min(0.05, maxSafe)  // was 0.06
  return terminalG  // stable/mature: use user-set terminalG
}

// Fix 1+2+3: runs all 4 methods at given assumptions and returns weighted blended fair value.
// Fix 1: terminal growth is capped at wacc−0.02 (200bps minimum spread) to prevent denominator explosion.
// Fix 3: DCF output is discarded if it exceeds 8× current price (terminal value explosion guard).
export function computeBlendedFV(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
): number | null {
  const { currentPrice } = snapshot
  const W = getEffectiveWeights(snapshot)

  // Use TTM revenue when available: it reflects the most recent 12-month run-rate, which for
  // fast-growing companies (NU, NVDA) can be 20-40% higher than the last annual period close.
  // Projecting from a stale annual base systematically understates fair value for hypergrowth.
  const revenueBase = snapshot.ttmRevenueDollars ?? snapshot.ltvRevenueDollars

  // Phase 1: use Ke (cost of equity) to discount equity-level P/E estimate; apply dynamic fade
  const ke = assumptions.ke ?? assumptions.wacc
  const termFade = dynamicTerminalFade(assumptions.cagr, assumptions.terminalG, assumptions.ke ?? assumptions.wacc * 1.2)

  // Pre-revenue biotech exclusion: exitPE === 0 signals the method should be skipped
  const fwdPEValue: number | null = assumptions.exitPE <= 0 ? null : (() => {
    const fwdPE = computeForwardPE({
      ltvRevenue: revenueBase,
      sharesOutstanding: snapshot.sharesRaw,
      revenueCAGR: assumptions.cagr,
      netMargin: assumptions.netMargin,
      exitPE: assumptions.exitPE,
      dilutionRate: assumptions.dilutionRate,
      discountRate: ke,
      currentPrice,
      dividendYield: snapshot.dividendYield,
      terminalCAGR: termFade,
    })
    return fwdPE.fairValueToday ?? null
  })()

  const adaptiveMethod = resolveAdaptiveMethod(snapshot.companyType ?? 'standard', snapshot.sector)
  let adaptiveFV: number | null = null

  if (adaptiveMethod === 'pb') {
    adaptiveFV = computePBValuation(snapshot, assumptions).fairValuePerShare
  } else if (adaptiveMethod === 'pffo') {
    adaptiveFV = computePFFO({
      netIncomeDollars: snapshot.netIncomeDollars ?? null,
      dnaDollars: snapshot.dnaDollars ?? null,
      sharesOutstanding: snapshot.sharesRaw,
      exitPFFOMultiple: assumptions.exitPFFOMultiple ?? null,
      currentPrice,
    }).fairValueToday
  } else if (adaptiveMethod === 'ddm') {
    const ddmResult = calculateDDM(
      snapshot.dividendPerShare ?? 0,
      ke,
      snapshot.roe ?? null,
      snapshot.payoutRatio ?? 0.60,
      currentPrice,
    )
    adaptiveFV = ddmResult.applicable ? ddmResult.fairValuePerShare : null
  } else {
    adaptiveFV = computeEVEBITDA({
      ttmEbitda: snapshot.ttmEbitdaDollars,
      netDebt: snapshot.netDebtDollars,
      shares: snapshot.sharesRaw,
      exitMultiple: assumptions.exitMultiple,
      currentPrice,
    }).fairValuePerShare ?? null
  }

  const revMult = computeRevenueMultiple({
    ltvRevenue: revenueBase,
    revenueCAGR: assumptions.cagr,
    exitEVRevenue: assumptions.revenueMultiple,
    netDebt: snapshot.netDebtDollars,
    sharesOutstanding: snapshot.sharesRaw,
    dilutionRate: assumptions.dilutionRate,
    discountRate: assumptions.wacc,
    currentPrice,
    dividendYield: snapshot.dividendYield,
  })

  let dcfFV: number | null = null
  if (snapshot.baseFCF > 0 && snapshot.sharesM > 0) {
    const g = Math.min(Math.max(assumptions.terminalG, 0.005), assumptions.wacc - 0.02)
    if (g > 0 && g < assumptions.wacc) {
      const years = 10
      const dcf = projectCashFlows({
        baseFCF: snapshot.baseFCF,
        cagr: assumptions.cagr,
        wacc: assumptions.wacc,
        terminalG: g,
        years,
        growthModel: snapshot.growthModel,
      })
      if (dcf.ev != null && dcf.projections.length > 0) {
        const lastCF = dcf.projections[dcf.projections.length - 1].cashFlow
        // Exit-multiple terminal value (matches Full DCF Table UFCF×ExitMultiple method)
        const tvExit = (lastCF * assumptions.exitMultiple) / Math.pow(1 + assumptions.wacc, years)
        // 50% PGM (Gordon Growth) + 50% Exit Multiple — matches Full DCF Table UFCF blend
        const evBlended = (dcf.ev + (dcf.sumPV + tvExit)) / 2
        const equity = evBlended + snapshot.cashM - snapshot.debtM
        const raw = Math.round((equity / snapshot.sharesM) * 100) / 100
        if (raw > 0) {
          dcfFV = currentPrice > 0 ? Math.min(raw, currentPrice * 10) : raw
        }
      }
    }
  }

  const candidates = (
    [
      { fv: fwdPEValue, w: W.forward_pe },
      { fv: adaptiveFV, w: W.ev_ebitda },
      { fv: revMult.fairValueToday ?? null, w: W.revenue_multiple },
      { fv: dcfFV, w: W.core_dcf },
    ] as { fv: number | null; w: number }[]
  ).filter((c): c is { fv: number; w: number } => c.fv != null && c.fv > 0)

  const totalW = candidates.reduce((s, c) => s + c.w, 0)
  return totalW > 0
    ? Math.round(candidates.reduce((s, c) => s + c.fv * c.w, 0) / totalW * 100) / 100
    : null
}

// Fix 2: scenarios use all 4 methods blended at stressed assumptions (not pure DCF).
// Fix 5: deltas scale proportionally to the base assumptions (±10% of WACC, ±15% of CAGR).
function scenarioBlendFV(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
  waccDelta: number,
  cagrDelta: number,
): number | null {
  const stressed: ValuationAssumptions = {
    ...assumptions,
    wacc: Math.max(assumptions.wacc + waccDelta, 0.04),
    cagr: Math.max(assumptions.cagr + cagrDelta, -0.05),
  }
  return computeBlendedFV(stressed, snapshot)
}

function computeDivergence(
  methods: CockpitMethodResult[],
  blended: number | null,
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
  debtOverhangDropped = false,
): DivergenceAnalysis {
  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)

  if (valid.length < 2 || blended == null) {
    return {
      cv: 0,
      spreadVsPrice: 0,
      level: debtOverhangDropped ? 'high' : 'low',
      overallConfidence: valid.length === 0 ? 'low' : debtOverhangDropped ? 'low' : 'medium',
      summary: debtOverhangDropped
        ? 'DCF excluded: net debt exceeded the estimated enterprise value. Structural debt overhang — blended estimate excludes DCF. Other multiples shown but treat with caution.'
        : valid.length < 2
          ? 'Only one model produced a result — blended estimate has low reliability.'
          : 'Insufficient data to assess model agreement.',
      methodExplanations: valid.map(m => ({
        methodId: m.id,
        methodName: m.method,
        direction: 'inline' as const,
        deviationPct: 0,
        confidence: m.confidence,
        reason: m.errors.length > 0 ? m.errors[0] : 'Single model estimate — no comparison available.',
      })),
    }
  }

  const vals = valid.map(m => m.fairValue!)
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const stdDev = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
  const cv = mean > 0 ? stdDev / mean : 0
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const spreadVsPrice = snapshot.currentPrice > 0 ? (max - min) / snapshot.currentPrice : cv

  let level: DivergenceAnalysis['level'] = 'low'
  if (cv > 0.30) level = 'high'
  else if (cv > 0.15) level = 'moderate'
  // Debt overhang forces high divergence regardless of how well remaining models agree —
  // DCF was structurally excluded, so the blended estimate lacks a key method.
  if (debtOverhangDropped) level = 'high'

  const overallConfidence: DivergenceAnalysis['overallConfidence'] =
    debtOverhangDropped ? 'low' : level === 'low' ? 'high' : level === 'moderate' ? 'medium' : 'low'

  // Context derived from snapshot & assumptions
  const netDebtM = (snapshot.debtM - snapshot.cashM)  // in millions
  const revM = snapshot.ltvRevenueDollars != null ? snapshot.ltvRevenueDollars / 1e6 : null
  const ebitdaM = snapshot.ttmEbitdaDollars != null ? snapshot.ttmEbitdaDollars / 1e6 : null
  const currentEbitdaMargin = revM && revM > 0 && ebitdaM != null ? ebitdaM / revM : null
  const currentFcfMargin = snapshot.fcfMargin ?? null
  const netDebtToRev = revM && revM > 0 ? netDebtM / revM : null

  // Per-method explanations
  const methodExplanations: MethodExplanation[] = valid.map(m => {
    const deviationPct = blended > 0 ? Math.abs(m.fairValue! - blended) / blended : 0
    const direction: MethodExplanation['direction'] =
      m.fairValue! > blended * 1.05 ? 'above'
      : m.fairValue! < blended * 0.95 ? 'below'
      : 'inline'

    // Confidence: start from data-quality confidence, downgrade if large outlier
    let confidence = m.confidence
    if (deviationPct > 0.35 && confidence !== 'low') confidence = 'medium'
    if (deviationPct > 0.55) confidence = 'low'

    let reason = ''

    if (m.id === 'forward_pe') {
      if (direction === 'above') {
        if (assumptions.netMargin > 0.20) {
          reason = `Assuming a ${(assumptions.netMargin * 100).toFixed(0)}% exit net margin — significantly above current levels — inflates the P/E estimate. Verify this margin is achievable.`
        } else if (assumptions.exitPE > 25) {
          reason = `Exit P/E of ${assumptions.exitPE.toFixed(0)}× is high. A lower multiple would reduce this estimate meaningfully.`
        } else {
          reason = `Forward P/E is above the blended estimate, driven by projected earnings growth outpacing the other models' assumptions.`
        }
      } else if (direction === 'below') {
        if (assumptions.netMargin < 0.05) {
          reason = `Thin assumed exit net margin (${(assumptions.netMargin * 100).toFixed(1)}%) limits earnings power at the P/E exit, depressing this estimate.`
        } else {
          reason = `Forward P/E is below the blended estimate. Consider whether the exit P/E of ${assumptions.exitPE.toFixed(0)}× reflects the sector norm.`
        }
      } else {
        reason = `Forward P/E aligns closely with the blended estimate, suggesting earnings projections are consistent with the other methods.`
      }
    }

    if (m.id === 'ev_ebitda') {
      if (direction === 'below') {
        if (netDebtToRev != null && netDebtToRev > 0.5) {
          reason = `Significant net debt (≈${netDebtToRev.toFixed(1)}× revenue) reduces the equity value after subtracting debt from enterprise value — that's why EV/EBITDA produces a lower per-share estimate.`
        } else if (currentEbitdaMargin != null && currentEbitdaMargin < 0.10) {
          reason = `Current EBITDA margin is thin (${(currentEbitdaMargin * 100).toFixed(1)}%), making the EBITDA base small. EV/EBITDA results are sensitive to margin levels.`
        } else {
          reason = `EV/EBITDA is below the blended value. Check whether the exit multiple (${assumptions.exitMultiple.toFixed(0)}×) reflects current sector trading levels.`
        }
      } else if (direction === 'above') {
        if (netDebtToRev != null && netDebtToRev < -0.2) {
          reason = `Net cash position boosts the equity value derived from enterprise value, lifting this estimate above the blend.`
        } else {
          reason = `EV/EBITDA is above the blended estimate. The exit multiple of ${assumptions.exitMultiple.toFixed(0)}× may be generous relative to the sector.`
        }
      } else {
        reason = `EV/EBITDA aligns with the blended estimate, suggesting the enterprise multiple is consistent with the assumed debt level and margin profile.`
      }
    }

    if (m.id === 'revenue_multiple') {
      if (direction === 'above') {
        if (currentEbitdaMargin != null && currentEbitdaMargin < 0.10) {
          reason = `Revenue Multiple is the highest estimate — it values top-line scale without penalising today's thin margins. This is common for companies growing into profitability.`
        } else if (assumptions.cagr > 0.20) {
          reason = `A high projected CAGR (${(assumptions.cagr * 100).toFixed(0)}%) compounds into a large exit revenue base, driving the EV/Revenue estimate above the blend.`
        } else {
          reason = `Revenue Multiple is above the blend. The exit EV/Revenue assumption of ${assumptions.revenueMultiple.toFixed(1)}× may be elevated — benchmark against sector peers.`
        }
      } else if (direction === 'below') {
        if (assumptions.revenueMultiple < 2) {
          reason = `A conservative exit EV/Revenue of ${assumptions.revenueMultiple.toFixed(1)}× produces a below-blend estimate. Verify this reflects the right sector multiple.`
        } else {
          reason = `Revenue Multiple is below the blended estimate, possibly because the discount rate offsets the projected revenue growth.`
        }
      } else {
        reason = `Revenue Multiple is in line with the blend, suggesting the growth-adjusted revenue assumption is consistent with the other methods.`
      }
    }

    if (m.id === 'core_dcf') {
      if (direction === 'below') {
        if (currentFcfMargin != null && currentFcfMargin < 0.03) {
          reason = `DCF is the most conservative estimate because today's free cash flow margin is very thin (${currentFcfMargin != null ? (currentFcfMargin * 100).toFixed(1) : '~0'}%). When near-term cash flows are small, terminal value dominates and is highly sensitive to assumptions.`
        } else if (assumptions.wacc > 0.12) {
          reason = `A high WACC of ${(assumptions.wacc * 100).toFixed(1)}% aggressively discounts future cash flows, pushing the DCF estimate below the multiples-based models.`
        } else {
          reason = `Core DCF produces a conservative estimate. Unlike multiples, it doesn't benefit from multiple expansion — value comes purely from discounted free cash flows.`
        }
      } else if (direction === 'above') {
        if (assumptions.wacc < 0.08) {
          reason = `A low WACC of ${(assumptions.wacc * 100).toFixed(1)}% amplifies the terminal value, pushing DCF above the multiples-based estimates.`
        } else {
          reason = `DCF is above the blend, suggesting strong projected cash flows relative to what the multiples-based methods are pricing in.`
        }
      } else {
        reason = `Core DCF aligns with the blended estimate, indicating that the projected cash flows and discount rate are consistent with the multiples applied.`
      }
    }

    return { methodId: m.id, methodName: m.method, direction, deviationPct, confidence, reason }
  })

  // Overall summary
  let summary = ''
  if (debtOverhangDropped) {
    summary = `DCF excluded: net debt exceeded the estimated enterprise value. The blended estimate uses multiples-based methods only — treat with caution and verify debt figures.`
  } else if (level === 'low') {
    summary = `All ${valid.length} models agree within ${(cv * 100).toFixed(0)}% of each other — a strong signal with high confidence in the blended estimate.`
  } else if (level === 'moderate') {
    const highExpl = methodExplanations.find(e => e.direction === 'above')
    const lowExpl = methodExplanations.find(e => e.direction === 'below')
    if (highExpl && lowExpl) {
      summary = `Moderate spread across models (${(spreadVsPrice * 100).toFixed(0)}% of price). ${highExpl.methodName} skews high while ${lowExpl.methodName} skews low — see explanations below.`
    } else {
      summary = `Models show moderate disagreement (CV ${(cv * 100).toFixed(0)}%). The blended estimate smooths the spread, but individual method assumptions deserve scrutiny.`
    }
  } else {
    summary = `High model divergence — spread of ${(spreadVsPrice * 100).toFixed(0)}% relative to the current price. This often signals a company in transition (e.g., scaling into profitability). Treat any single model with caution and focus on assumption quality.`
  }

  return { cv, spreadVsPrice, level, overallConfidence, summary, methodExplanations }
}

export function computeCockpitOutput(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
): CockpitOutput {
  const { currentPrice } = snapshot
  const W = getEffectiveWeights(snapshot)

  const revenueBase = snapshot.ttmRevenueDollars ?? snapshot.ltvRevenueDollars
  const ke = assumptions.ke ?? assumptions.wacc
  const termFade = dynamicTerminalFade(assumptions.cagr, assumptions.terminalG, assumptions.ke ?? assumptions.wacc * 1.2)

  // 1. Forward P/E (Phase 1: discount at Ke, dynamic terminal fade)
  // Pre-revenue biotech: exitPE === 0 means skip this method entirely
  const skipFwdPE = assumptions.exitPE <= 0
  const fwdPE = skipFwdPE ? null : computeForwardPE({
    ltvRevenue: revenueBase,
    sharesOutstanding: snapshot.sharesRaw,
    revenueCAGR: assumptions.cagr,
    netMargin: assumptions.netMargin,
    exitPE: assumptions.exitPE,
    dilutionRate: assumptions.dilutionRate,
    discountRate: ke,
    currentPrice,
    dividendYield: snapshot.dividendYield,
    terminalCAGR: termFade,
  })

  // 2. Adaptive method (P/B for financials, P/FFO for REITs, DDM for utilities, EV/EBITDA for rest)
  const adaptiveMethod = resolveAdaptiveMethod(snapshot.companyType ?? 'standard', snapshot.sector)
  let thirdMethodResult: { fairValuePerShare: number | null; guardErrors: string[] }
  let thirdMethodId: string
  let thirdMethodName: string
  let thirdMethodDesc: string

  if (adaptiveMethod === 'pb') {
    const pb = computePBValuation(snapshot, assumptions)
    thirdMethodResult = pb
    thirdMethodId = 'price_to_book'
    thirdMethodName = 'Price / Book'
    const pbCompanyType = snapshot.companyType ?? 'financial'
    thirdMethodDesc = pbCompanyType === 'mreeit'
      ? 'P/B (book value) is the primary anchor for mortgage REITs — earnings driven by net interest spread and leverage, not property cash flows.'
      : pbCompanyType === 'alt_asset'
      ? 'P/B for alternative asset managers reflects the premium over tangible NAV. Justified P/B = (ROE − g) / (Ke − g) for high-ROE platforms.'
      : 'Justified P/B = (ROE − g) / (Ke − g), blended 60% with market P/B. Standard anchor for banks and financial companies — reflects ROE premium over cost of equity.'
  } else if (adaptiveMethod === 'pffo') {
    const pffo = computePFFO({
      netIncomeDollars: snapshot.netIncomeDollars ?? null,
      dnaDollars: snapshot.dnaDollars ?? null,
      sharesOutstanding: snapshot.sharesRaw,
      exitPFFOMultiple: assumptions.exitPFFOMultiple ?? null,
      currentPrice,
    })
    thirdMethodResult = { fairValuePerShare: pffo.fairValueToday, guardErrors: pffo.guardErrors }
    thirdMethodId = 'p_ffo'
    thirdMethodName = 'Price / FFO'
    thirdMethodDesc = 'FFO = Net Income + D&A − property gains. Industry-standard REIT metric — strips out real estate depreciation that distorts GAAP earnings.'
  } else if (adaptiveMethod === 'ddm') {
    const ddmResult = calculateDDM(
      snapshot.dividendPerShare ?? 0,
      ke,
      snapshot.roe ?? null,
      snapshot.payoutRatio ?? 0.60,
      currentPrice,
    )
    thirdMethodResult = {
      fairValuePerShare: ddmResult.applicable ? ddmResult.fairValuePerShare : null,
      guardErrors: ddmResult.applicable ? [] : [ddmResult.reason],
    }
    thirdMethodId = 'ddm'
    thirdMethodName = 'Dividend Discount'
    thirdMethodDesc = `Gordon Growth DDM: D₁ / (Ke − g). Sustainable growth g = ROE × (1 − payout). Most reliable for regulated utilities with stable, high dividend payout ratios.`
  } else {
    const ev = computeEVEBITDA({
      ttmEbitda: snapshot.ttmEbitdaDollars,
      netDebt: snapshot.netDebtDollars,
      shares: snapshot.sharesRaw,
      exitMultiple: assumptions.exitMultiple,
      currentPrice,
    })
    thirdMethodResult = ev
    thirdMethodId = 'ev_ebitda'
    thirdMethodName = 'EV/EBITDA'
    thirdMethodDesc = 'Snapshot: TTM EBITDA × exit multiple − net debt. No growth projection — most reliable for stable-margin companies.'
  }

  // 3. Revenue Multiple
  const revMult = computeRevenueMultiple({
    ltvRevenue: revenueBase,
    revenueCAGR: assumptions.cagr,
    exitEVRevenue: assumptions.revenueMultiple,
    netDebt: snapshot.netDebtDollars,
    sharesOutstanding: snapshot.sharesRaw,
    dilutionRate: assumptions.dilutionRate,
    discountRate: assumptions.wacc,
    currentPrice,
    dividendYield: snapshot.dividendYield,
  })

  // 4. Core DCF — use the Full DCF Table's 4-model Damodaran blend when available
  // (scenarios.base.fairValue from the API). Fall back to internal UFCF 50/50 blend
  // only when that pre-computed value is absent, so both panels always agree.
  let dcfFV: number | null = null
  let dcfErrors: string[] = []
  let debtOverhangDropped = false

  if (snapshot.fullDcfFairValue != null && snapshot.fullDcfFairValue > 0) {
    // Use the Full DCF Table result directly — keeps Core DCF card and Full DCF Table in sync
    dcfFV = snapshot.fullDcfFairValue
  } else if (snapshot.baseFCF > 0 && snapshot.sharesM > 0) {
    const g = Math.min(Math.max(assumptions.terminalG, 0.005), assumptions.wacc - 0.02)
    if (g > 0 && g < assumptions.wacc) {
      const years = 10
      const dcf = projectCashFlows({
        baseFCF: snapshot.baseFCF,
        cagr: assumptions.cagr,
        wacc: assumptions.wacc,
        terminalG: g,
        years,
        growthModel: snapshot.growthModel,
      })
      if (dcf.ev != null && dcf.projections.length > 0) {
        const lastCF = dcf.projections[dcf.projections.length - 1].cashFlow
        const tvExit = (lastCF * assumptions.exitMultiple) / Math.pow(1 + assumptions.wacc, years)
        const evBlended = (dcf.ev + (dcf.sumPV + tvExit)) / 2
        const equity = evBlended + snapshot.cashM - snapshot.debtM
        const raw = Math.round((equity / snapshot.sharesM) * 100) / 100
        if (raw <= 0) {
          debtOverhangDropped = true
          dcfErrors = ['Net debt exceeds estimated enterprise value — DCF excluded']
        } else {
          const cap = currentPrice > 0 ? currentPrice * 10 : Infinity
          if (raw > cap) dcfErrors = ['Terminal value capped at 10× market price']
          dcfFV = Math.min(raw, cap)
        }
      } else {
        dcfErrors = dcf.terminalGrowthViolation ? ['Terminal growth violation'] : ['No cash flow projections']
      }
    } else {
      dcfErrors = ['Terminal growth rate too close to WACC — result unreliable']
    }
  } else {
    dcfErrors = ['Insufficient FCF or share data']
  }

  const upside = (fv: number | null) =>
    fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null

  // 5. EPV (Earnings Power Value — Greenwald zero-growth perpetuity)
  // Only computed for company types where EPV weight > 0
  const epvResult = W.epv > 0 ? computeEPV({
    operatingIncomeM: snapshot.ttmOperatingIncomeDollars != null
      ? snapshot.ttmOperatingIncomeDollars / 1e6 : null,
    normalizedOperatingIncomeM: snapshot.normalizedOperatingIncomeDollars != null
      ? snapshot.normalizedOperatingIncomeDollars / 1e6 : null,
    taxRate: assumptions.taxRate ?? 0.21,
    wacc: assumptions.wacc,
    netDebtM: snapshot.debtM - snapshot.cashM,
    sharesM: snapshot.sharesM,
    currentPrice,
    currentEPS: snapshot.currentEPS ?? null,
    normalizedEPS: snapshot.normalizedEPS ?? null,
  }) : null

  const fwdPEFairValue = skipFwdPE ? null : (fwdPE?.fairValueToday ?? null)
  const fwdPEErrors = skipFwdPE
    ? ['Pre-revenue or no earnings base — Forward P/E excluded from blend']
    : (fwdPE?.guardErrors ?? [])

  const methods: CockpitMethodResult[] = [
    {
      id: 'forward_pe',
      method: 'Forward P/E',
      fairValue: fwdPEFairValue,
      weight: W.forward_pe,
      confidence: fwdPEErrors.length === 0 && fwdPEFairValue != null ? 'high' : 'low',
      description: 'Projects revenue × exit net margin to year 5, applies exit P/E, discounts back at Ke (cost of equity). Assumes margin expands to exit-year level.',
      upsidePct: upside(fwdPEFairValue),
      errors: fwdPEErrors,
    },
    {
      id: thirdMethodId,
      method: thirdMethodName,
      fairValue: thirdMethodResult.fairValuePerShare ?? null,
      weight: W.ev_ebitda,
      confidence: thirdMethodResult.guardErrors.length === 0 ? 'high' : 'low',
      description: thirdMethodDesc,
      upsidePct: upside(thirdMethodResult.fairValuePerShare ?? null),
      errors: thirdMethodResult.guardErrors,
    },
    {
      id: 'revenue_multiple',
      method: 'Revenue Multiple',
      fairValue: revMult.fairValueToday ?? null,
      weight: W.revenue_multiple,
      confidence: revMult.guardErrors.length === 0 ? 'medium' : 'low',
      description: 'Projects 5Y revenue at CAGR, applies EV/Revenue multiple at exit, discounts equity back. Best suited for pre-profit or high-growth companies.',
      upsidePct: upside(revMult.fairValueToday ?? null),
      errors: revMult.guardErrors,
    },
    {
      id: 'core_dcf',
      method: 'Core DCF',
      fairValue: dcfFV,
      weight: W.core_dcf,
      confidence: dcfFV != null ? 'medium' : 'low',
      description: snapshot.fullDcfFairValue != null && snapshot.fullDcfFairValue > 0
        ? 'Full DCF Table 4-model Damodaran blend (UFCF+PGM, UFCF+EM, LFCF+PGM, LFCF+EM) using company-type-specific weights — see the Full DCF Table below for year-by-year detail.'
        : 'UFCF blend: 50% Gordon Growth (PGM) + 50% Exit Multiple terminal value. Full DCF Table result not available.',
      upsidePct: upside(dcfFV),
      errors: dcfErrors,
    },
  ]

  // Add EPV method when weight > 0 (standard, dividend, utility, energy, mining types)
  if (W.epv > 0) {
    const epvFV = epvResult?.epvPerShare ?? null
    const epvErrors = epvResult?.guardErrors ?? ['EPV not applicable for this company type']
    const premPct = epvResult?.growthPremiumPct
    const premStr = premPct != null ? `${(premPct * 100).toFixed(0)}%` : 'N/A'
    const epvConf: CockpitMethodResult['confidence'] =
      epvFV == null ? 'low' : epvResult?.isCyclical ? 'medium' : 'high'
    methods.push({
      id: 'epv',
      method: 'Earnings Power Value',
      fairValue: epvFV,
      weight: W.epv,
      confidence: epvConf,
      description: epvResult?.isCyclical
        ? `EPV = NOPAT ÷ WACC using 5Y normalized EBIT. ${epvResult.cyclicalWarning ?? ''} Growth premium: ${premStr} of price.`
        : `EPV = NOPAT ÷ WACC. Zero-growth floor — what this business earns today in steady state. Growth premium: ${premStr} of price.`,
      upsidePct: upside(epvFV),
      errors: epvErrors,
      meta: {
        growthPremiumPct: epvResult?.growthPremiumPct ?? null,
        isCyclical: epvResult?.isCyclical ?? false,
        cyclicalWarning: epvResult?.cyclicalWarning ?? null,
        effectiveNopatM: epvResult?.effectiveNopatM ?? null,
      },
    })
  }

  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  const totalWeight = valid.reduce((s, m) => s + m.weight, 0)
  const blendedFairValue = totalWeight > 0
    ? Math.round(valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / totalWeight * 100) / 100
    : null

  // Reverse DCF for market-implied growth
  const safeTG = Math.min(Math.max(assumptions.terminalG, 0.005), assumptions.wacc - 0.02)
  const reverseDcf = computeReverseDCF({
    currentPrice,
    sharesOutstanding: snapshot.sharesRaw,
    cashM: snapshot.cashM,
    debtM: snapshot.debtM,
    lastRevenue: snapshot.ttmRevenueDollars ?? snapshot.ltvRevenueDollars,
    lastFCFMargin: snapshot.fcfMargin,
    wacc: assumptions.wacc,
    terminalG: safeTG,
    historicalCAGR: snapshot.historicalCAGR,
  })

  const divergence = computeDivergence(methods, blendedFairValue, assumptions, snapshot, debtOverhangDropped)

  // Fix 5: proportional deltas — ±10% of WACC, ±15% of CAGR (minimum 0.5pp / 1pp)
  const wD = Math.max(assumptions.wacc * 0.10, 0.005)
  const cD = Math.max(Math.abs(assumptions.cagr) * 0.15, 0.01)

  const rawScenarios = {
    bull: { fairValue: scenarioBlendFV(assumptions, snapshot, -wD, +cD), wacc: assumptions.wacc - wD, cagr: assumptions.cagr + cD },
    base: { fairValue: blendedFairValue, wacc: assumptions.wacc, cagr: assumptions.cagr },
    bear: { fairValue: scenarioBlendFV(assumptions, snapshot, +wD, -cD), wacc: assumptions.wacc + wD, cagr: assumptions.cagr - cD },
  }

  // Ensure Bear ≤ Base ≤ Bull: non-linear multi-method blend can violate this in edge cases
  const fvBear = rawScenarios.bear.fairValue ?? 0
  const fvBase = rawScenarios.base.fairValue ?? 0
  const fvBull = rawScenarios.bull.fairValue ?? 0
  const [sortedBear, sortedBase, sortedBull] = [fvBear, fvBase, fvBull].sort((a, b) => a - b)
  const scenarios = {
    bear: { ...rawScenarios.bear, fairValue: sortedBear },
    base: { ...rawScenarios.base, fairValue: sortedBase },
    bull: { ...rawScenarios.bull, fairValue: sortedBull },
  }

  // After sort, the canonical fair value must align with the sorted base scenario.
  // Without this, the "Blended Fair Value" card and the "Base Case" scenario card
  // can show different numbers when the sort reorders the raw values.
  const canonicalFV = sortedBase > 0 ? sortedBase : blendedFairValue
  const canonicalUpside = canonicalFV != null && currentPrice > 0
    ? (canonicalFV - currentPrice) / currentPrice
    : null
  let canonicalVerdict: CockpitOutput['verdict'] = 'Insufficient Data'
  if (canonicalUpside != null) {
    if (canonicalUpside >= 0.20) canonicalVerdict = 'Undervalued'
    else if (canonicalUpside >= 0.00) canonicalVerdict = 'Fairly Valued'
    else canonicalVerdict = 'Overvalued'
  }

  return {
    blendedFairValue: canonicalFV,
    methods,
    scenarios,
    verdict: canonicalVerdict,
    upsidePct: canonicalUpside,
    marketImpliedGrowth: reverseDcf.impliedCAGR,
    marketImpliedText: reverseDcf.interpretationText,
    marketImpliedInterpretation: reverseDcf.interpretation,
    divergence,
  }
}

// ─── Versioned engine interface ───────────────────────────────────────────────
//
// V1 is the current production engine. The existing `computeCockpitOutput`
// function is preserved as-is and aliased to `computeCockpitOutputV1`.
//
// V2 will be added in lib/valuation/v2/ and wired up here when ready.
// The public `computeCockpitOutput` remains the stable external API.

/**
 * V1 engine — the current production implementation.
 * Never remove or rename this function; existing callers that saved a
 * reference to V1 must continue to work.
 */
export const computeCockpitOutputV1 = computeCockpitOutput

/**
 * V2 engine — placeholder until Phase 4 implementation is complete.
 * Currently forwards to V1 so callers can wire up the version flag safely.
 * @internal Do not call directly from UI components.
 */
export function computeCockpitOutputV2(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
): CockpitOutput {
  // V2 implementation lives in lib/valuation/v2/index.ts.
  // Until it is complete and validated, V2 falls back to V1.
  // This prevents accidental exposure of an incomplete engine.
  try {
    // Dynamic import avoids circular deps if v2 imports from cockpit.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const v2Module = require('./v2') as { computeCockpitOutputV2Impl?: typeof computeCockpitOutput }
    if (typeof v2Module?.computeCockpitOutputV2Impl === 'function') {
      return v2Module.computeCockpitOutputV2Impl(assumptions, snapshot)
    }
  } catch {
    // V2 module not yet available — fall through to V1.
  }
  // Fallback: V1 with a diagnostic marker in divergence summary
  const v1Result = computeCockpitOutput(assumptions, snapshot)
  return {
    ...v1Result,
    divergence: {
      ...v1Result.divergence,
      summary: `[V2 fallback to V1] ${v1Result.divergence.summary}`,
    },
  }
}
