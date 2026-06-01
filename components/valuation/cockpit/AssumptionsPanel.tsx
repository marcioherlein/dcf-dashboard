'use client'

import { useState } from 'react'
import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

export interface SparkPoint {
  label: string
  value: number
}

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
  DCF:    { tagBg: 'bg-blue-100',    tagText: 'text-blue-700',    hex: '#3b82f6' },
  'P/E':  { tagBg: 'bg-violet-100',  tagText: 'text-violet-700',  hex: '#8b5cf6' },
  EBITDA: { tagBg: 'bg-amber-100',   tagText: 'text-amber-700',   hex: '#f59e0b' },
  Rev:    { tagBg: 'bg-emerald-100', tagText: 'text-emerald-700', hex: '#10b981' },
} as const

type MethodKey = keyof typeof METHOD_CFG

interface Field {
  key: keyof ValuationAssumptions
  label: string
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
  { key: 'wacc',            label: 'WACC',             unit: '%', min: 0.04,  max: 0.25,  step: 0.0025, typicalMin: 0.06, typicalMax: 0.15, methods: ['DCF'],        description: 'Discount rate reflecting business risk and cost of capital.' },
  { key: 'cagr',            label: '5Y Revenue CAGR',  unit: '%', min: -0.05, max: 0.60,  step: 0.005,  typicalMin: 0.05, typicalMax: 0.25, methods: ['P/E', 'Rev'], description: 'Expected compounded revenue growth over next 5 years.' },
  { key: 'netMargin',       label: 'Exit Net Margin',  unit: '%', min: -0.20, max: 0.60,  step: 0.005,  typicalMin: 0.10, typicalMax: 0.30, methods: ['P/E'],        description: 'Net margin in steady-state year (terminal year).' },
  { key: 'exitPE',          label: 'Exit P/E (NTM)',   unit: 'x', min: 5,     max: 80,    step: 0.5,    typicalMin: 15,   typicalMax: 25,   methods: ['P/E'],        description: 'Price-to-earnings multiple applied in terminal year.', isExitMultiple: true },
  { key: 'exitMultiple',    label: 'EV/EBITDA (NTM)',  unit: 'x', min: 4,     max: 35,    step: 0.5,    typicalMin: 10,   typicalMax: 20,   methods: ['EBITDA'],     description: 'Enterprise value to EBITDA multiple.', isExitMultiple: true },
  { key: 'revenueMultiple', label: 'EV/Revenue (NTM)', unit: 'x', min: 0.5,   max: 20,    step: 0.25,   typicalMin: 2,    typicalMax: 8,    methods: ['Rev'],        description: 'Enterprise value to revenue multiple.', isExitMultiple: true },
]

