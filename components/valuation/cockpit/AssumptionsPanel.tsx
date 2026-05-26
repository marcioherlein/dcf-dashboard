'use client'

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

export interface SparkPoint {
  label: string
  value: number
}

interface Field {
  key: keyof ValuationAssumptions
  label: string
  unit: '%' | 'x'
  min: number
  max: number
  step: number
  hint: string
}

const FIELDS: Field[] = [
  { key: 'wacc',            label: 'WACC',                  unit: '%', min: 0.04,  max: 0.25,  step: 0.0025, hint: '6–15% typical' },
  { key: 'cagr',            label: '5Y Revenue CAGR',       unit: '%', min: -0.05, max: 0.60,  step: 0.005,  hint: '5–25% for growth cos' },
  { key: 'terminalG',       label: 'Terminal Growth',       unit: '%', min: 0.005, max: 0.05,  step: 0.0025, hint: '1–4% (near GDP)' },
  { key: 'netMargin',       label: 'Net Margin (exit yr)',  unit: '%', min: -0.20, max: 0.60,  step: 0.005,  hint: '10–30% mature cos' },
  { key: 'exitPE',          label: 'Exit P/E',              unit: 'x', min: 5,     max: 80,    step: 0.5,    hint: '15–25× mature cos' },
  { key: 'exitMultiple',    label: 'EV/EBITDA',             unit: 'x', min: 4,     max: 35,    step: 0.5,    hint: '10–20× typical' },
  { key: 'revenueMultiple', label: 'EV/Revenue',            unit: 'x', min: 0.5,   max: 20,    step: 0.25,   hint: '2–8× for tech' },
]

function fmtVal(val: number, unit: '%' | 'x'): string {
  if (unit === '%') return (val * 100).toFixed(1) + '%'
  return val.toFixed(1) + '×'
}

// Mini sparkline bar chart
function SparkBars({ points, unit }: { points: SparkPoint[]; unit: '%' | 'x' }) {
  if (!points.length) return null

  const W = 68
  const H = 32
  const LABEL_H = 9
  const BAR_AREA = H - LABEL_H

  const vals = points.map(p => p.value)
  const hasNeg = vals.some(v => v < 0)
  const rawMin = hasNeg ? Math.min(...vals) : 0
  const rawMax = Math.max(...vals, 0.0001)
  const range = rawMax - rawMin || 0.0001

  const n = points.length
  const BAR_W = Math.max(5, Math.floor((W - (n - 1) * 2 - 2) / n))
  const totalW = n * BAR_W + (n - 1) * 2
  const offsetX = Math.floor((W - totalW) / 2)

  // Y position of zero line within bar area (from top)
  const zeroY = hasNeg ? (rawMax / range) * BAR_AREA : BAR_AREA

  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      {hasNeg && (
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#cbd5e1" strokeWidth={0.5} strokeDasharray="2 2" />
      )}
      {points.map((p, i) => {
        const x = offsetX + i * (BAR_W + 2)
        const isNeg = p.value < 0
        let barTop: number, barH: number
        if (isNeg) {
          barTop = zeroY
          barH = Math.max(1.5, ((-p.value) / range) * BAR_AREA)
        } else {
          barH = Math.max(1.5, (p.value / range) * BAR_AREA)
          barTop = zeroY - barH
        }

        return (
          <g key={i}>
            <title>{fmtVal(p.value, unit)}</title>
            <rect x={x} y={barTop} width={BAR_W} height={barH} fill={isNeg ? '#fca5a5' : '#93c5fd'} rx={1.5} />
            <text
              x={x + BAR_W / 2} y={H - 1}
              textAnchor="middle" fontSize={6.5} fill="#94a3b8"
              fontFamily="-apple-system, system-ui, sans-serif"
            >
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

interface Props {
  assumptions: ValuationAssumptions
  defaults: ValuationAssumptions
  onChange: (a: ValuationAssumptions) => void
  onReset: () => void
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
}

export default function AssumptionsPanel({ assumptions, defaults, onChange, onReset, historicalData }: Props) {
  function adjust(key: keyof ValuationAssumptions, delta: number) {
    const f = FIELDS.find(x => x.key === key)!
    const next = Math.min(f.max, Math.max(f.min, (assumptions[key] as number) + delta))
    onChange({ ...assumptions, [key]: Math.round(next * 100000) / 100000 })
  }

  function handleSlider(key: keyof ValuationAssumptions, raw: string) {
    const f = FIELDS.find(x => x.key === key)!
    const val = parseFloat(raw)
    if (!isNaN(val)) onChange({ ...assumptions, [key]: Math.min(f.max, Math.max(f.min, val)) })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assumptions</p>
        <button
          onClick={onReset}
          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {FIELDS.map(f => {
          const val = assumptions[f.key] as number
          const isDirty = Math.abs(val - (defaults[f.key] as number)) > 0.00001
          const pct = Math.max(0, Math.min(100, ((val - f.min) / (f.max - f.min)) * 100))
          const sparkPoints = historicalData?.[f.key]

          return (
            <div key={f.key} className="flex gap-3 items-start">
              {/* Main control column */}
              <div className="flex-1 min-w-0">
                {/* Row 1: label + stepper */}
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-[11px] font-semibold leading-none ${isDirty ? 'text-blue-700' : 'text-slate-600'}`}>
                    {f.label}
                    {isDirty && <span className="ml-1 text-[9px] text-blue-500">●</span>}
                  </label>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => adjust(f.key, -f.step)}
                      className="w-5 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-[14px] font-bold flex items-center justify-center transition-colors leading-none"
                      aria-label={`Decrease ${f.label}`}
                    >−</button>
                    <span className="text-[11px] font-bold tabular-nums text-slate-800 w-11 text-center">
                      {fmtVal(val, f.unit)}
                    </span>
                    <button
                      onClick={() => adjust(f.key, f.step)}
                      className="w-5 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-[14px] font-bold flex items-center justify-center transition-colors leading-none"
                      aria-label={`Increase ${f.label}`}
                    >+</button>
                  </div>
                </div>

                {/* Row 2: slider with visible fill track */}
                <div className="relative flex items-center h-4">
                  {/* Track background */}
                  <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                    <div className="w-full h-1.5 rounded-full bg-slate-200" />
                    <div
                      className="absolute left-0 h-1.5 rounded-full bg-blue-500 transition-[width]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={val}
                    onChange={e => handleSlider(f.key, e.target.value)}
                    className="relative w-full cursor-pointer appearance-none bg-transparent
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600
                      [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.25)] [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                  />
                </div>

                {/* Row 3: hint */}
                <p className="text-[9px] text-slate-400 mt-0.5">{f.hint}</p>
              </div>

              {/* Sparkline column */}
              {sparkPoints && sparkPoints.length > 0 ? (
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <p className="text-[7px] text-slate-400 uppercase tracking-wide text-center leading-none">hist</p>
                  <SparkBars points={sparkPoints} unit={f.unit} />
                </div>
              ) : (
                <div style={{ width: 68 }} />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-50">
        Changes apply instantly. Blue dot = modified from default. Grey bars = historical actuals.
      </p>
    </div>
  )
}
