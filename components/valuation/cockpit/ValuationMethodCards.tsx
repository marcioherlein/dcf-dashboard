'use client'

import { TrendingUp, BarChart2, BarChart, Target, RotateCcw, Undo2, BookOpen, Building2, Coins, Sigma } from 'lucide-react'
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
  fcfMarginSeries?: SparkPoint[]
  blendedFairValue?: number | null
  upsidePct?: number | null
  // Ratio context for historical + NTM display inside each method card
  analystForwardPE?: number | null
  ntmEVRevenue?: number | null
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

export const METHOD_INPUTS: Record<string, FieldDef[]> = {
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
  p_ffo: [
    { key: 'exitPFFOMultiple', label: 'P/FFO multiple', unit: 'x', step: 0.5, min: 8, max: 30, chartKey: 'exitPFFOMultiple' },
  ],
  ddm: [],
  core_dcf: [],
  // EPV has no user-adjustable inputs — fully deterministic from WACC + operating income
  epv: [],
}

// ─── Visual config per method ─────────────────────────────────────────────────

export const METHOD_CFG: Record<string, {
  iconBg: string; iconText: string
  barBg: string; valueBg: string; valueText: string
  chartHex: string
  Icon: IconComp
}> = {
  // Forward P/E — blue (secondary/informational)
  forward_pe: {
    iconBg: 'bg-[#EAF1FF]', iconText: 'text-[#2563EB]',
    barBg: 'bg-[#2563EB]', valueBg: 'bg-[#F4F7FF]', valueText: 'text-[#2563EB]',
    chartHex: '#2563EB',
    Icon: TrendingUp as IconComp,
  },
  // EV/EBITDA — ink-tinted olive
  ev_ebitda: {
    iconBg: 'bg-[#EEF4DD]', iconText: 'text-[#5F790B]',
    barBg: 'bg-[#6F8F12]', valueBg: 'bg-[#F6FAEA]', valueText: 'text-[#5F790B]',
    chartHex: '#6F8F12',
    Icon: BarChart2 as IconComp,
  },
  // Revenue multiple — neutral blue
  revenue_multiple: {
    iconBg: 'bg-[#EAF1FF]', iconText: 'text-[#2563EB]',
    barBg: 'bg-[#2563EB]', valueBg: 'bg-[#F4F7FF]', valueText: 'text-[#1D4ED8]',
    chartHex: '#1D4ED8',
    Icon: BarChart as IconComp,
  },
  // Price-to-book — warm amber (distinct from olive)
  price_to_book: {
    iconBg: 'bg-[#FFF4DA]', iconText: 'text-[#B56A00]',
    barBg: 'bg-[#B56A00]', valueBg: 'bg-[#FFF4DA]', valueText: 'text-[#B56A00]',
    chartHex: '#B56A00',
    Icon: BookOpen as IconComp,
  },
  // P/FFO — warm amber/orange
  p_ffo: {
    iconBg: 'bg-[#FFF4DA]', iconText: 'text-[#B56A00]',
    barBg: 'bg-[#B56A00]', valueBg: 'bg-[#FFF4DA]', valueText: 'text-[#B56A00]',
    chartHex: '#B56A00',
    Icon: Building2 as IconComp,
  },
  // DDM — positive green
  ddm: {
    iconBg: 'bg-[#E8F7EF]', iconText: 'text-[#11875D]',
    barBg: 'bg-[#11875D]', valueBg: 'bg-[#E8F7EF]', valueText: 'text-[#11875D]',
    chartHex: '#11875D',
    Icon: Coins as IconComp,
  },
  // Earnings Power Value — deep indigo (semantically distinct from all other methods)
  epv: {
    iconBg: 'bg-[#EDE9FE]', iconText: 'text-[#6D28D9]',
    barBg: 'bg-[#6D28D9]', valueBg: 'bg-[#F5F3FF]', valueText: 'text-[#6D28D9]',
    chartHex: '#6D28D9',
    Icon: Sigma as IconComp,
  },
  // Core DCF — olive (brand primary, most trusted model)
  core_dcf: {
    iconBg: 'bg-[#EEF4DD]', iconText: 'text-[#5F790B]',
    barBg: 'bg-[#5F790B]', valueBg: 'bg-[#F6FAEA]', valueText: 'text-[#5F790B]',
    chartHex: '#5F790B',
    Icon: Target as IconComp,
  },
}

