'use client'
import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'annual' | 'quarterly'
type StatementType = 'income' | 'balance' | 'cashflow'

interface RowDef {
  key: string
  label: string
  indent: number
  bold?: boolean
  isEPS?: boolean   // format as raw decimal (not /1000)
  isPct?: boolean   // format as percentage
  children?: RowDef[]
}

// ─── Income Statement rows (Yahoo Finance order, camelCase keys) ──────────────

const INCOME_ROWS: RowDef[] = [
  {
    key: 'totalRevenue', label: 'Total Revenue', indent: 0, bold: true,
    children: [
      { key: 'operatingRevenue', label: 'Operating Revenue', indent: 1 },
    ],
  },
  { key: 'costOfRevenue', label: 'Cost of Revenue', indent: 0 },
  { key: 'grossProfit', label: 'Gross Profit', indent: 0, bold: true },
  {
    key: 'operatingExpense', label: 'Operating Expense', indent: 0, bold: true,
    children: [
      {
        key: 'sellingGeneralAndAdministration', label: 'Selling General and Admin', indent: 1,
        children: [
          { key: 'generalAndAdministrativeExpense', label: 'General and Administrative', indent: 2 },
          { key: 'otherGandA', label: 'Other G&A', indent: 2 },
          { key: 'sellingAndMarketingExpense', label: 'Selling & Marketing', indent: 2 },
        ],
      },
      { key: 'researchAndDevelopment', label: 'Research & Development', indent: 1 },
    ],
  },
  { key: 'operatingIncome', label: 'Operating Income', indent: 0, bold: true },
  {
    key: 'netNonOperatingInterestIncomeExpense', label: 'Net Non Operating Interest Income Expense', indent: 0,
    children: [
      { key: 'interestIncomeNonOperating', label: 'Interest Income Non Operating', indent: 1 },
      { key: 'interestExpenseNonOperating', label: 'Interest Expense Non Operating', indent: 1 },
    ],
  },
  {
    key: 'otherIncomeExpense', label: 'Other Income Expense', indent: 0,
    children: [
      { key: 'gainOnSaleOfSecurity', label: 'Gain on Sale of Security', indent: 1 },
      {
        key: 'specialIncomeCharges', label: 'Special Income Charges', indent: 1,
        children: [
          { key: 'writeOff', label: 'Write Off', indent: 2 },
        ],
      },
      { key: 'otherNonOperatingIncomeExpenses', label: 'Other Non Operating Income Expenses', indent: 1 },
    ],
  },
  { key: 'pretaxIncome', label: 'Pretax Income', indent: 0, bold: true },
  { key: 'taxProvision', label: 'Tax Provision', indent: 1 },
  { key: 'taxRateForCalcs', label: 'Tax Rate For Calcs', indent: 1, isPct: true },
  {
    key: 'netIncomeCommonStockholders', label: 'Net Income Common Stockholders', indent: 0, bold: true,
    children: [
      { key: 'netIncome', label: 'Net Income', indent: 1 },
      { key: 'dilutedNIAvailtoComStockholders', label: 'Diluted NI Available to Com. Stockholders', indent: 1 },
    ],
  },
  { key: 'basicEPS', label: 'Basic EPS', indent: 0, isEPS: true },
  { key: 'dilutedEPS', label: 'Diluted EPS', indent: 0, isEPS: true },
  { key: 'basicAverageShares', label: 'Basic Average Shares', indent: 0 },
  { key: 'dilutedAverageShares', label: 'Diluted Average Shares', indent: 0 },
  { key: 'totalOperatingIncomeAsReported', label: 'Total Operating Income as Reported', indent: 0 },
  { key: 'totalExpenses', label: 'Total Expenses', indent: 0 },
  { key: 'netInterestIncome', label: 'Net Interest Income', indent: 0 },
  { key: 'EBIT', label: 'EBIT', indent: 0, bold: true },
  { key: 'EBITDA', label: 'EBITDA', indent: 0, bold: true },
  { key: 'reconciledCostOfRevenue', label: 'Reconciled Cost of Revenue', indent: 0 },
  { key: 'reconciledDepreciation', label: 'Reconciled Depreciation', indent: 0 },
  { key: 'normalizedEBITDA', label: 'Normalized EBITDA', indent: 0 },
  { key: 'normalizedIncome', label: 'Normalized Income', indent: 0 },
]

