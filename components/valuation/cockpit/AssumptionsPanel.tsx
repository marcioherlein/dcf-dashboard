'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ValuationAssumptions } from '@/lib/valuation/cockpit'
import {
  BarChart as RBarChart, Bar, XAxis, YAxis, Cell,
  ReferenceLine as RReferenceLine, LabelList, ResponsiveContainer,
} from 'recharts'

// ── Re-export SparkPoint so callers that import it from here still work ────────
export interface SparkPoint {
  label: string
  value: number
}

// ── Field definitions ─────────────────────────────────────────────────────────

const SECTOR_CAGR_HINT: Record<string, string> = {
  'Consumer Cyclical':     '1–6%',
  'Consumer Defensive':   '2–5%',
  'Industrials':          '2–6%',
  'Basic Materials':      '2–6%',
  'Energy':               '1–5%',
  'Utilities':            '0–3%',
  'Real Estate':          '2–5%',
  'Financial Services':   '2–7%',
  'Healthcare':           '5–10%',
  'Technology':           '10–25%',
  'Communication Services': '4–10%',
}

const GRAHAM_FLOORS: Partial<Record<keyof ValuationAssumptions, number>> = {
  exitPE: 15,
  exitMultiple: 8,
  revenueMultiple: 2,
}

const METHOD_CFG = {
  DCF:    { tagBg: 'bg-blue-100',    tagText: 'text-blue-700',    hex: '#3b82f6', trackCls: 'bg-blue-500'   },
  'P/E':  { tagBg: 'bg-violet-100',  tagText: 'text-violet-700',  hex: '#8b5cf6', trackCls: 'bg-violet-500' },
  EBITDA: { tagBg: 'bg-amber-100',   tagText: 'text-amber-700',   hex: '#f59e0b', trackCls: 'bg-amber-500'  },
  Rev:    { tagBg: 'bg-emerald-100', tagText: 'text-emerald-700', hex: '#10b981', trackCls: 'bg-emerald-500' },
} as const

type MethodKey = keyof typeof METHOD_CFG

interface Field {
  key: keyof ValuationAssumptions
  label: string
  subLabel: string
  unit: '%' | 'x'
  min: number
  max: number
  step: number
  typicalMin: number
  typicalMax: number
  methods: MethodKey[]
  description: string
  isExitMultiple?: boolean
}

const FIELDS: Field[] = [
  { key: 'wacc',            label: 'Discount Rate (WACC)',      subLabel: 'Your required annual return',         unit: '%', min: 0.04,  max: 0.25,  step: 0.0025, typicalMin: 0.06, typicalMax: 0.15, methods: ['DCF'],        description: 'The minimum annual return that justifies holding this investment given its risk. Higher WACC = lower fair value.' },
  { key: 'cagr',            label: 'Revenue Growth Rate',       subLabel: 'Avg annual growth, next 5 years',     unit: '%', min: -0.05, max: 0.60,  step: 0.005,  typicalMin: 0.05, typicalMax: 0.25, methods: ['P/E', 'Rev'], description: 'Expected compounded revenue growth over next 5 years. Seeded from a blended rate that discounts the raw 3Y historical CAGR toward long-run growth and applies a size cap for large-cap companies.' },
  { key: 'netMargin',       label: 'Long-run Profit Margin',    subLabel: 'Net income as % of revenue at exit',  unit: '%', min: -0.20, max: 0.60,  step: 0.005,  typicalMin: 0.10, typicalMax: 0.30, methods: ['P/E'],        description: 'Net profit margin in steady-state — what percentage of revenue becomes profit at the end of the forecast period.' },
  { key: 'exitPE',          label: 'Exit P/E Multiple',         subLabel: 'What investors pay per $1 of earnings', unit: 'x', min: 5,   max: 80,    step: 0.5,    typicalMin: 15,   typicalMax: 25,   methods: ['P/E'],        description: 'The price-to-earnings multiple at which you assume the stock trades in the terminal year. A higher multiple means the market pays more for each dollar of profit.', isExitMultiple: true },
  { key: 'exitMultiple',    label: 'EV/EBITDA Multiple',        subLabel: 'What investors pay per $1 of operating profit', unit: 'x', min: 4, max: 35, step: 0.5,  typicalMin: 10,   typicalMax: 20,   methods: ['EBITDA'],     description: 'Enterprise value to EBITDA multiple at exit. Enterprise value includes both equity and debt, so this is a measure of what the whole business is worth relative to its operating profit.', isExitMultiple: true },
  { key: 'revenueMultiple', label: 'EV/Revenue Multiple',       subLabel: 'What investors pay per $1 of revenue', unit: 'x', min: 0.5, max: 20,  step: 0.25,   typicalMin: 2,    typicalMax: 8,    methods: ['Rev'],        description: 'Enterprise value to revenue multiple at exit. Useful when earnings are negative or inconsistent — the market prices the company based on its revenue scale.', isExitMultiple: true },
]

