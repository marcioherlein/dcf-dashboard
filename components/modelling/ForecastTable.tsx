'use client'

import { useState } from 'react'
import React from 'react'
import { NABadge, type NAReasonId } from '@/components/ui/na-badge'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisplayRow {
  fiscalDate: string
  year: string
  isProjected: boolean
  // UFCF-path values (all $M unless noted)
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
  // LFCF-path additional
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
  // UFCF equity value bridge (all $M)
  sumPvUfcf: number
  cashM: number | null
  debtM: number | null
  sharesM: number | null
  currentPrice: number
  // LFCF terminal values (optional — populated when LFCF rows have non-null lfcf)
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
  preset: 'conservative' | 'base' | 'optimistic'
  onPresetChange: (p: 'conservative' | 'base' | 'optimistic') => void
  onCellEdit: (year: string, field: string, value: number) => void
  onTerminalMethodChange: (method: 'perpetuity' | 'multiple') => void
  onExitMultipleChange: (value: number) => void
  onTerminalGChange: (value: number) => void
  currentCagr?: number
  onCagrChange?: (value: number) => void
  currentWacc?: number
  onWaccChange?: (value: number) => void
}

// ─── Column cell background by type ──────────────────────────────────────────

function cellBg(row: DisplayRow): string {
  if (row.year === 'TTM') return 'bg-[#18140a]'
  if (row.isProjected) return 'bg-[#0b1628]'
  return ''
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

// ─── Editable Cell ────────────────────────────────────────────────────────────

interface EditableCellProps {
  value: string
  rawValue: number | null
  isProjected: boolean
  isEditable: boolean
  fieldName: string
  year: string
  onEdit?: (year: string, field: string, value: number) => void
  isTaxRate?: boolean
  className?: string
}

function EditableCell({
  value, rawValue, isProjected, isEditable, fieldName, year,
  onEdit, isTaxRate, className = '',
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const canEdit = isEditable && isProjected

  const startEdit = () => {
    if (!canEdit) return
    // For tax rate, show as percentage number (e.g. "19")
    if (isTaxRate && rawValue != null) {
      setDraft(String((rawValue * 100).toFixed(1)))
    } else if (rawValue != null) {
      setDraft(String(rawValue.toFixed(1)))
    } else {
      setDraft('')
    }
    setEditing(true)
  }

  const commitEdit = () => {
    const cleaned = draft.replace(/[$,BM%()]/g, '').trim()
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed) && onEdit) {
      // Tax rate: user types "19" → save as 0.19
      const saveValue = isTaxRate ? parsed / 100 : parsed
      onEdit(year, fieldName, saveValue)
    }
    setEditing(false)
  }

  if (editing && canEdit) {
    return (
      <td className={`px-2 py-1 text-right whitespace-nowrap ${className}`}>
        <input
          autoFocus
          className="w-20 border border-[#4a9eff] bg-[#0d1825] px-1 py-0 text-right text-xs text-[#4a9eff] focus:outline-none rounded"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={commitEdit}
        />
      </td>
    )
  }

  return (
    <td
      className={`px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums font-mono ${
        canEdit ? 'cursor-pointer hover:bg-[#1e2d42]' : ''
      } ${className}`}
      onClick={startEdit}
    >
      {value}
    </td>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForecastTable({
  rows,
  waccData,
  terminalData,
  currency,
  preset,
  onPresetChange,
  onCellEdit,
  onTerminalMethodChange,
  onExitMultipleChange,
  onTerminalGChange,
  currentCagr,
  onCagrChange,
  currentWacc,
  onWaccChange,
}: ForecastTableProps) {
  const [mode, setMode] = useState<'ufcf' | 'lfcf'>('ufcf')
  const [exitMultipleDraft, setExitMultipleDraft] = useState<string | null>(null)
  const [terminalGDraft, setTerminalGDraft] = useState<string | null>(null)
  const [cagrDraft, setCagrDraft] = useState<string | null>(null)
  const [waccDraft, setWaccDraft] = useState<string | null>(null)

  const curr = currency === 'USD' ? '$' : currency + ' '

  // Build compact column header label: "2024", "2025E", "TTM"
  function colHeader(row: DisplayRow): string {
    if (row.year === 'TTM') return 'TTM'
    const label = row.fiscalDate?.slice(0, 4) ?? row.year
    return row.isProjected ? label + 'E' : label
  }

  // Color helpers
  const growthColor = (v: number | null) => {
    if (v == null) return 'text-[#888]'
    return v > 0 ? 'text-[#4ade80]' : v < 0 ? 'text-[#f87171]' : 'text-[#888]'
  }

  const negativeColor = (v: number | null) => {
    if (v == null) return ''
    return v < 0 ? 'text-[#f87171]' : ''
  }

  // ── Render a section row for UFCF ──
  function renderUFCFRows() {
    const sections: React.ReactNode[] = []

    // Section header
    sections.push(
      <tr key="section-ufcf">
        <td
          colSpan={rows.length + 1}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#555] bg-[#0a0a0a] border-b border-[#1e1e1e]"
        >
          Unlevered Free Cash Flow
        </td>
      </tr>
    )

    // Revenue row + sub-row
    sections.push(
      <tr key="revenue" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap w-52 min-w-[200px]">
          Revenue
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.revenue)}
            rawValue={r.revenue}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="revenue"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>,
      <tr key="revenue-growth" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Revenue % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${growthColor(r.revenueGrowthPct)}`}>
            {fmtPctDisplay(r.revenueGrowthPct)}
          </td>
        ))}
      </tr>
    )

    // EBIT row + margin sub-row
    sections.push(
      <tr key="ebit" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          EBIT
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.ebit)}
            rawValue={r.ebit}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="ebit"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>,
      <tr key="ebit-margin" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          EBIT Margin
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#888] tabular-nums font-mono whitespace-nowrap ${cellBg(r)}`}>
            {fmtPctDisplay(r.ebitMarginPct)}
          </td>
        ))}
      </tr>
    )

    // Tax Rate row
    sections.push(
      <tr key="taxrate" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          Tax Rate
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtPctDisplay(r.taxRatePct)}
            rawValue={r.taxRatePct}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="taxRate"
            year={r.year}
            onEdit={onCellEdit}
            isTaxRate={true}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>
    )

    // NOPAT row + margin sub-row
    sections.push(
      <tr key="nopat" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs font-semibold text-[#e2e2e2] whitespace-nowrap">
          NOPAT
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-1.5 text-right text-xs font-semibold tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}>
            {fmtVal(r.nopat)}
          </td>
        ))}
      </tr>,
      <tr key="nopat-margin" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          NOPAT Margin
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#888] tabular-nums font-mono whitespace-nowrap ${cellBg(r)}`}>
            {fmtPctDisplay(r.nopatMarginPct)}
          </td>
        ))}
      </tr>
    )

    // D&A row + sub-row
    sections.push(
      <tr key="dna" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          D&amp;A
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.dna)}
            rawValue={r.dna}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="dna"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>,
      <tr key="dna-pct" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          D&amp;A / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#888] tabular-nums font-mono whitespace-nowrap ${cellBg(r)}`}>
            {fmtPctDisplay(r.dnaPct)}
          </td>
        ))}
      </tr>
    )

    // CapEx row + sub-row
    sections.push(
      <tr key="capex" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          Capex
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.capex)}
            rawValue={r.capex}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="capex"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'} ${negativeColor(r.capex)}`}
          />
        ))}
      </tr>,
      <tr key="capex-pct" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Capex / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${negativeColor(r.capexPct) || 'text-[#888]'}`}>
            {fmtPctDisplay(r.capexPct)}
          </td>
        ))}
      </tr>
    )

    // Chg. NWC row + sub-row
    sections.push(
      <tr key="nwcdelta" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          Chg. NWC
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.nwcDelta)}
            rawValue={r.nwcDelta}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="nwc"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'} ${negativeColor(r.nwcDelta)}`}
          />
        ))}
      </tr>,
      <tr key="nwcdelta-pct" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Chg. NWC / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${negativeColor(r.nwcDeltaPct) || 'text-[#888]'}`}>
            {fmtPctDisplay(r.nwcDeltaPct)}
          </td>
        ))}
      </tr>
    )

    // Separator
    sections.push(
      <tr key="sep-ufcf">
        <td colSpan={rows.length + 1} className="border-t-2 border-[#333] py-0" />
      </tr>
    )

    // UFCF row (bold)
    sections.push(
      <tr key="ufcf" className="bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap">
          Unlevered FCF (UFCF)
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-2 text-right text-xs font-semibold tabular-nums font-mono whitespace-nowrap ${cellBg(r)} text-white`}>
            {fmtVal(r.ufcf)}
          </td>
        ))}
      </tr>,
      <tr key="ufcf-growth" className="bg-[#1a1a1a] hover:bg-[#222]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          UFCF % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${growthColor(r.ufcfGrowthPct)}`}>
            {fmtPctDisplay(r.ufcfGrowthPct)}
          </td>
        ))}
      </tr>,
      <tr key="pv-ufcf" className="bg-[#1a1a1a] hover:bg-[#222]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] px-4 py-0.5 text-[11px] text-[#aaa] whitespace-nowrap">
          PV of UFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#aaa] tabular-nums font-mono whitespace-nowrap ${r.isProjected ? cellBg(r) : ''}`}>
            {r.isProjected ? fmtVal(r.pvUfcf) : '—'}
          </td>
        ))}
      </tr>,
      <tr key="sum-pv-ufcf" className="bg-[#1a1a1a] hover:bg-[#222]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] px-4 py-0.5 text-[11px] text-[#aaa] whitespace-nowrap">
          Sum of PV of UFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#aaa] tabular-nums font-mono whitespace-nowrap ${r.isProjected ? cellBg(r) : ''}`}>
            {r.sumPvUfcf != null ? fmtVal(r.sumPvUfcf) : '—'}
          </td>
        ))}
      </tr>
    )

    return sections
  }

  // ── Render a section row for LFCF ──
  function renderLFCFRows() {
    const sections: React.ReactNode[] = []

    // Section header
    sections.push(
      <tr key="section-lfcf">
        <td
          colSpan={rows.length + 1}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#555] bg-[#0a0a0a] border-b border-[#1e1e1e]"
        >
          Levered Free Cash Flow
        </td>
      </tr>
    )

    // Revenue
    sections.push(
      <tr key="revenue" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap w-52 min-w-[200px]">
          Revenue
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.revenue)}
            rawValue={r.revenue}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="revenue"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>,
      <tr key="revenue-growth" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Revenue % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${growthColor(r.revenueGrowthPct)}`}>
            {fmtPctDisplay(r.revenueGrowthPct)}
          </td>
        ))}
      </tr>
    )

    // Net Income + margin
    sections.push(
      <tr key="netincome" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          Net Income
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.netIncome)}
            rawValue={r.netIncome}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="netIncome"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>,
      <tr key="net-margin" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Net Margin
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#888] tabular-nums font-mono whitespace-nowrap ${cellBg(r)}`}>
            {fmtPctDisplay(r.netMarginPct)}
          </td>
        ))}
      </tr>
    )

    // D&A + sub
    sections.push(
      <tr key="dna" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          D&amp;A
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.dna)}
            rawValue={r.dna}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="dna"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>,
      <tr key="dna-pct" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          D&amp;A / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#888] tabular-nums font-mono whitespace-nowrap ${cellBg(r)}`}>
            {fmtPctDisplay(r.dnaPct)}
          </td>
        ))}
      </tr>
    )

    // Capex + sub
    sections.push(
      <tr key="capex" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          Capex
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.capex)}
            rawValue={r.capex}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="capex"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'} ${negativeColor(r.capex)}`}
          />
        ))}
      </tr>,
      <tr key="capex-pct" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Capex / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${negativeColor(r.capexPct) || 'text-[#888]'}`}>
            {fmtPctDisplay(r.capexPct)}
          </td>
        ))}
      </tr>
    )

    // NWC + sub
    sections.push(
      <tr key="nwcdelta" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          Chg. NWC
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.nwcDelta)}
            rawValue={r.nwcDelta}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="nwc"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'} ${negativeColor(r.nwcDelta)}`}
          />
        ))}
      </tr>,
      <tr key="nwcdelta-pct" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Chg. NWC / Revenue
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${negativeColor(r.nwcDeltaPct) || 'text-[#888]'}`}>
            {fmtPctDisplay(r.nwcDeltaPct)}
          </td>
        ))}
      </tr>
    )

    // Net Debt Repayment + sub
    sections.push(
      <tr key="netdebt" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] px-4 py-1.5 text-xs text-[#e2e2e2] whitespace-nowrap">
          Net Debt Repayment
        </td>
        {rows.map(r => (
          <EditableCell
            key={r.year}
            value={fmtVal(r.netDebtRepayment)}
            rawValue={r.netDebtRepayment}
            isProjected={r.isProjected}
            isEditable={true}
            fieldName="netDebtRepayment"
            year={r.year}
            onEdit={onCellEdit}
            className={`${cellBg(r)} ${r.isProjected ? 'text-[#e2e2e2]' : r.year === 'TTM' ? 'text-[#d4a017]' : 'text-[#c8c8c8]'}`}
          />
        ))}
      </tr>,
      <tr key="netdebt-pct" className="hover:bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#111111] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          Net Debt Repayment / Rev
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#888] tabular-nums font-mono whitespace-nowrap ${cellBg(r)}`}>
            {fmtPctDisplay(r.netDebtRepaymentPct)}
          </td>
        ))}
      </tr>
    )

    // Separator
    sections.push(
      <tr key="sep-lfcf">
        <td colSpan={rows.length + 1} className="border-t-2 border-[#333] py-0" />
      </tr>
    )

    // LFCF (bold)
    sections.push(
      <tr key="lfcf" className="bg-[#1a1a1a]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap">
          Levered FCF (LFCF)
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-2 text-right text-xs font-semibold tabular-nums font-mono whitespace-nowrap ${cellBg(r)} text-white`}>
            {fmtVal(r.lfcf)}
          </td>
        ))}
      </tr>,
      <tr key="lfcf-growth" className="bg-[#1a1a1a] hover:bg-[#222]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] pl-6 pr-4 py-0.5 text-[11px] italic text-[#666] whitespace-nowrap">
          LFCF % Chg
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] tabular-nums font-mono whitespace-nowrap ${cellBg(r)} ${growthColor(r.lfcfGrowthPct)}`}>
            {fmtPctDisplay(r.lfcfGrowthPct)}
          </td>
        ))}
      </tr>,
      <tr key="pv-lfcf" className="bg-[#1a1a1a] hover:bg-[#222]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] px-4 py-0.5 text-[11px] text-[#aaa] whitespace-nowrap">
          PV of LFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#aaa] tabular-nums font-mono whitespace-nowrap ${r.isProjected ? cellBg(r) : ''}`}>
            {r.isProjected ? fmtVal(r.pvLfcf) : '—'}
          </td>
        ))}
      </tr>,
      <tr key="sum-pv-lfcf" className="bg-[#1a1a1a] hover:bg-[#222]">
        <td className="sticky left-0 z-10 bg-[#1a1a1a] px-4 py-0.5 text-[11px] text-[#aaa] whitespace-nowrap">
          Sum of PV of LFCF
        </td>
        {rows.map(r => (
          <td key={r.year} className={`px-2 py-0.5 text-right text-[11px] text-[#aaa] tabular-nums font-mono whitespace-nowrap ${r.isProjected ? cellBg(r) : ''}`}>
            {r.sumPvLfcf != null ? fmtVal(r.sumPvLfcf) : '—'}
          </td>
        ))}
      </tr>
    )

    return sections
  }

  // ── WACC Section ──────────────────────────────────────────────────────────────
  function renderWACCSection() {
    const wd = waccData
    const totalCapital =
      wd.totalDebtM != null && wd.marketCapM != null
        ? wd.totalDebtM + wd.marketCapM
        : null

    const rows2col: { label: string; value: string | null; naReason?: NAReasonId }[] = [
      { label: 'Cost of Debt',        value: wd.costOfDebt != null ? (wd.costOfDebt * 100).toFixed(2) + '%' : null, naReason: 'no-data' },
      { label: 'Tax Rate',            value: (wd.taxRate * 100).toFixed(2) + '%' },
      { label: 'After Tax Cost Debt', value: (wd.afterTaxCostOfDebt * 100).toFixed(1) + '%' },
      { label: 'Risk Free Rate',      value: (wd.rfRate * 100).toFixed(2) + '%' },
      {
        label: wd.crp && wd.crp > 0
          ? `Equity Risk Premium (adj${wd.financialCurrency ? ` · ${wd.financialCurrency}` : ''})`
          : 'Market Risk Premium',
        value: wd.crp && wd.crp > 0
          ? `${((wd.erp + wd.crp) * 100).toFixed(1)}% (base ${(wd.erp * 100).toFixed(1)}% + CRP ${(wd.crp * 100).toFixed(1)}%)`
          : (wd.erp * 100).toFixed(0) + '%',
      },
      { label: 'Beta',                value: wd.beta.toFixed(2) },
      { label: 'Cost of Equity',      value: (wd.costOfEquity * 100).toFixed(0) + '%' },
      { label: 'Total Debt',          value: wd.totalDebtM != null ? fmtLargeM(wd.totalDebtM) : null,          naReason: 'no-data' },
      { label: 'Market Cap',          value: wd.marketCapM != null ? fmtLargeM(wd.marketCapM) : null,          naReason: 'no-data' },
      { label: 'Total Capital',       value: totalCapital != null ? fmtLargeM(totalCapital) : null,             naReason: 'calc-error' },
      { label: 'Debt Weighting',      value: wd.debtWeighting != null ? (wd.debtWeighting * 100).toFixed(0) + '%' : null,   naReason: 'calc-error' },
      { label: 'Equity Weighting',    value: wd.equityWeighting != null ? (wd.equityWeighting * 100).toFixed(0) + '%' : null, naReason: 'calc-error' },
    ]

    return (
      <div className="bg-[#0d0d0d] px-6 py-4 border-t border-[#222]">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#555] mb-3">WACC</p>
        <div className="grid grid-cols-[1fr_auto] gap-y-1 max-w-xs">
          {rows2col.map(({ label, value, naReason }) => (
            <React.Fragment key={label}>
              <span className="text-[#666] text-[12px]">{label}</span>
              <span className="text-[#e2e2e2] text-[12px] text-right">
                {value != null ? value : <NABadge reason={naReason ?? 'no-data'} />}
              </span>
            </React.Fragment>
          ))}
          <span className="text-[#e2e2e2] text-[13px] font-semibold mt-1">WACC</span>
          <span className="text-[#4a9eff] text-[13px] font-semibold text-right mt-1">
            {(wd.wacc * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    )
  }

  // ── Terminal Value Section ────────────────────────────────────────────────────
  function renderTerminalSection() {
    const td = terminalData
    const isMultiple = td.method === 'multiple'
    const isLfcf = mode === 'lfcf'

    const tv = isMultiple
      ? (isLfcf ? (td.lfcfExitMultipleTV ?? null)         : td.exitMultipleTV)
      : (isLfcf ? (td.lfcfPerpetualTV ?? null)             : td.perpetuityTV)
    const pvTv = isMultiple
      ? (isLfcf ? (td.lfcfExitMultipleTVDiscounted ?? null) : td.exitMultipleTVDiscounted)
      : (isLfcf ? (td.lfcfPerpetualTVDiscounted ?? null)    : td.perpetuityTVDiscounted)
    const activeGuardError = isLfcf ? (td.lfcfGuardError ?? null) : td.guardError
    const sumPvFlow = isLfcf ? (td.sumPvLfcf ?? 0) : td.sumPvUfcf

    // Equity value bridge
    // UFCF: EV = sumPvUFCF + pvTV → equity = EV + cash − debt
    // LFCF: equity = sumPvLFCF + pvTV directly (already levered)
    const ev           = pvTv != null ? sumPvFlow + pvTv : null
    const equityValue  = isLfcf
      ? ev
      : (ev != null ? ev + (td.cashM ?? 0) - (td.debtM ?? 0) : null)
    const impliedPrice = equityValue != null && td.sharesM != null && td.sharesM > 0
      ? equityValue / td.sharesM : null
    const upside = impliedPrice != null && td.currentPrice > 0
      ? (impliedPrice - td.currentPrice) / td.currentPrice : null
    const upsideColor = upside == null ? 'text-[#888]' : upside >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'

    function SummaryRow({ label, value, bold, color }: { label: string; value: React.ReactNode; bold?: boolean; color?: string }) {
      return (
        <div className={`flex items-center justify-between py-1 border-b border-[#1e1e1e] ${bold ? 'bg-[#151515]' : ''}`}>
          <span className={`text-xs ${bold ? 'font-semibold text-[#ccc]' : 'text-[#666]'}`}>{label}</span>
          <span className={`text-xs font-mono tabular-nums ${color ?? (bold ? 'text-white' : 'text-[#e2e2e2]')}`}>{value}</span>
        </div>
      )
    }

    return (
      <div className="bg-[#0d0d0d] px-6 py-4 border-t border-[#222]">
        {/* Toggle + input row */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#555]">Terminal Value</p>
          <div className="flex gap-1">
            <button
              onClick={() => onTerminalMethodChange('perpetuity')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                td.method === 'perpetuity' ? 'bg-[#4a9eff] text-white' : 'border border-[#333] text-[#888] hover:border-[#555]'
              }`}
            >
              Perpetuity
            </button>
            <button
              onClick={() => onTerminalMethodChange('multiple')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                td.method === 'multiple' ? 'bg-[#4a9eff] text-white' : 'border border-[#333] text-[#888] hover:border-[#555]'
              }`}
            >
              Multiple
            </button>
          </div>
        </div>

        {activeGuardError && td.method === 'perpetuity' && (
          <div className="mb-3 flex items-center gap-2 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">
            <span className="font-bold">!</span>
            <span>{td.guardError}</span>
          </div>
        )}

        {/* Method-specific input */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {isMultiple ? (
            <div className="flex items-center gap-2">
              <span className="text-[#666] text-xs">Exit Multiple EV/FCF</span>
              <input
                className="w-16 border border-[#333] bg-[#1a1a1a] px-2 py-1 text-center text-xs text-[#e2e2e2] rounded focus:border-[#4a9eff] focus:outline-none"
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
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[#666] text-xs">Terminal Growth Rate</span>
              <input
                className="w-16 border border-[#333] bg-[#1a1a1a] px-2 py-1 text-center text-xs text-[#e2e2e2] rounded focus:border-[#4a9eff] focus:outline-none"
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
              <span className="text-[#666] text-xs">%</span>
            </div>
          )}
        </div>

        {/* Valuation summary bridge */}
        <div className="max-w-xs space-y-0">
          <SummaryRow label="Terminal Value"          value={tv   != null ? fmtLargeM(tv)   : <NABadge reason="calc-error" />} />
          <SummaryRow label="PV of Terminal Value"    value={pvTv != null ? fmtLargeM(pvTv) : <NABadge reason="calc-error" />} />
          <SummaryRow label={isLfcf ? 'Cumulative PV of LFCF' : 'Cumulative PV of UFCF'} value={fmtLargeM(sumPvFlow)} />
          {isLfcf ? (
            <SummaryRow label="Equity Value (LFCF)"  value={ev   != null ? fmtLargeM(ev)   : <NABadge reason="calc-error" />} bold />
          ) : (
            <>
              <SummaryRow label="Enterprise Value"   value={ev   != null ? fmtLargeM(ev)   : <NABadge reason="calc-error" />} bold />
              <SummaryRow label="+ Cash"             value={td.cashM != null ? fmtLargeM(td.cashM) : <NABadge reason="no-data" />} />
              <SummaryRow label="− Debt"             value={td.debtM != null ? fmtLargeM(td.debtM) : <NABadge reason="no-data" />} />
              <SummaryRow label="Equity Value"       value={equityValue != null ? fmtLargeM(equityValue) : <NABadge reason="calc-error" />} bold />
            </>
          )}
          <SummaryRow label="Shares Outstanding"      value={td.sharesM != null ? td.sharesM.toFixed(1) + 'M' : <NABadge reason="no-data" />} />
          <SummaryRow label="Implied Share Price"     value={impliedPrice != null ? `${curr}${impliedPrice.toFixed(2)}` : <NABadge reason="calc-error" />} bold />
          <SummaryRow label="Current Share Price"     value={`${curr}${td.currentPrice.toFixed(2)}`} />
          <SummaryRow
            label="Implied Upside / (Downside)"
            value={upside != null ? (upside >= 0 ? '+' : '') + (upside * 100).toFixed(1) + '%' : <NABadge reason="calc-error" />}
            bold
            color={upsideColor}
          />
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#111111]">
      {/* Title bar + toggles */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#888]">
            Build Up Free Cash Flow
          </h3>
          {/* Preset pills */}
          <div className="flex gap-1">
            {(['conservative', 'base', 'optimistic'] as const).map(p => (
              <button
                key={p}
                onClick={() => onPresetChange(p)}
                className={`px-2.5 py-0.5 text-[11px] rounded-full capitalize transition-colors ${
                  preset === p
                    ? 'bg-[#4a9eff] text-white'
                    : 'border border-[#333] text-[#888] hover:border-[#555]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {/* CAGR override */}
          {onCagrChange && currentCagr != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#555] text-[11px] uppercase tracking-wide">CAGR</span>
              <input
                className="w-14 border border-[#333] bg-[#1a1a1a] px-2 py-0.5 text-center text-xs text-[#e2e2e2] rounded focus:border-[#4a9eff] focus:outline-none"
                value={cagrDraft ?? currentCagr.toFixed(1)}
                onChange={e => setCagrDraft(e.target.value)}
                onBlur={() => {
                  if (cagrDraft != null) {
                    const p = parseFloat(cagrDraft)
                    if (!isNaN(p) && p >= -20 && p <= 80) onCagrChange(p)
                    setCagrDraft(null)
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && cagrDraft != null) {
                    const p = parseFloat(cagrDraft)
                    if (!isNaN(p) && p >= -20 && p <= 80) onCagrChange(p)
                    setCagrDraft(null)
                  }
                }}
              />
              <span className="text-[#555] text-[11px]">%</span>
            </div>
          )}
          {/* WACC override */}
          {onWaccChange && currentWacc != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#555] text-[11px] uppercase tracking-wide">WACC</span>
              <input
                className="w-14 border border-[#333] bg-[#1a1a1a] px-2 py-0.5 text-center text-xs text-[#e2e2e2] rounded focus:border-[#4a9eff] focus:outline-none"
                value={waccDraft ?? currentWacc.toFixed(1)}
                onChange={e => setWaccDraft(e.target.value)}
                onBlur={() => {
                  if (waccDraft != null) {
                    const p = parseFloat(waccDraft)
                    if (!isNaN(p) && p > 0 && p < 50) onWaccChange(p)
                    setWaccDraft(null)
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && waccDraft != null) {
                    const p = parseFloat(waccDraft)
                    if (!isNaN(p) && p > 0 && p < 50) onWaccChange(p)
                    setWaccDraft(null)
                  }
                }}
              />
              <span className="text-[#555] text-[11px]">%</span>
            </div>
          )}
        </div>

        {/* Unlevered / Levered toggle */}
        <div className="flex rounded overflow-hidden border border-[#333] text-xs">
          <button
            onClick={() => setMode('ufcf')}
            className={`px-3 py-1 transition-colors ${
              mode === 'ufcf' ? 'bg-[#4a9eff] text-white' : 'text-[#888] hover:text-[#ccc]'
            }`}
          >
            Unlevered
          </button>
          <button
            onClick={() => setMode('lfcf')}
            className={`px-3 py-1 transition-colors ${
              mode === 'lfcf' ? 'bg-[#4a9eff] text-white' : 'text-[#888] hover:text-[#ccc]'
            }`}
          >
            Levered
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="bg-[#0a0a0a]">
              <th className="sticky left-0 z-10 bg-[#0a0a0a] px-4 py-2 text-left text-[11px] font-medium text-[#555] w-52 min-w-[200px]">
                {curr}M
              </th>
              {rows.map(r => (
                <th
                  key={r.year}
                  className={`px-2 py-2 text-right text-xs font-semibold whitespace-nowrap ${
                    r.year === 'TTM'
                      ? 'text-[#d4a017] bg-[#18140a]'
                      : r.isProjected
                        ? 'text-[#4a9eff] bg-[#0b1628]'
                        : 'text-[#666]'
                  }`}
                >
                  {colHeader(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mode === 'ufcf' ? renderUFCFRows() : renderLFCFRows()}
          </tbody>
        </table>
      </div>

      {/* WACC section */}
      {renderWACCSection()}

      {/* Terminal value section */}
      {renderTerminalSection()}
    </div>
  )
}
