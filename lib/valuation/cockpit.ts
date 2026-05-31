import { computeForwardPE } from './methods/forwardPE'
import { computeEVEBITDA } from './methods/evEbitda'
import { computeRevenueMultiple } from './methods/revenueMultiple'
import { computeReverseDCF } from './methods/reverseDcf'
import { projectCashFlows } from '../dcf/projectCashFlows'

export interface ValuationAssumptions {
  wacc: number           // e.g. 0.10
  cagr: number           // 5Y revenue CAGR e.g. 0.12
  terminalG: number      // e.g. 0.03
  netMargin: number      // e.g. 0.18
  dilutionRate: number   // e.g. 0.015
  exitPE: number         // Forward P/E exit multiple e.g. 22
  exitMultiple: number   // EV/EBITDA exit multiple e.g. 14
  revenueMultiple: number // EV/Revenue e.g. 4.5
}

// Fixed financial data extracted from apiData — does NOT change with assumptions
export interface CockpitSnapshot {
  currentPrice: number
  currency: string
  // Raw dollar values (not millions) for PE, EV/EBITDA, Revenue Multiple methods
  ltvRevenueDollars: number | null
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
  // Pre-computed 4-model DCF blend from Full DCF Table (scenarios.base.fairValue).
  // When present, Core DCF uses this directly instead of re-running the UFCF-only blend.
  fullDcfFairValue?: number | null
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
  divergence: DivergenceAnalysis
}

type MethodWeights = { forward_pe: number; ev_ebitda: number; revenue_multiple: number; core_dcf: number }

const COCKPIT_WEIGHTS: Record<string, MethodWeights> = {
  standard:  { forward_pe: 0.35, ev_ebitda: 0.30, revenue_multiple: 0.25, core_dcf: 0.10 },
  growth:    { forward_pe: 0.25, ev_ebitda: 0.25, revenue_multiple: 0.35, core_dcf: 0.15 },
  startup:   { forward_pe: 0.10, ev_ebitda: 0.15, revenue_multiple: 0.45, core_dcf: 0.30 },
  financial: { forward_pe: 0.45, ev_ebitda: 0.05, revenue_multiple: 0.15, core_dcf: 0.35 },
  dividend:  { forward_pe: 0.35, ev_ebitda: 0.25, revenue_multiple: 0.15, core_dcf: 0.25 },
  etf:       { forward_pe: 0.25, ev_ebitda: 0.25, revenue_multiple: 0.25, core_dcf: 0.25 },
}

// Fix 1+2+3: runs all 4 methods at given assumptions and returns weighted blended fair value.
// Fix 1: terminal growth is capped at wacc−0.02 (200bps minimum spread) to prevent denominator explosion.
// Fix 3: DCF output is discarded if it exceeds 8× current price (terminal value explosion guard).
export function computeBlendedFV(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
): number | null {
  const { currentPrice } = snapshot
  const W = COCKPIT_WEIGHTS[snapshot.companyType ?? 'standard'] ?? COCKPIT_WEIGHTS.standard

  const fwdPE = computeForwardPE({
    ltvRevenue: snapshot.ltvRevenueDollars,
    sharesOutstanding: snapshot.sharesRaw,
    revenueCAGR: assumptions.cagr,
    netMargin: assumptions.netMargin,
    exitPE: assumptions.exitPE,
    dilutionRate: assumptions.dilutionRate,
    discountRate: assumptions.wacc,
    currentPrice,
    dividendYield: snapshot.dividendYield,
  })

  const evEbitda = computeEVEBITDA({
    ttmEbitda: snapshot.ttmEbitdaDollars,
    netDebt: snapshot.netDebtDollars,
    shares: snapshot.sharesRaw,
    exitMultiple: assumptions.exitMultiple,
    currentPrice,
  })

  const revMult = computeRevenueMultiple({
    ltvRevenue: snapshot.ltvRevenueDollars,
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
      { fv: fwdPE.fairValueToday ?? null, w: W.forward_pe },
      { fv: evEbitda.fairValuePerShare ?? null, w: W.ev_ebitda },
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
  const W = COCKPIT_WEIGHTS[snapshot.companyType ?? 'standard'] ?? COCKPIT_WEIGHTS.standard

  // 1. Forward P/E
  const fwdPE = computeForwardPE({
    ltvRevenue: snapshot.ltvRevenueDollars,
    sharesOutstanding: snapshot.sharesRaw,
    revenueCAGR: assumptions.cagr,
    netMargin: assumptions.netMargin,
    exitPE: assumptions.exitPE,
    dilutionRate: assumptions.dilutionRate,
    discountRate: assumptions.wacc,
    currentPrice,
    dividendYield: snapshot.dividendYield,
  })

  // 2. EV/EBITDA
  const evEbitda = computeEVEBITDA({
    ttmEbitda: snapshot.ttmEbitdaDollars,
    netDebt: snapshot.netDebtDollars,
    shares: snapshot.sharesRaw,
    exitMultiple: assumptions.exitMultiple,
    currentPrice,
  })

  // 3. Revenue Multiple
  const revMult = computeRevenueMultiple({
    ltvRevenue: snapshot.ltvRevenueDollars,
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

  const methods: CockpitMethodResult[] = [
    {
      id: 'forward_pe',
      method: 'Forward P/E',
      fairValue: fwdPE.fairValueToday ?? null,
      weight: W.forward_pe,
      confidence: fwdPE.guardErrors.length === 0 ? 'high' : 'low',
      description: 'Projects revenue × exit net margin to year 5, applies exit P/E, discounts back at WACC. Assumes margin expands to exit-year level.',
      upsidePct: upside(fwdPE.fairValueToday ?? null),
      errors: fwdPE.guardErrors,
    },
    {
      id: 'ev_ebitda',
      method: 'EV/EBITDA',
      fairValue: evEbitda.fairValuePerShare ?? null,
      weight: W.ev_ebitda,
      confidence: evEbitda.guardErrors.length === 0 ? 'high' : 'low',
      description: 'Snapshot: TTM EBITDA × exit multiple − net debt. No growth projection — most reliable for stable-margin companies.',
      upsidePct: upside(evEbitda.fairValuePerShare ?? null),
      errors: evEbitda.guardErrors,
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

  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  const totalWeight = valid.reduce((s, m) => s + m.weight, 0)
  const blendedFairValue = totalWeight > 0
    ? Math.round(valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / totalWeight * 100) / 100
    : null

  const upsidePct = blendedFairValue != null && currentPrice > 0
    ? (blendedFairValue - currentPrice) / currentPrice
    : null

  let verdict: CockpitOutput['verdict'] = 'Insufficient Data'
  if (upsidePct != null) {
    if (upsidePct > 0.15) verdict = 'Undervalued'
    else if (upsidePct < -0.15) verdict = 'Overvalued'
    else verdict = 'Fairly Valued'
  }

  // Reverse DCF for market-implied growth
  const safeTG = Math.min(Math.max(assumptions.terminalG, 0.005), assumptions.wacc - 0.02)
  const reverseDcf = computeReverseDCF({
    currentPrice,
    sharesOutstanding: snapshot.sharesRaw,
    cashM: snapshot.cashM,
    debtM: snapshot.debtM,
    lastRevenue: snapshot.ltvRevenueDollars,
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

  return {
    blendedFairValue,
    methods,
    scenarios,
    verdict,
    upsidePct,
    marketImpliedGrowth: reverseDcf.impliedCAGR,
    marketImpliedText: reverseDcf.interpretationText,
    divergence,
  }
}
