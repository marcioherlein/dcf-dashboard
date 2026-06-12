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
  const formatted = abs >= 1
    ? abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : abs.toFixed(2)
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
  return row.year === 'TTM' ? 'bg-[#FFFBEB]' : 'bg-white'
}

function cellText(row: { isProjected: boolean; year: string }): string {
  if (row.year === 'TTM') return 'text-[#92400E]'
  if (row.isProjected) return 'text-[#566174]'
  return 'text-[#06101F]'
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
  const [editError, setEditError] = useState(false)

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
      if (newRevenue > 0) {
        onEdit(year, 'revenue', newRevenue)
        setEditing(false)
        return
      }
    }
    setEditError(true)
    setTimeout(() => { setEditError(false); setEditing(false) }, 900)
  }

  const isPositive = growthPct != null && growthPct > 0
  const isNegative = growthPct != null && growthPct < 0
  const growthColor = isPositive ? 'text-[#15803D]' : isNegative ? 'text-[#D83B3B]' : 'text-[#566174]'

  if (editing && canEdit) {
    return (
      <td className={cn("px-2 py-1 text-right whitespace-nowrap border-b-2", editError ? "bg-red-50 border-red-400" : "bg-blue-50 border-blue-400")}>
        <div className="flex items-center justify-end gap-1">
          <input
            autoFocus
            className="w-16 border-2 border-blue-500 bg-white px-1.5 py-0.5 text-right text-xs text-[#1D4ED8] focus:outline-none rounded font-semibold"
            style={{ fontSize: '16px' }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={commitEdit}
          />
          <span className="text-[11px] text-[#2563EB]">%</span>
        </div>
      </td>
    )
  }

  if (!isProjected) {
    return (
      <td className={cn('px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums', cellBg({ isProjected, year }), growthColor)}>
        {fmtPctDisplay(growthPct)}
      </td>
    )
  }

  return (
    <td
      className={cn(
        'px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums cursor-pointer group',
        canEdit ? 'bg-blue-50/60 border-b-2 border-blue-300 hover:bg-blue-100/60' : cellBg({ isProjected, year }),
      )}
      onClick={startEdit}
      onKeyDown={canEdit ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit() } } : undefined}
      tabIndex={canEdit ? 0 : undefined}
      role={canEdit ? 'button' : undefined}
      aria-label={canEdit ? `Edit revenue growth for ${year}` : undefined}
      title="Click to edit"
    >
      <div className="flex items-center gap-1 justify-end">
        {canEdit && <span className="text-[10px] text-[#2563EB] opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden="true">✎</span>}
        <span className={cn('font-semibold', canEdit ? 'text-[#1D4ED8]' : growthColor)}>
          {fmtPctDisplay(growthPct)}
        </span>
      </div>
    </td>
  )
}

// ─── Read-only data cell ──────────────────────────────────────────────────────

