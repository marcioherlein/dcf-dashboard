'use client'
import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'annual' | 'quarterly'
type StatementType = 'income' | 'balance' | 'cashflow'

interface RowDef {
  key: string
  label: string
  indent: number   // 0 = top-level, 1 = indented sub-row
  bold?: boolean
}

// ─── Row definitions (Yahoo Finance order) ───────────────────────────────────

const INCOME_ROWS: RowDef[] = [
  { key: 'totalRevenue',                       label: 'Total Revenue',                               indent: 0, bold: true },
  { key: 'costOfRevenue',                      label: 'Cost Of Revenue',                             indent: 1 },
  { key: 'grossProfit',                        label: 'Gross Profit',                                indent: 0, bold: true },
  { key: 'researchDevelopment',                label: 'Research And Development',                    indent: 1 },
  { key: 'sellingGeneralAdministrative',       label: 'Selling General Administrative',              indent: 1 },
  { key: 'nonRecurring',                       label: 'Non Recurring',                               indent: 1 },
  { key: 'otherOperatingExpenses',             label: 'Other Operating Expenses',                    indent: 1 },
  { key: 'totalOperatingExpenses',             label: 'Total Operating Expenses',                    indent: 0, bold: true },
  { key: 'operatingIncome',                    label: 'Operating Income',                            indent: 0, bold: true },
  { key: 'totalOtherIncomeExpenseNet',         label: 'Other Income Expense Net',                   indent: 1 },
  { key: 'interestExpense',                    label: 'Interest Expense',                            indent: 1 },
  { key: 'incomeBeforeTax',                    label: 'Pretax Income',                               indent: 0, bold: true },
  { key: 'incomeTaxExpense',                   label: 'Tax Provision',                               indent: 1 },
  { key: 'minorityInterest',                   label: 'Minority Interest',                           indent: 1 },
  { key: 'netIncomeFromContinuingOps',         label: 'Net Income From Continuing Operations',       indent: 0, bold: true },
  { key: 'discontinuedOperations',             label: 'Discontinued Operations',                     indent: 1 },
  { key: 'extraordinaryItems',                 label: 'Extraordinary Items',                         indent: 1 },
  { key: 'effectOfAccountingCharges',          label: 'Effect Of Accounting Charges',                indent: 1 },
  { key: 'otherItems',                         label: 'Other Items',                                 indent: 1 },
  { key: 'netIncome',                          label: 'Net Income',                                  indent: 0, bold: true },
  { key: 'netIncomeApplicableToCommonShares',  label: 'Net Income Applicable To Common Shares',      indent: 1 },
]

