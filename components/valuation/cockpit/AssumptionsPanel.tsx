'use client'

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

export interface SparkPoint {
  label: string
  value: number
}

// ── Config ────────────────────────────────────────────────────────────────────

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
}

const FIELDS: Field[] = [
  { key: 'wacc',            label: 'WACC',             unit: '%', min: 0.04,  max: 0.25,  step: 0.0025, typicalMin: 0.06, typicalMax: 0.15, methods: ['DCF'],        description: 'Discount rate reflecting business risk and cost of capital.' },
  { key: 'cagr',            label: '5Y Revenue CAGR',  unit: '%', min: -0.05, max: 0.60,  step: 0.005,  typicalMin: 0.05, typicalMax: 0.25, methods: ['P/E', 'Rev'], description: 'Expected compounded revenue growth over next 5 years.' },
  { key: 'netMargin',       label: 'Exit Net Margin',  unit: '%', min: -0.20, max: 0.60,  step: 0.005,  typicalMin: 0.10, typicalMax: 0.30, methods: ['P/E'],        description: 'Net margin in steady-state year (terminal year).' },
  { key: 'exitPE',          label: 'Exit P/E (NTM)',   unit: 'x', min: 5,     max: 80,    step: 0.5,    typicalMin: 15,   typicalMax: 25,   methods: ['P/E'],        description: 'Price-to-earnings multiple applied in terminal year.' },
  { key: 'exitMultiple',    label: 'EV/EBITDA (NTM)',  unit: 'x', min: 4,     max: 35,    step: 0.5,    typicalMin: 10,   typicalMax: 20,   methods: ['EBITDA'],     description: 'Enterprise value to EBITDA multiple.' },
  { key: 'revenueMultiple', label: 'EV/Revenue (NTM)', unit: 'x', min: 0.5,   max: 20,    step: 0.25,   typicalMin: 2,    typicalMax: 8,    methods: ['Rev'],        description: 'Enterprise value to revenue multiple.' },
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

interface Stats { min: number; med: number; max: number; isReal: boolean }

function getStats(field: Field, sparkPoints?: SparkPoint[]): Stats {
  const series = sparkPoints?.filter(p => p.label !== 'curr') ?? []
  if (series.length >= 2) {
    const vals = series.map(p => p.value)
    return { min: Math.min(...vals), med: medianOf(vals), max: Math.max(...vals), isReal: true }
  }
  return { min: field.typicalMin, med: (field.typicalMin + field.typicalMax) / 2, max: field.typicalMax, isReal: false }
}

function getContextLabel(value: number, field: Field, stats: Stats, ttmVal?: number): {
  text: string; dot: string
} {
  const ref   = stats.isReal ? stats.med : ttmVal
  const label = stats.isReal ? 'historical avg' : 'recent level'
  if (ref == null) {
    if (value > field.typicalMax) return { text: `Above typical range`, dot: 'bg-amber-400' }
    if (value < field.typicalMin) return { text: `Below typical range`, dot: 'bg-emerald-400' }
    return { text: `Within typical range`, dot: 'bg-slate-400' }
  }
  const ratio = value / ref
  if (ratio < 0.94)  return { text: `Below ${label}`,          dot: 'bg-emerald-500' }
  if (ratio < 0.97)  return { text: `Slightly below ${label}`, dot: 'bg-emerald-400' }
  if (ratio <= 1.03) return { text: `Near ${label}`,           dot: 'bg-amber-400'   }
  if (ratio <= 1.07) return { text: `Slightly above ${label}`, dot: 'bg-amber-500'   }
  return               { text: `Above ${label}`,               dot: 'bg-red-400'     }
}

// ── Area Chart ────────────────────────────────────────────────────────────────

const VB_W = 260
const VB_H = 105
const MARGIN = { l: 30, r: 6, t: 8, b: 18 }
const CW = VB_W - MARGIN.l - MARGIN.r
const CH = VB_H - MARGIN.t - MARGIN.b

function AreaChart({
  sparkPoints, ttmVal, stats, inputVal, color, gradId, unit,
}: {
  sparkPoints: SparkPoint[]
  ttmVal: number | undefined
  stats: Stats
  inputVal: number
  color: string
  gradId: string
  unit: '%' | 'x'
}) {
  const series = sparkPoints.filter(p => p.label !== 'curr')
  const hasSeries = series.length >= 2

  const dataVals = hasSeries
    ? [...series.map(p => p.value), ...(ttmVal != null ? [ttmVal] : []), stats.med]
    : [stats.min, stats.med, stats.max, ...(ttmVal != null ? [ttmVal] : [])]
  const rawMin = Math.min(...dataVals)
  const rawMax = Math.max(...dataVals)
  const pad    = (rawMax - rawMin) * 0.15 || 0.005
  const yMin   = rawMin - pad
  const yMax   = rawMax + pad

  const toX = (i: number, total: number) =>
    MARGIN.l + (i / Math.max(total - 1, 1)) * CW
  const toY = (v: number) =>
    MARGIN.t + CH - ((v - yMin) / (yMax - yMin)) * CH

  const points = hasSeries ? series : []
  const allPts: Array<{ x: number; y: number; label: string }> = points.map((p, i) => ({
    x: toX(i, points.length + (ttmVal != null ? 1 : 0)),
    y: toY(p.value),
    label: p.label,
  }))
  const ttmX = hasSeries
    ? toX(points.length, points.length + 1)
    : MARGIN.l + CW
  const ttmY = ttmVal != null ? toY(ttmVal) : MARGIN.t + CH / 2

  const bottomY = MARGIN.t + CH
  const medianY = toY(stats.med)

  const yLabels = [yMax, stats.med, yMin]
  const xLabels: Array<{ x: number; label: string }> = allPts.map(p => ({ x: p.x, label: p.label }))
  if (ttmVal != null) xLabels.push({ x: ttmX, label: 'TTM' })

  const lineD = hasSeries
    ? allPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
        + (ttmVal != null ? ` L${ttmX.toFixed(1)},${ttmY.toFixed(1)}` : '')
    : ''
  const areaD = lineD
    ? `${lineD} L${ttmX.toFixed(1)},${bottomY} L${MARGIN.l},${bottomY} Z`
    : ''

  const inputY = toY(inputVal)

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id={`clip-${gradId}`}>
          <rect x={MARGIN.l} y={MARGIN.t} width={CW} height={CH} />
        </clipPath>
      </defs>

      {!hasSeries && (
        <rect
          x={MARGIN.l} y={toY(stats.max)}
          width={CW} height={Math.max(0, toY(stats.min) - toY(stats.max))}
          fill={color} fillOpacity="0.07"
          clipPath={`url(#clip-${gradId})`}
        />
      )}

      {areaD && (
        <path d={areaD} fill={`url(#${gradId})`} clipPath={`url(#clip-${gradId})`} />
      )}

      {lineD && (
        <path d={lineD} fill="none" stroke={color} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          clipPath={`url(#clip-${gradId})`} />
      )}

      <line
        x1={MARGIN.l} y1={medianY} x2={MARGIN.l + CW} y2={medianY}
        stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3"
      />

      <line
        x1={ttmX} y1={MARGIN.t} x2={ttmX} y2={bottomY}
        stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3"
      />

      <circle cx={ttmX} cy={inputY} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1.5" />

      {ttmVal != null && (
        <circle cx={ttmX} cy={ttmY} r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
      )}

      {yLabels.map((v, i) => {
        const y = toY(v)
        if (y < MARGIN.t - 4 || y > bottomY + 4) return null
        if (i === 1) {
          const topY = toY(yLabels[0])
          const botY = toY(yLabels[2])
          if (Math.abs(y - topY) < 12 || Math.abs(y - botY) < 12) return null
        }
        return (
          <text key={i} x={MARGIN.l - 4} y={y + 3.5} textAnchor="end"
            fontSize="8" fill="#94a3b8" fontFamily="sans-serif">
            {fmtVal(v, unit)}
          </text>
        )
      })}

      {xLabels.map((lbl, i) => (
        <text key={i} x={lbl.x} y={VB_H - 3} textAnchor="middle"
          fontSize="7.5" fill="#94a3b8" fontFamily="sans-serif">
          {lbl.label}
        </text>
      ))}
    </svg>
  )
}

