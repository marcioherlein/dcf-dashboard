export interface CFProjection {
  year: number
  cashFlow: number   // projected FCF (millions)
  discounted: number // PV of FCF
}

export type GrowthModel = 'two-stage' | 'three-stage'

export interface ProjectionInputs {
  baseFCF: number       // starting FCF (millions)
  cagr: number          // annual growth rate, e.g. 0.12
  wacc: number          // discount rate, e.g. 0.0938
  terminalG: number     // terminal growth rate, e.g. 0.01
  years?: number        // projection years, default 10
  startYear?: number    // first forecast year
  growthModel?: GrowthModel  // 'two-stage' (default) or 'three-stage' (Damodaran fade)
}

export interface DCFResult {
  projections: CFProjection[]
  terminalValue: number
  terminalValueDiscounted: number
  sumPV: number
  ev: number
  growthModel: GrowthModel
  yearlyGrowthRates: number[]  // per-year growth rate used (length === projections.length)
}

export interface CAGRAnalysis {
  historicalCagr3y: number
  analystEstimate1y: number
  analystEstimate2y: number      // estimated fade (analyst2y or analyst1y × 0.85)
  fundamentalGrowth: number | null  // ROE × (1 − payout), valid only when 0 < ROE < 0.80
  blended: number                // final model input, post-cap
  rawBlended: number             // pre-cap, pre-convergence-discount (for transparency)
  cagrCap: number                // size/sector cap applied
  weights: { historical: number; analyst: number; fundamental: number }
  confidence: number
  confidenceLabel: 'High' | 'Medium' | 'Low'
  numAnalysts: number
  drivers: string[]
}

