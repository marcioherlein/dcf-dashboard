'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { computeBlendedFV, type ValuationAssumptions, type CockpitSnapshot } from '@/lib/valuation/cockpit'
import { fmtPrice } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
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
  { key: 'cagr',            label: 'Revenue Growth Rate', shortLabel: 'Rev. Growth',  unit: '%', step: 0.025, format: v => (v * 100).toFixed(0) + '%',  description: 'Avg annual revenue growth over 5 years' },
  { key: 'wacc',            label: 'Discount Rate (WACC)', shortLabel: 'WACC',         unit: '%', step: 0.015, format: v => (v * 100).toFixed(1) + '%',  description: 'Required annual return (risk-adjusted)' },
  { key: 'netMargin',       label: 'Long-run Net Margin',  shortLabel: 'Net Margin',   unit: '%', step: 0.025, format: v => (v * 100).toFixed(0) + '%',  description: 'Terminal profit margin at exit' },
  { key: 'exitPE',          label: 'Exit P/E Multiple',    shortLabel: 'Exit P/E',     unit: 'x', step: 5,     format: v => v.toFixed(0) + '×',           description: 'Price-to-earnings at terminal year' },
  { key: 'exitMultiple',    label: 'EV/EBITDA Multiple',   shortLabel: 'EV/EBITDA',    unit: 'x', step: 5,     format: v => v.toFixed(0) + '×',           description: 'Enterprise value to EBITDA at exit' },
  { key: 'revenueMultiple', label: 'EV/Revenue Multiple',  shortLabel: 'EV/Revenue',   unit: 'x', step: 2,     format: v => v.toFixed(1) + '×',           description: 'Enterprise value to revenue at exit' },
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

// ── Color helpers ─────────────────────────────────────────────────────────────

