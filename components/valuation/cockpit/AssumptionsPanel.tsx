'use client'

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

export interface SparkPoint {
  label: string
  value: number
}

const METHOD_CFG = {
  DCF:    { tagBg: 'bg-blue-100',    tagText: 'text-blue-700'    },
  'P/E':  { tagBg: 'bg-violet-100',  tagText: 'text-violet-700'  },
  EBITDA: { tagBg: 'bg-amber-100',   tagText: 'text-amber-700'   },
  Rev:    { tagBg: 'bg-emerald-100', tagText: 'text-emerald-700' },
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
}

const FIELDS: Field[] = [
  { key: 'wacc',            label: 'WACC',              unit: '%', min: 0.04,  max: 0.25,  step: 0.0025, typicalMin: 0.06, typicalMax: 0.15, methods: ['DCF'] },
  { key: 'terminalG',       label: 'Terminal Growth',   unit: '%', min: 0.005, max: 0.05,  step: 0.0025, typicalMin: 0.01, typicalMax: 0.04, methods: ['DCF'] },
  { key: 'cagr',            label: '5Y Revenue CAGR',   unit: '%', min: -0.05, max: 0.60,  step: 0.005,  typicalMin: 0.05, typicalMax: 0.25, methods: ['P/E', 'Rev'] },
  { key: 'netMargin',       label: 'Exit Net Margin',   unit: '%', min: -0.20, max: 0.60,  step: 0.005,  typicalMin: 0.10, typicalMax: 0.30, methods: ['P/E'] },
  { key: 'exitPE',          label: 'Exit P/E',          unit: 'x', min: 5,     max: 80,    step: 0.5,    typicalMin: 15,   typicalMax: 25,   methods: ['P/E'] },
  { key: 'exitMultiple',    label: 'EV/EBITDA',         unit: 'x', min: 4,     max: 35,    step: 0.5,    typicalMin: 10,   typicalMax: 20,   methods: ['EBITDA'] },
  { key: 'revenueMultiple', label: 'EV/Revenue',        unit: 'x', min: 0.5,   max: 20,    step: 0.25,   typicalMin: 2,    typicalMax: 8,    methods: ['Rev'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVal(val: number, unit: '%' | 'x'): string {
  return unit === '%' ? (val * 100).toFixed(1) + '%' : val.toFixed(1) + '×'
}

function fmtDelta(delta: number, unit: '%' | 'x'): string {
  if (unit === '%') return (delta >= 0 ? '+' : '') + (delta * 100).toFixed(1) + 'pp'
  return (delta >= 0 ? '+' : '') + delta.toFixed(1) + '×'
}

function medianOf(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

// Uses all sparkPoints (including 'curr') for stats so live multiples count.
// isReal = true only when 2+ time-series (non-'curr') points exist.
function getStats(field: Field, sparkPoints?: SparkPoint[]): {
  min: number; med: number; max: number; isReal: boolean
} {
  const series = sparkPoints?.filter(p => p.label !== 'curr') ?? []
  if (series.length >= 2) {
    const vals = series.map(p => p.value)
    return { min: Math.min(...vals), med: medianOf(vals), max: Math.max(...vals), isReal: true }
  }
  // Fall back to typical range
  return { min: field.typicalMin, med: (field.typicalMin + field.typicalMax) / 2, max: field.typicalMax, isReal: false }
}

// ── Sparkline (time-series points only — excludes 'curr') ─────────────────────

function Sparkline({ points, width = 80, height = 34 }: { points: SparkPoint[]; width?: number; height?: number }) {
  const series = points.filter(p => p.label !== 'curr')
  if (series.length < 2) return <svg width={width} height={height} />

  const vals = series.map(p => p.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 0.001
  const pad = 3

  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * (width - pad * 2) + pad,
    y: height - pad - ((v - minV) / range) * (height - pad * 2),
  }))

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.5" fill="#94a3b8" />
    </svg>
  )
}

// ── Shared column layout ──────────────────────────────────────────────────────
const COL_STYLE = { gridTemplateColumns: '190px 170px 1fr 115px 125px 24px' }
const MIN_WIDTH  = 700

// ── Assumption row ─────────────────────────────────────────────────────────────

function AssumptionRow({
  field, value, defaultValue, isDirty, onChange, sparkPoints, sensitivityImpact,
}: {
  field: Field
  value: number
  defaultValue: number
  isDirty: boolean
  onChange: (v: number) => void
  sparkPoints?: SparkPoint[]
  sensitivityImpact?: number
}) {
  const stats = getStats(field, sparkPoints)

  const currPoint   = sparkPoints?.find(p => p.label === 'curr')
  const recentPoint = sparkPoints?.filter(p => p.label !== 'curr').at(-1)
  const ttmPoint    = currPoint ?? recentPoint
  const ttmVal      = ttmPoint?.value
  const ttmLabel    = currPoint != null ? 'TTM' : (recentPoint != null ? 'Recent (5Y)' : null)

  const sensText = sensitivityImpact != null
    ? (sensitivityImpact >= 0 ? '+' : '') + (sensitivityImpact * 100).toFixed(1) + '%'
    : null
  const sensUnit = field.unit === '%' ? '1pp' : '1×'

  const sliderPct = Math.max(0, Math.min(100, ((value - field.min) / (field.max - field.min)) * 100))
  const delta = value - defaultValue

  function clamp(v: number) {
    return Math.min(field.max, Math.max(field.min, Math.round(v * 100000) / 100000))
  }

  const hasSeries = (sparkPoints?.filter(p => p.label !== 'curr').length ?? 0) >= 2

  return (
    <div
      className="grid items-center px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
      style={COL_STYLE}
    >
      {/* Col 1: Assumption label + method tags */}
      <div className="flex flex-col gap-1.5 pr-4">
        <span className="text-[13px] font-semibold text-slate-800 leading-tight">{field.label}</span>
        <div className="flex items-center gap-1">
          {field.methods.map(m => (
            <span
              key={m}
              className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${METHOD_CFG[m].tagBg} ${METHOD_CFG[m].tagText}`}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Col 2: Stepper + value (with delta) + slider */}
      <div className="flex flex-col gap-1 pr-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(clamp(value - field.step))}
            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-700 font-bold flex items-center justify-center text-sm transition-all select-none shrink-0"
            aria-label={`Decrease ${field.label}`}
          >−</button>
          <div className="flex-1 text-center min-w-0">
            <div className={`text-[15px] font-bold tabular-nums leading-none ${isDirty ? 'text-blue-600' : 'text-slate-800'}`}>
              {fmtVal(value, field.unit)}
            </div>
            {isDirty && (
              <div className={`text-[9px] tabular-nums mt-[2px] leading-none ${delta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {fmtDelta(delta, field.unit)}
              </div>
            )}
          </div>
          <button
            onClick={() => onChange(clamp(value + field.step))}
            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-700 font-bold flex items-center justify-center text-sm transition-all select-none shrink-0"
            aria-label={`Increase ${field.label}`}
          >+</button>
        </div>

        {/* Slider */}
        <div className="relative flex items-center" style={{ height: 14 }}>
          <div className="absolute w-full h-[2px] bg-slate-200 rounded-full" />
          <div
            className="absolute h-[2px] rounded-full bg-blue-400 transition-[width] duration-150"
            style={{ width: `${sliderPct}%` }}
          />
          <div
            className="absolute w-[10px] h-[10px] rounded-full ring-[1.5px] ring-white shadow pointer-events-none z-[2] bg-blue-500"
            style={{ left: `${sliderPct}%`, transform: 'translateX(-50%)' }}
          />
          <input
            type="range"
            min={field.min} max={field.max} step={field.step} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            aria-label={field.label}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[9px] text-slate-400 tabular-nums">{fmtVal(field.min, field.unit)}</span>
          <span className="text-[9px] text-slate-400 tabular-nums">{fmtVal(field.max, field.unit)}</span>
        </div>
      </div>

      {/* Col 3: History stats + sparkline */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex flex-col gap-[3px] shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] tabular-nums text-slate-500 w-12">{fmtVal(stats.min, field.unit)}</span>
            <span className="text-[9px] text-slate-400">Min</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-semibold tabular-nums text-slate-700 w-12">{fmtVal(stats.med, field.unit)}</span>
            <span className="text-[9px] text-slate-400">Median</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] tabular-nums text-slate-500 w-12">{fmtVal(stats.max, field.unit)}</span>
            <span className="text-[9px] text-slate-400">Max</span>
          </div>
          {/* Honest label — distinguish real history from typical-range fallback */}
          {!stats.isReal && (
            <span className="text-[8px] text-slate-300 italic mt-0.5">typical</span>
          )}
        </div>

        <div className="flex-1 flex items-center">
          {hasSeries ? (
            <Sparkline points={sparkPoints!} width={80} height={34} />
          ) : (
            <svg width={80} height={34} viewBox="0 0 80 34">
              <line x1="3" y1="17" x2="77" y2="17" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
            </svg>
          )}
        </div>
      </div>

      {/* Col 4: Current / Median */}
      <div className="text-center px-2">
        {ttmVal != null ? (
          <>
            <p className="text-[14px] font-bold tabular-nums text-slate-700">{fmtVal(ttmVal, field.unit)}</p>
            {ttmLabel && <p className="text-[9px] text-slate-400 mt-0.5">{ttmLabel}</p>}
          </>
        ) : (
          <p className="text-[13px] text-slate-300">—</p>
        )}
      </div>

      {/* Col 5: Fair Value Impact */}
      <div className="text-right px-2">
        {sensText != null ? (
          <>
            <p className={`text-[13px] font-bold tabular-nums ${sensitivityImpact! >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {sensText}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">/ {sensUnit}</p>
          </>
        ) : (
          <p className="text-[13px] text-slate-300">—</p>
        )}
      </div>

      {/* Col 6: Chevron */}
      <div className="flex items-center justify-center text-slate-300 text-base select-none">›</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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
}

export default function AssumptionsPanel({
  assumptions, defaults, onChange, onReset, onUndo, canUndo,
  historicalData, blendedFairValue, defaultBlendedFairValue, sensitivity,
}: Props) {
  const deltaPct = blendedFairValue != null && defaultBlendedFairValue != null && defaultBlendedFairValue > 0
    ? (blendedFairValue - defaultBlendedFairValue) / defaultBlendedFairValue
    : null

  const numModified = FIELDS.filter(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001).length
  const isModified  = numModified > 0

  function applyPreset(waccMult: number, cagrDelta: number) {
    onChange({
      ...defaults,
      wacc: Math.round(defaults.wacc * waccMult * 100000) / 100000,
      cagr: Math.round(Math.max(defaults.cagr + cagrDelta, -0.05) * 100000) / 100000,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">

      {/* Panel header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[15px] font-bold text-slate-800">Assumptions</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Edit key inputs that drive your intrinsic value.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick scenario presets */}
            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden divide-x divide-slate-200 text-[11px] font-semibold">
              <button
                onClick={() => applyPreset(1.10, -0.03)}
                className="px-2.5 py-1.5 hover:bg-red-50 text-red-600 transition-colors"
                title="Bear: WACC +10%, CAGR −3pp"
              >Bear</button>
              <button
                onClick={onReset}
                className="px-2.5 py-1.5 hover:bg-blue-50 text-blue-600 transition-colors"
                title="Base: model defaults"
              >Base</button>
              <button
                onClick={() => applyPreset(0.90, 0.03)}
                className="px-2.5 py-1.5 hover:bg-emerald-50 text-emerald-600 transition-colors"
                title="Bull: WACC −10%, CAGR +3pp"
              >Bull</button>
            </div>

            {deltaPct != null && isModified && Math.abs(deltaPct) > 0.001 && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                deltaPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct * 100).toFixed(1)}% blended FV
              </span>
            )}

            {canUndo && onUndo && (
              <button
                onClick={onUndo}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
              >
                ↩ Undo
              </button>
            )}

            <button
              onClick={onReset}
              disabled={!isModified}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-800 disabled:text-slate-300 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:border-slate-100 transition-all"
            >
              ↺ Reset to defaults
            </button>
          </div>
        </div>
      </div>

      {/* Column headers + rows share one scroll container so they stay aligned on mobile */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: MIN_WIDTH }}>

          {/* Column headers */}
          <div
            className="grid px-5 py-2.5 bg-slate-50/80 border-b border-slate-100"
            style={COL_STYLE}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assumption</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pr-4">
              Your Input
              <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">Edit value</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2">
              5Y History
              <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">Min / Median / Max</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center px-2">
              Current / Median
              <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">TTM or Recent</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right px-2">
              Fair Value Impact
              <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">vs. Base Case</span>
            </span>
            <span />
          </div>

          {/* Assumption rows */}
          {FIELDS.map(f => {
            const val    = assumptions[f.key] as number
            const defVal = defaults[f.key]  as number
            return (
              <AssumptionRow
                key={f.key}
                field={f}
                value={val}
                defaultValue={defVal}
                isDirty={Math.abs(val - defVal) > 0.00001}
                onChange={v => onChange({ ...assumptions, [f.key]: v })}
                sparkPoints={historicalData?.[f.key]}
                sensitivityImpact={sensitivity?.[f.key]}
              />
            )
          })}

        </div>
      </div>

      {/* Footer legend */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          Modified from default
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
          <span className="text-[8px] italic text-slate-300">typical</span>
          No historical data — showing industry range
        </div>
        <div className="flex items-center gap-3 text-[9px] text-slate-400 ml-auto">
          {(['DCF', 'P/E', 'EBITDA', 'Rev'] as MethodKey[]).map(m => (
            <span key={m} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-sm inline-block ${
                m === 'DCF' ? 'bg-blue-400' : m === 'P/E' ? 'bg-violet-400' : m === 'EBITDA' ? 'bg-amber-400' : 'bg-emerald-400'
              }`} />
              {m}
            </span>
          ))}
        </div>
      </div>

    </div>
  )
}
