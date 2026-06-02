'use client'

import { TrendingUp, BarChart2, BarChart, Target, RotateCcw, Undo2, BookOpen } from 'lucide-react'
import { fmtPrice } from '@/lib/formatters'
import type { CockpitMethodResult, ValuationAssumptions } from '@/lib/valuation/cockpit'
import InfoTooltip from '@/components/ui/InfoTooltip'
import type { SparkPoint } from './AssumptionsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  methods: CockpitMethodResult[]
  currentPrice: number
  currency: string
  fcfMargin?: number | null
  ttmEbitdaDollars?: number | null
  assumptions: ValuationAssumptions
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
  onChange: (next: ValuationAssumptions) => void
  onReset: () => void
  onUndo: () => void
  canUndo: boolean
  sensitivity?: Partial<Record<keyof ValuationAssumptions, number>>
  sectorBenchmarks?: { exitPE: number; exitMultiple: number; revenueMultiple: number } | null
  onScrollToFullDCF: () => void
}

type IconComp = React.ComponentType<{ size?: number; className?: string }>

interface FieldDef {
  key: keyof ValuationAssumptions
  label: string
  unit: '%' | 'x'
  step: number
  min: number
  max: number
  chartKey?: keyof ValuationAssumptions
}

// ─── Per-method input definitions ─────────────────────────────────────────────

const METHOD_INPUTS: Record<string, FieldDef[]> = {
  forward_pe: [
    { key: 'exitPE',    label: 'Exit P/E',        unit: 'x', step: 0.5,   min: 5,     max: 80,  chartKey: 'exitPE'    },
    { key: 'netMargin', label: 'Exit net margin',  unit: '%', step: 0.005, min: -0.20, max: 0.60, chartKey: 'netMargin' },
  ],
  ev_ebitda: [
    { key: 'exitMultiple', label: 'EV/EBITDA multiple', unit: 'x', step: 0.5, min: 4, max: 35, chartKey: 'exitMultiple' },
  ],
  revenue_multiple: [
    { key: 'revenueMultiple', label: 'EV/Revenue multiple', unit: 'x', step: 0.25, min: 0.5, max: 20, chartKey: 'revenueMultiple' },
  ],
  price_to_book: [
    { key: 'priceToBookMultiple', label: 'Target P/B', unit: 'x', step: 0.1, min: 0.3, max: 5.0, chartKey: 'priceToBookMultiple' },
  ],
  core_dcf: [],
}

// ─── Visual config per method ─────────────────────────────────────────────────

const METHOD_CFG: Record<string, {
  iconBg: string; iconText: string
  barBg: string; valueBg: string; valueText: string
  chartHex: string
  Icon: IconComp
}> = {
  forward_pe: {
    iconBg: 'bg-blue-100', iconText: 'text-blue-600',
    barBg: 'bg-blue-500', valueBg: 'bg-blue-50', valueText: 'text-blue-700',
    chartHex: '#3b82f6',
    Icon: TrendingUp as IconComp,
  },
  ev_ebitda: {
    iconBg: 'bg-indigo-100', iconText: 'text-indigo-600',
    barBg: 'bg-indigo-400', valueBg: 'bg-indigo-50', valueText: 'text-indigo-700',
    chartHex: '#6366f1',
    Icon: BarChart2 as IconComp,
  },
  revenue_multiple: {
    iconBg: 'bg-purple-100', iconText: 'text-purple-600',
    barBg: 'bg-purple-500', valueBg: 'bg-purple-50', valueText: 'text-purple-700',
    chartHex: '#a855f7',
    Icon: BarChart as IconComp,
  },
  price_to_book: {
    iconBg: 'bg-indigo-100', iconText: 'text-indigo-600',
    barBg: 'bg-indigo-400', valueBg: 'bg-indigo-50', valueText: 'text-indigo-700',
    chartHex: '#6366f1',
    Icon: BookOpen as IconComp,
  },
  core_dcf: {
    iconBg: 'bg-emerald-100', iconText: 'text-emerald-600',
    barBg: 'bg-emerald-500', valueBg: 'bg-emerald-50', valueText: 'text-emerald-700',
    chartHex: '#10b981',
    Icon: Target as IconComp,
  },
}

const CONFIDENCE_CHIP = {
  high:   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'High confidence'   },
  medium: { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   label: 'Medium confidence' },
  low:    { bg: 'bg-slate-100 border-slate-200',    text: 'text-slate-500',   label: 'Low confidence'    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number, unit: '%' | 'x'): string {
  if (unit === '%') return `${(value * 100).toFixed(1)}%`
  return `${value.toFixed(1)}×`
}