const FIELD_GROUPS: Array<{ label: string; keys: Array<keyof ValuationAssumptions> }> = [
  { label: 'Discount Rate', keys: ['wacc'] },
  { label: 'Growth',        keys: ['cagr', 'netMargin'] },
  { label: 'Exit Multiples', keys: ['exitPE', 'exitMultiple', 'revenueMultiple'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVal(v: number, unit: '%' | 'x'): string {
  return unit === '%' ? (v * 100).toFixed(1) + '%' : v.toFixed(1) + '×'
}

function medianOf(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function shortYear(label: string): string {
  if (label === 'curr') return String(new Date().getFullYear()).slice(2)
  const m = label.match(/\d{4}/)
  return m ? m[0].slice(2) : label.slice(0, 4)
}

interface Stats { min: number; med: number; max: number; isReal: boolean }

function getStats(field: Field, sparkPoints?: SparkPoint[], effectiveTypicals?: { min: number; max: number }): Stats {
  const series = sparkPoints?.filter(p => p.label !== 'curr') ?? []
  if (series.length >= 2) {
    const vals = series.map(p => p.value)
    return { min: Math.min(...vals), med: medianOf(vals), max: Math.max(...vals), isReal: true }
  }
  const tMin = effectiveTypicals?.min ?? field.typicalMin
  const tMax = effectiveTypicals?.max ?? field.typicalMax
  return { min: tMin, med: (tMin + tMax) / 2, max: tMax, isReal: false }
}

function getContextLabel(value: number, field: Field, stats: Stats, ttmVal?: number, effectiveTypicals?: { min: number; max: number }): { text: string; dot: string } {
  const tMin = effectiveTypicals?.min ?? field.typicalMin
  const tMax = effectiveTypicals?.max ?? field.typicalMax
  const ref   = stats.isReal ? stats.med : ttmVal
  const label = stats.isReal ? 'historical avg' : 'recent level'
  if (ref == null) {
    if (value > tMax) return { text: 'Above typical range', dot: 'bg-amber-400' }
    if (value < tMin) return { text: 'Below typical range', dot: 'bg-emerald-400' }
    return { text: 'Within typical range', dot: 'bg-slate-400' }
  }
  const ratio = value / ref
  if (ratio < 0.94)  return { text: `Below ${label}`,          dot: 'bg-emerald-500' }
  if (ratio < 0.97)  return { text: `Slightly below ${label}`, dot: 'bg-emerald-400' }
  if (ratio <= 1.03) return { text: `Near ${label}`,           dot: 'bg-amber-400'   }
  if (ratio <= 1.07) return { text: `Slightly above ${label}`, dot: 'bg-amber-500'   }
  return               { text: `Above ${label}`,               dot: 'bg-red-400'     }
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

interface RefLine { value: number; label: string; color: string; dash: string }

function BarChart({ sparkPoints, inputVal, color, unit, referenceLines = [] }: {
  sparkPoints: SparkPoint[]; inputVal: number; color: string; unit: '%' | 'x'
  typicalMin: number; typicalMax: number; referenceLines?: RefLine[]
}) {
  const historical = sparkPoints.filter(p => p.label !== 'curr')
  const currPoint  = sparkPoints.find(p => p.label === 'curr')
  const bars = historical.length >= 1
    ? [
        ...historical.map(p => ({ label: shortYear(p.label), value: p.value, isCurr: false })),
        ...(currPoint ? [{ label: "'" + String(new Date().getFullYear()).slice(2), value: currPoint.value, isCurr: true }] : []),
      ]
    : []

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-[86px]">
        <span className="text-[9px] text-slate-300">No historical data</span>
      </div>
    )
  }

  const refVals = referenceLines.map(r => r.value).filter(v => v > 0)
  const allVals = [...bars.map(b => b.value), inputVal, ...refVals]
  const rawMin = Math.min(...allVals), rawMax = Math.max(...allVals)
  const pad = Math.max((rawMax - rawMin) * 0.18, rawMax === rawMin ? Math.abs(rawMax) * 0.2 || 1 : 0)
  const yMin = Math.max(0, rawMin - pad)
  const yMax = rawMax + pad

  const allLines = [
    ...referenceLines,
    { value: inputVal, label: `Input: ${fmtVal(inputVal, unit)}`, color: '#b45309', dash: '4 3', isInput: true },
  ]

  return (
    <>
      {/* Fixed-height cage — overflow:hidden prevents SVG from bleeding */}
      <div style={{ width: '100%', height: 82, overflow: 'hidden' }}>
        <ResponsiveContainer width="100%" height={82}>
          <RBarChart data={bars} margin={{ top: 16, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <YAxis domain={[yMin, yMax]} hide />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={14}
            />

            {referenceLines.map((rl, i) => (
              <RReferenceLine key={`rl-${i}`} y={rl.value} stroke={rl.color} strokeDasharray={rl.dash} strokeWidth={1} />
            ))}

            <RReferenceLine y={inputVal} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />

            <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bars.map((bar, i) => (
                <Cell key={i} fill={color} fillOpacity={bar.isCurr ? 1 : 0.4} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={(props: any) => {
                  const { x, y, width, value, index } = props
                  const bar = bars[index]
                  if (value == null) return null
                  return (
                    <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 2}
                      textAnchor="middle" fontSize={8} fontFamily="sans-serif"
                      fill={bar?.isCurr ? color : '#94a3b8'}
                      fontWeight={bar?.isCurr ? 700 : 500}>
                      {fmtVal(value as number, unit)}
                    </text>
                  )
                }}
              />
            </Bar>
          </RBarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row — outside the cage, no overflow risk */}
      <div className="flex items-center gap-3 flex-wrap mt-1 px-0.5">
        {allLines.map((l, i) => (
          <span key={i} className="flex items-center gap-1 text-[9px]" style={{ color: l.color }}>
            <svg width="12" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="12" y2="2" stroke={l.color} strokeWidth={'isInput' in l ? 1.5 : 1} strokeDasharray={l.dash} />
            </svg>
            {l.label}
          </span>
        ))}
      </div>
    </>
  )
}

// ── Assumption Row (expanded zone) ────────────────────────────────────────────

function AssumptionRowExpanded({
  field, value, defaultValue, isDirty, onChange, sparkPoints, sensitivityImpact, blendedFairValue, currency, sector,
  sectorBenchmark, intrinsicPE, cagr, onReset,
}: {
  field: Field; value: number; defaultValue: number; isDirty: boolean
  onChange: (v: number) => void; sparkPoints?: SparkPoint[]
  sensitivityImpact?: number; blendedFairValue?: number | null
  currency: string; sector?: string | null; sectorBenchmark?: number | null
  intrinsicPE?: number | null; cagr?: number; onReset: () => void
}) {
  const primaryMethod = field.methods[0]
  const color = METHOD_CFG[primaryMethod].hex

  const effectiveTypicals = (() => {
    if (field.isExitMultiple && sectorBenchmark != null && sectorBenchmark > 0) {
      return { min: sectorBenchmark * 0.6, max: sectorBenchmark * 1.4 }
    }
    return { min: field.typicalMin, max: field.typicalMax }
  })()

  const stats    = getStats(field, sparkPoints, effectiveTypicals)
  const currPoint = sparkPoints?.find(p => p.label === 'curr')
  const ttmVal    = currPoint?.value ?? sparkPoints?.filter(p => p.label !== 'curr').at(-1)?.value
  const ctxLabel  = getContextLabel(value, field, stats, ttmVal, effectiveTypicals)

  const sliderPct = Math.max(0, Math.min(100, ((value - field.min) / (field.max - field.min)) * 100))
  const delta = value - defaultValue
  const deltaDisplay = isDirty
    ? (delta >= 0 ? '+' : '') + (field.unit === '%' ? (delta * 100).toFixed(1) + 'pp' : delta.toFixed(1) + '×')
    : null

  const dollarImpact = sensitivityImpact != null && blendedFairValue != null && blendedFairValue > 0
    ? Math.abs(sensitivityImpact * blendedFairValue) : null

  const hasSeries = (sparkPoints?.filter(p => p.label !== 'curr').length ?? 0) >= 1
  const showChart = field.key !== 'wacc'

  const waccSignal = (() => {
    if (field.key !== 'wacc') return null
    if (value > field.typicalMax) return { text: 'Above typical', cls: 'text-amber-600' }
    if (value < field.typicalMin) return { text: 'Below typical', cls: 'text-emerald-600' }
    return { text: 'Within typical', cls: 'text-slate-500' }
  })()

  const currentMultiple = field.isExitMultiple ? (currPoint?.value ?? null) : null
  const expansionSignal = (() => {
    if (!field.isExitMultiple || currentMultiple == null || currentMultiple <= 0) return null
    const ratio = value / currentMultiple
    if (ratio < 0.90) return { text: `▼ Implies ${((1 - ratio) * 100).toFixed(0)}% compression vs current ${currentMultiple.toFixed(1)}×`, cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
    if (ratio <= 1.10) return { text: `≈ Near current ${currentMultiple.toFixed(1)}×`, cls: 'bg-slate-100 border-slate-200 text-slate-600' }
    if (ratio <= 1.50) return { text: `▲ Assumes ${ratio.toFixed(1)}× expansion vs current ${currentMultiple.toFixed(1)}×`, cls: 'bg-amber-50 border-amber-200 text-amber-700' }
    return { text: `▲▲ Aggressive ${ratio.toFixed(1)}× expansion vs current ${currentMultiple.toFixed(1)}×`, cls: 'bg-red-50 border-red-200 text-red-600' }
  })()

  const pegRatio = field.key === 'exitPE' && cagr != null && cagr > 0 ? value / (cagr * 100) : null
  const showPEG = pegRatio != null && cagr != null && cagr > 0.10
  const showGordonPE = field.key === 'exitPE' && intrinsicPE != null && intrinsicPE > 0 && !showPEG

  const referenceLines: RefLine[] = (() => {
    if (!field.isExitMultiple) return []
    const lines: RefLine[] = []
    const grahamFloor = GRAHAM_FLOORS[field.key]
    if (grahamFloor != null) lines.push({ value: grahamFloor, label: `Graham: ${field.unit === 'x' ? grahamFloor + '×' : grahamFloor}`, color: '#94a3b8', dash: '3 2' })
    if (sectorBenchmark != null && sectorBenchmark > 0) lines.push({ value: sectorBenchmark, label: `Sector: ${sectorBenchmark.toFixed(0)}×`, color: '#0d9488', dash: '4 2' })
    if (field.key === 'exitPE' && intrinsicPE != null && intrinsicPE > 0) lines.push({ value: intrinsicPE, label: `Gordon: ${intrinsicPE.toFixed(1)}×`, color: '#6366f1', dash: '2 3' })
    return lines
  })()

  function clamp(v: number) { return Math.min(field.max, Math.max(field.min, Math.round(v * 100000) / 100000)) }

  const [isEditing, setIsEditing] = useState(false)
  const [editRaw, setEditRaw] = useState('')

  function startEdit() { setEditRaw(field.unit === '%' ? (value * 100).toFixed(2) : value.toFixed(2)); setIsEditing(true) }
  function commitEdit() {
    const parsed = parseFloat(editRaw)
    if (!isNaN(parsed)) onChange(clamp(field.unit === '%' ? parsed / 100 : parsed))
    setIsEditing(false)
  }

  return (
    <div className="px-4 pb-4 pt-2 border-l-2 ml-3 flex flex-col gap-3" style={{ borderColor: color }}>

      {/* Value + steppers */}
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(clamp(value - field.step))} className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all text-sm font-bold select-none shrink-0" aria-label={`Decrease ${field.label}`}>−</button>
        <div className="flex-1 text-center">
          {isEditing ? (
            <input type="number" value={editRaw} onChange={e => setEditRaw(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setIsEditing(false) }} autoFocus className="text-[20px] font-[800] tabular-nums text-center w-full border-b-2 border-blue-400 outline-none bg-transparent text-slate-900 leading-none" aria-label={`Enter ${field.label} value`} />
          ) : (
            <button onClick={startEdit} className="text-[22px] font-[800] tabular-nums leading-none tracking-tight text-slate-900 w-full cursor-text hover:text-slate-600 transition-colors" title="Click to type a value directly" aria-label={`${field.label}: ${fmtVal(value, field.unit)}. Click to type.`}>
              {fmtVal(value, field.unit)}
            </button>
          )}
          {!isEditing && isDirty && (
            <div className={`text-[10px] font-[600] tabular-nums mt-0.5 ${delta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>{deltaDisplay} vs default</div>
          )}
        </div>
        <button onClick={() => onChange(clamp(value + field.step))} className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all text-sm font-bold select-none shrink-0" aria-label={`Increase ${field.label}`}>+</button>
      </div>

      {/* Slider */}
      <div className="flex flex-col gap-1">
        <div className="relative flex items-center" style={{ height: 20 }}>
          <div className="absolute w-full h-[4px] bg-slate-100 rounded-full" />
          <div className="absolute h-[4px] rounded-full" style={{ width: `${sliderPct}%`, background: color, opacity: 0.7 }} />
          <div className="absolute w-[14px] h-[14px] rounded-full ring-2 ring-white shadow-md pointer-events-none z-[2]" style={{ left: `${sliderPct}%`, transform: 'translateX(-50%)', background: color }} />
          <input type="range" min={field.min} max={field.max} step={field.step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-pointer" aria-label={field.label} />
        </div>
        <div className="flex justify-between px-0.5">
          <span className="text-[9px] text-slate-400 tabular-nums">{fmtVal(field.min, field.unit)}</span>
          <span className="text-[9px] text-slate-400 tabular-nums">{fmtVal(field.max, field.unit)}</span>
        </div>
      </div>

      {/* WACC signal */}
      {field.key === 'wacc' && waccSignal && (
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-[600] ${waccSignal.cls}`}>{waccSignal.text}</span>
          <span className="text-[10px] text-slate-400">· typical {fmtVal(field.typicalMin, '%')}–{fmtVal(field.typicalMax, '%')}</span>
        </div>
      )}

      {/* CAGR sector hint */}
      {field.key === 'cagr' && sector && SECTOR_CAGR_HINT[sector] && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0 bg-slate-300" />
          <span className="text-[10px] text-slate-500">Typical {sector} CAGR: {SECTOR_CAGR_HINT[sector]}</span>
        </div>
      )}

      {/* Exit multiple expansion signal */}
      {expansionSignal && (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-[600] ${expansionSignal.cls}`}>
          {expansionSignal.text}
        </div>
      )}

      {/* Gordon PE hint */}
      {showGordonPE && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-300" />
          <span className="text-[10px] text-slate-500">Intrinsic P/E (Gordon): <span className="font-[700] text-indigo-600">{intrinsicPE!.toFixed(1)}×</span></span>
        </div>
      )}

      {/* PEG ratio */}
      {showPEG && pegRatio != null && (
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${pegRatio < 1 ? 'bg-emerald-400' : pegRatio < 2 ? 'bg-amber-400' : 'bg-red-400'}`} />
          <span className="text-[10px] text-slate-500">PEG: <span className={`font-[700] tabular-nums ${pegRatio < 1 ? 'text-emerald-600' : pegRatio < 2 ? 'text-amber-600' : 'text-red-500'}`}>{pegRatio.toFixed(1)}×</span> · Lynch: &lt;1 = attractive, &gt;2 = expensive</span>
        </div>
      )}

      {/* Bar chart */}
      {showChart && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">{hasSeries ? '5-year history' : 'No historical data'}</span>
          </div>
          <div className="rounded-xl bg-slate-50/60 p-2">
            <BarChart
              sparkPoints={sparkPoints ?? []} inputVal={value} color={color} unit={field.unit}
              typicalMin={effectiveTypicals.min} typicalMax={effectiveTypicals.max}
              referenceLines={referenceLines}
            />
          </div>
        </div>
      )}

      {/* Context label + FV impact + reset */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ctxLabel.dot}`} />
          <span className="text-[10px] text-slate-500 truncate">{ctxLabel.text}</span>
          {field.isExitMultiple && sectorBenchmark != null && (
            <span className="text-[10px] text-slate-400 shrink-0">· sector: {sectorBenchmark.toFixed(0)}×</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {dollarImpact != null && (
            <span className="text-[10px] text-slate-400 tabular-nums">±{currency}{dollarImpact < 10 ? dollarImpact.toFixed(2) : dollarImpact.toFixed(1)}/{field.unit === '%' ? '1pp' : '1×'}</span>
          )}
          {isDirty && (
            <button onClick={onReset} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Reset</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Assumption Row (collapsed) ─────────────────────────────────────────────────

function AssumptionRowCollapsed({
  field, value, isDirty, isExpanded, onToggle, sparkPoints, sectorBenchmark,
}: {
  field: Field; value: number; isDirty: boolean; isExpanded: boolean
  onToggle: () => void; sparkPoints?: SparkPoint[]; sectorBenchmark?: number | null
}) {
  const primaryMethod = field.methods[0]
  const color = METHOD_CFG[primaryMethod].hex
  const sliderPct = Math.max(0, Math.min(100, ((value - field.min) / (field.max - field.min)) * 100))

  const effectiveTypicals = (() => {
    if (field.isExitMultiple && sectorBenchmark != null && sectorBenchmark > 0) {
      return { min: sectorBenchmark * 0.6, max: sectorBenchmark * 1.4 }
    }
    return { min: field.typicalMin, max: field.typicalMax }
  })()

  const stats = getStats(field, sparkPoints, effectiveTypicals)
  const currPoint = sparkPoints?.find(p => p.label === 'curr')
  const ttmVal = currPoint?.value ?? sparkPoints?.filter(p => p.label !== 'curr').at(-1)?.value
  const ctxLabel = getContextLabel(value, field, stats, ttmVal, effectiveTypicals)

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group',
        isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/60',
      )}
      aria-expanded={isExpanded}
    >
      {/* Label */}
      <div className="flex flex-col min-w-0 w-[140px] shrink-0">
        <span className={cn('text-[12px] font-[650] leading-tight', isDirty ? 'text-blue-700' : 'text-slate-700')}>
          {field.label}
          {isDirty && <span className="ml-1 text-[9px] text-blue-500">●</span>}
        </span>
        <span className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">{field.subLabel}</span>
      </div>

      {/* Slider track (visual indicator, not interactive in collapsed state) */}
      <div className="flex-1 relative" style={{ height: 16 }}>
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-[3px] bg-slate-100 rounded-full" />
        <div className="absolute top-1/2 -translate-y-1/2 h-[3px] rounded-full" style={{ width: `${sliderPct}%`, background: color, opacity: 0.6 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full ring-2 ring-white shadow-sm" style={{ left: `${sliderPct}%`, transform: 'translate(-50%, -50%)', background: color }} />
      </div>

      {/* Value */}
      <span className={cn('text-[13px] font-[750] tabular-nums font-mono w-[52px] text-right shrink-0', isDirty ? 'text-blue-700' : 'text-slate-800')}>
        {fmtVal(value, field.unit)}
      </span>

      {/* Signal dot */}
      <span className={cn('w-2 h-2 rounded-full shrink-0', ctxLabel.dot)} title={ctxLabel.text} />

      {/* Chevron */}
      <ChevronRight size={14} className={cn('text-slate-300 shrink-0 transition-transform duration-200 motion-reduce:transition-none', isExpanded && 'rotate-90')} />
    </button>
  )
}

// ── Largest Changes Bar (unchanged) ──────────────────────────────────────────

function LargestChangesBar({ assumptions, defaults, sensitivity }: {
  assumptions: ValuationAssumptions; defaults: ValuationAssumptions
  sensitivity: Partial<Record<keyof ValuationAssumptions, number>>
}) {
  const changes = FIELDS
    .map(f => {
      const val = assumptions[f.key] as number, def = defaults[f.key] as number
      const delta = val - def
      if (Math.abs(delta) < 0.00001) return null
      const sens = sensitivity[f.key]
      const netImpact = sens != null ? sens * (f.unit === '%' ? delta * 100 : delta) : 0
      const deltaFmt = f.unit === '%' ? (delta >= 0 ? '+' : '') + (delta * 100).toFixed(1) + 'pp' : (delta >= 0 ? '+' : '') + delta.toFixed(1) + '×'
      const impactFmt = sens != null ? (netImpact >= 0 ? '+' : '') + (netImpact * 100).toFixed(1) + '%' : null
      return { key: f.key, label: f.label, deltaFmt, impactFmt, netImpact, methods: f.methods }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => Math.abs(b.netImpact) - Math.abs(a.netImpact))
    .slice(0, 5)

  if (changes.length === 0) return null

  return (
    <div className="px-4 py-3 border-t border-slate-100">
      <p className="text-[10px] font-[650] text-slate-400 mb-2">Largest changes vs. defaults</p>
      <div className="flex flex-wrap gap-1.5">
        {changes.map(c => {
          const mc = METHOD_CFG[c.methods[0]]
          return (
            <div key={c.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${mc.tagBg}`}>
              <span className={`text-[10px] font-bold ${mc.tagText}`}>{c.label}</span>
              {c.impactFmt && <span className={`text-[10px] font-bold tabular-nums ${c.netImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{c.impactFmt}</span>}
              <span className="text-[9px] text-slate-500 tabular-nums">{c.deltaFmt}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  assumptions: ValuationAssumptions
  defaults: ValuationAssumptions
  onChange: (a: ValuationAssumptions) => void
  onReset: () => void
  onUndo?: () => void
  canUndo?: boolean
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
  blendedFairValue?: number | null
  defaultBlendedFairValue?: number | null
  sensitivity?: Partial<Record<keyof ValuationAssumptions, number>>
  currency?: string
  sector?: string | null
  sectorBenchmarks?: { exitPE: number; exitMultiple: number; revenueMultiple: number } | null
}

export default function AssumptionsPanel({
  assumptions, defaults, onChange, onReset, onUndo, canUndo,
  historicalData = {}, blendedFairValue, defaultBlendedFairValue, sensitivity = {},
  currency = '$', sector, sectorBenchmarks,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<keyof ValuationAssumptions | null>(null)

  const deltaPct = blendedFairValue != null && defaultBlendedFairValue != null && defaultBlendedFairValue > 0
    ? (blendedFairValue - defaultBlendedFairValue) / defaultBlendedFairValue : null

  const isModified = FIELDS.some(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001)
  const dirtyCount = FIELDS.filter(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001).length

  const intrinsicPE = (() => {
    const spread = assumptions.wacc - assumptions.terminalG
    return spread > 0.01 ? (1 + assumptions.terminalG) / spread : null
  })()

  const isBase = FIELDS.every(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) < 0.00001)
  const isBear = !isBase && Math.abs(assumptions.wacc - defaults.wacc * 1.10) < 0.0005 && Math.abs(assumptions.cagr - Math.max(defaults.cagr - 0.03, -0.05)) < 0.0005
  const isBull = !isBase && Math.abs(assumptions.wacc - defaults.wacc * 0.90) < 0.0005 && Math.abs(assumptions.cagr - (defaults.cagr + 0.03)) < 0.0005

  function applyPreset(waccMult: number, cagrDelta: number, exitMultFactor: number) {
    onChange({
      ...defaults,
      wacc: Math.round(defaults.wacc * waccMult * 100000) / 100000,
      cagr: Math.round(Math.max(defaults.cagr + cagrDelta, -0.05) * 100000) / 100000,
      exitPE:          Math.round(defaults.exitPE          * exitMultFactor * 2) / 2,
      exitMultiple:    Math.round(defaults.exitMultiple    * exitMultFactor * 2) / 2,
      revenueMultiple: Math.round(defaults.revenueMultiple * exitMultFactor * 4) / 4,
    })
    setExpandedKey(null)
  }

  const presets = [
    { id: 'bear', label: 'Bear',  active: isBear, onClick: () => applyPreset(1.10, -0.03, 0.80) },
    { id: 'base', label: 'Base',  active: isBase, onClick: () => { onReset(); setExpandedKey(null) } },
    { id: 'bull', label: 'Bull',  active: isBull, onClick: () => applyPreset(0.90, +0.03, 1.15) },
  ]

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">

      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-slate-800">Assumptions</span>
          {dirtyCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
              {dirtyCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Presets */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 bg-white">
            {presets.map(p => (
              <button key={p.id} onClick={p.onClick} className={cn('text-[11px] font-semibold px-3 py-1.5 rounded-md motion-safe:transition-all', p.active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50')}>
                {p.label}
              </button>
            ))}
          </div>

          {/* FV delta badge */}
          {deltaPct != null && isModified && Math.abs(deltaPct) > 0.001 && (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', deltaPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600')}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct * 100).toFixed(1)}% FV
            </span>
          )}

          {/* Undo */}
          {canUndo && onUndo && (
            <button onClick={onUndo} className="text-[11px] font-semibold text-slate-600 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 motion-safe:transition-all">↩</button>
          )}

          {/* Reset */}
          <button onClick={onReset} disabled={!isModified} className="text-[11px] font-semibold text-slate-600 hover:text-slate-700 disabled:text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:border-slate-100 motion-safe:transition-all">↺ Reset</button>
        </div>
      </div>

      {/* Groups + rows */}
      {FIELD_GROUPS.map((group, gi) => {
        const groupFields = group.keys.map(k => FIELDS.find(f => f.key === k)!).filter(Boolean)
        return (
          <div key={group.label} className={gi > 0 ? 'border-t border-slate-100' : ''}>
            {/* Group label */}
            <div className="flex items-center gap-2 px-4 pt-2 pb-1">
              <span className="text-[10px] font-[700] uppercase tracking-wide text-slate-400">{group.label}</span>
              {group.label === 'Exit Multiples' && (
                <span className="text-[10px] text-slate-400 normal-case font-normal tracking-normal">· what the market pays at exit</span>
              )}
            </div>

            {/* Rows */}
            {groupFields.map(f => {
              const isExpanded = expandedKey === f.key
              const sb = sectorBenchmarks ? ({ exitPE: sectorBenchmarks.exitPE, exitMultiple: sectorBenchmarks.exitMultiple, revenueMultiple: sectorBenchmarks.revenueMultiple } as Record<string, number>)[f.key as string] ?? null : null
              const isDirty = Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001

              return (
                <div key={f.key} className="border-t border-slate-50 first:border-t-0">
                  <AssumptionRowCollapsed
                    field={f}
                    value={assumptions[f.key] as number}
                    isDirty={isDirty}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedKey(isExpanded ? null : f.key)}
                    sparkPoints={historicalData[f.key]}
                    sectorBenchmark={sb}
                  />
                  {isExpanded && (
                    <AssumptionRowExpanded
                      field={f}
                      value={assumptions[f.key] as number}
                      defaultValue={defaults[f.key] as number}
                      isDirty={isDirty}
                      onChange={v => onChange({ ...assumptions, [f.key]: v })}
                      sparkPoints={historicalData[f.key]}
                      sensitivityImpact={sensitivity[f.key]}
                      blendedFairValue={blendedFairValue}
                      currency={currency}
                      sector={sector}
                      sectorBenchmark={sb}
                      intrinsicPE={f.key === 'exitPE' ? intrinsicPE : undefined}
                      cagr={f.key === 'exitPE' ? assumptions.cagr : undefined}
                      onReset={() => onChange({ ...assumptions, [f.key]: defaults[f.key] })}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Largest changes footer */}
      {isModified && (
        <LargestChangesBar assumptions={assumptions} defaults={defaults} sensitivity={sensitivity} />
      )}

    </div>
  )
}
