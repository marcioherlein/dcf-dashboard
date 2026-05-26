'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput, CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  output: CockpitOutput
  currentPrice: number
  currency: string
  ticker: string
  onViewFullDCF?: () => void
}

const CONFIDENCE_COLORS = {
  high:   'bg-emerald-400',
  medium: 'bg-amber-400',
  low:    'bg-slate-300',
}

function WeightBar({ methods }: { methods: CockpitMethodResult[] }) {
  const available = methods.filter(m => m.fairValue != null)
  const totalW = available.reduce((s, m) => s + m.weight, 0) || 1
  const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500']
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-2 w-full gap-px">
        {methods.map((m, i) => (
          <div
            key={m.id}
            className={`${colors[i]} ${m.fairValue == null ? 'opacity-20' : ''} transition-all`}
            style={{ width: `${(m.weight / totalW) * 100}%` }}
            title={`${m.method}: ${Math.round(m.weight * 100)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {methods.map((m, i) => (
          <div key={m.id} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${colors[i]} ${m.fairValue == null ? 'opacity-20' : ''}`} />
            <span className="text-[9px] text-white/70">{m.method}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScenarioMini({
  label, fv, wacc, cagr, currentPrice, currency, isBase,
}: {
  label: string; fv: number | null; wacc: number; cagr: number
  currentPrice: number; currency: string; isBase?: boolean
}) {
  const upside = fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null
  const upColor = upside != null ? (upside >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white/40'
  const labelColor = label === 'Bull' ? 'text-emerald-400' : label === 'Bear' ? 'text-red-400' : 'text-blue-300'
  return (
    <div className={`rounded-lg px-3 py-2.5 ${isBase ? 'bg-white/10' : 'bg-white/5'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</span>
        {upside != null && (
          <span className={`text-[10px] font-bold tabular-nums ${upColor}`}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-sm font-bold text-white tabular-nums">{fv != null ? fmtPrice(fv, currency) : '—'}</p>
      <p className="text-[9px] text-white/40 mt-0.5">
        W {(wacc * 100).toFixed(1)}% / G {(cagr * 100).toFixed(1)}%
      </p>
    </div>
  )
}

export default function RightSidebar({ output, currentPrice, currency, ticker, onViewFullDCF }: Props) {
  const hasData = output.blendedFairValue != null

  return (
    <div className="bg-[#0f1a2e] rounded-xl px-5 py-5 flex flex-col gap-5 h-fit sticky top-4">
      {/* Model Confidence */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Model Confidence</p>
        <div className="flex flex-col gap-2">
          {output.methods.map(m => (
            <div key={m.id} className="flex items-center justify-between">
              <span className="text-[11px] text-white/70">{m.method}</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${CONFIDENCE_COLORS[m.confidence]}`} />
                <span className="text-[10px] text-white/50 capitalize">{m.confidence}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Weights */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Model Weights</p>
        <WeightBar methods={output.methods} />
      </div>

      {/* Scenario Range */}
      {hasData && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Scenario Range</p>
          <div className="flex flex-col gap-2">
            <ScenarioMini label="Bull" fv={output.scenarios.bull.fairValue} wacc={output.scenarios.bull.wacc} cagr={output.scenarios.bull.cagr} currentPrice={currentPrice} currency={currency} />
            <ScenarioMini label="Base" fv={output.scenarios.base.fairValue} wacc={output.scenarios.base.wacc} cagr={output.scenarios.base.cagr} currentPrice={currentPrice} currency={currency} isBase />
            <ScenarioMini label="Bear" fv={output.scenarios.bear.fairValue} wacc={output.scenarios.bear.wacc} cagr={output.scenarios.bear.cagr} currentPrice={currentPrice} currency={currency} />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Quick Actions</p>
        <div className="flex flex-col gap-2">
          <a
            href={`/simplifier/${ticker}`}
            className="text-[11px] font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
          >
            Save valuation →
          </a>
          <button
            onClick={() => {
              if (output.blendedFairValue != null) {
                navigator.clipboard?.writeText(output.blendedFairValue.toFixed(2)).catch(() => {})
              }
            }}
            className="text-left text-[11px] font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
          >
            Copy fair value
          </button>
          {onViewFullDCF && (
            <button
              onClick={onViewFullDCF}
              className="text-left text-[11px] font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
            >
              Open Full DCF Table ↓
            </button>
          )}
        </div>
      </div>

      <p className="text-[9px] text-white/25 leading-relaxed pt-2 border-t border-white/10">
        Blended estimate from Forward P/E, EV/EBITDA, Revenue Multiple, and Core DCF. Not investment advice.
      </p>
    </div>
  )
}