// ─── Balance Sheet rows ────────────────────────────────────────────────────────

const BALANCE_ROWS: RowDef[] = [
  {
    key: 'currentAssets', label: 'Current Assets', indent: 0, bold: true,
    children: [
      {
        key: 'cashCashEquivalentsAndShortTermInvestments', label: 'Cash, Cash Equivalents & Short Term Investments', indent: 1,
        children: [
          { key: 'cashAndCashEquivalents', label: 'Cash And Cash Equivalents', indent: 2 },
          { key: 'otherShortTermInvestments', label: 'Other Short Term Investments', indent: 2 },
        ],
      },
      {
        key: 'receivables', label: 'Receivables', indent: 1,
        children: [
          { key: 'accountsReceivable', label: 'Accounts Receivable', indent: 2 },
          { key: 'otherReceivables', label: 'Other Receivables', indent: 2 },
        ],
      },
      { key: 'inventory', label: 'Inventory', indent: 1 },
      { key: 'otherCurrentAssets', label: 'Other Current Assets', indent: 1 },
    ],
  },
  {
    key: 'totalNonCurrentAssets', label: 'Total Non Current Assets', indent: 0, bold: true,
    children: [
      { key: 'netPPE', label: 'Net PPE', indent: 1 },
      {
        key: 'investmentsAndAdvances', label: 'Investments And Advances', indent: 1,
        children: [
          { key: 'longTermEquityInvestment', label: 'Long Term Equity Investment', indent: 2 },
          { key: 'availableForSaleSecurities', label: 'Available For Sale Securities', indent: 2 },
        ],
      },
      { key: 'goodwillAndOtherIntangibleAssets', label: 'Goodwill and Other Intangible Assets', indent: 1 },
      { key: 'otherNonCurrentAssets', label: 'Other Non Current Assets', indent: 1 },
    ],
  },
  { key: 'totalAssets', label: 'Total Assets', indent: 0, bold: true },
  {
    key: 'currentLiabilities', label: 'Current Liabilities', indent: 0, bold: true,
    children: [
      { key: 'payablesAndAccruedExpenses', label: 'Payables And Accrued Expenses', indent: 1 },
      { key: 'accountsPayable', label: 'Accounts Payable', indent: 2 },
      { key: 'totalTaxPayable', label: 'Tax Payable', indent: 2 },
      { key: 'currentDebtAndCapitalLeaseObligation', label: 'Current Debt and Capital Lease Obligation', indent: 1 },
      { key: 'otherCurrentLiabilities', label: 'Other Current Liabilities', indent: 1 },
    ],
  },
  {
    key: 'totalNonCurrentLiabilitiesNetMinorityInterest', label: 'Total Non Current Liabilities', indent: 0, bold: true,
    children: [
      { key: 'longTermDebtAndCapitalLeaseObligation', label: 'Long Term Debt and Capital Lease Obligation', indent: 1 },
      { key: 'longTermDebt', label: 'Long Term Debt', indent: 2 },
      { key: 'otherNonCurrentLiabilities', label: 'Other Non Current Liabilities', indent: 1 },
    ],
  },
  { key: 'totalLiabilitiesNetMinorityInterest', label: 'Total Liabilities Net Minority Interest', indent: 0, bold: true },
  {
    key: 'totalEquityGrossMinorityInterest', label: 'Total Equity Gross Minority Interest', indent: 0, bold: true,
    children: [
      {
        key: 'stockholdersEquity', label: "Stockholders' Equity", indent: 1,
        children: [
          { key: 'commonStock', label: 'Common Stock', indent: 2 },
          { key: 'additionalPaidInCapital', label: 'Additional Paid In Capital', indent: 2 },
          { key: 'retainedEarnings', label: 'Retained Earnings', indent: 2 },
          { key: 'treasuryStock', label: 'Treasury Stock', indent: 2 },
          { key: 'gainsLossesNotAffectingRetainedEarnings', label: 'Other Equity Adjustments', indent: 2 },
        ],
      },
    ],
  },
  { key: 'totalCapitalization', label: 'Total Capitalization', indent: 0 },
  { key: 'commonStockEquity', label: 'Common Stock Equity', indent: 0 },
  { key: 'netTangibleAssets', label: 'Net Tangible Assets', indent: 0 },
  { key: 'workingCapital', label: 'Working Capital', indent: 0 },
  { key: 'investedCapital', label: 'Invested Capital', indent: 0 },
  { key: 'tangibleBookValue', label: 'Tangible Book Value', indent: 0 },
  { key: 'shareIssued', label: 'Share Issued', indent: 0 },
  { key: 'ordinarySharesNumber', label: 'Ordinary Shares Number', indent: 0 },
]

