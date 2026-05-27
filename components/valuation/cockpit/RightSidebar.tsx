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

const VERDICT_COLORS = {
  Undervalued:         { text: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  'Fairly Valued':     { text: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/30' },
  Overvalued:          { text: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30' },
  'Insufficient Data': { text: 'text-white/60',    bg: 'bg-white/5 border-white/10' },
}

const DIVERGENCE_STYLE = {
  low:      { text: 'text-emerald-400', label: 'Models agree' },
  moderate: { text: 'text-amber-400',   label: 'Moderate spread' },
  high:     { text: 'text-red-400',     label: 'High divergence' },
}

const METHOD_COLORS = ['bg-blue-400', 'bg-indigo-400', 'bg-violet-400', 'bg-purple-400']

function ModelAnalysis({ methods, blendedFairValue, currentPrice, currency }: {
  methods: CockpitMethodResult[]
  blendedFairValue: number | null
  currentPrice: number
  currency: string
}) {
  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)

  return (
    <div>
      {/* Range bar — only if 2+ methods computed */}
      {valid.length >= 2 && (() => {
        const vals = valid.map(m => m.fairValue!)
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const range = max - min
        const blendedPct = blendedFairValue != null && range > 0
          ? Math.max(3, Math.min(97, ((blendedFairValue - min) / range) * 100))
          : null
        const currentPct = range > 0
          ? Math.max(3, Math.min(97, ((currentPrice - min) / range) * 100))
          : null
        return (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-white/60 mb-1.5">
              <span>{fmtPrice(min, currency)}</span>
              <span className="text-white/40">model range</span>
              <span>{fmtPrice(max, currency)}</span>
            </div>
            <div className="relative h-3 bg-white/10 rounded-full">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 via-amber-400/40 to-emerald-500/40 rounded-full" />
              {/* Current price — vertical tick with "Now" label */}
              {currentPct != null && (
                <div className="absolute top-0 h-full w-0.5 bg-white/70" style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }} />
              )}
              {/* Blended estimate dot */}
              {blendedPct != null && (
                <div
                  className="absolute w-4 h-4 bg-white rounded-full shadow border-2 border-blue-400"
                  style={{ left: `${blendedPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                />
              )}
            </div>
            {/* "Now" label under current price tick */}
            {currentPct != null && (
              <div className="relative h-4 mt-0.5">
                <span
                  className="absolute text-[10px] text-white/50 -translate-x-1/2"
                  style={{ left: `${currentPct}%` }}
                >Now</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Weight bars with N/A treatment */}
      <div className="flex flex-col gap-2.5">
        {methods.map((m, i) => {
          const isAvail = m.fairValue != null
          return (
            <div key={m.id} className="flex items-center gap-2">
              <span className={`text-[10px] w-24 shrink-0 truncate ${isAvail ? 'text-white/70' : 'text-white/30 line-through'}`}>
                {m.method}
              </span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                {isAvail ? (
                  <div
                    className={`h-full rounded-full ${METHOD_COLORS[i]} transition-all`}
                    style={{ width: `${m.weight * 100}%` }}
                  />
                ) : (
                  <div className="h-full w-full bg-white/[0.05] rounded-full" />
                )}
              </div>
              <span className={`text-[10px] w-7 text-right tabular-nums ${isAvail ? 'text-white/60' : 'text-white/30'}`}>
                {isAvail ? `${Math.round(m.weight * 100)}%` : 'N/A'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RightSidebar({ output, currentPrice, currency, ticker, onViewFullDCF }: Props) {
  const vc = VERDICT_COLORS[output.verdict]
  const ds = DIVERGENCE_STYLE[output.divergence.level]

  return (
    <div className="bg-[#0f1a2e] rounded-xl px-5 py-5 flex flex-col gap-5 h-fit sticky top-4">
      {/* Verdict + Divergence badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${vc.bg} ${vc.text}`}>
          {output.verdict}
        </span>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full bg-white/5 border border-white/10 ${ds.text}`}>
          {ds.label}
        </span>
      </div>

      {/* Model Analysis — range bar + weight bars merged */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Model Analysis</p>
        <ModelAnalysis
          methods={output.methods}
          blendedFairValue={output.blendedFairValue}
          currentPrice={currentPrice}
          currency={currency}
        />
      </div>

      {/* Quick Actions — minimal, no duplicate of bottom CTA */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2">Quick Actions</p>
        <div className="flex flex-col gap-1.5">
          <a
            href={`/simplifier/${ticker}`}
            className="text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
          >
            Save valuation →
          </a>
          <button
            onClick={() => {
              if (output.blendedFairValue != null) {
                navigator.clipboard?.writeText(output.blendedFairValue.toFixed(2)).catch(() => {})
              }
            }}
            disabled={output.blendedFairValue == null}
            className="text-left text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Copy fair value
          </button>
          {onViewFullDCF && (
            <button
              onClick={onViewFullDCF}
              className="text-left text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
            >
              Open Full DCF Model ↓
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-white/30 leading-relaxed pt-2 border-t border-white/10">
        Blended estimate from Forward P/E, EV/EBITDA, Revenue Multiple, and Core DCF. Not investment advice.
      </p>
    </div>
  )
}
