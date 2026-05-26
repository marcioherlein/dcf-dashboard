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
  Undervalued:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  'Fairly Valued':  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  Overvalued:       { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
  'Insufficient Data': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-500' },
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-4 flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {children}
    </div>
  )
}

export default function SummaryCards({ output, currentPrice, changePct, currency }: Props) {
  const vstyle = VERDICT_STYLE[output.verdict]
  const upsideSign = output.upsidePct != null && output.upsidePct >= 0 ? '+' : ''
  const upColor = output.upsidePct != null ? (output.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Blended Fair Value */}
      <Card label="Blended Fair Value">
        <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
          {output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'}
        </p>
        {output.upsidePct != null && (
          <p className={`text-[11px] font-semibold tabular-nums ${upColor}`}>
            {upsideSign}{(output.upsidePct * 100).toFixed(1)}% vs current
          </p>
        )}
      </Card>

      {/* Current Price */}
      <Card label="Current Price">
        <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
          {fmtPrice(currentPrice, currency)}
        </p>
        {changePct != null && (
          <p className={`text-[11px] font-semibold tabular-nums ${changePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% today
          </p>
        )}
      </Card>

      {/* Investment Verdict */}
      <div className={`rounded-xl border ${vstyle.border} ${vstyle.bg} px-4 py-4 flex flex-col gap-1`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Investment Verdict</p>
        <p className={`text-base font-bold ${vstyle.text}`}>{output.verdict}</p>
        {output.upsidePct != null && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full self-start ${vstyle.badge}`}>
            {upsideSign}{(output.upsidePct * 100).toFixed(1)}% upside
          </span>
        )}
      </div>

      {/* Market-Implied Growth */}
      <Card label="Market-Implied Growth">
        {output.marketImpliedGrowth != null ? (
          <>
            <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
              {(output.marketImpliedGrowth * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
              5Y CAGR priced in by market
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </Card>

      {/* Analyst Consensus */}
      <Card label="Analyst Consensus">
        {output.methods.length > 0 ? (
          <>
            <p className="text-base font-bold text-slate-700">
              {output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'}
            </p>
            <p className="text-[10px] text-slate-400">
              {output.methods.filter(m => m.fairValue != null).length} of {output.methods.length} methods computed
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </Card>
    </div>
  )
}