function median(vals: number[]): number | null {
  if (vals.length === 0) return null
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2
}

function historicalHint(series: SparkPoint[] | undefined, unit: '%' | 'x'): string | null {
  if (!series || series.length === 0) return null
  const vals = series.filter(p => p.label !== 'curr').map(p => p.value)
  const med = median(vals)
  if (med == null) return null
  return `Median ~${fmt(med, unit)}`
}

// ─── MiniLineChart ────────────────────────────────────────────────────────────

function MiniLineChart({ series, inputVal, color }: {
  series: SparkPoint[]
  inputVal: number
  color: string
}) {
  if (series.length === 0) return null

  const W = 240, H = 64
  const MT = 8, MB = 16

  const allVals = [...series.map(p => p.value), inputVal]
  const rawMin  = Math.min(...allVals)
  const rawMax  = Math.max(...allVals)
  const span    = rawMax - rawMin || 1
  const yMin    = rawMin - span * 0.12
  const yMax    = rawMax + span * 0.12

  const toY = (v: number) => MT + (H - MT - MB) * (1 - (v - yMin) / (yMax - yMin))
  const toX = (i: number) => series.length > 1 ? (i / (series.length - 1)) * W : W / 2

  const refY = Math.min(Math.max(toY(inputVal), MT), H - MB)
  const inputAbove = inputVal > yMax
  const inputBelow = inputVal < yMin

  const points = series.map((_, i) => `${toX(i).toFixed(1)},${toY(series[i].value).toFixed(1)}`).join(' ')

  // Show quarter labels every 4th point when enough data
  const showLabels = series.length >= 6
  const labelIndices = showLabels
    ? series.reduce((acc: number[], p, i) => {
        if (i === 0 || i === series.length - 1 || (i % 4 === 0)) acc.push(i)
        return acc
      }, [])
    : []

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {/* Polyline connecting data points */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />

      {/* Data point dots */}
      {series.map((p, i) => {
        const cx = toX(i)
        const cy = toY(p.value)
        const isCurr = p.label === 'curr'
        return (
          <circle
            key={i}
            cx={cx} cy={cy}
            r={isCurr ? 3.5 : 2}
            fill={isCurr ? color : color}
            opacity={isCurr ? 1 : 0.5}
          />
        )
      })}

      {/* Amber reference line at user's input value */}
      <line
        x1={0} y1={refY} x2={W} y2={refY}
        stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3"
      />
      {/* Overflow indicator when inputVal is outside series range */}
      {inputAbove && (
        <text x={W - 4} y={MT + 6} fontSize="8" fill="#f59e0b" textAnchor="end">▲</text>
      )}
      {inputBelow && (
        <text x={W - 4} y={H - MB - 2} fontSize="8" fill="#f59e0b" textAnchor="end">▼</text>
      )}

      {/* X-axis quarter labels */}
      {labelIndices.map(i => {
        const p = series[i]
        if (p.label === 'curr') return null
        return (
          <text
            key={i}
            x={toX(i)}
            y={H - 2}
            fontSize="7"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {p.label}
          </text>
        )
      })}
    </svg>
  )
}

// ─── FieldStepper ─────────────────────────────────────────────────────────────

function FieldStepper({
  label, value, unit, step, min, max, onChange, hint, color,
}: {
  label: string; value: number; unit: '%' | 'x'
  step: number; min: number; max: number
  onChange: (v: number) => void
  hint?: string | null; color: string
}) {
  const dec = () => onChange(Math.max(min, parseFloat((value - step).toFixed(6))))
  const inc = () => onChange(Math.min(max, parseFloat((value + step).toFixed(6))))

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 leading-none">{label}</p>
        {hint && <p className="text-[9px] text-slate-400 mt-0.5 tabular-nums">{hint}</p>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={dec}
          aria-label={`Decrease ${label}`}
          className="w-9 h-9 flex items-center justify-center rounded-full"
        >
          <span className="w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[13px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors select-none">
            −
          </span>
        </button>
        <span
          className="text-[13px] font-[750] tabular-nums text-slate-800 w-[52px] text-center"
          style={{ color: value !== min ? color : undefined }}
        >
          {fmt(value, unit)}
        </span>
        <button
          onClick={inc}
          aria-label={`Increase ${label}`}
          className="w-9 h-9 flex items-center justify-center rounded-full"
        >
          <span className="w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[13px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors select-none">
            +
          </span>
        </button>
      </div>
    </div>
  )
}

