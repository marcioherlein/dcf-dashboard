'use client'

import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

const KEY_FIELDS = [
  { key: 'wacc'        as const, label: 'WACC',            unit: '%' as const },
  { key: 'cagr'        as const, label: '5Y Revenue CAGR', unit: '%' as const },
  { key: 'terminalG'   as const, label: 'Terminal Growth', unit: '%' as const },
  { key: 'exitMultiple' as const, label: 'Exit EV/EBITDA', unit: 'x' as const },
]

function fmt(val: number, unit: '%' | 'x') {
  return unit === '%' ? (val * 100).toFixed(1) + '%' : val.toFixed(1) + '×'
}

interface Props {
  assumptions: ValuationAssumptions
  defaults: ValuationAssumptions
  onViewAll?: () => void
}

export default function KeyAssumptions({ assumptions, defaults, onViewAll }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Key Assumptions</p>
        <span className="text-[10px] text-slate-400">Edit below ↓</span>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {KEY_FIELDS.map(f => {
          const val = assumptions[f.key] as number
          const isDirty = Math.abs(val - (defaults[f.key] as number)) > 0.00001
          return (
            <div key={f.key} className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold ${isDirty ? 'text-blue-700' : 'text-slate-600'}`}>
                {f.label}
                {isDirty && <span className="ml-1 text-[9px] text-blue-500">●</span>}
              </span>
              <span className="text-[13px] font-bold tabular-nums text-slate-800">
                {fmt(val, f.unit)}
              </span>
            </div>
          )
        })}
      </div>

      {onViewAll && (
        <button
          onClick={onViewAll}
          className="mt-4 text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition-colors text-left"
        >
          Edit all assumptions →
        </button>
      )}
    </div>
  )
}
