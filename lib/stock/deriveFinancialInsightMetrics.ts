/**
 * Shared financial insight derivation layer.
 *
 * Single source of truth for derived metrics consumed by:
 *   - OverviewSidebar (revenue/net income bars, margin trend)
 *   - ValuationSidebar (growth assumptions validation)
 *   - FinancialsSidebar (margin bars, sparklines)
 *   - FinancialsHub tabs (consistent numbers across Income/Balance/Cash views)
 *
 * Rules:
 *   - null = absent; never coerce to 0 unless verified zero
 *   - Annual rows are the default; TTM row is the latest snapshot
 *   - statementsData (Yahoo Finance) preferred; financialStatements (FMP) is fallback
 *   - Emit dataQualityWarnings for missing or sector-suspect fields
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValuationMethods = any

// ── Input types ───────────────────────────────────────────────────────────────

interface StatementsData {
  annual:    { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  quarterly: { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  ttm:       { incomeStatement: AnyRow | null; balanceSheet: AnyRow | null; cashFlow: AnyRow | null }
}

interface FSIncomeRow {
  year: string
  revenue: number | null
  netIncome: number | null
  ebitda: number | null
  operatingIncome: number | null
  grossProfit?: number | null
  isProjected: boolean
}

interface FSCashFlowRow {
  year: string
  freeCashFlow: number | null
  operatingCF: number | null
  capex?: number | null
  dna?: number | null
  isProjected: boolean
}

interface FSBalanceRow {
  year: string
  totalEquity: number | null
  totalCurrentAssets: number | null
  totalCurrentLiabilities: number | null
  totalAssets?: number | null
  totalDebt?: number | null
  longTermDebt?: number | null
  cash?: number | null
  isProjected: boolean
}

interface FinancialStatements {
  incomeStatement: FSIncomeRow[]
  cashFlow: FSCashFlowRow[]
  balanceSheet?: FSBalanceRow[]
}

interface Quote {
  price: number
  currency: string
  marketCap?: number
}

interface BusinessProfile {
  grossMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface TrendPoint {
  year: string
  value: number | null
  /** true when value was derived from other fields (e.g. EBITDA approximated via EBIT + D&A) */
  isEstimated?: boolean
}

export interface MetricTrend {
  label: string
  unit: 'currency_millions' | 'percent' | 'ratio' | 'multiple'
  points: TrendPoint[]
  statement: 'income' | 'cashflow' | 'balance'
  /** Raw field name — used by FinancialsHub to anchor chart links */
  rowKey?: string
}

export interface LatestMetrics {
  revenue: number | null
  revenueGrowthYoY: number | null
  grossMargin: number | null
  ebitMargin: number | null
  ebitdaMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
  roe: number | null
  roa: number | null
  fcf: number | null
  operatingCF: number | null
  capexIntensity: number | null
  currentRatio: number | null
  netDebt: number | null
  netDebtToEbitda: number | null
  assetTurnover: number | null
  currency: string
  isTTM: boolean
  dataYear: string
}

export interface DataQualityWarning {
  field: string
  severity: 'info' | 'warn'
  message: string
}

export interface DerivedFinancialInsights {
  revenueTrend: MetricTrend
  marginTrend: {
    gross:  MetricTrend
    ebit:   MetricTrend
    ebitda: MetricTrend
    net:    MetricTrend
    fcf:    MetricTrend
  }
  profitabilityTrend: {
    roe: MetricTrend
    roa: MetricTrend
  }
  cashFlowTrend: {
    fcf:         MetricTrend
    operatingCF: MetricTrend
    capex:       MetricTrend
    ebitda:      MetricTrend
  }
  balanceSheetTrend: {
    currentRatio: MetricTrend
    netDebt:      MetricTrend
  }
  assetEfficiencyTrend: {
    assetTurnover: MetricTrend
  }
  latestMetrics: LatestMetrics
  dataQualityWarnings: DataQualityWarning[]
}

// ── Internal enriched row ─────────────────────────────────────────────────────

interface EnrichedRow {
  year: string
  isTTM: boolean
  isProjected: boolean
  revenue:     number | null
  grossProfit: number | null
  ebit:        number | null
  ebitda:      number | null
  netIncome:   number | null
  operatingCF: number | null
  freeCashFlow: number | null
  capex:       number | null
  dna:         number | null
  cash:        number | null
  totalCurrentAssets:      number | null
  totalCurrentLiabilities: number | null
  longTermDebt: number | null
  totalDebt:   number | null
  totalEquity: number | null
  totalAssets: number | null
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function safeDiv(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0 || !isFinite(den)) return null
  const r = num / den
  return isFinite(r) ? r : null
}

