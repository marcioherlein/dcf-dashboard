'use client'
import { useState } from 'react'

interface ISRow {
  year: string
  revenue: number | null
  costOfRevenue: number | null
  grossProfit: number | null
  sgaExpense: number | null
  rndExpense: number | null
  ebitda: number | null
  dna: number | null
  operatingIncome: number | null
  interestExpense: number | null
  pretaxIncome: number | null
  taxProvision: number | null
  netIncome: number | null
  eps: number | null
  isProjected: boolean
}
interface BSRow {
  year: string
  cash: number | null
  netReceivables: number | null
  inventory: number | null
  totalCurrentAssets: number | null
  netPPE: number | null
  totalAssets: number | null
  accountsPayable: number | null
  shortTermDebt: number | null
  totalCurrentLiabilities: number | null
  longTermDebt: number | null
  totalDebt: number | null
  totalEquity: number | null
  isProjected: boolean
}
interface CFRow {
  year: string
  operatingCF: number | null
  dna: number | null
  stockBasedComp: number | null
  changesInWC: number | null
  capex: number | null
  freeCashFlow: number | null
  investingCF: number | null
  debtIssuance: number | null
  debtRepayment: number | null
  buybacks: number | null
  dividendsPaid: number | null
  financingCF: number | null
  isProjected: boolean
}
interface Props {
  incomeStatement: ISRow[]
  balanceSheet: BSRow[]
  cashFlow: CFRow[]
  currency?: string
  cagr?: number
}

const TABS = ['Income Statement', 'Balance Sheet', 'Cash Flow'] as const
type Tab = typeof TABS[number]

function fmtM(v: number | null, showSign = false): { text: string; color: string } {
  if (v === null || v === undefined) return { text: '—', color: 'text-[#8A95A6]' }
  const abs = Math.abs(v)
  let text: string
  if (abs >= 1000) text = `${(v / 1000).toFixed(1)}B`
  else text = `${v.toFixed(0)}M`
  if (showSign && v > 0) text = '+' + text
  const color = v < 0 ? 'text-[#D83B3B]' : v === 0 ? 'text-[#8A95A6]' : 'text-[#06101F]'
  return { text, color }
}

function fmtEps(v: number | null): { text: string; color: string } {
  if (v === null) return { text: '—', color: 'text-[#8A95A6]' }
  const color = v < 0 ? 'text-[#D83B3B]' : 'text-[#06101F]'
  return { text: `$${v.toFixed(2)}`, color }
}

function Cell({ v, showSign = false, isMoney = true, isProjected = false }: {
  v: number | null; showSign?: boolean; isMoney?: boolean; isProjected?: boolean
}) {
  const { text, color } = isMoney ? fmtM(v, showSign) : fmtEps(v)
  return (
    <td className={`px-3 py-2 text-right text-xs tabular-nums ${color} ${isProjected ? 'opacity-90' : ''}`}>
      {text}
    </td>
  )
}

function YearHeader({ year, isProjected }: { year: string; isProjected: boolean }) {
  return (
    <th className={`px-3 py-2 text-right text-[11px] font-semibold whitespace-nowrap ${
      isProjected ? 'text-violet-500' : 'text-[#566174]'
    }`}>
      {year}
      {isProjected && <span className="ml-1 text-[10px] opacity-60">proj</span>}
    </th>
  )
}

function RowLabel({ label, indent = false, bold = false }: { label: string; indent?: boolean; bold?: boolean }) {
  return (
    <td className={`sticky left-0 z-10 bg-white py-2 pr-4 text-xs whitespace-nowrap ${
      indent
        ? 'pl-8 text-[#8A95A6]'
        : bold
        ? 'pl-4 font-semibold text-[#06101F]'
        : 'pl-4 font-medium text-[#566174]'
    }`}>
      {label}
    </td>
  )
}

function Divider({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols + 1} className="py-0">
        <div className="h-px bg-[#F4F3EF]" />
      </td>
    </tr>
  )
}

function SectionHeader({ label, cols }: { label: string; cols: number }) {
  return (
    <tr className="bg-[#F4F3EF]">
      <td
        colSpan={cols + 1}
        className="sticky left-0 z-10 bg-[#F4F3EF] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#566174]"
      >
        {label}
      </td>
    </tr>
  )
}

