'use client'

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

export interface SparkPoint {
  label: string
  value: number
}

// Method attribution colours
const METHOD_CFG = {
  DCF:    { tagBg: 'bg-blue-100',    tagText: 'text-blue-700',   accent: 'bg-blue-400'    },
  'P/E':  { tagBg: 'bg-violet-100',  tagText: 'text-violet-700', accent: 'bg-violet-400'  },
  EBITDA: { tagBg: 'bg-amber-100',   tagText: 'text-amber-700',  accent: 'bg-amber-400'   },
  Rev:    { tagBg: 'bg-emerald-100', tagText: 'text-emerald-700',accent: 'bg-emerald-400' },
} as const

type MethodKey = keyof typeof METHOD_CFG

interface Field {
  key: keyof ValuationAssumptions
  label: string
  unit: '%' | 'x'
  min: number
  max: number
  step: number
  hint: string
  typicalMin: number
  typicalMax: number
  methods: MethodKey[]
}

const FIELDS: Field[] = [
  { key: 'wacc',            label: 'WACC',              unit: '%', min: 0.04,  max: 0.25,  step: 0.0025, hint: '6–15% typical',        typicalMin: 0.06, typicalMax: 0.15, methods: ['DCF'] },
  { key: 'terminalG',       label: 'Terminal Growth',   unit: '%', min: 0.005, max: 0.05,  step: 0.0025, hint: '1–4% (near GDP)',       typicalMin: 0.01, typicalMax: 0.04, methods: ['DCF'] },
  { key: 'cagr',            label: '5Y Revenue CAGR',   unit: '%', min: -0.05, max: 0.60,  step: 0.005,  hint: '5–25% growth cos',      typicalMin: 0.05, typicalMax: 0.25, methods: ['P/E', 'Rev'] },
  { key: 'netMargin',       label: 'Exit Net Margin',   unit: '%', min: -0.20, max: 0.60,  step: 0.005,  hint: '10–30% mature cos',     typicalMin: 0.10, typicalMax: 0.30, methods: ['P/E'] },
  { key: 'exitPE',          label: 'Exit P/E',          unit: 'x', min: 5,     max: 80,    step: 0.5,    hint: '15–25× mature cos',     typicalMin: 15,   typicalMax: 25,   methods: ['P/E'] },
  { key: 'exitMultiple',    label: 'EV/EBITDA',         unit: 'x', min: 4,     max: 35,    step: 0.5,    hint: '10–20× typical',        typicalMin: 10,   typicalMax: 20,   methods: ['EBITDA'] },
  { key: 'revenueMultiple', label: 'EV/Revenue',        unit: 'x', min: 0.5,   max: 20,    step: 0.25,   hint: '2–8× for tech',         typicalMin: 2,    typicalMax: 8,    methods: ['Rev'] },
]

function fmtVal(val: number, unit: '%' | 'x'): string {
  return unit === '%' ? (val * 100).toFixed(1) + '%' : val.toFixed(1) + '×'
}

function fmtDelta(delta: number, unit: '%' | 'x'): string {
  if (unit === '%') {
    const pp = delta * 100
    return (pp > 0 ? '+' : '') + pp.toFixed(1) + 'pp'
  }
  return (delta > 0 ? '+' : '') + delta.toFixed(1) + '×'
}

