export interface WACCInputs {
  rfRate: number        // 10Y Treasury yield, e.g. 0.0429
  beta: number          // levered beta from regression
  erp: number           // equity risk premium (Damodaran), e.g. 0.046
  costOfDebt: number    // interest expense / avg gross debt, e.g. 0.0445
  taxRate: number       // effective tax rate (3Y avg), e.g. 0.21
  debtToEquity: number  // total debt / market cap, e.g. 0.46
}

export interface WACCResult {
  costOfEquity: number
  afterTaxCostOfDebt: number
  weightEquity: number
  weightDebt: number
  wacc: number
  inputs: WACCInputs
}

export function calculateWACC(inputs: WACCInputs): WACCResult {
  const { rfRate, beta, erp, costOfDebt, taxRate, debtToEquity } = inputs

  const costOfEquity = rfRate + beta * erp
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate)

  // D/E → weights
  const debtRatio = debtToEquity / (1 + debtToEquity)
  const equityRatio = 1 - debtRatio

  const wacc = equityRatio * costOfEquity + debtRatio * afterTaxCostOfDebt

  return {
    costOfEquity: Math.round(costOfEquity * 10000) / 10000,
    afterTaxCostOfDebt: Math.round(afterTaxCostOfDebt * 10000) / 10000,
    weightEquity: Math.round(equityRatio * 10000) / 10000,
    weightDebt: Math.round(debtRatio * 10000) / 10000,
    wacc: Math.round(wacc * 10000) / 10000,
    inputs,
  }
}

export function extractWACCInputs(financials: {
  incomeStatementHistory?: { incomeStatementHistory?: {interestExpense?: number | null, incomeTaxExpense?: number | null, incomeBeforeTax?: number | null}[] }
  balanceSheetHistory?: { balanceSheetStatements?: { totalDebt?: number | null, longTermDebt?: number | null }[] }
  summaryDetail?: { marketCap?: number | null }
  defaultKeyStatistics?: { beta?: number | null }
}, rfRate: number, betaFromRegression: number): WACCInputs {
  const incomeStmts = financials.incomeStatementHistory?.incomeStatementHistory ?? []
  const balanceSheets = financials.balanceSheetHistory?.balanceSheetStatements ?? []

  // Cost of debt: avg interest expense / avg gross debt over available years
  let totalInterest = 0, totalDebt = 0, debtCount = 0
  for (const stmt of incomeStmts.slice(0, 3)) {
    totalInterest += Math.abs(stmt.interestExpense ?? 0)
  }
  for (const bs of balanceSheets.slice(0, 3)) {
    const d = bs.totalDebt ?? bs.longTermDebt ?? 0
    if (d > 0) { totalDebt += d; debtCount++ }
  }
  const avgDebt = debtCount > 0 ? totalDebt / debtCount : 0
  const avgInterest = incomeStmts.length > 0 ? totalInterest / Math.min(incomeStmts.length, 3) : 0
  const costOfDebt = avgDebt > 0 ? avgInterest / avgDebt : 0.045

  // Tax rate: 3Y average effective
  let totalTax = 0, totalPreTax = 0
  for (const stmt of incomeStmts.slice(0, 3)) {
    totalTax += stmt.incomeTaxExpense ?? 0
    totalPreTax += stmt.incomeBeforeTax ?? 0
  }
  const taxRate = totalPreTax > 0 ? Math.min(Math.max(totalTax / totalPreTax, 0), 0.40) : 0.21

  // D/E ratio
  const marketCap = financials.summaryDetail?.marketCap ?? 0
  const latestDebt = balanceSheets[0]?.totalDebt ?? balanceSheets[0]?.longTermDebt ?? 0
  const debtToEquity = marketCap > 0 ? latestDebt / marketCap : 0.30

  // Use regression beta; fall back to Yahoo's published beta
  const beta = betaFromRegression > 0 ? betaFromRegression : (financials.defaultKeyStatistics?.beta ?? 1.0)

  return {
    rfRate,
    beta,
    erp: 0.046, // Damodaran ERP — update annually
    costOfDebt: Math.max(costOfDebt, 0.02),
    taxRate,
    debtToEquity,
  }
}
