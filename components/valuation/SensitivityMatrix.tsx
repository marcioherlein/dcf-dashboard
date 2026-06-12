'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { computeBlendedFV, type ValuationAssumptions, type CockpitSnapshot } from '@/lib/valuation/cockpit'
import { fmtPrice } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SparkPoint } from './cockpit/AssumptionsPanel'

// ── Field registry ────────────────────────────────────────────────────────────

interface AxisField {
  key: keyof ValuationAssumptions
  label: string
  shortLabel: string
  unit: '%' | 'x'
  step: number
  format: (v: number) => string
  description: string
}

const AXIS_FIELDS: AxisField[] = [
  { key: 'cagr',            label: 'Revenue Growth Rate',  shortLabel: 'Rev. Growth', unit: '%', step: 0.025, format: v => (v * 100).toFixed(0) + '%',  description: 'Avg annual revenue growth over 5 years' },
  { key: 'wacc',            label: 'Discount Rate (WACC)', shortLabel: 'WACC',        unit: '%', step: 0.015, format: v => (v * 100).toFixed(1) + '%',  description: 'Required annual return (risk-adjusted)' },
  { key: 'netMargin',       label: 'Long-run Net Margin',  shortLabel: 'Net Margin',  unit: '%', step: 0.025, format: v => (v * 100).toFixed(0) + '%',  description: 'Terminal profit margin at exit' },
  { key: 'exitPE',          label: 'Exit P/E Multiple',    shortLabel: 'Exit P/E',    unit: 'x', step: 5,     format: v => v.toFixed(0) + '×',           description: 'Price-to-earnings at terminal year' },
  { key: 'exitMultiple',    label: 'EV/EBITDA Multiple',   shortLabel: 'EV/EBITDA',   unit: 'x', step: 5,     format: v => v.toFixed(0) + '×',           description: 'Enterprise value to EBITDA at exit' },
  { key: 'revenueMultiple', label: 'EV/Revenue Multiple',  shortLabel: 'EV/Revenue',  unit: 'x', step: 2,     format: v => v.toFixed(1) + '×',           description: 'Enterprise value to revenue at exit' },
]

const FIELD_BOUNDS: Partial<Record<keyof ValuationAssumptions, [number, number]>> = {
  wacc: [0.04, 0.20], cagr: [-0.05, 0.50], netMargin: [-0.10, 0.50],
  exitPE: [5, 60], exitMultiple: [4, 30], revenueMultiple: [0.5, 15],
}

function clampVal(key: keyof ValuationAssumptions, v: number): number {
  const [lo, hi] = FIELD_BOUNDS[key] ?? [-Infinity, Infinity]
  return Math.max(lo, Math.min(hi, v))
}

function stepsAround(key: keyof ValuationAssumptions, base: number, step: number): number[] {
  return [-2, -1, 0, 1, 2].map(n => clampVal(key, base + n * step))
}

// ── Color helpers — 7-stop scale ──────────────────────────────────────────────

function cellColor(upsidePct: number | null): { bg: string; text: string } {
  if (upsidePct == null)  return { bg: 'bg-[#F5F5F5]', text: 'text-[#9B9B9B]' }
  if (upsidePct >= 0.40)  return { bg: 'bg-[#0D6B47]', text: 'text-white' }
  if (upsidePct >= 0.10)  return { bg: 'bg-[#11875D]', text: 'text-white' }
  if (upsidePct >= 0.05)  return { bg: 'bg-[#E8F7EF]', text: 'text-[#11875D]' }
  if (upsidePct >= -0.05) return { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]' }
  if (upsidePct >= -0.10) return { bg: 'bg-[#FCEAEA]', text: 'text-[#B52A2A]' }
  if (upsidePct >= -0.25) return { bg: 'bg-[#D83B3B]', text: 'text-white' }
  return                         { bg: 'bg-[#991919]', text: 'text-white' }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  assumptions: ValuationAssumptions
  snapshot: CockpitSnapshot
  currentPrice: number
  currency: string
  epvPerShare: number | null
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
  defaultAxisY: keyof ValuationAssumptions
  defaultAxisX: keyof ValuationAssumptions
}

// ── Compact heat map (default visible state) ──────────────────────────────────

