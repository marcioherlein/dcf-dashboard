'use client'
import { useState, useMemo, useEffect, useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import YahooFinancials from './YahooFinancials'
import FinancialCharts from './FinancialCharts'
import InsiderTransactionsWidget from './InsiderTransactionsWidget'
import InfoTooltip from '@/components/ui/InfoTooltip'
import EpsBeatMissChart from './EpsBeatMissChart'
import AnalystRecommendationsChart from './AnalystRecommendationsChart'

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
  if (v == null) return 'text-[#8A95A6]'
  return v > 0 ? 'text-[#11875D]' : v < 0 ? 'text-[#D83B3B]' : 'text-[#8A95A6]'
}

function valColor(v: number | null, positiveIsGood = true): string {
  if (v == null) return 'text-[#8A95A6]'
  if (v === 0) return 'text-[#566174]'
  const good = v > 0 ? positiveIsGood : !positiveIsGood
  return good ? 'text-[#06101F]' : 'text-[#D83B3B]'
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
          ? (positiveIsGood ? '#10b981' : '#8A95A6')
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
    return 'text-[#06101F]'
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="min-w-[480px] w-full border-collapse">
        <thead>
          <tr className="border-b border-[#E3E1DA]">
            <th className="sticky left-0 z-10 bg-white px-3 sm:px-4 py-2 text-left text-[11px] font-semibold text-[#566174] w-40 min-w-[160px] sm:w-56 sm:min-w-[224px]">
              Metric
            </th>
            {columns.map(col => (
              <th key={col} className={`px-2 sm:px-3 py-2 text-right text-[11px] font-semibold whitespace-nowrap ${
                col === 'TTM' ? 'text-[#B56A00] bg-[#FFF4DA]/40' : 'text-[#566174]'
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
                <tr key={i} className="bg-[#F0F1F6] border-y border-[#E3E1DA]">
                  <td colSpan={columns.length + 1} className="px-3 sm:px-4 py-1.5 text-[11px] font-semibold text-[#566174] bg-[#F0F1F6] border-y border-[#E3E1DA]">
                    {row.label}
                  </td>
                </tr>
              )
            }

            const pig = row.positiveIsGood ?? true
            return (
              <tr key={i} className="border-b border-[#F4F3EF] hover:bg-[#F0F1F6] transition-colors">
                <td className={`sticky left-0 z-10 bg-white px-3 sm:px-4 py-2 text-xs whitespace-nowrap ${
                  row.indent ? 'pl-6 sm:pl-8 text-[#8A95A6]' : 'font-medium text-[#566174]'
                }`}>
                  {!hideSparks && <Sparkline values={row.values} positiveIsGood={pig} />}
                  {row.label}
                  {row.positiveIsGood != null && !row.indent && (
                    <span className="ml-1 text-[10px] text-[#8A95A6] font-normal" aria-label={row.positiveIsGood ? 'higher is better' : 'lower is better'}>
                      {row.positiveIsGood ? '↑' : '↓'}
                    </span>
                  )}
                  {row.tooltip && <InfoTooltip content={row.tooltip} />}
                </td>
                {row.values.map((v, j) => (
                  <td key={j} className={`px-2 sm:px-3 py-2 text-right text-xs tabular-nums font-mono whitespace-nowrap ${
                    columns[j] === 'TTM' ? 'font-semibold bg-[#FFF4DA]/30' : ''
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

  const pillId  = useId()
  const reduced = useReducedMotion()
  const SPRING  = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 } as const

  return (
    <>
    <div className="rounded-xl card">
      {/* Sub-tab nav — pill-within-pill */}
      <div className="flex items-center justify-between px-3 sm:px-5 pt-3 pb-3 gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="Financials sections"
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide rounded-full p-[3px] flex-shrink-0"
          style={{
            background: 'rgba(240,241,246,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          {SUB_TABS.map(({ id, label }) => {
            const isActive = subTab === id
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${id}`}
                onClick={() => setSubTab(id)}
                className="relative flex items-center rounded-full px-3 py-1.5 text-[12px] sm:text-[13px] min-h-[32px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.6)]"
                style={{ color: isActive ? '#111111' : '#566174', fontWeight: isActive ? 650 : 500 }}
              >
                {isActive && (
                  <motion.span
                    layoutId={`${pillId}-fin-pill`}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid rgba(0,0,0,0.08)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                    transition={reduced ? { duration: 0 } : SPRING}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            )
          })}
        </div>

        {/* Annual / Quarterly toggle — pill style */}
        {['growth', 'profitability', 'solvency'].includes(subTab) && (
          <div
            className="flex items-center gap-0.5 rounded-full p-[3px] shrink-0"
            style={{
              background: 'rgba(240,241,246,0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            {(['annual', 'quarterly'] as const).map(p => {
              const isActive = analyticsPeriod === p
              return (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className="relative flex items-center rounded-full px-3 py-1.5 text-[11px] min-h-[28px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.6)]"
                  style={{ color: isActive ? '#111111' : '#8A95A6', fontWeight: isActive ? 650 : 500 }}
                >
                  {isActive && (
                    <motion.span
                      layoutId={`${pillId}-period-pill`}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                      }}
                      transition={reduced ? { duration: 0 } : SPRING}
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 capitalize">{p}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Per-tab context strip */}
      <div className="px-4 sm:px-5 py-2 border-b border-[#E3E1DA] bg-[#F0F1F6]/60">
        <p className="text-[12px] text-[#566174] leading-snug">{TAB_ANCHORS[subTab]}</p>
      </div>

      {!hasData && (
        <div className="py-12 text-center text-sm text-[#8A95A6]">
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
          if (recentCAGR > 0.20)      { ratingLabel = 'Strong Growth';   ratingColor = 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' }
          else if (recentCAGR > 0.10) { ratingLabel = 'Solid Growth';    ratingColor = 'bg-[#EAF1FF] border-[#93B4F5] text-[#2563EB]' }
          else if (recentCAGR > 0.05) { ratingLabel = 'Moderate Growth'; ratingColor = 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]' }
          else if (recentCAGR > 0)    { ratingLabel = 'Slow Growth';     ratingColor = 'bg-[#F0F1F6] border-[#E3E1DA] text-[#566174]' }
          else                         { ratingLabel = 'Declining';       ratingColor = 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' }
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
          v == null ? 'text-[#8A95A6]' : v >= 0.15 ? 'text-[#11875D]' : v >= 0.05 ? 'text-[#2563EB]' : v >= 0 ? 'text-[#06101F]' : 'text-[#D83B3B]'
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
                <div className="rounded-xl border border-[#E3E1DA] bg-white overflow-hidden">
                  <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-[#E3E1DA]">
                    {cagrItems.map((item) => (
                      <div key={item.label} className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A95A6] mb-0.5 truncate">{item.label}</p>
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
                <div className="px-4 sm:px-5 pb-4 border-t border-[#E3E1DA] pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-[#06101F]">Shares Outstanding Trend</p>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      isReducing ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' :
                      isGrowing  ? 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' :
                      'bg-[#F0F1F6] border-[#E3E1DA] text-[#566174]'
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
                            <span className={`text-[10px] font-semibold leading-none ${isUp ? 'text-[#D83B3B]' : isDn ? 'text-[#11875D]' : 'text-[#8A95A6]'}`}>
                              {isUp ? '+' : isDn ? '' : ''}{(yoy * 100).toFixed(1)}%
                            </span>
                          )}
                          <div className="relative w-full" style={{ height: `${hp}%` }}>
                            <div className={`w-full h-full rounded-t-sm ${isUp ? 'bg-[#F0B8B8]' : isDn ? 'bg-[#11875D]' : 'bg-[#CDD1C8]'}`}
                              title={`${p.year}: ${fmtShares(p.sharesM)}`} />
                          </div>
                          <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{p.year}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#11875D] inline-block" />Decreasing (buybacks)</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#F0B8B8] inline-block" />Increasing (dilution)</span>
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
                <div className="px-4 sm:px-5 pb-4 border-t border-[#E3E1DA] pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-[#06101F]">EPS (Diluted) Trend</p>
                    <div className="flex items-center gap-2">
                      {latestEps.eps != null && (
                        <span className={`text-[11px] font-semibold tabular-nums ${latestEps.eps >= 0 ? 'text-[#06101F]' : 'text-[#D83B3B]'}`}>
                          {latestEps.eps >= 0 ? '+' : ''}${latestEps.eps.toFixed(2)}
                        </span>
                      )}
                      {epsGrowth != null && (
                        <span className={`text-[11px] font-semibold tabular-nums ${epsGrowth >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
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
                            <span className={`text-[10px] font-semibold leading-none ${yoy >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                              {yoy >= 0 ? '+' : ''}{(yoy * 100).toFixed(0)}%
                            </span>
                          )}
                          <div className="relative w-full" style={{ height: `${hp}%` }}>
                            <div className={`w-full h-full rounded-t-sm ${isPos ? 'bg-[#E8F7EF]' : 'bg-[#D83B3B]'}`}
                              title={`${p.year}: EPS ${isPos ? '+' : ''}$${val.toFixed(2)}`} />
                          </div>
                          <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{p.year}</span>
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
                <div className="px-4 sm:px-5 pb-4 border-t border-[#E3E1DA] pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-[#06101F]">ROIC vs WACC</p>
                    {spread != null && (
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${creatingValue ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' : 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]'}`}>
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
                        <span className="text-[10px] font-bold text-[#B56A00] bg-white px-1 shrink-0">
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
                              className={`absolute left-1 right-1 rounded-sm transition-colors ${aboveWacc ? 'bg-[#11875D]' : 'bg-[#F0B8B8]'}`}
                              style={{
                                bottom: `${barBottom}%`,
                                height: `${Math.max(2, barH)}%`,
                              }}
                              title={`${p.year}: ROIC ${(val * 100).toFixed(1)}%${wacc != null ? `, WACC ${(wacc * 100).toFixed(1)}%` : ''}`}
                            />
                            {/* Value label above bar */}
                            <span
                              className={`absolute text-[10px] font-semibold left-0 right-0 text-center leading-none ${aboveWacc ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
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
                        <div key={p.year} className="flex-1 text-center text-[10px] text-[#8A95A6]">{p.year}</div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#11875D] inline-block" />ROIC above WACC</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#F0B8B8] inline-block" />ROIC below WACC</span>
                    {wacc != null && <span className="flex items-center gap-1 text-[10px] text-[#B56A00]"><span className="w-5 border-t-2 border-dashed border-amber-400 inline-block" />WACC</span>}
                  </div>
                  <p className="text-[10px] text-[#8A95A6] mt-1.5 leading-snug">
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
                <div className="px-4 sm:px-5 pb-4 border-t border-[#E3E1DA] pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-[#06101F]">Free Cash Flow Trend</p>
                    {fcfM != null && (
                      <span className={`text-[11px] font-semibold tabular-nums ${fcfM > 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
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
                            <span className={`text-[10px] font-semibold leading-none ${yoy >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                              {yoy >= 0 ? '+' : ''}{(yoy * 100).toFixed(0)}%
                            </span>
                          )}
                          <div className="relative w-full" style={{ height: `${hp}%` }}>
                            <div className={`w-full h-full rounded-t-sm ${isPositive ? 'bg-[#059669]' : 'bg-[#F0B8B8]'}`}
                              title={`${p.year}: FCF ${fmtM(val)}`} />
                          </div>
                          <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{p.year}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#059669] inline-block" />Positive FCF</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#F0B8B8] inline-block" />Negative FCF (cash burn)</span>
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
                <div className="px-4 sm:px-5 pb-4 border-t border-[#E3E1DA] pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-[#06101F]">Margin Trend</p>
                    <div className="flex items-center gap-2.5 text-[10px] tabular-nums flex-wrap">
                      {latestM.grossM != null && (
                        <span className="text-[#566174]">Gross <span className="font-semibold text-[#2563EB]">{(latestM.grossM * 100).toFixed(1)}%</span></span>
                      )}
                      {latestM.opM != null && (
                        <span className="text-[#566174]">Op. <span className="font-semibold text-violet-600">{(latestM.opM * 100).toFixed(1)}%</span></span>
                      )}
                      {latestM.netM != null && (
                        <span className="text-[#566174]">Net <span className={`font-semibold ${latestM.netM >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>{(latestM.netM * 100).toFixed(1)}%</span></span>
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
                              className={`flex-1 min-w-0 rounded-t-sm ${p.netM >= 0 ? 'bg-[#11875D]' : 'bg-[#F0B8B8]'}`}
                              style={{ height: `${Math.max(2, (Math.abs(p.netM) / maxM) * 100)}%` }}
                              title={`${p.year} Net Margin: ${(p.netM * 100).toFixed(1)}%`}
                            />
                          ) : <div className="flex-1" />}
                        </div>
                        <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{p.year}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#2563EB] inline-block" />Gross</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-violet-400 inline-block" />Operating</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#11875D] inline-block" />Net</span>
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
                <div className="px-4 sm:px-5 pb-4 border-t border-[#E3E1DA] pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-[#06101F]">Cash Generation</p>
                    {latestConversion != null && (
                      <span className={`text-[11px] font-semibold tabular-nums ${latestConversion >= 0.7 ? 'text-[#11875D]' : latestConversion >= 0.4 ? 'text-[#B56A00]' : 'text-[#D83B3B]'}`}>
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
                                className={`flex-1 min-w-0 rounded-t-sm ${fcfPos ? 'bg-[#E8F7EF]' : 'bg-[#D83B3B]'}`}
                                style={{ height: `${fcfH}%` }}
                                title={`${p.year} Free CF: ${currency}${p.fcf!.toFixed(0)}M`}
                              />
                            ) : <div className="flex-1" />}
                          </div>
                          <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{p.year}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#059669] inline-block" />Operating CF</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#E8F7EF] inline-block" />Free CF</span>
                    <span className="text-[10px] text-[#8A95A6]">Both scaled to max OCF. FCF conversion = FCF/OCF</span>
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
          if (ndVal < 0)                            { ratingLabel = 'Fortress Balance Sheet'; ratingColor = 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' }
          else if (ndVal < 1 && covVal > 8)         { ratingLabel = 'Very Strong';            ratingColor = 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' }
          else if (ndVal < 2 && covVal > 5)         { ratingLabel = 'Strong';                 ratingColor = 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' }
          else if (ndVal < 3 && covVal > 3)         { ratingLabel = 'Investment Grade';       ratingColor = 'bg-[#EAF1FF] border-[#93B4F5] text-[#2563EB]' }
          else if (ndVal <= 5 && covVal >= 1.5)     { ratingLabel = 'Moderate Leverage';      ratingColor = 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]' }
          else if (ndVal > 7 || covVal < 1)         { ratingLabel = 'Distressed';             ratingColor = 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' }
          else                                       { ratingLabel = 'High Leverage';          ratingColor = 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' }
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
                  ? (v >= thresholds[0] ? 'text-[#11875D]' : v >= thresholds[1] ? 'text-[#2563EB]' : 'text-[#D83B3B]')
                  : (v <= thresholds[0] ? 'text-[#11875D]' : v <= thresholds[1] ? 'text-[#B56A00]' : 'text-[#D83B3B]')
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
                  <div className="rounded-xl border border-[#E3E1DA] bg-white overflow-hidden">
                    <div className={`grid ${cols} divide-x divide-[#E3E1DA]`}>
                      {items.map((item) => (
                        <div key={item.label} className="px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A95A6] mb-0.5 truncate">{item.label}</p>
                          <p className={`text-[15px] font-bold tabular-nums leading-tight ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="border-t border-[#E3E1DA] px-4 sm:px-5 pt-4 pb-4">
              <MetricsTable columns={cols} rows={solvencyRows} />
              <p className="text-[10px] text-[#8A95A6] mt-2 px-1">
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
                  <div className="border-t border-[#E3E1DA] px-4 sm:px-5 pb-4 pt-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-[13px] font-semibold text-[#06101F]">Net Debt Trend</p>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isImproving ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' :
                        isWorsening ? 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' :
                        'bg-[#F0F1F6] border-[#E3E1DA] text-[#566174]'
                      }`}>
                        {isImproving ? 'Deleveraging' : isWorsening ? 'Leveraging up' : 'Stable'}
                      </span>
                    </div>
                    <div className={`relative flex items-${hasMix ? 'center' : 'end'} gap-1.5 h-28`}>
                      {hasMix && (
                        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-[#CDD1C8] pointer-events-none" />
                      )}
                      {ndPoints.map((p) => {
                        const val = p.netDebt!
                        const isNeg = val < 0
                        const pct = (Math.abs(val) / maxAbs) * (hasMix ? 50 : 100)
                        const barH = Math.max(4, pct)
                        const color = isNeg ? 'bg-[#11875D]' : 'bg-[#8A95A6]'
                        return (
                          <div key={p.year} className={`flex flex-col items-center flex-1 min-w-0 h-full ${hasMix ? 'justify-center' : 'justify-end'} gap-0.5`}>
                            {!hasMix && <span className={`text-[10px] font-semibold leading-none ${isNeg ? 'text-[#11875D]' : 'text-[#566174]'}`}>{fmtND(val)}</span>}
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
                            <span className="text-[10px] text-[#8A95A6] truncate max-w-full shrink-0">{p.year}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#11875D] inline-block" />Net cash (negative debt)</span>
                      <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#8A95A6] inline-block" />Net debt</span>
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
                  <div className="border-t border-[#E3E1DA] px-4 sm:px-5 pb-4 pt-4">
                    <p className="text-[13px] font-semibold text-[#06101F] mb-3">Capital Returns to Shareholders</p>
                    <div className="rounded-xl border border-[#E3E1DA] overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-[#F0F1F6] border-b border-[#E3E1DA]">
                            <th className="px-4 py-2 text-left font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Year</th>
                            {hasBuybacks  && <th className="px-4 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Buybacks</th>}
                            {hasDividends && <th className="px-4 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Dividends</th>}
                            <th className="px-4 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E3E1DA] bg-white">
                          {capRetRows.map((r: any) => {
                            const bb  = (r.buybacks     ?? 0) as number
                            const div = (r.dividendsPaid ?? 0) as number
                            const total = bb + div
                            return (
                              <tr key={r.year} className="hover:bg-[#F0F1F6]/60 transition-colors">
                                <td className="px-4 py-3 font-medium text-[#06101F]">{r.year}</td>
                                {hasBuybacks  && <td className="px-4 py-3 text-right tabular-nums text-[#06101F]">{fmtM(r.buybacks)}</td>}
                                {hasDividends && <td className="px-4 py-3 text-right tabular-nums text-[#06101F]">{fmtM(r.dividendsPaid)}</td>}
                                <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#06101F]">{total > 0 ? fmtM(total) : '—'}</td>
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
                : payoutRatio > 0.9 ? { label: 'Unsustainable', cls: 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' }
                : payoutRatio > 0.7 ? { label: 'High', cls: 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]' }
                : payoutRatio > 0.4 ? { label: 'Healthy', cls: 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' }
                : { label: 'Conservative', cls: 'bg-[#EAF1FF] border-[#93B4F5] text-[#2563EB]' }

              return (
                <div className="border-t border-[#E3E1DA] px-4 sm:px-5 pb-4 pt-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-[13px] font-semibold text-[#06101F]">Dividend Analysis</p>
                    {payoutLabel && (
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${payoutLabel.cls}`}>
                        Payout: {payoutLabel.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    <div className="rounded-xl bg-[#F0F1F6] border border-[#E3E1DA] px-3 py-2.5">
                      <p className="text-[10px] text-[#8A95A6] font-semibold uppercase tracking-wide mb-0.5">Dividend Yield</p>
                      <p className="text-[18px] font-bold text-[#11875D] tabular-nums">{(divYield * 100).toFixed(2)}%</p>
                    </div>
                    {payoutRatio != null && payoutRatio > 0 && (
                      <div className="rounded-xl bg-[#F0F1F6] border border-[#E3E1DA] px-3 py-2.5">
                        <p className="text-[10px] text-[#8A95A6] font-semibold uppercase tracking-wide mb-0.5">Payout Ratio</p>
                        <p className="text-[18px] font-bold text-[#06101F] tabular-nums">{(payoutRatio * 100).toFixed(0)}%</p>
                        <div className="h-1 bg-[#E3E1DA] rounded-full mt-1">
                          <div className={`h-full rounded-full ${payoutRatio > 0.9 ? 'bg-[#D83B3B]' : payoutRatio > 0.7 ? 'bg-[#B56A00]' : 'bg-[#11875D]'}`} style={{ width: `${Math.min(100, payoutRatio * 100)}%` }} />
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
                          <p className="text-[11px] font-medium text-[#566174]">Historical Dividends Paid</p>
                          {isGrowing && <span className="text-[10px] font-semibold text-[#11875D]">Growing dividend ↑</span>}
                        </div>
                        <div className="flex items-end gap-1.5 h-20">
                          {divHistory.map((d: { year: string; paid: number }) => {
                            const hp = maxDiv > 0 ? Math.max(8, (d.paid / maxDiv) * 100) : 8
                            return (
                              <div key={d.year} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                                <div className="relative w-full" style={{ height: `${hp}%` }}>
                                  <div className="w-full h-full rounded-t-sm bg-[#11875D]" title={`${d.year}: ${fmtM(d.paid)}`} />
                                </div>
                                <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{d.year}</span>
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
        const _recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
        const _recBg    = isBuy ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' : isSell ? 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' : 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]'
        const _targetUpside = q.analystTargetMean > 0 && q.price > 0 ? (q.analystTargetMean - q.price) / q.price : null
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
                  <p className="text-[13px] font-semibold text-[#06101F] mb-4">Quarterly Earnings Momentum</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Revenue chart */}
                    {maxRev > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-[#8A95A6] uppercase tracking-wide mb-2">Revenue</p>
                        <div className="flex items-end gap-1 h-28">
                          {sorted.map((r, i) => {
                            const val = revArr[i]
                            const yoy = yoyPct(i, revArr as number[])
                            const hp = val != null && maxRev > 0 ? Math.max(6, (val / maxRev) * 100) : 4
                            const positive = yoy == null || yoy >= 0
                            return (
                              <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-0.5">
                                {yoy != null && (
                                  <span className={`text-[10px] font-semibold leading-none ${positive ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                                    {positive ? '+' : ''}{(yoy * 100).toFixed(0)}%
                                  </span>
                                )}
                                <div className="relative w-full" style={{ height: `${hp}%` }}>
                                  <div className={`w-full h-full rounded-t-sm ${positive ? 'bg-[#2563EB]' : 'bg-[#CDD1C8]'}`}
                                    title={`${quarterLabel(r)}: ${sym}${fmtRevShort(val ?? 0)}`} />
                                </div>
                                <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{quarterLabel(r)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* EPS chart */}
                    {maxAbsEps > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-[#8A95A6] uppercase tracking-wide mb-2">EPS (Diluted)</p>
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
                                  <span className={`text-[10px] font-bold leading-none ${hasBeat ? 'text-[#11875D]' : hasMiss ? 'text-[#D83B3B]' : 'text-[#8A95A6]'}`}>
                                    {hasBeat ? '▲' : hasMiss ? '▼' : '—'}
                                  </span>
                                )}
                                <div className="relative w-full" style={{ height: `${hp}%` }}>
                                  <div className={`w-full h-full rounded-t-sm ${hasBeat ? 'bg-[#11875D]' : hasMiss ? 'bg-[#F0B8B8]' : isPositive ? 'bg-violet-400' : 'bg-[#CDD1C8]'}`}
                                    title={`${quarterLabel(r)}: ${sym}${val?.toFixed(2) ?? '—'}${beat != null ? ` (${beat > 0 ? '+' : ''}${beat.toFixed(1)}% surprise)` : ''}`} />
                                </div>
                                <span className="text-[10px] text-[#8A95A6] truncate max-w-full">{quarterLabel(r)}</span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#11875D] inline-block" />Beat</span>
                          <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-[#F0B8B8] inline-block" />Miss</span>
                          <span className="flex items-center gap-1 text-[10px] text-[#8A95A6]"><span className="w-2 h-2 rounded-sm bg-violet-400 inline-block" />Positive</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* A3: Analyst Recommendations + Price Targets */}
            {!hasAnalystCoverage ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[#8A95A6]">No analyst coverage available for this stock.</p>
                <p className="text-[11px] text-[#8A95A6] mt-1">Coverage is typically unavailable for small-cap or non-US stocks.</p>
              </div>
            ) : (
              <>
                {/* New visual charts */}
                <AnalystRecommendationsChart
                  trend={financialsData?.analystRatingTrend ?? []}
                  numAnalysts={ca.numAnalysts > 0 ? ca.numAnalysts : null}
                  currentPrice={q.price}
                  targetMean={q.analystTargetMean > 0 ? q.analystTargetMean : null}
                  targetLow={q.analystTargetLow ?? null}
                  targetHigh={q.analystTargetHigh ?? null}
                  currency={financialsData?.quote?.currency ?? 'USD'}
                />
                {/* A6: data source disclosure */}
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
                      <p className="text-[13px] font-semibold text-[#06101F] mb-3">Revenue Forecast</p>
                      <div className="flex items-end gap-1.5 h-36 px-1">
                        {allBars.map((bar, i) => {
                          const val = bar.value ?? 0
                          const heightPct = maxVal > 0 ? Math.max(4, (val / maxVal) * 100) : 4
                          const gr = (bar as any).growth
                          return (
                            <div key={`${bar.year}-${i}`} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end gap-1">
                              {gr != null && (
                                <span className={`text-[10px] font-semibold ${gr >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                                  {gr >= 0 ? '+' : ''}{(gr * 100).toFixed(0)}%
                                </span>
                              )}
                              <div className="relative w-full flex items-end" style={{ height: `${heightPct}%` }}>
                                <div
                                  className={`w-full rounded-t-sm transition-all ${bar.isProjected ? 'bg-blue-200 border border-dashed border-blue-400' : 'bg-[#EAF1FF]'}`}
                                  style={{ height: '100%' }}
                                  title={`${bar.year}: ${sym}${fmtRev(val)}`}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-[#566174] truncate max-w-full">{bar.year}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-[#566174]"><span className="inline-block w-3 h-2 rounded-sm bg-[#EAF1FF]" />Actual</span>
                        <span className="flex items-center gap-1 text-[10px] text-[#566174]"><span className="inline-block w-3 h-2 rounded-sm bg-blue-200 border border-dashed border-blue-400" />Estimate</span>
                      </div>
                    </div>
                  )
                })()}

                {/* A6: data source disclosure */}
                <p className="text-[11px] text-[#8A95A6] leading-relaxed">
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
                      <p className="text-[13px] font-semibold text-[#06101F] mb-3">Forward Estimates</p>
                      <div className="rounded-xl border border-[#E3E1DA] overflow-hidden">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="bg-[#F0F1F6] border-b border-[#E3E1DA]">
                              <th className="px-4 py-2 text-left font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Period</th>
                              {hasRevenue && <>
                                <th className="px-4 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Rev. Est.</th>
                                <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Rev. Growth</th>
                              </>}
                              {hasEPS && <>
                                <th className="px-4 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">EPS Est.</th>
                                <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">EPS Growth</th>
                              </>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E3E1DA] bg-white">
                            {fwdEst.map(row => {
                              const revGrowth = row.revenue.growth
                              const epsGrowth = row.eps.growth
                              const revAvg = row.revenue.avg
                              const epsAvg = row.eps.avg
                              return (
                                <tr key={row.period} className="hover:bg-[#F0F1F6]/60 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-[#06101F]">{periodLabel(row.period, row.endDate)}</td>
                                  {hasRevenue && <>
                                    <td className="px-4 py-3 text-right tabular-nums font-mono text-[#06101F] font-medium">
                                      {revAvg != null ? (revAvg >= 1e12 ? `${sym}${(revAvg / 1e12).toFixed(2)}T` : revAvg >= 1e9 ? `${sym}${(revAvg / 1e9).toFixed(1)}B` : revAvg >= 1e6 ? `${sym}${(revAvg / 1e6).toFixed(0)}M` : `${sym}${revAvg.toFixed(0)}`) : '—'}
                                      {row.revenue.analysts != null && <span className="text-[10px] text-[#8A95A6] ml-1">({row.revenue.analysts})</span>}
                                    </td>
                                    <td className={`px-3 py-3 text-right tabular-nums text-[12px] font-semibold ${revGrowth == null ? 'text-[#8A95A6]' : revGrowth >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                                      {revGrowth != null ? `${revGrowth >= 0 ? '+' : ''}${(revGrowth * 100).toFixed(1)}%` : '—'}
                                    </td>
                                  </>}
                                  {hasEPS && <>
                                    <td className="px-4 py-3 text-right tabular-nums font-mono text-[#06101F] font-medium">
                                      {epsAvg != null ? `${sym}${epsAvg.toFixed(2)}` : '—'}
                                      {row.eps.analysts != null && <span className="text-[10px] text-[#8A95A6] ml-1">({row.eps.analysts})</span>}
                                    </td>
                                    <td className={`px-3 py-3 text-right tabular-nums text-[12px] font-semibold ${epsGrowth == null ? 'text-[#8A95A6]' : epsGrowth >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                                      {epsGrowth != null ? `${epsGrowth >= 0 ? '+' : ''}${(epsGrowth * 100).toFixed(1)}%` : '—'}
                                    </td>
                                  </>}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-[#8A95A6] mt-1.5">Number in parentheses = analysts covering this estimate. Low/High ranges available from Yahoo Finance.</p>
                    </div>
                  )
                })()}

                {/* EPS Beat / Miss Chart */}
                {(() => {
                  const surprises = financialsData?.earningsSurprises ?? []
                  if (!surprises || surprises.length === 0) return null
                  // Derive YoY growth from financial statements
                  const is: any[] = financialsData?.financialStatements?.incomeStatement ?? []
                  const actuals = is.filter((r: any) => !r.isProjected)
                  const last2 = actuals.slice(-2)
                  const revGrowth = last2.length === 2 && last2[0].revenue > 0
                    ? (last2[1].revenue - last2[0].revenue) / last2[0].revenue : null
                  const niGrowth  = last2.length === 2 && last2[0].netIncome != null && last2[0].netIncome > 0
                    ? (last2[1].netIncome - last2[0].netIncome) / last2[0].netIncome : null
                  const epsGrowth = last2.length === 2 && last2[0].eps != null && last2[0].eps > 0
                    ? (last2[1].eps - last2[0].eps) / last2[0].eps : null
                  return (
                    <EpsBeatMissChart
                      surprises={surprises}
                      currency={financialsData?.quote?.currency ?? 'USD'}
                      revenueGrowthYoy={revGrowth}
                      netIncomeGrowthYoy={niGrowth}
                      epsGrowthYoy={epsGrowth}
                    />
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
                        <p className="text-[13px] font-semibold text-[#06101F]">Relative Valuation</p>
                        {allPeers.length > 0 && (
                          <span className="text-[10px] text-[#8A95A6]">
                            vs. {allPeers.slice(0, 4).join(', ')}{allPeers.length > 4 ? ` +${allPeers.length - 4}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl border border-[#E3E1DA] overflow-hidden divide-y divide-[#E3E1DA]">
                        {/* Header */}
                        <div className="grid grid-cols-4 px-4 py-2 bg-[#F0F1F6]">
                          <span className="text-[10px] font-semibold text-[#8A95A6] uppercase tracking-wide">Multiple</span>
                          <span className="text-[10px] font-semibold text-[#8A95A6] uppercase tracking-wide text-right">Current</span>
                          <span className="text-[10px] font-semibold text-[#8A95A6] uppercase tracking-wide text-right">Median</span>
                          <span className="text-[10px] font-semibold text-[#8A95A6] uppercase tracking-wide text-right">vs. Peers</span>
                        </div>
                        {applicableEsts.map(e => {
                          const premium = e.sectorMedian > 0 ? (e.actualValue - e.sectorMedian) / e.sectorMedian : null
                          const isDiscount = premium != null && premium < -0.05
                          const isPremium  = premium != null && premium > 0.05
                          return (
                            <div key={e.multiple} className="grid grid-cols-4 px-4 py-3 bg-white items-center">
                              <span className="text-[12px] font-medium text-[#06101F]">{e.multiple}</span>
                              <span className="text-[12px] font-bold text-[#06101F] tabular-nums text-right">
                                {e.actualValue.toFixed(1)}×
                              </span>
                              <span className="text-[12px] text-[#566174] tabular-nums text-right">
                                {e.sectorMedian.toFixed(1)}×
                              </span>
                              <div className="flex justify-end">
                                {premium != null ? (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                    isDiscount ? 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]' :
                                    isPremium  ? 'bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]' :
                                    'bg-[#F0F1F6] text-[#566174]'
                                  }`}>
                                    {premium >= 0 ? '+' : ''}{(premium * 100).toFixed(0)}%
                                  </span>
                                ) : <span className="text-[11px] text-[#8A95A6]">—</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-[#8A95A6] mt-2">
                        {allPeers.length > 0 ? 'Live peer medians' : 'Industry medians (Damodaran 2025)'}
                        . Discount = trading below peers; Premium = trading above.
                      </p>

                      {/* Per-peer breakdown table */}
                      {peerComps.length >= 2 && (
                        <div className="mt-4">
                          <p className="text-[12px] font-semibold text-[#566174] mb-2">Peer Comparison</p>
                          <div className="rounded-xl border border-[#E3E1DA] overflow-x-auto">
                            <table className="w-full text-[11px] min-w-[360px]">
                              <thead>
                                <tr className="bg-[#F0F1F6] border-b border-[#E3E1DA]">
                                  <th className="px-3 py-2 text-left font-semibold text-[#8A95A6] uppercase tracking-wide">Ticker</th>
                                  <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] uppercase tracking-wide">P/E</th>
                                  <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] uppercase tracking-wide">EV/EBITDA</th>
                                  <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] uppercase tracking-wide">P/B</th>
                                  <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] uppercase tracking-wide">P/S</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E3E1DA] bg-white">
                                {/* Current company row */}
                                <tr className="bg-[#EAF1FF]/60 font-semibold">
                                  <td className="px-3 py-2.5 text-[#2563EB] font-bold">{currTicker} ★</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-[#06101F]">{peEst != null ? peEst.toFixed(1) + '×' : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-[#06101F]">{evEbitdaEst != null ? evEbitdaEst.toFixed(1) + '×' : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-[#06101F]">{pbEst != null ? pbEst.toFixed(1) + '×' : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-[#06101F]">{psEst != null ? psEst.toFixed(1) + '×' : '—'}</td>
                                </tr>
                                {peerComps.map(p => (
                                  <tr key={p.ticker} className="hover:bg-[#F0F1F6]/60 transition-colors">
                                    <td className="px-3 py-2.5 font-mono font-bold text-[#06101F]">{p.ticker}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-[#566174]">{p.trailingPE != null ? p.trailingPE.toFixed(1) + '×' : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-[#566174]">{p.evToEbitda != null ? p.evToEbitda.toFixed(1) + '×' : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-[#566174]">{p.priceToBook != null ? p.priceToBook.toFixed(1) + '×' : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-[#566174]">{p.priceToSales != null ? p.priceToSales.toFixed(1) + '×' : '—'}</td>
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
            <div className="px-4 sm:px-5 py-8 text-center text-sm text-[#8A95A6]">
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
          { label: 'Institutions', pct: inst,    color: 'bg-[#EAF1FF]',  bar: 'bg-[#EAF1FF]',  text: 'text-[#2563EB]', bgLight: 'bg-[#EAF1FF]'   },
          { label: 'Insiders',     pct: insider,  color: 'bg-[#FFF4DA]', bar: 'bg-[#FFF4DA]', text: 'text-[#B56A00]',bgLight: 'bg-[#FFF4DA]'  },
          { label: 'Retail / Other', pct: retail, color: 'bg-[#CDD1C8]', bar: 'bg-[#CDD1C8]', text: 'text-[#566174]',bgLight: 'bg-[#F0F1F6]'  },
        ]
        return (
          <div className="px-4 sm:px-5 py-5 space-y-5">
            <div>
              <p className="text-[13px] font-semibold text-[#06101F] mb-3">Ownership Breakdown</p>
              {rawSum > 100 && (
                <p className="text-[10px] text-[#B56A00] mb-2">Note: Institutional + Insider sums to {rawSum.toFixed(1)}% — normalized to 100% for display.</p>
              )}
              <div className="space-y-3">
                {segments.map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                        <span className="text-[13px] text-[#566174]">{s.label}</span>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums font-mono text-[#06101F]">{s.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 bg-[#F0F1F6] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#E3E1DA] overflow-hidden">
              {segments.map(s => (
                <div key={s.label} className={`flex items-center justify-between px-4 py-3 border-b border-[#E3E1DA] last:border-0 ${s.bgLight}`}>
                  <span className="text-[13px] text-[#566174]">{s.label}</span>
                  <span className={`text-[15px] font-bold tabular-nums ${s.text}`}>{s.pct.toFixed(1)}%</span>
                </div>
              ))}
              {/* O5: public float */}
              {publicFloat != null && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E3E1DA] bg-white">
                  <span className="text-[13px] text-[#566174]">Public Float</span>
                  <span className="text-[13px] font-semibold text-[#06101F] tabular-nums">{fmtShares(publicFloat)} shares</span>
                </div>
              )}
            </div>
            {/* O1: short interest block */}
            {(shortPct != null || shortRatio != null) && (
              <div>
                <p className="text-[12px] font-semibold text-[#566174] mb-2">Short Interest</p>
                <div className="rounded-xl border border-[#E3E1DA] overflow-hidden">
                  {shortPct != null && (
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E3E1DA]">
                      <span className="text-[13px] text-[#566174]">Short % of Float</span>
                      <span className={`text-[13px] font-semibold tabular-nums ${shortPct > 10 ? 'text-[#D83B3B]' : shortPct > 5 ? 'text-[#B56A00]' : 'text-[#06101F]'}`}>
                        {shortPct.toFixed(1)}%
                        {/* O3: trend indicator badge */}
                        {shortPct > 10 && <span className="ml-1 text-[10px] bg-[#FCEAEA] text-[#D83B3B] px-1 py-0.5 rounded">High</span>}
                      </span>
                    </div>
                  )}
                  {shortRatio != null && (
                    <div className="flex items-center justify-between px-4 py-3 bg-white">
                      <span className="text-[13px] text-[#566174]">Days to Cover</span>
                      <span className="text-[13px] font-semibold text-[#06101F] tabular-nums">{(shortRatio as number).toFixed(1)} days</span>
                    </div>
                  )}
                  {shortPct != null && shortPct > 15 && shortRatio != null && (shortRatio as number) > 5 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-[#FCEAEA] border-t border-red-100">
                      <span className="text-[12px] font-semibold text-[#D83B3B]">Squeeze Risk</span>
                      <span className="text-[11px] text-[#D83B3B]">High short interest + slow coverage</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* O4: data lag disclosure */}
            <p className="text-[11px] text-[#8A95A6] leading-relaxed">
              Institutional ownership reflects 13F filings (lag up to 45 days). Insider ownership from most recent proxy statement.
              Short interest reported bi-monthly — may not reflect intraday changes.
            </p>

            {/* Insider Transactions feed */}
            {financialsData?.ticker && (
              <div>
                <p className="text-[13px] font-semibold text-[#06101F] mb-3">Recent Insider Transactions</p>
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
                  <p className="text-[13px] font-semibold text-[#06101F] mb-3">Top Institutional Holders</p>
                  <div className="rounded-xl border border-[#E3E1DA] overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[#F0F1F6] border-b border-[#E3E1DA]">
                          <th className="px-4 py-2 text-left font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Institution</th>
                          <th className="px-4 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Shares</th>
                          <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Weight</th>
                          <th className="px-3 py-2 text-right font-semibold text-[#8A95A6] text-[10px] uppercase tracking-wide">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E1DA] bg-white">
                        {holders.map((h, i) => {
                          const up = h.weightChange > 0.5
                          const dn = h.weightChange < -0.5
                          return (
                            <tr key={i} className="hover:bg-[#F0F1F6]/60 transition-colors">
                              <td className="px-4 py-3 text-[#06101F] font-medium">
                                <span className="truncate block max-w-[180px] sm:max-w-none">{h.name}</span>
                                {h.isNew && <span className="text-[10px] font-semibold text-[#2563EB] ml-0 mt-0.5 block">New position</span>}
                                {h.isSoldOut && <span className="text-[10px] font-semibold text-[#D83B3B] ml-0 mt-0.5 block">Sold out</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-mono text-[#566174]">{fmtShares(h.shares)}</td>
                              <td className="px-3 py-3 text-right tabular-nums font-mono text-[#566174]">{(h.weight * 100).toFixed(2)}%</td>
                              <td className="px-3 py-3 text-right tabular-nums font-mono">
                                <span className={`text-[11px] font-semibold ${up ? 'text-[#11875D]' : dn ? 'text-[#D83B3B]' : 'text-[#8A95A6]'}`}>
                                  {h.weightChange > 0 ? '+' : ''}{(h.weightChange).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-[#8A95A6] mt-1.5">Source: 13F filings · Weight = % of institution portfolio · Change = weight shift vs prior quarter</p>
                </div>
              )
            })()}

            {/* SEC Filings */}
            {(() => {
              const filings: Array<{ type: string; date: string; link: string }> = financialsData?.secFilings ?? []
              if (filings.length === 0) return null
              const typeStyle = (t: string) =>
                t === '10-K' ? 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]'
                : t === '10-Q' ? 'bg-violet-50 text-violet-700 border-violet-200'
                : t === 'DEF 14A' ? 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
                : 'bg-[#F0F1F6] text-[#566174] border-[#E3E1DA]'
              return (
                <div>
                  <p className="text-[13px] font-semibold text-[#06101F] mb-3">SEC Filings</p>
                  <div className="rounded-xl border border-[#E3E1DA] overflow-hidden divide-y divide-[#E3E1DA]">
                    {filings.map((f, i) => (
                      <a
                        key={i}
                        href={f.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-[#F0F1F6] transition-colors group"
                      >
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${typeStyle(f.type)}`}>
                          {f.type}
                        </span>
                        <span className="text-[12px] text-[#566174] tabular-nums">
                          {new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <svg className="w-3 h-3 text-[#8A95A6] group-hover:text-[#2563EB] transition-colors ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#8A95A6] mt-1.5">Direct links to SEC EDGAR filings · 10-K = annual report · 10-Q = quarterly · DEF 14A = proxy statement</p>
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
    {/* Data source attribution */}
    <p className="text-[10px] text-[#C0C0C0] px-4 pt-2 pb-4">Data source: Financial Modeling Prep (FMP) · Prices: Yahoo Finance</p>
    </>
  )
}
