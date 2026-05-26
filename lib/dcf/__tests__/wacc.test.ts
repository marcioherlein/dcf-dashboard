/**
 * WACC computation tests
 * Covers: formula correctness, financial sector D/E cap, FX application, edge cases
 */

import { calculateWACC, extractWACCInputs } from '../calculateWACC'

describe('calculateWACC — formula', () => {
  it('computes WACC correctly for an all-equity company', () => {
    const result = calculateWACC({
      rfRate: 0.04,
      beta: 1.0,
      erp: 0.046,
      crp: 0.0,
      costOfDebt: 0.05,
      taxRate: 0.21,
      debtToEquity: 0,
    })
    expect(result.wacc).toBeCloseTo(0.086, 3)     // Ke = 0.04 + 1.0 × 0.046 = 0.086
    expect(result.weightEquity).toBe(1)
    expect(result.weightDebt).toBe(0)
  })

  it('applies D/E split correctly', () => {
    // D/E = 0.5 → equityRatio = 0.6667, debtRatio = 0.3333
    const result = calculateWACC({
      rfRate: 0.04,
      beta: 1.2,
      erp: 0.046,
      crp: 0.0,
      costOfDebt: 0.06,
      taxRate: 0.21,
      debtToEquity: 0.5,
    })
    const Ke = 0.04 + 1.2 * 0.046          // 0.0952
    const Kd = 0.06 * (1 - 0.21)           // 0.0474
    const E = 1 / (1 + 0.5)               // 0.6667
    const D = 0.5 / (1 + 0.5)             // 0.3333
    const expected = E * Ke + D * Kd
    expect(result.wacc).toBeCloseTo(expected, 3)
  })

  it('includes CRP in cost of equity', () => {
    const withCrp = calculateWACC({
      rfRate: 0.04, beta: 1.0, erp: 0.046, crp: 0.1541,   // ARS
      costOfDebt: 0.05, taxRate: 0.21, debtToEquity: 0,
    })
    const withoutCrp = calculateWACC({
      rfRate: 0.04, beta: 1.0, erp: 0.046, crp: 0.0,
      costOfDebt: 0.05, taxRate: 0.21, debtToEquity: 0,
    })
    // CRP adds to cost of equity → higher WACC
    expect(withCrp.wacc).toBeGreaterThan(withoutCrp.wacc)
    // Ke = 0.04 + 1.0 × (0.046 + 0.1541) = 0.2401
    expect(withCrp.costOfEquity).toBeCloseTo(0.2401, 3)
  })

  it('clamps negative debtToEquity to zero (negative book equity guard)', () => {
    // Companies like MCD/HD have negative book equity; data errors can produce negative D/E.
    // WACC must never invert weights — result should equal an all-equity WACC.
    const withNegativeDE = calculateWACC({
      rfRate: 0.04,
      beta: 0.75,
      erp: 0.046,
      crp: 0.0,
      costOfDebt: 0.035,
      taxRate: 0.21,
      debtToEquity: -0.5,
    })
    const allEquity = calculateWACC({
      rfRate: 0.04,
      beta: 0.75,
      erp: 0.046,
      crp: 0.0,
      costOfDebt: 0.035,
      taxRate: 0.21,
      debtToEquity: 0,
    })
    expect(withNegativeDE.wacc).toBeCloseTo(allEquity.wacc, 4)
    expect(withNegativeDE.weightEquity).toBe(1)
    expect(withNegativeDE.weightDebt).toBe(0)
  })

  it('rounds to 4 decimal places', () => {
    const result = calculateWACC({
      rfRate: 0.04291,
      beta: 1.123456,
      erp: 0.046,
      crp: 0.0,
      costOfDebt: 0.04500,
      taxRate: 0.2100,
      debtToEquity: 0.250,
    })
    const strWacc = result.wacc.toString()
    const decimals = strWacc.includes('.') ? strWacc.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(4)
  })
})

