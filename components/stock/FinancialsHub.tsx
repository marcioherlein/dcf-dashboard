'use client'
import { useState, useMemo, useEffect } from 'react'
import YahooFinancials from './YahooFinancials'
import FinancialCharts from './FinancialCharts'
import InsiderTransactionsWidget from './InsiderTransactionsWidget'
import InfoTooltip from '@/components/ui/InfoTooltip'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

interface StatementsData {
  annual:    { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  quarterly: { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  ttm:       { incomeStatement: AnyRow | null; balanceSheet: AnyRow | null; cashFlow: AnyRow | null }
}

interface Props {
  statementsData:  StatementsData | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  financialsData?: any
  currency?:          string
  reportingCurrency?: string
  cagr?:           number
  highlight?:      { rowKey: string; statement: 'income' | 'balance' | 'cashflow' } | null
  initialSubTab?:  SubTab | null
}

type SubTab = 'statements' | 'growth' | 'profitability' | 'solvency' | 'analysts' | 'ownership'
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'statements',    label: 'Statements'    },
  { id: 'growth',        label: 'Growth'        },
  { id: 'profitability', label: 'Profitability' },
  { id: 'solvency',      label: 'Solvency'      },
  { id: 'analysts',      label: 'Analysts'      },
  { id: 'ownership',     label: 'Ownership'     },
]

