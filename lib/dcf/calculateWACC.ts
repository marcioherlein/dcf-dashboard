export interface WACCInputs {
  rfRate: number        // 10Y Treasury yield, e.g. 0.0429
  beta: number          // levered beta from regression
  erp: number           // equity risk premium (Damodaran), e.g. 0.046
  costOfDebt: number    // interest expense / avg gross debt, e.g. 0.0445
  taxRate: number       // effective tax rate, e.g. 0.21
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractWACCInputs(financials: any, rfRate: number, betaFromRegression: number): WACCInputs {
  const fd = financials.financialData ?? {}
  const ks = financials.defaultKeyStatistics ?? {}
  const sd = financials.summaryDetail ?? {}
  const inc0 = financials.incomeStatementHistory?.incomeStatementHistory?.[0] ?? {}
  const bs0 = financials.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {}

  // Detect financial sector — Yahoo's totalDebt for banks includes deposit liabilities
  // which are a product/service, not financial leverage. Use longTermDebt only.
  const sector = ((financials.summaryProfile?.sector ?? '') as string).toLowerCase()
  const industry = ((financials.summaryProfile?.industry ?? '') as string).toLowerCase()
  const isFinancialSector = /bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/i.test(sector + ' ' + industry)

  const marketCap: number = sd.marketCap ?? ks.enterpriseValue ?? 0

  let totalDebt: number
  if (isFinancialSector) {
    // For banks/insurers: use only issued long-term debt (bonds, notes).
    // totalDebt from financialData can include deposit liabilities or off-balance-sheet
    // items that inflate D/E to 3-5x, collapsing WACC to ~4% and exploding DCF value.
    totalDebt = (bs0.longTermDebt ?? bs0.longTermDebtNoncurrent ?? 0) as number
    // Absolute safety cap: D/E ≤ 1.5 for financial companies (pure financial debt only)
    if (marketCap > 0 && totalDebt / marketCap > 1.5) {
      totalDebt = marketCap * 1.5
    }
  } else {
    totalDebt = (fd.totalDebt ?? 0) as number
  }

  const debtToEquity = marketCap > 0 ? totalDebt / marketCap : 0.30

  // Beta: regression first, then Yahoo's published beta
  const beta = betaFromRegression > 0 ? betaFromRegression : (ks.beta ?? 1.0)

  // Cost of debt: try income statement, else RF + 1.5% credit spread (investment grade default)
  const interestExpense = Math.abs(inc0.interestExpense ?? 0)
  const costOfDebt = (interestExpense > 0 && totalDebt > 0)
    ? Math.min(interestExpense / totalDebt, 0.15)  // cap at 15%
    : rfRate + 0.015

  // Tax rate: income stmt if available, else 21% US statutory
  const incomeTax: number = inc0.incomeTaxExpense ?? 0
  const preTaxIncome: number = inc0.incomeBeforeTax ?? 0
  const taxRate = (incomeTax > 0 && preTaxIncome > 0)
    ? Math.min(Math.max(incomeTax / preTaxIncome, 0.05), 0.40)
    : 0.21

  return {
    rfRate,
    beta,
    erp: 0.046,   // Damodaran ERP — update annually
    costOfDebt,
    taxRate,
    debtToEquity,
  }
}
