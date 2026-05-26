'use client'

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

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
  { key: 'wacc',            label: 'WACC (Discount Rate)',  unit: '%', min: 0.04,  max: 0.25,  step: 0.0025, hint: '6–15% typical' },
  { key: 'cagr',            label: '5Y Revenue CAGR',       unit: '%', min: -0.05, max: 0.60,  step: 0.005,  hint: '5–25% for growth cos' },
  { key: 'terminalG',       label: 'Terminal Growth Rate',  unit: '%', min: 0.005, max: 0.05,  step: 0.0025, hint: '1–4% (near GDP)' },
  { key: 'netMargin',       label: 'Net Margin (exit yr)',  unit: '%', min: -0.20, max: 0.60,  step: 0.005,  hint: '10–30% mature cos' },
  { key: 'exitPE',          label: 'Exit P/E Multiple',     unit: 'x', min: 5,     max: 80,    step: 0.5,    hint: '15–25× mature cos' },
  { key: 'exitMultiple',    label: 'EV/EBITDA Multiple',    unit: 'x', min: 4,     max: 35,    step: 0.5,    hint: '10–20× typical' },
  { key: 'revenueMultiple', label: 'EV/Revenue Multiple',   unit: 'x', min: 0.5,   max: 20,    step: 0.25,   hint: '2–8× for tech' },
]

function fmtVal(val: number, unit: '%' | 'x'): string {
  if (unit === '%') return (val * 100).toFixed(1) + '%'
  return val.toFixed(1) + '×'
}

interface Props {
  assumptions: ValuationAssumptions
  defaults: ValuationAssumptions
  onChange: (a: ValuationAssumptions) => void
  onReset: () => void
}

export default function AssumptionsPanel({ assumptions, defaults, onChange, onReset }: Props) {
  function adjust(key: keyof ValuationAssumptions, delta: number) {
    const f = FIELDS.find(x => x.key === key)!
    const next = Math.min(f.max, Math.max(f.min, assumptions[key] + delta))
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {FIELDS.map(f => {
          const val = assumptions[f.key] as number
          const isDirty = Math.abs(val - (defaults[f.key] as number)) > 0.00001
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className={`text-[11px] font-semibold ${isDirty ? 'text-blue-700' : 'text-slate-600'}`}>
                  {f.label}
                  {isDirty && <span className="ml-1 text-[9px] text-blue-500">●</span>}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjust(f.key, -f.step)}
                    className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 text-[13px] font-bold flex items-center justify-center transition-colors"
                    aria-label={`Decrease ${f.label}`}
                  >−</button>
                  <span className="text-xs font-bold tabular-nums text-slate-800 w-12 text-center">
                    {fmtVal(val, f.unit)}
                  </span>
                  <button
                    onClick={() => adjust(f.key, f.step)}
                    className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 text-[13px] font-bold flex items-center justify-center transition-colors"
                    aria-label={`Increase ${f.label}`}
                  >+</button>
                </div>
              </div>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={val}
                onChange={e => handleSlider(f.key, e.target.value)}
                className="w-full h-1 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-[9px] text-slate-400 mt-0.5">{f.hint}</p>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-50">
        Changes apply instantly to all methods above. Blue dot = modified from default.
      </p>
    </div>
  )
}
