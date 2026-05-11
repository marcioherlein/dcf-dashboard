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
  isEPS?: boolean      // format as raw number (not /1000)
  isPct?: boolean      // format as percentage
  children?: RowDef[]  // expandable children
  parentKey?: string   // for toggling
}

// ─── Income Statement rows (Yahoo Finance order) ──────────────────────────────

const INCOME_ROWS: RowDef[] = [
  {
    key: 'TotalRevenue', label: 'Total Revenue', indent: 0, bold: true,
    children: [
      { key: 'OperatingRevenue', label: 'Operating Revenue', indent: 1 },
    ],
  },
  { key: 'CostOfRevenue', label: 'Cost of Revenue', indent: 0 },
  { key: 'GrossProfit', label: 'Gross Profit', indent: 0, bold: true },
  {
    key: 'OperatingExpense', label: 'Operating Expense', indent: 0, bold: true,
    children: [
      {
        key: 'SellingGeneralAndAdministration', label: 'Selling General and Admin', indent: 1,
        children: [
          { key: 'GeneralAndAdministrativeExpense', label: 'General and Administrative', indent: 2 },
          { key: 'OtherGandA', label: 'Other G&A', indent: 2 },
          { key: 'SellingAndMarketingExpense', label: 'Selling & Marketing', indent: 2 },
        ],
      },
      { key: 'ResearchAndDevelopment', label: 'Research & Development', indent: 1 },
    ],
  },
  { key: 'OperatingIncome', label: 'Operating Income', indent: 0, bold: true },
  {
    key: 'NetNonOperatingInterestIncomeExpense', label: 'Net Non Operating Interest Income Expense', indent: 0,
    children: [
      { key: 'InterestIncomeNonOperating', label: 'Interest Income Non Operating', indent: 1 },
      { key: 'InterestExpenseNonOperating', label: 'Interest Expense Non Operating', indent: 1 },
    ],
  },
  {
    key: 'OtherIncomeExpense', label: 'Other Income Expense', indent: 0,
    children: [
      { key: 'GainOnSaleOfSecurity', label: 'Gain on Sale of Security', indent: 1 },
      {
        key: 'SpecialIncomeCharges', label: 'Special Income Charges', indent: 1,
        children: [
          { key: 'WriteOff', label: 'Write Off', indent: 2 },
        ],
      },
      { key: 'OtherNonOperatingIncomeExpenses', label: 'Other Non Operating Income Expenses', indent: 1 },
    ],
  },
  { key: 'PretaxIncome', label: 'Pretax Income', indent: 0, bold: true },
  { key: 'TaxProvision', label: 'Tax Provision', indent: 1 },
  { key: 'TaxRateForCalcs', label: 'Tax Rate For Calcs', indent: 1, isPct: true },
  {
    key: 'NetIncomeCommonStockholders', label: 'Net Income Common Stockholders', indent: 0, bold: true,
    children: [
      { key: 'NetIncome', label: 'Net Income', indent: 1 },
      { key: 'DilutedNIAvailtoComStockholders', label: 'Diluted NI Available to Com. Stockholders', indent: 1 },
    ],
  },
  { key: 'BasicEPS', label: 'Basic EPS', indent: 0, isEPS: true },
  { key: 'DilutedEPS', label: 'Diluted EPS', indent: 0, isEPS: true },
  { key: 'BasicAverageShares', label: 'Basic Average Shares', indent: 0 },
  { key: 'DilutedAverageShares', label: 'Diluted Average Shares', indent: 0 },
  { key: 'TotalOperatingIncomeAsReported', label: 'Total Operating Income as Reported', indent: 0 },
  { key: 'TotalExpenses', label: 'Total Expenses', indent: 0 },
  { key: 'NetInterestIncome', label: 'Net Interest Income', indent: 0 },
  { key: 'EBIT', label: 'EBIT', indent: 0, bold: true },
  { key: 'EBITDA', label: 'EBITDA', indent: 0, bold: true },
  { key: 'ReconciledCostOfRevenue', label: 'Reconciled Cost of Revenue', indent: 0 },
  { key: 'ReconciledDepreciation', label: 'Reconciled Depreciation', indent: 0 },
  { key: 'NormalizedEBITDA', label: 'Normalized EBITDA', indent: 0 },
  { key: 'NormalizedIncome', label: 'Normalized Income', indent: 0 },
]

// ─── Balance Sheet rows ────────────────────────────────────────────────────────