function CompactHeatmap({
  assumptions, snapshot, currentPrice, currency: _currency,
  axisY, axisX, onExpand,
}: {
  assumptions: ValuationAssumptions
  snapshot: CockpitSnapshot
  currentPrice: number
  currency: string
  axisY: keyof ValuationAssumptions
  axisX: keyof ValuationAssumptions
  onExpand: () => void
}) {
  const fieldY = AXIS_FIELDS.find(f => f.key === axisY) ?? AXIS_FIELDS[1]
  const fieldX = AXIS_FIELDS.find(f => f.key === axisX) ?? AXIS_FIELDS[0]

  const yVals = useMemo(
    () => stepsAround(axisY, assumptions[axisY] as number, fieldY.step),
    [axisY, assumptions, fieldY.step]
  )
  const xVals = useMemo(
    () => stepsAround(axisX, assumptions[axisX] as number, fieldX.step),
    [axisX, assumptions, fieldX.step]
  )

  const grid = useMemo(() =>
    yVals.map(yv =>
      xVals.map(xv => {
        const tweaked = { ...assumptions, [axisY]: yv, [axisX]: xv }
        const fv = computeBlendedFV(tweaked, snapshot)
        const upside = fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null
        return { fv, upside }
      })
    ),
    [yVals, xVals, assumptions, snapshot, axisY, axisX, currentPrice]
  )

  // Base = center of the 5-step array (index 2)
  const baseYIdx = 2
  const baseXIdx = 2
  const baseCell = grid[baseYIdx]?.[baseXIdx]

  if (currentPrice <= 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F9F9F7] rounded-lg border border-[#E5E5E5] py-8">
        <p className="text-[11px] text-[#9B9B9B]">Price unavailable</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Table — full-bleed scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full border-collapse" style={{ minWidth: 240 }}>
          <thead>
            <tr>
              {/* Corner label */}
              <td className="w-[48px] pb-1.5 text-right pr-1.5">
                <div className="flex flex-col items-end gap-px">
                  <span className="text-[9px] font-[700] text-[#5F790B]">{fieldY.shortLabel} ↓</span>
                  <span className="text-[9px] font-[700] text-[#9B9B9B]">{fieldX.shortLabel} →</span>
                </div>
              </td>
              {xVals.map((xv, xi) => (
                <th
                  key={xi}
                  scope="col"
                  className={cn(
                    'pb-1.5 text-center text-[10px] font-[700] tabular-nums leading-none',
                    xi === baseXIdx ? 'text-[#5F790B]' : 'text-[#9B9B9B]'
                  )}
                >
                  {fieldX.format(xv)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yVals.map((yv, yi) => (
              <tr key={yi}>
                <th
                  scope="row"
                  className={cn(
                    'pr-1.5 text-right text-[10px] font-[700] tabular-nums py-0.5',
                    yi === baseYIdx ? 'text-[#5F790B]' : 'text-[#9B9B9B]'
                  )}
                >
                  {fieldY.format(yv)}
                </th>
                {xVals.map((_, xi) => {
                  const cell = grid[yi][xi]
                  const isBase = yi === baseYIdx && xi === baseXIdx
                  const { bg, text } = cellColor(cell.upside)
                  return (
                    <td key={xi} className="py-0.5 px-0.5">
                      <div
                        className={cn(
                          'rounded text-[10px] font-[800] tabular-nums py-1.5 text-center leading-none',
                          bg, text,
                          isBase && 'ring-2 ring-[#5F790B] ring-offset-1'
                        )}
                        style={{ minWidth: 32 }}
                      >
                        {cell.upside != null
                          ? `${cell.upside >= 0 ? '+' : ''}${(cell.upside * 100).toFixed(0)}%`
                          : '—'
                        }
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Base case caption */}
      {baseCell?.upside != null && (
        <p className="text-[10px] text-[#6B6B6B] leading-snug">
          Base case ({fieldY.shortLabel} {fieldY.format(yVals[baseYIdx])},{' '}
          {fieldX.shortLabel} {fieldX.format(xVals[baseXIdx])}) ={' '}
          <span className={cn('font-[700]', baseCell.upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
            {baseCell.upside >= 0 ? '+' : ''}{(baseCell.upside * 100).toFixed(0)}% upside
          </span>
        </p>
      )}

      {/* Legend strip */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { bg: 'bg-[#0D6B47]', label: '≥40%' },
          { bg: 'bg-[#11875D]', label: '10–40%' },
          { bg: 'bg-[#E8F7EF] border border-[#BFD2A1]', label: '5–10%' },
          { bg: 'bg-[#FEF3C7] border border-[#FDE68A]', label: '±5%' },
          { bg: 'bg-[#D83B3B]', label: '<−10%' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={cn('w-2.5 h-2.5 rounded-sm shrink-0', l.bg)} />
            <span className="text-[9px] text-[#9B9B9B]">{l.label}</span>
          </div>
        ))}
        <button
          onClick={onExpand}
          className="ml-auto text-[9px] font-[700] text-[#5F790B] hover:text-[#4A5E08] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5F790B] rounded"
          aria-label="Expand sensitivity analysis"
        >
          Expand ↗
        </button>
      </div>
    </div>
  )
}

// ── Cell detail panel ─────────────────────────────────────────────────────────

function CellDetail({
  yi, xi, yVals, xVals, fieldY, fieldX, assumptions, grid, currency, currentPrice,
  baseYIdx, baseXIdx, onClose,
}: {
  yi: number; xi: number
  yVals: number[]; xVals: number[]
  fieldY: AxisField; fieldX: AxisField
  assumptions: ValuationAssumptions
  grid: Array<Array<{ fv: number | null; upside: number | null }>>
  currency: string; currentPrice: number
  baseYIdx: number; baseXIdx: number
  onClose: () => void
}) {
  const yv = yVals[yi], xv = xVals[xi]
  const { fv, upside } = grid[yi][xi]
  const isBase = yi === baseYIdx && xi === baseXIdx
  const scenarioAssumptions: ValuationAssumptions = { ...assumptions, [fieldY.key]: yv, [fieldX.key]: xv }
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])

  return (
    <div className="mt-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5]/80 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 duration-150">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-[#111111]">
            {fieldY.shortLabel} {fieldY.format(yv)}
            <span className="text-[#9B9B9B] mx-1.5">×</span>
            {fieldX.shortLabel} {fieldX.format(xv)}
          </span>
          {isBase && (
            <span className="px-1.5 py-0.5 bg-[#F6FAEA] text-[#5F790B] text-[10px] font-bold rounded-full tracking-wide uppercase border border-[#BFD2A1]">
              Base
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close scenario detail"
          ref={closeRef}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9B9B9B] hover:text-[#111111] hover:bg-[#E3E1DA] transition-colors text-[16px] leading-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1"
        >
          ×
        </button>
      </div>

      {/* Key metrics */}
      <div className="flex items-end gap-5 mb-4 pb-3 border-b border-[#E5E5E5]">
        <div>
          <p className="text-[10px] text-[#9B9B9B] mb-0.5">Fair Value</p>
          <p className="text-[22px] font-[800] tabular-nums leading-none text-[#111111]">
            {fv != null ? fmtPrice(fv, currency) : '—'}
          </p>
        </div>
        {upside != null && (
          <div>
            <p className="text-[10px] text-[#9B9B9B] mb-0.5">vs Current Price</p>
            <p className={cn('text-[22px] font-[800] tabular-nums leading-none', upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
              {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
            </p>
          </div>
        )}
        {upside != null && currentPrice > 0 && (
          <div>
            <p className="text-[10px] text-[#9B9B9B] mb-0.5">Implied Price</p>
            <p className="text-[14px] font-[700] tabular-nums text-[#6B6B6B] leading-none">
              {fmtPrice(currentPrice, currency)} current
            </p>
          </div>
        )}
      </div>

      {/* All assumptions grid */}
      <p className="text-[10px] font-[700] text-[#9B9B9B] mb-2">Scenario assumptions</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {AXIS_FIELDS.map(f => {
          const val = scenarioAssumptions[f.key] as number
          const baseVal = assumptions[f.key] as number
          const isVaried = f.key === fieldY.key || f.key === fieldX.key
          const delta = val - baseVal
          const hasDelta = Math.abs(delta) > 0.0001

          return (
            <div
              key={f.key}
              className={cn(
                'rounded-lg p-2.5 flex flex-col gap-0.5',
                isVaried
                  ? 'bg-[#F6FAEA] border border-[#BFD2A1]'
                  : 'bg-white border border-[#E5E5E5]',
              )}
            >
              <p className="text-[11px] text-[#9B9B9B] leading-tight">{f.shortLabel}</p>
              <p className={cn('text-[13px] font-[750] tabular-nums leading-snug', isVaried ? 'text-[#5F790B]' : 'text-[#111111]')}>
                {f.format(val)}
              </p>
              {isVaried && hasDelta && (
                <p className={cn('text-[11px] tabular-nums font-[600]', delta > 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                  {delta > 0 ? '+' : ''}{f.unit === '%' ? (delta * 100).toFixed(1) + 'pp' : delta.toFixed(1) + '×'} vs base
                </p>
              )}
              {(!isVaried || !hasDelta) && (
                <p className="text-[11px] text-[#9B9B9B] tabular-nums">base</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Axis pill button ──────────────────────────────────────────────────────────

function AxisPill({
  field, isSelected, isBlocked, role, onClick,
}: {
  field: AxisField
  isSelected: boolean
  isBlocked: boolean
  role: 'row' | 'col'
  onClick: () => void
}) {
  const activeClass = role === 'row'
    ? 'bg-[#5F790B] border-[#5F790B] text-white shadow-sm'
    : 'bg-[#3D5207] border-[#3D5207] text-white shadow-sm'
  const hoverClass = role === 'row'
    ? 'bg-white border-[#E5E5E5] text-[#6B6B6B] hover:border-[#BFD2A1] hover:text-[#5F790B]'
    : 'bg-white border-[#E5E5E5] text-[#6B6B6B] hover:border-[#9DB870] hover:text-[#3D5207]'

  return (
    <button
      disabled={isBlocked}
      onClick={onClick}
      aria-label={isBlocked
        ? `${field.shortLabel} (already used on other axis)`
        : `Set ${role === 'row' ? 'row' : 'column'} axis to ${field.shortLabel}`}
      aria-pressed={isSelected}
      title={isBlocked ? 'Already used on the other axis' : field.description}
      className={cn(
        'px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#5F790B]',
        isSelected ? activeClass
          : isBlocked ? 'border-transparent text-[#9B9B9B] cursor-not-allowed select-none'
          : hoverClass,
      )}
    >
      {field.shortLabel}
    </button>
  )
}

// ── Full expanded matrix (used inside modal) ──────────────────────────────────

function ExpandedMatrix({
  assumptions, snapshot, currentPrice, currency, epvPerShare,
  historicalData, defaultAxisY, defaultAxisX, onAxisChange,
}: Props & { onAxisChange?: (y: keyof ValuationAssumptions, x: keyof ValuationAssumptions) => void }) {
  const [axisY, setAxisY] = useState<keyof ValuationAssumptions>(defaultAxisY)
  const [axisX, setAxisX] = useState<keyof ValuationAssumptions>(defaultAxisX)
  const [displayMode, setDisplayMode] = useState<'upside' | 'fv'>('upside')
  const [selectedCell, setSelectedCell] = useState<{ yi: number; xi: number } | null>(null)

  // Sync if parent changes defaults (e.g. modal re-opens)
  useEffect(() => { setAxisY(defaultAxisY); setSelectedCell(null) }, [defaultAxisY])
  useEffect(() => { setAxisX(defaultAxisX); setSelectedCell(null) }, [defaultAxisX])

  const fieldY = AXIS_FIELDS.find(f => f.key === axisY) ?? AXIS_FIELDS[1]
  const fieldX = AXIS_FIELDS.find(f => f.key === axisX) ?? AXIS_FIELDS[0]

  const yVals = useMemo(
    () => stepsAround(axisY, assumptions[axisY] as number, fieldY.step),
    [axisY, assumptions, fieldY.step]
  )
  const xVals = useMemo(
    () => stepsAround(axisX, assumptions[axisX] as number, fieldX.step),
    [axisX, assumptions, fieldX.step]
  )

  const grid = useMemo(() =>
    yVals.map(y =>
      xVals.map(x => {
        const tweaked = { ...assumptions, [axisY]: y, [axisX]: x }
        const fv = computeBlendedFV(tweaked, snapshot)
        const upside = fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null
        return { fv, upside }
      })
    ),
    [yVals, xVals, assumptions, snapshot, axisY, axisX, currentPrice]
  )

  function historicalAvg(key: keyof ValuationAssumptions): number | null {
    const pts = ((historicalData ?? {})[key] ?? []).filter((p: SparkPoint) => p.label !== 'curr')
    if (pts.length < 2) return null
    return pts.reduce((s: number, p: SparkPoint) => s + p.value, 0) / pts.length
  }

  const histY = historicalAvg(axisY)
  const histX = historicalAvg(axisX)

  const baseYIdx = yVals.indexOf(yVals.reduce((prev, cur) =>
    Math.abs(cur - (assumptions[axisY] as number)) < Math.abs(prev - (assumptions[axisY] as number)) ? cur : prev))
  const baseXIdx = xVals.indexOf(xVals.reduce((prev, cur) =>
    Math.abs(cur - (assumptions[axisX] as number)) < Math.abs(prev - (assumptions[axisX] as number)) ? cur : prev))

  function isNearHist(vals: number[], histVal: number | null): number {
    if (histVal == null) return -1
    return vals.indexOf(vals.reduce((prev, cur) =>
      Math.abs(cur - histVal) < Math.abs(prev - histVal) ? cur : prev))
  }
  const histYIdx = isNearHist(yVals, histY)
  const histXIdx = isNearHist(xVals, histX)

  function pickY(key: keyof ValuationAssumptions) {
    const newX = key === axisX ? axisY : axisX
    setAxisX(newX)
    setAxisY(key)
    setSelectedCell(null)
    onAxisChange?.(key, newX)
  }
  function pickX(key: keyof ValuationAssumptions) {
    const newY = key === axisY ? axisX : axisY
    setAxisY(newY)
    setAxisX(key)
    setSelectedCell(null)
    onAxisChange?.(newY, key)
  }

  return (
    <div>
      {/* Axis controls + display toggle */}
      <div className="flex items-start justify-between gap-3 flex-col sm:flex-row mb-4">
        <p className="text-[11px] text-[#9B9B9B]">
          Click a cell to inspect the scenario — all other assumptions stay at base
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-[#E5E5E5] p-0.5 bg-[#F5F5F5] shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setDisplayMode('upside')}
            aria-pressed={displayMode === 'upside'}
            className={cn(
              'text-[11px] font-semibold px-3 py-1 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1',
              displayMode === 'upside' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#9B9B9B] hover:text-[#6B6B6B]'
            )}
          >
            % Upside
          </button>
          <button
            onClick={() => setDisplayMode('fv')}
            aria-pressed={displayMode === 'fv'}
            className={cn(
              'text-[11px] font-semibold px-3 py-1 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1',
              displayMode === 'fv' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#9B9B9B] hover:text-[#6B6B6B]'
            )}
          >
            Fair Value
          </button>
        </div>
      </div>

      {currentPrice <= 0 ? (
        <div className="py-8 text-center rounded-xl border border-[#E5E5E5] bg-[#F5F5F5]">
          <p className="text-[12px] font-semibold text-[#6B6B6B]">Price unavailable</p>
          <p className="text-[11px] text-[#9B9B9B] mt-1">Upside calculations require a current market price.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-collapse" style={{ minWidth: 400 }}>
            <thead>
              {/* COLS selector */}
              <tr>
                <th colSpan={2} />
                <th colSpan={xVals.length} className="pb-2 pl-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[8px] font-[700] text-[#5F790B] shrink-0 mr-0.5">COLS</span>
                    {AXIS_FIELDS.map(f => (
                      <AxisPill
                        key={f.key}
                        field={f}
                        isSelected={f.key === axisX}
                        isBlocked={f.key === axisY}
                        role="col"
                        onClick={() => pickX(f.key)}
                      />
                    ))}
                  </div>
                </th>
              </tr>
              {/* Column value headers */}
              <tr>
                <th colSpan={2} className="pr-2 pb-2 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-[700] text-[#5F790B]">{fieldY.shortLabel} ↓</span>
                    <span className="text-[11px] font-[700] text-[#3D5207]">{fieldX.shortLabel} →</span>
                  </div>
                </th>
                {xVals.map((xv, xi) => (
                  <th key={xi} scope="col" className="pb-2 text-center">
                    <div className={cn('text-[11px] font-[700] tabular-nums', xi === baseXIdx ? 'text-[#3D5207]' : 'text-[#6B6B6B]')}>
                      {fieldX.format(xv)}
                    </div>
                    {xi === histXIdx && histX != null && (
                      <div className="text-[10px] text-[#9B9B9B] leading-none mt-0.5">hist</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yVals.map((yv, yi) => (
                <tr key={yi}>
                  {/* ROWS selector — first row only, spans all data rows */}
                  {yi === 0 && (
                    <td rowSpan={yVals.length} className="align-top pt-0.5 pr-2 w-[90px]">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[8px] font-[700] text-[#5F790B] mb-0.5">ROWS</span>
                        {AXIS_FIELDS.map(f => (
                          <AxisPill
                            key={f.key}
                            field={f}
                            isSelected={f.key === axisY}
                            isBlocked={f.key === axisX}
                            role="row"
                            onClick={() => pickY(f.key)}
                          />
                        ))}
                      </div>
                    </td>
                  )}

                  {/* Row label */}
                  <th scope="row" className="pr-2 text-right py-0.5 w-[52px]">
                    <div className={cn('text-[11px] font-[700] tabular-nums', yi === baseYIdx ? 'text-[#5F790B]' : 'text-[#6B6B6B]')}>
                      {fieldY.format(yv)}
                    </div>
                    {yi === histYIdx && histY != null && (
                      <div className="text-[10px] text-[#9B9B9B] leading-none">hist</div>
                    )}
                  </th>

                  {/* Data cells */}
                  {xVals.map((_, xi) => {
                    const { fv, upside } = grid[yi][xi]
                    const isBase = yi === baseYIdx && xi === baseXIdx
                    const isSelected = selectedCell?.yi === yi && selectedCell?.xi === xi
                    const colors = cellColor(upside)

                    return (
                      <td key={xi} className="py-0.5 px-0.5">
                        <button
                          onClick={() => setSelectedCell(isSelected ? null : { yi, xi })}
                          aria-pressed={isSelected}
                          aria-label={`Scenario: ${fieldY.shortLabel} ${fieldY.format(yv)}, ${fieldX.shortLabel} ${fieldX.format(xVals[xi])}`}
                          className={cn(
                            'w-full flex flex-col items-center justify-center rounded-lg h-[44px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1',
                            colors.bg,
                            isBase && !isSelected && 'ring-2 ring-[#5F790B] ring-offset-1',
                            isSelected
                              ? 'ring-2 ring-[#06101F] ring-offset-2 motion-safe:scale-105 z-10 relative shadow-md'
                              : 'motion-safe:hover:brightness-95 motion-safe:hover:scale-[1.03]',
                          )}
                        >
                          {displayMode === 'upside' ? (
                            <>
                              <span className={cn('text-[11px] sm:text-[12px] font-[800] tabular-nums leading-tight', colors.text)}>
                                {upside != null ? (upside >= 0 ? '+' : '') + (upside * 100).toFixed(0) + '%' : '—'}
                              </span>
                              {isBase && <span className={cn('text-[8px] font-[600] leading-none mt-0.5', colors.text)}>base</span>}
                            </>
                          ) : (
                            <>
                              <span className={cn('text-[10px] sm:text-[11px] font-[800] tabular-nums leading-tight', colors.text)}>
                                {fv != null ? fmtPrice(fv, currency) : '—'}
                              </span>
                              {isBase && <span className={cn('text-[8px] font-[600] leading-none mt-0.5', colors.text)}>base</span>}
                            </>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cell detail panel */}
      {selectedCell != null && (
        <CellDetail
          yi={selectedCell.yi}
          xi={selectedCell.xi}
          yVals={yVals}
          xVals={xVals}
          fieldY={fieldY}
          fieldX={fieldX}
          assumptions={assumptions}
          grid={grid}
          currency={currency}
          currentPrice={currentPrice}
          baseYIdx={baseYIdx}
          baseXIdx={baseXIdx}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {/* Legend + EPV */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[#9B9B9B] font-[600]">Upside vs price:</span>
          {[
            { bg: 'bg-[#0D6B47]', label: '≥40%' },
            { bg: 'bg-[#11875D]', label: '10–40%' },
            { bg: 'bg-[#E8F7EF] border border-[#BFD2A1]', label: '5–10%' },
            { bg: 'bg-[#FEF3C7] border border-[#FDE68A]', label: '±5%' },
            { bg: 'bg-[#FCEAEA]', label: '-5 to -10%' },
            { bg: 'bg-[#D83B3B]', label: '-10 to -25%' },
            { bg: 'bg-[#991919]', label: '≤-25%' },
          ].map(({ bg, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('w-3 h-3 rounded-sm', bg)} />
              <span className="text-[11px] text-[#6B6B6B]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-1">
            <div className="w-3 h-3 rounded-sm ring-2 ring-[#5F790B]" />
            <span className="text-[11px] text-[#6B6B6B]">base</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm ring-2 ring-[#06101F]" />
            <span className="text-[11px] text-[#6B6B6B]">selected</span>
          </div>
        </div>

        {epvPerShare != null && epvPerShare > 0 && (
          <div className="text-[10px] text-[#6B6B6B] bg-[#F5F5F5] rounded-lg px-3 py-1.5 border border-[#E5E5E5]">
            <span className="font-[600]">No-growth floor (EPV):</span>{' '}
            <span className="font-[750] tabular-nums text-[#111111]">{fmtPrice(epvPerShare, currency)}</span>
            <span className="text-[#9B9B9B] ml-1">— value if growth stops</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SensitivityMatrix({
  assumptions, snapshot, currentPrice, currency, epvPerShare,
  historicalData = {}, defaultAxisY, defaultAxisX,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeAxisY, setActiveAxisY] = useState<keyof ValuationAssumptions>(defaultAxisY)
  const [activeAxisX, setActiveAxisX] = useState<keyof ValuationAssumptions>(defaultAxisX)
  const expandBtnRef = useRef<HTMLButtonElement>(null)

  // Update active axes when parent defaults change
  useEffect(() => { setActiveAxisY(defaultAxisY) }, [defaultAxisY])
  useEffect(() => { setActiveAxisX(defaultAxisX) }, [defaultAxisX])

  function handleModalClose() {
    setModalOpen(false)
    requestAnimationFrame(() => expandBtnRef.current?.focus())
  }

  const activeFieldY = AXIS_FIELDS.find(f => f.key === activeAxisY) ?? AXIS_FIELDS[1]
  const activeFieldX = AXIS_FIELDS.find(f => f.key === activeAxisX) ?? AXIS_FIELDS[0]

  return (
    <div className="bg-white rounded-[14px] border border-[#E5E5E5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-5 flex flex-col h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-[700] tracking-wider uppercase text-[#9B9B9B]">Sensitivity Analysis</p>
            <InfoTooltip text="How fair value changes when you vary two assumptions simultaneously. Click Expand to choose any row and column axis — selections persist when you close." />
          </div>
          <p className="text-[13px] font-[700] text-[#06101F] mt-0.5">
            {activeFieldY.shortLabel}
            {' '}&times;{' '}
            {activeFieldX.shortLabel}
          </p>
        </div>

        <button
          ref={expandBtnRef}
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
          aria-label="Expand sensitivity analysis with axis controls"
          className="text-[11px] font-[650] text-[#5F790B] bg-[#F6FAEA] border border-[#BFD2A1] px-3 py-2 rounded-lg min-h-[44px] flex items-center hover:bg-[#EEF4DD] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B]"
        >
          Expand ↗
        </button>
      </div>

      {/* Default compact heat map — uses persisted axes */}
      <div className="flex-1 min-h-0">
        <CompactHeatmap
          assumptions={assumptions}
          snapshot={snapshot}
          currentPrice={currentPrice}
          currency={currency}
          axisY={activeAxisY}
          axisX={activeAxisX}
          onExpand={() => setModalOpen(true)}
        />
      </div>

      {/* Expand modal — full matrix with axis selectors, axes persist on close */}
      <Dialog open={modalOpen} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleModalClose() }}>
        <DialogContent
          className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-0"
          showCloseButton={false}
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#E5E5E5] flex-row items-center justify-between">
            <div>
              <p className="text-[10px] font-[700] tracking-wider uppercase text-[#9B9B9B]">Sensitivity Analysis</p>
              <DialogTitle className="text-[15px] font-[700] text-[#06101F] mt-0.5">
                Adjust axes to explore scenarios
              </DialogTitle>
            </div>
            <button
              onClick={handleModalClose}
              aria-label="Close sensitivity analysis"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F5F5] hover:bg-[#E3E1DA] text-[#6B6B6B] text-lg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B]"
            >
              ×
            </button>
          </DialogHeader>

          <div className="p-4 sm:p-5">
            <ExpandedMatrix
              assumptions={assumptions}
              snapshot={snapshot}
              currentPrice={currentPrice}
              currency={currency}
              epvPerShare={epvPerShare}
              historicalData={historicalData}
              defaultAxisY={activeAxisY}
              defaultAxisX={activeAxisX}
              onAxisChange={(y, x) => { setActiveAxisY(y); setActiveAxisX(x) }}
            />
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
