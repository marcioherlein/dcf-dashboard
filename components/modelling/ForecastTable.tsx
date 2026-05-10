'use client'

import { useState } from 'react'
import type { UFCFRow } from '@/lib/valuation/unleveredDcf'
import type { LFCFRow } from '@/lib/valuation/leveredDcf'
import { fmtM, fmtPct, fmtGrowth } from '@/lib/valuation/formatValuation'

type Mode = 'ufcf' | 'lfcf'

interface ForecastTableProps {
  ufcfRows: UFCFRow[]
  lfcfRows: LFCFRow[]
  currency: string
  onCellEdit?: (rowIndex: number, field: string, value: number) => void
}

function GrowthLabel({ value }: { value: string }) {
  if (value === '—') return <span className="text-slate-400">—</span>
  const pos = value.startsWith('+')
  return <span className={pos ? 'text-green-600' : 'text-red-500'}>{value}</span>
}

function Cell({
  value, isProjected, isEditable, fieldName, rowIndex,
  onEdit, highlight,
}: {
  value: string; isProjected: boolean; isEditable: boolean; fieldName: string; rowIndex: number
  onEdit?: (rowIndex: number, field: string, value: number) => void
  highlight?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const baseClass = 'px-2 py-1.5 text-right font-mono text-xs tabular-nums whitespace-nowrap'
  const projClass = isProjected ? 'bg-slate-50' : ''
  const editableClass = isEditable && isProjected ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700' : ''
  const highlightClass = highlight ? 'font-semibold' : ''

  if (editing && isEditable && isProjected) {
    return (
      <td className={`${baseClass} ${projClass}`}>
        <input
          autoFocus
          className="w-20 rounded border border-blue-400 bg-blue-50 px-1 py-0 text-right text-xs text-blue-700 focus:outline-none"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const raw = draft.replace(/[$,BM%()]/g, '').trim()
              const parsed = parseFloat(raw)
              if (!isNaN(parsed) && onEdit) onEdit(rowIndex, fieldName, parsed)
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => {
            const raw = draft.replace(/[$,BM%()]/g, '').trim()
            const parsed = parseFloat(raw)
            if (!isNaN(parsed) && onEdit) onEdit(rowIndex, fieldName, parsed)
            setEditing(false)
          }}
        />
      </td>
    )
  }

  return (
    <td
      className={`${baseClass} ${projClass} ${editableClass} ${highlightClass} ${isProjected ? 'text-slate-700' : 'text-slate-400'}`}
      onClick={() => {
        if (isEditable && isProjected) {
          setDraft(value.replace(/[$,BM%()]/g, ''))
          setEditing(true)
        }
      }}
    >
      {value}
    </td>
  )
}

type RowDef = {
  key: string
  label: string
  indent?: boolean
  separator?: boolean
  bold?: boolean
  pct?: boolean
  negate?: boolean     // display positive number in parentheses (e.g. capex)
  formatFn?: (row: UFCFRow | LFCFRow, prior: UFCFRow | LFCFRow | null) => string | null
  editable?: boolean
}

const UFCF_ROWS: RowDef[] = [
  { key: 'revenue', label: 'Revenue', editable: true },
  { key: 'revenueGrowth', label: ' YoY Growth', indent: true, pct: true,
    formatFn: (r, p) => fmtGrowth((r as UFCFRow).revenue, (p as UFCFRow | null)?.revenue ?? null) },
  { key: 'ebit', label: 'EBIT', editable: true },
  { key: 'ebitMargin', label: ' EBIT Margin', indent: true, pct: true,
    formatFn: (r) => {
      const row = r as UFCFRow
      if (row.ebit == null || row.revenue == null || row.revenue === 0) return '—'
      return fmtPct(row.ebit / row.revenue)
    }},
  { key: 'dna', label: 'D&A', bold: false },
  { key: 'capex', label: 'CapEx', negate: true, editable: true },
  { key: 'nwcDelta', label: 'ΔNWC', negate: true },
  { key: 'separator1', label: '', separator: true },
  { key: 'ufcf', label: 'UFCF', bold: true },
  { key: 'pvUfcf', label: ' PV(UFCF)', indent: true },
]

const LFCF_ROWS: RowDef[] = [
  { key: 'revenue', label: 'Revenue', editable: true },
  { key: 'netIncome', label: 'Net Income', editable: true },
  { key: 'dna', label: 'D&A' },
  { key: 'capex', label: 'CapEx', negate: true, editable: true },
  { key: 'nwcDelta', label: 'ΔNWC', negate: true },
  { key: 'netDebtRepayment', label: 'Net Debt Repayment', negate: true, editable: true },
  { key: 'separator1', label: '', separator: true },
  { key: 'lfcf', label: 'LFCF', bold: true },
  { key: 'pvLfcf', label: ' PV(LFCF)', indent: true },
]