function margin(value: number | null, revenue: number | null): number | null {
  return safeDiv(value, revenue)
}

function rowNetDebt(row: EnrichedRow): number | null {
  const debt = row.totalDebt ?? row.longTermDebt
  if (debt == null || row.cash == null) return null
  return debt - row.cash
}

// ── Row builders ──────────────────────────────────────────────────────────────

function finalizeRows(byYear: Map<string, Partial<EnrichedRow>>): EnrichedRow[] {
  return Array.from(byYear.values())
    .sort((a, b) => {
      if (a.year === 'TTM') return 1
      if (b.year === 'TTM') return -1
      return (a.year ?? '').localeCompare(b.year ?? '')
    })
    .map(r => ({
      year:        r.year ?? '',
      isTTM:       r.isTTM ?? false,
      isProjected: r.isProjected ?? false,
      revenue:     r.revenue ?? null,
      grossProfit: r.grossProfit ?? null,
      ebit:        r.ebit ?? null,
      ebitda:      r.ebitda ?? null,
      netIncome:   r.netIncome ?? null,
      operatingCF: r.operatingCF ?? null,
      freeCashFlow: r.freeCashFlow ?? null,
      capex:       r.capex ?? null,
      dna:         r.dna ?? null,
      cash:        r.cash ?? null,
      totalCurrentAssets:      r.totalCurrentAssets ?? null,
      totalCurrentLiabilities: r.totalCurrentLiabilities ?? null,
      longTermDebt: r.longTermDebt ?? null,
      totalDebt:   r.totalDebt ?? null,
      totalEquity: r.totalEquity ?? null,
      totalAssets: r.totalAssets ?? null,
    }))
}

function buildFromStatements(
  annual: StatementsData['annual'],
  ttm: StatementsData['ttm'],
  fxRate: number,
): EnrichedRow[] {
  const toM = (v: unknown): number | null => {
    if (typeof v !== 'number' || !isFinite(v)) return null
    return v / 1e6 * fxRate
  }

  const byYear = new Map<string, Partial<EnrichedRow>>()

  for (const row of annual.incomeStatement ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (year.length !== 4) continue
    byYear.set(year, {
      year, isTTM: false, isProjected: false,
      revenue:     toM(row.totalRevenue ?? row.operatingRevenue),
      grossProfit: toM(row.grossProfit),
      ebit:        toM(row.operatingIncome ?? row.EBIT),
      ebitda:      toM(row.EBITDA),
      netIncome:   toM(row.netIncome),
    })
  }

  for (const row of annual.cashFlow ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (year.length !== 4) continue
    const e = byYear.get(year) ?? { year, isTTM: false, isProjected: false }
    byYear.set(year, {
      ...e,
      operatingCF:  toM(row.operatingCashFlow ?? row.cashFlowFromContinuingOperatingActivities),
      freeCashFlow: toM(row.freeCashFlow),
      capex:        toM(row.capitalExpenditure ?? row.purchaseOfPPE ?? row.capitalExpenditures),
      dna:          toM(row.depreciationAndAmortization ?? row.reconciledDepreciation ?? row.depreciationAmortizationDepletion),
    })
  }

  for (const row of annual.balanceSheet ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (year.length !== 4) continue
    const e = byYear.get(year) ?? { year, isTTM: false, isProjected: false }
    byYear.set(year, {
      ...e,
      cash:                    toM(row.cashCashEquivalentsAndShortTermInvestments ?? row.cashAndShortTermInvestments ?? row.cashAndCashEquivalents ?? row.cash),
      totalCurrentAssets:      toM(row.currentAssets ?? row.totalCurrentAssets),
      totalCurrentLiabilities: toM(row.currentLiabilities ?? row.totalCurrentLiabilities),
      longTermDebt:            toM(row.longTermDebt ?? row.longTermDebtAndCapitalLeaseObligation ?? row.longTermDebtNoncurrent),
      totalDebt:               toM(row.totalDebt),
      totalEquity:             toM(row.stockholdersEquity ?? row.totalStockholdersEquity ?? row.totalEquity ?? row.commonStockEquity),
      totalAssets:             toM(row.totalAssets),
    })
  }

  // TTM row
  if (ttm.incomeStatement || ttm.cashFlow || ttm.balanceSheet) {
    const is = ttm.incomeStatement ?? {}
    const cf = ttm.cashFlow ?? {}
    const bs = ttm.balanceSheet ?? {}
    byYear.set('TTM', {
      year: 'TTM', isTTM: true, isProjected: false,
      revenue:     toM(is.totalRevenue ?? is.operatingRevenue),
      grossProfit: toM(is.grossProfit),
      ebit:        toM(is.operatingIncome ?? is.EBIT),
      ebitda:      toM(is.EBITDA),
      netIncome:   toM(is.netIncome),
      operatingCF:  toM(cf.operatingCashFlow ?? cf.cashFlowFromContinuingOperatingActivities),
      freeCashFlow: toM(cf.freeCashFlow),
      capex:        toM(cf.capitalExpenditure ?? cf.purchaseOfPPE ?? cf.capitalExpenditures),
      dna:          toM(cf.depreciationAndAmortization ?? cf.reconciledDepreciation ?? cf.depreciationAmortizationDepletion),
      cash:                    toM(bs.cashCashEquivalentsAndShortTermInvestments ?? bs.cashAndShortTermInvestments ?? bs.cashAndCashEquivalents ?? bs.cash),
      totalCurrentAssets:      toM(bs.currentAssets ?? bs.totalCurrentAssets),
      totalCurrentLiabilities: toM(bs.currentLiabilities ?? bs.totalCurrentLiabilities),
      longTermDebt:            toM(bs.longTermDebt ?? bs.longTermDebtAndCapitalLeaseObligation ?? bs.longTermDebtNoncurrent),
      totalDebt:               toM(bs.totalDebt),
      totalEquity:             toM(bs.stockholdersEquity ?? bs.totalStockholdersEquity ?? bs.totalEquity ?? bs.commonStockEquity),
      totalAssets:             toM(bs.totalAssets),
    })
  }

  return finalizeRows(byYear)
}

