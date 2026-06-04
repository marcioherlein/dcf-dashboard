/**
 * Assumption Auditor — cross-validates seeded ValuationAssumptions against
 * independent signals already present in the API response.
 *
 * Runs server-side (pure function, no I/O). Results are embedded in the API
 * response as `assumptionAudit` so the client renders them without re-computing.
 *
 * Seven rules — one per critical assumption:
 *   R1  exitPE       vs. analyst-implied forward P/E
 *   R2  cagr         vs. analyst revenue consensus
 *   R3  netMargin    vs. trailing trend + peer median
 *   R4  terminalG    vs. country risk premium (EM uplift)
 *   R5  revenueMultiple vs. peer median EV/Revenue
 *   R6  ke / wacc    spread for levered companies
 *   R7  cagr quality gate — Piotroski F-score + ROIC
 */

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'
import { getIndustryMultiples } from '@/lib/dcf/calculateMultiples'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditResult {
  key: keyof ValuationAssumptions | 'quality'
  label: string                        // human-readable assumption name
  currentValue: number | null          // what the model is using
  severity: 'ok' | 'warn' | 'error'
  signal: string                       // short chip label
  reason: string                       // 1–2 sentences for the user
  suggestedValue?: number              // optional one-click fix
  confidence: 'high' | 'medium' | 'low'
  benchmark?: { label: string; value: number } // what it was checked against
}

export interface AssumptionAudit {
  results: AuditResult[]
  score: number        // 0–100
  grade: 'A' | 'B' | 'C' | 'D'
  warnCount: number
  errorCount: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = Record<string, any>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(v: number): string { return `${(v * 100).toFixed(1)}%` }
function times(v: number): string { return `${v.toFixed(1)}×` }

function numMedian(vals: number[]): number | null {
  const clean = vals.filter(v => typeof v === 'number' && isFinite(v) && v > 0)
  if (clean.length === 0) return null
  const s = [...clean].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2
}

function ok(key: AuditResult['key'], label: string, value: number | null, signal: string, confidence: AuditResult['confidence'] = 'high'): AuditResult {
  return { key, label, currentValue: value, severity: 'ok', signal, reason: '', confidence }
}

// ─── Rule 1: Exit P/E vs. analyst-implied forward P/E ─────────────────────────

function auditExitPE(apiData: ApiData, assumptions: ValuationAssumptions): AuditResult {
  const key: AuditResult['key'] = 'exitPE'
  const label = 'Exit P/E'
  const current = assumptions.exitPE

  // Skip for REITs (P/FFO used instead) and pre-revenue biotech (exitPE=0 is intentional)
  const companyType = apiData.valuationMethods?.companyType ?? 'standard'
  if (companyType === 'reit' || current <= 0) {
    return ok(key, label, current, companyType === 'reit' ? 'Not applicable (REIT — uses P/FFO)' : 'Excluded (pre-revenue)', 'medium')
  }

  const sector = apiData.quote?.sector ?? ''
  const industry = apiData.quote?.industry ?? ''
  const { pe: sectorPE } = getIndustryMultiples(industry, sector)
  const price: number = apiData.quote?.price ?? 0
  const cagr: number = assumptions.cagr ?? 0

  // Get analyst forward EPS — prefer +2Y for high-growth companies (earnings are ramping)
  // because +1Y forward P/E on nascent profitability is compressed and misleading
  const estimates: any[] = apiData.analystForwardEstimates ?? []
  const fwd1y = estimates.find((e: any) => e.period === '+1y')
  const fwd2y = estimates.find((e: any) => e.period === '+2y')

  const isHighGrowth = cagr > 0.20
  // For high-growth companies, use 2Y forward P/E when available (more representative)
  const fwdEntry = isHighGrowth && fwd2y?.eps?.avg != null && fwd2y.eps.avg > 0 ? fwd2y : fwd1y
  const fwdEPS: number | null = fwdEntry?.eps?.avg ?? null
  const numAnalysts: number = fwdEntry?.eps?.analysts ?? 0
  const periodLabel = fwdEntry === fwd2y ? '+2Y' : '+1Y'

  // Sector mismatch check — is exit P/E appropriate for this company type?
  // High-growth financial companies (neobanks) misclassified as "Banks" get PE=12×
  // which is 2–3× below where they should trade
  const isFinancialSector = (sector ?? '').toLowerCase().includes('financ')
  const isBankIndustry = /bank/i.test(industry ?? '')
  const isGrowthFinancial = isFinancialSector && cagr > 0.20

  if (isGrowthFinancial && isBankIndustry && current < 20) {
    // Fintech misclassified as bank — exit P/E anchored to wrong peer set
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Bank multiple for growth fintech (${sectorPE}× sector)`,
      reason: `Industry "${industry}" maps to bank sector medians (P/E ~${sectorPE}×), but ` +
        `this company has ${(cagr * 100).toFixed(0)}% CAGR — far above mature bank norms. ` +
        `High-growth digital finance companies (NU, StoneCo, MELI) exit at 25–35× earnings, ` +
        `not bank multiples. Suggested exit: 28× (conservative growth fintech).`,
      suggestedValue: 28,
      confidence: numAnalysts >= 5 ? 'high' : 'medium',
      benchmark: { label: 'Bank sector median', value: sectorPE },
    }
  }

  if (fwdEPS == null || fwdEPS <= 0 || numAnalysts < 3 || price <= 0) {
    // Fall back to sector median check
    if (sectorPE > 0 && current < sectorPE * 0.50) {
      return {
        key, label, currentValue: current, severity: 'warn',
        signal: `Below sector median (${sectorPE.toFixed(0)}×)`,
        reason: `Exit P/E of ${current.toFixed(0)}× is less than half the sector median of ${sectorPE}×. This may reflect the wrong industry bucket.`,
        suggestedValue: Math.round(sectorPE * 0.9),
        confidence: 'low',
        benchmark: { label: 'Sector median', value: sectorPE },
      }
    }
    return ok(key, label, current, 'Insufficient analyst data to validate', 'low')
  }

  const impliedFwdPE = price / fwdEPS
  const ratio = current / impliedFwdPE
  const confidence: AuditResult['confidence'] = numAnalysts >= 10 ? 'high' : 'medium'
  const benchLabel = `Analyst-implied ${periodLabel} fwd P/E`

  if (ratio < 0.55) {
    const suggested = Math.round(impliedFwdPE * 0.85)
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Well below ${periodLabel} forward P/E (${impliedFwdPE.toFixed(0)}×)`,
      reason: `${numAnalysts} analysts price ${times(impliedFwdPE)} ${periodLabel} forward P/E. ` +
        `The model exits at ${current.toFixed(0)}× — likely because the sector lookup matched ` +
        `a mature peer group. A 5-year exit of ${suggested}× (15% discount to ${periodLabel} forward) ` +
        `is more consistent with this company's earnings trajectory.`,
      suggestedValue: suggested,
      confidence,
      benchmark: { label: benchLabel, value: Math.round(impliedFwdPE * 10) / 10 },
    }
  }