// ── Assumption Card ───────────────────────────────────────────────────────────

function AssumptionCard({
  field, value, defaultValue, isDirty, onChange, sparkPoints, sensitivityImpact, blendedFairValue, currency,
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
}) {
  const primaryMethod = field.methods[0]
  const color  = METHOD_CFG[primaryMethod].hex
  const gradId = `grad-${field.key}`
  const stats  = getStats(field, sparkPoints)

  const currPoint = sparkPoints?.find(p => p.label === 'curr')
  const ttmVal    = currPoint?.value ?? sparkPoints?.filter(p => p.label !== 'curr').at(-1)?.value

  const ctxLabel = getContextLabel(value, field, stats, ttmVal)

  const sliderPct = Math.max(0, Math.min(100, ((value - field.min) / (field.max - field.min)) * 100))
  const delta = value - defaultValue
  const deltaDisplay = isDirty
    ? (delta >= 0 ? '+' : '') + (field.unit === '%' ? (delta * 100).toFixed(1) + 'pp' : delta.toFixed(1) + '×')
    : null

  const dollarImpact = sensitivityImpact != null && blendedFairValue != null && blendedFairValue > 0
    ? Math.abs(sensitivityImpact * blendedFairValue)
    : null

  const hasSeries = (sparkPoints?.filter(p => p.label !== 'curr').length ?? 0) >= 2

  function clamp(v: number) {
    return Math.min(field.max, Math.max(field.min, Math.round(v * 100000) / 100000))
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 sm:p-4 overflow-hidden">
      <div className="flex gap-2 sm:gap-4">

        {/* Left: controls */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Label + method chips */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider truncate">{field.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              {field.methods.map(m => (
                <span key={m} className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${METHOD_CFG[m].tagBg} ${METHOD_CFG[m].tagText}`}>
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Stepper + large value */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChange(clamp(value - field.step))}
              className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 font-bold flex items-center justify-center text-sm transition-all select-none shrink-0"
              aria-label={`Decrease ${field.label}`}
            >−</button>
            <div className="flex-1 text-center">
              <div className="text-[20px] sm:text-[28px] font-black tabular-nums leading-none tracking-tight text-slate-900">
                {fmtVal(value, field.unit)}
              </div>
              {isDirty && (
                <div className={`text-[10px] font-semibold tabular-nums mt-0.5 ${delta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {deltaDisplay} vs default
                </div>
              )}
            </div>
            <button
              onClick={() => onChange(clamp(value + field.step))}
              className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 font-bold flex items-center justify-center text-sm transition-all select-none shrink-0"
              aria-label={`Increase ${field.label}`}
            >+</button>
          </div>

          {/* Slider */}
          <div className="flex flex-col gap-1">
            <div className="relative flex items-center" style={{ height: 16 }}>
              <div className="absolute w-full h-[3px] bg-slate-100 rounded-full" />
              <div
                className="absolute h-[3px] rounded-full"
                style={{ width: `${sliderPct}%`, background: color, opacity: 0.7 }}
              />
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
              <span className="text-[9px] text-slate-400 tabular-nums">{fmtVal(field.min, field.unit)}</span>
              <span className="text-[9px] text-slate-400 tabular-nums">{fmtVal(field.max, field.unit)}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-[10px] text-slate-400 leading-relaxed">{field.description}</p>

          {/* FV impact footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">FV impact</span>
            {dollarImpact != null ? (
              <span className="text-[11px] font-bold tabular-nums text-slate-700">
                ±{currency}{dollarImpact < 10 ? dollarImpact.toFixed(2) : dollarImpact.toFixed(1)} per {field.unit === '%' ? '1pp' : '1×'}
              </span>
            ) : (
              <span className="text-[11px] text-slate-300">—</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-100 self-stretch shrink-0" />

        {/* Right: chart — hidden on very small screens to prevent overflow */}
        <div className="hidden xs:flex flex-col gap-1 shrink-0" style={{ width: 'clamp(100px, 28%, 190px)' }}>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            {hasSeries ? '5Y history' : 'Range'} ({field.unit})
          </span>
          <div className="rounded-lg bg-slate-50/80 overflow-hidden" style={{ height: 105 }}>
            <AreaChart
              sparkPoints={sparkPoints ?? []}
              ttmVal={ttmVal}
              stats={stats}
              inputVal={value}
              color={color}
              gradId={gradId}
              unit={field.unit}
            />
          </div>
          {/* Context label below chart */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${ctxLabel.dot}`} />
            <span className="text-[9px] text-slate-500 leading-tight">{ctxLabel.text}</span>
          </div>
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

  if (changes.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Largest assumption changes vs. defaults
      </p>
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
              <span className="text-[9px] text-slate-400 tabular-nums">{c.deltaFmt}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Chart Legend ──────────────────────────────────────────────────────────────

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
        <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" /></svg>
        5Y median
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
        TTM (current)
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
        <svg width="12" height="12"><line x1="6" y1="0" x2="6" y2="12" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
        Your input
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

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
}

export default function AssumptionsPanel({
  assumptions, defaults, onChange, onReset, onUndo, canUndo,
  historicalData = {}, blendedFairValue, defaultBlendedFairValue, sensitivity = {}, currency = '$',
}: Props) {
  const deltaPct = blendedFairValue != null && defaultBlendedFairValue != null && defaultBlendedFairValue > 0
    ? (blendedFairValue - defaultBlendedFairValue) / defaultBlendedFairValue
    : null

  const isModified = FIELDS.some(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) > 0.00001)

  // Preset detection
  const isBase = FIELDS.every(f => Math.abs((assumptions[f.key] as number) - (defaults[f.key] as number)) < 0.00001)
  const isBear = !isBase
    && Math.abs(assumptions.wacc - defaults.wacc * 1.10) < 0.0005
    && Math.abs(assumptions.cagr - Math.max(defaults.cagr - 0.03, -0.05)) < 0.0005
  const isBull = !isBase
    && Math.abs(assumptions.wacc - defaults.wacc * 0.90) < 0.0005
    && Math.abs(assumptions.cagr - (defaults.cagr + 0.03)) < 0.0005

  function applyPreset(waccMult: number, cagrDelta: number) {
    onChange({
      ...defaults,
      wacc: Math.round(defaults.wacc * waccMult * 100000) / 100000,
      cagr: Math.round(Math.max(defaults.cagr + cagrDelta, -0.05) * 100000) / 100000,
    })
  }

  const presets = [
    { id: 'bear', label: 'Bear', active: isBear, onClick: () => applyPreset(1.10, -0.03) },
    { id: 'base', label: 'Base', active: isBase, onClick: onReset },
    { id: 'bull', label: 'Bull', active: isBull, onClick: () => applyPreset(0.90, 0.03) },
  ]

  return (
    <div className="space-y-4">

      {/* Panel header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[18px] font-bold text-slate-900">Assumptions</p>
          <p className="text-[12px] text-slate-400 mt-0.5">Adjust key drivers and see how fair value responds</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">

          {/* Inline preset toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 bg-white">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={p.onClick}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md transition-all ${
                  p.active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
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

      {/* 2-column card grid — 2 cols on all screen sizes, reduced padding on mobile */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {FIELDS.map(f => (
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
          />
        ))}
      </div>

      {/* Largest changes bar */}
      <LargestChangesBar
        assumptions={assumptions}
        defaults={defaults}
        sensitivity={sensitivity}
      />

      {/* A note on assumptions */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
        <svg className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-[11px] text-blue-700 leading-relaxed">
          <span className="font-bold">A note on assumptions:</span> These inputs drive the blended fair value across available models. Terminal growth rate is only used in the Full DCF model. Historical data reflects FMP fiscal year figures.
        </p>
      </div>

      {/* Legend */}
      <ChartLegend />
    </div>
  )
}
