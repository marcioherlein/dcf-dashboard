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
export function extractFCFInputs(financials: any): { baseFCF: number; cagr: number; historicalRevenues: number[] } {
  const fd = financials.financialData ?? {}

  // FCF directly from financialData (most reliable in v3)
  const baseFCF = ((fd.freeCashflow ?? fd.operatingCashflow ?? 0) as number) / 1e6

  // CAGR: blend current YoY revenue growth + analyst +1y estimate
  const currentGrowth: number = fd.revenueGrowth ?? 0.07
  const trends: any[] = financials.earningsTrend?.trend ?? []
  const nextYearTrend = trends.find((t: any) => t.period === '+1y')
  const analystGrowth: number = nextYearTrend?.revenueEstimate?.growth ?? currentGrowth

  // Blend and cap: avoid projecting the most recent anomalous year forever
  const blendedCagr = (currentGrowth + analystGrowth) / 2
  const cagr = Math.min(Math.max(blendedCagr, -0.10), 0.30)

  // Historical revenues for display (income stmt if available, else empty)
  const incStmts: any[] = financials.incomeStatementHistory?.incomeStatementHistory ?? []
  const historicalRevenues = incStmts
    .map((s: any) => ((s.totalRevenue ?? 0) as number) / 1e6)
    .filter((r) => r > 0)

  return { baseFCF, cagr: Math.round(cagr * 1000) / 1000, historicalRevenues }
}
