'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  methods: CockpitMethodResult[]
  currentPrice: number
  currency: string
}

const CONFIDENCE_STYLE = {
  high:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'High Confidence' },
  medium: { bg: 'bg-amber-100',   text: 'text-amber-700',   label: '≈ Market' },
  low:    { bg: 'bg-slate-100',   text: 'text-slate-500',   label: 'Low Data' },
}

export default function ValuationMethodCards({ methods, currentPrice: _currentPrice, currency }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Valuation Models</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {methods.map(m => {
          const conf = CONFIDENCE_STYLE[m.confidence]
          const upColor = m.upsidePct != null ? (m.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'
          return (
            <div key={m.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-1 mb-1">
                <p className="text-[11px] font-bold text-slate-700 leading-tight">{m.method}</p>
                <span className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>
                  {conf.label}
                </span>
              </div>
              <p className="text-xl font-bold tabular-nums text-slate-900 leading-none">
                {m.fairValue != null ? fmtPrice(m.fairValue, currency) : (
                  <span className="text-slate-300 text-sm">{m.errors[0]?.slice(0, 20) ?? '—'}</span>
                )}
              </p>
              {m.upsidePct != null && (
                <p className={`text-[11px] font-semibold tabular-nums ${upColor}`}>
                  {m.upsidePct >= 0 ? '+' : ''}{(m.upsidePct * 100).toFixed(1)}%
                </p>
              )}
              <p className="text-[9px] text-slate-400 mt-1 leading-relaxed line-clamp-2">{m.description}</p>
              <p className="text-[9px] text-slate-400">{Math.round(m.weight * 100)}% weight</p>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
        Blended fair value = weighted average of available methods. Unavailable methods excluded and weights redistributed.
      </p>
    </div>
  )
}