function SparkBars({ points, unit }: { points: SparkPoint[]; unit: '%' | 'x' }) {
  if (!points.length) return null
  const W = 44, H = 22, LABEL_H = 8, BAR_AREA = H - LABEL_H
  const vals = points.map(p => p.value)
  const hasNeg = vals.some(v => v < 0)
  const rawMax = Math.max(...vals, 0.0001)
  const rawMin = hasNeg ? Math.min(...vals) : 0
  const range = rawMax - rawMin || 0.0001
  const n = points.length
  const BAR_W = Math.max(3, Math.floor((W - (n - 1) * 2) / n))
  const totalW = n * BAR_W + (n - 1) * 2
  const offsetX = Math.floor((W - totalW) / 2)
  const zeroY = hasNeg ? (rawMax / range) * BAR_AREA : BAR_AREA
  return (
    <svg width={W} height={H} aria-hidden="true" style={{ display: 'block' }}>
      {points.map((p, i) => {
        const x = offsetX + i * (BAR_W + 2)
        const isNeg = p.value < 0
        const barH = Math.max(1.5, (Math.abs(p.value) / range) * BAR_AREA)
        const barTop = isNeg ? zeroY : zeroY - barH
        return (
          <g key={i}>
            <title>{fmtVal(p.value, unit)}</title>
            <rect x={x} y={barTop} width={BAR_W} height={barH} fill={isNeg ? '#fca5a5' : '#93c5fd'} rx={1} />
            <text x={x + BAR_W / 2} y={H} textAnchor="middle" fontSize={5.5} fill="#94a3b8"
              fontFamily="-apple-system,system-ui,sans-serif">{p.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function AssumptionCard({
  field, value, defaultValue, isDirty, onChange, sparkPoints,
}: {
  field: Field
  value: number
  defaultValue: number
  isDirty: boolean
  onChange: (v: number) => void
  sparkPoints?: SparkPoint[]
}) {
  const pct      = Math.max(0, Math.min(100, ((value - field.min) / (field.max - field.min)) * 100))
  const typLeft  = Math.max(0, Math.min(100, ((field.typicalMin - field.min) / (field.max - field.min)) * 100))
  const typWidth = Math.max(0, Math.min(100 - typLeft, ((field.typicalMax - field.typicalMin) / (field.max - field.min)) * 100))
  const primaryCfg = METHOD_CFG[field.methods[0]]
  const delta      = value - defaultValue

  function clamp(v: number): number {
    return Math.min(field.max, Math.max(field.min, Math.round(v * 100000) / 100000))
  }

  return (
    <div className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Left method-colour accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${primaryCfg.accent}`} />

      <div className="pl-[14px] pr-3 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold text-slate-700 leading-tight">{field.label}</span>
          <div className="flex items-center gap-1">
            {field.methods.map(m => (
              <span key={m} className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${METHOD_CFG[m].tagBg} ${METHOD_CFG[m].tagText}`}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Value + steppers */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <button
            onClick={() => onChange(clamp(value - field.step))}
            className="w-7 h-7 shrink-0 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-700 font-bold flex items-center justify-center text-sm transition-all select-none leading-none"
            aria-label={`Decrease ${field.label}`}
          >−</button>

          <div className="flex-1 text-center min-w-0">
            <div className={`text-[19px] font-black tabular-nums leading-none ${isDirty ? 'text-blue-600' : 'text-slate-800'}`}>
              {fmtVal(value, field.unit)}
            </div>
            <div className={`text-[9px] font-semibold mt-[3px] tabular-nums leading-none ${
              isDirty ? (delta > 0 ? 'text-emerald-500' : 'text-red-400') : 'text-slate-400'
            }`}>
              {isDirty ? fmtDelta(delta, field.unit) + ' vs default' : 'at default'}
            </div>
          </div>

          <button
            onClick={() => onChange(clamp(value + field.step))}
            className="w-7 h-7 shrink-0 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-700 font-bold flex items-center justify-center text-sm transition-all select-none leading-none"
            aria-label={`Increase ${field.label}`}
          >+</button>
        </div>

        {/* Slider track */}
        <div className="relative flex items-center mb-2" style={{ height: 16 }}>
          <div className="absolute w-full h-[3px] bg-slate-100 rounded-full" />
          {/* Typical-range zone */}
          <div
            className="absolute h-[3px] bg-slate-200 rounded-full"
            style={{ left: `${typLeft}%`, width: `${typWidth}%` }}
          />
          {/* Value fill */}
          <div
            className={`absolute h-[3px] rounded-full transition-[width] duration-150 ${isDirty ? 'bg-blue-400' : 'bg-slate-300'}`}
            style={{ width: `${pct}%` }}
          />
          {/* Thumb */}
          <div
            className={`absolute w-[12px] h-[12px] rounded-full ring-[1.5px] ring-white shadow pointer-events-none ${isDirty ? 'bg-blue-500' : 'bg-slate-400'}`}
            style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
          />
          {/* Invisible range input for drag interaction */}
          <input
            type="range"
            min={field.min} max={field.max} step={field.step} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            aria-label={field.label}
          />
        </div>

        {/* Hint + sparkline */}
        <div className="flex items-end justify-between gap-1">
          <p className="text-[9px] text-slate-400 leading-tight">{field.hint}</p>
          {sparkPoints && sparkPoints.length > 0 && (
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-[7px] uppercase tracking-wide text-slate-300 leading-none">hist</span>
              <SparkBars points={sparkPoints} unit={field.unit} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PresetsCard({
  defaults, onChange, onReset, isModified, numModified,
}: {
  defaults: ValuationAssumptions
  onChange: (a: ValuationAssumptions) => void
  onReset: () => void
  isModified: boolean
  numModified: number
}) {
  function applyPreset(waccMult: number, cagrDelta: number) {
    onChange({
      ...defaults,
      wacc: Math.round(defaults.wacc * waccMult * 100000) / 100000,
      cagr: Math.round(Math.max(defaults.cagr + cagrDelta, -0.05) * 100000) / 100000,
    })
  }

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 flex flex-col px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Presets</p>

      <div className="flex flex-col gap-2 flex-1">
        <button
          onClick={() => applyPreset(1.10, -0.03)}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 transition-colors text-left"
        >
          <span className="text-[11px] font-bold text-red-700">Bear</span>
          <span className="text-[9px] text-slate-400 leading-tight">WACC +10%  CAGR −3pp</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 transition-colors text-left"
        >
          <span className="text-[11px] font-bold text-blue-700">Base</span>
          <span className="text-[9px] text-slate-400 leading-tight">Model defaults</span>
        </button>

        <button
          onClick={() => applyPreset(0.90, 0.03)}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 transition-colors text-left"
        >
          <span className="text-[11px] font-bold text-emerald-700">Bull</span>
          <span className="text-[9px] text-slate-400 leading-tight">WACC −10%  CAGR +3pp</span>
        </button>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isModified ? 'bg-blue-500' : 'bg-slate-300'}`} />
          <span className="text-[9px] text-slate-400">
            {isModified
              ? <><span className="font-semibold text-blue-600">{numModified}</span> modified</>
              : 'At defaults'}
          </span>
        </div>
      </div>
    </div>
  )
}

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
}

export default function AssumptionsPanel({
  assumptions, defaults, onChange, onReset, onUndo, canUndo,
  historicalData, blendedFairValue, defaultBlendedFairValue,
}: Props) {
  const deltaPct = blendedFairValue != null && defaultBlendedFairValue != null && defaultBlendedFairValue > 0
    ? (blendedFairValue - defaultBlendedFairValue) / defaultBlendedFairValue
    : null

  const numModified = FIELDS.filter(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001).length
  const isModified  = numModified > 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Model Assumptions</p>
          {deltaPct != null && isModified && Math.abs(deltaPct) > 0.001 && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              deltaPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct * 100).toFixed(1)}% blended FV
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {canUndo && onUndo && (
            <button
              onClick={onUndo}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
            >
              ↩ Undo
            </button>
          )}
          <button
            onClick={onReset}
            disabled={!isModified}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-blue-200 transition-all"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* 2-column grid: 7 assumption cards + 1 presets card */}
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(f => {
          const val    = assumptions[f.key] as number
          const defVal = defaults[f.key]  as number
          const isDirty = Math.abs(val - defVal) > 0.00001
          return (
            <AssumptionCard
              key={f.key}
              field={f}
              value={val}
              defaultValue={defVal}
              isDirty={isDirty}
              onChange={v => onChange({ ...assumptions, [f.key]: v })}
              sparkPoints={historicalData?.[f.key]}
            />
          )
        })}
        <PresetsCard
          defaults={defaults}
          onChange={onChange}
          onReset={onReset}
          isModified={isModified}
          numModified={numModified}
        />
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Modified from default
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
          <span className="inline-block w-5 h-[3px] rounded-full bg-slate-200" />
          Typical range
        </div>
        <div className="flex items-center gap-3 text-[9px] text-slate-400 ml-auto">
          {(['DCF', 'P/E', 'EBITDA', 'Rev'] as MethodKey[]).map(m => (
            <span key={m} className="flex items-center gap-1">
              <span className={`w-1.5 h-3 rounded-sm ${METHOD_CFG[m].accent}`} />
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