const BALANCE_ROWS: RowDef[] = [
  // Current Assets
  { key: 'cash',                    label: 'Cash And Cash Equivalents',          indent: 1 },
  { key: 'shortTermInvestments',    label: 'Short Term Investments',              indent: 1 },
  { key: 'netReceivables',          label: 'Net Receivables',                     indent: 1 },
  { key: 'inventory',               label: 'Inventory',                           indent: 1 },
  { key: 'otherCurrentAssets',      label: 'Other Current Assets',               indent: 1 },
  { key: 'totalCurrentAssets',      label: 'Total Current Assets',               indent: 0, bold: true },
  // Non-current Assets
  { key: 'longTermInvestments',     label: 'Long Term Investments',               indent: 1 },
  { key: 'propertyPlantEquipment',  label: 'Net PPE',                             indent: 1 },
  { key: 'goodWill',                label: 'Goodwill',                            indent: 1 },
  { key: 'intangibleAssets',        label: 'Intangible Assets',                   indent: 1 },
  { key: 'deferredLongTermAssetCharges', label: 'Deferred Long Term Asset Charges', indent: 1 },
  { key: 'otherAssets',             label: 'Other Assets',                        indent: 1 },
  { key: 'totalAssets',             label: 'Total Assets',                        indent: 0, bold: true },
  // Current Liabilities
  { key: 'accountsPayable',         label: 'Accounts Payable',                   indent: 1 },
  { key: 'shortLongTermDebt',       label: 'Current Debt',                        indent: 1 },
  { key: 'otherCurrentLiab',        label: 'Other Current Liabilities',           indent: 1 },
  { key: 'totalCurrentLiabilities', label: 'Total Current Liabilities',           indent: 0, bold: true },
  // Non-current Liabilities
  { key: 'longTermDebt',            label: 'Long Term Debt',                      indent: 1 },
  { key: 'otherLiab',               label: 'Other Liabilities',                   indent: 1 },
  { key: 'deferredLongTermLiab',    label: 'Deferred Long Term Liabilities',       indent: 1 },
  { key: 'totalLiab',               label: 'Total Liabilities Net Minority Interest', indent: 0, bold: true },
  // Equity
  { key: 'commonStock',             label: 'Common Stock',                        indent: 1 },
  { key: 'retainedEarnings',        label: 'Retained Earnings',                   indent: 1 },
  { key: 'treasuryStock',           label: 'Treasury Stock',                      indent: 1 },
  { key: 'capitalSurplus',          label: 'Additional Paid In Capital',           indent: 1 },
  { key: 'otherStockholderEquity',  label: 'Other Stockholder Equity',            indent: 1 },
  { key: 'totalStockholderEquity',  label: "Stockholders' Equity",                indent: 0, bold: true },
  { key: 'netTangibleAssets',       label: 'Net Tangible Assets',                 indent: 0 },
]

