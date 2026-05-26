'use client'

import { fmtPrice } from '@/lib/formatters'
import type { DivergenceAnalysis } from '@/lib/valuation/cockpit'

interface Props {
  divergence: DivergenceAnalysis
  blendedFairValue: number | null
  currency: string
}

const LEVEL_STYLE = {
  low:      { bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', label: 'Models agree',      dot: 'bg-emerald-500' },
  moderate: { bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     label: 'Moderate spread',   dot: 'bg-amber-500' },
  high:     { bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-100 text-red-700',         label: 'High divergence',   dot: 'bg-red-500' },
}

const CONFIDENCE_STYLE = {
  high:   { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'High confidence' },
  medium: { badge: 'bg-amber-100 text-amber-700 border-amber-200',       label: 'Medium confidence' },
  low:    { badge: 'bg-red-100 text-red-700 border-red-200',             label: 'Low confidence' },
}

const DIRECTION_ICON = {
  above:  '↑',
  below:  '↓',
  inline: '≈',
}

const DIRECTION_COLOR = {
  above:  'text-blue-600',
  below:  'text-slate-500',
  inline: 'text-emerald-600',
}

export default function ModelDivergencePanel({ divergence, blendedFairValue, currency }: Props) {
  const s = LEVEL_STYLE[divergence.level]

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} px-5 py-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${s.dot}`} />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Model Divergence</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CONFIDENCE_STYLE[divergence.overallConfidence].badge}`}>
            {CONFIDENCE_STYLE[divergence.overallConfidence].label}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-700 leading-relaxed mb-4">{divergence.summary}</p>

      {/* Stats row */}
      <div className="flex gap-6 mb-4 pb-4 border-b border-black/5">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Spread vs price</p>
          <p className="text-sm font-bold tabular-nums text-slate-800">
            {(divergence.spreadVsPrice * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Coeff. of variation</p>
          <p className="text-sm font-bold tabular-nums text-slate-800">
            {(divergence.cv * 100).toFixed(0)}%
          </p>
        </div>
        {blendedFairValue != null && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Blended estimate</p>
            <p className="text-sm font-bold tabular-nums text-slate-800">
              {fmtPrice(blendedFairValue, currency)}
            </p>
          </div>
        )}
      </div>

      {/* Per-method explanations */}
      <div className="flex flex-col gap-3">
        {divergence.methodExplanations.map(e => {
          const cs = CONFIDENCE_STYLE[e.confidence]
          return (
            <div key={e.methodId} className="flex gap-3 items-start">
              {/* Direction indicator */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold ${DIRECTION_COLOR[e.direction]} bg-white/70`}>
                {DIRECTION_ICON[e.direction]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-slate-700">{e.methodName}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cs.badge}`}>
                    {cs.label}
                  </span>
                  {e.deviationPct > 0.05 && (
                    <span className="text-[9px] text-slate-400 tabular-nums">
                      {e.direction !== 'inline' ? `${e.direction === 'above' ? '+' : '−'}${(e.deviationPct * 100).toFixed(0)}% vs blend` : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{e.reason}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
