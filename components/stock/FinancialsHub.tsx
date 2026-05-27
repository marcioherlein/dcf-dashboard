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

type SubTab = 'statements' | 'growth' | 'profitability' | 'solvency' | 'analysts' | 'snapshot' | 'ownership'
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'statements',    label: 'Statements'    },
  { id: 'growth',        label: 'Growth'        },
  { id: 'profitability', label: 'Profitability' },
  { id: 'solvency',      label: 'Solvency'      },
  { id: 'analysts',      label: 'Analysts'      },
  { id: 'snapshot',      label: 'Snapshot'      },
  { id: 'ownership',     label: 'Ownership'     },
]

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
  const nums = arr.filter((v): v is number => v != null && v > 0)
  if (nums.length < n + 1) return null
  const oldest = nums[nums.length - 1 - n]
  const newest = nums[nums.length - 1]
  if (oldest <= 0) return null
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
  const pts = values.slice(-6).filter((v): v is number => v != null)
  if (pts.length < 2) return <span className="inline-block w-9" />
  const mx = Math.max(...pts.map(Math.abs), 0.0001)
  const barW = 5, gap = 2
  const totalW = pts.length * (barW + gap) - gap
  return (
    <svg width={totalW} height={16} className="shrink-0 inline-block align-middle mr-1.5">
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
  fmt:             'pct' | 'growth' | 'x' | 'days' | 'score'
  positiveIsGood?: boolean
  isHeader?:       boolean
  indent?:         boolean
}

