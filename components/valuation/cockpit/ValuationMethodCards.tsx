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
  const validTotal = methods
    .filter(m => m.fairValue != null && m.fairValue > 0)
    .reduce((s, m) => s + m.weight, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <div className="flex items-center gap-1.5 mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Valuation Models</p>
        <span
          title="Weights (35/30/25/10) follow a Damodaran-inspired blend emphasising earnings-based multiples. Weights are redistributed proportionally when a method lacks data."
          className="w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold flex items-center justify-center cursor-help select-none shrink-0"
        >?</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {methods.map(m => {
          const conf = CONFIDENCE_STYLE[m.confidence]
          const upColor = m.upsidePct != null ? (m.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'
          const keyDriver = KEY_DRIVERS[m.id]
          const hasValue = m.fairValue != null && m.fairValue > 0
          const effectiveWeight = hasValue && validTotal > 0 ? m.weight / validTotal : 0
          const nominalPct = Math.round(m.weight * 100)
          const effectivePct = Math.round(effectiveWeight * 100)
          const weightChanged = hasValue && Math.abs(effectivePct - nominalPct) >= 2
          return (
            <div key={m.id} className={`rounded-xl border px-4 py-4 flex flex-col gap-2 ${hasValue ? 'border-slate-200 bg-slate-50' : 'border-amber-100 bg-amber-50/40'}`}>
              {/* Header row: method name + confidence badge */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-700 leading-tight">{m.method}</p>
                {hasValue ? (
                  <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>
                    {conf.label}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    N/A
                  </span>
                )}
              </div>

              {/* Fair value */}
              <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
                {m.fairValue != null ? fmtPrice(m.fairValue, currency) : (
                  <span className="text-slate-300 text-xl">—</span>
                )}
              </p>

              {/* Error reason — shown when method fails */}
              {!hasValue && m.errors.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                  <p className="text-[10px] font-semibold text-amber-700 leading-snug">
                    {m.errors[0]}
                  </p>
                  {m.errors.length > 1 && (
                    <p className="text-[9px] text-amber-500 mt-0.5 leading-snug">
                      +{m.errors.length - 1} more issue{m.errors.length > 2 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

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

              {/* Blend weight — show effective weight when redistributed */}
              <div className="text-[10px] text-slate-400 mt-auto pt-1 border-t border-slate-200">
                {hasValue ? (
                  weightChanged ? (
                    <span>
                      <span className="font-semibold text-blue-600">{effectivePct}%</span>
                      {' '}effective weight
                      <span className="text-slate-300 ml-1">(nominal {nominalPct}%)</span>
                    </span>
                  ) : (
                    <span>{nominalPct}% blend weight</span>
                  )
                ) : (
                  <span className="text-amber-400">excluded from blend</span>
                )}
              </div>
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
