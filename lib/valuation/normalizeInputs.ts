/**
 * normalizeInputs.ts
 *
 * Maps the `/api/financials` response to a fully-typed `ModellingInput`.
 * Rule: never use `?? 0` — null means "data absent" and is preserved as null.
 * Callers decide whether absence is acceptable for their computation.
 *
 * If `statementsData` (from /api/statements) is provided, its TTM/annual values
 * take precedence over FMP-sourced fields for key metrics.
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
  // New modelling fields
  dna: number | null           // D&A from cash flow statement (positive, $M)
  taxRate: number | null       // effective tax rate for this year (e.g. 0.19)
  fiscalDate: string | null    // "2025-06-30" or null
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

// Shape of /api/statements response (loose — fields are dynamic)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

interface StatementsDataLike {
  annual:    { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  quarterly: { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  ttm:       { incomeStatement: AnyRow | null; balanceSheet: AnyRow | null; cashFlow: AnyRow | null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeModellingInputs(ticker: string, apiData: any, statementsData?: StatementsDataLike | null): ModellingInput {
  const wacc = apiData?.wacc ?? {}
  const fv = apiData?.fairValue ?? {}
  const cagrAnalysis = apiData?.cagrAnalysis ?? {}
  const scores = apiData?.scores ?? {}
  const vm = apiData?.valuationMethods ?? {}
  const fs = apiData?.financialStatements ?? {}

  // Build rows: prefer statements data if available, fall back to financialStatements
  let rows: ModellingRow[]
  if (statementsData?.annual?.incomeStatement?.length) {
    rows = buildRowsFromStatements(statementsData.annual, statementsData.ttm)
  } else {
    rows = buildRows(fs)
  }

  // Derive CAGR: prefer 3Y historical from statements, then FMP blended
  let cagr = nullable(apiData?.cagr) ?? cagrAnalysis.blended ?? 0.05
  if ((statementsData?.annual?.incomeStatement?.length ?? 0) >= 3) {
    const stmtCagr = deriveCAGRFromStatements(statementsData!.annual.incomeStatement)
    if (stmtCagr !== null) cagr = stmtCagr
  }

  // Append projected rows when none exist (e.g., built from statements which only has historical)
  if (!rows.some(r => r.isProjected)) {
    const nYears = apiData?.growthModel === 'three-stage' ? 7 : 5
    rows = [...rows, ...buildProjectedRows(rows, cagr, nYears)]
  }

  // Base FCF: prefer TTM FCF from statements (raw dollars → millions)
  let baseFCF = nullable(apiData?.baseFCF)
  const ttmFCF = statementsData?.ttm?.cashFlow?.freeCashFlow
  if (typeof ttmFCF === 'number' && isFinite(ttmFCF) && ttmFCF !== 0) {
    baseFCF = ttmFCF / 1e6
  }

  // Balance sheet overrides from TTM statements
  let cashM = nullable(fv.cash)
  let debtM = nullable(fv.debt)
  let sharesOutstanding = nullable(fv.sharesOutstanding)
  const ttmBS = statementsData?.ttm?.balanceSheet
  if (ttmBS) {
    const stmtCash = ttmBS.cashCashEquivalentsAndShortTermInvestments ?? ttmBS.cash
    if (typeof stmtCash === 'number' && isFinite(stmtCash)) cashM = stmtCash / 1e6
    const stmtDebt = ttmBS.totalDebt ?? ttmBS.longTermDebt
    if (typeof stmtDebt === 'number' && isFinite(stmtDebt)) debtM = stmtDebt / 1e6
    const stmtShares = ttmBS.commonStockSharesOutstanding ?? ttmBS.sharesOutstanding
    if (typeof stmtShares === 'number' && isFinite(stmtShares) && stmtShares > 0) sharesOutstanding = stmtShares
  }

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
    cagr,
    terminalG: nullable(apiData?.terminalG) ?? 0.02,
    growthModel: apiData?.growthModel ?? 'two-stage',
    cashM,
    debtM,
    sharesOutstanding,
    currentPrice: apiData?.quote?.price ?? 0,
    baseFCF,
    rows,
    altmanZone: nullable(scores.altman?.zone),
    beneishFlag: nullable(scores.beneish?.flag),
    isFinancialSector,
  }
}

// ── Generate projected rows from historical medians ───────────────────────────

function computeMedian(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null && isFinite(v))
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function buildProjectedRows(historicalRows: ModellingRow[], cagr: number, nYears: number): ModellingRow[] {
  const annualRows = historicalRows.filter(r => r.year !== 'TTM' && !r.isProjected)
  const recent = annualRows.slice(-3)
  if (recent.length === 0) return []

  const medianEbitMargin = computeMedian(recent.map(r =>
    r.ebit != null && r.revenue != null && r.revenue > 0 ? r.ebit / r.revenue : null))

  // D&A: prefer direct field; fall back to ebitda − ebit (both are equally valid)
  const medianDnaPct = computeMedian(recent.map(r => {
    if (r.dna != null && r.revenue != null && r.revenue > 0) return r.dna / r.revenue
    if (r.ebitda != null && r.ebit != null && r.revenue != null && r.revenue > 0)
      return Math.max(0, r.ebitda - r.ebit) / r.revenue
    return null
  }))

  // EBITDA margin: separate median so we can set ebitda even when dna is unavailable
  const medianEbitdaMargin = computeMedian(recent.map(r =>
    r.ebitda != null && r.revenue != null && r.revenue > 0 ? r.ebitda / r.revenue : null))

  // CapEx: default to 0 when historical data is absent (user can edit; 0 = conservative/asset-light)
  const medianCapexPct = computeMedian(recent.map(r =>
    r.capex != null && r.revenue != null && r.revenue > 0 ? Math.abs(r.capex) / r.revenue : null)) ?? 0

  const medianNetMargin = computeMedian(recent.map(r =>
    r.netIncome != null && r.revenue != null && r.revenue > 0 ? r.netIncome / r.revenue : null))
  const medianTaxRate = computeMedian(recent.map(r => r.taxRate ?? null))

  const ttmRow = historicalRows.find(r => r.year === 'TTM')
  const lastAnnualRow = annualRows[annualRows.length - 1]
  const baseRevenue = ttmRow?.revenue ?? lastAnnualRow?.revenue ?? null
  if (baseRevenue == null || baseRevenue <= 0) return []

  const lastAnnualYear = parseInt(lastAnnualRow?.year ?? '', 10)
  const startYear = isNaN(lastAnnualYear) ? new Date().getFullYear() : lastAnnualYear + 1

  const rows: ModellingRow[] = []
  for (let i = 0; i < nYears; i++) {
    const revenue = baseRevenue * Math.pow(1 + cagr, i + 1)
    const ebit = medianEbitMargin != null ? revenue * medianEbitMargin : null
    const dna = medianDnaPct != null ? revenue * medianDnaPct : null
    // ebitda: prefer ebit+dna; fall back to EBITDA margin so UFCF engine can derive D&A
    const ebitda = (ebit != null && dna != null)
      ? ebit + dna
      : (medianEbitdaMargin != null ? revenue * medianEbitdaMargin : null)
    rows.push({
      year: String(startYear + i) + 'E',
      isProjected: true,
      revenue,
      ebit,
      ebitda,
      netIncome: medianNetMargin != null ? revenue * medianNetMargin : null,
      eps: null,
      capex: -(revenue * medianCapexPct),
      operatingCF: null,
      freeCashFlow: null,
      dividendsPaid: null,
      financingCF: null,
      cash: null,
      totalCurrentAssets: null,
      totalCurrentLiabilities: null,
      longTermDebt: null,
      totalEquity: null,
      dna,
      taxRate: medianTaxRate,
      fiscalDate: null,
    })
  }
  return rows
}

// ── Build rows from /api/statements annual data ───────────────────────────────
// yahoo-finance2 fundamentalsTimeSeries returns raw dollars; ModellingRow expects millions.

function toM(v: unknown): number | null {
  if (typeof v !== 'number' || !isFinite(v)) return null
  return v / 1e6
}

function buildRowsFromStatements(
  annual: { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] },
  ttm: { incomeStatement: AnyRow | null; balanceSheet: AnyRow | null; cashFlow: AnyRow | null },
): ModellingRow[] {
  // Map annual rows by endDate year
  const byYear = new Map<string, Partial<ModellingRow>>()

  for (const row of annual.incomeStatement ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (!year || year.length !== 4) continue
    byYear.set(year, {
      year,
      isProjected: false,
      revenue:    toM(row.totalRevenue),
      ebit:       toM(row.operatingIncome ?? row.EBIT),
      ebitda:     toM(row.EBITDA),
      netIncome:  toM(row.netIncome),
      eps:        nullable(row.dilutedEPS),         // per-share — no scaling
      fiscalDate: row.endDate ?? null,
      taxRate:    nullable(row.taxRateForCalcs),    // ratio — no scaling
    })
  }

  for (const row of annual.cashFlow ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (!year || year.length !== 4) continue
    const existing = byYear.get(year) ?? { year, isProjected: false }
    byYear.set(year, {
      ...existing,
      capex:        toM(row.capitalExpenditure),
      operatingCF:  toM(row.operatingCashFlow),
      freeCashFlow: toM(row.freeCashFlow),
      dna:          toM(row.depreciationAndAmortization ?? row.reconciledDepreciation),
      dividendsPaid: toM(row.cashDividendsPaid),
      financingCF:  toM(row.financingCashFlow),
      fiscalDate:   (existing.fiscalDate ?? row.endDate) ?? null,
    })
  }

  for (const row of annual.balanceSheet ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (!year || year.length !== 4) continue
    const existing = byYear.get(year) ?? { year, isProjected: false }
    byYear.set(year, {
      ...existing,
      cash:                    toM(row.cashCashEquivalentsAndShortTermInvestments ?? row.cash),
      totalCurrentAssets:      toM(row.currentAssets),
      totalCurrentLiabilities: toM(row.currentLiabilities),
      longTermDebt:            toM(row.longTermDebt),
      totalEquity:             toM(row.stockholdersEquity ?? row.totalStockholdersEquity),
    })
  }

  // Add TTM row
  if (ttm.incomeStatement || ttm.cashFlow || ttm.balanceSheet) {
    const is = ttm.incomeStatement ?? {}
    const cf = ttm.cashFlow ?? {}
    const bs = ttm.balanceSheet ?? {}
    byYear.set('TTM', {
      year: 'TTM',
      isProjected: false,
      revenue:    toM(is.totalRevenue),
      ebit:       toM(is.operatingIncome ?? is.EBIT),
      ebitda:     toM(is.EBITDA),
      netIncome:  toM(is.netIncome),
      eps:        nullable(is.dilutedEPS),
      capex:        toM(cf.capitalExpenditure),
      operatingCF:  toM(cf.operatingCashFlow),
      freeCashFlow: toM(cf.freeCashFlow),
      dna:          toM(cf.depreciationAndAmortization ?? cf.reconciledDepreciation),
      dividendsPaid: toM(cf.cashDividendsPaid),
      financingCF:  toM(cf.financingCashFlow),
      cash:                    toM(bs.cashCashEquivalentsAndShortTermInvestments ?? bs.cash),
      totalCurrentAssets:      toM(bs.currentAssets),
      totalCurrentLiabilities: toM(bs.currentLiabilities),
      longTermDebt:            toM(bs.longTermDebt),
      totalEquity:             toM(bs.stockholdersEquity ?? bs.totalStockholdersEquity),
      fiscalDate: 'TTM',
      taxRate: nullable(is.taxRateForCalcs),
    })
  }

  return Array.from(byYear.values())
    .sort((a, b) => {
      if (a.year === 'TTM') return 1
      if (b.year === 'TTM') return -1
      return (a.year ?? '').localeCompare(b.year ?? '')
    })
    .map(r => ({
      year:                    r.year ?? '',
      isProjected:             r.isProjected ?? false,
      revenue:                 r.revenue ?? null,
      ebit:                    r.ebit ?? null,
      ebitda:                  r.ebitda ?? null,
      netIncome:               r.netIncome ?? null,
      eps:                     r.eps ?? null,
      capex:                   r.capex ?? null,
      operatingCF:             r.operatingCF ?? null,
      freeCashFlow:            r.freeCashFlow ?? null,
      dividendsPaid:           r.dividendsPaid ?? null,
      financingCF:             r.financingCF ?? null,
      cash:                    r.cash ?? null,
      totalCurrentAssets:      r.totalCurrentAssets ?? null,
      totalCurrentLiabilities: r.totalCurrentLiabilities ?? null,
      longTermDebt:            r.longTermDebt ?? null,
      totalEquity:             r.totalEquity ?? null,
      dna:                     r.dna ?? null,
      taxRate:                 r.taxRate ?? null,
      fiscalDate:              r.fiscalDate ?? null,
    }))
}

// ── Derive 3Y CAGR from annual statement revenue rows ─────────────────────────

function deriveCAGRFromStatements(annualIS: AnyRow[]): number | null {
  const revenues = annualIS
    .map(r => ({ year: String(r.endDate ?? '').slice(0, 4), rev: r.totalRevenue as number | null }))
    .filter(r => r.year.length === 4 && typeof r.rev === 'number' && r.rev > 0)
    .sort((a, b) => a.year.localeCompare(b.year))

  if (revenues.length < 2) return null
  const n = Math.min(revenues.length - 1, 3) // use up to 3 years
  const oldest = revenues[revenues.length - 1 - n]
  const newest = revenues[revenues.length - 1]
  if (oldest.rev == null || newest.rev == null || oldest.rev <= 0) return null
  const cagr = Math.pow(newest.rev / oldest.rev, 1 / n) - 1
  return Math.max(-0.20, Math.min(0.80, cagr))
}

// ── Build rows from old /api/financials financialStatements ───────────────────

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
      taxRate: nullable(row.taxRate),
      fiscalDate: row.fiscalDate ?? null,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of cash as any[]) {
    const key = String(row.year)
    const existing = byYear.get(key) ?? { year: key, isProjected: row.isProjected ?? false, fiscalDate: null as string | null }
    byYear.set(key, {
      ...existing,
      capex: nullable(row.capex),
      operatingCF: nullable(row.operatingCF),
      freeCashFlow: nullable(row.freeCashFlow),
      dividendsPaid: nullable(row.dividendsPaid),
      financingCF: nullable(row.financingCF),
      dna: nullable(row.dna),
      // fiscalDate from income statement takes precedence if already set
      fiscalDate: existing.fiscalDate ?? row.fiscalDate ?? null,
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
    dna: r.dna ?? null,
    taxRate: r.taxRate ?? null,
    fiscalDate: r.fiscalDate ?? null,
  }))
}