function DataCell({ value, row, bold, color }: { value: string; row: DisplayRow; bold?: boolean; color?: string }) {
  return (
    <td className={cn(
      'px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums font-mono',
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
      <td colSpan={colSpan} className="px-4 pt-3 pb-1 text-[10px] font-[700] uppercase tracking-widest text-[#9B9B9B] bg-white border-b border-[#E3E1DA]">
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
  const [viewMode, setViewMode] = useState<'$M' | 'pct'>('$M')
  const [exitMultipleDraft, setExitMultipleDraft] = useState<string | null>(null)
  const [terminalGDraft, setTerminalGDraft] = useState<string | null>(null)
  const [blendOpen, setBlendOpen] = useState(false)
  const [tgError, setTgError] = useState(false)
  const [waccExpanded, setWaccExpanded] = useState(false)
  const [terminalExpanded, setTerminalExpanded] = useState(false)

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
        'px-2 py-2.5 text-right text-[11px] font-semibold whitespace-nowrap border-b border-[#E3E1DA]',
        row.year === 'TTM'
          ? 'bg-[#FEF9C3] text-[#92400E]'
          : row.isProjected
            ? 'bg-[#EAF1FF] text-[#1D4ED8]'
            : 'bg-[#F4F3EF] text-[#566174]'
      )}>
        <div className="flex flex-col items-end gap-0.5">
          <span>{label}</span>
          {row.isProjected && (
            <span className="text-[10px] px-1 rounded font-semibold bg-blue-100 text-[#1D4ED8]">
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
      <tr key="revenue" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap w-36 min-w-[144px] sm:w-52 sm:min-w-[200px] border-r border-[#E3E1DA]">
          Revenue <span className="text-[11px] text-[#566174] font-normal">$M</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={fmtVal(r.revenue)} row={r} />)}
      </tr>,
      <tr key="revenue-growth" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-6 pr-4 py-0.5 text-[11px] font-bold text-[#2563EB] whitespace-nowrap border-r border-[#E3E1DA]">
          Revenue Growth <span aria-hidden="true" className="text-[10px] text-[#2563EB]">✎</span>
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
    const isPct = viewMode === 'pct'
    return [
      <SectionHeader key="hdr-ufcf" label="Unlevered Free Cash Flow" colSpan={n} />,
      ...revenueRows(),

      // EBIT
      <tr key="ebit" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          EBIT <span className="text-[11px] text-[#9B9B9B] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={isPct ? fmtPctDisplay(r.ebitMarginPct) : fmtVal(r.ebit)} row={r} />)}
      </tr>,
      !isPct && (
        <tr key="ebit-margin" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            EBIT Margin
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-[#566174]', cellBg(r))}>
              {fmtPctDisplay(r.ebitMarginPct)}
            </td>
          ))}
        </tr>
      ),
      isPct && <tr key="ebit-spacer" className="border-b border-[#E3E1DA]"><td colSpan={n} className="py-0" /></tr>,

      // Tax Rate
      <tr key="taxrate" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          {(() => {
            const representativeRate = rows.find(r => r.taxRatePct != null)?.taxRatePct
            return representativeRate != null ? `Tax (${fmtPctDisplay(representativeRate)})` : 'Tax Rate'
          })()}
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-1.5 text-right text-xs tabular-nums font-mono whitespace-nowrap', cellBg(r), cellText(r))}>
            {fmtPctDisplay(r.taxRatePct)}
          </td>
        ))}
      </tr>,

      // NOPAT
      <tr key="nopat" className="group hover:bg-[#F4F3EF] bg-[#FAFAF8] border-t-2 border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-[#FAFAF8] px-4 py-1.5 text-xs font-bold text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          NOPAT <span className="text-[11px] text-[#566174] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={isPct ? fmtPctDisplay(r.nopatMarginPct) : fmtVal(r.nopat)} row={r} bold />)}
      </tr>,
      !isPct && (
        <tr key="nopat-margin" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            NOPAT Margin
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-[#566174]', cellBg(r))}>
              {fmtPctDisplay(r.nopatMarginPct)}
            </td>
          ))}
        </tr>
      ),
      isPct && <tr key="nopat-spacer" className="border-b border-[#E3E1DA]"><td colSpan={n} className="py-0" /></tr>,

      // D&A
      <tr key="dna" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          D&amp;A <span className="text-[11px] text-[#06101F] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={isPct ? fmtPctDisplay(r.dnaPct) : fmtVal(r.dna)} row={r} />)}
      </tr>,
      !isPct && (
        <tr key="dna-pct" className="group hover:bg-[#F4F3EF]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            D&amp;A / Revenue
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-[#566174]', cellBg(r))}>
              {fmtPctDisplay(r.dnaPct)}
            </td>
          ))}
        </tr>
      ),

      // Capex
      <tr key="capex" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Capex <span className="text-[11px] text-[#06101F] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => (
          isPct
            ? <DataCell key={r.year} value={fmtPctDisplay(r.capexPct)} row={r}
                color={r.capexPct != null && r.capexPct < 0 ? 'text-[#D83B3B]' : undefined} />
            : <DataCell key={r.year} value={fmtVal(r.capex)} row={r}
                color={r.capex != null && r.capex < 0 ? 'text-[#D83B3B]' : undefined} />
        ))}
      </tr>,
      !isPct && (
        <tr key="capex-pct" className="group hover:bg-[#F4F3EF]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            Capex / Revenue
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
              cellBg(r), r.capexPct != null && r.capexPct < 0 ? 'text-[#D83B3B]' : 'text-[#566174]')}>
              {fmtPctDisplay(r.capexPct)}
            </td>
          ))}
        </tr>
      ),

      // Chg NWC
      <tr key="nwcdelta" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          △ NWC <span className="text-[11px] text-[#9B9B9B] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => (
          isPct
            ? <DataCell key={r.year} value={fmtPctDisplay(r.nwcDeltaPct)} row={r}
                color={r.nwcDeltaPct != null && r.nwcDeltaPct < 0 ? 'text-[#D83B3B]' : undefined} />
            : <DataCell key={r.year} value={fmtVal(r.nwcDelta)} row={r}
                color={r.nwcDelta != null && r.nwcDelta < 0 ? 'text-[#D83B3B]' : undefined} />
        ))}
      </tr>,
      !isPct && (
        <tr key="nwcdelta-pct" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            △ NWC / Revenue
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
              cellBg(r), r.nwcDeltaPct != null && r.nwcDeltaPct < 0 ? 'text-[#D83B3B]' : 'text-[#566174]')}>
              {fmtPctDisplay(r.nwcDeltaPct)}
            </td>
          ))}
        </tr>
      ),
      isPct && <tr key="nwc-spacer" className="border-b border-[#E3E1DA]"><td colSpan={n} className="py-0" /></tr>,

      // UFCF highlight
      <tr key="ufcf" className="border-t-2 border-[#5F790B]/30 bg-[#FAFAF8]">
        <td className="sticky left-0 z-10 bg-[#FAFAF8] px-4 py-2 text-xs font-bold text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Unlevered FCF (UFCF)
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn(
            'px-2 py-2 text-right text-xs font-bold tabular-nums font-mono whitespace-nowrap',
            'bg-[#FAFAF8]',
            r.ufcf != null && r.ufcf < 0 ? 'text-[#D83B3B]' : 'text-[#5F790B]'
          )}>
            {fmtVal(r.ufcf)}
          </td>
        ))}
      </tr>,
      <tr key="ufcf-growth" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
          UFCF % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap', cellBg(r),
            r.ufcfGrowthPct != null && r.ufcfGrowthPct > 0 ? 'text-[#15803D]'
              : r.ufcfGrowthPct != null && r.ufcfGrowthPct < 0 ? 'text-[#D83B3B]' : 'text-[#06101F]')}>
            {fmtPctDisplay(r.ufcfGrowthPct)}
          </td>
        ))}
      </tr>,
      <tr key="pv-ufcf" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-0.5 text-[11px] text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          PV of UFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] text-[#566174] tabular-nums font-mono whitespace-nowrap', r.isProjected ? cellBg(r) : '')}>
            {r.isProjected ? fmtVal(r.pvUfcf) : '—'}
          </td>
        ))}
      </tr>,

      // Discount Factor
      <tr key="discount-factor" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-0.5 text-[11px] text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Discount Factor ({((currentWacc ?? waccData.wacc * 100)).toFixed(1)}%)
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] text-[#566174] tabular-nums font-mono whitespace-nowrap', r.isProjected ? cellBg(r) : '')}>
            {r.isProjected && r.pvUfcf != null && r.ufcf != null && r.ufcf !== 0
              ? (r.pvUfcf / r.ufcf).toFixed(4)
              : '—'}
          </td>
        ))}
      </tr>,

      // Discount Factor
      <tr key="discount-factor-ufcf" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-0.5 text-[11px] text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Discount Factor ({((currentWacc ?? waccData.wacc * 100)).toFixed(1)}%)
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] text-[#566174] tabular-nums font-mono whitespace-nowrap', r.isProjected ? cellBg(r) : '')}>
            {r.isProjected && r.pvUfcf != null && r.ufcf != null && r.ufcf !== 0
              ? (r.pvUfcf / r.ufcf).toFixed(4)
              : '—'}
          </td>
        ))}
      </tr>,
    ]
  }

  // ── LFCF rows ─────────────────────────────────────────────────────────────────

  function renderLFCFRows() {
    const n = rows.length + 1
    const isPct = viewMode === 'pct'
    return [
      <SectionHeader key="hdr-lfcf" label="Levered Free Cash Flow" colSpan={n} />,
      ...revenueRows(),

      // Net Income
      <tr key="netincome" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Net Income <span className="text-[11px] text-[#06101F] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={isPct ? fmtPctDisplay(r.netMarginPct) : fmtVal(r.netIncome)} row={r} />)}
      </tr>,
      !isPct && (
        <tr key="net-margin" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            Net Margin
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-[#566174]', cellBg(r))}>
              {fmtPctDisplay(r.netMarginPct)}
            </td>
          ))}
        </tr>
      ),
      isPct && <tr key="netincome-spacer" className="border-b border-[#E3E1DA]"><td colSpan={n} className="py-0" /></tr>,

      // D&A
      <tr key="dna" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          D&amp;A <span className="text-[11px] text-[#06101F] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={isPct ? fmtPctDisplay(r.dnaPct) : fmtVal(r.dna)} row={r} />)}
      </tr>,
      !isPct && (
        <tr key="dna-pct" className="group hover:bg-[#F4F3EF]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            D&amp;A / Revenue
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-[#566174]', cellBg(r))}>
              {fmtPctDisplay(r.dnaPct)}
            </td>
          ))}
        </tr>
      ),

      // Capex
      <tr key="capex" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Capex <span className="text-[11px] text-[#06101F] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => (
          isPct
            ? <DataCell key={r.year} value={fmtPctDisplay(r.capexPct)} row={r}
                color={r.capexPct != null && r.capexPct < 0 ? 'text-[#D83B3B]' : undefined} />
            : <DataCell key={r.year} value={fmtVal(r.capex)} row={r}
                color={r.capex != null && r.capex < 0 ? 'text-[#D83B3B]' : undefined} />
        ))}
      </tr>,
      !isPct && (
        <tr key="capex-pct" className="group hover:bg-[#F4F3EF]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            Capex / Revenue
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
              cellBg(r), r.capexPct != null && r.capexPct < 0 ? 'text-[#D83B3B]' : 'text-[#566174]')}>
              {fmtPctDisplay(r.capexPct)}
            </td>
          ))}
        </tr>
      ),

      // NWC
      <tr key="nwcdelta" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          △ NWC <span className="text-[11px] text-[#9B9B9B] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => (
          isPct
            ? <DataCell key={r.year} value={fmtPctDisplay(r.nwcDeltaPct)} row={r}
                color={r.nwcDeltaPct != null && r.nwcDeltaPct < 0 ? 'text-[#D83B3B]' : undefined} />
            : <DataCell key={r.year} value={fmtVal(r.nwcDelta)} row={r}
                color={r.nwcDelta != null && r.nwcDelta < 0 ? 'text-[#D83B3B]' : undefined} />
        ))}
      </tr>,
      !isPct && (
        <tr key="nwcdelta-pct" className="group hover:bg-[#F4F3EF]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            △ NWC / Revenue
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap',
              cellBg(r), r.nwcDeltaPct != null && r.nwcDeltaPct < 0 ? 'text-[#D83B3B]' : 'text-[#566174]')}>
              {fmtPctDisplay(r.nwcDeltaPct)}
            </td>
          ))}
        </tr>
      ),

      // Net Debt Repayment
      <tr key="netdebt" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-1.5 text-xs font-medium text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Net Debt Repayment <span className="text-[11px] text-[#06101F] font-normal">{isPct ? '% Rev' : '$M'}</span>
        </td>
        {rows.map(r => <DataCell key={r.year} value={isPct ? fmtPctDisplay(r.netDebtRepaymentPct) : fmtVal(r.netDebtRepayment)} row={r} />)}
      </tr>,
      !isPct && (
        <tr key="netdebt-pct" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
            Net Debt Repayment / Rev
          </td>
          {rows.map(r => (
            <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap text-[#566174]', cellBg(r))}>
              {fmtPctDisplay(r.netDebtRepaymentPct)}
            </td>
          ))}
        </tr>
      ),
      isPct && <tr key="netdebt-spacer" className="border-b border-[#E3E1DA]"><td colSpan={n} className="py-0" /></tr>,

      // LFCF highlight
      <tr key="lfcf" className="border-t-2 border-[#5F790B]/30 bg-[#FAFAF8]">
        <td className="sticky left-0 z-10 bg-[#FAFAF8] px-4 py-2 text-xs font-bold text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Levered FCF (LFCF)
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn(
            'px-2 py-2 text-right text-xs font-bold tabular-nums font-mono whitespace-nowrap bg-[#FAFAF8]',
            r.lfcf != null && r.lfcf < 0 ? 'text-[#D83B3B]' : 'text-[#5F790B]'
          )}>
            {fmtVal(r.lfcf)}
          </td>
        ))}
      </tr>,
      <tr key="lfcf-growth" className="group hover:bg-[#F4F3EF]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] pl-8 pr-4 py-0.5 text-[11px] text-[#566174] whitespace-nowrap border-r border-[#E3E1DA]">
          LFCF % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap', cellBg(r),
            r.lfcfGrowthPct != null && r.lfcfGrowthPct > 0 ? 'text-[#15803D]'
              : r.lfcfGrowthPct != null && r.lfcfGrowthPct < 0 ? 'text-[#D83B3B]' : 'text-[#06101F]')}>
            {fmtPctDisplay(r.lfcfGrowthPct)}
          </td>
        ))}
      </tr>,
      <tr key="pv-lfcf" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-0.5 text-[11px] text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          PV of LFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] text-[#566174] tabular-nums font-mono whitespace-nowrap', r.isProjected ? cellBg(r) : '')}>
            {r.isProjected ? fmtVal(r.pvLfcf) : '—'}
          </td>
        ))}
      </tr>,

      // Discount Factor
      <tr key="discount-factor-lfcf" className="group hover:bg-[#F4F3EF] border-b border-[#E3E1DA]">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F4F3EF] px-4 py-0.5 text-[11px] text-[#06101F] whitespace-nowrap border-r border-[#E3E1DA]">
          Discount Factor ({((currentWacc ?? waccData.wacc * 100)).toFixed(1)}%)
        </td>
        {rows.map(r => (
          <td key={r.year} className={cn('px-2 py-0.5 text-right text-[11px] text-[#566174] tabular-nums font-mono whitespace-nowrap', r.isProjected ? cellBg(r) : '')}>
            {r.isProjected && r.pvLfcf != null && r.lfcf != null && r.lfcf !== 0
              ? (r.pvLfcf / r.lfcf).toFixed(4)
              : '—'}
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
      <div className="bg-white border-t border-[#E3E1DA]">
        {/* Compact header row — always visible */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] font-[700] text-[#06101F]">
              {wd.wacc != null ? 'WACC' : 'Discount Rate'}
            </span>
            <span className="text-[15px] font-[750] tabular-nums text-[#2563EB]">{displayWacc.toFixed(1)}%</span>
            <span className="text-[10px] text-[#9B9B9B]">
              Ke {(wd.costOfEquity * 100).toFixed(1)}%
              {wd.debtWeighting != null && wd.debtWeighting > 0 && (
                <> · Kd {(wd.afterTaxCostOfDebt * 100).toFixed(1)}% at {(wd.debtWeighting * 100).toFixed(0)}%</>
              )}
            </span>
          </div>

          {onWaccChange && (
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="range"
                min={5}
                max={25}
                step={0.1}
                value={displayWacc}
                onChange={e => onWaccChange(parseFloat(e.target.value))}
                className="w-24 sm:w-32 h-2 accent-blue-600 rounded-lg cursor-pointer"
                aria-label="WACC slider"
              />
            </div>
          )}

          <button
            data-no-min-h
            onClick={() => setWaccExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] text-[#566174] hover:text-[#06101F] transition-colors shrink-0"
            aria-expanded={waccExpanded}
            aria-controls="wacc-breakdown"
          >
            <span>{waccExpanded ? 'Hide' : 'Breakdown'}</span>
            <svg className={cn('w-3 h-3 transition-transform', waccExpanded ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* Expandable equity/debt breakdown */}
        {waccExpanded && (
          <div id="wacc-breakdown" className="px-4 sm:px-5 pb-4 border-t border-[#F0EEE8]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {/* Equity side */}
              <div className="rounded-lg border border-[#E3E1DA] p-3">
                <p className="text-[11px] font-[650] text-[#06101F] mb-2">Equity side</p>
                <div className="space-y-1.5">
                  {([
                    { label: 'Risk-Free Rate', value: (wd.rfRate * 100).toFixed(2) + '%' },
                    {
                      label: wd.crp && wd.crp > 0 ? 'ERP + CRP' : 'ERP',
                      value: wd.crp && wd.crp > 0
                        ? ((wd.erp + wd.crp) * 100).toFixed(1) + '%'
                        : (wd.erp * 100).toFixed(0) + '%',
                    },
                    { label: 'Beta', value: wd.beta.toFixed(2) },
                    { label: 'Cost of Equity', value: (wd.costOfEquity * 100).toFixed(1) + '%', bold: true },
                    { label: 'Equity Weight', value: wd.equityWeighting != null ? (wd.equityWeighting * 100).toFixed(0) + '%' : null },
                  ] as { label: string; value: string | null; bold?: boolean }[]).map(({ label, value, bold }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-[#566174]">{label}</span>
                      <span className={cn('text-[11px] tabular-nums font-mono', bold ? 'font-bold text-[#06101F]' : 'text-[#566174]')}>
                        {value ?? <NABadge reason="no-data" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Debt side */}
              <div className="rounded-lg border border-[#E3E1DA] p-3">
                <p className="text-[11px] font-[650] text-[#06101F] mb-2">Debt side</p>
                <div className="space-y-1.5">
                  {([
                    { label: 'Cost of Debt', value: wd.costOfDebt != null ? (wd.costOfDebt * 100).toFixed(2) + '%' : null },
                    { label: 'Tax Rate', value: (wd.taxRate * 100).toFixed(1) + '%' },
                    { label: 'After-Tax CoD', value: (wd.afterTaxCostOfDebt * 100).toFixed(2) + '%', bold: true },
                    { label: 'Total Debt', value: wd.totalDebtM != null ? fmtLargeM(wd.totalDebtM) : null },
                    { label: 'Debt Weight', value: wd.debtWeighting != null ? (wd.debtWeighting * 100).toFixed(0) + '%' : null },
                  ] as { label: string; value: string | null; bold?: boolean }[]).map(({ label, value, bold }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-[#566174]">{label}</span>
                      <span className={cn('text-[11px] tabular-nums font-mono', bold ? 'font-bold text-[#06101F]' : 'text-[#566174]')}>
                        {value ?? <NABadge reason="no-data" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {wd.crp != null && wd.crp > 0 && (
              <p className="text-[11px] text-[#566174] mt-2 italic">
                Country risk premium of {(wd.crp * 100).toFixed(1)}% applied{wd.financialCurrency ? ` for ${wd.financialCurrency} reporting` : ''}.
              </p>
            )}
          </div>
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
      <div className="bg-white border-t border-[#E3E1DA]">
        {/* Compact always-visible summary row */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 flex-wrap">
          <span className="text-[11px] font-[700] text-[#06101F] shrink-0">Terminal Value</span>

          {/* Method toggle — always visible and compact */}
          <div className="flex rounded-lg overflow-hidden border border-[#E3E1DA] shrink-0" role="radiogroup" aria-label="Terminal value method">
            {(['multiple', 'perpetuity'] as const).map(m => (
              <button
                key={m}
                data-no-min-h
                onClick={() => onTerminalMethodChange(m)}
                role="radio"
                aria-checked={td.method === m}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-[650] transition-colors',
                  td.method === m ? 'bg-[#2563EB] text-white' : 'text-[#566174] bg-white hover:bg-[#F4F3EF]',
                )}
              >
                {m === 'multiple' ? 'Exit ×' : 'Perp. g'}
              </button>
            ))}
          </div>

          {/* Inline input for active method */}
          {isMultiple ? (
            <div className="flex items-center gap-1 shrink-0">
              <button data-no-min-h onClick={() => onExitMultipleChange(Math.round(Math.max(1, td.exitMultiple - 1) * 10) / 10)} className="w-5 h-5 rounded bg-white border border-[#E3E1DA] text-[#566174] hover:bg-[#E3E1DA] text-xs font-bold flex items-center justify-center">−</button>
              <input
                className="w-12 border border-[#E3E1DA] bg-[#F4F3EF] px-1.5 py-0.5 text-center text-[12px] font-[700] text-[#06101F] rounded focus:border-[#2563EB] focus:outline-none"
                style={{ fontSize: '16px' }}
                value={exitMultipleDraft ?? Math.max(1, td.exitMultiple).toFixed(1)}
                onChange={e => setExitMultipleDraft(e.target.value)}
                onBlur={() => { if (exitMultipleDraft != null) { const p = parseFloat(exitMultipleDraft); if (!isNaN(p) && p > 0) onExitMultipleChange(p); setExitMultipleDraft(null) } }}
                onKeyDown={e => { if (e.key === 'Enter' && exitMultipleDraft != null) { const p = parseFloat(exitMultipleDraft); if (!isNaN(p) && p > 0) onExitMultipleChange(p); setExitMultipleDraft(null) } }}
                aria-label="Exit multiple"
              />
              <span className="text-[11px] text-[#9B9B9B]">×</span>
              <button data-no-min-h onClick={() => onExitMultipleChange(Math.round((td.exitMultiple + 1) * 10) / 10)} className="w-5 h-5 rounded bg-white border border-[#E3E1DA] text-[#566174] hover:bg-[#E3E1DA] text-xs font-bold flex items-center justify-center">+</button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button data-no-min-h onClick={() => onTerminalGChange(Math.round(Math.max(0, td.terminalG - 0.005) * 1000) / 1000)} className="w-5 h-5 rounded bg-white border border-[#E3E1DA] text-[#566174] hover:bg-[#E3E1DA] text-xs font-bold flex items-center justify-center">−</button>
              <input
                className={cn("w-12 border bg-[#F4F3EF] px-1.5 py-0.5 text-center text-[12px] font-[700] text-[#06101F] rounded focus:border-[#2563EB] focus:outline-none", tgError ? 'border-red-400' : 'border-[#E3E1DA]')}
                style={{ fontSize: '16px' }}
                value={terminalGDraft ?? (td.terminalG * 100).toFixed(1)}
                onChange={e => setTerminalGDraft(e.target.value)}
                onBlur={() => { if (terminalGDraft != null) { const p = parseFloat(terminalGDraft); if (!isNaN(p) && p >= 0 && p < 15) { onTerminalGChange(p / 100) } else { setTgError(true); setTimeout(() => setTgError(false), 800) }; setTerminalGDraft(null) } }}
                onKeyDown={e => { if (e.key === 'Enter' && terminalGDraft != null) { const p = parseFloat(terminalGDraft); if (!isNaN(p) && p >= 0 && p < 15) onTerminalGChange(p / 100); setTerminalGDraft(null) } }}
                aria-label="Terminal growth rate %"
              />
              <span className="text-[11px] text-[#9B9B9B]">%</span>
              <button data-no-min-h onClick={() => onTerminalGChange(Math.round(Math.min(0.14, td.terminalG + 0.005) * 1000) / 1000)} className="w-5 h-5 rounded bg-white border border-[#E3E1DA] text-[#566174] hover:bg-[#E3E1DA] text-xs font-bold flex items-center justify-center">+</button>
            </div>
          )}

          {/* Quick TV summary */}
          {pvTv != null && (
            <span className="text-[11px] text-[#9B9B9B]">
              PV of TV: <span className="font-[650] text-[#566174]">{fmtLargeM(pvTv)}</span>
              {tvShare != null && (
                <span className={cn('ml-1', tvWarning ? 'text-amber-600 font-[650]' : '')}>
                  ({tvShare.toFixed(0)}% of EV{tvWarning ? ' ⚠' : ''})
                </span>
              )}
            </span>
          )}

          {/* Implied price — compact */}
          {impliedPrice != null && (
            <span className={cn('ml-auto text-[12px] font-[750] tabular-nums shrink-0', impliedUpside != null && impliedUpside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
              {curr}{impliedPrice.toFixed(2)}
              {impliedUpside != null && <span className="text-[10px] ml-1">({impliedUpside >= 0 ? '+' : ''}{(impliedUpside * 100).toFixed(1)}%)</span>}
            </span>
          )}

          <button
            data-no-min-h
            onClick={() => setTerminalExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] text-[#566174] hover:text-[#06101F] transition-colors shrink-0"
            aria-expanded={terminalExpanded}
            aria-controls="terminal-breakdown"
          >
            <span>{terminalExpanded ? 'Hide' : 'Bridge'}</span>
            <svg className={cn('w-3 h-3 transition-transform', terminalExpanded ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* Expandable: guard error, composition bar, equity bridge */}
        {terminalExpanded && (
          <div id="terminal-breakdown" className="px-4 sm:px-5 pb-5 border-t border-[#F0EEE8]">

            {activeGuardError && td.method === 'perpetuity' && (
              <div role="alert" className="mt-3 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-[#FCEAEA] px-3 py-2 text-xs text-[#D83B3B]">
                <span className="font-bold shrink-0">!</span>
                <span>{activeGuardError}</span>
              </div>
            )}

            {/* Composition bar */}
            {fcfShare != null && tvShare != null && (
              <div className="mt-3 mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-[650] text-[#06101F]">Valuation Composition</p>
                  {tvWarning && (
                    <span className="text-[10px] text-amber-600 font-[650] bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      TV {tvShare.toFixed(0)}% — high terminal reliance
                    </span>
                  )}
                </div>
                <div className="h-2 flex rounded-full overflow-hidden">
                  <div className="bg-[#2563EB] transition-all duration-500" style={{ width: `${Math.max(2, fcfShare)}%` }} title={`PV of FCFs: ${fcfShare.toFixed(1)}%`} />
                  <div className={cn('flex-1 transition-all duration-500', tvWarning ? 'bg-amber-500' : 'bg-[#93B4F5]')} title={`PV of Terminal Value: ${tvShare.toFixed(1)}%`} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#566174]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#2563EB] inline-block" /> PV FCFs ({fcfShare.toFixed(0)}%)</span>
                  <span className="flex items-center gap-1"><span className={cn('w-2 h-2 rounded-sm inline-block', tvWarning ? 'bg-amber-500' : 'bg-[#93B4F5]')} /> PV TV ({tvShare.toFixed(0)}%)</span>
                </div>
              </div>
            )}

            {/* Equity bridge */}
            <div className="rounded-xl border border-[#E3E1DA] overflow-hidden">
              <div className="px-4 py-2 bg-[#FAFAF8] border-b border-[#E3E1DA]">
                <p className="text-[11px] font-[650] text-[#06101F]">Equity value bridge</p>
              </div>
              <div className="divide-y divide-[#F0EEE8]">
                {bridgeRows.map(({ label, value, bold, sub }) => (
                  <div key={label} className={cn('flex items-center justify-between px-4 py-1.5', bold && 'bg-[#FAFAF8]')}>
                    <span className={cn('text-[11px]', sub ? 'text-[#566174] pl-3' : bold ? 'font-[650] text-[#06101F]' : 'text-[#06101F]')}>{label}</span>
                    <span className={cn('text-[11px] tabular-nums font-mono', bold ? 'font-bold text-[#06101F]' : 'text-[#566174]')}>
                      {value ?? <NABadge reason="calc-error" />}
                    </span>
                  </div>
                ))}
                {/* Implied price */}
                <div className="flex items-center justify-between px-4 py-3 border-t-2 border-[#E3E1DA]">
                  <div>
                    <p className="text-[13px] font-[700] text-[#06101F]">Implied Share Price</p>
                    <p className="text-[11px] text-[#566174] mt-0.5">vs. {curr}{td.currentPrice.toFixed(2)} current</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-[22px] font-[800] tabular-nums', impliedUpside != null && impliedUpside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                      {impliedPrice != null ? `${curr}${impliedPrice.toFixed(2)}` : <NABadge reason="calc-error" />}
                    </p>
                    {impliedUpside != null && (
                      <p className={cn('text-[13px] font-[650] mt-0.5', impliedUpside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                        {impliedUpside >= 0 ? '+' : ''}{(impliedUpside * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm flex flex-col items-center justify-center py-16 gap-3">
        <svg className="w-8 h-8 text-[#CDD1C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18" />
        </svg>
        <p className="text-[13px] font-semibold text-[#566174]">No forecast data available</p>
        <p className="text-[11px] text-[#9B9B9B]">Financial statements are required to build the DCF model.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#E3E1DA] bg-[#FAFAF8] flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-[#06101F]">
                DCF Engine
              </h3>
            </div>
          </div>

          {/* Computed CAGR badge */}
          {computedCagr != null && (
            <div className="flex items-center gap-1.5 bg-white border border-[#E3E1DA] rounded-lg px-3 py-1.5">
              <span className="text-[11px] text-[#566174] font-semibold">Avg CAGR</span>
              <span className="text-[13px] font-bold text-[#2563EB] tabular-nums">{computedCagr.toFixed(1)}%</span>
              <span className="text-[11px] text-[#9B9B9B]">(geom.)</span>
            </div>
          )}

          {/* Analyst context chips */}
          {cagrAnalysis?.analystEstimate1y != null && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[#566174]">Analyst est:</span>
              <span className="font-semibold text-[#92400E] bg-[#FEF9C3] border border-amber-200 px-1.5 py-0.5 rounded">
                  FY+1 {(cagrAnalysis.analystEstimate1y * 100).toFixed(1)}%
                </span>
              {cagrAnalysis.analystEstimate2y != null && (
                <span className="font-semibold text-[#92400E] bg-[#FEF9C3] border border-amber-200 px-1.5 py-0.5 rounded">
                  FY+2 {(cagrAnalysis.analystEstimate2y * 100).toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Implied price badge — shows 4-model blended value with breakdown tooltip */}
          {headerPrice != null && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBlendOpen(v => !v)}
                className="flex items-center gap-2 bg-white border border-[#E3E1DA] rounded-lg px-3 py-1.5 cursor-help min-h-[44px]"
              >
                <span className="text-[11px] text-[#566174] font-semibold">
                  {blendedImpliedPrice != null ? 'Implied · 4-model' : 'Implied'}
                </span>
                <span className={cn('text-[13px] font-bold tabular-nums',
                  headerUpside != null && headerUpside >= 0 ? 'text-[#15803D]' : 'text-[#D83B3B]'
                )}>
                  {curr}{headerPrice.toFixed(2)}
                </span>
                {headerUpside != null && (
                  <span className={cn('text-[11px] font-semibold', headerUpside >= 0 ? 'text-[#15803D]' : 'text-[#D83B3B]')}>
                    {headerUpside >= 0 ? '+' : ''}{(headerUpside * 100).toFixed(1)}%
                  </span>
                )}
              </button>
              {/* Breakdown tooltip on tap/click */}
              {blendBreakdown != null && blendedImpliedPrice != null && (
                <div className={cn("absolute top-full left-0 mt-1.5 z-50 bg-white border border-[#E3E1DA] rounded-xl p-3.5 shadow-2xl", blendOpen ? "block" : "hidden")} style={{ minWidth: 280 }}>
                  <p className="text-[11px] font-semibold text-[#06101F] mb-2">
                    4-model blend · {blendBreakdown.cType} profile
                  </p>
                  {([
                    { label: 'UFCF + Perpetuity (PGM)', val: blendBreakdown.ufcfPGM, w: blendBreakdown.w.ufcfPGM },
                    { label: 'UFCF + Exit Multiple',    val: blendBreakdown.ufcfEM,  w: blendBreakdown.w.ufcfEM  },
                    { label: 'LFCF + Perpetuity (PGM)', val: blendBreakdown.lfcfPGM, w: blendBreakdown.w.lfcfPGM },
                    { label: 'LFCF + Exit Multiple',    val: blendBreakdown.lfcfEM,  w: blendBreakdown.w.lfcfEM  },
                  ] as const).map(({ label, val, w }) => (
                    <div key={label} className="flex items-center justify-between gap-6 py-0.5">
                      <span className="text-[11px] text-[#06101F]">
                        <span className="text-[#06101F] font-semibold tabular-nums">{Math.round(w * 100)}%</span>
                        {' × '}{label}
                      </span>
                      <span className="text-[11px] font-semibold text-[#566174] tabular-nums shrink-0">
                        {val != null ? `${curr}${val.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[#E3E1DA] mt-2 pt-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#06101F]">= Blended implied</span>
                    <span className={cn('text-[11px] font-bold tabular-nums',
                      headerUpside != null && headerUpside >= 0 ? 'text-[#15803D]' : 'text-[#D83B3B]'
                    )}>
                      {curr}{blendedImpliedPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* % of Sales toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[#E3E1DA]">
            {(['$M', 'pct'] as const).map(vm => (
              <button
                key={vm}
                onClick={() => setViewMode(vm)}
                aria-pressed={viewMode === vm}
                aria-label={vm === '$M' ? 'Show dollar values' : 'Show % of sales'}
                className={cn(
                  'px-3 py-2 text-[12px] font-semibold transition-colors min-h-[44px]',
                  viewMode === vm ? 'bg-[#566174] text-white' : 'text-[#566174] hover:bg-[#F4F3EF] bg-transparent'
                )}
              >
                {vm === '$M' ? '$M' : '% Sales'}
              </button>
            ))}
          </div>

          {/* Unlevered / Levered toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[#E3E1DA]">
            {(['ufcf', 'lfcf'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); onModeChange?.(m === 'lfcf') }}
                aria-pressed={mode === m}
                aria-label={m === 'ufcf' ? 'Unlevered Free Cash Flow mode' : 'Levered Free Cash Flow mode'}
                className={cn(
                  'px-3 py-2 text-[12px] font-semibold transition-colors min-h-[44px]',
                  mode === m ? 'bg-[#5F790B] text-white' : 'text-[#566174] hover:bg-[#F4F3EF] bg-transparent'
                )}
              >
                {m === 'ufcf' ? 'Unlevered' : 'Levered'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Edit hint bar */}
      <div className="px-4 sm:px-5 py-2 bg-[#EAF1FF] border-b border-blue-100 flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] flex-shrink-0 mt-1" />
        <p className="text-[11px] text-[#1D4ED8] flex-1 min-w-0">
          Click any <span className="font-bold">Revenue % Growth</span> cell in a projected year to edit that assumption.
        </p>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto" role="region" aria-label="DCF projection table" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full min-w-max border-collapse">
          <thead className="sticky top-0 z-20">
            {/* Row 1: Column group labels */}
            <tr className="border-b border-[#E3E1DA]">
              <th className="sticky left-0 z-30 bg-[#FAFAF8] px-4 py-1.5 text-left text-[10px] font-[700] uppercase tracking-widest text-[#9B9B9B] w-36 min-w-[144px] sm:w-52 sm:min-w-[200px] border-r border-[#E3E1DA]">
                {curr}M
              </th>
              {(() => {
                const historical = rows.filter(r => !r.isProjected)
                const projected  = rows.filter(r => r.isProjected)
                return [
                  historical.length > 0 && (
                    <th key="grp-hist" colSpan={historical.length}
                      className="px-1 sm:px-2 py-1 sm:py-1.5 text-center text-[9px] sm:text-[10px] font-[700] uppercase tracking-widest text-[#9B9B9B] bg-[#F4F3EF] border-r border-[#E3E1DA] whitespace-nowrap">
                      Hist.
                    </th>
                  ),
                  projected.length > 0 && (
                    <th key="grp-fcast" colSpan={projected.length}
                      className="px-1 sm:px-2 py-1 sm:py-1.5 text-center text-[9px] sm:text-[10px] font-[700] uppercase tracking-widest text-[#1D4ED8] bg-[#EAF1FF] border-r border-[#E3E1DA] whitespace-nowrap">
                      Forecast
                    </th>
                  ),
                ]
              })()}
            </tr>
            {/* Row 2: Individual year labels */}
            <tr>
              <th className="sticky left-0 z-30 bg-[#FAFAF8] px-4 py-2 text-left text-[11px] font-semibold text-[#566174] w-36 min-w-[144px] sm:w-52 sm:min-w-[200px] border-r border-[#E3E1DA] border-b border-[#E3E1DA]">
                &nbsp;
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
