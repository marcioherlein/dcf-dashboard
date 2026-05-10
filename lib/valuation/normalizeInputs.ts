/**
 * normalizeInputs.ts
 *
 * Maps the `/api/financials` response to a fully-typed `ModellingInput`.
 * Rule: never use `?? 0` — null means "data absent" and is preserved as null.
 * Callers decide whether absence is acceptable for their computation.
 */

import { nullable } from './valuationGuards'

export interface ModellingRow {
  year: string
  isProjected: boolean
  revenue: number | null
  ebit: number | null
  ebitda: number | null
  netIncome: number | null
  eps: number | null
  capex: number | null         // stored as-is (negative convention from API)
  operatingCF: number | null
  freeCashFlow: number | null
  dividendsPaid: number | null
  financingCF: number | null
  // Balance sheet
  cash: number | null
  totalCurrentAssets: number | null
  totalCurrentLiabilities: number | null
  longTermDebt: number | null
  totalEquity: number | null
}

export interface ModellingInput {
  ticker: string
  companyName: string
  companyType: 'standard' | 'growth' | 'financial' | 'dividend' | 'startup'
  currency: string
  financialCurrencyNote: string | null
  // WACC inputs
  wacc: number
  costOfEquity: number
  afterTaxCostOfDebt: number
  taxRate: number
  rfRate: number
  beta: number
  erp: number
  // Growth
  cagr: number
  terminalG: number
  growthModel: 'two-stage' | 'three-stage'
  // Balance sheet items for equity bridge
  cashM: number | null          // net cash (adjusted)
  debtM: number | null
  sharesOutstanding: number | null
  currentPrice: number
  // FCF bridge
  baseFCF: number | null
  // Financial statements (rows)
  rows: ModellingRow[]
  // Context for warnings
  altmanZone: string | null
  beneishFlag: string | null
  isFinancialSector: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeModellingInputs(ticker: string, apiData: any): ModellingInput {
  const wacc = apiData?.wacc ?? {}
  const fv = apiData?.fairValue ?? {}
  const cagrAnalysis = apiData?.cagrAnalysis ?? {}
  const scores = apiData?.scores ?? {}
  const vm = apiData?.valuationMethods ?? {}
  const fs = apiData?.financialStatements ?? {}

  const rows: ModellingRow[] = buildRows(fs)

  const companyType: ModellingInput['companyType'] = vm.companyType ?? 'standard'
  const isFinancialSector = companyType === 'financial'

  return {
    ticker,
    companyName: apiData?.companyName ?? ticker,
    companyType,
    currency: apiData?.quote?.currency ?? 'USD',
    financialCurrencyNote: apiData?.financialCurrencyNote ?? null,
    wacc: wacc.wacc ?? 0.10,
    costOfEquity: wacc.costOfEquity ?? 0.12,
    afterTaxCostOfDebt: wacc.afterTaxCostOfDebt ?? 0.04,
    taxRate: wacc.inputs?.taxRate ?? 0.21,
    rfRate: wacc.inputs?.rfRate ?? 0.045,
    beta: wacc.inputs?.beta ?? 1.0,
    erp: wacc.inputs?.erp ?? 0.055,
    cagr: nullable(apiData?.cagr) ?? cagrAnalysis.blended ?? 0.05,
    terminalG: nullable(apiData?.terminalG) ?? 0.02,
    growthModel: apiData?.growthModel ?? 'two-stage',
    cashM: nullable(fv.cash),
    debtM: nullable(fv.debt),
    sharesOutstanding: nullable(fv.sharesOutstanding),
    currentPrice: apiData?.quote?.price ?? 0,
    baseFCF: nullable(apiData?.baseFCF),
    rows,
    altmanZone: nullable(scores.altman?.zone),
    beneishFlag: nullable(scores.beneish?.flag),
    isFinancialSector,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRows(fs: any): ModellingRow[] {
  const income: unknown[] = fs.incomeStatement ?? []
  const cash: unknown[] = fs.cashFlow ?? []
  const balance: unknown[] = fs.balanceSheet ?? []

  // Merge by year
  const byYear = new Map<string, Partial<ModellingRow>>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of income as any[]) {
    const key = String(row.year)
    byYear.set(key, {
      year: key,
      isProjected: row.isProjected ?? false,
      revenue: nullable(row.revenue),
      ebit: nullable(row.operatingIncome),
      ebitda: nullable(row.ebitda),
      netIncome: nullable(row.netIncome),
      eps: nullable(row.eps),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of cash as any[]) {
    const key = String(row.year)
    const existing = byYear.get(key) ?? { year: key, isProjected: row.isProjected ?? false }
    byYear.set(key, {
      ...existing,
      capex: nullable(row.capex),
      operatingCF: nullable(row.operatingCF),
      freeCashFlow: nullable(row.freeCashFlow),
      dividendsPaid: nullable(row.dividendsPaid),
      financingCF: nullable(row.financingCF),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of balance as any[]) {
    const key = String(row.year)
    const existing = byYear.get(key) ?? { year: key, isProjected: row.isProjected ?? false }
    byYear.set(key, {
      ...existing,
      cash: nullable(row.cash),
      totalCurrentAssets: nullable(row.totalCurrentAssets),
      totalCurrentLiabilities: nullable(row.totalCurrentLiabilities),
      longTermDebt: nullable(row.longTermDebt),
      totalEquity: nullable(row.totalEquity),
    })
  }

  return Array.from(byYear.values()).map(r => ({
    year: r.year ?? '',
    isProjected: r.isProjected ?? false,
    revenue: r.revenue ?? null,
    ebit: r.ebit ?? null,
    ebitda: r.ebitda ?? null,
    netIncome: r.netIncome ?? null,
    eps: r.eps ?? null,
    capex: r.capex ?? null,
    operatingCF: r.operatingCF ?? null,
    freeCashFlow: r.freeCashFlow ?? null,
    dividendsPaid: r.dividendsPaid ?? null,
    financingCF: r.financingCF ?? null,
    cash: r.cash ?? null,
    totalCurrentAssets: r.totalCurrentAssets ?? null,
    totalCurrentLiabilities: r.totalCurrentLiabilities ?? null,
    longTermDebt: r.longTermDebt ?? null,
    totalEquity: r.totalEquity ?? null,
  }))
}
