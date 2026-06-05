'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  methods: CockpitMethodResult[]
  currentPrice: number
  currency: string
}

const CONFIDENCE_BADGE = {
  high:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-slate-50 text-slate-500 border-slate-200',
}

export default function ModelBreakdownTable({ methods, currentPrice: _currentPrice, currency }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Model Breakdown</p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 pr-3">Method</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 pr-3">Fair Value</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 pr-3">vs Current</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 pr-3">Weight</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 pr-3">Confidence</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m, i) => {
              const upColor = m.upsidePct != null
                ? (m.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')
                : 'text-slate-400'
              return (
                <tr key={m.id} className={`${i < methods.length - 1 ? 'border-b border-slate-50' : ''}`}>
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold text-slate-700">{m.method}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-slate-800">
                    {m.fairValue != null ? fmtPrice(m.fairValue, currency) : (
                      <span className="text-slate-300 text-[10px]">
                        {m.errors[0]?.slice(0, 24) ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums font-semibold ${upColor}`}>
                    {m.upsidePct != null
                      ? `${m.upsidePct >= 0 ? '+' : ''}${(m.upsidePct * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">
                    {Math.round(m.weight * 100)}%
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${CONFIDENCE_BADGE[m.confidence]}`}>
                      {m.confidence}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400 text-[10px] max-w-[160px]">
                    {m.description}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
        Blended fair value = weighted average of available methods. Missing methods excluded from blend with weights redistributed.
      </p>
    </div>
  )
}
