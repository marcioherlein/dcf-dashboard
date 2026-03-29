'use client'
import { useState } from 'react'

interface ISRow {
  year: string; revenue: number | null; grossProfit: number | null
  operatingIncome: number | null; ebitda: number | null
  netIncome: number | null; eps: number | null; isProjected: boolean
}
interface BSRow {
  year: string; cash: number | null; totalCurrentAssets: number | null
  totalAssets: number | null; longTermDebt: number | null
  totalCurrentLiabilities: number | null; totalEquity: number | null; isProjected: boolean
}
interface CFRow {
  year: string; operatingCF: number | null; capex: number | null
  freeCashFlow: number | null; investingCF: number | null
  financingCF: number | null; dividendsPaid: number | null; isProjected: boolean
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
  if (v === null || v === undefined) return { text: '—', color: 'text-gray-400 dark:text-white/25' }
  const abs = Math.abs(v)
  let text: string
  if (abs >= 1000) text = `${(v / 1000).toFixed(1)}B`
  else text = `${v.toFixed(0)}M`
  if (showSign && v > 0) text = '+' + text
  const color = v < 0 ? 'text-red-500 dark:text-red-400' : v === 0 ? 'text-gray-400 dark:text-white/25' : 'text-gray-800 dark:text-white/80'
  return { text, color }
}

function fmtEps(v: number | null): { text: string; color: string } {
  if (v === null) return { text: '—', color: 'text-gray-400 dark:text-white/25' }
  const color = v < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-white/80'
  return { text: `$${v.toFixed(2)}`, color }
}

function Cell({ v, showSign = false, isMoney = true, isProjected = false }: { v: number | null; showSign?: boolean; isMoney?: boolean; isProjected?: boolean }) {
  const { text, color } = isMoney ? fmtM(v, showSign) : fmtEps(v)
  return (
    <td className={`px-3 py-2.5 text-right text-xs tabular-nums ${color} ${isProjected ? 'opacity-90' : ''}`}>
      {text}
    </td>
  )
}

function YearHeader({ year, isProjected }: { year: string; isProjected: boolean }) {
  return (
    <th className={`px-3 py-2 text-right text-[11px] font-semibold whitespace-nowrap ${
      isProjected
        ? 'text-violet-500 dark:text-violet-400'
        : 'text-gray-500 dark:text-white/40'
    }`}>
      {year}
      {isProjected && <span className="ml-1 text-[9px] opacity-60">proj</span>}
    </th>
  )
}

function RowLabel({ label, indent = false }: { label: string; indent?: boolean }) {
  return (
    <td className={`sticky left-0 z-10 bg-white dark:bg-[#111] py-2.5 pr-4 text-xs whitespace-nowrap ${
      indent ? 'pl-6 text-gray-400 dark:text-white/30' : 'pl-4 font-medium text-gray-600 dark:text-white/50'
    }`}>
      {label}
    </td>
  )
}

function Divider({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols + 1} className="pt-1 pb-0">
        <div className="h-px bg-gray-100 dark:bg-white/5" />
      </td>
    </tr>
  )
}