function getValue(row: UFCFRow | LFCFRow, key: string, mode: Mode, prior: UFCFRow | LFCFRow | null, rowDef: RowDef): string {
  if (rowDef.formatFn) return rowDef.formatFn(row, prior) ?? '—'

  let v: number | null = null
  if (mode === 'ufcf') {
    const r = row as UFCFRow
    if (key === 'revenue') v = r.revenue
    else if (key === 'ebit') v = r.ebit
    else if (key === 'ebitda') v = r.ebitda
    else if (key === 'dna') v = r.dna
    else if (key === 'capex') v = r.capex
    else if (key === 'nwcDelta') v = r.nwcDelta
    else if (key === 'ufcf') v = r.ufcf
    else if (key === 'pvUfcf') v = r.pvUfcf
  } else {
    const r = row as LFCFRow
    if (key === 'revenue') v = r.revenue
    else if (key === 'netIncome') v = r.netIncome
    else if (key === 'ebit') v = r.ebit
    else if (key === 'dna') v = r.dna
    else if (key === 'capex') v = r.capex
    else if (key === 'nwcDelta') v = r.nwcDelta
    else if (key === 'netDebtRepayment') v = r.netDebtRepayment
    else if (key === 'lfcf') v = r.lfcf
    else if (key === 'pvLfcf') v = r.pvLfcf
  }

  if (v == null) return '—'
  if (rowDef.pct) return fmtPct(v)
  // Apply negate: capex stored negative, show in parens
  return fmtM(v)
}

export default function ForecastTable({ ufcfRows, lfcfRows, currency, onCellEdit }: ForecastTableProps) {
  const [mode, setMode] = useState<Mode>('ufcf')

  const rows = mode === 'ufcf' ? ufcfRows : lfcfRows
  const rowDefs = mode === 'ufcf' ? UFCF_ROWS : LFCF_ROWS
  const curr = currency === 'USD' ? '$' : currency + ' '

  const firstProjectedIdx = rows.findIndex(r => r.isProjected)
  const showSeparator = firstProjectedIdx > 0

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">DCF Forecast Table</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Actuals (A) are read-only · Estimates (E) are editable — click to change
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          <button
            onClick={() => setMode('ufcf')}
            className={`px-3 py-1.5 font-medium transition-colors ${mode === 'ufcf' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Unlevered
          </button>
          <button
            onClick={() => setMode('lfcf')}
            className={`px-3 py-1.5 font-medium transition-colors ${mode === 'lfcf' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Levered
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left text-[11px] font-semibold text-slate-500 w-40 min-w-[160px]">
                {curr}M
              </th>
              {rows.map((row, i) => {
                const isFirst = i === firstProjectedIdx
                return (
                  <th
                    key={row.year}
                    className={`px-2 py-2 text-right text-[11px] font-semibold whitespace-nowrap ${row.isProjected ? 'text-blue-600 bg-blue-50' : 'text-slate-500'} ${isFirst && showSeparator ? 'border-l-2 border-l-slate-300' : ''}`}
                  >
                    {row.year} {row.isProjected ? '(E)' : '(A)'}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rowDefs.map((rowDef) => {
              if (rowDef.separator) {
                return (
                  <tr key={rowDef.key}>
                    <td colSpan={rows.length + 1} className="border-t border-slate-200 py-0" />
                  </tr>
                )
              }

              return (
                <tr key={rowDef.key} className={`border-b border-slate-50 hover:bg-slate-50/50 ${rowDef.bold ? 'font-semibold' : ''}`}>
                  <td className={`sticky left-0 z-10 bg-white px-4 py-1.5 text-xs whitespace-nowrap ${rowDef.indent ? 'pl-7 text-slate-400' : 'text-slate-700'} ${rowDef.bold ? 'font-semibold text-slate-800' : ''}`}>
                    {rowDef.label}
                  </td>
                  {rows.map((row, i) => {
                    const prior = i > 0 ? rows[i - 1] : null
                    const val = getValue(row, rowDef.key, mode, prior, rowDef)
                    const isFirst = i === firstProjectedIdx
                    return (
                      <Cell
                        key={`${row.year}-${rowDef.key}`}
                        value={val}
                        isProjected={row.isProjected}
                        isEditable={rowDef.editable ?? false}
                        fieldName={rowDef.key}
                        rowIndex={i}
                        onEdit={onCellEdit}
                        highlight={rowDef.bold}
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2 border-t border-slate-100 text-[11px] text-slate-400 flex gap-4">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-50 border border-blue-200 mr-1" />Editable estimate</span>
        <span><span className="text-slate-400 mr-1">—</span>Data not available from API</span>
        <span className="text-blue-600 font-medium cursor-default">Blue values have been edited</span>
      </div>
    </div>
  )
}
