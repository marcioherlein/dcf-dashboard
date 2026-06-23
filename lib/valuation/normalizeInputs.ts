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
  // Prior TTM revenue for true rolling YoY growth (avoids the short-period artifact
  // when TTM extends only 1-3 months beyond the last annual period)
  priorTtmRevenueM: number | null
  // Context for warnings
  altmanZone: string | null
  beneishFlag: string | null
  isFinancialSector: boolean
  fcfCapApplied: boolean
}

// Shape of /api/statements response (loose — fields are dynamic)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

interface StatementsDataLike {
  annual:    { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  quarterly: { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  ttm:       { incomeStatement: AnyRow | null; balanceSheet: AnyRow | null; cashFlow: AnyRow | null }
  priorTtm?: { incomeStatement: AnyRow | null; cashFlow: AnyRow | null }
  ttmMeta?:  { latestQuarterEndDate: string | null; quarterCount: number; hasPriorTtm: boolean }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeModellingInputs(ticker: string, apiData: any, statementsData?: StatementsDataLike | null, cagrOverride?: number): ModellingInput {
  const wacc = apiData?.wacc ?? {}
  const fv = apiData?.fairValue ?? {}
  const cagrAnalysis = apiData?.cagrAnalysis ?? {}
  const scores = apiData?.scores ?? {}
  const vm = apiData?.valuationMethods ?? {}
  const fs = apiData?.financialStatements ?? {}
  // FX rate (local-currency → quote-currency). 1 for USD companies; ~0.031 for TSM (TWD→USD).
  const fxRate: number = apiData?.providerStatus?.fx?.rate ?? 1

  // Compute companyType and isFinancialSector early — needed by buildProjectedRows
  // which is called before the main return block.
  const companyTypeEarly: ModellingInput['companyType'] = vm.companyType ?? 'standard'
  const FINANCIAL_TYPES_EARLY: Set<string> = new Set(['financial', 'fintech', 'bdc', 'mreeit'])
  // Also detect fintech-hybrid companies classified under non-financial Yahoo sectors.
  // MELI is "Consumer Cyclical / Internet Retail" but has Mercado Pago as >40% of revenue.
  // Its NWC includes consumer credit receivables and merchant payables that are quasi-financial
  // and blow up the NWC delta the same way a bank's deposit/loan book does.
  // Detect via the same fintech industry regex used elsewhere in the codebase.
  //
  // Note: `mercado` was previously the catch for MELI but it never fires because the regex
  // tests `sector + ' ' + industry` strings from Yahoo, which are "consumer cyclical internet
  // retail" for MELI — no "mercado" in that string. Broadened to match `internet.*retail`
  // without requiring "payment" since all major internet retail platforms embed payments.
  // Added `grab|gojek|sea.*limited|shopee` for Southeast Asian super-app fintech-hybrids.
  const FINTECH_INDUSTRY_RE_NWC = /fintech|neobank|digital.?bank|payment|credit.?service|consumer.?finance|insurtech|internet.*retail|mercado|grab|gojek|sea.*limited/i
  const sectorForNWC = (apiData?.quote?.sector ?? '').toLowerCase()
  const industryForNWC = (apiData?.quote?.industry ?? '').toLowerCase()
  const isFintechHybridForNWC = FINTECH_INDUSTRY_RE_NWC.test(sectorForNWC + ' ' + industryForNWC)
  // isFinancialSector: full treatment — zeros D&A, Capex, and NWC, uses NI-derived EBIT.
  // Only applies to true financial/fintech companyTypes, NOT fintech-hybrids like MELI.
  // MELI has real physical capex (warehouses, POS hardware) and meaningful D&A — these
  // should NOT be zeroed, only NWC should be (via isFintechHybridForNWC).
  const isFinancialSectorEarly = FINANCIAL_TYPES_EARLY.has(companyTypeEarly)
  // isFinancialSectorOrHybridNWC: controls NWC zeroing only — true for both pure financials
  // and fintech-hybrids (MELI, Grab, GoJek, Sea). Passed separately to buildProjectedRows.
  const _isFinancialSectorOrHybridNWC = isFinancialSectorEarly || isFintechHybridForNWC

  // Build rows: prefer statements data if available, fall back to financialStatements
  let rows: ModellingRow[]
  if (statementsData?.annual?.incomeStatement?.length) {
    rows = buildRowsFromStatements(statementsData.annual, statementsData.ttm, fxRate)
  } else {
    rows = buildRows(fs)
  }

  // Derive CAGR: prefer 3Y historical from statements, then FMP blended.
  // For foreign-currency ADRs (fxRate ≠ 1) the statement-derived CAGR is in local currency —
  // it reflects local-currency growth, not USD growth (which matters for USD investors).
  // In that case, skip it and use cagrAnalysis.blended which already accounts for FX via
  // extractFCFInputs zeroing the historical component for non-USD reporters.
  //
  // When using statements-derived CAGR, apply the same Damodaran size cap + convergence
  // discount as extractFCFInputs() — otherwise a high-growth mega-cap like NVDA gets its
  // raw 70%+ historical CAGR used directly, overriding the carefully blended 22% cap.
  let cagr = nullable(apiData?.cagr) ?? cagrAnalysis.blended ?? 0.05
  if (fxRate === 1 && (statementsData?.annual?.incomeStatement?.length ?? 0) >= 3) {
    const rawStmtCagr = deriveCAGRFromStatements(statementsData!.annual.incomeStatement)
    if (rawStmtCagr !== null) {
      // Compute the base revenue for size-cap lookup (use TTM or most recent annual)
      const allRows = buildRowsFromStatements(statementsData!.annual, statementsData!.ttm, fxRate)
      const ttmOrLast = allRows.find(r => r.year === 'TTM') ?? allRows.filter(r => !r.isProjected).at(-1)
      const revM = ttmOrLast?.revenue ?? null
      cagr = applyCagrCapsFromRevenue(rawStmtCagr, revM, apiData?.quote?.sector)
    }
  }

  // Append projected rows when none exist (e.g., built from statements which only has historical)
  if (!rows.some(r => r.isProjected)) {
    const nYears = apiData?.growthModel === 'three-stage' ? 7 : 5
    const projectionCagr = cagrOverride !== undefined ? cagrOverride : cagr
    rows = [...rows, ...buildProjectedRows(rows, projectionCagr, nYears, isFinancialSectorEarly, companyTypeEarly, isFintechHybridForNWC && !isFinancialSectorEarly)]
  }

  // Base FCF: prefer TTM FCF from statements (raw dollars → millions)
  let baseFCF = nullable(apiData?.baseFCF)
  const ttmFCF = statementsData?.ttm?.cashFlow?.freeCashFlow
  if (typeof ttmFCF === 'number' && isFinite(ttmFCF) && ttmFCF !== 0) {
    baseFCF = ttmFCF / 1e6 * fxRate
  }

  // Balance sheet overrides from TTM statements
  let cashM = nullable(fv.cash)
  let debtM = nullable(fv.debt)
  let sharesOutstanding = nullable(fv.sharesOutstanding)
  const ttmBS = statementsData?.ttm?.balanceSheet
  if (ttmBS) {
    const stmtCash = ttmBS.cashCashEquivalentsAndShortTermInvestments ?? ttmBS.cash
    if (typeof stmtCash === 'number' && isFinite(stmtCash)) cashM = stmtCash / 1e6 * fxRate
    // Mirror the debt-source logic from the API route: auto OEMs and companies where
    // Yahoo's totalDebt > 2× market cap have captive finance arms that inflate totalDebt.
    const qIndustry = apiData?.quote?.industry ?? ''
    const isAutoOEM = /Auto Manufacturers|Motor Vehicle/i.test(qIndustry)
    const mcapM = (apiData?.quote?.marketCap ?? 0) / 1e6
    const rawTtmTotalDebt = (ttmBS.totalDebt ?? 0) as number
    const useLTDOnly = isAutoOEM || (mcapM > 0 && rawTtmTotalDebt / 1e6 > mcapM * 2.0)
    const stmtDebt = useLTDOnly
      ? (ttmBS.longTermDebt ?? (ttmBS as any).longTermDebtAndCapitalLeaseObligation ?? ttmBS.totalDebt)
      : (ttmBS.totalDebt ?? ttmBS.longTermDebt)
    if (typeof stmtDebt === 'number' && isFinite(stmtDebt)) debtM = stmtDebt / 1e6 * fxRate
    const stmtShares = ttmBS.commonStockSharesOutstanding ?? ttmBS.sharesOutstanding
    if (typeof stmtShares === 'number' && isFinite(stmtShares) && stmtShares > 0) sharesOutstanding = stmtShares
  }

  // Prefer market-cap-derived share count: more reliable for ADRs where balance-sheet
  // shares may reflect underlying (not ADR) units. marketCap / price = ADR count.
  const mcap = apiData?.quote?.marketCap
  const qprice = apiData?.quote?.price
  if (typeof mcap === 'number' && mcap > 0 && typeof qprice === 'number' && qprice > 0) {
    sharesOutstanding = mcap / qprice / 1e6
  }

  const companyType: ModellingInput['companyType'] = companyTypeEarly
  // Include fintech in financial sector guard — both use earnings-based projections
  const _FINANCIAL_TYPES: Set<string> = new Set(['financial', 'fintech', 'bdc', 'mreeit'])
  const isFinancialSector = isFinancialSectorEarly

  // Derive effective tax rate from statement rows (3Y median of taxRateForCalcs)
  // This overrides the WACC default (often 0.21) which may be wrong for non-US companies.
  const historicalTaxRates = rows
    .filter(r => !r.isProjected && r.taxRate != null && r.year !== 'TTM')
    .map(r => r.taxRate!)
    .filter(v => v > 0.05 && v < 0.60)
    .slice(-3)
  const medianTaxRate = historicalTaxRates.length > 0
    ? (historicalTaxRates.sort((a, b) => a - b)[Math.floor(historicalTaxRates.length / 2)])
    : null
  const effectiveTaxRate = medianTaxRate ?? wacc.inputs?.taxRate ?? 0.21

  return {
    ticker,
    companyName: apiData?.companyName ?? ticker,
    companyType,
    currency: apiData?.quote?.currency ?? 'USD',
    financialCurrencyNote: apiData?.financialCurrencyNote ?? null,
    wacc: wacc.wacc ?? 0.10,
    costOfEquity: wacc.costOfEquity ?? 0.12,
    afterTaxCostOfDebt: wacc.afterTaxCostOfDebt ?? 0.04,
    taxRate: effectiveTaxRate,
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
    priorTtmRevenueM: (() => {
      const pis = statementsData?.priorTtm?.incomeStatement
      if (!pis) return null
      const raw = pis.totalRevenue ?? pis.operatingRevenue
      return typeof raw === 'number' && isFinite(raw) ? raw / 1e6 * fxRate : null
    })(),
    altmanZone: nullable(scores.altman?.zone),
    beneishFlag: nullable(scores.beneish?.flag),
    isFinancialSector,
    fcfCapApplied: (apiData?.fcfCapApplied as boolean | undefined) ?? false,
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

function buildProjectedRows(historicalRows: ModellingRow[], cagr: number, nYears: number, isFinancialSector = false, companyType: ModellingInput['companyType'] = 'standard', zeroNwcOnly = false): ModellingRow[] {
  // zeroNwcOnly: true for fintech-hybrid companies like MELI that need NWC zeroed
  // but still have real physical D&A and Capex (should NOT use the full financial path).
  const effectiveZeroNwc = isFinancialSector || zeroNwcOnly
  const annualRows = historicalRows.filter(r => r.year !== 'TTM' && !r.isProjected)
  const recent = annualRows.slice(-3)
  if (recent.length === 0) return []

  const ttmRow = historicalRows.find(r => r.year === 'TTM')

  // Helper: blend historical median (last 3 annual years) with TTM value.
  // TTM gets 40% weight so projections don't drift far from current operating reality.
  function blendWithTtm(
    medianFn: () => number | null,
    ttmFn: () => number | null,
  ): number | null {
    const hist = medianFn()
    const ttm  = ttmFn()
    if (hist != null && ttm != null) return hist * 0.60 + ttm * 0.40
    return ttm ?? hist
  }

  // D&A: prefer direct field; fall back to ebitda − ebit
  const medianDnaPctHist = computeMedian(recent.map(r => {
    if (r.dna != null && r.revenue != null && r.revenue > 0) return r.dna / r.revenue
    if (r.ebitda != null && r.ebit != null && r.revenue != null && r.revenue > 0)
      return Math.max(0, r.ebitda - r.ebit) / r.revenue
    return null
  }))
  const ttmDnaPct = ttmRow?.revenue && ttmRow.revenue > 0
    ? (ttmRow.dna != null ? ttmRow.dna / ttmRow.revenue
      : (ttmRow.ebitda != null && ttmRow.ebit != null
          ? Math.max(0, ttmRow.ebitda - ttmRow.ebit) / ttmRow.revenue
          : null))
    : null
  const medianDnaPct = blendWithTtm(() => medianDnaPctHist, () => ttmDnaPct)

  // EBITDA margin: separate median so we can set ebitda even when dna is unavailable
  const medianEbitdaMarginHist = computeMedian(recent.map(r =>
    r.ebitda != null && r.revenue != null && r.revenue > 0 ? r.ebitda / r.revenue : null))
  const ttmEbitdaMargin = ttmRow?.revenue && ttmRow.revenue > 0 && ttmRow.ebitda != null
    ? ttmRow.ebitda / ttmRow.revenue : null
  const medianEbitdaMargin = blendWithTtm(() => medianEbitdaMarginHist, () => ttmEbitdaMargin)

  // EBIT margin: prefer direct ebit; fall back to ebitda − dna medians (avoids null NOPAT)
  const medianEbitMarginDirectHist = computeMedian(recent.map(r =>
    r.ebit != null && r.revenue != null && r.revenue > 0 ? r.ebit / r.revenue : null))
  const ttmEbitMargin = ttmRow?.revenue && ttmRow.revenue > 0 && ttmRow.ebit != null
    ? ttmRow.ebit / ttmRow.revenue : null
  const medianEbitMarginDirect = blendWithTtm(() => medianEbitMarginDirectHist, () => ttmEbitMargin)
  const medianEbitMargin: number | null =
    medianEbitMarginDirect ??
    (medianEbitdaMargin != null && medianDnaPct != null
      ? medianEbitdaMargin - medianDnaPct
      : medianEbitdaMargin)

  // CapEx: default to 0 when historical data is absent (user can edit; 0 = conservative/asset-light)
  const medianCapexPctHist = computeMedian(recent.map(r =>
    r.capex != null && r.revenue != null && r.revenue > 0 ? Math.abs(r.capex) / r.revenue : null)) ?? 0
  const ttmCapexPct = ttmRow?.revenue && ttmRow.revenue > 0 && ttmRow.capex != null
    ? Math.abs(ttmRow.capex) / ttmRow.revenue : null
  const medianCapexPct = ttmCapexPct != null
    ? medianCapexPctHist * 0.60 + ttmCapexPct * 0.40
    : medianCapexPctHist

  const medianNetMarginHist = computeMedian(recent.map(r =>
    r.netIncome != null && r.revenue != null && r.revenue > 0 ? r.netIncome / r.revenue : null))
  const ttmNetMargin = ttmRow?.revenue && ttmRow.revenue > 0 && ttmRow.netIncome != null
    ? ttmRow.netIncome / ttmRow.revenue : null

  // Profitability inflection guard: if TTM margin is positive but historical median is negative
  // (company just crossed into profitability), the 60/40 blend still projects negative NI.
  // Example: 2 loss years + 1 breakeven = median ~-8%; TTM = +5%; blended = -4.8% + 2% = -2.8%.
  // This would project a profitable company as permanently loss-making.
  // Fix: when ttmNetMargin > 0 AND medianNetMarginHist < 0, clamp blended minimum to 0.
  // The company is profitable now; projecting losses is directionally wrong.
  const rawMedianNetMargin = blendWithTtm(() => medianNetMarginHist, () => ttmNetMargin)
  const medianNetMargin = (ttmNetMargin != null && ttmNetMargin > 0 && (medianNetMarginHist ?? 0) < 0)
    ? Math.max(0, rawMedianNetMargin ?? 0)  // clamp to zero minimum at the inflection point
    : rawMedianNetMargin

  // Unified tax rate filter: same logic as global effectiveTaxRate (normalizeModellingInputs
  // lines 203-208). Filter out 0-5% rates (NOL/loss years with distorted effective rate) and
  // >60% (one-time charges). Both the per-row projected taxRate and the NOPAT computation
  // must use the same filtered median to avoid contradictory tax treatments in the same model.
  const medianTaxRate = computeMedian(
    recent.map(r => r.taxRate ?? null).filter((v): v is number => v != null && v > 0.05 && v < 0.60)
  )
  const medianFcfMargin = computeMedian(recent.map(r =>
    r.freeCashFlow != null && r.revenue != null && r.revenue > 0 ? r.freeCashFlow / r.revenue : null))

  // NWC delta as % of revenue change — used to project NWC for each forecast year
  // so UFCF gets a non-zero ΔNWC instead of defaulting to 0.
  //
  // Financial/fintech companies: NWC from balance sheet includes customer deposits
  // (current liabilities) and loan receivables (current assets). As the company grows,
  // both sides scale together but the net NWC swing is enormous and not an operating
  // working capital concept. For NU, this was producing -73% NWC/ΔRevenue, destroying
  // UFCF in projected years. Zero it out for financial companies — their "working capital"
  // management is captured by the net interest margin in EBIT/NOPAT, not in NWC changes.
  const deriveNwc = (r: ModellingRow): number | null => {
    if (r.totalCurrentAssets == null || r.cash == null || r.totalCurrentLiabilities == null) return null
    return (r.totalCurrentAssets - r.cash) - r.totalCurrentLiabilities
  }
  const nwcDeltaRevRatios = effectiveZeroNwc ? [] : recent.map((r, i) => {
    if (i === 0) return null
    const prev = recent[i - 1]
    const nwcCurr = deriveNwc(r)
    const nwcPrev = deriveNwc(prev)
    const revDelta = r.revenue != null && prev.revenue != null ? r.revenue - prev.revenue : null
    if (nwcCurr == null || nwcPrev == null || revDelta == null || revDelta === 0) return null
    return (nwcCurr - nwcPrev) / Math.abs(revDelta)
  }).filter((v): v is number => v != null)
  const avgNwcDeltaRevRatio = nwcDeltaRevRatios.length > 0
    ? nwcDeltaRevRatios.reduce((a, b) => a + b, 0) / nwcDeltaRevRatios.length
    : null

  // Starting NWC level for projection chain (TTM preferred, else last annual row)
  const lastNwc = (() => {
    const anchor = ttmRow ?? annualRows[annualRows.length - 1]
    return anchor ? deriveNwc(anchor) : null
  })()

  const lastAnnualRow = annualRows[annualRows.length - 1]
  const baseRevenue = ttmRow?.revenue ?? lastAnnualRow?.revenue ?? null
  if (baseRevenue == null || baseRevenue <= 0) return []

  const lastAnnualYear = parseInt(lastAnnualRow?.year ?? '', 10)
  // When lastAnnualRow is absent (TTM-only), use TTM fiscal date or current year as base
  let startYear: number
  if (!isNaN(lastAnnualYear)) {
    startYear = lastAnnualYear + 1
  } else {
    const ttmFiscalYear = ttmRow?.fiscalDate
      ? parseInt(String(ttmRow.fiscalDate).slice(0, 4), 10)
      : NaN
    startYear = (!isNaN(ttmFiscalYear) ? ttmFiscalYear : new Date().getFullYear()) + 1
  }

  const rows: ModellingRow[] = []
  let prevRevenue = baseRevenue
  let prevNwc = lastNwc
  for (let i = 0; i < nYears; i++) {
    const revenue = baseRevenue * Math.pow(1 + cagr, i + 1)

    // Financial/fintech companies: EBIT from operating income is structurally wrong.
    // Yahoo's operatingIncome for banks/fintechs deducts credit loss provisions as an
    // operating expense, producing deeply negative EBIT (NU shows −37% EBIT margin
    // while actually earning 17% net margin). For financial companies, derive projected
    // EBIT from net income margin (which is the real earnings base) divided by
    // (1 − taxRate) to produce a consistent NOPAT bridge.
    // D&A is set to 0 because for financial companies there are no physical assets to
    // depreciate — the "D&A" in Yahoo's data includes credit provisions and intangible
    // amortization that are already embedded in net income, not addbacks.
    let ebit: number | null
    let dna: number | null
    let ebitda: number | null
    // Hoist cyclical trough detection outside the if/else so it's available for freeCashFlow below
    const isCyclicalTrough = !isFinancialSector &&
      (medianEbitMargin != null && medianEbitMargin < -0.02) &&
      (ttmEbitMargin != null && ttmEbitMargin > 0.01)
    if (isFinancialSector) {
      // Back-compute EBIT from net margin so NOPAT = netIncome (via ebit × (1-taxRate) = netMargin × rev)
      const taxR = medianTaxRate ?? 0.21
      const netM = medianNetMargin ?? 0
      ebit  = revenue * netM / Math.max(0.01, 1 - taxR)  // ebit × (1 − t) = netIncome → ebit = NI / (1−t)
      dna   = 0  // no physical asset D&A for financial companies; credit provisions are in EBIT
      ebitda = ebit  // ebitda ≈ ebit when dna = 0
    } else {
      // For growth/startup companies where EBIT is negative but FCF is positive,
      // the EBIT distortion comes from SBC being routed through the EBIT bridge.
      // Yahoo includes SBC in the EBITDA → EBIT gap, making EBIT look worse than
      // the actual cash generation. ZETA: EBIT -13%, FCF +3%, SBC ~22% of revenue.
      //
      // Fix: when medianEbitMargin < 0 AND medianFcfMargin > 0 (i.e. real cash
      // generation exists despite accounting losses), ramp EBIT toward a target
      // profitability level using the FCF margin as the trajectory anchor:
      //   - EBIT in year 1 = max(medianEbitMargin, medianFcfMargin × 0.5)
      //   - EBIT converges linearly over nYears toward sector-typical margin or
      //     medianFcfMargin (whichever is higher), capped at 40%.
      // This models the natural SBC % decline as revenue scales, without fabricating
      // profitability the business hasn't earned yet.
      // Case 1 — SBC distortion (ZETA, SNAP): growth/startup with negative median EBIT but positive FCF.
      // SBC inflates the EBIT drag; the company is cash-flow positive today.
      const isSBCDistorted = (medianEbitMargin != null && medianEbitMargin < -0.02) &&
        (medianFcfMargin != null && medianFcfMargin > 0) &&
        (companyType === 'growth' || companyType === 'startup')

      // Case 2 — Cyclical trough (MU, XOM in downcycles): median EBIT negative due to
      // loss years in the lookback window, but the TTM EBIT is positive (company has
      // recovered). Using the trough-distorted median projects permanent losses for a
      // business that is currently profitable. Fix: when ttmEbitMargin > 0 AND
      // medianEbitMargin < -0.02, use ttmEbitMargin as the base for projections.
      // Applies to all non-financial companyTypes (standard, growth, dividend, startup).
      // (isCyclicalTrough is hoisted above the if/else block)

      let effectiveEbitMargin = medianEbitMargin
      if (isSBCDistorted && medianFcfMargin != null && medianEbitMargin != null) {
        // Ramp from current (negative) EBIT to sector-typical target over nYears.
        // Models the natural SBC % decline as revenue scales.
        const targetEbitMargin = Math.min(0.35, Math.max(0.20, medianFcfMargin * 2))
        const t = (i + 1) / nYears
        effectiveEbitMargin = medianEbitMargin + t * (targetEbitMargin - medianEbitMargin)
      } else if (isCyclicalTrough && ttmEbitMargin != null) {
        // Use TTM EBIT margin as the projection base — the trough year is behind us.
        // Apply a small haircut (10%) for conservatism vs. peak cycle.
        effectiveEbitMargin = ttmEbitMargin * 0.90
      }

      ebit = effectiveEbitMargin != null ? revenue * effectiveEbitMargin : null

      // EBIT null fallback: when Yahoo provides no operatingIncome/ebit for this company
      // (common for certain SaaS tickers like NOW, CRM), medianEbitMargin stays null and
      // every projected UFCF row collapses to null NOPAT. Fix: back-compute EBIT from the
      // net margin, identical to the financial-branch formula but applied as a fallback
      // so the UFCF model degrades gracefully instead of producing null rows.
      // Only fires when ebit is still null after all other branches.
      if (ebit == null && medianNetMargin != null && medianNetMargin > 0) {
        const taxR = medianTaxRate ?? 0.21
        ebit = revenue * medianNetMargin / Math.max(0.01, 1 - taxR)
      }
      dna = medianDnaPct != null ? revenue * medianDnaPct : null
      // ebitda: prefer ebit+dna; fall back to EBITDA margin so UFCF engine can derive D&A
      ebitda = (ebit != null && dna != null)
        ? ebit + dna
        : (medianEbitdaMargin != null ? revenue * medianEbitdaMargin : null)
    }

    // Project NWC level for this year; encode as BS fields so deriveNWC() picks it up.
    // totalCurrentAssets = nwc, cash = 0, totalCurrentLiabilities = 0 → deriveNWC = nwc.
    let projTotalCurrentAssets: number | null = null
    let projCash: number | null = null
    let projTotalCurrentLiabilities: number | null = null
    if (avgNwcDeltaRevRatio != null && prevNwc != null) {
      const revDelta = revenue - prevRevenue
      const projNwc = prevNwc + avgNwcDeltaRevRatio * revDelta
      projTotalCurrentAssets = projNwc
      projCash = 0
      projTotalCurrentLiabilities = 0
      prevNwc = projNwc
    }
    prevRevenue = revenue

    rows.push({
      year: String(startYear + i) + 'E',
      isProjected: true,
      revenue,
      ebit,
      ebitda,
      netIncome: (() => {
        // Mirror the cyclical trough override applied to EBIT: when medianNetMargin is
        // negative due to loss years but TTM net margin is positive, use TTM × 0.90.
        // Without this, MU's projected NI stays near-zero (3Y median includes FY2023 loss)
        // even though TTM net margin is ~22%. The LFCF fair value was 40-60% understated.
        const effectiveNetMargin = isCyclicalTrough && ttmNetMargin != null && ttmNetMargin > 0.01 &&
          (medianNetMargin == null || medianNetMargin < 0)
          ? ttmNetMargin * 0.90
          : medianNetMargin
        return effectiveNetMargin != null ? revenue * effectiveNetMargin : null
      })(),
      eps: null,
      // CapEx: for financial/fintech companies, zero out projected capex to match the
      // D&A=0 treatment. Financial companies' "capex" is technology infrastructure and
      // is immaterial relative to the NI-based UFCF proxy. Not zeroing it was inconsistent
      // with the D&A=0 intent and reduced UFCF by ~1-3% of revenue for NU/SOFI.
      capex: isFinancialSector ? 0 : -(revenue * medianCapexPct),
      operatingCF: null,
      freeCashFlow: (medianFcfMargin != null && medianEbitMargin != null && medianEbitMargin < -0.02 && medianFcfMargin > 0)
        ? revenue * medianFcfMargin  // SBC-distorted: use FCF margin as UFCF fallback
        : (isCyclicalTrough && ttmEbitMargin != null && medianFcfMargin != null && medianFcfMargin > 0)
        ? revenue * medianFcfMargin  // cyclical trough recovered: FCF fallback
        : (medianFcfMargin != null && medianCapexPct === 0 ? revenue * medianFcfMargin : null),
      dividendsPaid: null,
      financingCF: null,
      cash: projCash,
      totalCurrentAssets: projTotalCurrentAssets,
      totalCurrentLiabilities: projTotalCurrentLiabilities,
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
// yahoo-finance2 fundamentalsTimeSeries returns raw local-currency values; ModellingRow expects
// USD millions. Pass fxRate (from apiData.providerStatus.fx.rate) to convert foreign-currency
// companies (e.g. TSM reports in TWD; fxRate ≈ 0.031 converts TWD → USD).

function buildRowsFromStatements(
  annual: { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] },
  ttm: { incomeStatement: AnyRow | null; balanceSheet: AnyRow | null; cashFlow: AnyRow | null },
  fxRate = 1,
): ModellingRow[] {
  const toM = (v: unknown): number | null => {
    if (typeof v !== 'number' || !isFinite(v)) return null
    return v / 1e6 * fxRate
  }
  // Map annual rows by endDate year
  const byYear = new Map<string, Partial<ModellingRow>>()

  for (const row of annual.incomeStatement ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (!year || year.length !== 4) continue
    byYear.set(year, {
      year,
      isProjected: false,
      revenue:    toM(row.totalRevenue ?? row.operatingRevenue),
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
      capex:        toM(row.capitalExpenditure ?? row.purchaseOfPPE ?? row.capitalExpenditures),
      operatingCF:  toM(row.operatingCashFlow ?? row.cashFlowFromContinuingOperatingActivities),
      freeCashFlow: toM(row.freeCashFlow),
      dna:          toM(row.depreciationAndAmortization ?? row.reconciledDepreciation ?? row.depreciationAmortizationDepletion ?? row.amortizationOfIntangibles),
      dividendsPaid: toM(row.cashDividendsPaid ?? row.dividendsPaid ?? row.paymentOfDividends),
      financingCF:  toM(row.financingCashFlow ?? row.cashFlowFromContinuingFinancingActivities),
      fiscalDate:   (existing.fiscalDate ?? row.endDate) ?? null,
    })
  }

  for (const row of annual.balanceSheet ?? []) {
    const year = String(row.endDate ?? '').slice(0, 4)
    if (!year || year.length !== 4) continue
    const existing = byYear.get(year) ?? { year, isProjected: false }
    byYear.set(year, {
      ...existing,
      cash:                    toM(row.cashCashEquivalentsAndShortTermInvestments ?? row.cashAndShortTermInvestments ?? row.cashAndCashEquivalents ?? row.cash),
      totalCurrentAssets:      toM(row.currentAssets ?? row.totalCurrentAssets),
      totalCurrentLiabilities: toM(row.currentLiabilities ?? row.totalCurrentLiabilities),
      longTermDebt:            toM(row.longTermDebt ?? row.longTermDebtAndCapitalLeaseObligation ?? row.longTermDebtNoncurrent),
      totalEquity:             toM(row.stockholdersEquity ?? row.totalStockholdersEquity ?? row.totalEquity ?? row.commonStockEquity),
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
      revenue:    toM(is.totalRevenue ?? is.operatingRevenue),
      ebit:       toM(is.operatingIncome ?? is.EBIT),
      ebitda:     toM(is.EBITDA),
      netIncome:  toM(is.netIncome),
      eps:        nullable(is.dilutedEPS),
      capex:        toM(cf.capitalExpenditure ?? cf.purchaseOfPPE ?? cf.capitalExpenditures),
      operatingCF:  toM(cf.operatingCashFlow ?? cf.cashFlowFromContinuingOperatingActivities),
      freeCashFlow: toM(cf.freeCashFlow),
      dna:          toM(cf.depreciationAndAmortization ?? cf.reconciledDepreciation ?? cf.depreciationAmortizationDepletion ?? cf.amortizationOfIntangibles),
      dividendsPaid: toM(cf.cashDividendsPaid ?? cf.dividendsPaid ?? cf.paymentOfDividends),
      financingCF:  toM(cf.financingCashFlow ?? cf.cashFlowFromContinuingFinancingActivities),
      cash:                    toM(bs.cashCashEquivalentsAndShortTermInvestments ?? bs.cashAndShortTermInvestments ?? bs.cashAndCashEquivalents ?? bs.cash),
      totalCurrentAssets:      toM(bs.currentAssets ?? bs.totalCurrentAssets),
      totalCurrentLiabilities: toM(bs.currentLiabilities ?? bs.totalCurrentLiabilities),
      longTermDebt:            toM(bs.longTermDebt ?? bs.longTermDebtAndCapitalLeaseObligation ?? bs.longTermDebtNoncurrent),
      totalEquity:             toM(bs.stockholdersEquity ?? bs.totalStockholdersEquity ?? bs.totalEquity ?? bs.commonStockEquity),
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
    .map(r => ({ year: String(r.endDate ?? '').slice(0, 4), rev: (r.totalRevenue ?? r.operatingRevenue) as number | null }))
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

// ── Apply Damodaran size caps + convergence discount to a raw CAGR ────────────
// Mirrors the logic in extractFCFInputs() (projectCashFlows.ts) so both the
// main valuation path and the ForecastTable modelling path use identical caps.
function applyCagrCapsFromRevenue(rawCagr: number, revenueMillion: number | null, sector?: string | null): number {
  const revB = (revenueMillion ?? 0) / 1000  // M → B

  // Energy and Basic Materials: commodity cycles inflate historical CAGR. Cap at 8%
  // matching the deriveForwardPEAssumptions cyclical cap so the Full DCF Table and
  // Cockpit use consistent CAGR for energy/mining companies.
  const isCyclicalSector = sector === 'Energy' || sector === 'Basic Materials'
  if (isCyclicalSector && rawCagr > 0.08) return 0.08

  let sizeCap: number
  if (revB > 50)       sizeCap = 0.22   // mega-cap  (>$50B revenue)
  else if (revB > 10)  sizeCap = 0.28   // large-cap (>$10B)
  else if (revB > 2)   sizeCap = 0.38   // mid-cap   (>$2B)
  else                 sizeCap = 0.55   // small-cap

  // Convergence discount: excess above 20% reduced by 25% (Damodaran mean-reversion)
  let adjusted = rawCagr
  if (rawCagr > 0.20) {
    const excess = rawCagr - 0.20
    adjusted = 0.20 + excess * 0.75
  }

  return Math.max(-0.10, Math.min(adjusted, sizeCap))
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