describe('extractWACCInputs — beta fallback', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const minimalFinancials = (overrides: Record<string, any> = {}) => ({
    financialData: { totalDebt: 1_000_000_000, ...(overrides.financialData as object | undefined) },
    defaultKeyStatistics: { beta: 1.5, sharesOutstanding: 100_000_000 },
    summaryDetail: { marketCap: 5_000_000_000 },
    summaryProfile: { sector: 'Technology', industry: 'Software—Application' },
    price: 50,
    incomeStatementHistory: { incomeStatementHistory: [] },
    balanceSheetHistory: { balanceSheetStatements: [] },
    earningsTrend: { trend: [] },
    ...overrides,
  })

  it('uses regression beta when > 0', () => {
    const inputs = extractWACCInputs(minimalFinancials(), 0.04, 1.8, 1, 0)
    expect(inputs.beta).toBe(1.8)
  })

  it('falls back to Yahoo beta when regression is 0', () => {
    const inputs = extractWACCInputs(minimalFinancials(), 0.04, 0, 1, 0)
    expect(inputs.beta).toBe(1.5)
  })

  it('falls back to 1.0 when both regression and Yahoo beta are 0/null', () => {
    const fin = { ...minimalFinancials(), defaultKeyStatistics: { beta: null, sharesOutstanding: 100_000_000 } }
    const inputs = extractWACCInputs(fin as never, 0.04, 0, 1, 0)
    expect(inputs.beta).toBe(1.0)
  })
})

describe('extractWACCInputs — financial sector D/E cap', () => {
  const bankFinancials = (longTermDebtARS: number, marketCapUSD: number) => ({
    financialData: { totalDebt: 50_000_000_000 },
    defaultKeyStatistics: { beta: 0.8, sharesOutstanding: 200_000_000 },
    summaryDetail: { marketCap: marketCapUSD },
    summaryProfile: { sector: 'Financial Services', industry: 'Banks—Diversified' },
    price: 10,
    incomeStatementHistory: {
      incomeStatementHistory: [{
        interestExpense: -200_000_000,
        incomeTaxExpense: 300_000_000,
        incomeBeforeTax: 1_000_000_000,
      }],
    },
    balanceSheetHistory: {
      balanceSheetStatements: [{ longTermDebt: longTermDebtARS }],
    },
    earningsTrend: { trend: [] },
  })

  it('caps financial sector D/E at 1.5', () => {
    // longTermDebt = $10B, marketCap = $5B → raw D/E = 2.0, should be capped at 1.5
    const inputs = extractWACCInputs(bankFinancials(10_000_000_000, 5_000_000_000), 0.04, 1.0, 1.0, 0)
    expect(inputs.debtToEquity).toBeLessThanOrEqual(1.5)
  })

  it('does not cap D/E below 1.5 for financial sector', () => {
    // longTermDebt = $3B, marketCap = $5B → D/E = 0.6 → no cap applied
    const inputs = extractWACCInputs(bankFinancials(3_000_000_000, 5_000_000_000), 0.04, 1.0, 1.0, 0)
    expect(inputs.debtToEquity).toBeCloseTo(0.6, 2)
  })
})

describe('extractWACCInputs — cost of debt', () => {
  const financials = (interest: number, debt: number) => ({
    financialData: { totalDebt: debt },
    defaultKeyStatistics: { beta: 1.0, sharesOutstanding: 100_000_000 },
    summaryDetail: { marketCap: 5_000_000_000 },
    summaryProfile: { sector: 'Technology', industry: 'Software—Application' },
    price: 50,
    incomeStatementHistory: {
      incomeStatementHistory: [{
        interestExpense: -interest,
        incomeTaxExpense: 200_000_000,
        incomeBeforeTax: 1_000_000_000,
      }],
    },
    balanceSheetHistory: { balanceSheetStatements: [] },
    earningsTrend: { trend: [] },
  })

  it('computes cost of debt from income statement', () => {
    // interest = $450M, debt = $5B → kd = 9%
    const inputs = extractWACCInputs(financials(450_000_000, 5_000_000_000), 0.04, 1.0, 1.0, 0)
    expect(inputs.costOfDebt).toBeCloseTo(0.09, 3)
  })

  it('caps cost of debt at 15%', () => {
    // interest = $2B, debt = $5B → raw kd = 40%, should cap at 15%
    const inputs = extractWACCInputs(financials(2_000_000_000, 5_000_000_000), 0.04, 1.0, 1.0, 0)
    expect(inputs.costOfDebt).toBe(0.15)
  })

  it('falls back to rfRate + crp + 1.5% spread when no debt', () => {
    const inputs = extractWACCInputs(financials(0, 0), 0.04, 1.0, 1.0, 0.02)
    // rfRate=0.04 + crp=0.02 + 0.015 = 0.075
    expect(inputs.costOfDebt).toBeCloseTo(0.075, 3)
  })
})