const BALANCE_ROWS: RowDef[] = [
  {
    key: 'CurrentAssets', label: 'Current Assets', indent: 0, bold: true,
    children: [
      {
        key: 'CashCashEquivalentsAndShortTermInvestments', label: 'Cash, Cash Equivalents & Short Term Investments', indent: 1,
        children: [
          { key: 'CashAndCashEquivalents', label: 'Cash And Cash Equivalents', indent: 2 },
          { key: 'OtherShortTermInvestments', label: 'Other Short Term Investments', indent: 2 },
        ],
      },
      {
        key: 'NetReceivables', label: 'Receivables', indent: 1,
        children: [
          { key: 'AccountsReceivable', label: 'Accounts Receivable', indent: 2 },
          { key: 'OtherReceivables', label: 'Other Receivables', indent: 2 },
        ],
      },
      { key: 'Inventory', label: 'Inventory', indent: 1 },
      { key: 'OtherCurrentAssets', label: 'Other Current Assets', indent: 1 },
    ],
  },
  {
    key: 'TotalNonCurrentAssets', label: 'Total Non Current Assets', indent: 0, bold: true,
    children: [
      { key: 'NetPPE', label: 'Net PPE', indent: 1 },
      {
        key: 'GoodwillAndOtherIntangibleAssets', label: 'Goodwill and Other Intangible Assets', indent: 1,
        children: [
          { key: 'Goodwill', label: 'Goodwill', indent: 2 },
          { key: 'OtherIntangibleAssets', label: 'Other Intangible Assets', indent: 2 },
        ],
      },
      {
        key: 'InvestmentsAndAdvances', label: 'Investments And Advances', indent: 1,
        children: [
          { key: 'LongTermEquityInvestment', label: 'Long Term Equity Investment', indent: 2 },
        ],
      },
      { key: 'OtherNonCurrentAssets', label: 'Other Non Current Assets', indent: 1 },
    ],
  },
  { key: 'TotalAssets', label: 'Total Assets', indent: 0, bold: true },
  {
    key: 'CurrentLiabilities', label: 'Current Liabilities', indent: 0, bold: true,
    children: [
      { key: 'AccountsPayable', label: 'Accounts Payable', indent: 1 },
      { key: 'TaxesPayable', label: 'Taxes Payable', indent: 1 },
      {
        key: 'CurrentDebtAndCapitalLeaseObligation', label: 'Current Debt and Capital Lease Obligation', indent: 1,
        children: [
          { key: 'CurrentCapitalLeaseObligation', label: 'Current Capital Lease Obligation', indent: 2 },
          { key: 'OtherCurrentBorrowings', label: 'Other Current Borrowings', indent: 2 },
        ],
      },
      { key: 'OtherCurrentLiabilities', label: 'Other Current Liabilities', indent: 1 },
    ],
  },
  {
    key: 'TotalNonCurrentLiabilitiesNetMinorityInterest', label: 'Total Non Current Liabilities', indent: 0, bold: true,
    children: [
      {
        key: 'LongTermDebtAndCapitalLeaseObligation', label: 'Long Term Debt and Capital Lease Obligation', indent: 1,
        children: [
          { key: 'LongTermCapitalLeaseObligation', label: 'Long Term Capital Lease Obligation', indent: 2 },
          { key: 'LongTermDebt', label: 'Long Term Debt', indent: 2 },
        ],
      },
      { key: 'OtherNonCurrentLiabilities', label: 'Other Non Current Liabilities', indent: 1 },
    ],
  },
  { key: 'TotalLiabilitiesNetMinorityInterest', label: 'Total Liabilities Net Minority Interest', indent: 0, bold: true },
  {
    key: 'TotalEquityGrossMinorityInterest', label: 'Total Equity Gross Minority Interest', indent: 0, bold: true,
    children: [
      {
        key: 'StockholdersEquity', label: "Stockholders' Equity", indent: 1,
        children: [
          { key: 'CommonStock', label: 'Common Stock', indent: 2 },
          { key: 'AdditionalPaidInCapital', label: 'Additional Paid In Capital', indent: 2 },
          { key: 'RetainedEarnings', label: 'Retained Earnings', indent: 2 },
          { key: 'TreasuryStock', label: 'Treasury Stock', indent: 2 },
          { key: 'OtherEquityAdjustments', label: 'Other Equity Adjustments', indent: 2 },
        ],
      },
    ],
  },
  { key: 'TotalCapitalization', label: 'Total Capitalization', indent: 0 },
  { key: 'CommonStockEquity', label: 'Common Stock Equity', indent: 0 },
  { key: 'NetTangibleAssets', label: 'Net Tangible Assets', indent: 0 },
  { key: 'WorkingCapital', label: 'Working Capital', indent: 0 },
  { key: 'InvestedCapital', label: 'Invested Capital', indent: 0 },
  { key: 'TangibleBookValue', label: 'Tangible Book Value', indent: 0 },
  { key: 'ShareIssued', label: 'Share Issued', indent: 0 },
  { key: 'OrdinarySharesNumber', label: 'Ordinary Shares Number', indent: 0 },
]

