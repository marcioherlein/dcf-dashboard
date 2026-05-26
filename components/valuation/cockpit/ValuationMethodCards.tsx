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

const KEY_DRIVERS: Record<string, string> = {
  forward_pe:       'Net Margin at exit',
  ev_ebitda:        'Exit multiple · Net debt',
  revenue_multiple: '5Y CAGR · EV/Revenue',
  core_dcf:         'WACC · Terminal growth',
}

export default function ValuationMethodCards({ methods, currentPrice: _currentPrice, currency }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Valuation Models</p>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {methods.map(m => {
          const conf = CONFIDENCE_STYLE[m.confidence]
          const upColor = m.upsidePct != null ? (m.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'
          const keyDriver = KEY_DRIVERS[m.id]
          return (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 flex flex-col gap-2">
              {/* Header row: method name + confidence badge */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-700 leading-tight">{m.method}</p>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>
                  {conf.label}
                </span>
              </div>

              {/* Fair value */}
              <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
                {m.fairValue != null ? fmtPrice(m.fairValue, currency) : (
                  <span className="text-slate-300 text-base">{m.errors[0]?.slice(0, 24) ?? '—'}</span>
                )}
              </p>

              {/* Upside */}
              {m.upsidePct != null && (
                <p className={`text-sm font-semibold tabular-nums ${upColor}`}>
                  {m.upsidePct >= 0 ? '+' : ''}{(m.upsidePct * 100).toFixed(1)}% vs current
                </p>
              )}

              {/* Description */}
              <p className="text-xs text-slate-400 leading-relaxed">{m.description}</p>

              {/* Key driver */}
              {keyDriver && (
                <p className="text-xs text-slate-500">
                  <span className="font-semibold">Key driver:</span> {keyDriver}
                </p>
              )}

              {/* Blend weight */}
              <p className="text-[10px] text-slate-400 mt-auto pt-1 border-t border-slate-200">
                {Math.round(m.weight * 100)}% blend weight
              </p>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-400 mt-3 leading-relaxed">
        Blended fair value = weighted average of available methods. Missing methods excluded and weights redistributed.
      </p>
    </div>
  )
}
