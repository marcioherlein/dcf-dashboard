'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  methods: CockpitMethodResult[]
  currentPrice: number
  currency: string
}

const CONFIDENCE_BADGE = {
  high:   'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]',
  medium: 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]',
  low:    'bg-[#F4F3EF] text-[#566174] border-[#E3E1DA]',
}

export default function ModelBreakdownTable({ methods, currentPrice: _currentPrice, currency }: Props) {
  return (
    <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6] mb-3">Model Breakdown</p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E3E1DA]">
              <th className="text-left text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider pb-2 pr-3">Method</th>
              <th className="text-right text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider pb-2 pr-3">Fair Value</th>
              <th className="text-right text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider pb-2 pr-3">vs Current</th>
              <th className="text-right text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider pb-2 pr-3">Weight</th>
              <th className="text-left text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider pb-2 pr-3">Confidence</th>
              <th className="text-left text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider pb-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m, i) => {
              const upColor = m.upsidePct != null
                ? (m.upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')
                : 'text-[#8A95A6]'
              return (
                <tr key={m.id} className={`${i < methods.length - 1 ? 'border-b border-[#F4F3EF]' : ''}`}>
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold text-[#06101F]">{m.method}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-[#06101F]">
                    {m.fairValue != null ? fmtPrice(m.fairValue, currency) : (
                      <span className="text-[#8A95A6] text-[10px]">
                        {m.errors[0]?.slice(0, 24) ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums font-semibold ${upColor}`}>
                    {m.upsidePct != null
                      ? `${m.upsidePct >= 0 ? '+' : ''}${(m.upsidePct * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-[#566174]">
                    {Math.round(m.weight * 100)}%
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${CONFIDENCE_BADGE[m.confidence]}`}>
                      {m.confidence}
                    </span>
                  </td>
                  <td className="py-2.5 text-[#8A95A6] text-[10px] max-w-[160px]">
                    {m.description}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#8A95A6] mt-2 leading-relaxed">
        Blended fair value = weighted average of available methods. Missing methods excluded from blend with weights redistributed.
      </p>
    </div>
  )
}