// ─── Cash Flow rows ────────────────────────────────────────────────────────────

const CASHFLOW_ROWS: RowDef[] = [
  {
    key: 'OperatingCashFlow', label: 'Operating Cash Flow', indent: 0, bold: true,
    children: [
      { key: 'CashFlowFromContinuingOperatingActivities', label: 'Cash Flow From Continuing Operating Activities', indent: 1 },
      { key: 'NetIncome', label: 'Net Income', indent: 1 },
      { key: 'DepreciationAndAmortization', label: 'Depreciation & Amortization', indent: 1 },
      { key: 'DeferredIncomeTax', label: 'Deferred Income Tax', indent: 1 },
      { key: 'StockBasedCompensation', label: 'Stock Based Compensation', indent: 1 },
      {
        key: 'ChangeInWorkingCapital', label: 'Change In Working Capital', indent: 1,
        children: [
          { key: 'ChangeInAccountsReceivable', label: 'Change In Accounts Receivable', indent: 2 },
          { key: 'ChangeInInventory', label: 'Change In Inventory', indent: 2 },
          { key: 'ChangeInOtherWorkingCapital', label: 'Change In Other Working Capital', indent: 2 },
        ],
      },
      { key: 'OtherNonCashItems', label: 'Other Non Cash Items', indent: 1 },
    ],
  },
  {
    key: 'InvestingCashFlow', label: 'Investing Cash Flow', indent: 0, bold: true,
    children: [
      { key: 'CashFlowFromContinuingInvestingActivities', label: 'Cash Flow From Continuing Investing Activities', indent: 1 },
      { key: 'CapitalExpenditure', label: 'Capital Expenditure', indent: 1 },
      { key: 'PurchaseOfBusiness', label: 'Purchase of Business', indent: 1 },
      { key: 'PurchaseOfInvestment', label: 'Purchase of Investment', indent: 1 },
      { key: 'SaleOfInvestment', label: 'Sale of Investment', indent: 1 },
      { key: 'OtherInvestingCharges', label: 'Other Investing Charges', indent: 1 },
    ],
  },
  {
    key: 'FinancingCashFlow', label: 'Financing Cash Flow', indent: 0, bold: true,
    children: [
      { key: 'CashFlowFromContinuingFinancingActivities', label: 'Cash Flow From Continuing Financing Activities', indent: 1 },
      { key: 'IssuanceOfDebt', label: 'Issuance of Debt', indent: 1 },
      { key: 'RepaymentOfDebt', label: 'Repayment of Debt', indent: 1 },
      { key: 'IssuanceOfCapitalStock', label: 'Issuance of Capital Stock', indent: 1 },
      { key: 'RepurchaseOfCapitalStock', label: 'Repurchase of Capital Stock', indent: 1 },
      { key: 'CashDividendsPaid', label: 'Cash Dividends Paid', indent: 1 },
      { key: 'OtherFinancingCharges', label: 'Other Financing Charges', indent: 1 },
    ],
  },
  { key: 'EndCashPosition', label: 'End Cash Position', indent: 0, bold: true },
  { key: 'ChangesInCash', label: 'Changes In Cash', indent: 0 },
  { key: 'EffectOfExchangeRateChanges', label: 'Effect Of Exchange Rate Changes', indent: 0 },
  { key: 'BeginningCashPosition', label: 'Beginning Cash Position', indent: 0 },
  { key: 'FreeCashFlow', label: 'Free Cash Flow', indent: 0, bold: true },
]

// ─── Flatten tree ─────────────────────────────────────────────────────────────

interface FlatRow extends RowDef {
  parentKey?: string
  hasChildren?: boolean
}

