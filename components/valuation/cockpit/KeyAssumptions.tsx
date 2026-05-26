'use client'

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

const KEY_FIELDS = [
  { key: 'wacc'    as const, label: 'WACC',           unit: '%' as const, step: 0.0025, min: 0.04, max: 0.25 },
  { key: 'cagr'    as const, label: '5Y Rev. CAGR',   unit: '%' as const, step: 0.005,  min: -0.05, max: 0.60 },
  { key: 'terminalG' as const, label: 'Terminal G',   unit: '%' as const, step: 0.0025, min: 0.005, max: 0.05 },
  { key: 'exitMultiple' as const, label: 'EV/EBITDA', unit: 'x' as const, step: 0.5,   min: 4, max: 35 },
]

function fmt(val: number, unit: '%' | 'x') {
  return unit === '%' ? (val * 100).toFixed(1) + '%' : val.toFixed(1) + '×'
}

interface Props {
  assumptions: ValuationAssumptions
  defaults: ValuationAssumptions
  onChange: (a: ValuationAssumptions) => void
  onReset: () => void
  onViewAll?: () => void
}

export default function KeyAssumptions({ assumptions, defaults, onChange, onReset, onViewAll }: Props) {
  function adjust(key: keyof ValuationAssumptions, delta: number) {
    const f = KEY_FIELDS.find(x => x.key === key)!
    const next = Math.min(f.max, Math.max(f.min, (assumptions[key] as number) + delta))
    onChange({ ...assumptions, [key]: Math.round(next * 100000) / 100000 })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Key Assumptions</p>
        <button
          onClick={onReset}
          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {KEY_FIELDS.map(f => {
          const val = assumptions[f.key] as number
          const isDirty = Math.abs(val - (defaults[f.key] as number)) > 0.00001
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className={`text-[11px] font-semibold ${isDirty ? 'text-blue-700' : 'text-slate-600'}`}>
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
                    {fmt(val, f.unit)}
                  </span>
                  <button
                    onClick={() => adjust(f.key, f.step)}
                    className="w-5 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-[14px] font-bold flex items-center justify-center transition-colors leading-none"
                    aria-label={`Increase ${f.label}`}
                  >+</button>
                </div>
              </div>
              {/* thin progress bar */}
              <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] ${isDirty ? 'bg-blue-500' : 'bg-slate-300'}`}
                  style={{ width: `${Math.max(0, Math.min(100, ((val - f.min) / (f.max - f.min)) * 100))}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {onViewAll && (
        <button
          onClick={onViewAll}
          className="mt-4 text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition-colors text-left"
        >
          View all assumptions →
        </button>
      )}
    </div>
  )
}