function buildFromFinancialStatements(fs: FinancialStatements): EnrichedRow[] {
  const byYear = new Map<string, Partial<EnrichedRow>>()

  for (const row of fs.incomeStatement ?? []) {
    if (row.isProjected) continue
    const key = String(row.year)
    byYear.set(key, {
      year: key, isTTM: false, isProjected: false,
      revenue:     row.revenue ?? null,
      grossProfit: row.grossProfit ?? null,
      ebit:        row.operatingIncome ?? null,
      ebitda:      row.ebitda ?? null,
      netIncome:   row.netIncome ?? null,
    })
  }

  for (const row of fs.cashFlow ?? []) {
    if (row.isProjected) continue
    const key = String(row.year)
    const e = byYear.get(key) ?? { year: key, isTTM: false, isProjected: false }
    byYear.set(key, {
      ...e,
      operatingCF:  row.operatingCF ?? null,
      freeCashFlow: row.freeCashFlow ?? null,
      capex:        row.capex ?? null,
      dna:          row.dna ?? null,
    })
  }

  for (const row of fs.balanceSheet ?? []) {
    if (row.isProjected) continue
    const key = String(row.year)
    const e = byYear.get(key) ?? { year: key, isTTM: false, isProjected: false }
    byYear.set(key, {
      ...e,
      cash:                    row.cash ?? null,
      totalCurrentAssets:      row.totalCurrentAssets ?? null,
      totalCurrentLiabilities: row.totalCurrentLiabilities ?? null,
      longTermDebt:            row.longTermDebt ?? null,
      totalDebt:               row.totalDebt ?? null,
      totalEquity:             row.totalEquity ?? null,
      totalAssets:             row.totalAssets ?? null,
    })
  }

  return finalizeRows(byYear)
}

// ── Main export ───────────────────────────────────────────────────────────────