// ─── SharedCAGRPanel ──────────────────────────────────────────────────────────

function SharedCAGRPanel({
  value, step = 0.005, min = -0.05, max = 0.60,
  onChange, historicalSeries, color = '#8b5cf6',
}: {
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (v: number) => void
  historicalSeries?: SparkPoint[]
  color?: string
}) {
  const hint = historicalHint(historicalSeries, '%')
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-5 py-3 mb-3 flex items-center gap-6">
      <div className="shrink-0">
        <p className="text-[11px] font-[650] text-slate-600 mb-0.5">Revenue CAGR</p>
        <p className="text-[10px] text-slate-400 mb-2">Shared by Forward P/E and Revenue Multiple</p>
        <FieldStepper
          label="5Y growth rate"
          value={value}
          unit="%"
          step={step}
          min={min}
          max={max}
          onChange={onChange}
          hint={hint}
          color={color}
        />
      </div>
      {historicalSeries && historicalSeries.length >= 2 && (
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-slate-400 mb-1">Historical Revenue CAGR</p>
          <div style={{ maxWidth: '280px' }}>
            <MiniLineChart
              series={historicalSeries.slice(-8)}
              inputVal={value}
              color={color}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DCF driver display (read-only) ───────────────────────────────────────────

function DcfDriverRow({
  fcfMargin, ttmEbitdaDollars,
}: { fcfMargin?: number | null; ttmEbitdaDollars?: number | null }) {
  return (
    <div className="space-y-1.5">
      {fcfMargin != null && fcfMargin > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">FCF margin (TTM)</span>
          <span className="text-[11px] font-[650] text-emerald-700 tabular-nums">
            {(fcfMargin * 100).toFixed(1)}%
          </span>
        </div>
      )}
      {ttmEbitdaDollars != null && ttmEbitdaDollars > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">TTM EBITDA</span>
          <span className="text-[11px] font-[650] text-slate-700 tabular-nums">
            {ttmEbitdaDollars >= 1e9
              ? `$${(ttmEbitdaDollars / 1e9).toFixed(1)}B`
              : `$${(ttmEbitdaDollars / 1e6).toFixed(0)}M`
            }
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationMethodCards({
  methods, currentPrice: _currentPrice, currency,
  fcfMargin, ttmEbitdaDollars,
  assumptions, historicalData,
  onChange, onReset, onUndo, canUndo,
  sensitivity: _sensitivity, sectorBenchmarks: _sectorBenchmarks,
  onScrollToFullDCF,
}: Props) {
  const validTotal = methods
    .filter(m => m.fairValue != null && m.fairValue > 0)
    .reduce((s, m) => s + m.weight, 0)

  function change(key: keyof ValuationAssumptions, val: number) {
    onChange({ ...assumptions, [key]: val })
  }

  const showCAGRPanel = methods.some(m =>
    (m.id === 'forward_pe' || m.id === 'revenue_multiple') && m.fairValue != null && m.fairValue > 0
  )

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Valuation Models</p>
          <p className="text-xs text-slate-400">Edit each model&apos;s key inputs directly — fair values update live</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              aria-label="Undo last change"
            >
              <Undo2 size={11} />
              Undo
            </button>
          )}
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            aria-label="Reset to defaults"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
      </div>

      {/* Shared CAGR panel */}
      {showCAGRPanel && (
        <SharedCAGRPanel
          value={assumptions.cagr}
          onChange={v => change('cagr', v)}
          historicalSeries={historicalData?.cagr}
        />
      )}

      {/* Cards grid */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0">
        {methods.map(m => {
          const cfg    = METHOD_CFG[m.id]
          const fields = METHOD_INPUTS[m.id] ?? []
          const hasValue = m.fairValue != null && m.fairValue > 0
          const conf   = hasValue ? CONFIDENCE_CHIP[m.confidence] : null
          const effectivePct = hasValue && validTotal > 0
            ? Math.round((m.weight / validTotal) * 100) : 0
          const upColor = m.upsidePct != null
            ? (m.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')
            : 'text-slate-400'
          const isCoreDCF = m.id === 'core_dcf'

          return (
            <div
              key={m.id}
              className={`rounded-xl border flex flex-col p-4 gap-3 min-w-[240px] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink ${
                hasValue ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {cfg && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                      <cfg.Icon size={13} className={cfg.iconText} />
                    </div>
                  )}
                  <span className={`text-sm font-bold ${hasValue ? 'text-slate-800' : 'text-slate-400'}`}>
                    {m.method}
                  </span>
                </div>
                {conf ? (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${conf.bg} ${conf.text}`}>
                    {conf.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-slate-100 border-slate-200 text-slate-400">
                    Unavailable
                    <InfoTooltip content={m.errors[0] ?? 'Insufficient data to compute this model.'} />
                  </span>
                )}
              </div>

              {/* Fair value */}
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">Fair Value</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
                    {m.fairValue != null ? fmtPrice(m.fairValue, currency) : '—'}
                  </span>
                  {m.upsidePct != null && (
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-semibold tabular-nums leading-tight ${upColor}`}>
                        {m.upsidePct >= 0 ? '+' : ''}{(m.upsidePct * 100).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight">vs current price</span>
                    </div>
                  )}
                  {!hasValue && <span className="text-sm text-slate-400">N/A</span>}
                </div>
              </div>

              {/* Unavailable: consistent-height placeholder */}
              {!hasValue && (
                <div className="flex-1 min-h-[80px] flex flex-col items-center justify-center gap-1.5">
                  <svg className="w-5 h-5 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                  </svg>
                  <p className="text-[11px] text-slate-400 italic text-center leading-snug px-2">
                    {m.errors[0] ?? 'Insufficient data. Excluded from the blend.'}
                  </p>
                </div>
              )}

              {/* Inputs — editable method cards */}
              {hasValue && !isCoreDCF && fields.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <p className="text-[10px] font-[600] text-slate-400 mb-2">Assumptions</p>
                  {fields.map(f => {
                    const hist = historicalData?.[f.chartKey ?? f.key]
                    const hint = historicalHint(hist, f.unit)
                    const fValue = assumptions[f.key] as number ?? (f.unit === '%' ? 0 : 1)
                    return (
                      <FieldStepper
                        key={String(f.key)}
                        label={f.label}
                        value={fValue}
                        unit={f.unit}
                        step={f.step}
                        min={f.min}
                        max={f.max}
                        onChange={v => change(f.key, v)}
                        hint={hint}
                        color={cfg?.chartHex ?? '#64748b'}
                      />
                    )
                  })}

                  {/* Historical line chart for primary field */}
                  {(() => {
                    const primaryField = fields[0]
                    const hist = primaryField ? historicalData?.[primaryField.chartKey ?? primaryField.key] : undefined
                    if (!hist || hist.length < 2) return null
                    const fValue = assumptions[primaryField.key] as number ?? (primaryField.unit === '%' ? 0 : 1)
                    return (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-[9px] text-slate-400 mb-1">
                          Historical {fields[0].label}
                        </p>
                        <MiniLineChart
                          series={hist}
                          inputVal={fValue}
                          color={cfg?.chartHex ?? '#64748b'}
                        />
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Core DCF card — link to full model */}
              {isCoreDCF && hasValue && (
                <div className="pt-1 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Uses WACC, CAGR, terminal growth, and net margin. Edit these in the Full DCF Model below.
                  </p>
                  <DcfDriverRow fcfMargin={fcfMargin} ttmEbitdaDollars={ttmEbitdaDollars} />
                  <button
                    onClick={onScrollToFullDCF}
                    className="w-full text-[11px] font-[650] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-2 hover:bg-emerald-100 transition-colors"
                  >
                    Edit assumptions in Full DCF ↓
                  </button>
                </div>
              )}

              {/* Spacer pushes blend weight to bottom in all cards */}
              {hasValue && <div className="flex-1" />}

              {/* Blend weight bar */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-slate-400">Effective Blend Weight</span>
                  <span className={`text-[11px] font-bold tabular-nums ${
                    hasValue ? (cfg?.valueText ?? 'text-slate-600') : 'text-slate-300'
                  }`}>
                    {effectivePct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cfg?.barBg ?? 'bg-slate-300'}`}
                    style={{ width: `${effectivePct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer notes */}
      <div className="mt-4 space-y-1.5">
        {methods.some(m => m.fairValue == null || m.fairValue <= 0) && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
            </svg>
            Unavailable models are excluded from the blend. Remaining weights are redistributed proportionally.
          </p>
        )}
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
          </svg>
          Weights reflect our conviction in each model&apos;s reliability given current data quality and market context.
        </p>
      </div>
    </div>
  )
}
