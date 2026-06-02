'use client'

import { TrendingUp, BarChart2, BarChart, Target, RotateCcw, Undo2, BookOpen } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  ReferenceLine, Tooltip,
} from 'recharts'
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

// ─── TinyLineChart ────────────────────────────────────────────────────────────

function TinyLineChart({
  data, title, color, refValue, yFormat,
}: {
  data: SparkPoint[]
  title: string
  color: string
  refValue?: number
  yFormat: (v: number) => string
}) {
  const chartData = data.filter(p => p.label !== 'curr')

  if (chartData.length < 2) return (
    <div className="flex flex-col">
      <p className="text-[10px] font-[600] text-slate-500 mb-2">{title}</p>
      <div className="flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100" style={{ height: 120 }}>
        <p className="text-[10px] text-slate-300">No data</p>
      </div>
    </div>
  )

  // For quarterly data (12 points), show one tick per year; for annual (≤6), show all
  const yearFromLabel = (label: string) => {
    const m = label.match(/'(\d{2})/)
    return m ? `20${m[1]}` : label
  }
  const tickSet = new Set<string>()
  const filteredTicks = chartData
    .map(p => p.label)
    .filter(label => {
      const yr = yearFromLabel(label)
      if (tickSet.has(yr)) return false
      tickSet.add(yr)
      return true
    })

  return (
    <div className="flex flex-col">
      <p className="text-[10px] font-[600] text-slate-500 mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            ticks={filteredTicks}
            tickFormatter={yearFromLabel}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormat}
            width={40}
            tickCount={4}
          />
          <Tooltip
            cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
            contentStyle={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            itemStyle={{ color: '#374151', padding: 0 }}
            labelStyle={{ color: '#94a3b8', fontSize: 10, marginBottom: 2 }}
            formatter={(v) => [typeof v === 'number' ? yFormat(v) : '—', '']}
          />
          {refValue != null && (
            <ReferenceLine
              y={refValue}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
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
  onChange, cagrSeries, peSeries, evRevSeries,
  peAssumption, evRevAssumption,
  color = '#8b5cf6',
}: {
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (v: number) => void
  cagrSeries?: SparkPoint[]
  peSeries?: SparkPoint[]
  evRevSeries?: SparkPoint[]
  peAssumption?: number
  evRevAssumption?: number
  color?: string
}) {
  const hint = historicalHint(cagrSeries, '%')
  const hasAnySeries = (cagrSeries?.length ?? 0) > 0 || (peSeries?.length ?? 0) > 0 || (evRevSeries?.length ?? 0) > 0

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-5 py-4 mb-3">

      {/* Top row: label + stepper */}
      <div className="flex items-center justify-between gap-6 mb-4">
        <div>
          <p className="text-[12px] font-[650] text-slate-700">Revenue CAGR</p>
          <p className="text-[11px] text-slate-400">Shared by Forward P/E and Revenue Multiple</p>
        </div>
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

      {/* Charts row — full panel width */}
      {hasAnySeries && (
        <div className="grid grid-cols-3 gap-5">
          <TinyLineChart
            data={cagrSeries ?? []}
            title="Revenue growth % / yr"
            color={color}
            refValue={value}
            yFormat={v => `${(v * 100).toFixed(0)}%`}
          />
          <TinyLineChart
            data={peSeries ?? []}
            title="Historical P/E ratio"
            color="#3b82f6"
            refValue={peAssumption}
            yFormat={v => `${v.toFixed(0)}x`}
          />
          <TinyLineChart
            data={evRevSeries ?? []}
            title="Historical EV / Revenue"
            color="#a855f7"
            refValue={evRevAssumption}
            yFormat={v => `${v.toFixed(1)}x`}
          />
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
          cagrSeries={historicalData?.cagr}
          peSeries={historicalData?.exitPE}
          evRevSeries={historicalData?.revenueMultiple}
          peAssumption={assumptions.exitPE}
          evRevAssumption={assumptions.revenueMultiple}
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-[600] text-slate-400">Assumptions</p>
                    {fields.some(f => ['exitPE', 'exitMultiple', 'revenueMultiple', 'priceToBookMultiple'].includes(String(f.key))) && (
                      <span className="text-[9px] text-slate-300">Damodaran Jan 2025</span>
                    )}
                  </div>
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
