export interface CFProjection {
  year: number
  cashFlow: number   // projected FCF (millions)
  discounted: number // PV of FCF
}

export interface ProjectionInputs {
  baseFCF: number       // starting FCF (millions) — most recent year
  cagr: number          // annual growth rate, e.g. 0.12
  wacc: number          // discount rate, e.g. 0.0938
  terminalG: number     // terminal growth rate, e.g. 0.01
  years?: number        // projection years, default 10
  startYear?: number    // first forecast year, default current year
}

export interface DCFResult {
  projections: CFProjection[]
  terminalValue: number
  terminalValueDiscounted: number
  sumPV: number         // Σ discounted FCFs
  ev: number            // Enterprise Value = sumPV + TV_discounted
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
  const terminalValue = (lastCF * (1 + terminalG)) / (wacc - terminalG)
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

export function extractFCFInputs(financials: {
  cashflowStatementHistory?: { cashflowStatements?: { totalCashFromOperatingActivities?: number | null, capitalExpenditures?: number | null }[] }
  incomeStatementHistory?: { incomeStatementHistory?: { totalRevenue?: number | null }[] }
  earningsTrend?: { trend?: { period: string; revenueEstimate?: { avg?: number | null } | null }[] }
}): { baseFCF: number; cagr: number; historicalRevenues: number[] } {
  const cfStmts = financials.cashflowStatementHistory?.cashflowStatements ?? []
  const incomeStmts = financials.incomeStatementHistory?.incomeStatementHistory ?? []

  // FCF = Operating CF - Capex (capex is usually negative in Yahoo)
  const fcfs: number[] = cfStmts.slice(0, 4).map((s) => {
    const opCF = s.totalCashFromOperatingActivities ?? 0
    const capex = Math.abs(s.capitalExpenditures ?? 0)
    return (opCF - capex) / 1e6 // convert to millions
  }).filter((f) => f !== 0)

  const baseFCF = fcfs[0] ?? 100 // most recent FCF in millions

  // Revenue history for CAGR
  const revenues = incomeStmts.slice(0, 5).map((s) => (s.totalRevenue ?? 0) / 1e6).filter((r) => r > 0)

  // CAGR from analyst estimates if available, else historical
  const trends = financials.earningsTrend?.trend ?? []
  const analystRevEstimates = trends
    .filter((t) => t.period.startsWith('+') && t.revenueEstimate?.avg)
    .map((t) => (t.revenueEstimate!.avg ?? 0) / 1e6)
    .filter((r) => r > 0)

  let cagr = 0.07 // default
  if (revenues.length >= 2) {
    const n = revenues.length - 1
    cagr = Math.pow(revenues[0] / revenues[n], 1 / n) - 1
    cagr = Math.min(Math.max(cagr, -0.10), 0.30) // cap at ±30%
  }

  // If analyst estimates exist, blend with historical
  if (analystRevEstimates.length >= 1 && revenues.length >= 1) {
    const analystGrowth = analystRevEstimates[0] / revenues[0] - 1
    cagr = (cagr + analystGrowth) / 2
    cagr = Math.min(Math.max(cagr, -0.10), 0.35)
  }

  return { baseFCF, cagr: Math.round(cagr * 1000) / 1000, historicalRevenues: revenues }
}
