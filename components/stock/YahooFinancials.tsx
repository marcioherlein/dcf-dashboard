'use client'
import { useState, useEffect } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Period = 'annual' | 'quarterly'
type StatementType = 'income' | 'balance' | 'cashflow'

type ValueType = 'money' | 'eps' | 'pct' | 'shares'

interface RowDef {
  key:         string
  label:       string
  indent:      number
  bold?:       boolean
  valueType?:  ValueType  // default: money (shown in thousands)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

interface StatementsData {
  annual:    { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  quarterly: { incomeStatement: AnyRow[]; balanceSheet: AnyRow[]; cashFlow: AnyRow[] }
  ttm:       { incomeStatement: AnyRow | null; balanceSheet: AnyRow | null; cashFlow: AnyRow | null }
}

// ─── Row definitions ────────────────────────────────────────────────────────────

const INCOME_ROWS: RowDef[] = [
  { key: 'totalRevenue',                         label: 'Total Revenue',                         indent: 0, bold: true  },
  { key: 'costOfRevenue',                        label: 'Cost Of Revenue',                       indent: 1              },
  { key: 'reconciledCostOfRevenue',              label: 'Reconciled Cost Of Revenue',            indent: 1              },
  { key: 'grossProfit',                          label: 'Gross Profit',                          indent: 0, bold: true  },
  { key: 'researchAndDevelopment',               label: 'Research And Development',              indent: 1              },
  { key: 'sellingGeneralAndAdministration',      label: 'Selling General Administrative',        indent: 1              },
  { key: 'generalAndAdministrativeExpense',      label: 'General & Administrative',              indent: 1              },
  { key: 'sellingAndMarketingExpense',           label: 'Selling & Marketing',                   indent: 1              },
  { key: 'otherGandA',                           label: 'Other G&A',                             indent: 1              },
  { key: 'operatingExpense',                     label: 'Total Operating Expenses',              indent: 1              },
  { key: 'totalExpenses',                        label: 'Total Expenses',                        indent: 1              },
  { key: 'totalOperatingIncomeAsReported',       label: 'Total Operating Income (as reported)',  indent: 1              },
  { key: 'operatingIncome',                      label: 'Operating Income (EBIT)',               indent: 0, bold: true  },
  { key: 'EBIT',                                 label: 'EBIT',                                  indent: 1              },
  { key: 'EBITDA',                               label: 'EBITDA',                                indent: 0, bold: true  },
  { key: 'reconciledDepreciation',               label: 'Depreciation & Amortization',           indent: 1              },
  { key: 'normalizedEBITDA',                     label: 'Normalized EBITDA',                     indent: 1              },
  { key: 'interestExpenseNonOperating',          label: 'Interest Expense',                      indent: 1              },
  { key: 'interestExpense',                      label: 'Interest Expense (Total)',               indent: 1              },
  { key: 'interestIncomeNonOperating',           label: 'Interest Income',                       indent: 1              },
  { key: 'netNonOperatingInterestIncomeExpense', label: 'Net Non-Operating Interest',            indent: 1              },
  { key: 'otherIncomeExpense',                   label: 'Other Income / Expense',                indent: 1              },
  { key: 'specialIncomeCharges',                 label: 'Special Income / Charges',              indent: 1              },
  { key: 'writeOff',                             label: 'Write-Off',                             indent: 1              },
  { key: 'otherNonOperatingIncomeExpenses',      label: 'Other Non-Operating Income',            indent: 1              },
  { key: 'gainOnSaleOfSecurity',                 label: 'Gain On Sale Of Security',              indent: 1              },
  { key: 'totalUnusualItems',                    label: 'Total Unusual Items',                   indent: 1              },
  { key: 'totalUnusualItemsExcludingGoodwill',   label: 'Unusual Items (excl. Goodwill)',         indent: 1              },
  { key: 'taxEffectOfUnusualItems',              label: 'Tax Effect Of Unusual Items',           indent: 1              },
  { key: 'pretaxIncome',                         label: 'Pretax Income',                         indent: 0, bold: true  },
  { key: 'taxProvision',                         label: 'Tax Provision',                         indent: 1              },
  { key: 'taxRateForCalcs',                      label: 'Effective Tax Rate',                    indent: 1, valueType: 'pct' },
  { key: 'netIncomeIncludingNoncontrollingInterests', label: 'Net Income (incl. Minority)', indent: 1              },
  { key: 'netIncomeContinuousOperations',        label: 'Net Income (Cont. Operations)',         indent: 0, bold: true  },
  { key: 'netIncome',                            label: 'Net Income',                            indent: 0, bold: true  },
  { key: 'netIncomeCommonStockholders',          label: 'Net Income to Common',                  indent: 1              },
  { key: 'dilutedNIAvailtoComStockholders',      label: 'Diluted NI Avail. to Common',           indent: 1              },
  { key: 'normalizedIncome',                     label: 'Normalized Income',                     indent: 1              },
  { key: 'dilutedEPS',                           label: 'EPS (Diluted)',                         indent: 1, valueType: 'eps' },
  { key: 'basicEPS',                             label: 'EPS (Basic)',                           indent: 1, valueType: 'eps' },
  { key: 'dilutedAverageShares',                 label: 'Diluted Avg. Shares',                   indent: 1, valueType: 'shares' },
  { key: 'basicAverageShares',                   label: 'Basic Avg. Shares',                     indent: 1, valueType: 'shares' },
]

const BALANCE_ROWS: RowDef[] = [
  // Assets
  { key: 'cashCashEquivalentsAndShortTermInvestments', label: 'Cash & Short-term Investments', indent: 0, bold: true },
  { key: 'cash',                                       label: 'Cash Only',                      indent: 1 },
  { key: 'netReceivables',                             label: 'Net Receivables',                indent: 1 },
  { key: 'accountsReceivable',                         label: 'Accounts Receivable',            indent: 1 },
  { key: 'inventory',                                  label: 'Inventory',                      indent: 1 },
  { key: 'currentAssets',                              label: 'Total Current Assets',           indent: 0, bold: true },
  { key: 'netPPE',                                     label: 'Net PP&E',                       indent: 1 },
  { key: 'goodwillAndOtherIntangibleAssets',           label: 'Goodwill & Intangibles',         indent: 1 },
  { key: 'goodwill',                                   label: 'Goodwill',                       indent: 1 },
  { key: 'otherIntangibleAssets',                      label: 'Other Intangible Assets',        indent: 1 },
  { key: 'investmentsAndAdvances',                     label: 'Investments & Advances',         indent: 1 },
  { key: 'otherNonCurrentAssets',                      label: 'Other Non-Current Assets',       indent: 1 },
  { key: 'totalNonCurrentAssets',                      label: 'Total Non-Current Assets',       indent: 0, bold: true },
  { key: 'totalAssets',                                label: 'Total Assets',                   indent: 0, bold: true },
  // Liabilities
  { key: 'accountsPayable',                            label: 'Accounts Payable',               indent: 1 },
  { key: 'currentDebt',                                label: 'Current Debt',                   indent: 1 },
  { key: 'pensionAndOtherPostRetirementBenefitPlansCurrent', label: 'Pension (Current)',        indent: 1 },
  { key: 'currentDeferredLiabilities',                 label: 'Deferred Liabilities (Current)', indent: 1 },
  { key: 'otherCurrentLiabilities',                    label: 'Other Current Liabilities',      indent: 1 },
  { key: 'currentLiabilities',                         label: 'Total Current Liabilities',      indent: 0, bold: true },
  { key: 'longTermDebt',                               label: 'Long-Term Debt',                 indent: 1 },
  { key: 'longTermDebtAndCapitalLeaseObligation',      label: 'LT Debt & Capital Lease',        indent: 1 },
  { key: 'pensionAndOtherPostRetirementBenefitPlansNonCurrent', label: 'Pension (LT)',          indent: 1 },
  { key: 'nonCurrentDeferredLiabilities',              label: 'Deferred Liabilities (LT)',      indent: 1 },
  { key: 'tradeAndOtherPayablesNonCurrent',            label: 'Other LT Payables',              indent: 1 },
  { key: 'otherNonCurrentLiabilities',                 label: 'Other Non-Current Liabilities',  indent: 1 },
  { key: 'totalNonCurrentLiabilitiesNetMinorityInterest', label: 'Total Non-Current Liabilities', indent: 0, bold: true },
  { key: 'totalDebt',                                  label: 'Total Debt',                     indent: 0, bold: true },
  { key: 'totalLiabilitiesNetMinorityInterest',        label: 'Total Liabilities',              indent: 0, bold: true },
  // Equity
  { key: 'retainedEarnings',                           label: 'Retained Earnings',              indent: 1 },
  { key: 'capitalStock',                               label: 'Capital Stock',                  indent: 1 },
  { key: 'additionalPaidInCapital',                    label: 'Additional Paid-In Capital',     indent: 1 },
  { key: 'treasurySharesNumber',                       label: 'Treasury Shares',                indent: 1, valueType: 'shares' },
  { key: 'commonStockEquity',                          label: 'Common Stock Equity',            indent: 1 },
  { key: 'totalStockholdersEquity',                    label: "Total Stockholders' Equity",     indent: 0, bold: true },
  { key: 'stockholdersEquity',                         label: "Stockholders' Equity (alt)",     indent: 1 },
  { key: 'netTangibleAssets',                          label: 'Net Tangible Assets',            indent: 0 },
  { key: 'tangibleBookValue',                          label: 'Tangible Book Value',            indent: 0 },
  { key: 'workingCapital',                             label: 'Working Capital',                indent: 0 },
  { key: 'sharesIssued',                               label: 'Shares Issued',                  indent: 1, valueType: 'shares' },
  { key: 'ordinarySharesNumber',                       label: 'Shares Outstanding',             indent: 1, valueType: 'shares' },
]

const CASHFLOW_ROWS: RowDef[] = [
  // Operating
  { key: 'operatingCashFlow',                                label: 'Operating Cash Flow',                  indent: 0, bold: true },
  { key: 'cashFlowFromContinuingOperatingActivities',        label: 'CF from Operating (Cont.)',            indent: 1 },
  { key: 'netIncomeFromContinuingOperations',                label: 'Net Income (Operations)',              indent: 1 },
  { key: 'depreciationAndAmortization',                      label: 'Depreciation & Amortization',         indent: 1 },
  { key: 'depreciationAmortizationDepletion',                label: 'D&A (Depletion)',                      indent: 1 },
  { key: 'stockBasedCompensation',                           label: 'Stock-Based Compensation',             indent: 1 },
  { key: 'deferredIncomeTax',                                label: 'Deferred Income Tax',                  indent: 1 },
  { key: 'changeInWorkingCapital',                           label: 'Changes In Working Capital',           indent: 1 },
  { key: 'changesInAccountReceivables',                      label: 'Changes In Receivables',               indent: 1 },
  { key: 'changeInInventory',                                label: 'Changes In Inventory',                 indent: 1 },
  { key: 'changeInReceivables',                              label: 'Changes In Receivables (alt)',          indent: 1 },
  { key: 'changeInPayablesAndAccruedExpense',                label: 'Changes In Payables & Accrued',        indent: 1 },
  { key: 'changeInOtherWorkingCapital',                      label: 'Changes In Other Working Capital',     indent: 1 },
  { key: 'otherNonCashItems',                                label: 'Other Non-Cash Items',                 indent: 1 },
  { key: 'incomeTaxPaidSupplementalData',                    label: 'Income Tax Paid',                      indent: 1 },
  // Investing
  { key: 'investingCashFlow',                                label: 'Investing Cash Flow',                  indent: 0, bold: true },
  { key: 'cashFlowFromContinuingInvestingActivities',        label: 'CF from Investing (Cont.)',            indent: 1 },
  { key: 'capitalExpenditure',                               label: 'Capital Expenditure',                  indent: 1 },
  { key: 'purchaseOfPPE',                                    label: 'Purchase Of PP&E',                     indent: 1 },
  { key: 'netPPEPurchaseAndSale',                            label: 'Net PP&E Purchase & Sale',             indent: 1 },
  { key: 'purchaseOfInvestment',                             label: 'Purchase Of Investment',               indent: 1 },
  { key: 'saleOfInvestment',                                 label: 'Sale Of Investment',                   indent: 1 },
  { key: 'netInvestmentPurchaseAndSale',                     label: 'Net Investment Purchase & Sale',       indent: 1 },
  { key: 'netOtherInvestingChanges',                         label: 'Other Investing Changes',              indent: 1 },
  // FCF
  { key: 'freeCashFlow',                                     label: 'Free Cash Flow',                       indent: 0, bold: true },
  // Financing
  { key: 'financingCashFlow',                                label: 'Financing Cash Flow',                  indent: 0, bold: true },
  { key: 'cashFlowFromContinuingFinancingActivities',        label: 'CF from Financing (Cont.)',            indent: 1 },
  { key: 'issuanceOfDebt',                                   label: 'Issuance Of Debt',                     indent: 1 },
  { key: 'longTermDebtIssuance',                             label: 'Long-Term Debt Issuance',              indent: 1 },
  { key: 'repaymentOfDebt',                                  label: 'Repayment Of Debt',                    indent: 1 },
  { key: 'longTermDebtPayments',                             label: 'Long-Term Debt Payments',              indent: 1 },
  { key: 'netLongTermDebtIssuance',                          label: 'Net LT Debt Issuance',                 indent: 1 },
  { key: 'netIssuancePaymentsOfDebt',                        label: 'Net Debt Issuance',                    indent: 1 },
  { key: 'netShortTermDebtIssuance',                         label: 'Net Short-Term Debt Issuance',         indent: 1 },
  { key: 'repurchaseOfCapitalStock',                         label: 'Repurchase Of Capital Stock',          indent: 1 },
  { key: 'commonStockPayments',                              label: 'Common Stock Payments',                indent: 1 },
  { key: 'netCommonStockIssuance',                           label: 'Net Common Stock Issuance',            indent: 1 },
  { key: 'cashDividendsPaid',                                label: 'Cash Dividends Paid',                  indent: 1 },
  { key: 'commonStockDividendPaid',                          label: 'Common Stock Dividends Paid',          indent: 1 },
  { key: 'netOtherFinancingCharges',                         label: 'Other Financing Charges',              indent: 1 },
  { key: 'changesInCash',                                    label: 'Changes In Cash',                      indent: 0 },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtValue(v: unknown, vt: ValueType = 'money'): string {
  if (v == null || v === '') return '—'
  const num = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(num)) return '—'

  if (vt === 'eps') {
    const sign = num < 0 ? '-' : ''
    return `${sign}$${Math.abs(num).toFixed(2)}`
  }
  if (vt === 'pct') {
    return `${(num * 100).toFixed(1)}%`
  }
  if (vt === 'shares') {
    const thou = num / 1e3
    if (Math.abs(thou) >= 1000) return `${(thou / 1000).toFixed(1)}B shs`
    return `${thou.toFixed(0)}M shs`
  }
  // money: display in thousands
  const thou = Math.round(num / 1000)
  if (thou === 0 && num !== 0) return `<1`
  return thou.toLocaleString('en-US')
}

function isNegNum(v: unknown, vt: ValueType = 'money'): boolean {
  if (typeof v !== 'number') return false
  if (vt === 'pct' || vt === 'shares' || vt === 'eps') return v < 0
  return v < 0
}

function formatDate(raw: unknown): string {
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw).slice(0, 7)
  return `${d.getFullYear()}`
}

// Group rows into sections: each bold+indent=0 starts a new section
interface Section { header: RowDef; children: RowDef[] }

function groupSections(rows: RowDef[]): Section[] {
  const sections: Section[] = []
  let current: Section | null = null
  for (const row of rows) {
    if (row.bold && row.indent === 0) {
      current = { header: row, children: [] }
      sections.push(current)
    } else {
      if (!current) {
        // orphan row — create a nameless section
        current = { header: { key: '__orphan__', label: '', indent: 0 }, children: [] }
        sections.push(current)
      }
      current.children.push(row)
    }
  }
  return sections
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  statementsData: StatementsData | null
  currency?: string
  reportingCurrency?: string
  highlight?: { rowKey: string; statement: StatementType }
}

export default function YahooFinancials({ statementsData, currency = '$', reportingCurrency, highlight }: Props) {
  const [period, setPeriod]       = useState<Period>('annual')
  const [statement, setStatement] = useState<StatementType>('income')
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})
  const [flashKey, setFlashKey]   = useState<string | null>(null)

  // Navigate to highlighted row: switch tab, expand section, scroll, flash
  useEffect(() => {
    if (!highlight) return
    const { rowKey, statement: stmt } = highlight

    // 1. Switch to the correct statement tab
    setStatement(stmt)

    // 2. Find which section contains the row and expand it
    const allRows = stmt === 'income' ? INCOME_ROWS : stmt === 'balance' ? BALANCE_ROWS : CASHFLOW_ROWS
    const targetIdx = allRows.findIndex(r => r.key === rowKey)
    if (targetIdx !== -1) {
      // Walk backwards to find the section header (bold + indent===0)
      for (let i = targetIdx; i >= 0; i--) {
        if (allRows[i].bold && allRows[i].indent === 0) {
          setExpanded(e => ({ ...e, [allRows[i].key]: true }))
          break
        }
      }
    }

    // 3. Flash + scroll after React renders the expanded row
    setFlashKey(rowKey)
    const timer = setTimeout(() => {
      const el = document.getElementById(`yfrow-${rowKey}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    const clearTimer = setTimeout(() => setFlashKey(null), 2500)

    return () => { clearTimeout(timer); clearTimeout(clearTimer) }
  // rowKey + statement together form the trigger key
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.rowKey, highlight?.statement])

  if (!statementsData) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        Financial data unavailable
      </div>
    )
  }

  const rowDefs = statement === 'income' ? INCOME_ROWS
                : statement === 'balance' ? BALANCE_ROWS
                : CASHFLOW_ROWS

  const rawPeriods = period === 'annual'
    ? statement === 'income'   ? statementsData.annual.incomeStatement
      : statement === 'balance' ? statementsData.annual.balanceSheet
      : statementsData.annual.cashFlow
    : statement === 'income'   ? statementsData.quarterly.incomeStatement
      : statement === 'balance' ? statementsData.quarterly.balanceSheet
      : statementsData.quarterly.cashFlow

  const showTTM   = statement !== 'balance' && period === 'annual'
  const ttmData   = statement === 'income'  ? statementsData.ttm.incomeStatement
                  : statement === 'cashflow'? statementsData.ttm.cashFlow
                  : null

  const displayPeriods = [...rawPeriods].reverse().slice(0, 5).reverse()

  // Filter rows to only those with at least one non-null value
  const hasData = (row: RowDef) => {
    const all = [
      ...(showTTM && ttmData ? [ttmData[row.key]] : []),
      ...displayPeriods.map(p => p[row.key]),
    ]
    return all.some(v => v != null && typeof v === 'number')
  }

  const sections = groupSections(rowDefs.filter(hasData))

  const isOpen = (key: string) => expanded[key] !== false  // default: open

  const toggleAll = (open: boolean) => {
    const next: Record<string, boolean> = {}
    sections.forEach(s => { if (s.children.length) next[s.header.key] = open })
    setExpanded(next)
  }

  const STATEMENT_TABS: { id: StatementType; label: string }[] = [
    { id: 'income',   label: 'Income Statement' },
    { id: 'balance',  label: 'Balance Sheet'    },
    { id: 'cashflow', label: 'Cash Flow'        },
  ]

  return (
    <div className="overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-wrap">
        <div className="flex gap-0 flex-1">
          {STATEMENT_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatement(tab.id)}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                statement === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[12px]">
            <button
              onClick={() => setPeriod('annual')}
              className={`px-3 py-1.5 ${period === 'annual' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Annual
            </button>
            <button
              onClick={() => setPeriod('quarterly')}
              className={`px-3 py-1.5 border-l border-slate-200 ${period === 'quarterly' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Quarterly
            </button>
          </div>
          <button onClick={() => toggleAll(false)} className="text-[12px] text-slate-500 hover:text-slate-700 whitespace-nowrap">
            Collapse all
          </button>
          <button onClick={() => toggleAll(true)} className="text-[12px] text-blue-600 hover:text-blue-700 whitespace-nowrap">
            Expand all
          </button>
        </div>
      </div>

      <div className="px-4 pt-2 pb-1 text-[11px] text-slate-400">
        All figures in thousands ({reportingCurrency ?? currency}) · TTM = trailing twelve months
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-2 text-[11px] font-semibold text-slate-500 w-64 min-w-[220px]">
                Breakdown
              </th>
              {showTTM && ttmData && (
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-amber-600 min-w-[100px] whitespace-nowrap">
                  TTM
                </th>
              )}
              {displayPeriods.map((p, i) => (
                <th key={i} className="text-right px-3 py-2 text-[11px] font-semibold text-slate-600 min-w-[100px] whitespace-nowrap">
                  {formatDate(p.endDate)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section, si) => {
              const hasChildren = section.children.length > 0
              const open = isOpen(section.header.key)
              const hdr = section.header
              const vt = hdr.valueType ?? 'money'

              return [
                // Section header row
                hdr.key !== '__orphan__' && (
                  <tr
                    key={`hdr-${si}`}
                    id={`yfrow-${hdr.key}`}
                    className={`border-b border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 cursor-pointer select-none ${flashKey === hdr.key ? 'row-flash' : ''}`}
                    onClick={() => hasChildren && setExpanded(e => ({ ...e, [hdr.key]: !isOpen(hdr.key) }))}
                  >
                    <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 font-semibold text-slate-800 whitespace-nowrap flex items-center gap-1.5">
                      {hasChildren && (
                        <svg
                          className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      {!hasChildren && <span className="w-3 shrink-0" />}
                      {hdr.label}
                    </td>
                    {showTTM && ttmData && (
                      <td className={`text-right px-3 py-2 tabular-nums font-semibold whitespace-nowrap ${
                        isNegNum(ttmData[hdr.key], vt) ? 'text-red-600' : 'text-slate-800'
                      }`}>
                        {fmtValue(ttmData[hdr.key], vt)}
                      </td>
                    )}
                    {displayPeriods.map((p, j) => (
                      <td key={j} className={`text-right px-3 py-2 tabular-nums font-semibold whitespace-nowrap ${
                        isNegNum(p[hdr.key], vt) ? 'text-red-600' : 'text-slate-700'
                      }`}>
                        {fmtValue(p[hdr.key], vt)}
                      </td>
                    ))}
                  </tr>
                ),
                // Child rows (shown when section is open)
                ...(open || !hasChildren ? section.children.map((row, ri) => {
                  const rvt = row.valueType ?? 'money'
                  return (
                    <tr key={`row-${si}-${ri}`} id={`yfrow-${row.key}`} className={`border-b border-slate-50 hover:bg-slate-50/40 ${flashKey === row.key ? 'row-flash' : ''}`}>
                      <td className="sticky left-0 z-10 bg-white pl-10 pr-4 py-1.5 text-slate-500 whitespace-nowrap">
                        {row.label}
                      </td>
                      {showTTM && ttmData && (
                        <td className={`text-right px-3 py-1.5 tabular-nums whitespace-nowrap ${
                          isNegNum(ttmData[row.key], rvt) ? 'text-red-500' : 'text-slate-600'
                        }`}>
                          {fmtValue(ttmData[row.key], rvt)}
                        </td>
                      )}
                      {displayPeriods.map((p, j) => (
                        <td key={j} className={`text-right px-3 py-1.5 tabular-nums whitespace-nowrap ${
                          isNegNum(p[row.key], rvt) ? 'text-red-500' : 'text-slate-600'
                        }`}>
                          {fmtValue(p[row.key], rvt)}
                        </td>
                      ))}
                    </tr>
                  )
                }) : []),
              ]
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 text-[10px] text-slate-300">
        Source: Yahoo Finance · Values in thousands · Empty rows hidden automatically
      </div>
    </div>
  )
}
