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
  'Fairly Valued':     { text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700 border-blue-200' },
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
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-100">
        {/* Current Price */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Price</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
            {fmtPrice(currentPrice, currency)}
          </p>
          {changePct != null && (
            <p className={`text-xs font-semibold tabular-nums ${changePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% today
            </p>
          )}
        </div>

        {/* Blended Fair Value */}
        <div className="px-5 py-4 flex flex-col gap-1 border-t-2 border-blue-500">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400" title="Weighted average of available valuation models. Unavailable models are excluded and weights redistributed.">Blended Fair Value</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
            {output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'}
          </p>
          <p className="text-xs text-slate-400">
            {methodsComputed} of {output.methods.length} models{methodsComputed < output.methods.length ? ' · weights redistributed' : ''}
          </p>
        </div>

        {/* Upside / Downside */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Upside / Downside</p>
          <p className={`text-2xl font-bold tabular-nums leading-none ${upColor}`}>
            {output.upsidePct != null ? `${upsideSign}${(output.upsidePct * 100).toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs text-slate-400">vs current price</p>
        </div>

        {/* Investment Verdict */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Investment Verdict</p>
          <p className={`text-xl font-bold leading-tight ${vstyle.text}`}>{output.verdict}</p>
          {output.upsidePct != null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border self-start ${vstyle.badge}`}>
              {methodsComputed} of {output.methods.length} models
            </span>
          )}
        </div>

        {/* Market-Implied CAGR */}
        <div className="px-5 py-4 flex flex-col gap-1 col-span-2 md:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400" title="The revenue CAGR the market is pricing into the current share price, derived from a reverse DCF.">Market-Implied CAGR</p>
          {output.marketImpliedGrowth != null ? (
            <>
              <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
                {(output.marketImpliedGrowth * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-slate-400">5Y CAGR priced in by market</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">—</p>
          )}
        </div>
      </div>
    </div>
  )
}