export default function FinancialStatements({ incomeStatement, balanceSheet, cashFlow, currency = '$', cagr }: Props) {
  const [tab, setTab] = useState<Tab>('Income Statement')

  const allYears = (rows: { year: string; isProjected: boolean }[]) =>
    rows.map(r => ({ year: r.year, isProjected: r.isProjected }))

  return (
    <div className="rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8">
      {/* Header + Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-white/5 px-6 py-4">
        <div>
          <h2 className="text-sm font-headline font-semibold text-on-surface dark:text-white/70">Financial Statements</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-white/25">Historical actuals · Model projections</p>
        </div>
        <div className="flex rounded-xl bg-gray-100 dark:bg-white/5 p-1 gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                tab === t
                  ? 'bg-white dark:bg-white/15 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        {tab === 'Income Statement' && (() => {
          const rows = incomeStatement
          const years = allYears(rows)
          return (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-white/5">
                  <th className="sticky left-0 z-10 bg-white dark:bg-[#111] py-2 pl-4 pr-4 text-left text-[11px] font-medium text-gray-400 dark:text-white/25 whitespace-nowrap">
                    {currency}M
                  </th>
                  {years.map((y, i) => (
                    <YearHeader key={i} year={y.year} isProjected={y.isProjected} />
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Revenue" />
                  {rows.map((r, i) => <Cell key={i} v={r.revenue} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Gross Profit" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.grossProfit} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="EBITDA" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.ebitda} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Operating Income" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.operatingIncome} isProjected={r.isProjected} />)}
                </tr>
                <Divider cols={years.length} />
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Net Income" />
                  {rows.map((r, i) => <Cell key={i} v={r.netIncome} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="EPS (diluted)" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.eps} isMoney={false} isProjected={r.isProjected} />)}
                </tr>
              </tbody>
            </table>
          )
        })()}

        {tab === 'Balance Sheet' && (() => {
          const rows = balanceSheet
          const years = allYears(rows)
          return (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-white/5">
                  <th className="sticky left-0 z-10 bg-white dark:bg-[#111] py-2 pl-4 pr-4 text-left text-[11px] font-medium text-gray-400 dark:text-white/25 whitespace-nowrap">
                    {currency}M
                  </th>
                  {years.map((y, i) => (
                    <YearHeader key={i} year={y.year} isProjected={y.isProjected} />
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Cash & Equivalents" />
                  {rows.map((r, i) => <Cell key={i} v={r.cash} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Current Assets" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.totalCurrentAssets} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Total Assets" />
                  {rows.map((r, i) => <Cell key={i} v={r.totalAssets} isProjected={r.isProjected} />)}
                </tr>
                <Divider cols={years.length} />
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Current Liabilities" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.totalCurrentLiabilities} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Long-Term Debt" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.longTermDebt} isProjected={r.isProjected} />)}
                </tr>
                <Divider cols={years.length} />
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Total Equity" />
                  {rows.map((r, i) => <Cell key={i} v={r.totalEquity} isProjected={r.isProjected} />)}
                </tr>
              </tbody>
            </table>
          )
        })()}

        {tab === 'Cash Flow' && (() => {
          const rows = cashFlow
          const years = allYears(rows)
          return (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-white/5">
                  <th className="sticky left-0 z-10 bg-white dark:bg-[#111] py-2 pl-4 pr-4 text-left text-[11px] font-medium text-gray-400 dark:text-white/25 whitespace-nowrap">
                    {currency}M
                  </th>
                  {years.map((y, i) => (
                    <YearHeader key={i} year={y.year} isProjected={y.isProjected} />
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Operating Cash Flow" />
                  {rows.map((r, i) => <Cell key={i} v={r.operatingCF} isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Capital Expenditures" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.capex} showSign isProjected={r.isProjected} />)}
                </tr>
                <tr className="bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-100/50 dark:hover:bg-white/[0.04]">
                  <RowLabel label="Free Cash Flow" />
                  {rows.map((r, i) => <Cell key={i} v={r.freeCashFlow} isProjected={r.isProjected} />)}
                </tr>
                <Divider cols={years.length} />
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Investing CF" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.investingCF} showSign isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Financing CF" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.financingCF} showSign isProjected={r.isProjected} />)}
                </tr>
                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                  <RowLabel label="Dividends Paid" indent />
                  {rows.map((r, i) => <Cell key={i} v={r.dividendsPaid} showSign isProjected={r.isProjected} />)}
                </tr>
              </tbody>
            </table>
          )
        })()}
      </div>

      {/* Legend */}
      <div className="border-t border-gray-50 dark:border-white/5 px-6 py-3 flex items-center gap-4 text-[10px] text-gray-400 dark:text-white/25">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-white/30" />Historical actuals</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" />Model projections{cagr !== undefined ? ` (based on ${(cagr * 100).toFixed(1)}% CAGR)` : ''}</span>
      </div>
    </div>
  )
}
