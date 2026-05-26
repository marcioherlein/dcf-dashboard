'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput } from '@/lib/valuation/cockpit'

interface Props {
  output: CockpitOutput
  currentPrice: number
  changePct: number | null
  currency: string
}

const VERDICT_STYLE = {
  Undervalued:         { text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'Fairly Valued':     { text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  Overvalued:          { text: 'text-red-600',     badge: 'bg-red-100 text-red-700 border-red-200' },
  'Insufficient Data': { text: 'text-slate-500',   badge: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default function SummaryCards({ output, currentPrice, changePct, currency }: Props) {
  const vstyle = VERDICT_STYLE[output.verdict]
  const upsideSign = output.upsidePct != null && output.upsidePct >= 0 ? '+' : ''
  const upColor = output.upsidePct != null ? (output.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'
  const methodsComputed = output.methods.filter(m => m.fairValue != null).length

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
        {/* Current Price */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Price</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
            {fmtPrice(currentPrice, currency)}
          </p>
          {changePct != null && (
            <p className={`text-[11px] font-semibold tabular-nums ${changePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% today
            </p>
          )}
        </div>

        {/* Blended Fair Value */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Blended Fair Value</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
            {output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'}
          </p>
          <p className="text-[10px] text-slate-400">{methodsComputed} of {output.methods.length} methods</p>
        </div>

        {/* Upside / Downside */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Upside / Downside</p>
          <p className={`text-2xl font-bold tabular-nums leading-none ${upColor}`}>
            {output.upsidePct != null
              ? `${upsideSign}${(output.upsidePct * 100).toFixed(1)}%`
              : '—'}
          </p>
          <p className="text-[10px] text-slate-400">vs current price</p>
        </div>

        {/* Investment Verdict */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Investment Verdict</p>
          <p className={`text-xl font-bold leading-tight ${vstyle.text}`}>{output.verdict}</p>
          {output.upsidePct != null && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border self-start ${vstyle.badge}`}>
              {methodsComputed} models agree
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