function MetricsTable({ columns, rows }: { columns: string[]; rows: MetricRowDef[] }) {
  const formatVal = (v: number | null, fmt: string) => {
    switch (fmt) {
      case 'pct':    return fmtPct(v)
      case 'growth': return fmtGrowth(v)
      case 'x':      return fmtX(v)
      case 'days':   return fmtDays(v)
      case 'score':  return v != null ? v.toFixed(2) : '—'
      default:       return v != null ? v.toFixed(2) : '—'
    }
  }

  const cellColor = (v: number | null, fmt: string, positiveIsGood = true) => {
    if (fmt === 'growth') return growthColor(v)
    if (fmt === 'pct' || fmt === 'x' || fmt === 'days' || fmt === 'score') return valColor(v, positiveIsGood)
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
                  <td colSpan={columns.length + 1} className="px-3 sm:px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
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
  const dpo     = ap != null && (cogs ?? rev) != null ? 365 / (Math.abs(cogs ?? rev!) / ap) : null
  const ccc     = dso != null && dio != null && dpo != null ? dso + dio - dpo : null
  const currRatio = safe(currA, currL, (a,b) => a/b)
  const quickRatio = currL != null && currA != null && inv != null ? (currA - inv) / currL : null
  const ocfToCurrL = safe(ocf, currL, (a,b) => a/b)

  // Solvency
  const debtToEq   = safe(totalDebt, equity, (a,b) => a/b)
  const ltDebtToEq = safe(ltDebt,    equity, (a,b) => a/b)
  const debtToCap  = (totalDebt != null && equity != null) ? totalDebt / (totalDebt + equity) : null
  const ltDebtToCap = (ltDebt != null && equity != null)   ? ltDebt   / (ltDebt   + equity) : null
  const liabToAssets = safe(totalLiab, totalAssets, (a,b) => a/b)
  const debtToEbitda = safe(totalDebt, ebitda, (a,b) => a/b)
  const netDebtToEbitda = safe(netDebt, ebitda, (a,b) => a/b)
  const ebitCov  = intEx != null && intEx !== 0 ? safe(ebit,  intEx, (a,b) => a/Math.abs(b)) : null
  const ebitdaCov = intEx != null && intEx !== 0 ? safe(ebitda, intEx, (a,b) => a/Math.abs(b)) : null
  const ebitdaCapexCov = (ebitda != null && capex != null && intEx != null && intEx !== 0)
    ? (ebitda + capex) / Math.abs(intEx) : null

  return {
    rev, gp, ebit, ebitda, ni, eps, ocf, fcf, da, sga, rnd, cogs,
    grossMargin, ebitMargin, ebitdaMargin, netMargin, sgaMargin, rndMargin, ocfToRev,
    roa, roe, roic,
    assetTO, recTO, invTO, ppeTO, dso, dio, dpo, ccc, currRatio, quickRatio, ocfToCurrL,
    debtToEq, ltDebtToEq, debtToCap, ltDebtToCap, liabToAssets,
    debtToEbitda, netDebtToEbitda, ebitCov, ebitdaCov, ebitdaCapexCov,
    totalDebt, ltDebt, cash, equity, netDebt,
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

  const growthRows = useMemo((): MetricRowDef[] => {
    const revs  = mets.map(m => m.rev)
    const gps   = mets.map(m => m.gp)
    const ebits = mets.map(m => m.ebit)
    const ebitdas = mets.map(m => m.ebitda)
    const nis   = mets.map(m => m.ni)
    const epss  = mets.map(m => m.eps)
    const fcfs  = mets.map(m => m.fcf)

    const yoyArr = (arr: (number | null)[]) => arr.map((v, i) => i === 0 ? null : yoy(v, arr[i - 1]))

    return [
      { label: 'Revenue',         isHeader: false, fmt: 'growth', positiveIsGood: true, values: yoyArr(revs) },
      { label: 'Gross Profit',    isHeader: false, fmt: 'growth', positiveIsGood: true, values: yoyArr(gps) },
      { label: 'EBITDA',          isHeader: false, fmt: 'growth', positiveIsGood: true, values: yoyArr(ebitdas) },
      { label: 'EBIT / Op. Income', fmt: 'growth', positiveIsGood: true, values: yoyArr(ebits) },
      { label: 'Net Income',      isHeader: false, fmt: 'growth', positiveIsGood: true, values: yoyArr(nis) },
      { label: 'EPS (Diluted)',   isHeader: false, fmt: 'growth', positiveIsGood: true, values: yoyArr(epss) },
      { label: 'Free Cash Flow',  isHeader: false, fmt: 'growth', positiveIsGood: true, values: yoyArr(fcfs) },
    ]
  }, [mets])

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
      makeRow('Revenue',           arr(m => m.rev)),
      makeRow('Gross Profit',      arr(m => m.gp)),
      makeRow('EBITDA',            arr(m => m.ebitda)),
      makeRow('EBIT',              arr(m => m.ebit)),
      makeRow('Net Income',        arr(m => m.ni)),
      makeRow('EPS (Diluted)',     arr(m => m.eps)),
      makeRow('Free Cash Flow',    arr(m => m.fcf)),
    ]
  }, [mets, periods])

  // ── Profitability data ─────────────────────────────────────────────────────

  const profitRows = useMemo((): MetricRowDef[] => {
    const v = (fn: (m: ReturnType<typeof metrics>) => number | null) => mets.map(fn)
    return [
      { label: 'Margins', isHeader: true, fmt: 'pct', values: [] },
      { label: 'Gross Margin',    fmt: 'pct', positiveIsGood: true,  values: v(m => m.grossMargin)  },
      { label: 'EBITDA Margin',   fmt: 'pct', positiveIsGood: true,  values: v(m => m.ebitdaMargin) },
      { label: 'EBIT Margin',     fmt: 'pct', positiveIsGood: true,  values: v(m => m.ebitMargin)   },
      { label: 'Net Margin',      fmt: 'pct', positiveIsGood: true,  values: v(m => m.netMargin)    },
      { label: 'SG&A / Revenue',  fmt: 'pct', positiveIsGood: false, values: v(m => m.sgaMargin)    },
      { label: 'R&D / Revenue',   fmt: 'pct', positiveIsGood: true,  values: v(m => m.rndMargin)    },
      { label: 'FCF Margin',      fmt: 'pct', positiveIsGood: true,  values: v(m => m.ocfToRev)     },

      { label: 'Returns', isHeader: true, fmt: 'pct', values: [] },
      { label: 'Return on Assets (ROA)',   fmt: 'pct', positiveIsGood: true, values: v(m => m.roa)  },
      { label: 'Return on Equity (ROE)',   fmt: 'pct', positiveIsGood: true, values: v(m => m.roe)  },
      { label: 'Return on Inv. Capital',   fmt: 'pct', positiveIsGood: true, values: v(m => m.roic) },

      { label: 'Asset Efficiency', isHeader: true, fmt: 'x', values: [] },
      { label: 'Asset Turnover',         fmt: 'x',    positiveIsGood: true,  values: v(m => m.assetTO) },
      { label: 'Receivables Turnover',   fmt: 'x',    positiveIsGood: true,  values: v(m => m.recTO)   },
      { label: 'Inventory Turnover',     fmt: 'x',    positiveIsGood: true,  values: v(m => m.invTO)   },
      { label: 'Fixed Asset Turnover',   fmt: 'x',    positiveIsGood: true,  values: v(m => m.ppeTO)   },

      { label: 'Liquidity', isHeader: true, fmt: 'x', values: [] },
      { label: 'Current Ratio',         fmt: 'x',    positiveIsGood: true,  values: v(m => m.currRatio)    },
      { label: 'Quick Ratio',           fmt: 'x',    positiveIsGood: true,  values: v(m => m.quickRatio)   },
      { label: 'Days Sales Outstanding',fmt: 'days', positiveIsGood: false, values: v(m => m.dso)          },
      { label: 'Days Inventory Outstanding', fmt: 'days', positiveIsGood: false, values: v(m => m.dio)     },
      { label: 'Days Payable Outstanding',   fmt: 'days', positiveIsGood: true,  values: v(m => m.dpo)     },
      { label: 'Cash Conversion Cycle', fmt: 'days', positiveIsGood: false, values: v(m => m.ccc)          },
      { label: 'Op. CF / Current Liab.',fmt: 'x',    positiveIsGood: true,  values: v(m => m.ocfToCurrL)   },
    ]
  }, [mets])

  // ── Solvency data ──────────────────────────────────────────────────────────

  const solvencyRows = useMemo((): MetricRowDef[] => {
    const v = (fn: (m: ReturnType<typeof metrics>) => number | null) => mets.map(fn)
    return [
      { label: 'Leverage', isHeader: true, fmt: 'x', values: [] },
      { label: 'Total Debt / Equity',     fmt: 'x',   positiveIsGood: false, values: v(m => m.debtToEq)    },
      { label: 'LT Debt / Equity',        fmt: 'x',   positiveIsGood: false, values: v(m => m.ltDebtToEq)  },
      { label: 'Total Debt / Capital',    fmt: 'pct', positiveIsGood: false, values: v(m => m.debtToCap)   },
      { label: 'LT Debt / Capital',       fmt: 'pct', positiveIsGood: false, values: v(m => m.ltDebtToCap) },
      { label: 'Total Liab. / Assets',    fmt: 'pct', positiveIsGood: false, values: v(m => m.liabToAssets)},

      { label: 'Interest Coverage', isHeader: true, fmt: 'x', values: [] },
      { label: 'EBIT / Interest',             fmt: 'x', positiveIsGood: true, values: v(m => m.ebitCov)         },
      { label: 'EBITDA / Interest',           fmt: 'x', positiveIsGood: true, values: v(m => m.ebitdaCov)       },
      { label: '(EBITDA − Capex) / Interest', fmt: 'x', positiveIsGood: true, values: v(m => m.ebitdaCapexCov)  },

      { label: 'Debt Capacity', isHeader: true, fmt: 'x', values: [] },
      { label: 'Total Debt / EBITDA',     fmt: 'x', positiveIsGood: false, values: v(m => m.debtToEbitda)     },
      { label: 'Net Debt / EBITDA',       fmt: 'x', positiveIsGood: false, values: v(m => m.netDebtToEbitda)  },
    ]
  }, [mets])

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasData = periods.length > 0

  return (
    <div className="rounded-xl card overflow-hidden">
      {/* Sub-tab nav — scrollable on mobile */}
      <div className="flex items-center justify-between px-2 sm:px-5 pt-4 pb-0 border-b border-slate-100 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`px-3 sm:px-4 py-3 text-[12px] sm:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      {!hasData && (
        <div className="py-12 text-center text-sm text-slate-400">
          Financial data unavailable
        </div>
      )}

      {/* ── Statements ── */}
      {subTab === 'statements' && hasData && (
        <div className="space-y-0">
          <YahooFinancials
            statementsData={statementsData}
            currency={currency}
            reportingCurrency={reportingCurrency}
            highlight={highlight ?? undefined}
          />
          {(finCF.length > 0 && finIS.filter((r: { isProjected: boolean }) => !r.isProjected).length >= 2) && (
            <div className="border-t border-slate-100">
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
              />
            </div>
          )}
        </div>
      )}

      {/* ── Growth ── */}
      {subTab === 'growth' && hasData && (
        <div>
          {/* CAGR Summary */}
          <div className="px-4 sm:px-5 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Compound Annual Growth Rates
            </p>
            <CAGRTable rows={cagrRows} />
          </div>
          {/* YoY by period */}
          <div className="border-t border-slate-100 px-4 sm:px-5 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Year-over-Year Growth
            </p>
            <MetricsTable columns={cols} rows={growthRows} />
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
        </div>
      )}

      {/* ── Analysts ── */}
      {subTab === 'analysts' && (() => {
        const q = financialsData?.quote ?? {}
        const ca = financialsData?.cagrAnalysis ?? {}
        const rec = (financialsData?.analystRecommendation ?? '').toLowerCase()
        const isBuy  = rec.includes('buy') || rec === 'strong_buy' || rec === 'strongbuy'
        const isSell = rec.includes('sell') || rec.includes('underperform') || rec.includes('underweight')
        const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
        const recBg    = isBuy ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : isSell ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
        const sym = q.currency === 'BRL' ? 'R$ ' : q.currency === 'USD' ? '$' : (q.currency ?? '$') + ' '
        const targetUpside = q.analystTargetMean > 0 && q.price > 0 ? (q.analystTargetMean - q.price) / q.price : null
        return (
          <div className="px-4 sm:px-5 py-5 space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Consensus Rating</p>
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-sm font-bold px-4 py-1.5 rounded-full border ${recBg}`}>{recLabel}</span>
                {ca.numAnalysts > 0 && <span className="text-[12px] text-slate-400">{ca.numAnalysts} analysts covering this stock</span>}
              </div>
            </div>
            {q.analystTargetMean > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Price Targets</p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {[
                    { label: 'Average Target',  val: q.analystTargetMean,  upside: targetUpside, highlight: true },
                    { label: 'Low Target',       val: q.analystTargetLow,   upside: q.analystTargetLow  != null && q.price > 0 ? (q.analystTargetLow  - q.price) / q.price : null, highlight: false },
                    { label: 'High Target',      val: q.analystTargetHigh,  upside: q.analystTargetHigh != null && q.price > 0 ? (q.analystTargetHigh - q.price) / q.price : null, highlight: false },
                    { label: 'Current Price',    val: q.price,              upside: null, highlight: false },
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
                {q.analystTargetLow != null && q.analystTargetHigh != null && q.analystTargetMean > 0 && (() => {
                  const lo = q.analystTargetLow as number
                  const hi = q.analystTargetHigh as number
                  const avg = q.analystTargetMean as number
                  const span = hi - lo
                  const avgPct = span > 0 ? Math.max(2, Math.min(98, ((avg - lo) / span) * 100)) : 50
                  const pricePct = span > 0 ? Math.max(2, Math.min(98, ((q.price - lo) / span) * 100)) : 50
                  return (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Target Range</p>
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
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Analyst targets represent Wall Street consensus. They may differ from our intrinsic value model, which uses discounted cash flow analysis.
            </p>
          </div>
        )
      })()}

      {/* ── Snapshot ── */}
      {subTab === 'snapshot' && (() => {
        const q = financialsData?.quote ?? {}
        const fv = financialsData?.fairValue ?? {}
        const wacc = financialsData?.wacc ?? {}
        const sym = q.currency === 'BRL' ? 'R$ ' : q.currency === 'USD' ? '$' : (q.currency ?? '$') + ' '
        function fmtLarge(v: number) {
          if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`
          if (v >= 1e9)  return `${sym}${(v / 1e9).toFixed(2)}B`
          if (v >= 1e6)  return `${sym}${(v / 1e6).toFixed(2)}M`
          return `${sym}${v.toLocaleString()}`
        }
        const rows: { label: string; value: string | null }[] = [
          { label: 'Current Price',       value: q.price > 0 ? `${sym}${q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null },
          { label: 'Market Cap',          value: q.marketCap > 0 ? fmtLarge(q.marketCap) : null },
          { label: 'Enterprise Value',    value: fv.ev > 0 ? fmtLarge(fv.ev) : null },
          { label: 'P/E (TTM)',           value: q.peRatio > 0 && q.peRatio < 2000 ? `${q.peRatio.toFixed(1)}×` : null },
          { label: 'PEG (5Y)',            value: q.pegRatio > 0 && q.pegRatio < 100 ? `${q.pegRatio.toFixed(2)}×` : null },
          { label: 'Beta',                value: wacc?.inputs?.beta != null ? wacc.inputs.beta.toFixed(2) : null },
          { label: 'Shares Outstanding',  value: q.sharesOutstanding > 0 ? (q.sharesOutstanding >= 1e9 ? `${(q.sharesOutstanding/1e9).toFixed(1)}B` : q.sharesOutstanding >= 1e6 ? `${(q.sharesOutstanding/1e6).toFixed(1)}M` : q.sharesOutstanding.toLocaleString()) : null },
          { label: '52W High',            value: q.fiftyTwoWeekHigh > 0 ? `${sym}${q.fiftyTwoWeekHigh.toFixed(2)}` : null },
          { label: '52W Low',             value: q.fiftyTwoWeekLow  > 0 ? `${sym}${q.fiftyTwoWeekLow.toFixed(2)}`  : null },
          { label: 'Next Earnings',       value: q.nextEarningsDate ? new Date(q.nextEarningsDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null },
          { label: 'Sector',              value: q.sector || null },
          { label: 'Exchange',            value: q.exchange ? (q.exchange as string).replace(/nasdaq.*/i, 'NASDAQ').replace(/nyse.*/i, 'NYSE') : null },
        ].filter(r => r.value != null)
        return (
          <div className="px-4 sm:px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Market & Valuation Snapshot</p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {rows.map(r => (
                <div key={r.label} className="flex items-center justify-between px-4 py-3 bg-white">
                  <span className="text-[13px] text-slate-500">{r.label}</span>
                  <span className="text-[13px] font-semibold text-slate-800 tabular-nums">{r.value}</span>
                </div>
              ))}
            </div>
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
        const inst    = ownership.institutionalPct ?? 0
        const insider = ownership.insiderPct ?? 0
        const retail  = Math.max(0, 100 - inst - insider)
        const segments = [
          { label: 'Institutions', pct: inst,    color: 'bg-blue-500',  bar: 'bg-blue-500',  text: 'text-blue-700', bgLight: 'bg-blue-50'   },
          { label: 'Insiders',     pct: insider,  color: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700',bgLight: 'bg-amber-50'  },
          { label: 'Retail / Other', pct: retail, color: 'bg-slate-300', bar: 'bg-slate-300', text: 'text-slate-600',bgLight: 'bg-slate-50'  },
        ]
        return (
          <div className="px-4 sm:px-5 py-5 space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Ownership Breakdown</p>
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
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.bar} transition-all duration-500`} style={{ width: `${s.pct}%` }} />
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
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Institutional ownership reflects 13F filings. Insider ownership based on most recent proxy statement. Data may lag by up to 45 days.
            </p>
          </div>
        )
      })()}
    </div>
  )
}
