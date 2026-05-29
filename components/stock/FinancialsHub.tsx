'use client'
import { useState, useMemo, useEffect } from 'react'
import YahooFinancials from './YahooFinancials'
import FinancialCharts from './FinancialCharts'

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

function yoy(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null
  return (curr - prev) / Math.abs(prev)
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

function MetricsTable({ columns, rows }: { columns: string[]; rows: MetricRowDef[] }) {
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
            <th className="sticky left-0 z-10 bg-white px-3 sm:px-4 py-2 text-left text-[11px] font-medium text-slate-400 w-40 min-w-[160px] sm:w-56 sm:min-w-[224px]">
              Metric
            </th>
            {columns.map(col => (
              <th key={col} className={`px-2 sm:px-3 py-2 text-right text-[11px] font-semibold whitespace-nowrap ${
                col === 'TTM' ? 'text-amber-600' : 'text-slate-500'
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
                  <Sparkline values={row.values} positiveIsGood={pig} />
                  {row.label}
                  {row.positiveIsGood != null && !row.indent && (
                    <span className="ml-1 text-[9px] text-slate-400 font-normal" aria-label={row.positiveIsGood ? 'higher is better' : 'lower is better'}>
                      {row.positiveIsGood ? '↑' : '↓'}
                    </span>
                  )}
                  {/* Fix P4: render tooltip as native title for turnover/days metrics */}
                  {row.tooltip && (
                    <span title={row.tooltip} className="ml-1 text-slate-400 cursor-help select-none" aria-label={row.tooltip}>ⓘ</span>
                  )}
                </td>
                {row.values.map((v, j) => (
                  <td key={j} className={`px-2 sm:px-3 py-2 text-right text-xs tabular-nums font-mono whitespace-nowrap ${
                    columns[j] === 'TTM' ? 'font-semibold' : ''
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

// ── CAGR summary table ─────────────────────────────────────────────────────────

interface CAGRRow { label: string; yoy: number | null; y3: number | null; y5: number | null }

function CAGRTable({ rows }: { rows: CAGRRow[] }) {
  const horizons = ['YoY', '3Y CAGR', '5Y CAGR']
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="min-w-[360px] w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="sticky left-0 z-10 bg-white px-3 sm:px-4 py-2 text-left text-[11px] font-medium text-slate-400 w-40 min-w-[160px] sm:w-56 sm:min-w-[224px]">Metric</th>
            {horizons.map(h => (
              <th key={h} className="px-3 sm:px-5 py-2 text-right text-[11px] font-semibold text-slate-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="sticky left-0 z-10 bg-white px-3 sm:px-4 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                {row.label}
              </td>
              {[row.yoy, row.y3, row.y5].map((v, j) => (
                <td key={j} className={`px-3 sm:px-5 py-2.5 text-right text-xs tabular-nums font-mono font-semibold whitespace-nowrap ${growthColor(v)}`}>
                  {fmtGrowth(v)}
                </td>
              ))}
            </tr>
          ))}
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
  const ebit  = n(is.operatingIncome ?? is.EBIT)
  const ebitda = n(is.EBITDA)
  const ni    = n(is.netIncome)
  const eps   = n(is.dilutedEPS)
  const sga   = n(is.sellingGeneralAndAdministration)
  const rnd   = n(is.researchAndDevelopment)
  const intEx = n(is.interestExpenseNonOperating ?? is.interestExpense)
  const tax   = n(is.taxRateForCalcs)
  const da    = n(cf.depreciationAndAmortization ?? cf.reconciledDepreciation)

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

  const periods = useMemo(() => buildPeriods(statementsData), [statementsData])
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

  // ── Growth data ────────────────────────────────────────────────────────────

  // G6: financial sector EBITDA is less meaningful (no capex-heavy assets)
  const isFinancialSector = ['Financial Services', 'Financials', 'Banks', 'Insurance', 'Financial'].some(
    s => (financialsData?.quote?.sector ?? '').includes(s) || (financialsData?.businessProfile?.sector ?? '').includes(s)
  )

  const growthRows = useMemo((): MetricRowDef[] => {
    const revs    = mets.map(m => m.rev)
    const gps     = mets.map(m => m.gp)
    const ebits   = mets.map(m => m.ebit)
    const ebitdas = mets.map(m => m.ebitda)
    const nis     = mets.map(m => m.ni)
    const epss    = mets.map(m => m.eps)
    const fcfs    = mets.map(m => m.fcf)

    // Fix G2: include a prior-year seed so every displayed column has a value.
    // yoyArr(arr) produces one fewer non-null values — slice away the always-null
    // first element in the caller, keeping columns aligned.
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
  }, [mets, isFinancialSector])

  // Fix G2: YoY table columns skip the oldest period (always "—"); use slice(1).
  const yoyCols  = cols.length > 1 ? cols.slice(1)  : cols

  const cagrRows = useMemo((): CAGRRow[] => {
    const annualOnly = mets.filter(m => periods[mets.indexOf(m)]?.year !== 'TTM')
    const arr = (fn: (m: ReturnType<typeof metrics>) => number | null) => annualOnly.map(fn)

    const makeRow = (label: string, vals: (number | null)[]): CAGRRow => ({
      label,
      yoy: vals.length >= 2 ? yoy(vals[vals.length - 1], vals[vals.length - 2]) : null,
      y3:  cagrN(vals, 3),
      y5:  cagrN(vals, 5),
    })

    return [
      makeRow('Revenue',        arr(m => m.rev)),
      makeRow('Gross Profit',   arr(m => m.gp)),
      ...(!isFinancialSector ? [makeRow('EBITDA', arr(m => m.ebitda))] : []),
      makeRow('EBIT',           arr(m => m.ebit)),
      makeRow('Net Income',     arr(m => m.ni)),
      makeRow('EPS (Diluted)',  arr(m => m.eps)),
      makeRow('Free Cash Flow', arr(m => m.fcf)),
    ]
  }, [mets, periods, isFinancialSector])

  // Fix G5: analyst consensus EPS growth estimates from cagrAnalysis
  const analystEst1y = (financialsData?.cagrAnalysis?.analystEstimate1y ?? null) as number | null
  const analystEst2y = (financialsData?.cagrAnalysis?.analystEstimate2y ?? null) as number | null

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
      { label: 'Short-Term Debt',         fmt: '$M',  positiveIsGood: false, values: v(m => m.stDebt),        tooltip: 'Current portion of debt due within 12 months.' },
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

  const showCharts = (subTab === 'statements' || subTab === 'growth' || subTab === 'profitability') && hasData
    && finCF.length > 0
    && finIS.filter((r: { isProjected: boolean }) => !r.isProjected).length >= 2

  return (
    <>
    <div className="rounded-xl card overflow-hidden">
      {/* Sub-tab nav — scrollable on mobile */}
      <div className="flex items-center justify-between px-2 sm:px-5 pt-4 pb-0 border-b border-slate-100 overflow-x-auto scrollbar-none -webkit-overflow-scrolling-touch">
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
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
      {subTab === 'growth' && hasData && (
        <div>
          {/* CAGR Summary */}
          <div className="px-4 sm:px-5 pt-4 pb-2">
                <p className="text-[13px] font-semibold text-slate-700 mb-3">
                  Compound Annual Growth Rates
                </p>
            <CAGRTable rows={cagrRows} />
            {/* G5: Analyst forward estimates */}
            {(analystEst1y != null || analystEst2y != null) && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[12px] font-semibold text-slate-600 mb-2">Analyst EPS Growth Estimates</p>
                <div className="flex gap-4">
                  {analystEst1y != null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400">Next Year</span>
                      <span className={`text-sm font-bold tabular-nums ${analystEst1y >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {analystEst1y >= 0 ? '+' : ''}{(analystEst1y * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {analystEst2y != null && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400">2-Year</span>
                      <span className={`text-sm font-bold tabular-nums ${analystEst2y >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {analystEst2y >= 0 ? '+' : ''}{(analystEst2y * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* G1: Revenue growth bar chart */}
          {(() => {
            const revGrowthData = yoyCols.map((col) => {
              const fullIdx = cols.indexOf(col)
              const val = growthRows[0]?.values[fullIdx] ?? null
              return { col, val }
            }).filter(d => d.val != null)
            if (revGrowthData.length < 2) return null
            const maxAbs = Math.max(...revGrowthData.map(d => Math.abs(d.val as number)))
            return (
              <div className="border-t border-slate-100 px-4 sm:px-5 pt-4 pb-2">
                <p className="text-[13px] font-semibold text-slate-700 mb-3">Revenue Growth by Year</p>
                <div className="flex items-end gap-1.5" style={{ height: 56 }}>
                  {revGrowthData.map(({ col, val }) => {
                    const v = val as number
                    const barH = Math.max(3, (Math.abs(v) / (maxAbs || 1)) * 44)
                    const isPos = v >= 0
                    return (
                      <div key={col} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                        <div className={`w-full rounded-sm ${isPos ? 'bg-emerald-400/70' : 'bg-red-400/70'}`} style={{ height: barH }} />
                        <span className="text-[10px] text-slate-500">{col.slice(-2)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-0.5 text-[10px] text-slate-500 tabular-nums">
                  {revGrowthData.map(({ col, val }) => (
                    <span key={col} className={val! >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {val! >= 0 ? '+' : ''}{((val as number) * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
          {/* YoY by period — G2: use yoyCols to skip always-null first column */}
          <div className="border-t border-slate-100 px-4 sm:px-5 pt-4 pb-2">
            <p className="text-[13px] font-semibold text-slate-700 mb-3">
              Year-over-Year Growth
            </p>
            <MetricsTable columns={yoyCols} rows={growthRows.map(r => ({ ...r, values: r.values.slice(1) }))} />
          </div>
        </div>
      )}

      {/* ── Profitability ── */}
      {subTab === 'profitability' && hasData && (
        <div className="px-4 sm:px-5 pt-2 pb-2">
          <MetricsTable columns={cols} rows={profitRows} />
        </div>
      )}

      {/* ── Solvency ── */}
      {subTab === 'solvency' && hasData && (
        <div className="px-4 sm:px-5 pt-2 pb-2">
          <MetricsTable columns={cols} rows={solvencyRows} />
          <p className="text-[10px] text-slate-400 mt-2 px-1">
            Net Debt = Total Debt − Cash & Equivalents. Negative Net Debt means net cash position.
            Total Liab./Assets includes operating liabilities (deferred revenue, lease obligations) — not purely financial debt.
            Cash Runway only shown when operating cash flow is negative.
          </p>
        </div>
      )}

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
                </div>
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
                {/* A6: data source disclosure */}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Analyst targets represent Wall Street consensus sourced from Yahoo Finance. They may differ from our intrinsic value model, which uses discounted cash flow analysis. Targets are typically 12-month forward estimates.
                </p>
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
                      <span className="text-[13px] font-bold tabular-nums text-slate-800">{s.pct.toFixed(1)}%</span>
                    </div>
                    {/* O6: animate width on mount via CSS transition (bar starts at 0 via inline, then CSS transition runs) */}
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.bar} transition-all duration-700 ease-out`} style={{ width: `${s.pct}%` }} />
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
                </div>
              </div>
            )}
            {/* O4: data lag disclosure */}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Institutional ownership reflects 13F filings (lag up to 45 days). Insider ownership from most recent proxy statement.
              Short interest reported bi-monthly — may not reflect intraday changes.
            </p>
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
        historicalMultiples={subTab === 'statements' ? (financialsData?.historicalMultiples ?? []) : []}
        currentPE={financialsData?.quote?.peRatio ?? null}
        currentEVEbitda={financialsData?.businessProfile?.evToEbitda ?? null}
        currentEVRevenue={financialsData?.businessProfile?.evToRevenue ?? null}
        currentPS={financialsData?.businessProfile?.priceToSales ?? null}
        chartsToShow={
          subTab === 'growth'        ? ['revGrowth', 'fcfGrowth'] :
          subTab === 'profitability' ? ['margins', 'ebitda']      :
          undefined
        }
      />
    )}
    </>
  )
}