export const CONFIDENCE_CHIP = {
  high:   { bg: 'bg-[#E8F7EF] border-[#A7D7C0]', text: 'text-[#11875D]', label: 'High confidence'   },
  medium: { bg: 'bg-[#FFF4DA] border-[#F3D391]', text: 'text-[#B56A00]', label: 'Medium confidence' },
  low:    { bg: 'bg-[#FFF4DA] border-[#F3D391]', text: 'text-[#B56A00]', label: 'Low confidence'    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmt(value: number, unit: '%' | 'x'): string {
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

export function TinyLineChart({
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
    <div className="flex flex-col" role="img" aria-label={`${title}: no data`}>
      <p className="text-[10px] font-[600] text-[#6B6B6B] mb-2">{title}</p>
      <div className="flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E5E5E5]" style={{ height: 120 }}>
        <p className="text-[10px] text-[#9B9B9B]">No data</p>
      </div>
    </div>
  )

  // Compute Y-axis width from longest formatted tick so values never clip
  const allVals = chartData.map(p => p.value)
  const [yMin, yMax] = [Math.min(...allVals), Math.max(...allVals)]
  const longestTick = [yMin, yMax].map(v => yFormat(v)).reduce((a, b) => a.length >= b.length ? a : b, '')
  const yWidth = Math.max(32, longestTick.length * 6.5 + 4)

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
    <div className="flex flex-col" role="img" aria-label={title}>
      <p className="text-[10px] font-[600] text-[#6B6B6B] mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#8A95A6' }}
            tickLine={false}
            axisLine={false}
            ticks={filteredTicks}
            tickFormatter={yearFromLabel}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8A95A6' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormat}
            width={yWidth}
            tickCount={4}
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ stroke: '#E3E1DA', strokeWidth: 1 }}
            contentStyle={{
              background: 'white',
              border: '1px solid #E3E1DA',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            itemStyle={{ color: '#374151', padding: 0 }}
            labelStyle={{ color: '#8A95A6', fontSize: 10, marginBottom: 2 }}
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
            isAnimationActive={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── FieldStepper ─────────────────────────────────────────────────────────────

export function FieldStepper({
  label, value, unit, step, min, max, onChange, hint, color,
}: {
  label: string; value: number; unit: '%' | 'x'
  step: number; min: number; max: number
  onChange: (v: number) => void
  hint?: string | null; color: string
}) {
  const atMin = value <= min
  const atMax = value >= max
  const dec = () => { if (!atMin) onChange(Math.max(min, parseFloat((value - step).toFixed(6)))) }
  const inc = () => { if (!atMax) onChange(Math.min(max, parseFloat((value + step).toFixed(6)))) }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] text-[#6B6B6B] leading-none">{label}</p>
        {hint && <p className="text-[11px] text-[#9B9B9B] mt-0.5 tabular-nums">{hint}</p>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={dec}
          disabled={atMin}
          aria-label={`Decrease ${label}`}
          className="w-11 h-11 flex items-center justify-center rounded-full disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1"
        >
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[13px] font-bold shadow-sm select-none transition-colors ${
            atMin
              ? 'border-[#E5E5E5] bg-[#F5F5F5] text-[#9B9B9B]'
              : 'border-[#E5E5E5] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]'
          }`}>
            −
          </span>
        </button>
        <span
          className="text-[13px] font-[750] tabular-nums text-[#111111] w-[52px] text-center"
          style={{ color: value !== min ? color : undefined }}
        >
          {fmt(value, unit)}
        </span>
        <button
          onClick={inc}
          disabled={atMax}
          aria-label={`Increase ${label}`}
          className="w-11 h-11 flex items-center justify-center rounded-full disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1"
        >
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[13px] font-bold shadow-sm select-none transition-colors ${
            atMax
              ? 'border-[#E5E5E5] bg-[#F5F5F5] text-[#9B9B9B]'
              : 'border-[#E5E5E5] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]'
          }`}>
            +
          </span>
        </button>
      </div>
    </div>
  )
}

// ─── SharedCAGRPanel ──────────────────────────────────────────────────────────
// Only the CAGR stepper — charts live exclusively in KeyAssumptionsSection below.

export function SharedCAGRPanel({
  value, step = 0.005, min = -0.05, max = 0.60,
  onChange, cagrSeries,
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

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-5 py-3.5 mb-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-[650] text-[#111111]">Revenue CAGR</p>
          <p className="text-[11px] text-[#9B9B9B]">Shared by Forward P/E and Revenue Multiple</p>
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
          <span className="text-[10px] text-[#6B6B6B]">FCF margin (TTM)</span>
          <span className="text-[11px] font-[650] text-[#11875D] tabular-nums">
            {(fcfMargin * 100).toFixed(1)}%
          </span>
        </div>
      )}
      {ttmEbitdaDollars != null && ttmEbitdaDollars > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6B6B6B]">TTM EBITDA</span>
          <span className="text-[11px] font-[650] text-[#111111] tabular-nums">
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

// ─── SynthesisBox ─────────────────────────────────────────────────────────────
// The "Blended Fair Value (Synthesis)" header box. Shows blended FV, upside,
// WACC, model count, and a legend of method weights. Arrows drop from here
// down to the method cards below.

function SynthesisBox({
  blendedFairValue, upsidePct, currency, wacc, methods, validTotal,
}: {
  blendedFairValue: number | null
  upsidePct: number | null
  currency: string
  wacc: number
  methods: CockpitMethodResult[]
  validTotal: number
}) {
  const upColor = upsidePct != null
    ? (upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')
    : 'text-[#9B9B9B]'
  const validMethods = methods.filter(m => m.fairValue != null && m.fairValue > 0)

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">

        {/* Left: blended FV */}
        <div className="shrink-0">
          <p className="text-[10px] font-[700] uppercase tracking-widest text-[#9B9B9B] mb-1">
            Blended Fair Value <span className="normal-case font-[500] tracking-normal text-[#9B9B9B]">(Synthesis)</span>
          </p>
          <p
            className="text-[2rem] font-[800] leading-none tabular-nums text-[#111111]"
            aria-label={blendedFairValue != null ? `Blended fair value: ${fmtPrice(blendedFairValue, currency)} per share` : 'Blended fair value unavailable'}
          >
            {blendedFairValue != null ? fmtPrice(blendedFairValue, currency) : '—'}
          </p>
          <p className="text-[11px] text-[#9B9B9B] mt-0.5">Per share</p>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-[#E5E5E5] self-stretch mx-2" />

        {/* Center: description + stats */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#6B6B6B] leading-snug mb-3">
            {blendedFairValue == null || validMethods.length === 0
              ? 'Insufficient data to compute fair value.'
              : `Weighted average of ${validMethods.length} independent model${validMethods.length !== 1 ? 's' : ''}. Weights reflect model reliability, data quality, and market context.`
            }
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-[10px] text-[#9B9B9B] mb-0.5">Implied Return</p>
              <p className={`text-[16px] font-[750] tabular-nums ${upColor}`}>
                {upsidePct != null ? `${upsidePct >= 0 ? '+' : ''}${(upsidePct * 100).toFixed(1)}%` : '—'}
              </p>
              <p className="text-[10px] text-[#9B9B9B]">vs current price</p>
            </div>
            <div className="w-px h-10 bg-[#E5E5E5] hidden sm:block" />
            <div>
              <p className="text-[10px] text-[#9B9B9B] mb-0.5">WACC</p>
              <p className="text-[16px] font-[750] tabular-nums text-[#111111]">
                {(wacc * 100).toFixed(1)}%
              </p>
              <p className="text-[10px] text-[#9B9B9B]">Discount rate</p>
            </div>
          </div>
        </div>

        {/* Right: weight legend pills */}
        {validMethods.length > 0 && (
          <div className="flex flex-row flex-wrap gap-1 sm:flex-col sm:flex-nowrap sm:min-w-[140px] mt-1 sm:mt-0">
            {validMethods.map(m => {
              const cfg = METHOD_CFG[m.id]
              const pct = validTotal > 0 ? Math.round((m.weight / validTotal) * 100) : 0
              return (
                <div key={m.id} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cfg?.chartHex ?? '#9B9B9B' }}
                  />
                  <span className="text-[10px] sm:text-[11px] text-[#6B6B6B] truncate max-w-[80px] sm:max-w-none flex-1">{m.method}</span>
                  <span className="text-[10px] sm:text-[11px] font-[650] tabular-nums text-[#111111]">{pct}%</span>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── RatioHistoryRow ─────────────────────────────────────────────────────────
// Compact "FY22 28× · FY23 24× · TTM 21× · NTM 19×" strip shown inside method
// cards for P/E, EV/EBITDA, EV/Revenue, and P/Book to give instant trend context.

interface _RatioPoint { label: string; value: number }

function RatioHistoryRow({
  series, ntm, unit = 'x', color: _color,
}: {
  series?: SparkPoint[]       // from historicalData — includes 'curr' as last point
  ntm?: number | null         // next twelve months estimate (analyst)
  unit?: 'x' | '%'
  color: string
}) {
  if (!series || series.length < 2) return null

  // Extract up to 2 historical FY points (exclude 'curr') + TTM ('curr')
  const historical = series.filter(p => p.label !== 'curr').slice(-2)
  const ttm = series.find(p => p.label === 'curr')

  const points: Array<_RatioPoint & { isNTM?: boolean; isTTM?: boolean }> = [
    ...historical.map(p => ({ label: p.label, value: p.value })),
    ...(ttm ? [{ label: 'TTM', value: ttm.value, isTTM: true }] : []),
    ...(ntm != null ? [{ label: 'NTM', value: ntm, isNTM: true }] : []),
  ]

  if (points.length < 2) return null

  const fmtRatio = (v: number) =>
    unit === '%' ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(1)}×`

  // Trend arrow: compare last two points
  const last = points[points.length - 1].value
  const prev = points[points.length - 2].value
  const trend = last < prev - 0.3 ? 'down' : last > prev + 0.3 ? 'up' : 'flat'

  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#F5F5F5]">
      <span className="text-[10px] font-[600] text-[#9B9B9B] shrink-0">Ratio trend</span>
      <div className="flex items-center gap-1 flex-wrap">
        {points.map((p, _i) => (
          <span
            key={p.label}
            className={`inline-flex items-center gap-0.5 text-[10px] tabular-nums font-[600] px-1.5 py-0.5 rounded-md ${
              p.isNTM
                ? 'bg-[#EAF1FF] text-[#2563EB]'
                : p.isTTM
                ? 'bg-[#FAFAFA] text-[#06101F]'
                : 'text-[#9B9B9B]'
            }`}
          >
            <span className="text-[9px] font-[500] mr-0.5 opacity-60">{p.label}</span>
            {fmtRatio(p.value)}
            {p.isNTM && (
              <span className="text-[9px] ml-0.5 opacity-70">est</span>
            )}
          </span>
        ))}
        {trend !== 'flat' && (
          <span
            className={`text-[11px] font-[700] ${trend === 'down' ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
            title={trend === 'down' ? 'Multiple compressing (cheaper)' : 'Multiple expanding (more expensive)'}
          >
            {trend === 'down' ? '↓' : '↑'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── ArrowConnectors ─────────────────────────────────────────────────────────
// SVG bus-and-arrowhead connectors from synthesis box to method cards.
// Only rendered on xl+ where the grid is guaranteed to be 4-col.

function ArrowConnectors({ count, breakpoint }: { count: number; breakpoint: string }) {
  if (count === 0) return null
  const COLOR = '#BFD2A1'

  return (
    <div className={`relative ${breakpoint}`} style={{ height: 40 }} aria-hidden="true">
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {/* Vertical drop from center of synthesis box */}
        <line x1="500" y1="0" x2="500" y2="16" stroke={COLOR} strokeWidth="2" />
        {/* Horizontal bus across all card centers */}
        {count > 1 && (
          <line
            x1={((0 + 0.5) / count) * 1000}
            y1="16"
            x2={((count - 1 + 0.5) / count) * 1000}
            y2="16"
            stroke={COLOR}
            strokeWidth="2"
          />
        )}
        {/* Per-card vertical drops + arrowheads */}
        {Array.from({ length: count }, (_, i) => {
          const x = ((i + 0.5) / count) * 1000
          return (
            <g key={i}>
              <line x1={x} y1="16" x2={x} y2="30" stroke={COLOR} strokeWidth="2" />
              <polygon points={`${x},40 ${x - 6},28 ${x + 6},28`} fill={COLOR} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── KeyAssumptionsSection ────────────────────────────────────────────────────
// The 4-chart "Historical Trends" section rendered BELOW the method cards grid.

function KeyAssumptionsSection({
  historicalData,
  fcfMarginSeries,
  assumptions,
}: {
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
  fcfMarginSeries?: SparkPoint[]
  assumptions: ValuationAssumptions
}) {
  const peSeries    = historicalData?.exitPE ?? []
  const cagrSeries  = historicalData?.cagr ?? []
  const evRevSeries = historicalData?.revenueMultiple ?? []
  const fcfSeries   = fcfMarginSeries ?? []

  const hasAny = peSeries.length > 0 || cagrSeries.length > 0 || evRevSeries.length > 0 || fcfSeries.length > 0
  if (!hasAny) return null

  return (
    <div className="mt-5 rounded-xl border border-[#E5E5E5] bg-[#FAFAF8] px-5 py-4">
      {/* Section header */}
      <div className="mb-4">
        <p className="text-[10px] font-[700] tracking-widest uppercase text-[#9B9B9B]">Historical Trends / Key Assumptions</p>
        <p className="text-[11px] text-[#9B9B9B] mt-0.5">
          Dashed line shows your current assumption.
        </p>
      </div>

      {/* 4-chart grid: 2-col mobile, 4-col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TinyLineChart
          data={peSeries}
          title="Historical P/E ratio"
          color="#2563EB"
          refValue={assumptions.exitPE}
          yFormat={v => `${v.toFixed(0)}x`}
        />
        <TinyLineChart
          data={cagrSeries}
          title="Revenue growth % / yr"
          color="#5F790B"
          refValue={assumptions.cagr}
          yFormat={v => `${(v * 100).toFixed(0)}%`}
        />
        <TinyLineChart
          data={evRevSeries}
          title="EV / Revenue multiple"
          color="#a855f7"
          refValue={assumptions.revenueMultiple}
          yFormat={v => `${v.toFixed(1)}x`}
        />
        <TinyLineChart
          data={fcfSeries}
          title="FCF margin (TTM)"
          color="#11875D"
          yFormat={v => `${(v * 100).toFixed(1)}%`}
        />
      </div>
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
  fcfMarginSeries,
  blendedFairValue,
  upsidePct,
  analystForwardPE,
  ntmEVRevenue,
}: Props) {
  const validTotal = methods
    .filter(m => m.fairValue != null && m.fairValue > 0)
    .reduce((s, m) => s + m.weight, 0)

  // Only show cards that have a computable fair value
  const visibleMethods = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  const visibleCount = visibleMethods.length

  function change(key: keyof ValuationAssumptions, val: number) {
    onChange({ ...assumptions, [key]: val })
  }

  const showCAGRPanel = visibleMethods.some(m =>
    (m.id === 'forward_pe' || m.id === 'revenue_multiple')
  )

  // Dynamic grid cols: mobile always uses horizontal snap scroll (flex overflow-x-auto)
  // Desktop breakpoints kick in at sm(640px) and above
  const gridCols = visibleCount >= 5
    ? 'sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
    : visibleCount === 4
    ? 'sm:grid-cols-2 lg:grid-cols-4'
    : visibleCount === 3
    ? 'sm:grid-cols-2 md:grid-cols-3'
    : 'sm:grid-cols-2'

  // ArrowConnectors only render when grid columns match card count exactly
  // 5 cards → xl (1280px+), 4 cards → lg (1024px+), 3 → md (768px+)
  const arrowBreakpoint = visibleCount >= 5
    ? 'hidden xl:block'
    : visibleCount === 4
    ? 'hidden lg:block'
    : 'hidden md:block'

  return (
    <div
      className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm px-5 py-5"
      role="region"
      aria-label="Valuation models"
    >

      {/* ── Synthesis header box ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <SynthesisBox
            blendedFairValue={blendedFairValue ?? null}
            upsidePct={upsidePct ?? null}
            currency={currency}
            wacc={assumptions.wacc}
            methods={methods}
            validTotal={validTotal}
          />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-[#111111] px-2.5 py-2 min-h-[36px] rounded-lg border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors"
              aria-label="Undo last change"
            >
              <Undo2 size={11} />
              Undo
            </button>
          )}
          {canUndo && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-[#111111] px-2.5 py-2 min-h-[36px] rounded-lg border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors"
              aria-label="Reset to defaults"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Shared CAGR stepper (no charts — charts are in Key Assumptions below) */}
      {showCAGRPanel && (
        <div className="mt-3">
          <SharedCAGRPanel
            value={assumptions.cagr}
            onChange={v => change('cagr', v)}
            cagrSeries={historicalData?.cagr}
          />
        </div>
      )}

      {/* ── Arrow connector row → method cards (desktop xl only) ───────────── */}
      <ArrowConnectors count={visibleCount} breakpoint={arrowBreakpoint} />

      {/* ── Cards grid ─────────────────────────────────────────────────────── */}
      <div className={`flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:grid sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0 ${gridCols}`}>
        {visibleMethods.map((m, idx) => {
          const cfg    = METHOD_CFG[m.id]
          const fields = METHOD_INPUTS[m.id] ?? []
          const hasValue = m.fairValue != null && m.fairValue > 0
          const conf   = hasValue ? CONFIDENCE_CHIP[m.confidence] : null
          const effectivePct = hasValue && validTotal > 0
            ? Math.round((m.weight / validTotal) * 100) : 0
          const upColor = m.upsidePct != null
            ? (m.upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')
            : 'text-[#9B9B9B]'
          const isCoreDCF = m.id === 'core_dcf'
          const isEPV = m.id === 'epv'
          const epvMeta = isEPV ? m.meta : null

          // primaryField kept for assumptions stepper hint lookup
          const _primaryField = fields[0]

          return (
            <div
              key={m.id}
              className={`relative rounded-xl border flex flex-col min-w-[240px] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink overflow-hidden ${
                hasValue ? 'border-[#E5E5E5] bg-white' : 'border-[#E5E5E5] bg-[#F5F5F5]/50'
              }`}
              role="article"
              aria-label={`${m.method} valuation model`}
            >
              {/* Colored top accent bar */}
              {cfg && (
                <div
                  className="h-[3px] w-full shrink-0"
                  style={{ backgroundColor: cfg.chartHex }}
                />
              )}

              {/* Mobile numbered badge */}
              <span className="sm:hidden absolute top-3 right-3 w-5 h-5 rounded-full bg-[#5F790B] text-white text-[9px] font-[800] flex items-center justify-center z-10 pointer-events-none">
                {idx + 1}
              </span>

              <div className="flex flex-col p-4 gap-3 flex-1">

                {/* Card header: icon + name + confidence */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {cfg && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                        <cfg.Icon size={13} className={cfg.iconText} />
                      </div>
                    )}
                    <span className={`text-sm font-bold truncate ${hasValue ? 'text-[#111111]' : 'text-[#9B9B9B]'}`}>
                      {m.method}
                    </span>
                  </div>
                  {conf ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${conf.bg} ${conf.text}`}>
                      {conf.label}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-[#F5F5F5] border-[#E5E5E5] text-[#9B9B9B]">
                      Unavailable
                      <InfoTooltip content={m.errors[0] ?? 'Insufficient data to compute this model.'} />
                    </span>
                  )}
                </div>

                {/* Fair value */}
                <div aria-live="polite" aria-atomic="true">
                  <p className="text-[10px] text-[#6B6B6B] mb-0.5">Fair Value</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-bold tabular-nums text-[#111111] leading-none">
                      {m.fairValue != null ? fmtPrice(m.fairValue, currency) : '—'}
                    </span>
                    {m.upsidePct != null && (
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-semibold tabular-nums leading-tight ${upColor}`}>
                          {m.upsidePct >= 0 ? '+' : ''}{(m.upsidePct * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-[#9B9B9B] leading-tight">vs current price</span>
                      </div>
                    )}
                    {!hasValue && <span className="text-sm text-[#9B9B9B]">N/A</span>}
                  </div>
                </div>

                {/* Unavailable: consistent-height placeholder */}
                {!hasValue && (
                  <div className="flex-1 min-h-[80px] flex flex-col items-center justify-center gap-1.5">
                    <svg className="w-5 h-5 text-[#CDD1C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                    </svg>
                    <p className="text-[11px] text-[#9B9B9B] italic text-center leading-snug px-2">
                      {m.errors[0] ?? 'Insufficient data. Excluded from the blend.'}
                    </p>
                  </div>
                )}

                {/* Ratio history context — FY-2, FY-1, TTM, NTM for relevant methods */}
                {hasValue && (m.id === 'forward_pe' || m.id === 'ev_ebitda' || m.id === 'revenue_multiple' || m.id === 'price_to_book') && (
                  <RatioHistoryRow
                    series={
                      m.id === 'forward_pe'       ? historicalData?.exitPE :
                      m.id === 'ev_ebitda'         ? historicalData?.exitMultiple :
                      m.id === 'revenue_multiple'  ? historicalData?.revenueMultiple :
                      m.id === 'price_to_book'     ? historicalData?.priceToBookMultiple :
                      undefined
                    }
                    ntm={
                      m.id === 'forward_pe'      ? analystForwardPE :
                      m.id === 'revenue_multiple' ? ntmEVRevenue :
                      undefined
                    }
                    unit="x"
                    color={cfg?.chartHex ?? '#9B9B9B'}
                  />
                )}

                {/* Inputs — editable method cards (not Core DCF, not EPV) */}
                {hasValue && !isCoreDCF && !isEPV && fields.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-[#E5E5E5]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-[600] text-[#9B9B9B]">Assumptions</p>
                      {fields.some(f => ['exitPE', 'exitMultiple', 'revenueMultiple', 'priceToBookMultiple'].includes(String(f.key))) && (
                        <span className="text-[10px] text-[#9B9B9B]">Damodaran Jan 2025</span>
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
                          color={cfg?.chartHex ?? '#566174'}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Core DCF card — link to full model */}
                {isCoreDCF && hasValue && (
                  <div className="pt-1 border-t border-[#E5E5E5] space-y-2">
                    <p className="text-[10px] text-[#6B6B6B] leading-relaxed">
                      Uses WACC, CAGR, terminal growth, and net margin. Edit these in the Full DCF Model below.
                    </p>
                    <DcfDriverRow fcfMargin={fcfMargin} ttmEbitdaDollars={ttmEbitdaDollars} />
                    <button
                      onClick={onScrollToFullDCF}
                      className="w-full text-[11px] font-[650] text-[#5F790B] bg-[#F6FAEA] border border-[#BFD2A1] rounded-lg py-2 hover:bg-[#EEF4DD] transition-colors"
                    >
                      Edit assumptions in Full DCF ↓
                    </button>
                  </div>
                )}

                {/* EPV card — read-only data display */}
                {isEPV && hasValue && (
                  <div className="pt-1 border-t border-[#E5E5E5] space-y-2.5">
                    {/* NOPAT display */}
                    {epvMeta?.effectiveNopatM != null && epvMeta.effectiveNopatM > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#6B6B6B]">
                          {epvMeta.isCyclical ? 'Normalized NOPAT' : 'NOPAT (TTM)'}
                        </span>
                        <span className="text-[11px] font-[650] text-[#111111] tabular-nums">
                          {epvMeta.effectiveNopatM >= 1000
                            ? `$${(epvMeta.effectiveNopatM / 1000).toFixed(1)}B`
                            : `$${epvMeta.effectiveNopatM.toFixed(0)}M`
                          }
                        </span>
                      </div>
                    )}
                    {/* Growth premium pill */}
                    {epvMeta?.growthPremiumPct != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#6B6B6B]">Growth premium</span>
                        <span className={`text-[11px] font-[650] tabular-nums px-2 py-0.5 rounded-full border ${
                          epvMeta.growthPremiumPct < 0.15
                            ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]'
                            : epvMeta.growthPremiumPct < 0.40
                            ? 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]'
                            : 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]'
                        }`}>
                          {(epvMeta.growthPremiumPct * 100).toFixed(0)}% of price
                        </span>
                      </div>
                    )}
                    {/* Cyclical warning */}
                    {epvMeta?.isCyclical && epvMeta.cyclicalWarning && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-[#FFF4DA] border border-[#F3D391] px-2.5 py-1.5">
                        <span className="text-[#B56A00] shrink-0 text-[11px] leading-tight mt-px">⚠</span>
                        <span className="text-[10px] text-[#B56A00] leading-tight">{epvMeta.cyclicalWarning}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-[#9B9B9B] leading-relaxed">
                      NOPAT ÷ WACC. Zero-growth floor (Greenwald). Inputs: WACC and operating income.
                    </p>
                  </div>
                )}

                {/* Spacer pushes blend weight to bottom in all cards */}
                {hasValue && <div className="flex-1" />}

                {/* Blend weight bar */}
                <div className="pt-3 border-t border-[#E5E5E5]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-[#9B9B9B]">Effective Blend Weight</span>
                    <span className={`text-[11px] font-bold tabular-nums ${
                      hasValue ? (cfg?.valueText ?? 'text-[#6B6B6B]') : 'text-[#9B9B9B]'
                    }`}>
                      {effectivePct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F5F5F5] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cfg?.barBg ?? 'bg-[#CDD1C8]'}`}
                      style={{ width: `${effectivePct}%` }}
                    />
                  </div>
                </div>

                {/* View details button — Core DCF scrolls to full model; others are a no-op placeholder */}
                {hasValue && isCoreDCF && (
                  <button
                    onClick={onScrollToFullDCF}
                    className="mt-1 text-[11px] font-[650] text-[#5F790B] hover:text-[#3d5007] transition-colors text-left"
                  >
                    View details →
                  </button>
                )}

              </div>
            </div>
          )
        })}
      </div>

      {/* ── Key Assumptions — Historical Trends ─────────────────────────────── */}
      <KeyAssumptionsSection
        historicalData={historicalData}
        fcfMarginSeries={fcfMarginSeries}
        assumptions={assumptions}
      />

      {/* ── Footer notes ────────────────────────────────────────────────────── */}
      <div className="mt-4 space-y-1.5">
        {methods.some(m => m.fairValue == null || m.fairValue <= 0) && (
          <p className="text-[11px] text-[#9B9B9B] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
            </svg>
            Unavailable models are excluded from the blend. Remaining weights are redistributed proportionally.
          </p>
        )}
        <p className="text-[11px] text-[#9B9B9B] flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
          </svg>
          Weights reflect our conviction in each model&apos;s reliability given current data quality and market context.
        </p>
      </div>
    </div>
  )
}