export function deriveFinancialInsightMetrics({
  statementsData,
  financialStatements,
  quote,
  businessProfile,
  valuationMethods,
  fxRate = 1,
}: {
  statementsData?: StatementsData | null
  financialStatements?: FinancialStatements | null
  quote: Quote
  businessProfile: BusinessProfile
  valuationMethods?: AnyValuationMethods | null
  fxRate?: number
}): DerivedFinancialInsights {
  const hasStatements = (statementsData?.annual?.incomeStatement?.length ?? 0) > 0
  const rows: EnrichedRow[] = hasStatements
    ? buildFromStatements(
        statementsData!.annual,
        statementsData!.ttm ?? { incomeStatement: null, balanceSheet: null, cashFlow: null },
        fxRate,
      )
    : financialStatements
      ? buildFromFinancialStatements(financialStatements)
      : []

  const isFinancialSector = valuationMethods?.companyType === 'financial'
  const currency = quote.currency ?? 'USD'
  const warnings: DataQualityWarning[] = []

  // Last 5 historical annual rows (no TTM, no projected)
  const annuals = rows.filter(r => !r.isTTM && !r.isProjected).slice(-5)
  const ttmRow  = rows.find(r => r.isTTM) ?? null
  const latestRow = ttmRow ?? annuals.at(-1) ?? null

  // ── Revenue YoY ────────────────────────────────────────────────────────────

  function revenueYoY(): number | null {
    if (ttmRow?.revenue != null) {
      const lastAnnual = annuals.at(-1)
      if (lastAnnual?.revenue != null && lastAnnual.revenue > 0) {
        return (ttmRow.revenue - lastAnnual.revenue) / lastAnnual.revenue
      }
    }
    const last = annuals.at(-1)
    const prev = annuals.at(-2)
    if (last?.revenue == null || prev?.revenue == null || prev.revenue <= 0) return null
    return (last.revenue - prev.revenue) / prev.revenue
  }

  // ── Latest metrics snapshot ────────────────────────────────────────────────

  const latestMetrics: LatestMetrics = (() => {
    if (!latestRow) {
      return {
        revenue: null, revenueGrowthYoY: null,
        grossMargin: businessProfile.grossMargin,
        ebitMargin: null, ebitdaMargin: null,
        netMargin: businessProfile.netMargin,
        fcfMargin: businessProfile.fcfMargin,
        roe: null, roa: null,
        fcf: null, operatingCF: null, capexIntensity: null,
        currentRatio: null, netDebt: null, netDebtToEbitda: null,
        assetTurnover: null,
        currency, isTTM: false, dataYear: '—',
      }
    }

    const rev     = latestRow.revenue
    const grossM  = margin(latestRow.grossProfit, rev) ?? businessProfile.grossMargin
    const ebitM   = margin(latestRow.ebit, rev)
    const ebitdaM = isFinancialSector ? null : margin(latestRow.ebitda, rev)
    const netM    = margin(latestRow.netIncome, rev) ?? businessProfile.netMargin
    const fcfM    = margin(latestRow.freeCashFlow, rev) ?? businessProfile.fcfMargin

    const roe = safeDiv(latestRow.netIncome, latestRow.totalEquity)
    const roa = safeDiv(latestRow.netIncome, latestRow.totalAssets)

    const nd = rowNetDebt(latestRow)
    const ndToEbitda = !isFinancialSector && latestRow.ebitda != null && latestRow.ebitda > 0
      ? safeDiv(nd, latestRow.ebitda) : null

    const capexIntensity = rev != null && rev > 0 && latestRow.capex != null
      ? Math.abs(latestRow.capex) / rev : null

    const currentRatio  = safeDiv(latestRow.totalCurrentAssets, latestRow.totalCurrentLiabilities)
    const assetTurnover = safeDiv(rev, latestRow.totalAssets)

    return {
      revenue: rev,
      revenueGrowthYoY: revenueYoY(),
      grossMargin: grossM,
      ebitMargin: ebitM,
      ebitdaMargin: ebitdaM,
      netMargin: netM,
      fcfMargin: fcfM,
      roe, roa,
      fcf: latestRow.freeCashFlow,
      operatingCF: latestRow.operatingCF,
      capexIntensity,
      currentRatio,
      netDebt: nd,
      netDebtToEbitda: ndToEbitda,
      assetTurnover,
      currency,
      isTTM: latestRow.isTTM,
      dataYear: latestRow.year,
    }
  })()

  // ── Data quality warnings ──────────────────────────────────────────────────

  if (rows.length === 0) {
    warnings.push({ field: 'data', severity: 'warn', message: 'No financial statement data available' })
  }
  if (annuals.every(r => r.grossProfit == null) && businessProfile.grossMargin != null) {
    warnings.push({ field: 'grossMargin', severity: 'info', message: 'Gross profit absent from statements — using profile estimate for latest value' })
  }
  if (annuals.every(r => r.totalAssets == null)) {
    warnings.push({ field: 'roa', severity: 'info', message: 'Total assets unavailable — ROA and asset turnover cannot be computed' })
  }
  if (annuals.every(r => r.freeCashFlow == null)) {
    warnings.push({ field: 'fcf', severity: 'warn', message: 'Free cash flow not available from statements' })
  }
  if (isFinancialSector) {
    warnings.push({ field: 'ebitda', severity: 'info', message: 'Financial sector: EBITDA and net debt metrics are not meaningful' })
  }

  // ── Trend builder ──────────────────────────────────────────────────────────

  function trend(
    label: string,
    unit: MetricTrend['unit'],
    fn: (r: EnrichedRow) => { value: number | null; isEstimated?: boolean },
    statement: MetricTrend['statement'],
    rowKey?: string,
  ): MetricTrend {
    return {
      label, unit, statement, rowKey,
      points: annuals.map(r => ({ year: r.year, ...fn(r) })),
    }
  }

  // ── Build all trends ───────────────────────────────────────────────────────

  const revenueTrend = trend(
    'Revenue', 'currency_millions',
    r => ({ value: r.revenue }),
    'income', 'totalRevenue',
  )

  const marginTrend = {
    gross: trend('Gross Margin', 'percent', r => ({
      value: margin(r.grossProfit, r.revenue),
    }), 'income', 'grossProfit'),

    ebit: trend('EBIT Margin', 'percent', r => ({
      value: margin(r.ebit, r.revenue),
    }), 'income', 'operatingIncome'),

    ebitda: trend('EBITDA Margin', 'percent', r => {
      if (isFinancialSector) return { value: null }
      const direct = margin(r.ebitda, r.revenue)
      if (direct != null) return { value: direct }
      // Approximate from EBIT + D&A when EBITDA field is absent
      if (r.ebit != null && r.dna != null && r.revenue != null && r.revenue > 0) {
        return { value: (r.ebit + r.dna) / r.revenue, isEstimated: true }
      }
      return { value: null }
    }, 'income', 'EBITDA'),

    net: trend('Net Margin', 'percent', r => ({
      value: margin(r.netIncome, r.revenue),
    }), 'income', 'netIncome'),

    fcf: trend('FCF Margin', 'percent', r => ({
      value: margin(r.freeCashFlow, r.revenue),
    }), 'cashflow', 'freeCashFlow'),
  }

  const profitabilityTrend = {
    roe: trend('Return on Equity', 'percent', r => ({
      value: safeDiv(r.netIncome, r.totalEquity),
    }), 'income', 'netIncome'),

    roa: trend('Return on Assets', 'percent', r => ({
      value: safeDiv(r.netIncome, r.totalAssets),
    }), 'income', 'netIncome'),
  }

  const cashFlowTrend = {
    fcf: trend('Free Cash Flow', 'currency_millions', r => ({
      value: r.freeCashFlow,
    }), 'cashflow', 'freeCashFlow'),

    operatingCF: trend('Operating Cash Flow', 'currency_millions', r => ({
      value: r.operatingCF,
    }), 'cashflow', 'operatingCashFlow'),

    capex: trend('CapEx', 'currency_millions', r => ({
      // CapEx stored as negative; expose as absolute (spending amount)
      value: r.capex != null ? Math.abs(r.capex) : null,
    }), 'cashflow', 'capitalExpenditure'),

    ebitda: trend('EBITDA', 'currency_millions', r => {
      if (isFinancialSector) return { value: null }
      if (r.ebitda != null) return { value: r.ebitda }
      // Approximate from EBIT + D&A when direct field absent
      if (r.ebit != null && r.dna != null) return { value: r.ebit + r.dna, isEstimated: true }
      return { value: null }
    }, 'income', 'EBITDA'),
  }

  const balanceSheetTrend = {
    currentRatio: trend('Current Ratio', 'ratio', r => ({
      value: safeDiv(r.totalCurrentAssets, r.totalCurrentLiabilities),
    }), 'balance', 'currentRatio'),

    netDebt: trend('Net Debt', 'currency_millions', r => ({
      value: rowNetDebt(r),
    }), 'balance', 'totalDebt'),
  }

  const assetEfficiencyTrend = {
    assetTurnover: trend('Asset Turnover', 'ratio', r => ({
      value: safeDiv(r.revenue, r.totalAssets),
    }), 'balance', 'totalAssets'),
  }

  return {
    revenueTrend,
    marginTrend,
    profitabilityTrend,
    cashFlowTrend,
    balanceSheetTrend,
    assetEfficiencyTrend,
    latestMetrics,
    dataQualityWarnings: warnings,
  }
}