describe('extractWACCInputs — tax rate', () => {
  const financials = (tax: number, preTax: number) => ({
    financialData: { totalDebt: 1_000_000_000 },
    defaultKeyStatistics: { beta: 1.0, sharesOutstanding: 100_000_000 },
    summaryDetail: { marketCap: 5_000_000_000 },
    summaryProfile: { sector: 'Technology', industry: 'Software—Application' },
    price: 50,
    incomeStatementHistory: {
      incomeStatementHistory: [{ interestExpense: 0, incomeTaxExpense: tax, incomeBeforeTax: preTax }],
    },
    balanceSheetHistory: { balanceSheetStatements: [] },
    earningsTrend: { trend: [] },
  })

  it('computes effective tax rate', () => {
    const inputs = extractWACCInputs(financials(210_000_000, 1_000_000_000), 0.04, 1.0, 1.0, 0)
    expect(inputs.taxRate).toBeCloseTo(0.21, 3)
  })

  it('clamps tax rate at 40% ceiling', () => {
    // tax = $600M, preTax = $1B → raw rate = 60%, excluded by filter → fallback to 21%
    const inputs = extractWACCInputs(financials(600_000_000, 1_000_000_000), 0.04, 1.0, 1.0, 0)
    expect(inputs.taxRate).toBe(0.21)
  })

  it('clamps tax rate at 5% floor', () => {
    // tax = $5M, preTax = $1B → raw rate = 0.5%, excluded by ≤0.05 filter → fallback to 21%
    const inputs = extractWACCInputs(financials(5_000_000, 1_000_000_000), 0.04, 1.0, 1.0, 0)
    expect(inputs.taxRate).toBe(0.21)
  })

  it('falls back to 21% when income statement unavailable', () => {
    const inputs = extractWACCInputs(financials(0, 0), 0.04, 1.0, 1.0, 0)
    expect(inputs.taxRate).toBe(0.21)
  })
})

describe('extractWACCInputs — negative book equity guard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcdLike = (totalDebt: number) => ({
    financialData: { totalDebt },
    defaultKeyStatistics: { beta: 0.75, sharesOutstanding: 700_000_000 },
    summaryDetail: { marketCap: 210_000_000_000 },
    summaryProfile: { sector: 'Consumer Cyclical', industry: 'Restaurants' },
    price: 300,
    incomeStatementHistory: { incomeStatementHistory: [] },
    balanceSheetHistory: { balanceSheetStatements: [] },
    earningsTrend: { trend: [] },
  })

  it('clamps negative totalDebt to zero — negative book equity data anomaly', () => {
    // Simulate Yahoo returning negative totalDebt for a negative-book-equity company
    const inputs = extractWACCInputs(mcdLike(-5_000_000_000) as never, 0.04, 0.75, 1.0, 0)
    expect(inputs.debtToEquity).toBe(0)
  })

  it('produces valid WACC when totalDebt is negative', () => {
    const inputs = extractWACCInputs(mcdLike(-5_000_000_000) as never, 0.04, 0.75, 1.0, 0)
    const result = calculateWACC(inputs)
    expect(result.wacc).toBeGreaterThan(0)
    expect(isFinite(result.wacc)).toBe(true)
    expect(result.weightEquity).toBe(1)
    expect(result.weightDebt).toBe(0)
  })
})
