import { VALUATION_CONFIG } from '@/config/valuation.config'

export interface WACCInputs {
  rfRate: number        // 10Y Treasury yield, e.g. 0.0429
  beta: number          // levered beta from regression
  erp: number           // equity risk premium (Damodaran), e.g. 0.046
  crp: number           // country risk premium (Damodaran), e.g. 0.034 for Brazil
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
  const { rfRate, beta, erp, crp, costOfDebt, taxRate, debtToEquity } = inputs

  // Damodaran additive CRP: Ke = Rf + β×ERP + CRP  (not β×(ERP+CRP))
  // CRP is added independently — it's a country-level supplement, not proportional to beta.
  // For US stocks (crp=0) the formula is identical to standard CAPM.
  const costOfEquity = rfRate + beta * erp + crp
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate)

  // Guard: clamp D/E ≥ 0. Companies with negative book equity (MCD, HD) can produce
  // data-layer anomalies where totalDebt comes back negative from Yahoo Finance.
  // A negative D/E inverts the weight sign and collapses WACC to a nonsense value.
  const safeDE = Math.max(0, debtToEquity)
  const debtRatio = safeDE / (1 + safeDE)
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
export function extractWACCInputs(financials: any, rfRate: number, betaFromRegression: number, fxRate = 1, crp = 0): WACCInputs {
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

  // Use market cap (equity value) for WACC weights — never enterpriseValue, which includes
  // net debt and would overstate the equity weight, understating leverage in WACC.
  // Fall back to price × shares if marketCap is missing rather than using EV.
  const quotedPrice: number = (financials.price ?? financials.regularMarketPrice ?? 0) as number
  const sharesObj = financials.defaultKeyStatistics?.sharesOutstanding
  const sharesForMcap: number = typeof sharesObj === 'number' ? sharesObj : 0
  const marketCap: number = (sd.marketCap as number | undefined)
    ?? (quotedPrice > 0 && sharesForMcap > 0 ? quotedPrice * sharesForMcap : 0)

  // All debt figures come from Yahoo's financial statements in the reporting currency
  // (e.g. ARS for YPF, BRL for Petrobras), but marketCap is always in the quote currency
  // (e.g. USD for NYSE-listed ADRs). Apply fxRate to convert debt → quote currency before
  // computing D/E, otherwise D/E is inflated by the FX ratio (≈870x for ARS stocks).
  let totalDebt: number
  if (isFinancialSector) {
    // For banks/insurers: use only issued long-term debt (bonds, notes).
    // totalDebt from financialData can include deposit liabilities or off-balance-sheet
    // items that inflate D/E to 3-5x, collapsing WACC to ~4% and exploding DCF value.
    totalDebt = ((bs0.longTermDebt ?? bs0.longTermDebtNoncurrent ?? 0) as number) * fxRate
    // Absolute safety cap: D/E ≤ 1.5 for financial companies (pure financial debt only)
    if (marketCap > 0 && totalDebt / marketCap > 1.5) {
      totalDebt = marketCap * 1.5
    }
  } else {
    // Clamp to ≥ 0: Yahoo can return negative totalDebt for negative-book-equity
    // companies (MCD, HD) due to netting or data misclassification.
    totalDebt = Math.max(0, ((fd.totalDebt ?? 0) as number) * fxRate)
  }

  const debtToEquity = marketCap > 0 ? totalDebt / marketCap : 0.30

  // Beta: regression first, then Yahoo's published beta.
  // Apply a floor for emerging-market stocks: ADR price correlation vs S&P500 is weak
  // for country-specific businesses — Damodaran recommends using ≥ 0.75 for such stocks.
  const rawBeta = betaFromRegression > 0 ? betaFromRegression : (ks.beta ?? 1.0)
  const betaFloor = crp >= 0.05 ? 0.80 : (crp >= 0.02 ? 0.75 : 0.50)
  const beta = Math.max(rawBeta, betaFloor)

  // Cost of debt: try income statement, else RF + country risk + 1.5% credit spread.
  // The crp term prevents the fallback from being a pure US investment-grade floor
  // for emerging-market companies (e.g. Argentina CRP ~15.4%).
  // interestExpense and rawDebtForRate are both in reporting currency → rate is currency-independent
  const interestExpense = Math.abs(inc0.interestExpense ?? 0)
  const rawDebtForRate = isFinancialSector
    ? (bs0.longTermDebt ?? bs0.longTermDebtNoncurrent ?? 0) as number
    : (fd.totalDebt ?? 0) as number
  const costOfDebt = (interestExpense > 0 && rawDebtForRate > 0)
    ? Math.min(interestExpense / rawDebtForRate, 0.15)  // cap at 15%
    : rfRate + crp + 0.015

  // Tax rate: 3-year median from income statement history (single year is volatile)
  const incHistory: { incomeTaxExpense?: number; incomeBeforeTax?: number }[] =
    financials.incomeStatementHistory?.incomeStatementHistory ?? []
  const taxRates = incHistory.slice(0, 3).map(r => {
    const tax = r.incomeTaxExpense ?? 0
    const pre = r.incomeBeforeTax ?? 0
    if (tax <= 0 || pre <= 0) return null
    return tax / pre
  }).filter((v): v is number => v != null && v > 0.05 && v < 0.60)
  const taxRate = taxRates.length > 0
    ? (taxRates.sort((a, b) => a - b)[Math.floor(taxRates.length / 2)])
    : 0.21

  return {
    rfRate,
    beta,
    erp: VALUATION_CONFIG.erp,   // Damodaran ERP — sourced from config/valuation.config.ts
    crp,
    costOfDebt,
    taxRate,
    debtToEquity,
  }
}