const TAB_ANCHORS: Record<SubTab, string> = {
  statements:    'Raw financials: revenue, earnings, and cash flow across reporting periods.',
  growth:        'How fast the company is growing — revenue, earnings, and cash flow year-over-year.',
  profitability: 'How much of each revenue dollar becomes profit, and whether margins are expanding or contracting.',
  solvency:      'Can this company service its debt and survive a downturn? Leverage, coverage, and liquidity.',
  analysts:      'Wall Street consensus on the stock — price targets, ratings, and forward estimates.',
  ownership:     'Who holds the stock: institutions, insiders, and retail — and how that\'s changed recently.',
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function n(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null
}

function safe(a: unknown, b: unknown, fn: (a: number, b: number) => number): number | null {
  const av = n(a), bv = n(b)
  if (av == null || bv == null || bv === 0) return null
  const r = fn(av, bv)
  return isFinite(r) ? r : null
}

function cagrN(arr: (number | null)[], n: number): number | null {
  // Fix G3: use actual positional index, not a filtered positive-only subset.
  // Intermediate negative values are fine; only require both endpoints > 0.
  const finite = arr.filter((v): v is number => v != null && isFinite(v))
  if (finite.length < n + 1) return null
  const oldest = finite[finite.length - 1 - n]
  const newest = finite[finite.length - 1]
  if (oldest <= 0 || newest <= 0) return null
  return Math.pow(newest / oldest, 1 / n) - 1
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtPct(v: number | null, dec = 1): string {
  if (v == null) return '—'
  const s = (v * 100).toFixed(dec) + '%'
  return s
}

function fmtGrowth(v: number | null): string {
  if (v == null) return '—'
  const s = (Math.abs(v) * 100).toFixed(1) + '%'
  return (v >= 0 ? '+' : '−') + s
}

function fmtX(v: number | null, dec = 2): string {
  if (v == null) return '—'
  return v.toFixed(dec) + '×'
}

function fmtDays(v: number | null): string {
  if (v == null) return '—'
  return v.toFixed(1)
}

function growthColor(v: number | null): string {
  if (v == null) return 'text-slate-400'
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-400'
}

function valColor(v: number | null, positiveIsGood = true): string {
  if (v == null) return 'text-slate-400'
  if (v === 0) return 'text-slate-500'
  const good = v > 0 ? positiveIsGood : !positiveIsGood
  return good ? 'text-slate-700' : 'text-red-500'
}

// ── Mini sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ values, positiveIsGood = true }: { values: (number | null)[]; positiveIsGood?: boolean }) {
  const pts = values.slice(-8).filter((v): v is number => v != null)
  if (pts.length < 2) return <span className="inline-block w-9" />
  const mx = Math.max(...pts.map(Math.abs), 0.0001)
  const barW = 5, gap = 2
  const totalW = pts.length * (barW + gap) - gap
  return (
    <svg width={totalW} height={16} className="shrink-0 inline-block align-middle mr-1.5" aria-hidden="true">
      {pts.map((v, i) => {
        const h = Math.max(2, (Math.abs(v) / mx) * 14)
        const isPos = v >= 0
        const fill = isPos
          ? (positiveIsGood ? '#10b981' : '#94a3b8')
          : (positiveIsGood ? '#ef4444' : '#10b981')
        return <rect key={i} x={i * (barW + gap)} y={16 - h} width={barW} height={h} fill={fill} rx={1} opacity={0.75} />
      })}
    </svg>
  )
}

// ── Metrics table ──────────────────────────────────────────────────────────────

interface MetricRowDef {
  label:           string
  values:          (number | null)[]
  fmt:             'pct' | 'growth' | 'x' | 'days' | 'score' | '$M'
  positiveIsGood?: boolean
  isHeader?:       boolean
  indent?:         boolean
  tooltip?:        string
}

function MetricsTable({ columns, rows, hideSparks }: { columns: string[]; rows: MetricRowDef[]; hideSparks?: boolean }) {
  const formatVal = (v: number | null, fmt: string) => {
    switch (fmt) {
      case 'pct':    return fmtPct(v)
      case 'growth': return fmtGrowth(v)
      case 'x':      return fmtX(v)
      case 'days':   return fmtDays(v)
      case 'score':  return v != null ? v.toFixed(2) : '—'
      case '$M':     return v != null ? (Math.abs(v) >= 1000 ? (v < 0 ? '-' : '') + '$' + (Math.abs(v)/1000).toFixed(1) + 'B' : (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(0) + 'M') : '—'
      default:       return v != null ? v.toFixed(2) : '—'
    }
  }

  const cellColor = (v: number | null, fmt: string, positiveIsGood = true) => {
    if (fmt === 'growth') return growthColor(v)
    if (fmt === 'pct' || fmt === 'x' || fmt === 'days' || fmt === 'score' || fmt === '$M') return valColor(v, positiveIsGood)
    return 'text-slate-700'
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="min-w-[480px] w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="sticky left-0 z-10 bg-white px-3 sm:px-4 py-2 text-left text-[11px] font-semibold text-slate-500 w-40 min-w-[160px] sm:w-56 sm:min-w-[224px]">
              Metric
            </th>
            {columns.map(col => (
              <th key={col} className={`px-2 sm:px-3 py-2 text-right text-[11px] font-semibold whitespace-nowrap ${
                col === 'TTM' ? 'text-amber-600 bg-amber-50/40' : 'text-slate-500'
              }`}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.isHeader) {
              return (
                <tr key={i} className="bg-slate-50 border-y border-slate-100">
                  <td colSpan={columns.length + 1} className="px-3 sm:px-4 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border-y border-slate-100">
                    {row.label}
                  </td>
                </tr>
              )
            }

            const pig = row.positiveIsGood ?? true
            return (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className={`sticky left-0 z-10 bg-white px-3 sm:px-4 py-2 text-xs whitespace-nowrap ${
                  row.indent ? 'pl-6 sm:pl-8 text-slate-400' : 'font-medium text-slate-600'
                }`}>
                  {!hideSparks && <Sparkline values={row.values} positiveIsGood={pig} />}
                  {row.label}
                  {row.positiveIsGood != null && !row.indent && (
                    <span className="ml-1 text-[10px] text-slate-400 font-normal" aria-label={row.positiveIsGood ? 'higher is better' : 'lower is better'}>
                      {row.positiveIsGood ? '↑' : '↓'}
                    </span>
                  )}
                  {row.tooltip && <InfoTooltip content={row.tooltip} />}
                </td>
                {row.values.map((v, j) => (
                  <td key={j} className={`px-2 sm:px-3 py-2 text-right text-xs tabular-nums font-mono whitespace-nowrap ${
                    columns[j] === 'TTM' ? 'font-semibold bg-amber-50/30' : ''
                  } ${cellColor(v, row.fmt, pig)}`}>
                    {formatVal(v, row.fmt)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Data builder ───────────────────────────────────────────────────────────────

interface PeriodData {
  year:    string
  is:      AnyRow
  bs:      AnyRow
  cf:      AnyRow
}

function buildPeriods(stmts: StatementsData | null): PeriodData[] {
  if (!stmts) return []
  const { annual, ttm } = stmts

  // Join annual by year
  const isMap  = new Map<string, AnyRow>()
  const bsMap  = new Map<string, AnyRow>()
  const cfMap  = new Map<string, AnyRow>()

  for (const r of annual.incomeStatement ?? []) {
    const y = String(r.endDate ?? '').slice(0, 4)
    if (y.length === 4) isMap.set(y, r)
  }
  for (const r of annual.balanceSheet ?? []) {
    const y = String(r.endDate ?? '').slice(0, 4)
    if (y.length === 4) bsMap.set(y, r)
  }
  for (const r of annual.cashFlow ?? []) {
    const y = String(r.endDate ?? '').slice(0, 4)
    if (y.length === 4) cfMap.set(y, r)
  }

  const years = Array.from(isMap.keys()).sort()
  const periods: PeriodData[] = years.map(y => ({
    year: y,
    is:   isMap.get(y) ?? {},
    bs:   bsMap.get(y) ?? {},
    cf:   cfMap.get(y) ?? {},
  }))

  // Add TTM
  if (ttm.incomeStatement || ttm.balanceSheet || ttm.cashFlow) {
    periods.push({
      year: 'TTM',
      is:   ttm.incomeStatement ?? {},
      bs:   ttm.balanceSheet    ?? {},
      cf:   ttm.cashFlow        ?? {},
    })
  }

  return periods
}

// Per-period metric extractor
function metrics(p: PeriodData) {
  const { is, bs, cf } = p

  // Income Statement
  const rev   = n(is.totalRevenue)
  const gp    = n(is.grossProfit)
  const cogs  = n(is.costOfRevenue)
  const ebit  = n(is.operatingIncome ?? is.EBIT ?? is.totalOperatingIncomeAsReported)
  const da    = n(cf.depreciationAndAmortization ?? cf.reconciledDepreciation ?? cf.depreciationAmortizationDepletion)
  // EBITDA: prefer Yahoo's direct value; fall back to EBIT + D&A (common for non-US companies)
  const ebitda = n(is.EBITDA ?? is.normalizedEBITDA) ?? (ebit != null && da != null ? ebit + da : null)
  const ni    = n(is.netIncome)
  const eps   = n(is.dilutedEPS)
  const sga   = n(is.sellingGeneralAndAdministration ?? is.generalAndAdministrativeExpense)
  const rnd   = n(is.researchAndDevelopment)
  // For banks, interest expense is an operating cost and may appear under different keys
  const intEx = n(is.interestExpenseNonOperating ?? is.interestExpense ?? is.netNonOperatingInterestIncomeExpense)
  const tax   = n(is.taxRateForCalcs)

  // Balance Sheet
  const totalAssets    = n(bs.totalAssets)
  const equity         = n(bs.totalStockholdersEquity ?? bs.stockholdersEquity ?? bs.commonStockEquity)
  const totalDebt      = n(bs.totalDebt)
  const ltDebt         = n(bs.longTermDebt)
  const cash           = n(bs.cashCashEquivalentsAndShortTermInvestments ?? bs.cash)
  const currA          = n(bs.currentAssets)
  const currL          = n(bs.currentLiabilities)
  const inv            = n(bs.inventory)
  const rec            = n(bs.netReceivables ?? bs.receivables ?? bs.accountsReceivable)
  const ap             = n(bs.accountsPayable)
  const ppe            = n(bs.netPPE ?? bs.netPropertyPlantAndEquipment)
  // Estimate total liabilities
  const totalLiab      = totalAssets != null && equity != null ? totalAssets - equity : null

  // Cash Flow
  const ocf   = n(cf.operatingCashFlow ?? cf.cashFlowFromContinuingOperatingActivities)
  const capex = n(cf.capitalExpenditure)
  const fcf   = n(cf.freeCashFlow)

  // Computed
  const netDebt = totalDebt != null && cash != null ? totalDebt - cash : null

  // Margins
  const grossMargin  = safe(gp,    rev, (a,b) => a/b)
  const ebitMargin   = safe(ebit,  rev, (a,b) => a/b)
  const ebitdaMargin = safe(ebitda,rev, (a,b) => a/b)
  const netMargin    = safe(ni,    rev, (a,b) => a/b)
  const sgaMargin    = safe(sga,   rev, (a,b) => a/b)
  const rndMargin    = safe(rnd,   rev, (a,b) => a/b)

  // Returns
  const roa  = safe(ni, totalAssets, (a,b) => a/b)
  const roe  = safe(ni, equity,      (a,b) => a/b)
  const ic   = equity != null && totalDebt != null ? equity + totalDebt : null
  const nopat = ebit != null && tax != null ? ebit * (1 - tax) : (ebit != null ? ebit * 0.79 : null)
  const roic = safe(nopat, ic, (a,b) => a/b)
  const ocfToRev = safe(ocf, rev, (a,b) => a/b)

  // Turnovers
  const assetTO = safe(rev, totalAssets, (a,b) => a/b)
  const recTO   = safe(rev, rec,         (a,b) => a/b)
  const invTO   = cogs != null && inv != null && inv !== 0 ? cogs / inv :
                  rev  != null && inv != null && inv !== 0 ? rev  / inv : null
  const ppeTO   = safe(rev, ppe, (a,b) => a/b)
  const dso     = recTO != null ? 365 / recTO : null
  const dio     = invTO != null ? 365 / Math.abs(invTO) : null
  // Fix P2: guard DPO against divide-by-zero when ap=0
  const dpo     = ap != null && ap !== 0 && (cogs ?? rev) != null ? 365 / (Math.abs(cogs ?? rev!) / ap) : null
  const ccc     = dso != null && dio != null && dpo != null ? dso + dio - dpo : null
  const currRatio = safe(currA, currL, (a,b) => a/b)
  const quickRatio = currL != null && currA != null && inv != null ? (currA - inv) / currL : null
  const ocfToCurrL = safe(ocf, currL, (a,b) => a/b)

  // Solvency
  const stDebt  = n(bs.currentDebt)   // Fix Sl1: short-term / current debt
  const debtToEq   = safe(totalDebt, equity, (a,b) => a/b)
  const ltDebtToEq = safe(ltDebt,    equity, (a,b) => a/b)
  const debtToCap  = (totalDebt != null && equity != null) ? totalDebt / (totalDebt + equity) : null
  const ltDebtToCap = (ltDebt != null && equity != null)   ? ltDebt   / (ltDebt   + equity) : null
  const liabToAssets = safe(totalLiab, totalAssets, (a,b) => a/b)
  // Fix Sl3: return null when EBITDA is negative — ratio is not meaningful
  const debtToEbitda    = (ebitda != null && ebitda > 0) ? safe(totalDebt, ebitda, (a,b) => a/b) : null
  const netDebtToEbitda = (ebitda != null && ebitda > 0) ? safe(netDebt,   ebitda, (a,b) => a/b) : null
  const ebitCov  = intEx != null && intEx !== 0 ? safe(ebit,  intEx, (a,b) => a/Math.abs(b)) : null
  const ebitdaCov = intEx != null && intEx !== 0 ? safe(ebitda, intEx, (a,b) => a/Math.abs(b)) : null
  // Fix Sl2: capex from Yahoo is already negative so ebitda+capex = ebitda−|capex| (correct)
  const ebitdaCapexCov = (ebitda != null && capex != null && intEx != null && intEx !== 0)
    ? (ebitda + capex) / Math.abs(intEx) : null
  // Fix Sl6: cash runway in months — only meaningful when OCF is negative (cash burn)
  const cashRunwayMonths = (cash != null && ocf != null && ocf < 0) ? cash / Math.abs(ocf / 12) : null

  return {
    rev, gp, ebit, ebitda, ni, eps, ocf, fcf, da, sga, rnd, cogs,
    grossMargin, ebitMargin, ebitdaMargin, netMargin, sgaMargin, rndMargin, ocfToRev,
    roa, roe, roic,
    assetTO, recTO, invTO, ppeTO, dso, dio, dpo, ccc, currRatio, quickRatio, ocfToCurrL,
    stDebt, debtToEq, ltDebtToEq, debtToCap, ltDebtToCap, liabToAssets,
    debtToEbitda, netDebtToEbitda, ebitCov, ebitdaCov, ebitdaCapexCov,
    totalDebt, ltDebt, cash, equity, netDebt, cashRunwayMonths,
  }
}

// ── Raw-dollar to millions transform (for existing components) ─────────────────

function toM(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) ? v / 1e6 : null
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FinancialsHub({ statementsData, financialsData, currency = '$', reportingCurrency, highlight, initialSubTab }: Props) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab ?? 'statements')
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'annual' | 'quarterly'>(() => {
    try { return (sessionStorage.getItem('fin_period') as 'annual' | 'quarterly') ?? 'annual' } catch { return 'annual' }
  })

  const handlePeriodChange = (p: 'annual' | 'quarterly') => {
    setAnalyticsPeriod(p)
    try { sessionStorage.setItem('fin_period', p) } catch {}
  }

  // When a navigation highlight arrives from Valuation Lab, switch to Statements sub-tab
  const highlightKey = highlight ? `${highlight.rowKey}:${highlight.statement}` : null
  useEffect(() => {
    if (highlightKey) setSubTab('statements')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightKey])

  // When initialSubTab changes (sidebar CTA clicked), jump to that sub-tab
  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab)
  }, [initialSubTab])

  const periods = useMemo(() => {
    if (analyticsPeriod === 'quarterly' && statementsData?.quarterly) {
      // Build quarterly periods for analytical tabs
      const { quarterly, ttm } = statementsData
      const isMap  = new Map<string, AnyRow>()
      const bsMap  = new Map<string, AnyRow>()
      const cfMap  = new Map<string, AnyRow>()
      const label = (r: AnyRow) => {
        const d = String(r.endDate ?? r.date ?? '')
        if (!d) return ''
        const dt = new Date(d)
        const m = dt.getUTCMonth()
        const yr = String(dt.getUTCFullYear()).slice(2)
        const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4'
        return `${q}'${yr}`
      }
      for (const r of quarterly.incomeStatement ?? []) { const k = label(r); if (k) isMap.set(k, r) }
      for (const r of quarterly.balanceSheet ?? [])    { const k = label(r); if (k) bsMap.set(k, r) }
      for (const r of quarterly.cashFlow ?? [])        { const k = label(r); if (k) cfMap.set(k, r) }
      const keys = Array.from(isMap.keys())
      // Sort chronologically: Q1'20, Q2'20 … Q4'24. Use a stable sort via the source array order
      const qPeriods: PeriodData[] = keys.map(k => ({
        year: k,
        is:   isMap.get(k) ?? {},
        bs:   bsMap.get(k) ?? {},
        cf:   cfMap.get(k) ?? {},
      }))
      if (ttm.incomeStatement || ttm.balanceSheet || ttm.cashFlow) {
        qPeriods.push({ year: 'TTM', is: ttm.incomeStatement ?? {}, bs: ttm.balanceSheet ?? {}, cf: ttm.cashFlow ?? {} })
      }
      return qPeriods.slice(-9) // last 8 quarters + TTM
    }
    return buildPeriods(statementsData)
  }, [statementsData, analyticsPeriod])
  const cols    = periods.map(p => p.year)
  const mets    = useMemo(() => periods.map(metrics), [periods])

  // ── Transform for existing Statements + Charts components ──────────────────

  const finIS = useMemo(() => {
    const annual = statementsData?.annual?.incomeStatement ?? []
    if (annual.length) {
      return annual
        .map((r: AnyRow) => ({
          year:            String(r.endDate ?? '').slice(0, 4),
          revenue:         toM(r.totalRevenue),
          costOfRevenue:   toM(r.costOfRevenue ?? r.reconciledCostOfRevenue),
          grossProfit:     toM(r.grossProfit),
          sgaExpense:      toM(r.sellingGeneralAndAdministration ?? r.generalAndAdministrativeExpense),
          rndExpense:      toM(r.researchAndDevelopment),
          ebitda:          toM(r.EBITDA),
          dna:             toM(r.reconciledDepreciation),
          operatingIncome: toM(r.operatingIncome ?? r.EBIT),
          interestExpense: toM(r.interestExpenseNonOperating ?? r.interestExpense),
          pretaxIncome:    toM(r.pretaxIncome),
          taxProvision:    toM(r.taxProvision),
          netIncome:       toM(r.netIncome),
          eps:             typeof r.dilutedEPS === 'number' ? r.dilutedEPS : null,
          isProjected:     false,
        }))
        .filter((r: { year: string }) => r.year.length === 4)
    }
    // fallback: map old shape to new shape with nulls for new fields
    return (financialsData?.financialStatements?.incomeStatement ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        ...r,
        costOfRevenue: null, sgaExpense: null, rndExpense: null,
        dna: null, interestExpense: null, pretaxIncome: null, taxProvision: null,
      })
    )
  }, [statementsData, financialsData])

  const finCF = useMemo(() => {
    const annual = statementsData?.annual?.cashFlow ?? []
    if (annual.length) {
      return annual
        .map((r: AnyRow) => ({
          year:           String(r.endDate ?? '').slice(0, 4),
          operatingCF:    toM(r.operatingCashFlow ?? r.cashFlowFromContinuingOperatingActivities),
          dna:            toM(r.depreciationAndAmortization ?? r.depreciationAmortizationDepletion),
          stockBasedComp: toM(r.stockBasedCompensation),
          changesInWC:    toM(r.changeInWorkingCapital),
          capex:          toM(r.capitalExpenditure ?? r.purchaseOfPPE),
          freeCashFlow:   toM(r.freeCashFlow),
          investingCF:    toM(r.investingCashFlow ?? r.cashFlowFromContinuingInvestingActivities),
          debtIssuance:   toM(r.issuanceOfDebt ?? r.longTermDebtIssuance),
          debtRepayment:  toM(r.repaymentOfDebt ?? r.longTermDebtPayments),
          buybacks:       toM(r.repurchaseOfCapitalStock ?? r.commonStockPayments),
          dividendsPaid:  toM(r.cashDividendsPaid ?? r.commonStockDividendPaid),
          financingCF:    toM(r.financingCashFlow ?? r.cashFlowFromContinuingFinancingActivities),
          isProjected:    false,
        }))
        .filter((r: { year: string }) => r.year.length === 4)
    }
    // fallback
    return (financialsData?.financialStatements?.cashFlow ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        ...r,
        dna: null, stockBasedComp: null, changesInWC: null,
        debtIssuance: null, debtRepayment: null, buybacks: null,
      })
    )
  }, [statementsData, financialsData])

  // Fix G5: analyst consensus EPS growth estimates from cagrAnalysis
  const analystEst1y = (financialsData?.cagrAnalysis?.analystEstimate1y ?? null) as number | null
  const analystEst2y = (financialsData?.cagrAnalysis?.analystEstimate2y ?? null) as number | null

  // ── Growth data ────────────────────────────────────────────────────────────

  const isFinancialSector = ['Financial Services', 'Financials', 'Banks', 'Insurance', 'Financial'].some(
    s => (financialsData?.quote?.sector ?? '').includes(s) || (financialsData?.businessProfile?.sector ?? '').includes(s)
  )

  const yoy = (curr: number | null, prev: number | null): number | null => {
    if (curr == null || prev == null || prev === 0) return null
    const r = (curr - prev) / Math.abs(prev)
    return isFinite(r) ? r : null
  }

  const growthRows = useMemo((): MetricRowDef[] => {
    const revs    = mets.map(m => m.rev)
    const gps     = mets.map(m => m.gp)
    const ebits   = mets.map(m => m.ebit)
    const ebitdas = mets.map(m => m.ebitda)
    const nis     = mets.map(m => m.ni)
    const epss    = mets.map(m => m.eps)
    const fcfs    = mets.map(m => m.fcf)

    const yoyArr = (arr: (number | null)[]) => arr.map((v, i) => i === 0 ? null : yoy(v, arr[i - 1]))

    return [
      { label: 'Revenue',           fmt: 'growth', positiveIsGood: true, values: yoyArr(revs) },
      { label: 'Gross Profit',      fmt: 'growth', positiveIsGood: true, values: yoyArr(gps) },
      ...(!isFinancialSector ? [{ label: 'EBITDA', fmt: 'growth' as const, positiveIsGood: true, values: yoyArr(ebitdas) }] : []),
      { label: 'EBIT / Op. Income', fmt: 'growth', positiveIsGood: true, values: yoyArr(ebits) },
      { label: 'Net Income',        fmt: 'growth', positiveIsGood: true, values: yoyArr(nis) },
      { label: 'EPS (Diluted)',     fmt: 'growth', positiveIsGood: true, values: yoyArr(epss) },
      { label: 'Free Cash Flow',    fmt: 'growth', positiveIsGood: true, values: yoyArr(fcfs) },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mets, isFinancialSector])

  // Skip oldest period in YoY table (always "—" since no prior year to compare to)
  const yoyCols = cols.length > 1 ? cols.slice(1) : cols
  const yoyRows = growthRows.map(r => ({ ...r, values: r.values.slice(1) }))

  // ── Profitability data ─────────────────────────────────────────────────────

  const profitRows = useMemo((): MetricRowDef[] => {
    const v = (fn: (m: ReturnType<typeof metrics>) => number | null) => mets.map(fn)
    return [
      { label: 'Margins', isHeader: true, fmt: 'pct', values: [] },
      { label: 'Gross Margin',           fmt: 'pct', positiveIsGood: true,  values: v(m => m.grossMargin)  },
      { label: 'EBITDA Margin',          fmt: 'pct', positiveIsGood: true,  values: v(m => m.ebitdaMargin) },
      { label: 'EBIT Margin',            fmt: 'pct', positiveIsGood: true,  values: v(m => m.ebitMargin)   },
      { label: 'Net Margin',             fmt: 'pct', positiveIsGood: true,  values: v(m => m.netMargin)    },
      { label: 'SG&A / Revenue',         fmt: 'pct', positiveIsGood: false, values: v(m => m.sgaMargin)    },
      { label: 'R&D / Revenue',          fmt: 'pct', positiveIsGood: true,  values: v(m => m.rndMargin)    },
      { label: 'Op. CF Margin',          fmt: 'pct', positiveIsGood: true,  values: v(m => m.ocfToRev), tooltip: 'Operating Cash Flow ÷ Revenue. Measures cash generation before investing/financing activities.'  },

      { label: 'Returns', isHeader: true, fmt: 'pct', values: [] },
      { label: 'Return on Assets (ROA)',   fmt: 'pct', positiveIsGood: true, values: v(m => m.roa)  },
      { label: 'Return on Equity (ROE)',   fmt: 'pct', positiveIsGood: true, values: v(m => m.roe)  },
      { label: 'Return on Inv. Capital',   fmt: 'pct', positiveIsGood: true, values: v(m => m.roic) },
    ]
  }, [mets])

  // ── Solvency data ──────────────────────────────────────────────────────────

  const solvencyRows = useMemo((): MetricRowDef[] => {
    const v = (fn: (m: ReturnType<typeof metrics>) => number | null) => mets.map(fn)
    return [
      { label: 'Leverage', isHeader: true, fmt: 'x', values: [] },
      { label: 'Total Debt / Equity',     fmt: 'x',   positiveIsGood: false, values: v(m => m.debtToEq),     tooltip: 'Total Debt (ST + LT) ÷ Shareholders Equity. Higher = more leveraged.' },
      { label: 'LT Debt / Equity',        fmt: 'x',   positiveIsGood: false, values: v(m => m.ltDebtToEq),   tooltip: 'Long-Term Debt only ÷ Shareholders Equity.' },
      { label: 'Short-Term Debt',         fmt: '$M',  positiveIsGood: false, values: v(m => m.stDebt != null ? m.stDebt / 1e6 : null), tooltip: 'Current portion of debt due within 12 months.' },
      { label: 'Total Debt / Capital',    fmt: 'pct', positiveIsGood: false, values: v(m => m.debtToCap),     tooltip: 'Total Debt ÷ (Total Debt + Equity). Proportion of capital financed by debt.' },
      { label: 'LT Debt / Capital',       fmt: 'pct', positiveIsGood: false, values: v(m => m.ltDebtToCap),   tooltip: 'Long-Term Debt ÷ (Total Debt + Equity).' },
      { label: 'Total Liab. / Assets',    fmt: 'pct', positiveIsGood: false, values: v(m => m.liabToAssets),  tooltip: 'Total Liabilities ÷ Total Assets. Includes operating liabilities (deferred revenue, etc.) — not purely financial debt.' },

      { label: 'Interest Coverage', isHeader: true, fmt: 'x', values: [] },
      { label: 'EBIT / Interest',             fmt: 'x', positiveIsGood: true, values: v(m => m.ebitCov),        tooltip: 'EBIT ÷ Interest Expense. Times interest can be paid from operating profit. <1.5x is distress territory.' },
      { label: 'EBITDA / Interest',           fmt: 'x', positiveIsGood: true, values: v(m => m.ebitdaCov),      tooltip: 'EBITDA ÷ Interest Expense. Cash-based coverage before capex.' },
      { label: '(EBITDA − Capex) / Interest', fmt: 'x', positiveIsGood: true, values: v(m => m.ebitdaCapexCov), tooltip: '(EBITDA − Capital Expenditures) ÷ Interest. Most conservative coverage — capex is negative in source data so formula is EBITDA + capex.' },

      { label: 'Debt Capacity', isHeader: true, fmt: 'x', values: [] },
      { label: 'Total Debt / EBITDA',     fmt: 'x', positiveIsGood: false, values: v(m => m.debtToEbitda),    tooltip: 'Total Debt ÷ EBITDA. Years of EBITDA needed to repay debt. Shown "—" when EBITDA ≤ 0.' },
      { label: 'Net Debt / EBITDA',       fmt: 'x', positiveIsGood: false, values: v(m => m.netDebtToEbitda), tooltip: 'Net Debt (Total Debt − Cash) ÷ EBITDA. Negative = net cash position. Shown "—" when EBITDA ≤ 0.' },
      { label: 'Cash Runway (months)',    fmt: 'x', positiveIsGood: true,  values: v(m => m.cashRunwayMonths), tooltip: 'Cash ÷ |Monthly Cash Burn|. Only shown when Operating Cash Flow is negative — indicates months of runway before cash runs out.' },

      { label: 'Asset Efficiency', isHeader: true, fmt: 'x', values: [] },
      { label: 'Asset Turnover',        fmt: 'x', positiveIsGood: true, values: v(m => m.assetTO), tooltip: 'Revenue ÷ Total Assets. How many dollars of revenue generated per dollar of assets.' },
      { label: 'Receivables Turnover',  fmt: 'x', positiveIsGood: true, values: v(m => m.recTO),   tooltip: 'Revenue ÷ Receivables. Higher = faster collection of customer payments.' },
      { label: 'Inventory Turnover',    fmt: 'x', positiveIsGood: true, values: v(m => m.invTO),   tooltip: 'COGS ÷ Inventory. Higher = inventory sells faster (less capital tied up).' },
      { label: 'Fixed Asset Turnover',  fmt: 'x', positiveIsGood: true, values: v(m => m.ppeTO),   tooltip: 'Revenue ÷ Net PP&E. Measures efficiency of physical asset usage.' },

      { label: 'Liquidity', isHeader: true, fmt: 'x', values: [] },
      { label: 'Current Ratio',         fmt: 'x',    positiveIsGood: true,  values: v(m => m.currRatio),  tooltip: 'Current Assets ÷ Current Liabilities. >1 means short-term assets cover short-term debts.' },
      { label: 'Quick Ratio',           fmt: 'x',    positiveIsGood: true,  values: v(m => m.quickRatio), tooltip: '(Current Assets − Inventory) ÷ Current Liabilities. Stricter liquidity test. Shows "—" when inventory data is unavailable.' },
      { label: 'Days Sales Outstanding',fmt: 'days', positiveIsGood: false, values: v(m => m.dso),        tooltip: '365 ÷ Receivables Turnover. Average days to collect a customer payment.' },
      { label: 'Days Inventory Outstanding', fmt: 'days', positiveIsGood: false, values: v(m => m.dio),   tooltip: '365 ÷ Inventory Turnover. Average days to sell through inventory.' },
      { label: 'Days Payable Outstanding',   fmt: 'days', positiveIsGood: true,  values: v(m => m.dpo),   tooltip: '365 ÷ (COGS ÷ Payables). Average days to pay suppliers. Higher = better use of supplier credit.' },
      { label: 'Cash Conversion Cycle', fmt: 'days', positiveIsGood: false, values: v(m => m.ccc),        tooltip: 'DSO + DIO − DPO. Days of working capital tied up in operations. Lower or negative = healthier cash cycle.' },
      { label: 'Op. CF / Current Liab.',fmt: 'x',    positiveIsGood: true,  values: v(m => m.ocfToCurrL), tooltip: 'Operating Cash Flow ÷ Current Liabilities. Ability to service near-term obligations from operations.' },
    ]
  }, [mets])

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasData = periods.length > 0

  const showCharts = (subTab === 'growth' || subTab === 'profitability') && hasData
    && finCF.length > 0
    && finIS.filter((r: { isProjected: boolean }) => !r.isProjected).length >= 2

  return (
    <>
    <div className="rounded-xl card">
      {/* Sub-tab nav — scrollable on mobile */}
      <div className="flex items-center justify-between px-2 sm:px-5 pt-4 pb-0 border-b border-slate-100 overflow-x-auto scrollbar-none">
        <div role="tablist" className="flex gap-0 min-w-max">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={subTab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setSubTab(id)}
              className={`px-3 sm:px-4 py-3 min-h-[44px] text-[12px] sm:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                subTab === id
                  ? 'border-olive-700 text-olive-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Annual / Quarterly toggle — only for analytical sub-tabs */}
        {['growth', 'profitability', 'solvency'].includes(subTab) && (
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] shrink-0 ml-3">
            <button
              onClick={() => handlePeriodChange('annual')}
              className={`px-2.5 py-1.5 transition-colors ${analyticsPeriod === 'annual' ? 'bg-olive-50 text-olive-700 font-semibold' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Annual
            </button>
            <button
              onClick={() => handlePeriodChange('quarterly')}
              className={`px-2.5 py-1.5 border-l border-slate-200 transition-colors ${analyticsPeriod === 'quarterly' ? 'bg-olive-50 text-olive-700 font-semibold' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Quarterly
            </button>
          </div>
        )}
      </div>

      {/* Per-tab context strip */}
      <div className="px-4 sm:px-5 py-2 border-b border-slate-100 bg-slate-50/60">
        <p className="text-[12px] text-slate-500 leading-snug">{TAB_ANCHORS[subTab]}</p>
      </div>

      {!hasData && (
        <div className="py-12 text-center text-sm text-slate-400">
          Financial data unavailable
        </div>
      )}

      {/* ── Statements ── */}
      {subTab === 'statements' && hasData && (
        <YahooFinancials
          statementsData={statementsData}
          currency={currency}
          reportingCurrency={reportingCurrency}
          highlight={highlight ?? undefined}
        />
      )}

      {/* ── Growth ── */}
      {subTab === 'growth' && hasData && (() => {
        const annualMets = mets.filter((_, i) => periods[i]?.year !== 'TTM')
        const revVals = annualMets.map(m => m.rev)

        // Growth rating
        const recentCAGR = cagrN(revVals, 3)
        const priorCAGR = revVals.length >= 6 ? cagrN(revVals.slice(0, revVals.length - 3), 3) : null
        let ratingLabel = ''
        let ratingColor = ''
        if (recentCAGR != null) {
          if (recentCAGR > 0.20)      { ratingLabel = 'Strong Growth';   ratingColor = 'bg-emerald-50 border-emerald-200 text-emerald-700' }
          else if (recentCAGR > 0.10) { ratingLabel = 'Solid Growth';    ratingColor = 'bg-blue-50 border-blue-200 text-blue-700' }
          else if (recentCAGR > 0.05) { ratingLabel = 'Moderate Growth'; ratingColor = 'bg-amber-50 border-amber-200 text-amber-700' }
          else if (recentCAGR > 0)    { ratingLabel = 'Slow Growth';     ratingColor = 'bg-slate-100 border-slate-200 text-slate-600' }
          else                         { ratingLabel = 'Declining';       ratingColor = 'bg-red-50 border-red-200 text-red-600' }
          if (priorCAGR != null && Math.abs(recentCAGR - priorCAGR) > 0.05) {
            ratingLabel += recentCAGR > priorCAGR ? ' · Accelerating' : ' · Decelerating'
          }
        }

        const rev5y = cagrN(revVals, 5)
        const epsVals = annualMets.map(m => m.eps)
        const eps3y = cagrN(epsVals, 3)
        const eps5y = cagrN(epsVals, 5)

        type CagrItem = { label: string; value: string; color: string }
        const cagrItems: CagrItem[] = []
        const cagrColor = (v: number | null) =>
          v == null ? 'text-slate-400' : v >= 0.15 ? 'text-emerald-600' : v >= 0.05 ? 'text-blue-600' : v >= 0 ? 'text-slate-700' : 'text-red-500'
        const cagrFmt = (v: number | null) =>
          v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

        if (recentCAGR != null) cagrItems.push({ label: 'Rev 3Y CAGR', value: cagrFmt(recentCAGR), color: cagrColor(recentCAGR) })
        if (rev5y != null)      cagrItems.push({ label: 'Rev 5Y CAGR', value: cagrFmt(rev5y),      color: cagrColor(rev5y) })
        if (eps3y != null)      cagrItems.push({ label: 'EPS 3Y CAGR', value: cagrFmt(eps3y),      color: cagrColor(eps3y) })
        if (eps5y != null)      cagrItems.push({ label: 'EPS 5Y CAGR', value: cagrFmt(eps5y),      color: cagrColor(eps5y) })
        if (analystEst1y != null) cagrItems.push({ label: 'Analyst Est (1Y)', value: cagrFmt(analystEst1y), color: cagrColor(analystEst1y) })
        if (analystEst2y != null) cagrItems.push({ label: 'Analyst Est (2Y)', value: cagrFmt(analystEst2y), color: cagrColor(analystEst2y) })

        return (
          <div>
            {ratingLabel && (
              <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center gap-2 flex-wrap">
                <span className={`text-[12px] font-semibold px-3 py-1 rounded-full border ${ratingColor}`}>
                  {ratingLabel}
                </span>
              </div>
            )}

            {/* CAGR Summary grid */}
            {cagrItems.length > 0 && (
              <div className="px-4 sm:px-5 pb-3">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-slate-100">
                    {cagrItems.map((item) => (
                      <div key={item.label} className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5 truncate">{item.label}</p>
                        <p className={`text-[15px] font-bold tabular-nums leading-tight ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 sm:px-5 pt-2 pb-4">
              <MetricsTable columns={yoyCols} rows={yoyRows} />
            </div>

            {/* Share count trend */}
            {(() => {
              const annual = statementsData?.annual?.incomeStatement ?? []
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sharePoints: Array<{ year: string; sharesM: number }> = (annual as any[])
                .filter((r: any) => !r.isProjected && r.netIncome != null && r.eps != null && Math.abs(r.eps) > 0.001)
                .map((r: any) => ({
                  year: String(r.year ?? r.endDate ?? '').slice(0, 4),
                  sharesM: Math.abs((r.netIncome as number) / (r.eps as number)), // netIncome($M) / eps($/share) = shares(M)
                }))
                .filter(p => p.sharesM > 0 && p.sharesM < 1e7) // sanity: <10T shares
                .slice(-6)

              if (sharePoints.length < 2) return null
              const maxShares = Math.max(...sharePoints.map(p => p.sharesM))
              const firstVal = sharePoints[0].sharesM
              const lastVal  = sharePoints[sharePoints.length - 1].sharesM
              const totalChg = (lastVal - firstVal) / firstVal
              const isReducing = totalChg < -0.01
              const isGrowing  = totalChg > 0.01

              return (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-slate-700">Shares Outstanding Trend</p>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      isReducing ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      isGrowing  ? 'bg-red-50 border-red-200 text-red-600' :
                      'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      {isReducing ? `Buybacks: ${(totalChg * 100).toFixed(1)}%` :
                       isGrowing  ? `Dilution: +${(totalChg * 100).toFixed(1)}%` : 'Stable'}
                    </span>
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {sharePoints.map((p, i) => {
                      const hp = maxShares > 0 ? Math.max(10, (p.sharesM / maxShares) * 100) : 10
                      const prev = sharePoints[i - 1]?.sharesM ?? null
                      const yoy = prev != null && prev > 0 ? (p.sharesM - prev) / prev : null
                      const isUp = yoy != null && yoy > 0.001
                      const isDn = yoy != null && yoy < -0.001
                      const fmtShares = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'B' : v.toFixed(0) + 'M'
                      return (
                        <div key={p.year} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                          {yoy != null && (
                            <span className={`text-[10px] font-semibold leading-none ${isUp ? 'text-red-500' : isDn ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isUp ? '+' : isDn ? '' : ''}{(yoy * 100).toFixed(1)}%
                            </span>
                          )}
                          <div className="relative w-full" style={{ height: `${hp}%` }}>
                            <div className={`w-full h-full rounded-t-sm ${isUp ? 'bg-red-300' : isDn ? 'bg-emerald-400' : 'bg-slate-300'}`}
                              title={`${p.year}: ${fmtShares(p.sharesM)}`} />
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-full">{p.year}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />Decreasing (buybacks)</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-red-300 inline-block" />Increasing (dilution)</span>
                  </div>
                </div>
              )
            })()}

            {/* EPS (Diluted) trend */}
            {(() => {
              const epsPoints = mets
                .map((m, i) => ({ year: periods[i]?.year, eps: m.eps }))
                .filter(p => p.year && p.year !== 'TTM' && p.eps != null && isFinite(p.eps!))
                .slice(-6)
              if (epsPoints.length < 2) return null
              const maxAbsEps = Math.max(...epsPoints.map(p => Math.abs(p.eps!)), 0.01)
              const latestEps = epsPoints[epsPoints.length - 1]
              const prevEps   = epsPoints[epsPoints.length - 2]
              const epsGrowth = prevEps?.eps != null && Math.abs(prevEps.eps) > 0.001
                ? (latestEps.eps! - prevEps.eps) / Math.abs(prevEps.eps)
                : null
              return (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-slate-700">EPS (Diluted) Trend</p>
                    <div className="flex items-center gap-2">
                      {latestEps.eps != null && (
                        <span className={`text-[11px] font-semibold tabular-nums ${latestEps.eps >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                          {latestEps.eps >= 0 ? '+' : ''}${latestEps.eps.toFixed(2)}
                        </span>
                      )}
                      {epsGrowth != null && (
                        <span className={`text-[11px] font-semibold tabular-nums ${epsGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {epsGrowth >= 0 ? '+' : ''}{(epsGrowth * 100).toFixed(0)}% YoY
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {epsPoints.map((p, i) => {
                      const val = p.eps!
                      const isPos = val >= 0
                      const hp = Math.max(6, (Math.abs(val) / maxAbsEps) * 100)
                      const prev = epsPoints[i - 1]?.eps ?? null
                      const yoy = prev != null && Math.abs(prev) > 0.001 ? (val - prev) / Math.abs(prev) : null
                      return (
                        <div key={p.year} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                          {yoy != null && (
                            <span className={`text-[10px] font-semibold leading-none ${yoy >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {yoy >= 0 ? '+' : ''}{(yoy * 100).toFixed(0)}%
                            </span>
                          )}
                          <div className="relative w-full" style={{ height: `${hp}%` }}>
                            <div className={`w-full h-full rounded-t-sm ${isPos ? 'bg-emerald-500' : 'bg-red-400'}`}
                              title={`${p.year}: EPS ${isPos ? '+' : ''}$${val.toFixed(2)}`} />
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-full">{p.year}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── Profitability ── */}
      {subTab === 'profitability' && hasData && (() => {
        return (
          <div>
            <div className="px-4 sm:px-5 pt-4 pb-4">
              <MetricsTable columns={cols} rows={profitRows} />
            </div>

            {/* ROIC vs WACC trend */}
            {(() => {
              const wacc: number | null = financialsData?.wacc?.wacc ?? null
              const annualMets = mets.filter((_, i) => periods[i]?.year !== 'TTM' && !(periods[i] as any)?.isProjected)
              const roicPoints = annualMets
                .map((m, i) => ({ year: periods[i]?.year, roic: m.roic }))
                .filter(p => p.year && p.roic != null && isFinite(p.roic!) && Math.abs(p.roic!) < 5)
                .slice(-6)

              if (roicPoints.length < 2) return null
              const allVals = [...roicPoints.map(p => p.roic!), wacc ?? 0].filter(v => isFinite(v))
              const maxAbs = Math.max(...allVals.map(Math.abs), 0.01)
              const latestRoic = roicPoints[roicPoints.length - 1].roic!
              const spread = wacc != null ? latestRoic - wacc : null
              const creatingValue = spread != null && spread > 0

              return (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-slate-700">ROIC vs WACC</p>
                    {spread != null && (
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${creatingValue ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                        {creatingValue ? 'Creating value' : 'Destroying value'} ({spread >= 0 ? '+' : ''}{(spread * 100).toFixed(1)}% spread)
                      </span>
                    )}
                  </div>

                  {/* Chart area — bars with zero-baseline in middle */}
                  <div className="relative">
                    {/* WACC reference line */}
                    {wacc != null && (
                      <div
                        className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
                        style={{ bottom: `${((wacc / maxAbs) * 50 + 50).toFixed(1)}%`, transform: 'translateY(50%)' }}
                      >
                        <div className="flex-1 border-t-2 border-dashed border-amber-400" />
                        <span className="text-[10px] font-bold text-amber-600 bg-white px-1 shrink-0">
                          WACC {(wacc * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 h-28">
                      {roicPoints.map((p) => {
                        const val = p.roic!
                        const aboveWacc = wacc == null || val >= wacc
                        // Normalize: center at 0, max bar height = 50% above or below midpoint
                        const pct = (val / maxAbs) * 50 // -50 to +50, mapped as % from center
                        const barH = Math.abs(pct)
                        const barBottom = val >= 0 ? 50 : 50 - barH // % from bottom of container
                        return (
                          <div key={p.year} className="relative flex-1 min-w-0 h-full">
                            {/* Bar */}
                            <div
                              className={`absolute left-1 right-1 rounded-sm transition-colors ${aboveWacc ? 'bg-emerald-400' : 'bg-red-300'}`}
                              style={{
                                bottom: `${barBottom}%`,
                                height: `${Math.max(2, barH)}%`,
                              }}
                              title={`${p.year}: ROIC ${(val * 100).toFixed(1)}%${wacc != null ? `, WACC ${(wacc * 100).toFixed(1)}%` : ''}`}
                            />
                            {/* Value label above bar */}
                            <span
                              className={`absolute text-[10px] font-semibold left-0 right-0 text-center leading-none ${aboveWacc ? 'text-emerald-600' : 'text-red-500'}`}
                              style={{ bottom: `${barBottom + barH + 1}%` }}
                            >
                              {(val * 100).toFixed(0)}%
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {/* X-axis labels (fixed margin below bars) */}
                    <div className="flex gap-1.5 mt-4">
                      {roicPoints.map((p) => (
                        <div key={p.year} className="flex-1 text-center text-[10px] text-slate-400">{p.year}</div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />ROIC above WACC</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-red-300 inline-block" />ROIC below WACC</span>
                    {wacc != null && <span className="flex items-center gap-1 text-[10px] text-amber-500"><span className="w-5 border-t-2 border-dashed border-amber-400 inline-block" />WACC</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                    ROIC above WACC = company creates value for shareholders. Below WACC = capital is being destroyed even if profits appear positive.
                  </p>
                </div>
              )
            })()}

            {/* FCF trend */}
            {(() => {
              const annualFCF = mets
                .map((m, i) => ({ year: periods[i]?.year, fcf: m.fcf, rev: m.rev }))
                .filter(p => p.year && p.year !== 'TTM' && p.fcf != null && p.rev != null && p.rev! > 0)
                .slice(-6)
              if (annualFCF.length < 2) return null
              const maxAbsFcf = Math.max(...annualFCF.map(p => Math.abs(p.fcf!)), 0.01)
              const latestFcfMargin = annualFCF[annualFCF.length - 1]
              const fcfM = latestFcfMargin.fcf != null && latestFcfMargin.rev != null && latestFcfMargin.rev > 0
                ? latestFcfMargin.fcf / latestFcfMargin.rev : null
              const fmtM = (v: number) => {
                const abs = Math.abs(v)
                return (v < 0 ? '-' : '') + (abs >= 1e3 ? (abs / 1e3).toFixed(1) + 'B' : abs.toFixed(0) + 'M')
              }
              return (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-slate-700">Free Cash Flow Trend</p>
                    {fcfM != null && (
                      <span className={`text-[11px] font-semibold tabular-nums ${fcfM > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        FCF margin: {(fcfM * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {annualFCF.map((p) => {
                      const val = p.fcf!
                      const isPositive = val >= 0
                      const hp = Math.max(6, (Math.abs(val) / maxAbsFcf) * 100)
                      const prev = annualFCF[annualFCF.indexOf(p) - 1]?.fcf ?? null
                      const yoy = prev != null && Math.abs(prev) > 0 ? (val - prev) / Math.abs(prev) : null
                      return (
                        <div key={p.year} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                          {yoy != null && (
                            <span className={`text-[10px] font-semibold leading-none ${yoy >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {yoy >= 0 ? '+' : ''}{(yoy * 100).toFixed(0)}%
                            </span>
                          )}
                          <div className="relative w-full" style={{ height: `${hp}%` }}>
                            <div className={`w-full h-full rounded-t-sm ${isPositive ? 'bg-[#059669]' : 'bg-red-300'}`}
                              title={`${p.year}: FCF ${fmtM(val)}`} />
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-full">{p.year}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#059669] inline-block" />Positive FCF</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-red-300 inline-block" />Negative FCF (cash burn)</span>
                  </div>
                </div>
              )
            })()}

            {/* Margin trend */}
            {(() => {
              const annualMargins = mets
                .map((m, i) => ({
                  year:       periods[i]?.year,
                  grossM:     m.grossMargin,
                  opM:        m.ebitMargin,
                  netM:       m.netMargin,
                }))
                .filter(p => p.year && p.year !== 'TTM' && !(p as any).isProjected && p.grossM != null)
                .slice(-6)
              if (annualMargins.length < 2) return null
              // Scale bars relative to highest gross margin observed (always the largest)
              const maxM = Math.max(...annualMargins.map(p => p.grossM!), 0.01)
              const latestM = annualMargins[annualMargins.length - 1]
              return (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-slate-700">Margin Trend</p>
                    <div className="flex items-center gap-2.5 text-[10px] tabular-nums flex-wrap">
                      {latestM.grossM != null && (
                        <span className="text-slate-500">Gross <span className="font-semibold text-blue-600">{(latestM.grossM * 100).toFixed(1)}%</span></span>
                      )}
                      {latestM.opM != null && (
                        <span className="text-slate-500">Op. <span className="font-semibold text-violet-600">{(latestM.opM * 100).toFixed(1)}%</span></span>
                      )}
                      {latestM.netM != null && (
                        <span className="text-slate-500">Net <span className={`font-semibold ${latestM.netM >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(latestM.netM * 100).toFixed(1)}%</span></span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {annualMargins.map((p) => (
                      <div key={p.year} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                        <div className="w-full flex gap-0.5 items-end h-full">
                          {/* Gross margin */}
                          <div
                            className="flex-1 min-w-0 bg-[#2563EB] rounded-t-sm"
                            style={{ height: `${Math.max(2, (p.grossM! / maxM) * 100)}%` }}
                            title={`${p.year} Gross Margin: ${(p.grossM! * 100).toFixed(1)}%`}
                          />
                          {/* Operating margin */}
                          {p.opM != null ? (
                            <div
                              className="flex-1 min-w-0 bg-violet-400 rounded-t-sm"
                              style={{ height: `${Math.max(2, (Math.max(0, p.opM) / maxM) * 100)}%` }}
                              title={`${p.year} Op. Margin: ${(p.opM * 100).toFixed(1)}%`}
                            />
                          ) : <div className="flex-1" />}
                          {/* Net margin */}
                          {p.netM != null ? (
                            <div
                              className={`flex-1 min-w-0 rounded-t-sm ${p.netM >= 0 ? 'bg-emerald-400' : 'bg-red-300'}`}
                              style={{ height: `${Math.max(2, (Math.abs(p.netM) / maxM) * 100)}%` }}
                              title={`${p.year} Net Margin: ${(p.netM * 100).toFixed(1)}%`}
                            />
                          ) : <div className="flex-1" />}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate max-w-full">{p.year}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#2563EB] inline-block" />Gross</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-violet-400 inline-block" />Operating</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />Net</span>
                  </div>
                </div>
              )
            })()}

            {/* OCF vs FCF — cash conversion efficiency */}
            {(() => {
              const ocfPoints = mets
                .map((m, i) => ({ year: periods[i]?.year, ocf: m.ocf, fcf: m.fcf }))
                .filter(p => p.year && p.year !== 'TTM' && !(p as any).isProjected && p.ocf != null && p.ocf! > 0 && p.fcf != null)
                .slice(-6)
              if (ocfPoints.length < 2) return null
              const maxOCF = Math.max(...ocfPoints.map(p => p.ocf!), 0.01)
              const latestConversion = (() => {
                const p = ocfPoints[ocfPoints.length - 1]
                if (p.ocf == null || p.ocf <= 0 || p.fcf == null) return null
                return p.fcf / p.ocf
              })()
              return (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-slate-700">Cash Generation</p>
                    {latestConversion != null && (
                      <span className={`text-[11px] font-semibold tabular-nums ${latestConversion >= 0.7 ? 'text-emerald-600' : latestConversion >= 0.4 ? 'text-amber-600' : 'text-red-500'}`}>
                        FCF conversion: {(latestConversion * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {ocfPoints.map((p) => {
                      const ocfH  = Math.max(4, (p.ocf! / maxOCF) * 100)
                      const fcfH  = p.fcf != null ? Math.max(2, (Math.abs(p.fcf) / maxOCF) * 100) : null
                      const fcfPos = p.fcf != null && p.fcf >= 0
                      return (
                        <div key={p.year} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                          <div className="w-full flex gap-0.5 items-end h-full">
                            <div
                              className="flex-[2] min-w-0 bg-[#059669] rounded-t-sm"
                              style={{ height: `${ocfH}%` }}
                              title={`${p.year} Operating CF: ${currency}${p.ocf!.toFixed(0)}M`}
                            />
                            {fcfH != null ? (
                              <div
                                className={`flex-1 min-w-0 rounded-t-sm ${fcfPos ? 'bg-emerald-500' : 'bg-red-400'}`}
                                style={{ height: `${fcfH}%` }}
                                title={`${p.year} Free CF: ${currency}${p.fcf!.toFixed(0)}M`}
                              />
                            ) : <div className="flex-1" />}
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-full">{p.year}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#059669] inline-block" />Operating CF</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Free CF</span>
                    <span className="text-[10px] text-slate-400">Both scaled to max OCF. FCF conversion = FCF/OCF</span>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── Solvency ── */}
      {subTab === 'solvency' && hasData && (() => {
        // Use most recent period (TTM if available, else latest annual)
        const latestMet = mets[mets.length - 1]
        const nd = latestMet?.netDebtToEbitda ?? null
        const cov = latestMet?.ebitCov ?? null

        // Solvency rating
        let ratingLabel = ''
        let ratingColor = ''
        if (nd != null || cov != null) {
          const ndVal = nd ?? Infinity
          const covVal = cov ?? 0
          if (ndVal < 0)                            { ratingLabel = 'Fortress Balance Sheet'; ratingColor = 'bg-emerald-50 border-emerald-200 text-emerald-700' }
          else if (ndVal < 1 && covVal > 8)         { ratingLabel = 'Very Strong';            ratingColor = 'bg-emerald-50 border-emerald-200 text-emerald-700' }
          else if (ndVal < 2 && covVal > 5)         { ratingLabel = 'Strong';                 ratingColor = 'bg-emerald-50 border-emerald-200 text-emerald-700' }
          else if (ndVal < 3 && covVal > 3)         { ratingLabel = 'Investment Grade';       ratingColor = 'bg-blue-50 border-blue-200 text-blue-700' }
          else if (ndVal <= 5 && covVal >= 1.5)     { ratingLabel = 'Moderate Leverage';      ratingColor = 'bg-amber-50 border-amber-200 text-amber-700' }
          else if (ndVal > 7 || covVal < 1)         { ratingLabel = 'Distressed';             ratingColor = 'bg-red-50 border-red-200 text-red-700' }
          else                                       { ratingLabel = 'High Leverage';          ratingColor = 'bg-red-50 border-red-200 text-red-600' }
        }

        return (
          <div>
            {/* Rating chip */}
            {ratingLabel && (
              <div className="px-4 sm:px-5 pt-4 pb-0 flex items-center gap-2 flex-wrap">
                <span className={`text-[12px] font-semibold px-3 py-1 rounded-full border ${ratingColor}`}>
                  {ratingLabel}
                </span>
              </div>
            )}

            {/* Key Solvency Metrics grid */}
            {(() => {
              const latest = mets[mets.length - 1]
              type SolvItem = { label: string; value: string; color: string }
              const items: SolvItem[] = []
              const xFmt = (v: number | null, inv?: boolean) => {
                if (v == null) return null
                const good = inv ? v < 0 : v >= 0
                void good
                return v.toFixed(1) + '×'
              }
              const addNum = (label: string, v: number | null, thresholds: [number, number], higherIsBetter: boolean) => {
                if (v == null) return
                const color = higherIsBetter
                  ? (v >= thresholds[0] ? 'text-emerald-600' : v >= thresholds[1] ? 'text-blue-600' : 'text-red-500')
                  : (v <= thresholds[0] ? 'text-emerald-600' : v <= thresholds[1] ? 'text-amber-600' : 'text-red-500')
                items.push({ label, value: xFmt(v) ?? '—', color })
              }
              if (latest) {
                addNum('Net Debt/EBITDA', latest.netDebtToEbitda, [-0.01, 3], false)
                addNum('Interest Cov.',   latest.ebitCov,         [5, 3],     true)
                addNum('Current Ratio',   latest.currRatio,        [2, 1],     true)
                addNum('Quick Ratio',     latest.quickRatio,       [1.5, 1],   true)
                addNum('Debt/Equity',     latest.debtToEq,         [0.5, 1.5], false)
              }
              if (items.length === 0) return null
              const cols = items.length <= 3 ? `grid-cols-${items.length}` : items.length <= 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'
              return (
                <div className="px-4 sm:px-5 pt-3 pb-2">
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className={`grid ${cols} divide-x divide-slate-100`}>
                      {items.map((item) => (
                        <div key={item.label} className="px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5 truncate">{item.label}</p>
                          <p className={`text-[15px] font-bold tabular-nums leading-tight ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="border-t border-slate-100 px-4 sm:px-5 pt-4 pb-4">
              <MetricsTable columns={cols} rows={solvencyRows} />
              <p className="text-[10px] text-slate-400 mt-2 px-1">
                Net Debt = Total Debt − Cash &amp; Equivalents. Negative Net Debt means net cash position.
                Total Liab./Assets includes operating liabilities (deferred revenue, lease obligations).
                Cash Runway only shown when operating cash flow is negative.
                {isFinancialSector && ' Interest Coverage and EBITDA-based metrics are not applicable for banks and financial companies — interest expense is an operating cost netted into net interest income.'}
              </p>
            </div>

            {/* Capital Returns (buybacks + dividends) */}
            {(() => {
              // Net Debt Trend — bar chart showing how leverage has evolved
              const annualMets = mets.filter((_, i) => periods[i]?.year !== 'TTM' && !(periods[i] as any)?.isProjected)
              const ndPoints = annualMets
                .map((m, i) => ({ year: periods[i]?.year as string, netDebt: m.netDebt }))
                .filter(p => p.year && p.netDebt != null)
                .slice(-6)

              const fmtND = (v: number) => {
                const abs = Math.abs(v)
                const sign = v < 0 ? '-' : ''
                return abs >= 1000 ? `${sign}${currency}${(abs / 1000).toFixed(1)}B` : `${sign}${currency}${abs.toFixed(0)}M`
              }

              const renderNetDebtChart = ndPoints.length >= 2 ? (() => {
                const maxAbs = Math.max(...ndPoints.map(p => Math.abs(p.netDebt!)), 1)
                const hasMix = ndPoints.some(p => p.netDebt! < 0) && ndPoints.some(p => p.netDebt! >= 0)
                const firstND = ndPoints[0].netDebt!
                const lastND  = ndPoints[ndPoints.length - 1].netDebt!
                const trend = lastND - firstND
                const isImproving = trend < -0.05 * maxAbs || (firstND > 0 && lastND < 0)
                const isWorsening = trend >  0.05 * maxAbs || (firstND < 0 && lastND > 0)
                return (
                  <div className="border-t border-slate-100 px-4 sm:px-5 pb-4 pt-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-[13px] font-semibold text-slate-700">Net Debt Trend</p>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isImproving ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        isWorsening ? 'bg-red-50 border-red-200 text-red-600' :
                        'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                        {isImproving ? 'Deleveraging' : isWorsening ? 'Leveraging up' : 'Stable'}
                      </span>
                    </div>
                    <div className={`relative flex items-${hasMix ? 'center' : 'end'} gap-1.5 h-28`}>
                      {hasMix && (
                        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-300 pointer-events-none" />
                      )}
                      {ndPoints.map((p) => {
                        const val = p.netDebt!
                        const isNeg = val < 0
                        const pct = (Math.abs(val) / maxAbs) * (hasMix ? 50 : 100)
                        const barH = Math.max(4, pct)
                        const color = isNeg ? 'bg-emerald-400' : 'bg-slate-400'
                        return (
                          <div key={p.year} className={`flex flex-col items-center flex-1 min-w-0 h-full ${hasMix ? 'justify-center' : 'justify-end'} gap-0.5`}>
                            {!hasMix && <span className={`text-[10px] font-semibold leading-none ${isNeg ? 'text-emerald-600' : 'text-slate-500'}`}>{fmtND(val)}</span>}
                            {hasMix ? (
                              <div className="relative w-full flex flex-col items-center" style={{ height: '100%' }}>
                                {isNeg ? (
                                  <div className={`absolute w-full ${color} rounded-b-sm`} style={{ top: '50%', height: `${barH}%` }} title={`${p.year}: ${fmtND(val)}`} />
                                ) : (
                                  <div className={`absolute w-full ${color} rounded-t-sm`} style={{ bottom: '50%', height: `${barH}%` }} title={`${p.year}: ${fmtND(val)}`} />
                                )}
                              </div>
                            ) : (
                              <div className="relative w-full" style={{ height: `${barH}%` }}>
                                <div className={`w-full h-full rounded-t-sm ${color}`} title={`${p.year}: ${fmtND(val)}`} />
                              </div>
                            )}
                            <span className="text-[10px] text-slate-400 truncate max-w-full shrink-0">{p.year}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />Net cash (negative debt)</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-slate-400 inline-block" />Net debt</span>
                    </div>
                  </div>
                )
              })() : null

              const capRetRows = finCF
                .filter((r: any) => r.year !== 'TTM' && (r.buybacks != null || r.dividendsPaid != null))
                .slice(-4)
              const hasBuybacks  = capRetRows.some((r: any) => r.buybacks    != null && r.buybacks    > 0)
              const hasDividends = capRetRows.some((r: any) => r.dividendsPaid != null && r.dividendsPaid > 0)
              const showCapRet   = capRetRows.length > 0 && (hasBuybacks || hasDividends)
              const fmtM = (v: number | null) => v == null ? '—' : v >= 1000 ? `${currency}${(v / 1000).toFixed(1)}B` : `${currency}${v.toFixed(0)}M`

              if (!renderNetDebtChart && !showCapRet) return null

              return (
                <>
                  {renderNetDebtChart}
                  {showCapRet && (
                  <div className="border-t border-slate-100 px-4 sm:px-5 pb-4 pt-4">
                    <p className="text-[13px] font-semibold text-slate-700 mb-3">Capital Returns to Shareholders</p>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2 text-left font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Year</th>
                            {hasBuybacks  && <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Buybacks</th>}
                            {hasDividends && <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Dividends</th>}
                            <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {capRetRows.map((r: any) => {
                            const bb  = (r.buybacks     ?? 0) as number
                            const div = (r.dividendsPaid ?? 0) as number
                            const total = bb + div
                            return (
                              <tr key={r.year} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-700">{r.year}</td>
                                {hasBuybacks  && <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtM(r.buybacks)}</td>}
                                {hasDividends && <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtM(r.dividendsPaid)}</td>}
                                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{total > 0 ? fmtM(total) : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}
                </>
              )
            })()}

            {/* Dividend Analysis — only shown for dividend-paying stocks */}
            {(() => {
              const divYield: number | null = financialsData?.quote?.dividendYield ?? null
              const payoutRatio: number | null = financialsData?.quote?.payoutRatio ?? null
              if (!divYield || divYield <= 0) return null

              // Historical dividends from cash flow (already in finCF as dividendsPaid, stored as negative)
              const divHistory = finCF
                .filter((r: any) => r.year !== 'TTM' && !r.isProjected && r.dividendsPaid != null && r.dividendsPaid < 0)
                .slice(-5)
                .map((r: any) => ({ year: r.year as string, paid: Math.abs(r.dividendsPaid as number) }))

              // Payout ratio assessment
              const payoutLabel = payoutRatio == null ? null
                : payoutRatio > 0.9 ? { label: 'Unsustainable', cls: 'bg-red-50 border-red-200 text-red-700' }
                : payoutRatio > 0.7 ? { label: 'High', cls: 'bg-amber-50 border-amber-200 text-amber-700' }
                : payoutRatio > 0.4 ? { label: 'Healthy', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
                : { label: 'Conservative', cls: 'bg-blue-50 border-blue-200 text-blue-700' }

              return (
                <div className="border-t border-slate-100 px-4 sm:px-5 pb-4 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-slate-700">Dividend Analysis</p>
                    {payoutLabel && (
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${payoutLabel.cls}`}>
                        Payout: {payoutLabel.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Dividend Yield</p>
                      <p className="text-[18px] font-bold text-emerald-600 tabular-nums">{(divYield * 100).toFixed(2)}%</p>
                    </div>
                    {payoutRatio != null && payoutRatio > 0 && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Payout Ratio</p>
                        <p className="text-[18px] font-bold text-slate-800 tabular-nums">{(payoutRatio * 100).toFixed(0)}%</p>
                        <div className="h-1 bg-slate-200 rounded-full mt-1">
                          <div className={`h-full rounded-full ${payoutRatio > 0.9 ? 'bg-red-400' : payoutRatio > 0.7 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, payoutRatio * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  {divHistory.length >= 2 && (() => {
                    const maxDiv = Math.max(...divHistory.map((d: { year: string; paid: number }) => d.paid))
                    const fmtM = (v: number) => v >= 1000 ? `${currency}${(v / 1000).toFixed(1)}B` : `${currency}${v.toFixed(0)}M`
                    const first = divHistory[0].paid
                    const last  = divHistory[divHistory.length - 1].paid
                    const isGrowing = last > first * 1.01
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-medium text-slate-500">Historical Dividends Paid</p>
                          {isGrowing && <span className="text-[10px] font-semibold text-emerald-600">Growing dividend ↑</span>}
                        </div>
                        <div className="flex items-end gap-1.5 h-20">
                          {divHistory.map((d: { year: string; paid: number }) => {
                            const hp = maxDiv > 0 ? Math.max(8, (d.paid / maxDiv) * 100) : 8
                            return (
                              <div key={d.year} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                                <div className="relative w-full" style={{ height: `${hp}%` }}>
                                  <div className="w-full h-full rounded-t-sm bg-emerald-400" title={`${d.year}: ${fmtM(d.paid)}`} />
                                </div>
                                <span className="text-[10px] text-slate-400 truncate max-w-full">{d.year}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── Analysts ── */}
      {subTab === 'analysts' && (() => {
        const q = financialsData?.quote ?? {}
        const ca = financialsData?.cagrAnalysis ?? {}
        // A4: deduplicate currency symbol — avoid double-currency with explicit fallback
        const currCode = q.currency ?? 'USD'
        const sym = currCode === 'BRL' ? 'R$ ' : currCode === 'USD' ? '$' : currCode + ' '
        // A1: detect no coverage — empty rec AND no price targets
        const rawRec = (financialsData?.analystRecommendation ?? '').toLowerCase()
        const hasAnalystCoverage = rawRec !== '' || (q.analystTargetMean > 0) || (ca.numAnalysts > 0)
        const isBuy  = rawRec.includes('buy') || rawRec === 'strong_buy' || rawRec === 'strongbuy'
        const isSell = rawRec.includes('sell') || rawRec.includes('underperform') || rawRec.includes('underweight')
        const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
        const recBg    = isBuy ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : isSell ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
        const targetUpside = q.analystTargetMean > 0 && q.price > 0 ? (q.analystTargetMean - q.price) / q.price : null
        return (
          <div className="px-4 sm:px-5 py-5 space-y-5">

            {/* Quarterly Earnings Momentum */}
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const qRows: any[] = (financialsData?.incomeStatementQuarterly ?? [])
              if (qRows.length < 4) return null
              // Sort oldest-first, take last 8 quarters
              const sorted = [...qRows].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(-8)
              // YoY helpers
              const yoyPct = (i: number, arr: number[]): number | null => {
                const prev = arr[i - 4]
                const curr = arr[i]
                if (prev == null || curr == null || prev === 0 || prev < 0) return null
                return (curr - prev) / Math.abs(prev)
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const revArr = sorted.map((r: any) => (typeof r.revenue === 'number' ? r.revenue : null) as number | null)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const epsArr = sorted.map((r: any) => (typeof r.epsDiluted === 'number' ? r.epsDiluted : (typeof r.eps === 'number' ? r.eps : null)) as number | null)
              const maxRev = Math.max(...revArr.map(v => v ?? 0))
              const maxAbsEps = Math.max(...epsArr.map(v => Math.abs(v ?? 0)))
              // Beat/miss lookup from earningsSurprises
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const surprisesRaw: any[] = financialsData?.earningsSurprises ?? []
              const surpriseByDate = new Map(surprisesRaw.map(s => [s.date?.slice(0, 10), s.surprisePercent as number | null]))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const quarterLabel = (r: any) => {
                const period = r.period ?? ''
                const year = (r.date ?? '').slice(2, 4)
                return period ? `${period} '${year}` : (r.date ?? '').slice(0, 7)
              }
              const fmtRevShort = (v: number) => v >= 1e12 ? (v / 1e12).toFixed(1) + 'T' : v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v.toFixed(0)

              return (
                <div>
                  <p className="text-[13px] font-semibold text-slate-700 mb-4">Quarterly Earnings Momentum</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Revenue chart */}
                    {maxRev > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Revenue</p>
                        <div className="flex items-end gap-1 h-28">
                          {sorted.map((r, i) => {
                            const val = revArr[i]
                            const yoy = yoyPct(i, revArr as number[])
                            const hp = val != null && maxRev > 0 ? Math.max(6, (val / maxRev) * 100) : 4
                            const positive = yoy == null || yoy >= 0
                            return (
                              <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                                {yoy != null && (
                                  <span className={`text-[10px] font-semibold leading-none ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {positive ? '+' : ''}{(yoy * 100).toFixed(0)}%
                                  </span>
                                )}
                                <div className="relative w-full" style={{ height: `${hp}%` }}>
                                  <div className={`w-full h-full rounded-t-sm ${positive ? 'bg-[#2563EB]' : 'bg-slate-300'}`}
                                    title={`${quarterLabel(r)}: ${sym}${fmtRevShort(val ?? 0)}`} />
                                </div>
                                <span className="text-[10px] text-slate-400 truncate max-w-full">{quarterLabel(r)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* EPS chart */}
                    {maxAbsEps > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">EPS (Diluted)</p>
                        <div className="flex items-end gap-1 h-28">
                          {sorted.map((r, i) => {
                            const val = epsArr[i]
                            const _yoy = yoyPct(i, epsArr as number[])
                            const hp = val != null && maxAbsEps > 0 ? Math.max(6, (Math.abs(val) / maxAbsEps) * 100) : 4
                            const isPositive = (val ?? 0) >= 0
                            const beat = surpriseByDate.get((r.date ?? '').slice(0, 10))
                            const hasBeat = beat != null && beat > 0
                            const hasMiss = beat != null && beat < 0
                            return (
                              <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                                {beat != null && (
                                  <span className={`text-[10px] font-bold leading-none ${hasBeat ? 'text-emerald-600' : hasMiss ? 'text-red-500' : 'text-slate-400'}`}>
                                    {hasBeat ? '▲' : hasMiss ? '▼' : '—'}
                                  </span>
                                )}
                                <div className="relative w-full" style={{ height: `${hp}%` }}>
                                  <div className={`w-full h-full rounded-t-sm ${hasBeat ? 'bg-emerald-400' : hasMiss ? 'bg-red-300' : isPositive ? 'bg-violet-400' : 'bg-slate-300'}`}
                                    title={`${quarterLabel(r)}: ${sym}${val?.toFixed(2) ?? '—'}${beat != null ? ` (${beat > 0 ? '+' : ''}${beat.toFixed(1)}% surprise)` : ''}`} />
                                </div>
                                <span className="text-[10px] text-slate-400 truncate max-w-full">{quarterLabel(r)}</span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />Beat</span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-red-300 inline-block" />Miss</span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-sm bg-violet-400 inline-block" />Positive</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* A3: show empty state when no coverage */}
            {!hasAnalystCoverage ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">No analyst coverage available for this stock.</p>
                <p className="text-[11px] text-slate-300 mt-1">Coverage is typically unavailable for small-cap or non-US stocks.</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[13px] font-semibold text-slate-700 mb-3">Consensus Rating</p>
                  <div className="flex items-center gap-3 mb-2">
                    {rawRec !== '' && <span className={`text-sm font-bold px-4 py-1.5 rounded-full border ${recBg}`}>{recLabel}</span>}
                    {ca.numAnalysts > 0 && <span className="text-[12px] text-slate-400">{ca.numAnalysts} analysts covering this stock</span>}
                  </div>
                  {/* Rating breakdown stacked bar */}
                  {(() => {
                    const trend: Array<{ period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }> =
                      financialsData?.analystRatingTrend ?? []
                    const latest = trend[0]
                    if (!latest) return null
                    const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
                    if (total === 0) return null
                    const segments = [
                      { label: 'Strong Buy', count: latest.strongBuy,  color: 'bg-emerald-600' },
                      { label: 'Buy',        count: latest.buy,        color: 'bg-emerald-400' },
                      { label: 'Hold',       count: latest.hold,       color: 'bg-amber-400'   },
                      { label: 'Sell',       count: latest.sell,       color: 'bg-red-400'     },
                      { label: 'Strong Sell',count: latest.strongSell, color: 'bg-red-600'     },
                    ].filter(s => s.count > 0)
                    return (
                      <div className="mt-3">
                        <div className="flex rounded-full overflow-hidden h-3 gap-px">
                          {segments.map(s => (
                            <div
                              key={s.label}
                              className={`${s.color} transition-all`}
                              style={{ width: `${(s.count / total) * 100}%` }}
                              title={`${s.label}: ${s.count}`}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                          {segments.map(s => (
                            <span key={s.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                              <span className={`inline-block w-2 h-2 rounded-sm ${s.color}`} />
                              {s.label} ({s.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
                {/* EPS Growth Estimates */}
                {(analystEst1y != null || analystEst2y != null) && (
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 mb-3">EPS Growth Estimates</p>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      {analystEst1y != null && (
                        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                          <span className="text-[13px] text-slate-500">Next Year</span>
                          <span className={`text-[15px] font-bold tabular-nums ${analystEst1y >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {analystEst1y >= 0 ? '+' : ''}{(analystEst1y * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {analystEst2y != null && (
                        <div className="flex items-center justify-between px-4 py-3 bg-white">
                          <span className="text-[13px] text-slate-500">2-Year Forward</span>
                          <span className={`text-[15px] font-bold tabular-nums ${analystEst2y >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {analystEst2y >= 0 ? '+' : ''}{(analystEst2y * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {q.analystTargetMean > 0 && (
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 mb-3">Price Targets</p>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                      {[
                        { label: 'Average Target', val: q.analystTargetMean, upside: targetUpside, highlight: true },
                        { label: 'Low Target',      val: q.analystTargetLow,  upside: q.analystTargetLow  != null && q.price > 0 ? (q.analystTargetLow  - q.price) / q.price : null, highlight: false },
                        { label: 'High Target',     val: q.analystTargetHigh, upside: q.analystTargetHigh != null && q.price > 0 ? (q.analystTargetHigh - q.price) / q.price : null, highlight: false },
                        { label: 'Current Price',   val: q.price,             upside: null, highlight: false },
                      ].filter(r => r.val != null && r.val > 0).map(r => (
                        <div key={r.label} className={`flex items-center justify-between px-4 py-3 ${r.highlight ? 'bg-blue-50' : 'bg-white'}`}>
                          <span className={`text-[13px] ${r.highlight ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>{r.label}</span>
                          <div className="flex items-center gap-2 tabular-nums">
                            <span className={`text-[13px] font-bold ${r.highlight ? 'text-slate-900' : 'text-slate-700'}`}>
                              {sym}{(r.val as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {r.upside != null && (
                              <span className={`text-[11px] font-semibold ${r.upside >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {r.upside >= 0 ? '+' : ''}{(r.upside * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* A2: guard div-by-zero when low === high */}
                    {q.analystTargetLow != null && q.analystTargetHigh != null && q.analystTargetMean > 0 && (() => {
                      const lo = q.analystTargetLow as number
                      const hi = q.analystTargetHigh as number
                      const avg = q.analystTargetMean as number
                      const span = hi - lo
                      if (span <= 0) return null
                      const avgPct   = Math.max(2, Math.min(98, ((avg     - lo) / span) * 100))
                      const pricePct = Math.max(2, Math.min(98, ((q.price - lo) / span) * 100))
                      return (
                        <div className="mt-4">
                          <p className="text-[12px] font-semibold text-slate-600 mb-2">Target Range</p>
                          <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-300 to-blue-300" />
                            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-full bg-blue-600 z-10" style={{ left: `${avgPct}%` }} />
                            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-800 border-2 border-white shadow z-20" style={{ left: `calc(${pricePct}% - 6px)` }} />
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[10px] text-slate-400 tabular-nums">{sym}{lo.toFixed(2)} Low</span>
                            <span className="text-[10px] text-blue-500 tabular-nums">Avg {sym}{avg.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 tabular-nums">High {sym}{hi.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
                {/* Revenue Forecast Bar Chart */}
                {(() => {
                  const annual: any[] = statementsData?.annual?.incomeStatement ?? []
                  const histRevs = annual
                    .map((r: any) => ({
                      year: String(r.endDate ?? '').slice(0, 4),
                      value: (r.totalRevenue ?? null) as number | null,
                      isProjected: false,
                    }))
                    .filter(r => r.year.length === 4 && r.value != null)
                    .slice(-4)

                  const fwdEst: any[] = financialsData?.analystForwardEstimates ?? []
                  const fwdRevs = fwdEst
                    .filter((r: any) => r.revenue.avg != null)
                    .map((r: any) => ({
                      year: r.endDate ? String(new Date(r.endDate).getFullYear()) : r.period,
                      value: r.revenue.avg as number,
                      isProjected: true,
                      growth: r.revenue.growth as number | null,
                    }))

                  const allBars = [...histRevs, ...fwdRevs]
                  if (allBars.length < 2) return null

                  const maxVal = Math.max(...allBars.map(b => b.value ?? 0))
                  const fmtRev = (v: number) => v >= 1e12 ? (v / 1e12).toFixed(1) + 'T' : v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v.toFixed(0)

                  return (
                    <div>
                      <p className="text-[13px] font-semibold text-slate-700 mb-3">Revenue Forecast</p>
                      <div className="flex items-end gap-1.5 h-36 px-1">
                        {allBars.map((bar, i) => {
                          const val = bar.value ?? 0
                          const heightPct = maxVal > 0 ? Math.max(4, (val / maxVal) * 100) : 4
                          const gr = (bar as any).growth
                          return (
                            <div key={`${bar.year}-${i}`} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-1">
                              {gr != null && (
                                <span className={`text-[10px] font-semibold ${gr >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {gr >= 0 ? '+' : ''}{(gr * 100).toFixed(0)}%
                                </span>
                              )}
                              <div className="relative w-full flex items-end" style={{ height: `${heightPct}%` }}>
                                <div
                                  className={`w-full rounded-t-sm transition-all ${bar.isProjected ? 'bg-blue-200 border border-dashed border-blue-400' : 'bg-blue-500'}`}
                                  style={{ height: '100%' }}
                                  title={`${bar.year}: ${sym}${fmtRev(val)}`}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-slate-500 truncate max-w-full">{bar.year}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="inline-block w-3 h-2 rounded-sm bg-blue-500" />Actual</span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="inline-block w-3 h-2 rounded-sm bg-blue-200 border border-dashed border-blue-400" />Estimate</span>
                      </div>
                    </div>
                  )
                })()}

                {/* A6: data source disclosure */}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Analyst targets represent Wall Street consensus sourced from Yahoo Finance. They may differ from our intrinsic value model, which uses discounted cash flow analysis. Targets are typically 12-month forward estimates.
                </p>

                {/* Forward Revenue & EPS Estimates */}
                {(() => {
                  const fwdEst: Array<{
                    period: string; endDate: string | null
                    revenue: { avg: number | null; low: number | null; high: number | null; growth: number | null; analysts: number | null }
                    eps: { avg: number | null; low: number | null; high: number | null; growth: number | null; analysts: number | null; yearAgo: number | null }
                  }> = financialsData?.analystForwardEstimates ?? []
                  if (fwdEst.length === 0) return null
                  const hasRevenue = fwdEst.some(r => r.revenue.avg != null)
                  const hasEPS     = fwdEst.some(r => r.eps.avg != null)
                  if (!hasRevenue && !hasEPS) return null

                  const periodLabel = (period: string, endDate: string | null) => {
                    if (endDate) {
                      const yr = new Date(endDate).getFullYear()
                      return `FY${yr}`
                    }
                    return period === '0y' ? 'Current FY' : period === '+1y' ? 'Next FY' : 'FY+2'
                  }

                  return (
                    <div>
                      <p className="text-[13px] font-semibold text-slate-700 mb-3">Forward Estimates</p>
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-2 text-left font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Period</th>
                              {hasRevenue && <>
                                <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Rev. Est.</th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Rev. Growth</th>
                              </>}
                              {hasEPS && <>
                                <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">EPS Est.</th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">EPS Growth</th>
                              </>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {fwdEst.map(row => {
                              const revGrowth = row.revenue.growth
                              const epsGrowth = row.eps.growth
                              const revAvg = row.revenue.avg
                              const epsAvg = row.eps.avg
                              return (
                                <tr key={row.period} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-slate-700">{periodLabel(row.period, row.endDate)}</td>
                                  {hasRevenue && <>
                                    <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-800 font-medium">
                                      {revAvg != null ? (revAvg >= 1e12 ? `${sym}${(revAvg / 1e12).toFixed(2)}T` : revAvg >= 1e9 ? `${sym}${(revAvg / 1e9).toFixed(1)}B` : revAvg >= 1e6 ? `${sym}${(revAvg / 1e6).toFixed(0)}M` : `${sym}${revAvg.toFixed(0)}`) : '—'}
                                      {row.revenue.analysts != null && <span className="text-[10px] text-slate-400 ml-1">({row.revenue.analysts})</span>}
                                    </td>
                                    <td className={`px-3 py-3 text-right tabular-nums text-[12px] font-semibold ${revGrowth == null ? 'text-slate-400' : revGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {revGrowth != null ? `${revGrowth >= 0 ? '+' : ''}${(revGrowth * 100).toFixed(1)}%` : '—'}
                                    </td>
                                  </>}
                                  {hasEPS && <>
                                    <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-800 font-medium">
                                      {epsAvg != null ? `${sym}${epsAvg.toFixed(2)}` : '—'}
                                      {row.eps.analysts != null && <span className="text-[10px] text-slate-400 ml-1">({row.eps.analysts})</span>}
                                    </td>
                                    <td className={`px-3 py-3 text-right tabular-nums text-[12px] font-semibold ${epsGrowth == null ? 'text-slate-400' : epsGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {epsGrowth != null ? `${epsGrowth >= 0 ? '+' : ''}${(epsGrowth * 100).toFixed(1)}%` : '—'}
                                    </td>
                                  </>}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Number in parentheses = analysts covering this estimate. Low/High ranges available from Yahoo Finance.</p>
                    </div>
                  )
                })()}

                {/* EPS Surprise History */}
                {(() => {
                  const surprises: Array<{
                    quarter: string | null; date: string | null
                    epsActual: number | null; epsEstimate: number | null
                    epsDifference: number | null; surprisePercent: number | null
                  }> = financialsData?.earningsSurprises ?? []
                  if (surprises.length === 0) return null
                  return (
                    <div>
                      <p className="text-[13px] font-semibold text-slate-700 mb-3">EPS Surprise History</p>
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-2 text-left font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Quarter</th>
                              <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Estimated</th>
                              <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Actual</th>
                              <th className="px-3 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Surprise</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {[...surprises].reverse().map((row, idx) => {
                              const beat = row.surprisePercent != null && row.surprisePercent > 0
                              const miss = row.surprisePercent != null && row.surprisePercent < 0
                              const qLabel = row.date
                                ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                                : (row.quarter ?? '—')
                              return (
                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-700">{qLabel}</td>
                                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                                    {row.epsEstimate != null ? `${sym}${row.epsEstimate.toFixed(2)}` : '—'}
                                  </td>
                                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${beat ? 'text-emerald-600' : miss ? 'text-red-600' : 'text-slate-700'}`}>
                                    {row.epsActual != null ? `${sym}${row.epsActual.toFixed(2)}` : '—'}
                                  </td>
                                  <td className="px-3 py-3 text-right tabular-nums">
                                    {row.surprisePercent != null ? (
                                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${beat ? 'bg-emerald-50 text-emerald-700' : miss ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {beat ? '+' : ''}{row.surprisePercent.toFixed(1)}%
                                      </span>
                                    ) : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* Peer Multiples Comparison */}
                {(() => {
                  const estimates: Array<{
                    multiple: string; actualValue: number; sectorMedian: number
                    benchmarkSource: string; peerTickers: string[]
                    impliedFairValue: number; upsidePct: number; applicable: boolean
                  }> = financialsData?.valuationMethods?.models?.multiples?.estimates ?? []
                  const allPeers: string[] = financialsData?.valuationMethods?.models?.multiples?.peerTickers ?? []
                  const peerComps: Array<{
                    ticker: string; trailingPE: number | null; priceToBook: number | null
                    priceToSales: number | null; evToEbitda: number | null; evToRevenue: number | null
                  }> = financialsData?.peerComps ?? []
                  const applicableEsts = estimates.filter(e => e.applicable && e.actualValue > 0 && e.sectorMedian > 0)
                  if (applicableEsts.length === 0) return null

                  const currTicker = (financialsData?.ticker ?? '').toUpperCase()
                  // Get current company's multiples from estimates
                  const peEst      = estimates.find(e => e.multiple === 'P/E')?.actualValue ?? null
                  const evEbitdaEst = estimates.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
                  const pbEst      = estimates.find(e => e.multiple === 'P/Book')?.actualValue ?? null
                  const psEst      = estimates.find(e => e.multiple === 'P/Sales')?.actualValue ?? null

                  return (
                    <div>
                      <div className="flex items-baseline justify-between mb-3">
                        <p className="text-[13px] font-semibold text-slate-700">Relative Valuation</p>
                        {allPeers.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            vs. {allPeers.slice(0, 4).join(', ')}{allPeers.length > 4 ? ` +${allPeers.length - 4}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {/* Header */}
                        <div className="grid grid-cols-4 px-4 py-2 bg-slate-50">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Multiple</span>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Current</span>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Median</span>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">vs. Peers</span>
                        </div>
                        {applicableEsts.map(e => {
                          const premium = e.sectorMedian > 0 ? (e.actualValue - e.sectorMedian) / e.sectorMedian : null
                          const isDiscount = premium != null && premium < -0.05
                          const isPremium  = premium != null && premium > 0.05
                          return (
                            <div key={e.multiple} className="grid grid-cols-4 px-4 py-3 bg-white items-center">
                              <span className="text-[12px] font-medium text-slate-700">{e.multiple}</span>
                              <span className="text-[12px] font-bold text-slate-900 tabular-nums text-right">
                                {e.actualValue.toFixed(1)}×
                              </span>
                              <span className="text-[12px] text-slate-500 tabular-nums text-right">
                                {e.sectorMedian.toFixed(1)}×
                              </span>
                              <div className="flex justify-end">
                                {premium != null ? (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                    isDiscount ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    isPremium  ? 'bg-red-50 text-red-600 border border-red-200' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    {premium >= 0 ? '+' : ''}{(premium * 100).toFixed(0)}%
                                  </span>
                                ) : <span className="text-[11px] text-slate-300">—</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {allPeers.length > 0 ? 'Live peer medians' : 'Industry medians (Damodaran 2025)'}
                        . Discount = trading below peers; Premium = trading above.
                      </p>

                      {/* Per-peer breakdown table */}
                      {peerComps.length >= 2 && (
                        <div className="mt-4">
                          <p className="text-[12px] font-semibold text-slate-600 mb-2">Peer Comparison</p>
                          <div className="rounded-xl border border-slate-200 overflow-x-auto">
                            <table className="w-full text-[11px] min-w-[360px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide">Ticker</th>
                                  <th className="px-3 py-2 text-right font-semibold text-slate-400 uppercase tracking-wide">P/E</th>
                                  <th className="px-3 py-2 text-right font-semibold text-slate-400 uppercase tracking-wide">EV/EBITDA</th>
                                  <th className="px-3 py-2 text-right font-semibold text-slate-400 uppercase tracking-wide">P/B</th>
                                  <th className="px-3 py-2 text-right font-semibold text-slate-400 uppercase tracking-wide">P/S</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {/* Current company row */}
                                <tr className="bg-blue-50/60 font-semibold">
                                  <td className="px-3 py-2.5 text-blue-700 font-bold">{currTicker} ★</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-slate-800">{peEst != null ? peEst.toFixed(1) + '×' : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-slate-800">{evEbitdaEst != null ? evEbitdaEst.toFixed(1) + '×' : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-slate-800">{pbEst != null ? pbEst.toFixed(1) + '×' : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-slate-800">{psEst != null ? psEst.toFixed(1) + '×' : '—'}</td>
                                </tr>
                                {peerComps.map(p => (
                                  <tr key={p.ticker} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-3 py-2.5 font-mono font-bold text-slate-700">{p.ticker}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{p.trailingPE != null ? p.trailingPE.toFixed(1) + '×' : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{p.evToEbitda != null ? p.evToEbitda.toFixed(1) + '×' : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{p.priceToBook != null ? p.priceToBook.toFixed(1) + '×' : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{p.priceToSales != null ? p.priceToSales.toFixed(1) + '×' : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )
      })()}

      {/* ── Ownership ── */}
      {subTab === 'ownership' && (() => {
        const ownership = financialsData?.ownership ?? null
        if (!ownership || (ownership.institutionalPct == null && ownership.insiderPct == null)) {
          return (
            <div className="px-4 sm:px-5 py-8 text-center text-sm text-slate-400">
              Ownership data unavailable
            </div>
          )
        }
        // O1: treat values already as % (some sources return 0–100, others 0–1)
        const toPercent = (v: number | null) => v == null ? null : v > 1 ? v : v * 100
        const instRaw   = toPercent(ownership.institutionalPct) ?? 0
        const insiderRaw = toPercent(ownership.insiderPct)      ?? 0
        // O2: guard sum > 100 — normalize proportionally
        const rawSum = instRaw + insiderRaw
        const inst   = rawSum > 100 ? (instRaw   / rawSum) * 100 : instRaw
        const insider = rawSum > 100 ? (insiderRaw / rawSum) * 100 : insiderRaw
        // O5: public float = shares * (1 - insiderRaw/100)
        const sharesOut = financialsData?.quote?.sharesOutstanding ?? null
        const publicFloat = sharesOut && insiderRaw > 0 ? sharesOut * (1 - insiderRaw / 100) : null
        const fmtShares = (v: number) => v >= 1e9 ? `${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v.toLocaleString()
        const retail = Math.max(0, 100 - inst - insider)
        // O1: short interest
        const shortPct   = toPercent(ownership.shortPct)
        const shortRatio = ownership.shortRatio ?? null
        const segments = [
          { label: 'Institutions', pct: inst,    color: 'bg-blue-500',  bar: 'bg-blue-500',  text: 'text-blue-700', bgLight: 'bg-blue-50'   },
          { label: 'Insiders',     pct: insider,  color: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700',bgLight: 'bg-amber-50'  },
          { label: 'Retail / Other', pct: retail, color: 'bg-slate-300', bar: 'bg-slate-300', text: 'text-slate-600',bgLight: 'bg-slate-50'  },
        ]
        return (
          <div className="px-4 sm:px-5 py-5 space-y-5">
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-3">Ownership Breakdown</p>
              {rawSum > 100 && (
                <p className="text-[10px] text-amber-600 mb-2">Note: Institutional + Insider sums to {rawSum.toFixed(1)}% — normalized to 100% for display.</p>
              )}
              <div className="space-y-3">
                {segments.map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                        <span className="text-[13px] text-slate-600">{s.label}</span>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums font-mono text-slate-800">{s.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {segments.map(s => (
                <div key={s.label} className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0 ${s.bgLight}`}>
                  <span className="text-[13px] text-slate-600">{s.label}</span>
                  <span className={`text-[15px] font-bold tabular-nums ${s.text}`}>{s.pct.toFixed(1)}%</span>
                </div>
              ))}
              {/* O5: public float */}
              {publicFloat != null && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white">
                  <span className="text-[13px] text-slate-500">Public Float</span>
                  <span className="text-[13px] font-semibold text-slate-700 tabular-nums">{fmtShares(publicFloat)} shares</span>
                </div>
              )}
            </div>
            {/* O1: short interest block */}
            {(shortPct != null || shortRatio != null) && (
              <div>
                <p className="text-[12px] font-semibold text-slate-600 mb-2">Short Interest</p>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  {shortPct != null && (
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                      <span className="text-[13px] text-slate-500">Short % of Float</span>
                      <span className={`text-[13px] font-semibold tabular-nums ${shortPct > 10 ? 'text-red-600' : shortPct > 5 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {shortPct.toFixed(1)}%
                        {/* O3: trend indicator badge */}
                        {shortPct > 10 && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">High</span>}
                      </span>
                    </div>
                  )}
                  {shortRatio != null && (
                    <div className="flex items-center justify-between px-4 py-3 bg-white">
                      <span className="text-[13px] text-slate-500">Days to Cover</span>
                      <span className="text-[13px] font-semibold text-slate-700 tabular-nums">{(shortRatio as number).toFixed(1)} days</span>
                    </div>
                  )}
                  {shortPct != null && shortPct > 15 && shortRatio != null && (shortRatio as number) > 5 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-t border-red-100">
                      <span className="text-[12px] font-semibold text-red-700">Squeeze Risk</span>
                      <span className="text-[11px] text-red-600">High short interest + slow coverage</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* O4: data lag disclosure */}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Institutional ownership reflects 13F filings (lag up to 45 days). Insider ownership from most recent proxy statement.
              Short interest reported bi-monthly — may not reflect intraday changes.
            </p>

            {/* Insider Transactions feed */}
            {financialsData?.ticker && (
              <div>
                <p className="text-[13px] font-semibold text-slate-700 mb-3">Recent Insider Transactions</p>
                <InsiderTransactionsWidget ticker={financialsData.ticker} />
              </div>
            )}

            {/* Top Institutional Holders */}
            {(() => {
              const holders: Array<{
                name: string; shares: number; weight: number
                weightChange: number; isNew: boolean; isSoldOut: boolean
              }> = financialsData?.institutionalHolders ?? []
              if (holders.length === 0) return null
              const fmtShares = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v.toLocaleString()
              return (
                <div>
                  <p className="text-[13px] font-semibold text-slate-700 mb-3">Top Institutional Holders</p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-2 text-left font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Institution</th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Shares</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Weight</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-400 text-[10px] uppercase tracking-wide">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {holders.map((h, i) => {
                          const up = h.weightChange > 0.5
                          const dn = h.weightChange < -0.5
                          return (
                            <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 text-slate-700 font-medium">
                                <span className="truncate block max-w-[180px] sm:max-w-none">{h.name}</span>
                                {h.isNew && <span className="text-[10px] font-semibold text-blue-600 ml-0 mt-0.5 block">New position</span>}
                                {h.isSoldOut && <span className="text-[10px] font-semibold text-red-600 ml-0 mt-0.5 block">Sold out</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-600">{fmtShares(h.shares)}</td>
                              <td className="px-3 py-3 text-right tabular-nums font-mono text-slate-600">{(h.weight * 100).toFixed(2)}%</td>
                              <td className="px-3 py-3 text-right tabular-nums font-mono">
                                <span className={`text-[11px] font-semibold ${up ? 'text-emerald-600' : dn ? 'text-red-600' : 'text-slate-400'}`}>
                                  {h.weightChange > 0 ? '+' : ''}{(h.weightChange).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Source: 13F filings · Weight = % of institution portfolio · Change = weight shift vs prior quarter</p>
                </div>
              )
            })()}

            {/* SEC Filings */}
            {(() => {
              const filings: Array<{ type: string; date: string; link: string }> = financialsData?.secFilings ?? []
              if (filings.length === 0) return null
              const typeStyle = (t: string) =>
                t === '10-K' ? 'bg-blue-50 text-blue-700 border-blue-200'
                : t === '10-Q' ? 'bg-violet-50 text-violet-700 border-violet-200'
                : t === 'DEF 14A' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
              return (
                <div>
                  <p className="text-[13px] font-semibold text-slate-700 mb-3">SEC Filings</p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {filings.map((f, i) => (
                      <a
                        key={i}
                        href={f.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors group"
                      >
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${typeStyle(f.type)}`}>
                          {f.type}
                        </span>
                        <span className="text-[12px] text-slate-500 tabular-nums">
                          {new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <svg className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Direct links to SEC EDGAR filings · 10-K = annual report · 10-Q = quarterly · DEF 14A = proxy statement</p>
                </div>
              )
            })()}
          </div>
        )
      })()}
    </div>

    {/* ── Financial Charts — individual boxes below main card ── */}
    {showCharts && (
      <FinancialCharts
        incomeStatement={finIS}
        cashFlow={finCF}
        currency={currency}
        isDark={false}
        historicalMultiples={financialsData?.historicalMultiples ?? []}
        currentPE={financialsData?.quote?.peRatio ?? null}
        currentEVEbitda={financialsData?.businessProfile?.evToEbitda ?? null}
        currentEVRevenue={financialsData?.businessProfile?.evToRevenue ?? null}
        currentPS={financialsData?.businessProfile?.priceToSales ?? null}
        chartsToShow={
          subTab === 'growth'        ? ['multiGrowth', 'multiAbsolute'] :
          subTab === 'profitability' ? ['margins']                      :
          undefined
        }
      />
    )}
    </>
  )
}
