'use client'

import { useState, useMemo } from 'react'
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
}

const AXIS_FIELDS: AxisField[] = [
  { key: 'cagr',            label: 'Revenue Growth Rate (CAGR)', shortLabel: 'Rev. Growth',   unit: '%', step: 0.025, format: v => (v * 100).toFixed(0) + '%' },
  { key: 'wacc',            label: 'Discount Rate (WACC)',        shortLabel: 'WACC',          unit: '%', step: 0.010, format: v => (v * 100).toFixed(1) + '%' },
  { key: 'netMargin',       label: 'Long-run Profit Margin',      shortLabel: 'Net Margin',    unit: '%', step: 0.025, format: v => (v * 100).toFixed(0) + '%' },
  { key: 'exitPE',          label: 'Exit P/E Multiple',           shortLabel: 'Exit P/E',      unit: 'x', step: 3,     format: v => v.toFixed(0) + '×' },
  { key: 'exitMultiple',    label: 'EV/EBITDA Multiple',          shortLabel: 'EV/EBITDA',     unit: 'x', step: 2,     format: v => v.toFixed(0) + '×' },
  { key: 'revenueMultiple', label: 'EV/Revenue Multiple',         shortLabel: 'EV/Revenue',    unit: 'x', step: 1,     format: v => v.toFixed(1) + '×' },
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
  if (upsidePct == null) return { bg: 'bg-slate-50', text: 'text-slate-400' }
  if (upsidePct >= 0.40) return { bg: 'bg-emerald-600', text: 'text-white' }
  if (upsidePct >= 0.20) return { bg: 'bg-emerald-500', text: 'text-white' }
  if (upsidePct >= 0.05) return { bg: 'bg-emerald-100', text: 'text-emerald-800' }
  if (upsidePct >= -0.05) return { bg: 'bg-amber-50', text: 'text-amber-700' }
  if (upsidePct >= -0.20) return { bg: 'bg-red-100', text: 'text-red-700' }
  return { bg: 'bg-red-600', text: 'text-white' }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  assumptions: ValuationAssumptions
  snapshot: CockpitSnapshot
  currentPrice: number
  currency: string
  epvPerShare: number | null
  // Historical avg per assumption (for axis annotation)
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
  // Auto-selected axes (top-2 by sensitivity)
  defaultAxisY: keyof ValuationAssumptions
  defaultAxisX: keyof ValuationAssumptions
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SensitivityMatrix({
  assumptions, snapshot, currentPrice, currency, epvPerShare,
  historicalData = {}, defaultAxisY, defaultAxisX,
}: Props) {
  const [axisY, setAxisY] = useState<keyof ValuationAssumptions>(defaultAxisY)
  const [axisX, setAxisX] = useState<keyof ValuationAssumptions>(defaultAxisX)
  const [displayMode, setDisplayMode] = useState<'upside' | 'fv'>('upside')

  const fieldY = AXIS_FIELDS.find(f => f.key === axisY) ?? AXIS_FIELDS[0]
  const fieldX = AXIS_FIELDS.find(f => f.key === axisX) ?? AXIS_FIELDS[1]

  const yVals = useMemo(() => stepsAround(axisY, assumptions[axisY] as number, fieldY.step), [axisY, assumptions, fieldY.step])
  const xVals = useMemo(() => stepsAround(axisX, assumptions[axisX] as number, fieldX.step), [axisX, assumptions, fieldX.step])

  // Compute 5×5 grid — synchronous, no API
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

  // Historical avg for axis annotations
  function historicalAvg(key: keyof ValuationAssumptions): number | null {
    const pts = (historicalData[key] ?? []).filter(p => p.label !== 'curr')
    if (pts.length < 2) return null
    return pts.reduce((s, p) => s + p.value, 0) / pts.length
  }

  const histY = historicalAvg(axisY)
  const histX = historicalAvg(axisX)

  // Find the base-case cell (closest to current assumptions)
  const baseYIdx = yVals.indexOf(yVals.reduce((prev, cur) => Math.abs(cur - (assumptions[axisY] as number)) < Math.abs(prev - (assumptions[axisY] as number)) ? cur : prev))
  const baseXIdx = xVals.indexOf(xVals.reduce((prev, cur) => Math.abs(cur - (assumptions[axisX] as number)) < Math.abs(prev - (assumptions[axisX] as number)) ? cur : prev))

  // Mark which axis values are closest to historical avg
  function isNearHist(vals: number[], histVal: number | null): number {
    if (histVal == null) return -1
    return vals.indexOf(vals.reduce((prev, cur) => Math.abs(cur - histVal) < Math.abs(prev - histVal) ? cur : prev))
  }
  const histYIdx = isNearHist(yVals, histY)
  const histXIdx = isNearHist(xVals, histX)

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-slate-800">Sensitivity Analysis</p>
            <InfoTooltip text="How fair value changes when you vary two assumptions simultaneously. Every other assumption stays at its base value. The highlighted cell is your current scenario." />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Move any two assumptions — all others stay fixed at base values
          </p>
        </div>

        {/* Display mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50 shrink-0">
          <button onClick={() => setDisplayMode('upside')} className={cn('text-[11px] font-semibold px-3 py-1 rounded-md transition-all', displayMode === 'upside' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>% Upside</button>
          <button onClick={() => setDisplayMode('fv')} className={cn('text-[11px] font-semibold px-3 py-1 rounded-md transition-all', displayMode === 'fv' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>Fair Value</button>
        </div>
      </div>

      {/* Axis selectors */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label htmlFor="sensitivity-axis-rows" className="text-[10px] font-[700] uppercase tracking-wide text-slate-400">Rows</label>
          <select
            id="sensitivity-axis-rows"
            aria-label="Row axis variable"
            value={axisY}
            onChange={e => {
              const v = e.target.value as keyof ValuationAssumptions
              if (v === axisX) setAxisX(axisY)
              setAxisY(v)
            }}
            className="text-[12px] font-semibold text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:border-blue-400 cursor-pointer"
          >
            {AXIS_FIELDS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
        <span className="text-slate-200 text-sm" aria-hidden="true">×</span>
        <div className="flex items-center gap-2">
          <label htmlFor="sensitivity-axis-cols" className="text-[10px] font-[700] uppercase tracking-wide text-slate-400">Columns</label>
          <select
            id="sensitivity-axis-cols"
            aria-label="Column axis variable"
            value={axisX}
            onChange={e => {
              const v = e.target.value as keyof ValuationAssumptions
              if (v === axisY) setAxisY(axisX)
              setAxisX(v)
            }}
            className="text-[12px] font-semibold text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:border-blue-400 cursor-pointer"
          >
            {AXIS_FIELDS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse" style={{ minWidth: 360 }}>
          <thead>
            <tr>
              {/* Corner cell with axis labels */}
              <th className="text-right pr-2 pb-2 w-[96px]">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[9px] font-[700] text-slate-400 uppercase tracking-wide">{fieldY.shortLabel} ↓</span>
                  <span className="text-[9px] font-[700] text-slate-400 uppercase tracking-wide">{fieldX.shortLabel} →</span>
                </div>
              </th>
              {xVals.map((xv, xi) => (
                <th key={xi} className="pb-2 text-center">
                  <div className={cn('text-[11px] font-[700] tabular-nums', xi === baseXIdx ? 'text-blue-600' : 'text-slate-500')}>
                    {fieldX.format(xv)}
                  </div>
                  {xi === histXIdx && histX != null && (
                    <div className="text-[9px] text-slate-400 leading-none mt-0.5">← hist</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yVals.map((yv, yi) => (
              <tr key={yi}>
                {/* Y-axis label */}
                <td className="pr-2 text-right py-0.5">
                  <div className={cn('text-[11px] font-[700] tabular-nums', yi === baseYIdx ? 'text-blue-600' : 'text-slate-500')}>
                    {fieldY.format(yv)}
                  </div>
                  {yi === histYIdx && histY != null && (
                    <div className="text-[9px] text-slate-400 leading-none">← hist</div>
                  )}
                </td>

                {/* Cells */}
                {xVals.map((_, xi) => {
                  const { fv, upside } = grid[yi][xi]
                  const isBase = yi === baseYIdx && xi === baseXIdx
                  const colors = cellColor(upside)

                  return (
                    <td key={xi} className="py-0.5 px-0.5">
                      <div className={cn(
                        'flex flex-col items-center justify-center rounded-lg h-[44px] transition-all',
                        colors.bg,
                        isBase && 'ring-2 ring-blue-500 ring-offset-1',
                      )}>
                        {displayMode === 'upside' ? (
                          <>
                            <span className={cn('text-[12px] font-[800] tabular-nums leading-tight', colors.text)}>
                              {upside != null ? (upside >= 0 ? '+' : '') + (upside * 100).toFixed(0) + '%' : '—'}
                            </span>
                            {isBase && <span className={cn('text-[8px] font-[600] leading-none mt-0.5', colors.text)}>base</span>}
                          </>
                        ) : (
                          <>
                            <span className={cn('text-[11px] font-[800] tabular-nums leading-tight', colors.text)}>
                              {fv != null ? fmtPrice(fv, currency) : '—'}
                            </span>
                            {isBase && <span className={cn('text-[8px] font-[600] leading-none mt-0.5', colors.text)}>base</span>}
                          </>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend + EPV reference */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        {/* Legend */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400 font-[600]">Upside vs price:</span>
          {[
            { bg: 'bg-emerald-600', label: '≥40%' },
            { bg: 'bg-emerald-100', label: '5–40%' },
            { bg: 'bg-amber-50 border border-amber-200', label: '±5%' },
            { bg: 'bg-red-100', label: '−5 to −20%' },
            { bg: 'bg-red-600', label: '≤−20%' },
          ].map(({ bg, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('w-3 h-3 rounded-sm', bg)} />
              <span className="text-[9px] text-slate-500">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-1">
            <div className="w-3 h-3 rounded-sm border-2 border-blue-500" />
            <span className="text-[9px] text-slate-500">base case</span>
          </div>
        </div>

        {/* EPV reference */}
        {epvPerShare != null && epvPerShare > 0 && (
          <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
            <span className="font-[600]">No-growth floor (EPV):</span>{' '}
            <span className="font-[750] tabular-nums text-slate-700">{fmtPrice(epvPerShare, currency)}</span>
            <span className="text-slate-400 ml-1">— what the company earns if growth stops</span>
          </div>
        )}
      </div>

    </div>
  )
}
