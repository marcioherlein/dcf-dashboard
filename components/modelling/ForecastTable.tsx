'use client'

import { useState, useMemo } from 'react'
import React from 'react'
import { NABadge } from '@/components/ui/na-badge'
import { cn } from '@/lib/utils'
import { FOUR_MODEL_DCF_WEIGHTS } from '@/lib/dcf/detectCompanyType'
import type { CompanyType } from '@/lib/dcf/detectCompanyType'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisplayRow {
  fiscalDate: string
  year: string
  isProjected: boolean
  revenue: number | null
  revenueGrowthPct: number | null
  ebit: number | null
  ebitMarginPct: number | null
  taxRatePct: number | null
  nopat: number | null
  nopatMarginPct: number | null
  dna: number | null
  dnaPct: number | null
  capex: number | null
  capexPct: number | null
  nwcDelta: number | null
  nwcDeltaPct: number | null
  ufcf: number | null
  ufcfGrowthPct: number | null
  pvUfcf: number | null
  sumPvUfcf: number | null
  netIncome: number | null
  netMarginPct: number | null
  netDebtRepayment: number | null
  netDebtRepaymentPct: number | null
  lfcf: number | null
  lfcfGrowthPct: number | null
  pvLfcf: number | null
  sumPvLfcf: number | null
}

export interface WACCData {
  costOfDebt: number
  taxRate: number
  afterTaxCostOfDebt: number
  rfRate: number
  erp: number
  crp?: number
  financialCurrency?: string
  beta: number
  costOfEquity: number
  totalDebtM: number | null
  marketCapM: number | null
  debtWeighting: number | null
  equityWeighting: number | null
  wacc: number
}

export interface TerminalData {
  method: 'perpetuity' | 'multiple'
  perpetuityTV: number | null
  perpetuityTVDiscounted: number | null
  exitMultipleTV: number | null
  exitMultipleTVDiscounted: number | null
  exitMultiple: number
  terminalG: number
  guardError: string | null
  sumPvUfcf: number
  cashM: number | null
  debtM: number | null
  sharesM: number | null
  currentPrice: number
  lfcfPerpetualTV?: number | null
  lfcfPerpetualTVDiscounted?: number | null
  lfcfExitMultipleTV?: number | null
  lfcfExitMultipleTVDiscounted?: number | null
  lfcfGuardError?: string | null
  sumPvLfcf?: number
}

interface ForecastTableProps {
  rows: DisplayRow[]
  waccData: WACCData
  terminalData: TerminalData
  currency: string
  onCellEdit: (year: string, field: string, value: number) => void
  onTerminalMethodChange: (method: 'perpetuity' | 'multiple') => void
  onExitMultipleChange: (value: number) => void
  onTerminalGChange: (value: number) => void
  currentWacc?: number
  onWaccChange?: (value: number) => void
  onModeChange?: (isLfcf: boolean) => void
  cagrAnalysis?: {
    analystEstimate1y?: number | null
    analystEstimate2y?: number | null
    historicalCagr3y?: number | null
  } | null
  blendedImpliedPrice?: number | null
  companyType?: string
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtVal(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const formatted =
    abs >= 1000
      ? abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
      : abs.toFixed(1)
  return v < 0 ? `(${formatted})` : formatted
}

function fmtPctDisplay(v: number | null): string {
  if (v == null) return '—'
  const pct = v * 100
  return (pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)) + '%'
}