function DataRow<T>({
  rows, label, get, indent = false, bold = false, showSign = false, isMoney = true, highlight = false,
}: {
  rows: T[]
  label: string
  get: (r: T) => number | null
  indent?: boolean
  bold?: boolean
  showSign?: boolean
  isMoney?: boolean
  highlight?: boolean
}) {
  const base = highlight
    ? 'bg-[#F4F3EF]/60 hover:bg-[#F4F3EF]/60'
    : 'hover:bg-[#F4F3EF]/50'
  return (
    <tr className={base}>
      <RowLabel label={label} indent={indent} bold={bold} />
      {(rows as (T & { isProjected?: boolean })[]).map((r, i) => (
        <Cell key={i} v={get(r)} showSign={showSign} isMoney={isMoney} isProjected={r.isProjected ?? false} />
      ))}
    </tr>
  )
}

export default function FinancialStatements({ incomeStatement, balanceSheet, cashFlow, currency = '$', cagr }: Props) {
  const [tab, setTab] = useState<Tab>('Income Statement')

  const allYears = (rows: { year: string; isProjected: boolean }[]) =>
    rows.map(r => ({ year: r.year, isProjected: r.isProjected }))

  return (
    <div className="rounded-xl card">
      {/* Header + Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E1DA] px-4 sm:px-6 py-4">
        <div>
          <h2 className="text-sm font-headline font-semibold text-[#06101F]">Financial Statements</h2>
          <p className="mt-0.5 text-xs text-[#8A95A6]">Historical actuals · Model projections</p>
        </div>
        <div className="flex rounded-xl bg-[#F4F3EF] p-1 gap-1 overflow-x-auto flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-2 min-h-[44px] text-xs font-medium transition-all whitespace-nowrap ${
                tab === t
                  ? 'bg-white text-[#06101F] shadow-sm'
                  : 'text-[#566174] hover:text-[#06101F]'
              }`}
            >
              {/* Abbreviated labels on narrow screens, full labels on sm+ */}
              <span className="sm:hidden">
                {t === 'Income Statement' ? 'Income' : t === 'Balance Sheet' ? 'Balance' : 'Cash Flow'}
              </span>
              <span className="hidden sm:inline">{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">

        {/* ── Income Statement ── */}
        {tab === 'Income Statement' && (() => {
          const rows = incomeStatement
          const years = allYears(rows)
          const nc = years.length
          return (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[#F4F3EF]">
                  <th className="sticky left-0 z-10 bg-white py-2 pl-4 pr-4 text-left text-[11px] font-medium text-[#8A95A6] whitespace-nowrap">
                    {currency}M
                  </th>
                  {years.map((y, i) => <YearHeader key={i} year={y.year} isProjected={y.isProjected} />)}
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="Revenue" cols={nc} />
                <DataRow rows={rows} label="Total Revenue"       bold   get={r => r.revenue}         />
                <DataRow rows={rows} label="Cost of Revenue"     indent get={r => r.costOfRevenue}   />
                <DataRow rows={rows} label="Gross Profit"        bold   get={r => r.grossProfit}     />

                <SectionHeader label="Operating Expenses" cols={nc} />
                <DataRow rows={rows} label="SG&A"                indent get={r => r.sgaExpense}      />
                <DataRow rows={rows} label="R&D"                 indent get={r => r.rndExpense}      />
                <Divider cols={nc} />
                <DataRow rows={rows} label="EBITDA"              bold   get={r => r.ebitda}          />
                <DataRow rows={rows} label="D&A"                 indent get={r => r.dna}             />
                <DataRow rows={rows} label="EBIT / Op. Income"   bold   get={r => r.operatingIncome} />

                <SectionHeader label="Below the Line" cols={nc} />
                <DataRow rows={rows} label="Interest Expense"    indent get={r => r.interestExpense} />
                <DataRow rows={rows} label="Pre-tax Income"      indent get={r => r.pretaxIncome}    />
                <DataRow rows={rows} label="Tax Provision"       indent get={r => r.taxProvision}    />
                <Divider cols={nc} />
                <DataRow rows={rows} label="Net Income"          bold   get={r => r.netIncome}       />
                <DataRow rows={rows} label="EPS (diluted)"       indent isMoney={false} get={r => r.eps} />
              </tbody>
            </table>
          )
        })()}

        {/* ── Balance Sheet ── */}
        {tab === 'Balance Sheet' && (() => {
          const rows = balanceSheet
          const years = allYears(rows)
          const nc = years.length
          return (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[#F4F3EF]">
                  <th className="sticky left-0 z-10 bg-white py-2 pl-4 pr-4 text-left text-[11px] font-medium text-[#8A95A6] whitespace-nowrap">
                    {currency}M
                  </th>
                  {years.map((y, i) => <YearHeader key={i} year={y.year} isProjected={y.isProjected} />)}
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="Assets" cols={nc} />
                <DataRow rows={rows} label="Cash & Equivalents"     bold   get={r => r.cash}                    />
                <DataRow rows={rows} label="Net Receivables"        indent get={r => r.netReceivables}          />
                <DataRow rows={rows} label="Inventory"              indent get={r => r.inventory}               />
                <DataRow rows={rows} label="Current Assets"         bold   get={r => r.totalCurrentAssets}      />
                <DataRow rows={rows} label="Net PP&E"               indent get={r => r.netPPE}                  />
                <DataRow rows={rows} label="Total Assets"           bold   get={r => r.totalAssets}             highlight />

                <SectionHeader label="Liabilities" cols={nc} />
                <DataRow rows={rows} label="Accounts Payable"       indent get={r => r.accountsPayable}         />
                <DataRow rows={rows} label="Short-term Debt"        indent get={r => r.shortTermDebt}           />
                <DataRow rows={rows} label="Current Liabilities"    bold   get={r => r.totalCurrentLiabilities} />
                <DataRow rows={rows} label="Long-term Debt"         indent get={r => r.longTermDebt}            />
                <DataRow rows={rows} label="Total Debt"             bold   get={r => r.totalDebt}               />

                <SectionHeader label="Equity" cols={nc} />
                <DataRow rows={rows} label="Total Equity"           bold   get={r => r.totalEquity}             highlight />
              </tbody>
            </table>
          )
        })()}

        {/* ── Cash Flow ── */}
        {tab === 'Cash Flow' && (() => {
          const rows = cashFlow
          const years = allYears(rows)
          const nc = years.length
          return (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[#F4F3EF]">
                  <th className="sticky left-0 z-10 bg-white py-2 pl-4 pr-4 text-left text-[11px] font-medium text-[#8A95A6] whitespace-nowrap">
                    {currency}M
                  </th>
                  {years.map((y, i) => <YearHeader key={i} year={y.year} isProjected={y.isProjected} />)}
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="Operating Activities" cols={nc} />
                <DataRow rows={rows} label="Operating Cash Flow"       bold   get={r => r.operatingCF}    highlight />
                <DataRow rows={rows} label="D&A"                       indent get={r => r.dna}             />
                <DataRow rows={rows} label="Stock-Based Compensation"  indent get={r => r.stockBasedComp}  />
                <DataRow rows={rows} label="Changes in Working Capital" indent showSign get={r => r.changesInWC} />

                <SectionHeader label="Investing Activities" cols={nc} />
                <DataRow rows={rows} label="Capital Expenditures"      indent showSign get={r => r.capex}      />
                <DataRow rows={rows} label="Investing CF"              bold   showSign get={r => r.investingCF} />

                <SectionHeader label="Free Cash Flow" cols={nc} />
                <DataRow rows={rows} label="Free Cash Flow"            bold   get={r => r.freeCashFlow}    highlight />

                <SectionHeader label="Financing Activities" cols={nc} />
                <DataRow rows={rows} label="Debt Issuance"             indent get={r => r.debtIssuance}    />
                <DataRow rows={rows} label="Debt Repayment"            indent showSign get={r => r.debtRepayment} />
                <DataRow rows={rows} label="Share Buybacks"            indent showSign get={r => r.buybacks}      />
                <DataRow rows={rows} label="Dividends Paid"            indent showSign get={r => r.dividendsPaid} />
                <DataRow rows={rows} label="Financing CF"              bold   showSign get={r => r.financingCF}   />
              </tbody>
            </table>
          )
        })()}

      </div>

      {/* Legend */}
      <div className="border-t border-[#F4F3EF] px-6 py-3 flex items-center gap-4 text-[10px] text-[#8A95A6]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#8A95A6]" />
          Historical actuals
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-400" />
          Model projections{cagr !== undefined ? ` (based on ${(cagr * 100).toFixed(1)}% CAGR)` : ''}
        </span>
      </div>
    </div>
  )
}