  if (ratio > 1.80) {
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Aggressive vs. ${periodLabel} forward P/E (${impliedFwdPE.toFixed(0)}×)`,
      reason: `Exit P/E of ${current.toFixed(0)}× implies significant multiple expansion from ` +
        `the ${periodLabel} forward P/E of ${impliedFwdPE.toFixed(0)}×. This requires the company to re-rate ` +
        `upward — possible for compounders but adds forecast risk.`,
      confidence,
      benchmark: { label: benchLabel, value: Math.round(impliedFwdPE * 10) / 10 },
    }
  }

  return {
    ...ok(key, label, current, `Consistent with ${periodLabel} forward P/E (${impliedFwdPE.toFixed(0)}×)`, confidence),
    benchmark: { label: benchLabel, value: Math.round(impliedFwdPE * 10) / 10 },
  }
}

// ─── Rule 2: CAGR vs. analyst revenue consensus ────────────────────────────────

function auditCAGR(apiData: ApiData, assumptions: ValuationAssumptions): AuditResult {
  const key: AuditResult['key'] = 'cagr'
  const label = 'Revenue CAGR'
  const current = assumptions.cagr

  const cagrAnalysis = apiData.cagrAnalysis
  const analystEst: number | null = cagrAnalysis?.analystEstimate1y ?? null
  const numAnalysts: number = cagrAnalysis?.numAnalysts ?? 0

  if (analystEst == null || numAnalysts < 3) {
    return ok(key, label, current, 'No analyst consensus to validate against', 'low')
  }

  const diff = current - analystEst   // positive = model is higher than analysts
  const absDiff = Math.abs(diff)
  const confidence: AuditResult['confidence'] = numAnalysts >= 10 ? 'high' : 'medium'

  if (absDiff > 0.15) {
    // More than 15pp divergence from analyst consensus — significant mismatch
    if (diff > 0) {
      return {
        key, label, currentValue: current, severity: 'error',
        signal: `${pct(absDiff)} above analyst consensus`,
        reason: `The model assumes ${pct(current)} CAGR but ${numAnalysts} analysts forecast ` +
          `${pct(analystEst)} revenue growth for the next year. ` +
          `A ${pct(absDiff)} gap above consensus adds substantial forecast risk — ` +
          `most DCF errors come from over-estimating growth.`,
        suggestedValue: Math.round((analystEst + 0.02) * 1000) / 1000,
        confidence,
        benchmark: { label: `${numAnalysts}-analyst consensus`, value: Math.round(analystEst * 1000) / 1000 },
      }
    } else {
      return {
        key, label, currentValue: current, severity: 'warn',
        signal: `${pct(absDiff)} below analyst consensus`,
        reason: `The model assumes ${pct(current)} CAGR but ${numAnalysts} analysts forecast ` +
          `${pct(analystEst)}. The model may be too conservative — consider using ` +
          `${pct(analystEst)} as the base case.`,
        suggestedValue: Math.round(analystEst * 1000) / 1000,
        confidence,
        benchmark: { label: `${numAnalysts}-analyst consensus`, value: Math.round(analystEst * 1000) / 1000 },
      }
    }
  }

  if (absDiff > 0.08) {
    // 8–15pp divergence — worth noting
    return {
      key, label, currentValue: current,
      severity: diff > 0 ? 'warn' : 'ok',
      signal: diff > 0
        ? `${pct(absDiff)} above analyst consensus`
        : `Slightly below analyst consensus`,
      reason: diff > 0
        ? `Model CAGR of ${pct(current)} is moderately above the ${numAnalysts}-analyst consensus of ${pct(analystEst)}.`
        : `Model CAGR of ${pct(current)} is slightly below the ${numAnalysts}-analyst consensus of ${pct(analystEst)}.`,
      confidence,
      benchmark: { label: `${numAnalysts}-analyst consensus`, value: Math.round(analystEst * 1000) / 1000 },
    }
  }

  return {
    ...ok(key, label, current, `Matches analyst consensus (${numAnalysts} analysts, ${pct(analystEst)})`, confidence),
    benchmark: { label: `${numAnalysts}-analyst consensus`, value: Math.round(analystEst * 1000) / 1000 },
  }
}

// ─── Rule 3: Net margin vs. trailing trend + peer median ──────────────────────

function auditNetMargin(apiData: ApiData, assumptions: ValuationAssumptions): AuditResult {
  const key: AuditResult['key'] = 'netMargin'
  const label = 'Exit Net Margin'
  const current = assumptions.netMargin

  // Trailing margin from businessProfile
  const trailingMargin: number | null = apiData.businessProfile?.netMargin ?? null

  // Peer median net margin from peerComps (need to compute from priceToSales + trailingPE)
  // Use quarterly ratiosQuarterly as better source, fall back to sector median
  const sector = apiData.quote?.sector ?? ''
  const industry = apiData.quote?.industry ?? ''
  const { pe: sectorPE, evRevenue: sectorEvRev } = getIndustryMultiples(industry, sector)
  // Rough peer margin proxy: EV/Revenue / (P/E) approximates net margin
  const peerMarginProxy = (sectorPE > 0 && sectorEvRev > 0) ? (1 / sectorPE) * sectorEvRev * 0.1 : null

  // Recent quarterly margin trend from FMP ratiosQuarterly
  const ratiosQ: any[] = apiData.ratiosQuarterly ?? []
  const recentMargins = ratiosQ
    .slice(0, 4)
    .map((r: any) => r.netProfitMargin ?? r.netIncomePerEBT ?? null)
    .filter((v: any): v is number => typeof v === 'number' && isFinite(v))

  const trendMargin = recentMargins.length >= 2
    ? recentMargins.reduce((s, v) => s + v, 0) / recentMargins.length
    : trailingMargin

  if (trendMargin == null && peerMarginProxy == null) {
    return ok(key, label, current, 'Insufficient data to validate margin', 'low')
  }

  const baselineMargin = trendMargin ?? peerMarginProxy!

  // Check: is expansion realistic?
  // Growth companies expanding toward maturity CAN have higher margins — allow up to +12pp
  // But if seeded > trailing + 20pp, that requires exceptional execution
  const expansionNeeded = current - baselineMargin

  if (expansionNeeded > 0.20 && baselineMargin > 0) {
    // Very aggressive margin expansion assumption
    const suggested = Math.min(current, baselineMargin + 0.12)
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Aggressive expansion (+${pct(expansionNeeded)} vs trailing)`,
      reason: `Exit margin of ${pct(current)} requires a ${pct(expansionNeeded)} expansion ` +
        `from the trailing ${pct(baselineMargin)}. Even best-in-class cost leverage ` +
        `rarely exceeds +12–15pp over 5 years without evidence of operating leverage in quarterly data. ` +
        `Consider ${pct(suggested)} as a base case.`,
      suggestedValue: Math.round(suggested * 1000) / 1000,
      confidence: 'medium',
      benchmark: { label: 'Trailing net margin', value: Math.round(baselineMargin * 1000) / 1000 },
    }
  }

  if (expansionNeeded > 0.12 && baselineMargin > 0) {
    // Moderately optimistic — flag but don't error
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Optimistic expansion (+${pct(expansionNeeded)} vs trailing)`,
      reason: `Model assumes ${pct(current)} exit margin vs trailing ${pct(baselineMargin)}. ` +
        `This is achievable for a high-growth company with strong operating leverage, ` +
        `but verify the quarterly trend confirms margin expansion.`,
      confidence: 'medium',
      benchmark: { label: 'Trailing net margin', value: Math.round(baselineMargin * 1000) / 1000 },
    }
  }

  if (current <= 0 && baselineMargin > 0.05) {
    // Pre-profit assumption when company is already profitable
    return {
      key, label, currentValue: current, severity: 'error',
      signal: 'Model assumes no profit (company is profitable)',
      reason: `Exit net margin of ${pct(current)} implies the company won't be profitable ` +
        `at exit, but trailing margin is already ${pct(baselineMargin)}. This will cause ` +
        `Forward P/E to produce a near-zero fair value.`,
      suggestedValue: Math.round(baselineMargin * 1000) / 1000,
      confidence: 'high',
      benchmark: { label: 'Trailing net margin', value: Math.round(baselineMargin * 1000) / 1000 },
    }
  }

  const benchmarkLabel = recentMargins.length >= 2
    ? `TTM avg margin (${recentMargins.length}Q)`
    : 'Trailing net margin'

  return {
    ...ok(key, label, current,
      expansionNeeded > 0
        ? `Plausible expansion from ${pct(baselineMargin)} trailing`
        : `Consistent with trailing margin (${pct(baselineMargin)})`,
      'medium',
    ),
    benchmark: { label: benchmarkLabel, value: Math.round(baselineMargin * 1000) / 1000 },
  }
}

