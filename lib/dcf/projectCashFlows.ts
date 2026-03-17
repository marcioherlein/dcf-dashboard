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
  analystEstimate2y: number
  blended: number
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
export function extractFCFInputs(financials: any): {
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

  // --- CAGR: multi-source analysis ---

  // Historical CAGR
  // For financial companies: use NET INCOME CAGR, not revenue CAGR.
  // Bank revenues swing wildly with interest rates (JPM NII exploded in 2022-2023);
  // net income growth better reflects sustainable earnings power.
  let historicalCagr3y: number

  if (isFinancialSector && netIncomeHistory.length >= 2) {
    const n = Math.min(netIncomeHistory.length - 1, 3)
    historicalCagr3y = Math.pow(netIncomeHistory[0] / netIncomeHistory[n], 1 / n) - 1
    // Normalize extreme swings: a 3Y NI CAGR > 20% for a mature bank is almost certainly
    // a rate-cycle artifact, not sustainable earnings growth. Cap firmly.
    historicalCagr3y = Math.min(Math.max(historicalCagr3y, -0.10), 0.20)
  } else if (historicalRevenues.length >= 2) {
    const n = Math.min(historicalRevenues.length - 1, 3)
    historicalCagr3y = Math.pow(historicalRevenues[0] / historicalRevenues[n], 1 / n) - 1
  } else {
    historicalCagr3y = (fd.revenueGrowth ?? 0.07) as number
  }

  // Analyst estimates from earningsTrend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trends: any[] = financials.earningsTrend?.trend ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next1y = trends.find((t: any) => t.period === '+1y')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next2y = trends.find((t: any) => t.period === '+2y')

  const numAnalysts = (next1y?.revenueEstimate?.numberOfAnalysts ?? 0) as number

  // For financial companies: use earnings estimate (EPS growth), not revenue growth.
  // Bank revenue estimates reflect interest rate assumptions that don't proxy for value creation.
  const analyst1y: number = isFinancialSector
    ? ((next1y?.earningsEstimate?.growth ?? next1y?.revenueEstimate?.growth ?? historicalCagr3y) as number)
    : ((next1y?.revenueEstimate?.growth ?? historicalCagr3y) as number)

  const analyst2y: number = isFinancialSector
    ? ((next2y?.earningsEstimate?.growth ?? next2y?.revenueEstimate?.growth ?? analyst1y * 0.85) as number)
    : ((next2y?.revenueEstimate?.growth ?? analyst1y * 0.85) as number)

  // Confidence scoring
  const analystCoverageScore = Math.min(numAnalysts / 15, 1)
  const growthDiff = Math.abs(historicalCagr3y - analyst1y)
  const consistencyScore = Math.exp(-growthDiff * 3)
  const confidence = analystCoverageScore * 0.6 + consistencyScore * 0.4
  const confidenceLabel: 'High' | 'Medium' | 'Low' =
    confidence > 0.65 ? 'High' : confidence > 0.35 ? 'Medium' : 'Low'

  // Blended CAGR
  const analystWeight = 0.3 + analystCoverageScore * 0.4
  const blendedCagr = historicalCagr3y * (1 - analystWeight) + analyst1y * analystWeight

  // CAGR bounds:
  // - Financial companies: max 12% (mature banks rarely exceed this sustainably)
  // - Other companies: max 50% (high-growth like NU can be 40-60%)
  const cagrCap = isFinancialSector ? 0.12 : 0.50
  const cagr = Math.min(Math.max(blendedCagr, -0.10), cagrCap)

  // Growth drivers
  const drivers: string[] = []
  if (isFinancialSector) {
    drivers.push('Financial sector — net income CAGR used (bank revenues distorted by interest rate cycle)')
    drivers.push('Base FCF = normalized net income × 0.85 (2-year avg to smooth one-time charges)')
  }
  if (!isFinancialSector && isNegativeFCF && rawOCF > 0) drivers.push('Operating cash flow positive — growth CapEx drives negative FCF')
  if (!isFinancialSector && isNegativeFCF && rawOCF <= 0) drivers.push('Pre-profitability stage — FCF seeded from revenue base')
  if (historicalCagr3y > 0.30) drivers.push(`Strong historical growth: ${(historicalCagr3y * 100).toFixed(0)}% 3Y CAGR`)
  else if (historicalCagr3y > 0.10) drivers.push(`Steady historical growth: ${(historicalCagr3y * 100).toFixed(0)}% 3Y CAGR`)
  if (analyst1y > historicalCagr3y * 1.1) drivers.push('Analyst estimates above historical trend — positive revision cycle')
  else if (analyst1y < historicalCagr3y * 0.9) drivers.push('Analyst estimates below historical trend — growth deceleration expected')
  if (numAnalysts >= 15) drivers.push(`High analyst coverage (${numAnalysts} analysts)`)
  else if (numAnalysts >= 5) drivers.push(`Moderate analyst coverage (${numAnalysts} analysts)`)
  else drivers.push('Limited analyst coverage — estimate weighted toward historical trend')
  if (rawRevM > 10000 && !isFinancialSector) drivers.push('Large revenue base — law of large numbers may compress future growth')

  if (drivers.length === 0) drivers.push('Estimate based on blended historical and analyst data')

  const cagrAnalysis: CAGRAnalysis = {
    historicalCagr3y: Math.round(historicalCagr3y * 1000) / 1000,
    analystEstimate1y: Math.round(analyst1y * 1000) / 1000,
    analystEstimate2y: Math.round(analyst2y * 1000) / 1000,
    blended: Math.round(cagr * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel,
    numAnalysts,
    drivers,
  }

  return {
    baseFCF,
    cagr: Math.round(cagr * 1000) / 1000,
    cagrAnalysis,
    historicalRevenues,
    isNegativeFCF,
    normalizedNetIncomeM: Math.round(normalizedNetIncomeM),
  }
}