// ─── Cash Flow rows ────────────────────────────────────────────────────────────

const CASHFLOW_ROWS: RowDef[] = [
  {
    key: 'operatingCashFlow', label: 'Operating Cash Flow', indent: 0, bold: true,
    children: [
      { key: 'cashFlowFromContinuingOperatingActivities', label: 'Cash Flow From Continuing Operating Activities', indent: 1 },
      { key: 'netIncomeFromContinuingOperations', label: 'Net Income From Continuing Operations', indent: 1 },
      { key: 'depreciationAndAmortization', label: 'Depreciation & Amortization', indent: 1 },
      { key: 'stockBasedCompensation', label: 'Stock Based Compensation', indent: 1 },
      { key: 'deferredIncomeTax', label: 'Deferred Income Tax', indent: 1 },
      {
        key: 'changeInWorkingCapital', label: 'Change In Working Capital', indent: 1,
        children: [
          { key: 'changesInAccountReceivables', label: 'Change In Account Receivables', indent: 2 },
          { key: 'changeInInventory', label: 'Change In Inventory', indent: 2 },
          { key: 'changeInPayablesAndAccruedExpense', label: 'Change In Payables And Accrued Expense', indent: 2 },
          { key: 'changeInOtherWorkingCapital', label: 'Change In Other Working Capital', indent: 2 },
        ],
      },
      { key: 'otherNonCashItems', label: 'Other Non Cash Items', indent: 1 },
    ],
  },
  {
    key: 'investingCashFlow', label: 'Investing Cash Flow', indent: 0, bold: true,
    children: [
      { key: 'cashFlowFromContinuingInvestingActivities', label: 'Cash Flow From Continuing Investing Activities', indent: 1 },
      { key: 'capitalExpenditure', label: 'Capital Expenditure', indent: 1 },
      { key: 'purchaseOfInvestment', label: 'Purchase of Investment', indent: 1 },
      { key: 'saleOfInvestment', label: 'Sale of Investment', indent: 1 },
      { key: 'netOtherInvestingChanges', label: 'Other Investing Changes', indent: 1 },
    ],
  },
  {
    key: 'financingCashFlow', label: 'Financing Cash Flow', indent: 0, bold: true,
    children: [
      { key: 'cashFlowFromContinuingFinancingActivities', label: 'Cash Flow From Continuing Financing Activities', indent: 1 },
      { key: 'netIssuancePaymentsOfDebt', label: 'Net Issuance Payments of Debt', indent: 1 },
      { key: 'issuanceOfDebt', label: 'Issuance of Debt', indent: 2 },
      { key: 'repaymentOfDebt', label: 'Repayment of Debt', indent: 2 },
      { key: 'netCommonStockIssuance', label: 'Net Common Stock Issuance', indent: 1 },
      { key: 'repurchaseOfCapitalStock', label: 'Repurchase of Capital Stock', indent: 2 },
      { key: 'cashDividendsPaid', label: 'Cash Dividends Paid', indent: 1 },
      { key: 'netOtherFinancingCharges', label: 'Other Financing Charges', indent: 1 },
    ],
  },
  { key: 'endCashPosition', label: 'End Cash Position', indent: 0, bold: true },
  { key: 'changesInCash', label: 'Changes In Cash', indent: 0 },
  { key: 'beginningCashPosition', label: 'Beginning Cash Position', indent: 0 },
  { key: 'freeCashFlow', label: 'Free Cash Flow', indent: 0, bold: true },
]