function cellColor(upsidePct: number | null): { bg: string; text: string } {
  if (upsidePct == null) return { bg: 'bg-[#F5F5F5]', text: 'text-[#9B9B9B]' }
  if (upsidePct >= 0.40) return { bg: 'bg-[#11875D]', text: 'text-white' }
  if (upsidePct >= 0.20) return { bg: 'bg-[#11875D]', text: 'text-white' }
  if (upsidePct >= 0.05) return { bg: 'bg-[#E8F7EF]', text: 'text-[#11875D]' }
  if (upsidePct >= -0.05) return { bg: 'bg-[#FFF4DA]', text: 'text-[#B56A00]' }
  if (upsidePct >= -0.20) return { bg: 'bg-[#FCEAEA]', text: 'text-[#D83B3B]' }
  return { bg: 'bg-[#D83B3B]', text: 'text-white' }
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
            <span className="px-1.5 py-0.5 bg-[#EAF1FF] text-[#2563EB] text-[10px] font-bold rounded-full tracking-wide uppercase">
              Base
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close scenario detail"
          ref={closeRef}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9B9B9B] hover:text-[#111111] hover:bg-[#E3E1DA] transition-colors text-[16px] leading-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
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
                  ? 'bg-[#EAF1FF] border border-[#93B4F5]'
                  : 'bg-white border border-[#E5E5E5]',
              )}
            >
              <p className="text-[11px] text-[#9B9B9B] leading-tight">{f.shortLabel}</p>
              <p className={cn('text-[13px] font-[750] tabular-nums leading-snug', isVaried ? 'text-[#2563EB]' : 'text-[#111111]')}>
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
    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
    : 'bg-violet-600 border-violet-600 text-white shadow-sm'
  const hoverClass = role === 'row'
    ? 'bg-white border-[#E5E5E5] text-[#6B6B6B] hover:border-[#93B4F5] hover:text-[#2563EB]'
    : 'bg-white border-[#E5E5E5] text-[#6B6B6B] hover:border-violet-300 hover:text-violet-600'

  return (
    <button
      disabled={isBlocked}
      onClick={onClick}
      aria-label={`${isBlocked ? `${field.shortLabel} (already used on other axis)` : `Set ${role === 'row' ? 'row' : 'column'} axis to ${field.shortLabel}`}`}
      aria-pressed={isSelected}
      title={isBlocked ? 'Already used on the other axis' : field.description}
      className={cn(
        'px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        role === 'row' ? 'focus-visible:ring-blue-500' : 'focus-visible:ring-violet-500',
        isSelected ? activeClass
          : isBlocked ? 'border-transparent text-[#9B9B9B] cursor-not-allowed select-none'
          : hoverClass,
      )}
    >
      {field.shortLabel}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SensitivityMatrix({
  assumptions, snapshot, currentPrice, currency, epvPerShare,
  historicalData = {}, defaultAxisY, defaultAxisX,
}: Props) {
  const [axisY, setAxisY] = useState<keyof ValuationAssumptions>(defaultAxisY)
  const [axisX, setAxisX] = useState<keyof ValuationAssumptions>(defaultAxisX)
  const [displayMode, setDisplayMode] = useState<'upside' | 'fv'>('upside')
  const [selectedCell, setSelectedCell] = useState<{ yi: number; xi: number } | null>(null)

  const fieldY = AXIS_FIELDS.find(f => f.key === axisY) ?? AXIS_FIELDS[0]
  const fieldX = AXIS_FIELDS.find(f => f.key === axisX) ?? AXIS_FIELDS[1]

  const yVals = useMemo(() => stepsAround(axisY, assumptions[axisY] as number, fieldY.step), [axisY, assumptions, fieldY.step])
  const xVals = useMemo(() => stepsAround(axisX, assumptions[axisX] as number, fieldX.step), [axisX, assumptions, fieldX.step])

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
    const pts = (historicalData[key] ?? []).filter(p => p.label !== 'curr')
    if (pts.length < 2) return null
    return pts.reduce((s, p) => s + p.value, 0) / pts.length
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
    if (key === axisX) setAxisX(axisY)
    setAxisY(key)
    setSelectedCell(null)
  }
  function pickX(key: keyof ValuationAssumptions) {
    if (key === axisY) setAxisY(axisX)
    setAxisX(key)
    setSelectedCell(null)
  }

  return (
    <div className="bg-white rounded-[14px] border border-[#E5E5E5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-col sm:flex-row mb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-[#111111]">Sensitivity Analysis</p>
            <InfoTooltip text="How fair value changes when you vary two assumptions simultaneously. Click any cell to see the full scenario assumptions. Every other assumption stays at its base value." />
          </div>
          <p className="text-[11px] text-[#9B9B9B] mt-0.5">
            Click a cell to inspect the scenario — all other assumptions stay at base
          </p>
        </div>

        {/* Display mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-[#E5E5E5] p-0.5 bg-[#F5F5F5] shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setDisplayMode('upside')}
            aria-pressed={displayMode === 'upside'}
            className={cn('text-[11px] font-semibold px-3 py-1 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
              displayMode === 'upside' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#9B9B9B] hover:text-[#6B6B6B]')}
          >
            % Upside
          </button>
          <button
            onClick={() => setDisplayMode('fv')}
            aria-pressed={displayMode === 'fv'}
            className={cn('text-[11px] font-semibold px-3 py-1 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
              displayMode === 'fv' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#9B9B9B] hover:text-[#6B6B6B]')}
          >
            Fair Value
          </button>
        </div>
      </div>

      {/* Grid — axis selectors embedded at their axis */}
      {currentPrice <= 0 ? (
        <div className="py-8 text-center rounded-xl border border-[#E5E5E5] bg-[#F5F5F5]">
          <p className="text-[12px] font-semibold text-[#6B6B6B]">Price unavailable</p>
          <p className="text-[11px] text-[#9B9B9B] mt-1">Upside calculations require a current market price.</p>
        </div>
      ) : (
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse" style={{ minWidth: 400 }}>
          <thead>
            {/* COLS selector — spans the data column area */}
            <tr>
              <th colSpan={2} />
              <th colSpan={xVals.length} className="pb-2 pl-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[8px] font-[700] text-violet-500 shrink-0 mr-0.5">COLS</span>
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
                  <span className="text-[11px] font-[700] text-[#2563EB]">{fieldY.shortLabel} ↓</span>
                  <span className="text-[11px] font-[700] text-violet-400">{fieldX.shortLabel} →</span>
                </div>
              </th>
              {xVals.map((xv, xi) => (
                <th key={xi} className="pb-2 text-center">
                  <div className={cn('text-[11px] font-[700] tabular-nums', xi === baseXIdx ? 'text-violet-600' : 'text-[#6B6B6B]')}>
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
                      <span className="text-[8px] font-[700] text-[#2563EB] mb-0.5">ROWS</span>
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
                <td className="pr-2 text-right py-0.5 w-[52px]">
                  <div className={cn('text-[11px] font-[700] tabular-nums', yi === baseYIdx ? 'text-[#2563EB]' : 'text-[#6B6B6B]')}>
                    {fieldY.format(yv)}
                  </div>
                  {yi === histYIdx && histY != null && (
                    <div className="text-[10px] text-[#9B9B9B] leading-none">hist</div>
                  )}
                </td>

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
                          'w-full flex flex-col items-center justify-center rounded-lg h-[44px] transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1',
                          colors.bg,
                          isBase && !isSelected && 'ring-2 ring-blue-500 ring-offset-1',
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-2 motion-safe:scale-105 z-10 relative shadow-md' : 'motion-safe:hover:brightness-95 motion-safe:hover:scale-[1.03]',
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
      )} {/* end currentPrice > 0 */}

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
            { bg: 'bg-[#11875D]', label: '≥40%' },
            { bg: 'bg-[#E8F7EF] border border-[#CDD1C8]', label: '5–40%' },
            { bg: 'bg-[#FFF4DA] border border-[#E5E5E5]', label: '±5%' },
            { bg: 'bg-[#FCEAEA]', label: '−5 to −20%' },
            { bg: 'bg-[#D83B3B]', label: '≤−20%' },
          ].map(({ bg, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('w-3 h-3 rounded-sm', bg)} />
              <span className="text-[11px] text-[#6B6B6B]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-1">
            <div className="w-3 h-3 rounded-sm ring-2 ring-blue-500" />
            <span className="text-[11px] text-[#6B6B6B]">base</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm ring-2 ring-slate-900" />
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