function fmtLargeM(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return v < 0 ? `$(${formatted})M` : `$${formatted}M`
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function cellBg(row: { isProjected: boolean; year: string }): string {
  if (row.year === 'TTM') return 'bg-amber-500/10'
  if (row.isProjected) return 'bg-blue-500/8'
  return 'bg-[#080F1E]'
}

function cellText(row: { isProjected: boolean; year: string }): string {
  if (row.year === 'TTM') return 'text-amber-400'
  if (row.isProjected) return 'text-slate-300'
  return 'text-slate-400'
}

function colHeader(row: DisplayRow): string {
  if (row.year === 'TTM') return 'TTM'
  const label = row.fiscalDate?.slice(0, 4) ?? row.year
  return row.isProjected ? label + 'E' : label
}

// ─── Growth Edit Cell (only editable cell type) ───────────────────────────────

interface GrowthEditCellProps {
  growthPct: number | null
  prevRevenue: number | null
  year: string
  isProjected: boolean
  projectedIndex: number
  onEdit: (year: string, field: string, value: number) => void
}

function GrowthEditCell({ growthPct, prevRevenue, year, isProjected, onEdit }: GrowthEditCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // All projected years show "Model" — the growth rate reflects the blended CAGR
  // (historical + analyst + fundamental), not the raw analyst consensus alone.
  // Actual analyst FY+1/FY+2 estimates are shown in the header chip section.
  const canEdit = isProjected && prevRevenue != null

  const startEdit = () => {
    if (!canEdit) return
    setDraft(growthPct != null ? (growthPct * 100).toFixed(1) : '')
    setEditing(true)
  }

  const commitEdit = () => {
    const parsed = parseFloat(draft.replace(/%/g, '').trim())
    if (!isNaN(parsed) && prevRevenue != null) {
      const newRevenue = prevRevenue * (1 + parsed / 100)
      if (newRevenue > 0) onEdit(year, 'revenue', newRevenue)
    }
    setEditing(false)
  }

  const isPositive = growthPct != null && growthPct > 0
  const isNegative = growthPct != null && growthPct < 0
  const growthColor = isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-500'

  if (editing && canEdit) {
    return (
      <td className="px-2 py-1 text-right whitespace-nowrap bg-blue-900/30 border-b-2 border-blue-400">
        <div className="flex items-center justify-end gap-1">
          <input
            autoFocus
            className="w-16 border-2 border-blue-500 bg-[#0A1628] px-1.5 py-0.5 text-right text-xs text-blue-300 focus:outline-none rounded font-semibold"
            style={{ fontSize: '16px' }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={commitEdit}
          />
          <span className="text-[11px] text-blue-400">%</span>
        </div>
      </td>
    )
  }

  if (!isProjected) {
    return (
      <td className={cn('px-2 py-1.5 text-right text-xs whitespace-nowrap tabular-nums', cellBg({ isProjected, year }), growthColor)}>
        {fmtPctDisplay(growthPct)}
      </td>
    )
  }

  return (
    <td
      className={cn(
        'px-2 py-1.5 text-right text-xs whitespace-nowrap tabular-nums cursor-pointer group',
        canEdit ? 'bg-blue-500/10 border-b-2 border-blue-500/40 hover:bg-blue-500/20' : cellBg({ isProjected, year }),
      )}
      onClick={startEdit}
      onKeyDown={canEdit ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit() } } : undefined}
      tabIndex={canEdit ? 0 : undefined}
      title="Click to edit"
    >
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1 justify-end">
          {canEdit && <span className="text-[11px] text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity">✎</span>}
          <span className={cn('font-semibold', canEdit ? 'text-blue-300' : growthColor)}>
            {fmtPctDisplay(growthPct)}
          </span>
        </div>
        <span className={cn(
          'text-[10px] px-1 py-px rounded font-semibold transition-opacity',
          'bg-blue-500/20 text-blue-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        )}>
          Model
        </span>
      </div>
    </td>
  )
}

// ─── Read-only data cell ──────────────────────────────────────────────────────

function DataCell({ value, row, bold, color }: { value: string; row: DisplayRow; bold?: boolean; color?: string }) {
  return (
    <td className={cn(
      'px-2 py-1.5 text-right text-xs whitespace-nowrap tabular-nums font-mono',
      cellBg(row),
      color ?? cellText(row),
      bold && 'font-semibold',
    )}>
      {value}
    </td>
  )
}

// ─── Section header row ───────────────────────────────────────────────────────

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 bg-white/4 border-b border-white/8">
        {label}
      </td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForecastTable({
  rows,
  waccData,
  terminalData,
  currency,
  onCellEdit,
  onTerminalMethodChange,
  onExitMultipleChange,
  onTerminalGChange,
  currentWacc,
  onWaccChange,
  onModeChange,
  cagrAnalysis,
  blendedImpliedPrice,
  companyType,
}: ForecastTableProps) {
  const [mode, setMode] = useState<'ufcf' | 'lfcf'>('ufcf')
  const [exitMultipleDraft, setExitMultipleDraft] = useState<string | null>(null)
  const [terminalGDraft, setTerminalGDraft] = useState<string | null>(null)

  const curr = currency === 'USD' ? '$' : currency + ' '

  const projectedRows = useMemo(() => rows.filter(r => r.isProjected), [rows])

  // Computed CAGR: geometric mean of projected revenue growth rates
  const computedCagr = useMemo(() => {
    const proj = projectedRows.filter(r => r.revenueGrowthPct != null)
    if (proj.length === 0) return null
    const product = proj.reduce((p, r) => p * (1 + r.revenueGrowthPct!), 1)
    return (Math.pow(product, 1 / proj.length) - 1) * 100
  }, [projectedRows])

  // Implied price for header badge (single-toggle fallback, kept for terminal section detail)
  const { titleImpliedPrice, titleUpside } = useMemo(() => {
    const td = terminalData
    const isLfcf = mode === 'lfcf'
    const tv = td.method === 'multiple'
      ? (isLfcf ? (td.lfcfExitMultipleTVDiscounted ?? null) : td.exitMultipleTVDiscounted)
      : (isLfcf ? (td.lfcfPerpetualTVDiscounted ?? null) : td.perpetuityTVDiscounted)
    const sumPvFlow = isLfcf ? (td.sumPvLfcf ?? 0) : td.sumPvUfcf
    const ev = tv != null ? sumPvFlow + tv : null
    const equity = isLfcf ? ev : (ev != null ? ev + (td.cashM ?? 0) - (td.debtM ?? 0) : null)
    const ip = equity != null && td.sharesM != null && td.sharesM > 0 ? equity / td.sharesM : null
    const up = ip != null && td.currentPrice > 0 ? (ip - td.currentPrice) / td.currentPrice : null
    return { titleImpliedPrice: ip, titleUpside: up }
  }, [terminalData, mode])

  // Breakdown of all four variants for the blend tooltip
  const blendBreakdown = useMemo(() => {
    const td = terminalData
    const cash = td.cashM ?? 0
    const debt = td.debtM ?? 0
    const shares = td.sharesM ?? 0
    if (shares <= 0) return null
    const ufcfPGM = td.perpetuityTVDiscounted != null
      ? (td.sumPvUfcf + td.perpetuityTVDiscounted + cash - debt) / shares : null
    const ufcfEM = td.exitMultipleTVDiscounted != null
      ? (td.sumPvUfcf + td.exitMultipleTVDiscounted + cash - debt) / shares : null
    const lfcfPGM = (td.lfcfPerpetualTVDiscounted ?? null) != null
      ? ((td.sumPvLfcf ?? 0) + td.lfcfPerpetualTVDiscounted!) / shares : null
    const lfcfEM = (td.lfcfExitMultipleTVDiscounted ?? null) != null
      ? ((td.sumPvLfcf ?? 0) + td.lfcfExitMultipleTVDiscounted!) / shares : null
    const cType = ((companyType ?? 'standard') as CompanyType)
    const w = FOUR_MODEL_DCF_WEIGHTS[cType] ?? FOUR_MODEL_DCF_WEIGHTS.standard
    return { ufcfPGM, ufcfEM, lfcfPGM, lfcfEM, w, cType }
  }, [terminalData, companyType])

  // Header badge uses blended value; upside computed from blended or fallback
  const headerPrice = blendedImpliedPrice ?? titleImpliedPrice
  const headerUpside = headerPrice != null && terminalData.currentPrice > 0
    ? (headerPrice - terminalData.currentPrice) / terminalData.currentPrice
    : titleUpside

  // ── Column header element ─────────────────────────────────────────────────────

  function colHeaderEl(row: DisplayRow) {
    const label = colHeader(row)

    return (
      <th key={row.year} className={cn(
        'px-2 py-2.5 text-right text-[11px] font-semibold whitespace-nowrap border-b border-white/10',
        row.year === 'TTM'
          ? 'bg-amber-500/10 text-amber-400'
          : row.isProjected
            ? 'bg-blue-500/8 text-blue-300'
            : 'bg-white/5 text-slate-400'
      )}>
        <div className="flex flex-col items-end gap-0.5">
          <span>{label}</span>
          {row.isProjected && (
            <span className="text-[10px] px-1 rounded font-semibold bg-white/8 text-slate-500">
              Model
            </span>
          )}
        </div>
      </th>
    )
  }

  // ── Revenue growth row (shared between UFCF and LFCF) ────────────────────────

  function revenueRows() {
    return [
      <tr key="revenue" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap w-52 min-w-[200px] border-r border-white/8">
          Revenue <span className="text-[11px] text-slate-500 font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.revenue)} row={r} />)}
      </tr>,
      <tr key="revenue-growth" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-6 pr-4 py-0.5 text-[11px] font-bold text-blue-400 whitespace-nowrap border-r border-white/8">
          Revenue % Growth
          <span className="ml-1.5 inline-flex items-center gap-0.5 bg-blue-500/15 text-blue-400 text-[10px] font-semibold px-1.5 py-px rounded-full">✎ editable</span>
        </td>
        {rows.map((r) => {
          const rIdx = rows.indexOf(r)
          const prevRow = rIdx > 0 ? rows[rIdx - 1] : null
          const projIdx = r.isProjected ? projectedRows.indexOf(r) : -1
          return (
            <GrowthEditCell
              key={r.year}
              growthPct={r.revenueGrowthPct}
              prevRevenue={prevRow?.revenue ?? null}
              year={r.year}
              isProjected={r.isProjected}
              projectedIndex={projIdx}
              onEdit={onCellEdit}
            />
          )
        })}
      </tr>,
    ]
  }

  // ── UFCF rows ─────────────────────────────────────────────────────────────────

  function renderUFCFRows() {
    const n = rows.length + 1
    return [
      <SectionHeader key="hdr-ufcf" label="Unlevered Free Cash Flow" colSpan={n} />,
      ...revenueRows(),

      // EBIT
      <tr key="ebit" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          EBIT <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.ebit)} row={r} />)}
      </tr>,
      <tr key="ebit-margin" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          EBIT Margin
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-slate-500', cellBg(r))}>
            {fmtPctDisplay(r.ebitMarginPct)}
          </td>
        ))}
      </tr>,

      // Tax Rate
      <tr key="taxrate" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          Tax Rate
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-1.5 text-right text-xs tabular-nums font-mono whitespace-nowrap', cellBg(r), cellText(r))}>
            {fmtPctDisplay(r.taxRatePct)}
          </td>
        ))}
      </tr>,

      // NOPAT
      <tr key="nopat" className="hover:bg-white/4 bg-white/5">
        <td className="sticky left-0 z-10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200 whitespace-nowrap border-r border-white/8">
          NOPAT <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.nopat)} row={r} bold />)}
      </tr>,
      <tr key="nopat-margin" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          NOPAT Margin
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-slate-500', cellBg(r))}>
            {fmtPctDisplay(r.nopatMarginPct)}
          </td>
        ))}
      </tr>,

      // D&A
      <tr key="dna" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          D&amp;A <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.dna)} row={r} />)}
      </tr>,
      <tr key="dna-pct" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          D&amp;A / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-slate-500', cellBg(r))}>
            {fmtPctDisplay(r.dnaPct)}
          </td>
        ))}
      </tr>,

      // Capex
      <tr key="capex" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          Capex <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => (
          <DataCell key={r.year} value={fmtVal(r.capex)} row={r}
            color={r.capex != null && r.capex < 0 ? 'text-red-500' : undefined} />
        ))}
      </tr>,
      <tr key="capex-pct" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          Capex / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
            cellBg(r), r.capexPct != null && r.capexPct < 0 ? 'text-red-500' : 'text-slate-500')}>
            {fmtPctDisplay(r.capexPct)}
          </td>
        ))}
      </tr>,

      // Chg NWC
      <tr key="nwcdelta" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          Chg. NWC <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => (
          <DataCell key={r.year} value={fmtVal(r.nwcDelta)} row={r}
            color={r.nwcDelta != null && r.nwcDelta < 0 ? 'text-red-500' : undefined} />
        ))}
      </tr>,
      <tr key="nwcdelta-pct" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          Chg. NWC / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
            cellBg(r), r.nwcDeltaPct != null && r.nwcDeltaPct < 0 ? 'text-red-400' : 'text-slate-500')}>
            {fmtPctDisplay(r.nwcDeltaPct)}
          </td>
        ))}
      </tr>,

      // UFCF highlight
      <tr key="ufcf" className="border-t-2 border-blue-500/30">
        <td className="sticky left-0 z-10 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-slate-100 whitespace-nowrap border-r border-white/10">
          Unlevered FCF (UFCF)
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn(
            'px-2 py-2.5 text-right text-xs font-bold tabular-nums font-mono whitespace-nowrap',
            cellBg(r),
            r.ufcf != null && r.ufcf < 0 ? 'text-red-400' : 'text-slate-100'
          )}>
            {fmtVal(r.ufcf)}
          </td>
        ))}
      </tr>,
      <tr key="ufcf-growth" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          UFCF % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap', cellBg(r),
            r.ufcfGrowthPct != null && r.ufcfGrowthPct > 0 ? 'text-emerald-400'
              : r.ufcfGrowthPct != null && r.ufcfGrowthPct < 0 ? 'text-red-400' : 'text-slate-400')}>
            {fmtPctDisplay(r.ufcfGrowthPct)}
          </td>
        ))}
      </tr>,
      <tr key="pv-ufcf" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-0.5 text-[11px] text-slate-400 whitespace-nowrap border-r border-white/8">
          PV of UFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] text-slate-500 tabular-nums font-mono whitespace-nowrap', r.isProjected ? cellBg(r) : '')}>
            {r.isProjected ? fmtVal(r.pvUfcf) : '—'}
          </td>
        ))}
      </tr>,
    ]
  }

  // ── LFCF rows ─────────────────────────────────────────────────────────────────

  function renderLFCFRows() {
    const n = rows.length + 1
    return [
      <SectionHeader key="hdr-lfcf" label="Levered Free Cash Flow" colSpan={n} />,
      ...revenueRows(),

      // Net Income
      <tr key="netincome" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          Net Income <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.netIncome)} row={r} />)}
      </tr>,
      <tr key="net-margin" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          Net Margin
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-slate-500', cellBg(r))}>
            {fmtPctDisplay(r.netMarginPct)}
          </td>
        ))}
      </tr>,

      // D&A
      <tr key="dna" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          D&amp;A <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.dna)} row={r} />)}
      </tr>,
      <tr key="dna-pct" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          D&amp;A / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-slate-500', cellBg(r))}>
            {fmtPctDisplay(r.dnaPct)}
          </td>
        ))}
      </tr>,

      // Capex
      <tr key="capex" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          Capex <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => (
          <DataCell key={r.year} value={fmtVal(r.capex)} row={r}
            color={r.capex != null && r.capex < 0 ? 'text-red-500' : undefined} />
        ))}
      </tr>,
      <tr key="capex-pct" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          Capex / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
            cellBg(r), r.capexPct != null && r.capexPct < 0 ? 'text-red-500' : 'text-slate-500')}>
            {fmtPctDisplay(r.capexPct)}
          </td>
        ))}
      </tr>,

      // NWC
      <tr key="nwcdelta" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          Chg. NWC <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => (
          <DataCell key={r.year} value={fmtVal(r.nwcDelta)} row={r}
            color={r.nwcDelta != null && r.nwcDelta < 0 ? 'text-red-500' : undefined} />
        ))}
      </tr>,
      <tr key="nwcdelta-pct" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          Chg. NWC / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
            cellBg(r), r.nwcDeltaPct != null && r.nwcDeltaPct < 0 ? 'text-red-500' : 'text-slate-500')}>
            {fmtPctDisplay(r.nwcDeltaPct)}
          </td>
        ))}
      </tr>,

      // Net Debt Repayment
      <tr key="netdebt" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap border-r border-white/8">
          Net Debt Repayment <span className="text-[11px] text-slate-400 font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.netDebtRepayment)} row={r} />)}
      </tr>,
      <tr key="netdebt-pct" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          Net Debt Repayment / Rev
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-slate-500', cellBg(r))}>
            {fmtPctDisplay(r.netDebtRepaymentPct)}
          </td>
        ))}
      </tr>,

      // LFCF highlight
      <tr key="lfcf" className="border-t-2 border-blue-500/30">
        <td className="sticky left-0 z-10 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-slate-100 whitespace-nowrap border-r border-white/10">
          Levered FCF (LFCF)
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn(
            'px-2 py-2.5 text-right text-xs font-bold tabular-nums font-mono whitespace-nowrap',
            cellBg(r),
            r.lfcf != null && r.lfcf < 0 ? 'text-red-400' : 'text-slate-100'
          )}>
            {fmtVal(r.lfcf)}
          </td>
        ))}
      </tr>,
      <tr key="lfcf-growth" className="hover:bg-white/4">
        <td className="sticky left-0 z-10 bg-[#080F1E] pl-8 pr-4 py-0.5 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/8">
          LFCF % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap', cellBg(r),
            r.lfcfGrowthPct != null && r.lfcfGrowthPct > 0 ? 'text-emerald-400'
              : r.lfcfGrowthPct != null && r.lfcfGrowthPct < 0 ? 'text-red-400' : 'text-slate-400')}>
            {fmtPctDisplay(r.lfcfGrowthPct)}
          </td>
        ))}
      </tr>,
      <tr key="pv-lfcf" className="hover:bg-white/4 border-b border-white/8">
        <td className="sticky left-0 z-10 bg-[#080F1E] px-4 py-0.5 text-[11px] text-slate-400 whitespace-nowrap border-r border-white/8">
          PV of LFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] text-slate-500 tabular-nums font-mono whitespace-nowrap', r.isProjected ? cellBg(r) : '')}>
            {r.isProjected ? fmtVal(r.pvLfcf) : '—'}
          </td>
        ))}
      </tr>,
    ]
  }

  // ── WACC Section ──────────────────────────────────────────────────────────────

  function renderWACCSection() {
    const wd = waccData
    const displayWacc = currentWacc ?? wd.wacc * 100

    return (
      <div className="bg-[#080F1E] px-4 sm:px-6 py-5 border-t border-white/10">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-300">Discount Rate (WACC)</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Weighted average cost of capital applied to discount projected free cash flows
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-blue-300 tabular-nums">{displayWacc.toFixed(1)}%</span>
            {onWaccChange && <p className="text-[11px] text-slate-400 mt-0.5">drag slider to adjust</p>}
          </div>
        </div>

        {onWaccChange && (
          <div className="mb-5">
            <input
              type="range"
              min={5}
              max={25}
              step={0.1}
              value={displayWacc}
              onChange={e => onWaccChange(parseFloat(e.target.value))}
              className="w-full h-3 accent-blue-500 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>5%</span>
              <span className="text-blue-400 font-bold">{displayWacc.toFixed(1)}% current</span>
              <span>25%</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Equity side */}
          <div className="rounded-xl bg-white/5 border border-white/8 p-4">
            <p className="text-[11px] font-semibold text-slate-300 mb-3">Equity side</p>
            <div className="space-y-2.5">
              {([
                { label: 'Risk-Free Rate', value: (wd.rfRate * 100).toFixed(2) + '%' },
                {
                  label: wd.crp && wd.crp > 0 ? 'ERP (adj. + CRP)' : 'Equity Risk Premium',
                  value: wd.crp && wd.crp > 0
                    ? `${((wd.erp + wd.crp) * 100).toFixed(1)}%`
                    : (wd.erp * 100).toFixed(0) + '%',
                },
                { label: 'Beta', value: wd.beta.toFixed(2) },
                { label: 'Cost of Equity', value: (wd.costOfEquity * 100).toFixed(1) + '%', bold: true },
                { label: 'Equity Weight', value: wd.equityWeighting != null ? (wd.equityWeighting * 100).toFixed(0) + '%' : null },
              ] as { label: string; value: string | null; bold?: boolean }[]).map(({ label, value, bold }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{label}</span>
                  <span className={cn('text-[11px] tabular-nums font-mono', bold ? 'font-bold text-slate-100' : 'text-slate-300')}>
                    {value ?? <NABadge reason="no-data" />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Debt side */}
          <div className="rounded-xl bg-white/5 border border-white/8 p-4">
            <p className="text-[11px] font-semibold text-slate-300 mb-3">Debt side</p>
            <div className="space-y-2.5">
              {([
                { label: 'Cost of Debt', value: wd.costOfDebt != null ? (wd.costOfDebt * 100).toFixed(2) + '%' : null },
                { label: 'Tax Rate', value: (wd.taxRate * 100).toFixed(1) + '%' },
                { label: 'After-Tax CoD', value: (wd.afterTaxCostOfDebt * 100).toFixed(2) + '%', bold: true },
                { label: 'Total Debt', value: wd.totalDebtM != null ? fmtLargeM(wd.totalDebtM) : null },
                { label: 'Debt Weight', value: wd.debtWeighting != null ? (wd.debtWeighting * 100).toFixed(0) + '%' : null },
              ] as { label: string; value: string | null; bold?: boolean }[]).map(({ label, value, bold }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{label}</span>
                  <span className={cn('text-[11px] tabular-nums font-mono', bold ? 'font-bold text-slate-100' : 'text-slate-300')}>
                    {value ?? <NABadge reason="no-data" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {wd.crp != null && wd.crp > 0 && (
          <p className="text-[11px] text-slate-400 mt-3 italic">
            Country risk premium of {(wd.crp * 100).toFixed(1)}% applied{wd.financialCurrency ? ` for ${wd.financialCurrency} reporting currency` : ''}.
          </p>
        )}
      </div>
    )
  }

  // ── Terminal Section ──────────────────────────────────────────────────────────

  function renderTerminalSection() {
    const td = terminalData
    const isMultiple = td.method === 'multiple'
    const isLfcf = mode === 'lfcf'

    const tv = isMultiple
      ? (isLfcf ? (td.lfcfExitMultipleTV ?? null) : td.exitMultipleTV)
      : (isLfcf ? (td.lfcfPerpetualTV ?? null) : td.perpetuityTV)
    const pvTv = isMultiple
      ? (isLfcf ? (td.lfcfExitMultipleTVDiscounted ?? null) : td.exitMultipleTVDiscounted)
      : (isLfcf ? (td.lfcfPerpetualTVDiscounted ?? null) : td.perpetuityTVDiscounted)
    const activeGuardError = isLfcf ? (td.lfcfGuardError ?? null) : td.guardError
    const sumPvFlow = isLfcf ? (td.sumPvLfcf ?? 0) : td.sumPvUfcf

    const ev = pvTv != null ? sumPvFlow + pvTv : null
    const equityValue = isLfcf
      ? ev
      : (ev != null ? ev + (td.cashM ?? 0) - (td.debtM ?? 0) : null)
    const impliedPrice = equityValue != null && td.sharesM != null && td.sharesM > 0
      ? equityValue / td.sharesM : null
    const impliedUpside = impliedPrice != null && td.currentPrice > 0
      ? (impliedPrice - td.currentPrice) / td.currentPrice : null

    // Composition bar
    const totalPV = pvTv != null ? sumPvFlow + pvTv : null
    const fcfShare = totalPV != null && totalPV > 0 ? (sumPvFlow / totalPV) * 100 : null
    const tvShare = fcfShare != null ? 100 - fcfShare : null
    const tvWarning = tvShare != null && tvShare > 75

    type BridgeRow = { label: string; value: string | null; bold?: boolean; sub?: boolean }
    const bridgeRows: BridgeRow[] = [
      { label: 'Terminal Value', value: tv != null ? fmtLargeM(tv) : null, sub: true },
      { label: 'PV of Terminal Value', value: pvTv != null ? fmtLargeM(pvTv) : null, sub: true },
      { label: isLfcf ? 'Sum of PV of LFCF' : 'Sum of PV of UFCF', value: fmtLargeM(sumPvFlow) },
      ...(!isLfcf ? [
        { label: 'Enterprise Value', value: ev != null ? fmtLargeM(ev) : null, bold: true },
        { label: '+ Cash', value: td.cashM != null ? fmtLargeM(td.cashM) : null, sub: true },
        { label: '− Debt', value: td.debtM != null ? fmtLargeM(td.debtM) : null, sub: true },
      ] as BridgeRow[] : []),
      { label: isLfcf ? 'Equity Value (LFCF)' : 'Equity Value', value: equityValue != null ? fmtLargeM(equityValue) : null, bold: true },
      { label: 'Shares Outstanding', value: td.sharesM != null ? td.sharesM.toFixed(1) + 'M' : null, sub: true },
    ]

    return (
      <div className="bg-[#080F1E] px-4 sm:px-6 py-5 border-t border-white/10">
        {/* Method toggle */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-[11px] font-semibold text-slate-300">Terminal value</p>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(['perpetuity', 'multiple'] as const).map(m => (
              <button
                key={m}
                onClick={() => onTerminalMethodChange(m)}
                className={cn(
                  'px-4 py-2 text-[12px] font-semibold transition-colors min-h-[44px]',
                  td.method === m ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
                )}
              >
                {m === 'perpetuity' ? 'Perpetuity Growth' : 'Exit Multiple'}
              </button>
            ))}
          </div>
        </div>

        {activeGuardError && td.method === 'perpetuity' && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <span className="font-bold">!</span>
            <span>{activeGuardError}</span>
          </div>
        )}

        {/* Method input */}
        <div className="mb-5">
          {isMultiple ? (
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/8 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-200">Exit Multiple (EV / FCF)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Applied to final-year FCF to compute terminal enterprise value</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onExitMultipleChange(Math.round(Math.max(1, td.exitMultiple - 1) * 10) / 10)}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 font-bold text-sm flex items-center justify-center min-h-[44px] min-w-[44px]"
                >−</button>
                <input
                  className="w-16 border border-white/10 bg-[#0A1628] px-2 py-2 text-center text-[14px] font-bold text-slate-100 rounded-lg focus:border-blue-400 focus:outline-none min-h-[44px]"
                  style={{ fontSize: '16px' }}
                  value={exitMultipleDraft ?? Math.max(1, td.exitMultiple).toFixed(1)}
                  onChange={e => setExitMultipleDraft(e.target.value)}
                  onBlur={() => {
                    if (exitMultipleDraft != null) {
                      const p = parseFloat(exitMultipleDraft)
                      if (!isNaN(p) && p > 0) onExitMultipleChange(p)
                      setExitMultipleDraft(null)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && exitMultipleDraft != null) {
                      const p = parseFloat(exitMultipleDraft)
                      if (!isNaN(p) && p > 0) onExitMultipleChange(p)
                      setExitMultipleDraft(null)
                    }
                  }}
                />
                <span className="text-[12px] text-slate-400">×</span>
                <button
                  onClick={() => onExitMultipleChange(Math.round((td.exitMultiple + 1) * 10) / 10)}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 font-bold text-sm flex items-center justify-center min-h-[44px] min-w-[44px]"
                >+</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/8 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-200">Terminal Growth Rate</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Long-run FCF growth rate beyond projection period (typically 2–3%)</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onTerminalGChange(Math.round(Math.max(0, td.terminalG - 0.005) * 1000) / 1000)}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 font-bold text-sm flex items-center justify-center min-h-[44px] min-w-[44px]"
                >−</button>
                <input
                  className="w-16 border border-white/10 bg-[#0A1628] px-2 py-2 text-center text-[14px] font-bold text-slate-100 rounded-lg focus:border-blue-400 focus:outline-none min-h-[44px]"
                  style={{ fontSize: '16px' }}
                  value={terminalGDraft ?? (td.terminalG * 100).toFixed(1)}
                  onChange={e => setTerminalGDraft(e.target.value)}
                  onBlur={() => {
                    if (terminalGDraft != null) {
                      const p = parseFloat(terminalGDraft)
                      if (!isNaN(p) && p >= 0 && p < 15) onTerminalGChange(p / 100)
                      setTerminalGDraft(null)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && terminalGDraft != null) {
                      const p = parseFloat(terminalGDraft)
                      if (!isNaN(p) && p >= 0 && p < 15) onTerminalGChange(p / 100)
                      setTerminalGDraft(null)
                    }
                  }}
                />
                <span className="text-[12px] text-slate-400">%</span>
                <button
                  onClick={() => onTerminalGChange(Math.round(Math.min(0.14, td.terminalG + 0.005) * 1000) / 1000)}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 font-bold text-sm flex items-center justify-center min-h-[44px] min-w-[44px]"
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* Composition bar */}
        {fcfShare != null && tvShare != null && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-slate-300">Valuation Composition</p>
              {tvWarning && (
                <span className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  TV {tvShare.toFixed(0)}% — high terminal reliance
                </span>
              )}
            </div>
            <div className="h-3 flex rounded-full overflow-hidden">
              <div
                className="bg-blue-800 transition-all duration-500"
                style={{ width: `${Math.max(2, fcfShare)}%` }}
                title={`PV of FCFs: ${fcfShare.toFixed(1)}%`}
              />
              <div
                className={cn('flex-1 transition-all duration-500', tvWarning ? 'bg-amber-400' : 'bg-blue-300')}
                title={`PV of Terminal Value: ${tvShare.toFixed(1)}%`}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-blue-800 inline-block" />
                <span>PV of FCFs ({fcfShare.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-sm inline-block', tvWarning ? 'bg-amber-400' : 'bg-blue-300')} />
                <span>PV of Terminal Value ({tvShare.toFixed(0)}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Equity bridge */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-2 bg-white/5 border-b border-white/8">
            <p className="text-[11px] font-semibold text-slate-300">Equity value bridge</p>
          </div>
          <div className="divide-y divide-white/8">
            {bridgeRows.map(({ label, value, bold, sub }) => (
              <div key={label} className={cn('flex items-center justify-between px-4 py-2', bold && 'bg-white/5')}>
                <span className={cn('text-xs', sub ? 'text-slate-400 pl-3' : bold ? 'font-semibold text-slate-200' : 'text-slate-400')}>
                  {label}
                </span>
                <span className={cn('text-xs tabular-nums font-mono', bold ? 'font-bold text-slate-100' : 'text-slate-300')}>
                  {value ?? <NABadge reason="calc-error" />}
                </span>
              </div>
            ))}

            {/* Implied price hero */}
            <div className="flex items-center justify-between px-4 py-4 border-t-2 border-white/10">
              <div>
                <p className="text-sm font-bold text-slate-100">Implied Share Price</p>
                <p className="text-[11px] text-slate-400 mt-0.5">vs. {curr}{td.currentPrice.toFixed(2)} current price</p>
              </div>
              <div className="text-right">
                <p className={cn('text-2xl font-extrabold tabular-nums',
                  impliedUpside != null && impliedUpside >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {impliedPrice != null ? `${curr}${impliedPrice.toFixed(2)}` : <NABadge reason="calc-error" />}
                </p>
                {impliedUpside != null && (
                  <p className={cn('text-sm font-semibold mt-0.5',
                    impliedUpside >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {impliedUpside >= 0 ? '+' : ''}{(impliedUpside * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#080F1E] rounded-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/10 bg-white/5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-bold text-slate-100">Full DCF Model</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {mode === 'ufcf' ? 'Unlevered Free Cash Flow · discounted at WACC' : 'Levered Free Cash Flow · discounted at Cost of Equity'}
            </p>
          </div>

          {/* Computed CAGR badge */}
          {computedCagr != null && (
            <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-lg px-3 py-1.5">
              <span className="text-[11px] text-slate-400 font-semibold">Avg CAGR</span>
              <span className="text-[13px] font-bold text-blue-300 tabular-nums">{computedCagr.toFixed(1)}%</span>
              <span className="text-[11px] text-slate-400">(geom.)</span>
            </div>
          )}

          {/* Analyst context chips */}
          {cagrAnalysis?.analystEstimate1y != null && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">Analyst est:</span>
              <span className="font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  FY+1 {(cagrAnalysis.analystEstimate1y * 100).toFixed(1)}%
                </span>
              {cagrAnalysis.analystEstimate2y != null && (
                <span className="font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  FY+2 {(cagrAnalysis.analystEstimate2y * 100).toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Implied price badge — shows 4-model blended value with breakdown tooltip */}
          {headerPrice != null && (
            <div className="relative group">
              <div tabIndex={0} className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 cursor-help min-h-[44px]">
                <span className="text-[11px] text-slate-400 font-semibold">
                  {blendedImpliedPrice != null ? 'Implied · 4-model' : 'Implied'}
                </span>
                <span className={cn('text-[13px] font-bold tabular-nums',
                  headerUpside != null && headerUpside >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {curr}{headerPrice.toFixed(2)}
                </span>
                {headerUpside != null && (
                  <span className={cn('text-[11px] font-semibold', headerUpside >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {headerUpside >= 0 ? '+' : ''}{(headerUpside * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {/* Breakdown tooltip on hover */}
              {blendBreakdown != null && blendedImpliedPrice != null && (
                <div className="absolute top-full left-0 mt-1.5 z-50 hidden group-hover:block group-focus-within:block bg-[#0d1929] border border-white/10 rounded-xl p-3.5 shadow-2xl" style={{ minWidth: 280 }}>
                  <p className="text-[11px] font-semibold text-slate-400 mb-2">
                    4-model blend · {blendBreakdown.cType} profile
                  </p>
                  {([
                    { label: 'UFCF + Perpetuity (PGM)', val: blendBreakdown.ufcfPGM, w: blendBreakdown.w.ufcfPGM },
                    { label: 'UFCF + Exit Multiple',    val: blendBreakdown.ufcfEM,  w: blendBreakdown.w.ufcfEM  },
                    { label: 'LFCF + Perpetuity (PGM)', val: blendBreakdown.lfcfPGM, w: blendBreakdown.w.lfcfPGM },
                    { label: 'LFCF + Exit Multiple',    val: blendBreakdown.lfcfEM,  w: blendBreakdown.w.lfcfEM  },
                  ] as const).map(({ label, val, w }) => (
                    <div key={label} className="flex items-center justify-between gap-6 py-0.5">
                      <span className="text-[11px] text-slate-400">
                        <span className="text-slate-300 font-semibold tabular-nums">{Math.round(w * 100)}%</span>
                        {' × '}{label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-200 tabular-nums shrink-0">
                        {val != null ? `${curr}${val.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-white/10 mt-2 pt-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">= Blended implied</span>
                    <span className={cn('text-[11px] font-bold tabular-nums',
                      headerUpside != null && headerUpside >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {curr}{blendedImpliedPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Unlevered / Levered toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['ufcf', 'lfcf'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); onModeChange?.(m === 'lfcf') }}
                className={cn(
                  'px-3 py-2 text-[12px] font-semibold transition-colors min-h-[44px]',
                  mode === m ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 bg-transparent'
                )}
              >
                {m === 'ufcf' ? 'Unlevered' : 'Levered'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Edit hint bar */}
      <div className="px-4 sm:px-5 py-2.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
        <p className="text-[12px] text-blue-300">
          Click any <span className="font-bold">Revenue % Growth</span> cell in a projected column to adjust that year&apos;s growth assumption.
          All other values are computed automatically.
        </p>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#080F1E] px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 w-52 min-w-[200px] border-r border-white/10 border-b border-white/10">
                {curr}M
              </th>
              {rows.map(r => colHeaderEl(r))}
            </tr>
          </thead>
          <tbody>
            {mode === 'ufcf' ? renderUFCFRows() : renderLFCFRows()}
          </tbody>
        </table>
      </div>

      {renderWACCSection()}
      {renderTerminalSection()}
    </div>
  )
}