// ─── Rule 4: Terminal growth vs. country risk premium ────────────────────────

function auditTerminalG(apiData: ApiData, assumptions: ValuationAssumptions): AuditResult {
  const key: AuditResult['key'] = 'terminalG'
  const label = 'Terminal Growth'
  const current = assumptions.terminalG

  const crp: number = apiData.wacc?.crp ?? 0
  const rfRate: number = apiData.wacc?.inputs?.rfRate ?? 0.043
  const country: string = apiData.quote?.country ?? ''

  // Developed markets (CRP ≤ 2%): standard check — just ensure it's reasonable
  if (crp <= 0.02) {
    if (current > 0.035) {
      return {
        key, label, currentValue: current, severity: 'warn',
        signal: `High for developed market (${pct(current)})`,
        reason: `Terminal growth of ${pct(current)} exceeds long-run developed-market nominal GDP (~2.5–3%). ` +
          `This will inflate the terminal value significantly — use 2–3% for mature US/European companies.`,
        suggestedValue: 0.025,
        confidence: 'high',
      }
    }
    return ok(key, label, current, `Consistent with developed-market GDP (~${pct(rfRate - 0.01)} real)`, 'high')
  }

  // Emerging market: terminal growth floor = rfRate + 2% (proxy for nominal EM GDP)
  const emFloor = Math.min(rfRate + 0.02, 0.055)
  const countryNote = country ? ` (${country})` : ''

  if (current < emFloor - 0.005) {
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Low for EM company — CRP ${pct(crp)}`,
      reason: `This company operates in an emerging market${countryNote} with a ${pct(crp)} country risk premium. ` +
        `Terminal growth of ${pct(current)} assumes long-run developed-market GDP convergence. ` +
        `A floor of ${pct(emFloor)} (risk-free rate ${pct(rfRate)} + 2%) better reflects ` +
        `local nominal GDP growth, where inflation alone is typically 3–5%.`,
      suggestedValue: Math.round(emFloor * 1000) / 1000,
      confidence: 'high',
      benchmark: { label: `EM floor (RF + 2%)`, value: Math.round(emFloor * 1000) / 1000 },
    }
  }

  return {
    ...ok(key, label, current, `Appropriate for EM company (CRP ${pct(crp)})`, 'high'),
    benchmark: { label: `EM floor (RF + 2%)`, value: Math.round(emFloor * 1000) / 1000 },
  }
}

// ─── Rule 5: Revenue multiple vs. peer EV/Revenue ─────────────────────────────

function auditRevenueMultiple(apiData: ApiData, assumptions: ValuationAssumptions): AuditResult {
  const key: AuditResult['key'] = 'revenueMultiple'
  const label = 'Exit EV/Revenue'
  const current = assumptions.revenueMultiple

  // Live peer median first
  const peerComps: any[] = apiData.peerComps ?? []
  const peerEVRevValues = peerComps
    .map((p: any) => p.evToRevenue)
    .filter((v: any): v is number => typeof v === 'number' && isFinite(v) && v > 0 && v < 200)

  let benchmarkValue: number | null = null
  let benchmarkLabel = ''

  if (peerEVRevValues.length >= 3) {
    benchmarkValue = numMedian(peerEVRevValues)!
    benchmarkLabel = `${peerEVRevValues.length}-peer median`
  } else {
    const sector = apiData.quote?.sector ?? ''
    const industry = apiData.quote?.industry ?? ''
    const { evRevenue } = getIndustryMultiples(industry, sector)
    benchmarkValue = evRevenue
    benchmarkLabel = 'Industry median'
  }

  if (benchmarkValue == null || benchmarkValue <= 0) {
    return ok(key, label, current, 'No peer data to validate against', 'low')
  }

  const ratio = current / benchmarkValue

  if (ratio < 0.50) {
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Below peer median (${times(benchmarkValue)})`,
      reason: `Exit EV/Revenue of ${times(current)} is less than half the ${benchmarkLabel} ` +
        `of ${times(benchmarkValue)}. This may understate the exit valuation, particularly ` +
        `for growth companies where revenue multiples remain elevated.`,
      suggestedValue: Math.round(benchmarkValue * 0.75 * 10) / 10,
      confidence: peerEVRevValues.length >= 3 ? 'medium' : 'low',
      benchmark: { label: benchmarkLabel, value: Math.round(benchmarkValue * 10) / 10 },
    }
  }

  if (ratio > 2.0) {
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Aggressive vs. peer median (${times(benchmarkValue)})`,
      reason: `Exit EV/Revenue of ${times(current)} is 2× the ${benchmarkLabel} ` +
        `of ${times(benchmarkValue)}. This requires sustained premium valuation at exit.`,
      confidence: 'medium',
      benchmark: { label: benchmarkLabel, value: Math.round(benchmarkValue * 10) / 10 },
    }
  }

  return {
    ...ok(key, label, current, `Near ${benchmarkLabel} (${times(benchmarkValue)})`,
      peerEVRevValues.length >= 3 ? 'medium' : 'low'),
    benchmark: { label: benchmarkLabel, value: Math.round(benchmarkValue * 10) / 10 },
  }
}

// ─── Rule 6: Ke / WACC spread for levered companies ───────────────────────────

function auditKe(apiData: ApiData, assumptions: ValuationAssumptions): AuditResult {
  const key: AuditResult['key'] = 'ke'
  const label = 'Cost of Equity (Ke)'
  const current = assumptions.ke ?? assumptions.wacc
  const wacc = assumptions.wacc

  const debtM: number = apiData.fairValue?.debt ?? 0
  const cashM: number = apiData.fairValue?.cash ?? 0
  const marketCapM: number = (apiData.quote?.marketCap ?? 0) / 1e6
  const netDebtM = debtM - cashM
  const deToEquity = marketCapM > 0 ? netDebtM / marketCapM : 0

  const spread = current - wacc

  // Ke should always be ≥ WACC. For leveraged companies the gap should be meaningful.
  if (spread < 0) {
    return {
      key, label, currentValue: current, severity: 'error',
      signal: 'Ke below WACC — structurally wrong',
      reason: `Cost of equity (${pct(current)}) is below WACC (${pct(wacc)}). ` +
        `Equity is always riskier than the blended capital structure — Ke must be ≥ WACC. ` +
        `This will cause Forward P/E to use too low a discount rate and overstate fair value.`,
      suggestedValue: Math.round(wacc * 1.12 * 1000) / 1000,
      confidence: 'high',
    }
  }

  if (spread < 0.01 && deToEquity > 0.5) {
    // Highly levered company but Ke ≈ WACC — equity risk not being priced
    return {
      key, label, currentValue: current, severity: 'warn',
      signal: `Ke too close to WACC (D/E ${(deToEquity * 100).toFixed(0)}%)`,
      reason: `This company carries significant debt (D/E ~${(deToEquity * 100).toFixed(0)}%) yet ` +
        `Ke (${pct(current)}) is nearly equal to WACC (${pct(wacc)}). ` +
        `Equity holders bear residual risk — expect Ke at least 1–2pp above WACC.`,
      suggestedValue: Math.round((wacc + 0.015) * 1000) / 1000,
      confidence: 'medium',
    }
  }

  return ok(key, label, current,
    `${pct(spread)} spread above WACC (${pct(wacc)}) — appropriate`,
    'high',
  )
}

// ─── Rule 7: Piotroski F-score + ROIC quality gate ────────────────────────────

function auditQuality(apiData: ApiData, assumptions: ValuationAssumptions): AuditResult {
  const key: AuditResult['key'] = 'quality'
  const label = 'Model Quality'

  const piotroski: number | null = apiData.scores?.piotroski ?? null
  const roic: number | null = apiData.scores?.roic ?? null
  const cagr = assumptions.cagr

  if (piotroski == null && roic == null) {
    return ok(key, label, null, 'Quality scores not available', 'low')
  }

  // F-score < 4 with high growth assumption — financial health is weak
  if (piotroski != null && piotroski < 4 && cagr > 0.15) {
    return {
      key, label, currentValue: piotroski, severity: 'warn',
      signal: `Weak fundamentals (F-score ${piotroski}/9) with high CAGR`,
      reason: `The Piotroski F-score is ${piotroski}/9 (below 4 = financially weak) yet the model ` +
        `assumes ${pct(cagr)} revenue growth. Companies with deteriorating fundamentals rarely ` +
        `sustain high growth — consider a more conservative CAGR.`,
      confidence: 'medium',
    }
  }

  // ROIC < 0: company is destroying capital — high growth would make it worse
  if (roic != null && roic < 0 && cagr > 0.10) {
    return {
      key, label, currentValue: roic, severity: 'warn',
      signal: `Negative ROIC (${pct(roic)}) with high growth assumption`,
      reason: `Return on invested capital is negative (${pct(roic)}), meaning each dollar of growth ` +
        `destroys value. The model's ${pct(cagr)} CAGR assumption would compound this destruction. ` +
        `Investigate whether negative ROIC is a temporary investment phase or structural.`,
      confidence: 'medium',
    }
  }

  // Good quality signals
  const goodSignals: string[] = []
  if (piotroski != null && piotroski >= 7) goodSignals.push(`F-score ${piotroski}/9`)
  if (roic != null && roic > assumptions.wacc) goodSignals.push(`ROIC ${pct(roic)} > WACC`)

  if (goodSignals.length > 0) {
    return ok(key, label, piotroski ?? roic,
      `Strong fundamentals — ${goodSignals.join(', ')}`, 'high')
  }

  return ok(key, label, piotroski ?? null, 'No quality concerns flagged', 'medium')
}

// ─── Score & Grade ────────────────────────────────────────────────────────────

function computeGrade(results: AuditResult[]): { score: number; grade: 'A' | 'B' | 'C' | 'D' } {
  let score = 100
  for (const r of results) {
    if (r.severity === 'error') score -= 20
    else if (r.severity === 'warn') score -= 8
  }
  score = Math.max(0, score)
  const grade = score >= 90 ? 'A' : score >= 72 ? 'B' : score >= 52 ? 'C' : 'D'
  return { score, grade }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function runAssumptionAudit(
  apiData: ApiData,
  assumptions: ValuationAssumptions,
): AssumptionAudit {
  const results: AuditResult[] = [
    auditExitPE(apiData, assumptions),
    auditCAGR(apiData, assumptions),
    auditNetMargin(apiData, assumptions),
    auditTerminalG(apiData, assumptions),
    auditRevenueMultiple(apiData, assumptions),
    auditKe(apiData, assumptions),
    auditQuality(apiData, assumptions),
  ]

  const { score, grade } = computeGrade(results)
  const warnCount = results.filter(r => r.severity === 'warn').length
  const errorCount = results.filter(r => r.severity === 'error').length

  return { results, score, grade, warnCount, errorCount }
}