export function projectCashFlows(inputs: ProjectionInputs): DCFResult {
  const { baseFCF, cagr, wacc, terminalG, years = 10, startYear = new Date().getFullYear(), growthModel = 'two-stage' } = inputs

  const projections: CFProjection[] = []
  const yearlyGrowthRates: number[] = []
  let cf = baseFCF
  const halfway = Math.ceil(years / 2)  // year 5 for 10-year projection

  for (let t = 1; t <= years; t++) {
    let g: number
    if (growthModel === 'three-stage' && t > halfway) {
      // Linear fade from cagr → terminalG over the second half
      const fadeStep = t - halfway
      const fadePeriods = years - halfway
      g = cagr - (cagr - terminalG) * (fadeStep / fadePeriods)
    } else {
      g = cagr
    }
    yearlyGrowthRates.push(Math.round(g * 1000) / 1000)
    cf = cf * (1 + g)
    const discounted = cf / Math.pow(1 + wacc, t)
    projections.push({ year: startYear + t - 1, cashFlow: Math.round(cf), discounted: Math.round(discounted) })
  }

  const lastCF = projections[projections.length - 1].cashFlow
  const terminalValue = wacc > terminalG ? (lastCF * (1 + terminalG)) / (wacc - terminalG) : lastCF * 15
  const terminalValueDiscounted = terminalValue / Math.pow(1 + wacc, years)
  const sumPV = projections.reduce((sum, p) => sum + p.discounted, 0)
  const ev = sumPV + terminalValueDiscounted

  return {
    projections,
    terminalValue: Math.round(terminalValue),
    terminalValueDiscounted: Math.round(terminalValueDiscounted),
    sumPV: Math.round(sumPV),
    ev: Math.round(ev),
    growthModel,
    yearlyGrowthRates,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFCFInputs(financials: any, foreignCurrency = false): {
  baseFCF: number
  cagr: number
  cagrAnalysis: CAGRAnalysis
  historicalRevenues: number[]
  isNegativeFCF: boolean
  normalizedNetIncomeM: number  // smoothed net income for FCFE model
} {
  const fd = financials.financialData ?? {}

  // --- SECTOR DETECTION ---
  const sector = ((financials.summaryProfile?.sector ?? '') as string).toLowerCase()
  const industry = ((financials.summaryProfile?.industry ?? '') as string).toLowerCase()
  const isFinancialSector = /bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/i.test(sector + ' ' + industry)

  // --- BASE FIGURES ---
  const rawFCF = ((fd.freeCashflow ?? 0) as number) / 1e6
  const rawOCF = ((fd.operatingCashflow ?? 0) as number) / 1e6
  const rawRevM = ((fd.totalRevenue ?? 0) as number) / 1e6
  const rawNetIncomeM = ((fd.netIncomeToCommon ?? 0) as number) / 1e6

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incStmts: any[] = financials.incomeStatementHistory?.incomeStatementHistory ?? []

  // --- INCOME STATEMENT HISTORY ---
  // Revenue history (Yahoo sorts most-recent first)
  const historicalRevenues = incStmts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => ((s.totalRevenue ?? 0) as number) / 1e6)
    .filter((r) => r > 0)

  // Net income history (from income statement — more reliable than financialData for banks)
  const netIncomeHistory = incStmts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => {
      const ni = (s.netIncomeApplicableToCommonShares ?? s.netIncome ?? 0) as number
      return ni / 1e6
    })
    .filter((n) => n > 0)

  // Normalized net income: average last 2 years to smooth one-time charges (e.g. FDIC special assessment)
  // Fallback chain: (1) 2-year avg from income stmt, (2) most recent stmt, (3) fd.netIncomeToCommon, (4) 0
  let normalizedNetIncomeM = 0
  if (netIncomeHistory.length >= 2) {
    normalizedNetIncomeM = (netIncomeHistory[0] + netIncomeHistory[1]) / 2
  } else if (netIncomeHistory.length === 1) {
    normalizedNetIncomeM = netIncomeHistory[0]
  } else if (rawNetIncomeM > 0) {
    normalizedNetIncomeM = rawNetIncomeM
  }

  // --- BASE FCF ---
  let baseFCF: number
  let isNegativeFCF = false

  if (isFinancialSector) {
    // Banks/fintechs: OCF is distorted by loan disbursements and client fund flows.
    // Use normalized net income × haircut as the distributable earnings proxy.
    if (normalizedNetIncomeM > 0) {
      baseFCF = normalizedNetIncomeM * 0.85
      isNegativeFCF = rawFCF <= 0  // flag for UI, but don't block the model
    } else if (rawFCF > 0) {
      baseFCF = rawFCF
    } else {
      baseFCF = Math.max(rawRevM * 0.02, 1)
      isNegativeFCF = true
    }
  } else if (rawFCF > 0) {
    baseFCF = rawFCF
  } else if (rawOCF > 0) {
    baseFCF = rawOCF * 0.6
    isNegativeFCF = true
  } else {
    baseFCF = Math.max(rawRevM * 0.02, 1)
    isNegativeFCF = true
  }

  // ── CAGR: Damodaran 4-source blend ──────────────────────────────────────────
  //
  // Sources (in order of reliability for a 10-year DCF):
  //   1. Analyst consensus (forward-looking, USD, near-term)          ← primary
  //   2. Fundamental growth  = ROE × (1 − payout)  (sustainable)     ← anchor
  //   3. Historical 3Y CAGR  (backward, can reflect cyclical peaks)   ← check
  //   4. TTM earnings growth  (most recent signal, noisy)             ← minor
  //
  // Convergence discount: blended rates above 20% carry high uncertainty
  // (growth at that rate is rarely sustained for a full decade). A
  // Damodaran-style fade factor reduces the "excess" above 20% by 30%,
  // preventing the DCF from being dominated by optimistic near-term numbers.

  // ── Source 1: Analyst estimates ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trends: any[] = financials.earningsTrend?.trend ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next1y = trends.find((t: any) => t.period === '+1y')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next2y = trends.find((t: any) => t.period === '+2y')

  const numAnalysts = (next1y?.revenueEstimate?.numberOfAnalysts ?? 0) as number
  const analystCoverageScore = Math.min(numAnalysts / 15, 1)

  // Financial sector: use EPS growth (revenue distorted by rate cycles)
  const analystRaw1y: number | null = isFinancialSector
    ? ((next1y?.earningsEstimate?.growth ?? next1y?.revenueEstimate?.growth ?? null) as number | null)
    : ((next1y?.revenueEstimate?.growth ?? null) as number | null)

  const analystRaw2y: number | null = isFinancialSector
    ? ((next2y?.earningsEstimate?.growth ?? next2y?.revenueEstimate?.growth ?? null) as number | null)
    : ((next2y?.revenueEstimate?.growth ?? null) as number | null)

  // If 2Y is missing, estimate as a deceleration from 1Y (typical analyst pattern)
  const analyst1y: number = analystRaw1y ?? historicalRevenues.length >= 2
    ? (Math.pow(historicalRevenues[0] / historicalRevenues[Math.min(historicalRevenues.length - 1, 3)], 1 / Math.min(historicalRevenues.length - 1, 3)) - 1)
    : ((fd.revenueGrowth ?? 0.07) as number)
  const analyst2y: number = analystRaw2y ?? (analyst1y > 0.20 ? analyst1y * 0.80 : analyst1y * 0.88)

  // ── Source 2: Historical CAGR ────────────────────────────────────────────────
  // For foreign-currency companies this is in local currency (inflation-distorted)
  // and is zeroed out below. For others, cap at 60% to filter data outliers.
  let historicalCagr3y: number
  if (foreignCurrency) {
    historicalCagr3y = analyst1y  // placeholder — will be zeroed in weights
  } else if (isFinancialSector && netIncomeHistory.length >= 2) {
    const n = Math.min(netIncomeHistory.length - 1, 3)
    historicalCagr3y = Math.pow(netIncomeHistory[0] / netIncomeHistory[n], 1 / n) - 1
    historicalCagr3y = Math.min(Math.max(historicalCagr3y, -0.10), 0.20)
  } else if (historicalRevenues.length >= 2) {
    const n = Math.min(historicalRevenues.length - 1, 3)
    historicalCagr3y = Math.pow(historicalRevenues[0] / historicalRevenues[n], 1 / n) - 1
    // Clamp to avoid data outliers (spinoffs, reverse mergers, etc.)
    historicalCagr3y = Math.min(Math.max(historicalCagr3y, -0.20), 0.60)
  } else {
    historicalCagr3y = (fd.revenueGrowth ?? analyst1y) as number
  }

  // ── Source 3: Fundamental growth (Damodaran retention model) ────────────────
  // g_f = ROE × (1 − dividendPayoutRatio)
  // Only valid when ROE ∈ (0, 0.80) — values above 80% signal buyback-distorted equity
  // (AAPL ROE=152%, NVDA ROE=100% are meaningless for this formula).
  const sd = financials.summaryDetail ?? {}
  const roe = (fd.returnOnEquity ?? null) as number | null
  const payoutRatio = Math.min(Math.max((sd.payoutRatio ?? 0) as number, 0), 1)
  const retentionRatio = 1 - payoutRatio
  const fundamentalGrowth: number | null =
    (roe != null && roe > 0 && roe < 0.80)
      ? Math.min(roe * retentionRatio, 0.25)
      : null

  // ── Source 4: TTM earnings growth (minor sanity signal) ─────────────────────
  const earningsGrowthTTM = (fd.earningsGrowth ?? null) as number | null
  const ttmEarnings: number | null =
    (earningsGrowthTTM != null && earningsGrowthTTM > -0.60 && earningsGrowthTTM < 1.50)
      ? earningsGrowthTTM
      : null

  // ── Dynamic blending weights ─────────────────────────────────────────────────
  // Weights reflect data quality — analyst consensus is most reliable for DCF
  // when coverage is decent; fundamental growth anchors long-run sustainability.
  // Historical is backward-looking and can reflect cyclical peaks.
  //
  // Coverage tiers (numAnalysts):
  //   High  (≥10): analyst 55%, fundamental 25%, historical 15%, TTM 5%
  //   Medium (5-9): analyst 45%, fundamental 25%, historical 25%, TTM 5%
  //   Low   (<5):  analyst 30%, fundamental 30%, historical 35%, TTM 5%
  //   Zero:        historical 60%, fundamental 35%, TTM 5% (no analyst data)
  //
  // Overrides:
  //   Foreign currency: all weight on analyst + fundamental (historical discarded)
  //   Financial sector: caps apply, weights stay same (already using NI CAGR)
  //   No fundamental: redistribute its weight to analyst + historical proportionally

  let wAnalyst: number, wFundamental: number, wHistorical: number, wTTM: number

  if (foreignCurrency) {
    wHistorical  = 0
    wTTM         = 0
    if (fundamentalGrowth != null) {
      wAnalyst     = numAnalysts >= 2 ? 0.75 : 0.55
      wFundamental = 1 - wAnalyst
    } else {
      wAnalyst     = numAnalysts >= 1 ? 0.90 : 0
      wFundamental = 0
    }
  } else if (numAnalysts >= 10) {
    wAnalyst     = 0.55
    wFundamental = fundamentalGrowth != null ? 0.25 : 0
    wHistorical  = fundamentalGrowth != null ? 0.15 : 0.40
    wTTM         = ttmEarnings != null ? 0.05 : 0
  } else if (numAnalysts >= 5) {
    wAnalyst     = 0.45
    wFundamental = fundamentalGrowth != null ? 0.25 : 0
    wHistorical  = fundamentalGrowth != null ? 0.25 : 0.50
    wTTM         = ttmEarnings != null ? 0.05 : 0
  } else if (numAnalysts >= 1) {
    wAnalyst     = 0.30
    wFundamental = fundamentalGrowth != null ? 0.30 : 0
    wHistorical  = fundamentalGrowth != null ? 0.35 : 0.65
    wTTM         = ttmEarnings != null ? 0.05 : 0
  } else {
    wAnalyst     = 0
    wFundamental = fundamentalGrowth != null ? 0.35 : 0
    wHistorical  = fundamentalGrowth != null ? 0.60 : 0.95
    wTTM         = ttmEarnings != null ? 0.05 : 0
  }

  // Normalize to sum to 1
  const wSum = wAnalyst + wFundamental + wHistorical + wTTM
  if (wSum > 0) {
    wAnalyst     /= wSum
    wFundamental /= wSum
    wHistorical  /= wSum
    wTTM         /= wSum
  }

  const rawBlended =
    wAnalyst     * analyst1y +
    wFundamental * (fundamentalGrowth ?? 0) +
    wHistorical  * historicalCagr3y +
    wTTM         * (ttmEarnings ?? 0)

  // ── Convergence discount (Damodaran mean-reversion) ─────────────────────────
  // Growth rates above 20% are uncommon beyond 3-5 years even for top-quartile
  // companies. For every 5% above 20%, apply a 25% discount on the excess.
  // This prevents the DCF terminal value from being dominated by near-term
  // hypergrowth optimism while keeping the estimate in the right order of magnitude.
  let blendedCagr: number
  if (rawBlended > 0.20) {
    const excess = rawBlended - 0.20
    blendedCagr = 0.20 + excess * 0.75  // 25% discount on excess above 20%
  } else {
    blendedCagr = rawBlended
  }

  // ── Size-based CAGR cap (law of large numbers) ───────────────────────────────
  // Larger revenue bases make it mechanically harder to sustain high growth.
  // These caps are informed by Damodaran's observation that only ~1% of companies
  // sustain >25% revenue growth beyond a 5-year window.
  const revB = rawRevM / 1000  // revenue in USD billions
  let sizeCap: number
  if (isFinancialSector)    sizeCap = 0.12
  else if (foreignCurrency) sizeCap = 0.18
  else if (revB > 50)       sizeCap = 0.22  // mega-cap ($50B+ revenue)
  else if (revB > 10)       sizeCap = 0.28  // large-cap
  else if (revB > 2)        sizeCap = 0.38  // mid-cap
  else                      sizeCap = 0.55  // small-cap/startup

  const cagr = Math.min(Math.max(blendedCagr, -0.10), sizeCap)

  // ── Confidence score ─────────────────────────────────────────────────────────
  // Measures how much we trust the blended estimate:
  //   - Analyst coverage  (0–1): higher coverage = more reliable estimates
  //   - Consistency       (0–1): historical and analyst agree = more reliable
  //   - Source breadth    (0–1): more sources available = less uncertainty
  const consistencyScore = Math.exp(-Math.abs(historicalCagr3y - analyst1y) * 3)
  const sourceBreadth = [analystRaw1y != null, fundamentalGrowth != null, ttmEarnings != null].filter(Boolean).length / 3
  const confidence =
    analystCoverageScore * 0.50 +
    consistencyScore      * 0.30 +
    sourceBreadth         * 0.20
  const confidenceLabel: 'High' | 'Medium' | 'Low' =
    confidence > 0.65 ? 'High' : confidence > 0.35 ? 'Medium' : 'Low'

  // ── Growth drivers ────────────────────────────────────────────────────────────
  const drivers: string[] = []

  if (foreignCurrency) {
    drivers.push('Foreign reporting currency — historical local-currency CAGR discarded (inflation-distorted); USD analyst estimates used')
  }
  if (isFinancialSector) {
    drivers.push('Financial sector — net income CAGR used (bank revenues distorted by interest rate cycle)')
    drivers.push('Base FCF = normalized net income × 0.85 (2-year avg to smooth one-time charges)')
  }
  if (!isFinancialSector && isNegativeFCF && rawOCF > 0) {
    drivers.push('FCF negative due to growth CapEx — operating cash flow is positive; OCF × 0.6 used as proxy')
  }
  if (!isFinancialSector && isNegativeFCF && rawOCF <= 0) {
    drivers.push('Pre-profitability stage — FCF seeded from revenue base (2% margin assumption)')
  }
  if (fundamentalGrowth != null) {
    drivers.push(`Fundamental growth (ROE × retention): ${(fundamentalGrowth * 100).toFixed(1)}% — Damodaran retention model`)
  } else if (roe != null && roe >= 0.80) {
    drivers.push(`ROE = ${(roe * 100).toFixed(0)}% excluded from fundamental model (buyback-inflated equity base)`)
  } else if (roe != null && roe <= 0) {
    drivers.push(`ROE negative — fundamental growth model not applicable`)
  }
  if (!foreignCurrency) {
    if (historicalCagr3y > 0.30) {
      drivers.push(`Historical 3Y CAGR ${(historicalCagr3y * 100).toFixed(0)}% — high growth; convergence discount applied`)
    } else if (historicalCagr3y > 0.10) {
      drivers.push(`Historical 3Y CAGR ${(historicalCagr3y * 100).toFixed(0)}% — steady growth`)
    } else if (historicalCagr3y > 0) {
      drivers.push(`Historical 3Y CAGR ${(historicalCagr3y * 100).toFixed(0)}% — mature/slow-growth business`)
    } else {
      drivers.push(`Historical 3Y CAGR ${(historicalCagr3y * 100).toFixed(0)}% — revenue contraction`)
    }
  }
  if (numAnalysts >= 15) drivers.push(`Strong analyst coverage (${numAnalysts} analysts) — estimates weighted heavily`)
  else if (numAnalysts >= 5) drivers.push(`Moderate analyst coverage (${numAnalysts} analysts)`)
  else if (numAnalysts >= 1) drivers.push(`Thin analyst coverage (${numAnalysts} analyst${numAnalysts > 1 ? 's' : ''}) — weighted toward historical/fundamental`)
  else drivers.push('No analyst coverage — model uses historical + fundamental growth only')

  if (rawBlended > 0.20 && !foreignCurrency) {
    drivers.push(`Convergence discount applied: raw blend ${(rawBlended * 100).toFixed(1)}% → ${(blendedCagr * 100).toFixed(1)}% (Damodaran mean-reversion)`)
  }
  if (blendedCagr > sizeCap - 0.01) {
    drivers.push(`Size-based cap applied at ${(sizeCap * 100).toFixed(0)}% (${
      revB > 50 ? 'mega-cap' : revB > 10 ? 'large-cap' : revB > 2 ? 'mid-cap' : 'small-cap'
    } — law of large numbers)`)
  }

  const cagrAnalysis: CAGRAnalysis = {
    historicalCagr3y:  Math.round(historicalCagr3y * 1000) / 1000,
    analystEstimate1y: Math.round(analyst1y * 1000) / 1000,
    analystEstimate2y: Math.round(analyst2y * 1000) / 1000,
    fundamentalGrowth: fundamentalGrowth != null ? Math.round(fundamentalGrowth * 1000) / 1000 : null,
    blended:           Math.round(cagr * 1000) / 1000,
    rawBlended:        Math.round(rawBlended * 1000) / 1000,
    cagrCap:           sizeCap,
    weights: {
      historical:  Math.round(wHistorical * 100) / 100,
      analyst:     Math.round(wAnalyst    * 100) / 100,
      fundamental: Math.round(wFundamental * 100) / 100,
    },
    confidence:        Math.round(confidence * 100) / 100,
    confidenceLabel,
    numAnalysts,
    drivers,
  }

  return {
    baseFCF,
    cagr:                  Math.round(cagr * 1000) / 1000,
    cagrAnalysis,
    historicalRevenues,
    isNegativeFCF,
    normalizedNetIncomeM:  Math.round(normalizedNetIncomeM),
  }
}