// ─── Flatten tree ─────────────────────────────────────────────────────────────

interface FlatRow extends RowDef {
  hasChildren: boolean
}

function flattenRows(rows: RowDef[], expanded: Set<string>): FlatRow[] {
  const result: FlatRow[] = []
  for (const row of rows) {
    const hasChildren = !!(row.children?.length)
    result.push({ ...row, hasChildren })
    if (hasChildren && expanded.has(row.key)) {
      result.push(...flattenRows(row.children!, expanded))
    }
  }
  return result
}

function collectParentKeys(rows: RowDef[]): string[] {
  const keys: string[] = []
  for (const row of rows) {
    if (row.children?.length) {
      keys.push(row.key)
      keys.push(...collectParentKeys(row.children))
    }
  }
  return keys
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtThousands(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return '—'
  return Math.round(n / 1000).toLocaleString('en-US')
}

function fmtEPS(v: unknown): string {
  if (v == null) return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return '—'
  return n.toFixed(2)
}

function fmtPct(v: unknown): string {
  if (v == null) return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return '—'
  return (n * 100).toFixed(1) + '%'
}

function isNegative(v: unknown): boolean {
  return typeof v === 'number' && v < 0
}

function formatDate(raw: unknown): string {
  if (!raw) return ''
  if (raw === 'TTM') return 'TTM'
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { ticker: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatRow = Record<string, any>

interface StatementsData {
  annual:    { incomeStatement: StatRow[]; balanceSheet: StatRow[]; cashFlow: StatRow[] }
  quarterly: { incomeStatement: StatRow[]; balanceSheet: StatRow[]; cashFlow: StatRow[] }
  ttm:       { incomeStatement: StatRow | null; balanceSheet: StatRow | null; cashFlow: StatRow | null }
}

export default function YahooFinancials({ ticker }: Props) {
  const [data, setData]           = useState<StatementsData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [period, setPeriod]       = useState<Period>('annual')
  const [statement, setStatement] = useState<StatementType>('income')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  useEffect(() => {
    setLoading(true); setError('')
    fetch(`/api/statements?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); setLoading(false); return } setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [ticker])

  const rootRows    = statement === 'income' ? INCOME_ROWS : statement === 'balance' ? BALANCE_ROWS : CASHFLOW_ROWS
  const allParentKeys = collectParentKeys(rootRows)

  function toggleKey(key: string) {
    setExpanded(prev => { const s = new Set(prev); if (s.has(key)) { s.delete(key) } else { s.add(key) } return s })
  }

  function toggleAll() {
    if (allExpanded) { setExpanded(new Set()); setAllExpanded(false) }
    else             { setExpanded(new Set(allParentKeys)); setAllExpanded(true) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 mr-3" />
      Loading financial statements…
    </div>
  )
  if (error) return <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
  if (!data)  return null

  const periodsRaw = period === 'annual'
    ? (statement === 'income' ? data.annual.incomeStatement : statement === 'balance' ? data.annual.balanceSheet : data.annual.cashFlow)
    : (statement === 'income' ? data.quarterly.incomeStatement : statement === 'balance' ? data.quarterly.balanceSheet : data.quarterly.cashFlow)

  const hasTTM  = statement !== 'balance'
  const ttmData = statement === 'income' ? data.ttm.incomeStatement : statement === 'cashflow' ? data.ttm.cashFlow : null

  const displayPeriods = [...periodsRaw].reverse().slice(0, 4).reverse()

  function rowHasData(row: RowDef): boolean {
    const vals = [
      ...(hasTTM && ttmData && period === 'annual' ? [ttmData[row.key]] : []),
      ...displayPeriods.map(p => p[row.key]),
    ]
    return vals.some(v => v != null && typeof v === 'number')
  }

  function pruneTree(rows: RowDef[]): RowDef[] {
    return rows
      .map(r => ({ ...r, children: r.children ? pruneTree(r.children) : undefined }))
      .filter(r => rowHasData(r) || (r.children?.some(c => rowHasData(c) || c.children?.some(rowHasData))))
  }

  const flatRows = flattenRows(pruneTree(rootRows), expanded)

  const TABS: { id: StatementType; label: string }[] = [
    { id: 'income',   label: 'Income Statement' },
    { id: 'balance',  label: 'Balance Sheet' },
    { id: 'cashflow', label: 'Cash Flow' },
  ]

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0 gap-2 flex-wrap">
        <div className="flex gap-0 border-b border-slate-200 w-full">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatement(tab.id); setExpanded(new Set()); setAllExpanded(false) }}
              className={[
                'px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                statement === tab.id ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pb-1">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[12px]">
              <button onClick={() => setPeriod('annual')} className={`px-3 py-1 ${period === 'annual' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}>Annual</button>
              <button onClick={() => setPeriod('quarterly')} className={`px-3 py-1 border-l border-slate-200 ${period === 'quarterly' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}>Quarterly</button>
            </div>
            <button onClick={toggleAll} className="text-[12px] text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={allExpanded ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
              </svg>
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 pb-1 text-[11px] text-slate-400">All numbers in thousands</div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-2 text-[11px] font-semibold text-slate-500 w-64 min-w-[220px]">Breakdown</th>
              {hasTTM && period === 'annual' && ttmData && (
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-500 min-w-[110px]">TTM</th>
              )}
              {displayPeriods.map((p, i) => (
                <th key={i} className="text-right px-3 py-2 text-[11px] font-semibold text-slate-600 min-w-[110px]">
                  {formatDate(p.endDate)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flatRows.map((row, i) => {
              const isHeader = row.bold && row.indent === 0
              const fmt = row.isEPS ? fmtEPS : row.isPct ? fmtPct : fmtThousands
              const pl = [16, 32, 52][row.indent] ?? 16

              return (
                <tr key={`${row.key}-${i}`} className={`border-b border-slate-50 ${isHeader ? 'bg-slate-50/60' : 'hover:bg-slate-50/40'}`}>
                  <td className={`py-1.5 ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`} style={{ paddingLeft: `${pl}px` }}>
                    <div className="flex items-center gap-1">
                      {row.hasChildren ? (
                        <button onClick={() => toggleKey(row.key)} className="text-slate-400 hover:text-slate-600 shrink-0">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={expanded.has(row.key) ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'} />
                          </svg>
                        </button>
                      ) : <span className="w-3 shrink-0" />}
                      <span>{row.label}</span>
                    </div>
                  </td>
                  {hasTTM && period === 'annual' && ttmData && (
                    <td className={`text-right px-3 py-1.5 tabular-nums ${isNegative(ttmData[row.key]) ? 'text-red-600' : 'text-slate-700'} ${row.bold ? 'font-semibold' : ''}`}>
                      {fmt(ttmData[row.key])}
                    </td>
                  )}
                  {displayPeriods.map((p, j) => (
                    <td key={j} className={`text-right px-3 py-1.5 tabular-nums ${isNegative(p[row.key]) ? 'text-red-600' : 'text-slate-700'} ${row.bold ? 'font-semibold' : ''}`}>
                      {fmt(p[row.key])}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 text-[10px] text-slate-300">
        Source: Yahoo Finance · Values in thousands · TTM = trailing twelve months (sum of last 4 quarters)
      </div>
    </div>
  )
}