const FIELD_GROUPS: Array<{ label: string; description: string; keys: Array<keyof ValuationAssumptions> }> = [
  { label: 'Discount Rate', description: 'How risk is priced into the valuation', keys: ['wacc'] },
  { label: 'Growth',        description: 'Revenue trajectory and exit profitability', keys: ['cagr', 'netMargin'] },
  { label: 'Exit Multiples', description: 'What the market will pay at the terminal year', keys: ['exitPE', 'exitMultiple', 'revenueMultiple'] },
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

function getContextLabel(value: number, field: Field, stats: Stats, ttmVal?: number, effectiveTypicals?: { min: number; max: number }): {
  text: string; dot: string
} {
  const tMin = effectiveTypicals?.min ?? field.typicalMin
  const tMax = effectiveTypicals?.max ?? field.typicalMax
  const ref   = stats.isReal ? stats.med : ttmVal
  const label = stats.isReal ? 'historical avg' : 'recent level'
  if (ref == null) {
    if (value > tMax) return { text: `Above typical range`, dot: 'bg-amber-400' }
    if (value < tMin) return { text: `Below typical range`, dot: 'bg-emerald-400' }
    return { text: `Within typical range`, dot: 'bg-slate-400' }
  }
  const ratio = value / ref
  if (ratio < 0.94)  return { text: `Below ${label}`,          dot: 'bg-emerald-500' }
  if (ratio < 0.97)  return { text: `Slightly below ${label}`, dot: 'bg-emerald-400' }
  if (ratio <= 1.03) return { text: `Near ${label}`,           dot: 'bg-amber-400'   }
  if (ratio <= 1.07) return { text: `Slightly above ${label}`, dot: 'bg-amber-500'   }
  return               { text: `Above ${label}`,               dot: 'bg-red-400'     }
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

const BC_W  = 280
const BC_H  = 90
const BC_ML = 26
const BC_MR = 6
const BC_MT = 8
const BC_MB = 18
const BC_CW = BC_W - BC_ML - BC_MR
const BC_CH = BC_H - BC_MT - BC_MB

interface ReferenceLine {
  value: number
  label: string
  color: string
  dash: string
}

function BarChart({
  sparkPoints, inputVal, color, unit, typicalMin, typicalMax, referenceLines = [],
}: {
  sparkPoints: SparkPoint[]
  inputVal: number
  color: string
  unit: '%' | 'x'
  typicalMin: number
  typicalMax: number
  referenceLines?: ReferenceLine[]
}) {
  const historical = sparkPoints.filter(p => p.label !== 'curr')
  const currPoint  = sparkPoints.find(p => p.label === 'curr')
  const hasSeries  = historical.length >= 1

  const displayBars = hasSeries
    ? [
        ...historical.map(p => ({ label: p.label, value: p.value, isCurr: false })),
        ...(currPoint ? [{ label: String(new Date().getFullYear()), value: currPoint.value, isCurr: true }] : []),
      ]
    : []

  const refVals = referenceLines.map(r => r.value).filter(v => v > 0)

  const allVals = [
    ...displayBars.map(b => b.value),
    inputVal,
    ...refVals,
    ...(hasSeries ? [] : [typicalMin, typicalMax]),
  ]
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const vPad   = Math.max((rawMax - rawMin) * 0.15, rawMax === rawMin ? 0.01 : 0)
  const yMin   = rawMin - vPad
  const yMax   = rawMax + vPad
  const ySpan  = yMax - yMin

  const toY    = (v: number) => BC_MT + BC_CH - ((v - yMin) / ySpan) * BC_CH
  const zeroY  = toY(Math.max(yMin, Math.min(yMax, 0)))
  const inputY = Math.max(BC_MT, Math.min(BC_MT + BC_CH, toY(inputVal)))

  // Cascade ALL right-edge labels so none overlap (sort by natural Y, push down if too close)
  const MIN_LABEL_GAP = 11
  type LabelEntry = { naturalY: number; finalY: number; isInput: boolean; rlIdx: number }
  const rightLabels: LabelEntry[] = [
    ...referenceLines.map((rl, i) => {
      const ry = Math.max(BC_MT, Math.min(BC_MT + BC_CH, toY(rl.value)))
      return { naturalY: ry - 2, finalY: ry - 2, isInput: false, rlIdx: i }
    }),
    { naturalY: inputY - 2.5, finalY: inputY - 2.5, isInput: true, rlIdx: -1 },
  ]
  rightLabels.sort((a, b) => a.naturalY - b.naturalY)
  for (let i = 1; i < rightLabels.length; i++) {
    if (rightLabels[i].finalY - rightLabels[i - 1].finalY < MIN_LABEL_GAP) {
      rightLabels[i].finalY = rightLabels[i - 1].finalY + MIN_LABEL_GAP
    }
  }
  const rlFinalY = new Map<number, number>()
  let inputFinalY = inputY - 2.5
  for (const l of rightLabels) {
    if (l.isInput) inputFinalY = l.finalY
    else rlFinalY.set(l.rlIdx, l.finalY)
  }

  const n     = displayBars.length
  const slotW = n > 0 ? BC_CW / n : BC_CW
  const barW  = n > 0 ? Math.max(6, Math.min(26, slotW * 0.6)) : 0

  return (
    <svg
      viewBox={`0 0 ${BC_W} ${BC_H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Typical range band — no historical data */}
      {!hasSeries && (
        <>
          <rect
            x={BC_ML} y={toY(typicalMax)}
            width={BC_CW}
            height={Math.max(2, toY(typicalMin) - toY(typicalMax))}
            fill={color} fillOpacity="0.12" rx="3"
          />
          <text x={BC_ML - 3} y={toY(typicalMax) + 3.5} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="sans-serif">
            {fmtVal(typicalMax, unit)}
          </text>
          <text x={BC_ML - 3} y={toY(typicalMin) + 3.5} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="sans-serif">
            {fmtVal(typicalMin, unit)}
          </text>
          <text
            x={BC_ML + BC_CW / 2} y={BC_MT + BC_CH / 2 + 4}
            textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="sans-serif"
          >
            Typical range
          </text>
        </>
      )}

      {/* Historical bars */}
      {displayBars.map((bar, i) => {
        const cx   = BC_ML + slotW * i + slotW / 2
        const barX = cx - barW / 2
        const barTopY = toY(bar.value)
        const barY    = Math.min(barTopY, zeroY)
        const barH    = Math.max(2, Math.abs(zeroY - barTopY))
        return (
          <g key={i}>
            <rect x={barX} y={barY} width={barW} height={barH} fill={color} rx="2" fillOpacity={bar.isCurr ? 1 : 0.55}>
              <title>{shortYear(bar.label)}: {fmtVal(bar.value, unit)}</title>
            </rect>
            <text x={cx} y={BC_H - 3} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="sans-serif">
              {shortYear(bar.label)}
            </text>
          </g>
        )
      })}

      {/* Reference lines (Graham floor, sector median) */}
      {referenceLines.map((rl, i) => {
        const refY = Math.max(BC_MT, Math.min(BC_MT + BC_CH, toY(rl.value)))
        return (
          <g key={`rl-${i}`}>
            <line
              x1={BC_ML} y1={refY} x2={BC_ML + BC_CW} y2={refY}
              stroke={rl.color} strokeWidth="1" strokeDasharray={rl.dash}
            />
            <text
              x={BC_ML + BC_CW - 2} y={rlFinalY.get(i) ?? refY - 2}
              textAnchor="end" fontSize="7.5" fill={rl.color}
              fontWeight="600" fontFamily="sans-serif"
            >
              {rl.label}
            </text>
          </g>
        )
      })}

      {/* Input reference line */}
      <line
        x1={BC_ML} y1={inputY}
        x2={BC_ML + BC_CW} y2={inputY}
        stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3"
      />
      <text
        x={BC_ML + BC_CW - 2} y={inputFinalY}
        textAnchor="end" fontSize="9" fill="#b45309"
        fontWeight="600" fontFamily="sans-serif"
      >
        {fmtVal(inputVal, unit)}
      </text>

      {/* Y-axis range labels */}
      {hasSeries && rawMax !== rawMin && (
        <>
          <text x={BC_ML - 3} y={toY(rawMax) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="sans-serif">
            {fmtVal(rawMax, unit)}
          </text>
          <text x={BC_ML - 3} y={toY(rawMin) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="sans-serif">
            {fmtVal(rawMin, unit)}
          </text>
        </>
      )}
    </svg>
  )
}

// ── Assumption Card ───────────────────────────────────────────────────────────

function AssumptionCard({
  field, value, defaultValue, isDirty, onChange, sparkPoints, sensitivityImpact, blendedFairValue, currency, sector,
  sectorBenchmark, intrinsicPE, cagr,
}: {
  field: Field
  value: number
  defaultValue: number
  isDirty: boolean
  onChange: (v: number) => void
  sparkPoints?: SparkPoint[]
  sensitivityImpact?: number
  blendedFairValue?: number | null
  currency: string
  sector?: string | null
  sectorBenchmark?: number | null
  intrinsicPE?: number | null
  cagr?: number
}) {
  const primaryMethod = field.methods[0]
  const color    = METHOD_CFG[primaryMethod].hex

  // Effective typical range: sector-aware for exit multiple fields
  const effectiveTypicals = (() => {
    if (field.isExitMultiple && sectorBenchmark != null && sectorBenchmark > 0) {
      return { min: sectorBenchmark * 0.6, max: sectorBenchmark * 1.4 }
    }
    return { min: field.typicalMin, max: field.typicalMax }
  })()

  const stats    = getStats(field, sparkPoints, effectiveTypicals)
  const currPoint = sparkPoints?.find(p => p.label === 'curr')
  const ttmVal    = currPoint?.value ?? sparkPoints?.filter(p => p.label !== 'curr').at(-1)?.value
  const ctxLabel = getContextLabel(value, field, stats, ttmVal, effectiveTypicals)

  const sliderPct = Math.max(0, Math.min(100, ((value - field.min) / (field.max - field.min)) * 100))
  const delta = value - defaultValue
  const deltaDisplay = isDirty
    ? (delta >= 0 ? '+' : '') + (field.unit === '%' ? (delta * 100).toFixed(1) + 'pp' : delta.toFixed(1) + '×')
    : null

  const dollarImpact = sensitivityImpact != null && blendedFairValue != null && blendedFairValue > 0
    ? Math.abs(sensitivityImpact * blendedFairValue)
    : null

  const hasSeries = (sparkPoints?.filter(p => p.label !== 'curr').length ?? 0) >= 1
  const showChart = field.key !== 'wacc'

  const waccSignal = (() => {
    if (field.key !== 'wacc') return null
    if (value > field.typicalMax) return { text: 'Above typical', cls: 'text-amber-600' }
    if (value < field.typicalMin) return { text: 'Below typical', cls: 'text-emerald-600' }
    return { text: 'Within typical', cls: 'text-slate-500' }
  })()

  // ── Exit multiple signals ──────────────────────────────────────────────────
  const currentMultiple = field.isExitMultiple ? (currPoint?.value ?? null) : null

  const expansionSignal = (() => {
    if (!field.isExitMultiple || currentMultiple == null || currentMultiple <= 0) return null
    const ratio = value / currentMultiple
    if (ratio < 0.90) return {
      text: `▼ Implies ${((1 - ratio) * 100).toFixed(0)}% compression vs current ${currentMultiple.toFixed(1)}×`,
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    }
    if (ratio <= 1.10) return {
      text: `≈ Near current ${currentMultiple.toFixed(1)}×`,
      cls: 'bg-slate-100 border-slate-200 text-slate-600',
    }
    if (ratio <= 1.50) return {
      text: `▲ Assumes ${ratio.toFixed(1)}× expansion vs current ${currentMultiple.toFixed(1)}×`,
      cls: 'bg-amber-50 border-amber-200 text-amber-700',
    }
    return {
      text: `▲▲ Aggressive ${ratio.toFixed(1)}× expansion vs current ${currentMultiple.toFixed(1)}×`,
      cls: 'bg-red-50 border-red-200 text-red-600',
    }
  })()

  // PEG ratio for exit P/E
  const pegRatio = field.key === 'exitPE' && cagr != null && cagr > 0
    ? value / (cagr * 100)
    : null

  // For exit P/E: show PEG for high-growth companies (CAGR >10%), Gordon PE otherwise
  // This prevents 3 competing frameworks appearing simultaneously
  const showPEG = pegRatio != null && cagr != null && cagr > 0.10
  const showGordonPE = field.key === 'exitPE' && intrinsicPE != null && intrinsicPE > 0 && !showPEG

  // Reference lines for exit multiple bar chart
  const referenceLines: ReferenceLine[] = (() => {
    if (!field.isExitMultiple) return []
    const lines: ReferenceLine[] = []
    const grahamFloor = GRAHAM_FLOORS[field.key]
    if (grahamFloor != null) {
      lines.push({ value: grahamFloor, label: `Graham: ${field.unit === 'x' ? grahamFloor + '×' : grahamFloor}`, color: '#94a3b8', dash: '3 2' })
    }
    if (sectorBenchmark != null && sectorBenchmark > 0) {
      lines.push({ value: sectorBenchmark, label: `Sector: ${sectorBenchmark.toFixed(0)}×`, color: '#0d9488', dash: '4 2' })
    }
    if (field.key === 'exitPE' && intrinsicPE != null && intrinsicPE > 0) {
      lines.push({ value: intrinsicPE, label: `Gordon: ${intrinsicPE.toFixed(1)}×`, color: '#6366f1', dash: '2 3' })
    }
    return lines
  })()

  function clamp(v: number) {
    return Math.min(field.max, Math.max(field.min, Math.round(v * 100000) / 100000))
  }

  const [isEditing, setIsEditing] = useState(false)
  const [editRaw, setEditRaw] = useState('')

  function startEdit() {
    setEditRaw(field.unit === '%' ? (value * 100).toFixed(2) : value.toFixed(2))
    setIsEditing(true)
  }

  function commitEdit() {
    const parsed = parseFloat(editRaw)
    if (!isNaN(parsed)) {
      const converted = field.unit === '%' ? parsed / 100 : parsed
      onChange(clamp(converted))
    }
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-[650] text-slate-700">{field.label}</span>
          <div className="flex items-center gap-1 shrink-0">
            {field.methods.map(m => (
              <span key={m} className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${METHOD_CFG[m].tagBg} ${METHOD_CFG[m].tagText}`}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Value + stepper */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(clamp(value - field.step))}
            className="w-11 h-11 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all select-none shrink-0"
            aria-label={`Decrease ${field.label}`}
          >
            <span className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-sm pointer-events-none">−</span>
          </button>
          <div className="flex-1 text-center">
            {isEditing ? (
              <input
                type="number"
                value={editRaw}
                onChange={e => setEditRaw(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setIsEditing(false)
                }}
                autoFocus
                className="text-[24px] font-[800] tabular-nums text-center w-full border-b-2 border-blue-400 outline-none bg-transparent text-slate-900 leading-none"
                aria-label={`Enter ${field.label} value`}
              />
            ) : (
              <button
                onClick={startEdit}
                className="text-[28px] font-[800] tabular-nums leading-none tracking-tight text-slate-900 w-full cursor-text hover:text-slate-600 transition-colors"
                aria-label={`${field.label}: ${fmtVal(value, field.unit)}. Click to type a value.`}
                title="Click to type a value directly"
              >
                {fmtVal(value, field.unit)}
              </button>
            )}
            {!isEditing && isDirty && (
              <div className={`text-[10px] font-[600] tabular-nums mt-0.5 ${delta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {deltaDisplay} vs default
              </div>
            )}
          </div>
          <button
            onClick={() => onChange(clamp(value + field.step))}
            className="w-11 h-11 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all select-none shrink-0"
            aria-label={`Increase ${field.label}`}
          >
            <span className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-sm pointer-events-none">+</span>
          </button>
        </div>

        {/* Slider */}
        <div className="flex flex-col gap-1">
          <div
            className="relative flex items-center rounded-full focus-within:ring-2 focus-within:ring-offset-2"
            style={{ height: 16, '--tw-ring-color': color } as React.CSSProperties}
          >
            <div className="absolute w-full h-[3px] bg-slate-100 rounded-full" />
            <div className="absolute h-[3px] rounded-full" style={{ width: `${sliderPct}%`, background: color, opacity: 0.7 }} />
            <div
              className="absolute w-[13px] h-[13px] rounded-full ring-2 ring-white shadow-md pointer-events-none z-[2]"
              style={{ left: `${sliderPct}%`, transform: 'translateX(-50%)', background: color }}
            />
            <input
              type="range" min={field.min} max={field.max} step={field.step} value={value}
              onChange={e => onChange(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label={field.label}
            />
          </div>
          <div className="flex justify-between px-0.5">
            <span className="text-[9px] text-slate-500 tabular-nums">{fmtVal(field.min, field.unit)}</span>
            <span className="text-[9px] text-slate-500 tabular-nums">{fmtVal(field.max, field.unit)}</span>
          </div>
        </div>

        {/* WACC signal */}
        {field.key === 'wacc' && waccSignal && (
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-[600] ${waccSignal.cls}`}>{waccSignal.text}</span>
            <span className="text-[10px] text-slate-400">·</span>
            <span className="text-[10px] text-slate-500">typical {fmtVal(field.typicalMin, '%')}–{fmtVal(field.typicalMax, '%')}</span>
          </div>
        )}

        {/* CAGR sector hint */}
        {field.key === 'cagr' && sector && SECTOR_CAGR_HINT[sector] && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0 bg-slate-300" />
            <span className="text-[10px] text-slate-500">Typical {sector} CAGR: {SECTOR_CAGR_HINT[sector]}</span>
          </div>
        )}

        {/* Exit multiple: expansion/contraction signal */}
        {expansionSignal && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-[600] ${expansionSignal.cls}`}
            aria-label={expansionSignal.text.replace('▲▲', 'Aggressive expansion:').replace('▲', 'Expansion:').replace('▼', 'Compression:')}
          >
            {expansionSignal.text}
          </div>
        )}

        {/* Exit P/E: intrinsic PE hint (stable/mature companies, CAGR ≤10%) */}
        {showGordonPE && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-300" />
            <span className="text-[10px] text-slate-500">
              Intrinsic P/E (Gordon model): <span className="font-[700] text-indigo-600">{intrinsicPE!.toFixed(1)}×</span>
            </span>
          </div>
        )}

        {/* Exit P/E: PEG ratio (high-growth companies, CAGR >10%) */}
        {showPEG && pegRatio != null && (
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${pegRatio < 1 ? 'bg-emerald-400' : pegRatio < 2 ? 'bg-amber-400' : 'bg-red-400'}`} />
            <span className="text-[10px] text-slate-500">
              PEG: <span className={`font-[700] tabular-nums ${pegRatio < 1 ? 'text-emerald-600' : pegRatio < 2 ? 'text-amber-600' : 'text-red-500'}`}>{pegRatio.toFixed(1)}×</span>
              <span className="text-slate-500"> · Lynch: &lt;1 = attractive, &gt;2 = expensive</span>
            </span>
          </div>
        )}

        {/* Historical / reference chart */}
        {showChart && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                {hasSeries ? '5-year history' : 'Typical range'}
              </span>
              {hasSeries && (
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2 rounded-sm" style={{ background: color, opacity: 0.55 }} />
                    <span className="text-[9px] text-slate-500">Historical</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg width="14" height="4" aria-hidden="true">
                      <line x1="0" y1="2" x2="14" y2="2" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
                    </svg>
                    <span className="text-[9px] text-slate-500">Your input</span>
                  </div>
                  {referenceLines.length > 0 && referenceLines.map(rl => (
                    <div key={rl.label} className="flex items-center gap-1">
                      <svg width="14" height="4" aria-hidden="true">
                        <line x1="0" y1="2" x2="14" y2="2" stroke={rl.color} strokeWidth="1" strokeDasharray={rl.dash} />
                      </svg>
                      <span className="text-[9px] text-slate-500">{rl.label.split(':')[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg bg-slate-50/60" style={{ height: 90 }}>
              <BarChart
                sparkPoints={sparkPoints ?? []}
                inputVal={value}
                color={color}
                unit={field.unit}
                typicalMin={effectiveTypicals.min}
                typicalMax={effectiveTypicals.max}
                referenceLines={referenceLines}
              />
            </div>
          </div>
        )}

        {/* Context label */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ctxLabel.dot}`} />
          <span className="text-[10px] text-slate-500 leading-tight">{ctxLabel.text}</span>
          {field.isExitMultiple && sectorBenchmark != null && (
            <span className="text-[10px] text-slate-500">· sector: {sectorBenchmark.toFixed(0)}×</span>
          )}
        </div>

        {/* Description */}
        <p className="text-[11px] text-slate-500 leading-relaxed">{field.description}</p>

        {/* FV impact footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
          <span className="text-[10px] font-[600] text-slate-500">FV impact per step</span>
          {dollarImpact != null ? (
            <span className="text-[11px] font-[700] tabular-nums text-slate-700">
              ±{currency}{dollarImpact < 10 ? dollarImpact.toFixed(2) : dollarImpact.toFixed(1)} per {field.unit === '%' ? '1pp' : '1×'}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Largest Changes Bar ───────────────────────────────────────────────────────

function LargestChangesBar({
  assumptions, defaults, sensitivity,
}: {
  assumptions: ValuationAssumptions
  defaults: ValuationAssumptions
  sensitivity: Partial<Record<keyof ValuationAssumptions, number>>
}) {
  const changes = FIELDS
    .map(f => {
      const val  = assumptions[f.key] as number
      const def  = defaults[f.key]  as number
      const delta = val - def
      if (Math.abs(delta) < 0.00001) return null
      const sens  = sensitivity[f.key]
      const netImpact = sens != null
        ? sens * (f.unit === '%' ? delta * 100 : delta)
        : 0
      const deltaFmt = f.unit === '%'
        ? (delta >= 0 ? '+' : '') + (delta * 100).toFixed(1) + 'pp'
        : (delta >= 0 ? '+' : '') + delta.toFixed(1) + '×'
      const impactFmt = sens != null
        ? (netImpact >= 0 ? '+' : '') + (netImpact * 100).toFixed(1) + '%'
        : null
      return { key: f.key, label: f.label, deltaFmt, impactFmt, netImpact, methods: f.methods }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => Math.abs(b.netImpact) - Math.abs(a.netImpact))
    .slice(0, 5)

  if (changes.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-[11px] font-[600] text-slate-500">Largest assumption changes vs. defaults</p>
      <p className="text-[11px] text-slate-400 mt-1">All assumptions at default values</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-[11px] font-[600] text-slate-500 mb-3">Largest assumption changes vs. defaults</p>
      <div className="flex flex-wrap gap-2">
        {changes.map(c => {
          const methodColor = METHOD_CFG[c.methods[0]]
          return (
            <div key={c.key} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${methodColor.tagBg} border-transparent`}>
              <span className={`text-[10px] font-bold ${methodColor.tagText}`}>{c.label}</span>
              {c.impactFmt && (
                <span className={`text-[10px] font-bold tabular-nums ${c.netImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {c.impactFmt}
                </span>
              )}
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
  const deltaPct = blendedFairValue != null && defaultBlendedFairValue != null && defaultBlendedFairValue > 0
    ? (blendedFairValue - defaultBlendedFairValue) / defaultBlendedFairValue
    : null

  const isModified = FIELDS.some(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001)

  // Intrinsic P/E from Gordon Growth Model: (1 + terminalG) / (wacc − terminalG)
  const intrinsicPE = (() => {
    const spread = assumptions.wacc - assumptions.terminalG
    return spread > 0.01 ? (1 + assumptions.terminalG) / spread : null
  })()

  const isBase = FIELDS.every(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) < 0.00001)
  const isBear = !isBase
    && Math.abs(assumptions.wacc - defaults.wacc * 1.10) < 0.0005
    && Math.abs(assumptions.cagr - Math.max(defaults.cagr - 0.03, -0.05)) < 0.0005
  const isBull = !isBase
    && Math.abs(assumptions.wacc - defaults.wacc * 0.90) < 0.0005
    && Math.abs(assumptions.cagr - (defaults.cagr + 0.03)) < 0.0005

  function applyPreset(waccMult: number, cagrDelta: number, exitMultFactor: number) {
    onChange({
      ...defaults,
      wacc: Math.round(defaults.wacc * waccMult * 100000) / 100000,
      cagr: Math.round(Math.max(defaults.cagr + cagrDelta, -0.05) * 100000) / 100000,
      exitPE:          Math.round(defaults.exitPE          * exitMultFactor * 2)  / 2,
      exitMultiple:    Math.round(defaults.exitMultiple    * exitMultFactor * 2)  / 2,
      revenueMultiple: Math.round(defaults.revenueMultiple * exitMultFactor * 4)  / 4,
    })
  }

  const presets = [
    { id: 'bear', label: 'Bear', active: isBear, onClick: () => applyPreset(1.10, -0.03, 0.80) },
    { id: 'base', label: 'Base', active: isBase, onClick: onReset },
    { id: 'bull', label: 'Bull', active: isBull, onClick: () => applyPreset(0.90, +0.03, 1.15) },
  ]

  return (
    <div className="space-y-4">

      {/* Panel header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[18px] font-bold text-slate-900">Assumptions</p>
          <p className="text-[12px] text-slate-500 mt-0.5">Adjust key drivers and see how fair value responds</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 bg-white">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={p.onClick}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md transition-all ${
                  p.active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {deltaPct != null && isModified && Math.abs(deltaPct) > 0.001 && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
              deltaPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct * 100).toFixed(1)}% blended FV
            </span>
          )}
          {canUndo && onUndo && (
            <button
              onClick={onUndo}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
            >
              ↩ Undo
            </button>
          )}
          <button
            onClick={onReset}
            disabled={!isModified}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-800 disabled:text-slate-300 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:border-slate-100 transition-all"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Grouped cards */}
      <div className="space-y-6">
        {FIELD_GROUPS.map(group => {
          const groupFields = group.keys.map(k => FIELDS.find(f => f.key === k)!).filter(Boolean)
          return (
            <div key={group.label}>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[12px] font-[600] text-slate-700">{group.label}</span>
                <span className="text-[11px] text-slate-500">{group.description}</span>
              </div>
              {group.label === 'Exit Multiples' && (
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  Reference lines: <span className="text-slate-500">Graham</span> (conservative floor) · <span className="text-teal-600">Sector</span> (Damodaran median) · <span className="text-indigo-500">Gordon</span> (intrinsic P/E only)
                </p>
              )}
              <div className="flex flex-col gap-3">
                {groupFields.map(f => {
                  const sb = sectorBenchmarks
                    ? ({ exitPE: sectorBenchmarks.exitPE, exitMultiple: sectorBenchmarks.exitMultiple, revenueMultiple: sectorBenchmarks.revenueMultiple } as Record<string, number>)[f.key as string] ?? null
                    : null
                  return (
                    <AssumptionCard
                      key={f.key}
                      field={f}
                      value={assumptions[f.key] as number}
                      defaultValue={defaults[f.key] as number}
                      isDirty={Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001}
                      onChange={v => onChange({ ...assumptions, [f.key]: v })}
                      sparkPoints={historicalData[f.key]}
                      sensitivityImpact={sensitivity[f.key]}
                      blendedFairValue={blendedFairValue}
                      currency={currency}
                      sector={sector}
                      sectorBenchmark={sb}
                      intrinsicPE={f.key === 'exitPE' ? intrinsicPE : undefined}
                      cagr={f.key === 'exitPE' ? assumptions.cagr : undefined}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <LargestChangesBar assumptions={assumptions} defaults={defaults} sensitivity={sensitivity} />

      {/* A note on assumptions */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
        <svg className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-[11px] text-blue-700 leading-relaxed">
          <span className="font-bold">Bear/Bull presets</span> adjust WACC, CAGR, and exit multiples together — compressing multiples 20% in Bear and expanding 15% in Bull, consistent with how market cycles actually move.
        </p>
      </div>

    </div>
  )
}
