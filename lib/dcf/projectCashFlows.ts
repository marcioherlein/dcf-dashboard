export interface CFProjection {
  year: number
  cashFlow: number   // projected FCF (millions)
  discounted: number // PV of FCF
}

export interface ProjectionInputs {
  baseFCF: number       // starting FCF (millions)
  cagr: number          // annual growth rate, e.g. 0.12
  wacc: number          // discount rate, e.g. 0.0938
  terminalG: number     // terminal growth rate, e.g. 0.01
  years?: number        // projection years, default 10
  startYear?: number    // first forecast year
}

export interface DCFResult {
  projections: CFProjection[]
  terminalValue: number
  terminalValueDiscounted: number
  sumPV: number
  ev: number
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
  const { baseFCF, cagr, wacc, terminalG, years = 10, startYear = new Date().getFullYear() } = inputs

  const projections: CFProjection[] = []
  let cf = baseFCF

  for (let t = 1; t <= years; t++) {
    cf = cf * (1 + cagr)
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
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFCFInputs(financials: any): {
  baseFCF: number
  cagr: number
  cagrAnalysis: CAGRAnalysis
  historicalRevenues: number[]
  isNegativeFCF: boolean
} {
  const fd = financials.financialData ?? {}

  // --- SECTOR DETECTION: financial companies have OCF distorted by loan/client fund flows ---
  const sector = ((financials.summaryProfile?.sector ?? '') as string).toLowerCase()
  const industry = ((financials.summaryProfile?.industry ?? '') as string).toLowerCase()
  const isFinancialSector = /bank|insurance|financ|fintech|payment|credit|lending|capital|asset management/i.test(sector + ' ' + industry)

  // --- BASE FCF ---
  const rawFCF = ((fd.freeCashflow ?? 0) as number) / 1e6
  const rawOCF = ((fd.operatingCashflow ?? 0) as number) / 1e6
  const rawRevM = ((fd.totalRevenue ?? 0) as number) / 1e6
  const rawNetIncomeM = ((fd.netIncomeToCommon ?? 0) as number) / 1e6

  let baseFCF: number
  let isNegativeFCF = false

  if (isFinancialSector) {
    // For banks/fintechs/payment processors, OCF includes loan disbursements and client fund flows
    // which are not real operating costs. Net income × haircut is a better proxy for distributable earnings.
    if (rawNetIncomeM > 0) {
      baseFCF = rawNetIncomeM * 0.85
      isNegativeFCF = rawFCF <= 0
    } else if (rawFCF > 0) {
      baseFCF = rawFCF
    } else {
      baseFCF = Math.max(rawRevM * 0.02, 1)
      isNegativeFCF = true
    }
  } else if (rawFCF > 0) {
    baseFCF = rawFCF
  } else if (rawOCF > 0) {
    // OCF proxy: high-growth companies spend FCF on expansion CapEx; OCF is closer to earnings power
    baseFCF = rawOCF * 0.6
    isNegativeFCF = true
  } else {
    // Pre-profitability floor: seed from 2% of revenue (assumes path to profitability)
    baseFCF = Math.max(rawRevM * 0.02, 1)
    isNegativeFCF = true
  }

  // --- CAGR: multi-source analysis ---

  // 1. Historical revenue CAGR from income statement (Yahoo sorts most-recent first)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incStmts: any[] = financials.incomeStatementHistory?.incomeStatementHistory ?? []
  const historicalRevenues = incStmts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => ((s.totalRevenue ?? 0) as number) / 1e6)
    .filter((r) => r > 0)

  let historicalCagr3y = (fd.revenueGrowth ?? 0.07) as number
  if (historicalRevenues.length >= 2) {
    const n = Math.min(historicalRevenues.length - 1, 3)
    // revs[0] = most recent, revs[n] = oldest available — compute CAGR
    historicalCagr3y = Math.pow(historicalRevenues[0] / historicalRevenues[n], 1 / n) - 1
  }

  // 2. Analyst estimates from earningsTrend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trends: any[] = financials.earningsTrend?.trend ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next1y = trends.find((t: any) => t.period === '+1y')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next2y = trends.find((t: any) => t.period === '+2y')

  const numAnalysts = (next1y?.revenueEstimate?.numberOfAnalysts ?? 0) as number
  const analyst1y = (next1y?.revenueEstimate?.growth ?? historicalCagr3y) as number
  const analyst2y = (next2y?.revenueEstimate?.growth ?? analyst1y * 0.85) as number

  // 3. Confidence: analyst coverage quality × growth consistency
  const analystCoverageScore = Math.min(numAnalysts / 15, 1)
  const growthDiff = Math.abs(historicalCagr3y - analyst1y)
  const consistencyScore = Math.exp(-growthDiff * 3) // 1.0 if identical, decays exponentially
  const confidence = analystCoverageScore * 0.6 + consistencyScore * 0.4
  const confidenceLabel: 'High' | 'Medium' | 'Low' =
    confidence > 0.65 ? 'High' : confidence > 0.35 ? 'Medium' : 'Low'

  // 4. Blended CAGR: trust analysts more when coverage is high
  const analystWeight = 0.3 + analystCoverageScore * 0.4
  const blendedCagr = historicalCagr3y * (1 - analystWeight) + analyst1y * analystWeight

  // Cap raised to 50% to accommodate high-growth companies (NU has ~40-60% revenue growth)
  const cagr = Math.min(Math.max(blendedCagr, -0.10), 0.50)

  // 5. Growth drivers: derived from numeric signals
  const drivers: string[] = []
  if (isFinancialSector) drivers.push('Financial sector — model uses net income × 0.85 (OCF unreliable for banks/fintechs)')
  if (!isFinancialSector && isNegativeFCF && rawOCF > 0) drivers.push('Operating cash flow positive — growth CapEx drives negative FCF')
  if (!isFinancialSector && isNegativeFCF && rawOCF <= 0) drivers.push('Pre-profitability stage — FCF seeded from revenue base')
  if (historicalCagr3y > 0.30) drivers.push(`Strong historical revenue growth: ${(historicalCagr3y * 100).toFixed(0)}% 3Y CAGR`)
  else if (historicalCagr3y > 0.10) drivers.push(`Steady historical growth: ${(historicalCagr3y * 100).toFixed(0)}% 3Y CAGR`)
  if (analyst1y > historicalCagr3y * 1.1) drivers.push('Analyst estimates above historical trend — positive revision cycle')
  else if (analyst1y < historicalCagr3y * 0.9) drivers.push('Analyst estimates below historical trend — growth deceleration expected')
  if (numAnalysts >= 15) drivers.push(`High analyst coverage (${numAnalysts} analysts)`)
  else if (numAnalysts >= 5) drivers.push(`Moderate analyst coverage (${numAnalysts} analysts)`)
  else drivers.push('Limited analyst coverage — estimate weighted toward historical trend')
  if (rawRevM > 10000) drivers.push('Large revenue base — law of large numbers may compress future growth')

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
  }
}