function flattenRows(rows: RowDef[], expandedSet: Set<string>, parentKey?: string): FlatRow[] {
  const result: FlatRow[] = []
  for (const row of rows) {
    const hasChildren = !!(row.children && row.children.length > 0)
    result.push({ ...row, parentKey, hasChildren })
    if (hasChildren && expandedSet.has(row.key)) {
      result.push(...flattenRows(row.children!, expandedSet, row.key))
    }
  }
  return result
}

function getAllParentKeys(rows: RowDef[]): string[] {
  const keys: string[] = []
  for (const row of rows) {
    if (row.children && row.children.length > 0) {
      keys.push(row.key)
      keys.push(...getAllParentKeys(row.children))
    }
  }
  return keys
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtThousands(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return '—'
  const thou = Math.round(n / 1000)
  return thou.toLocaleString('en-US')
}

function fmtEPS(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return '—'
  return n.toFixed(2)
}

function fmtPct(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return '—'
  return (n * 100).toFixed(1) + '%'
}

function isNegative(v: unknown): boolean {
  if (typeof v !== 'number') return false
  return v < 0
}

function formatDate(raw: unknown): string {
  if (!raw) return ''
  if (raw === 'TTM') return 'TTM'
  const d = raw instanceof Date ? raw : new Date(String(raw))
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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded]   = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/statements?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [ticker])

  const rootRows = statement === 'income' ? INCOME_ROWS : statement === 'balance' ? BALANCE_ROWS : CASHFLOW_ROWS

  const allParentKeys = getAllParentKeys(rootRows)

  function toggleRow(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedKeys(new Set())
      setAllExpanded(false)
    } else {
      setExpandedKeys(new Set(allParentKeys))
      setAllExpanded(true)
    }
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

  // Filter rows where at least one period has data
  function hasData(row: RowDef): boolean {
    const vals = [
      ...(hasTTM && ttmData && period === 'annual' ? [ttmData[row.key]] : []),
      ...displayPeriods.map(p => p[row.key]),
    ]
    return vals.some(v => v != null && typeof v === 'number')
  }

  function pruneRows(rows: RowDef[]): RowDef[] {
    return rows
      .map(row => {
        const children = row.children ? pruneRows(row.children) : undefined
        return { ...row, children }
      })
      .filter(row => hasData(row) || (row.children && row.children.some(c => hasData(c) || c.children?.some(hasData))))
  }

  const visibleRows = pruneRows(rootRows)
  const flatRows    = flattenRows(visibleRows, expandedKeys)

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
              onClick={() => { setStatement(tab.id); setExpandedKeys(new Set()); setAllExpanded(false) }}
              className={[
                'px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                statement === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pb-1">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[12px]">
              <button
                onClick={() => setPeriod('annual')}
                className={`px-3 py-1 ${period === 'annual' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Annual
              </button>
              <button
                onClick={() => setPeriod('quarterly')}
                className={`px-3 py-1 border-l border-slate-200 ${period === 'quarterly' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Quarterly
              </button>
            </div>
            <button
              onClick={toggleAll}
              className="text-[12px] text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap"
            >
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
              const indentPx = [16, 32, 52][row.indent] ?? 16

              return (
                <tr
                  key={`${row.key}-${i}`}
                  className={`border-b border-slate-50 ${isHeader ? 'bg-slate-50/60' : 'hover:bg-slate-50/40'}`}
                >
                  <td
                    className={`py-1.5 ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}
                    style={{ paddingLeft: `${indentPx}px` }}
                  >
                    <div className="flex items-center gap-1">
                      {row.hasChildren && (
                        <button
                          onClick={() => toggleRow(row.key)}
                          className="text-slate-400 hover:text-slate-600 shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d={expandedKeys.has(row.key) ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'} />
                          </svg>
                        </button>
                      )}
                      {!row.hasChildren && <span className="w-3 shrink-0" />}
                      <span>{row.label}</span>
                    </div>
                  </td>
                  {hasTTM && period === 'annual' && ttmData && (
                    <td className={`text-right px-3 py-1.5 tabular-nums ${isNegative(ttmData[row.key]) ? 'text-red-600' : 'text-slate-700'} ${row.bold ? 'font-semibold' : ''}`}>
                      {fmt(ttmData[row.key])}
                    </td>
                  )}
                  {displayPeriods.map((p, j) => (
                    <td
                      key={j}
                      className={`text-right px-3 py-1.5 tabular-nums ${isNegative(p[row.key]) ? 'text-red-600' : 'text-slate-700'} ${row.bold ? 'font-semibold' : ''}`}
                    >
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