const CASHFLOW_ROWS: RowDef[] = [
  { key: 'totalCashFromOperatingActivities',      label: 'Operating Cash Flow',                               indent: 0, bold: true },
  { key: 'totalCashFromOperatingActivities',      label: 'Cash Flow From Continuing Operating Activities',    indent: 1 },
  { key: 'totalCashflowsFromInvestingActivities', label: 'Investing Cash Flow',                               indent: 0, bold: true },
  { key: 'totalCashflowsFromInvestingActivities', label: 'Cash Flow From Continuing Investing Activities',    indent: 1 },
  { key: 'totalCashFromFinancingActivities',      label: 'Financing Cash Flow',                               indent: 0, bold: true },
  { key: 'totalCashFromFinancingActivities',      label: 'Cash Flow From Continuing Financing Activities',    indent: 1 },
  { key: 'endCashPosition',                       label: 'End Cash Position',                                 indent: 0, bold: true },
  { key: 'changeInCash',                          label: 'Changes In Cash',                                   indent: 0 },
  { key: 'effectOfExchangeRate',                  label: 'Effect Of Exchange Rate Changes',                   indent: 0 },
  { key: 'beginPeriodCashFlow',                   label: 'Beginning Cash Position',                           indent: 0 },
  { key: 'capitalExpenditures',                   label: 'Capital Expenditure',                               indent: 0 },
  { key: 'issuanceOfStock',                       label: 'Issuance Of Capital Stock',                         indent: 0 },
  { key: 'netBorrowings',                         label: 'Issuance Of Debt',                                  indent: 0 },
  { key: 'repurchaseOfStock',                     label: 'Repurchase Of Capital Stock',                       indent: 0 },
  { key: 'dividendsPaid',                         label: 'Payment Of Dividends',                              indent: 0 },
  { key: 'salePurchaseOfStock',                   label: 'Sale Purchase Of Stock',                            indent: 0 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtThousands(v: unknown): string {
  if (v == null || v === '' || (typeof v === 'object' && v !== null)) return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return '—'
  const thou = Math.round(n / 1000)
  return thou.toLocaleString('en-US')
}

function isNegative(v: unknown): boolean {
  if (typeof v !== 'number') return false
  return v < 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDate(raw: unknown): string {
  if (!raw) return ''
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
  const [data, setData]         = useState<StatementsData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [period, setPeriod]     = useState<Period>('annual')
  const [statement, setStatement] = useState<StatementType>('income')
  const [expandAll, setExpandAll] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/statements?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); setLoading(false); return } setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [ticker])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 mr-3" />
      Loading financial statements…
    </div>
  )
  if (error) return <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
  if (!data)  return null

  const rows      = statement === 'income'   ? INCOME_ROWS
                  : statement === 'balance'  ? BALANCE_ROWS
                  :                            CASHFLOW_ROWS
  const periods   = period === 'annual'
    ? statement === 'income'   ? data.annual.incomeStatement
      : statement === 'balance' ? data.annual.balanceSheet
      : data.annual.cashFlow
    : statement === 'income'   ? data.quarterly.incomeStatement
      : statement === 'balance' ? data.quarterly.balanceSheet
      : data.quarterly.cashFlow

  const hasTTM    = statement !== 'balance'
  const ttmData   = statement === 'income'   ? data.ttm.incomeStatement
                  : statement === 'cashflow' ? data.ttm.cashFlow
                  : null

  // Balance sheet: show up to 4 periods; income/CF: TTM + up to 4 periods
  const displayPeriods = [...periods].reverse().slice(0, 4).reverse()

  // Rows to show — filter out rows where ALL periods have null value (skip empties)
  const visibleRows = rows.filter(row => {
    const vals = [
      ...(hasTTM && ttmData ? [ttmData[row.key]] : []),
      ...displayPeriods.map(p => p[row.key]),
    ]
    return vals.some(v => v != null && typeof v === 'number')
  })

  // In collapsed mode, only show top-level (non-indented) rows
  const tableRows = expandAll ? visibleRows : visibleRows.filter(r => r.indent === 0)

  const TABS: { id: StatementType; label: string }[] = [
    { id: 'income',   label: 'Income Statement' },
    { id: 'balance',  label: 'Balance Sheet' },
    { id: 'cashflow', label: 'Cash Flow' },
  ]

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0 gap-2 flex-wrap">
        {/* Statement tabs */}
        <div className="flex gap-0 border-b border-slate-200 w-full">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatement(tab.id)}
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
          {/* Annual / Quarterly + Expand All pushed to right */}
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
              onClick={() => setExpandAll(v => !v)}
              className="text-[12px] text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={expandAll ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
              </svg>
              {expandAll ? 'Collapse' : 'Expand All'}
            </button>
          </div>
        </div>
      </div>

      {/* "All numbers in thousands" label */}
      <div className="px-4 pt-2 pb-1 text-[11px] text-slate-400">All numbers in thousands</div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-2 text-[11px] font-semibold text-slate-500 w-56 min-w-[200px]">Breakdown</th>
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
            {tableRows.map((row, i) => {
              const isHeader = row.bold && row.indent === 0
              return (
                <tr
                  key={`${row.key}-${i}`}
                  className={`border-b border-slate-50 ${isHeader ? 'bg-slate-50/60' : 'hover:bg-slate-50/40'}`}
                >
                  <td className={`px-4 py-1.5 ${row.indent === 1 ? 'pl-8' : ''} ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {row.label}
                  </td>
                  {hasTTM && period === 'annual' && ttmData && (
                    <td className={`text-right px-3 py-1.5 tabular-nums ${isNegative(ttmData[row.key]) ? 'text-red-600' : 'text-slate-700'} ${row.bold ? 'font-semibold' : ''}`}>
                      {fmtThousands(ttmData[row.key])}
                    </td>
                  )}
                  {displayPeriods.map((p, j) => (
                    <td
                      key={j}
                      className={`text-right px-3 py-1.5 tabular-nums ${isNegative(p[row.key]) ? 'text-red-600' : 'text-slate-700'} ${row.bold ? 'font-semibold' : ''}`}
                    >
                      {fmtThousands(p[row.key])}
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
