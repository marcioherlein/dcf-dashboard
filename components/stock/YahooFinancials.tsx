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
    // Fix S6: return '—' for zero shares (data error)
    if (num === 0) return '—'
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
        // Fix S3: give orphan rows an explicit label instead of silent blank
        current = { header: { key: '__orphan__', label: 'Other', indent: 0 }, children: [] }
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
  // Fix S1: track when TTM should show but data is absent for this statement
  const ttmMissing = showTTM && !ttmData

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

  // Fix S5: flag when fewer than 4 periods are available
  const sparseHistory = period === 'annual' && displayPeriods.length < 4

  return (
    <div className="overflow-hidden">
      {/* Fix S2: row-flash keyframe animation */}
      <style>{`
        @keyframes row-flash-anim {
          0%   { background-color: #fef9c3; }
          70%  { background-color: #fef9c3; }
          100% { background-color: transparent; }
        }
        .row-flash { animation: row-flash-anim 2s ease-out forwards; }
      `}</style>

      {/* Controls — two rows on mobile, one row on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 sm:px-4 py-3 border-b border-slate-100">
        {/* Statement tabs — scrollable strip on mobile */}
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-1">
          <div className="flex gap-0 min-w-max">
            {STATEMENT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatement(tab.id)}
                className={`px-3 sm:px-4 py-2 text-[12px] sm:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  statement === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {/* Right controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[12px]">
            <button
              onClick={() => setPeriod('annual')}
              className={`px-3 py-1.5 ${period === 'annual' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}
            >
              Annual
            </button>
            <button
              onClick={() => setPeriod('quarterly')}
              className={`px-3 py-1.5 border-l border-slate-200 ${period === 'quarterly' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}
            >
              Quarterly
            </button>
          </div>
          <button onClick={() => toggleAll(false)} className="text-[12px] text-slate-500 hover:text-slate-700 whitespace-nowrap min-h-[36px] px-2.5 py-1 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
            Collapse all
          </button>
          <button onClick={() => toggleAll(true)} className="text-[12px] text-blue-600 hover:text-blue-700 whitespace-nowrap min-h-[36px] px-2.5 py-1 rounded-full border border-blue-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
            Expand all
          </button>
        </div>
      </div>

      {/* Fix S5: sparse history notice */}
      {sparseHistory && (
        <div className="px-4 pt-2 flex items-center gap-1.5 text-[11px] text-amber-600">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          Only {displayPeriods.length} {period} {displayPeriods.length === 1 ? 'period' : 'periods'} available — limited history
        </div>
      )}

      <div className="px-4 pt-2 pb-1 text-[11px] text-slate-400 flex items-center gap-3">
        <span>Values displayed in thousands (K), millions (M), or billions (B) · TTM = trailing twelve months{reportingCurrency && reportingCurrency !== currency ? ` · Reported in ${reportingCurrency}` : ''}</span>
        {/* Fix S1: show note when TTM data absent for this statement */}
        {ttmMissing && (
          <span className="text-slate-400 italic">TTM not available for this statement</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-[480px] w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="sticky left-0 z-10 bg-white text-left px-3 sm:px-4 py-2 text-[11px] font-semibold text-slate-500 w-44 min-w-[160px] sm:w-64 sm:min-w-[220px]">
                Breakdown
              </th>
              {showTTM && ttmData && (
                <th className="text-right px-2 sm:px-3 py-2 text-[11px] font-semibold text-amber-600 min-w-[80px] sm:min-w-[100px] whitespace-nowrap">
                  TTM
                </th>
              )}
              {displayPeriods.map((p, i) => (
                <th key={i} className="text-right px-2 sm:px-3 py-2 text-[11px] font-semibold text-slate-600 min-w-[80px] sm:min-w-[100px] whitespace-nowrap">
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
              const isOrphan = hdr.key === '__orphan__'

              return [
                // Section header row
                (
                  <tr
                    key={`hdr-${si}`}
                    id={`yfrow-${hdr.key}`}
                    className={`border-b border-slate-100 ${isOrphan ? 'bg-slate-50/30' : 'bg-slate-50/60 hover:bg-slate-100/60 cursor-pointer select-none'} ${flashKey === hdr.key ? 'row-flash' : ''}`}
                    onClick={() => !isOrphan && hasChildren && setExpanded(e => ({ ...e, [hdr.key]: !isOpen(hdr.key) }))}
                  >
                    <td className="sticky left-0 z-10 bg-slate-50 px-3 sm:px-4 py-2 font-semibold text-slate-900 whitespace-nowrap flex items-center gap-1.5">
                      {!isOrphan && hasChildren && (
                        <svg
                          className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      {(isOrphan || !hasChildren) && <span className="w-3 shrink-0" />}
                      {/* Fix S3: orphan rows get a subtle "Other" label instead of blank */}
                      <span className={isOrphan ? 'text-[11px] font-medium text-slate-400 uppercase tracking-wider' : ''}>
                        {hdr.label}
                      </span>
                    </td>
                    {showTTM && ttmData && (
                      <td className={`text-right px-2 sm:px-3 py-2 tabular-nums font-semibold whitespace-nowrap ${
                        isNegNum(ttmData[hdr.key], vt) ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {isOrphan ? '' : fmtValue(ttmData[hdr.key], vt)}
                      </td>
                    )}
                    {displayPeriods.map((p, j) => (
                      <td key={j} className={`text-right px-2 sm:px-3 py-2 tabular-nums font-semibold whitespace-nowrap ${
                        isNegNum(p[hdr.key], vt) ? 'text-red-600' : 'text-slate-700'
                      }`}>
                        {isOrphan ? '' : fmtValue(p[hdr.key], vt)}
                      </td>
                    ))}
                  </tr>
                ),
                // Child rows (shown when section is open)
                ...(open || !hasChildren ? section.children.map((row, ri) => {
                  const rvt = row.valueType ?? 'money'
                  return (
                    <tr key={`row-${si}-${ri}`} id={`yfrow-${row.key}`} className={`border-b border-slate-50 hover:bg-slate-50/40 ${flashKey === row.key ? 'row-flash' : ''}`}>
                      <td className="sticky left-0 z-10 bg-white pl-7 sm:pl-10 pr-3 sm:pr-4 py-1.5 text-slate-500 whitespace-nowrap">
                        {row.label}
                      </td>
                      {showTTM && ttmData && (
                        <td className={`text-right px-2 sm:px-3 py-1.5 tabular-nums whitespace-nowrap ${
                          isNegNum(ttmData[row.key], rvt) ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {fmtValue(ttmData[row.key], rvt)}
                        </td>
                      )}
                      {displayPeriods.map((p, j) => (
                        <td key={j} className={`text-right px-2 sm:px-3 py-1.5 tabular-nums whitespace-nowrap ${
                          isNegNum(p[row.key], rvt) ? 'text-red-600' : 'text-slate-600'
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

      <div className="px-4 py-2 text-[10px] text-slate-400">
        Source: Yahoo Finance · Empty rows hidden automatically
      </div>
    </div>
  )
}
