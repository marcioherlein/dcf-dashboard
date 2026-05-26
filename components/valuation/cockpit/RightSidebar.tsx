'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput, CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  output: CockpitOutput
  currentPrice: number
  currency: string
  ticker: string
  onViewFullDCF?: () => void
  onViewAllAssumptions?: () => void
}

const VERDICT_COLORS = {
  Undervalued:         'text-emerald-400',
  'Fairly Valued':     'text-amber-400',
  Overvalued:          'text-red-400',
  'Insufficient Data': 'text-white/40',
}

function ConfidenceRangeBar({ methods, blendedFairValue, currentPrice, currency }: {
  methods: CockpitMethodResult[]
  blendedFairValue: number | null
  currentPrice: number
  currency: string
}) {
  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  if (valid.length < 2) return null
  const vals = valid.map(m => m.fairValue!)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min
  const blendedPct = blendedFairValue != null && range > 0
    ? Math.max(2, Math.min(98, ((blendedFairValue - min) / range) * 100))
    : null
  const currentPct = range > 0
    ? Math.max(2, Math.min(98, ((currentPrice - min) / range) * 100))
    : null

  return (
    <div>
      <div className="flex justify-between text-[9px] text-white/40 mb-1.5">
        <span>{fmtPrice(min, currency)}</span>
        <span className="text-white/25">model range</span>
        <span>{fmtPrice(max, currency)}</span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 via-amber-400/40 to-emerald-500/40 rounded-full" />
        {/* Current price tick */}
        {currentPct != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50"
            style={{ left: `${currentPct}%` }}
          />
        )}
        {/* Blended value dot */}
        {blendedPct != null && (
          <div
            className="absolute w-3 h-3 bg-white rounded-full shadow-sm"
            style={{ left: `${blendedPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] text-white/30 mt-1">
        <span>Low</span>
        {range > 0 && currentPrice > 0 && (
          <span>{(range / currentPrice * 100).toFixed(0)}% spread</span>
        )}
        <span>High</span>
      </div>
    </div>
  )
}

function WeightBars({ methods }: { methods: CockpitMethodResult[] }) {
  const colors = ['bg-blue-400', 'bg-indigo-400', 'bg-violet-400', 'bg-purple-400']
  return (
    <div className="flex flex-col gap-2.5">
      {methods.map((m, i) => (
        <div key={m.id} className="flex items-center gap-2">
          <span className="text-[9px] text-white/60 w-24 shrink-0 truncate">{m.method}</span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${colors[i]} ${m.fairValue == null ? 'opacity-30' : ''} transition-all`}
              style={{ width: `${m.weight * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-white/50 w-6 text-right tabular-nums">{Math.round(m.weight * 100)}%</span>
        </div>
      ))}
    </div>
  )
}

export default function RightSidebar({ output, currentPrice, currency, ticker, onViewFullDCF, onViewAllAssumptions }: Props) {
  const hasData = output.blendedFairValue != null
  const vColor = VERDICT_COLORS[output.verdict]
  const upsideSign = output.upsidePct != null && output.upsidePct >= 0 ? '+' : ''
  const upColor = output.upsidePct != null ? (output.upsidePct >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white/40'

  return (
    <div className="bg-[#0f1a2e] rounded-xl px-5 py-5 flex flex-col gap-5 h-fit sticky top-4">
      {/* Blended Estimate + Verdict */}
      {hasData && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Blended Estimate</p>
          <p className="text-2xl font-bold tabular-nums text-white leading-none mb-1.5">
            {fmtPrice(output.blendedFairValue!, currency)}
          </p>
          <div className="flex items-center gap-2">
            {output.upsidePct != null && (
              <span className={`text-sm font-bold tabular-nums ${upColor}`}>
                {upsideSign}{(output.upsidePct * 100).toFixed(1)}%
              </span>
            )}
            <span className={`text-[11px] font-bold ${vColor}`}>{output.verdict}</span>
          </div>
        </div>
      )}

      {/* Model Confidence Range */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Model Range</p>
        <ConfidenceRangeBar
          methods={output.methods}
          blendedFairValue={output.blendedFairValue}
          currentPrice={currentPrice}
          currency={currency}
        />
      </div>

      {/* Model Weights */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Model Weights</p>
        <WeightBars methods={output.methods} />
      </div>

      {/* What's Next */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">What&apos;s Next?</p>
        <div className="flex flex-col gap-1.5">
          {onViewAllAssumptions && (
            <button
              onClick={onViewAllAssumptions}
              className="flex items-start gap-2.5 text-left text-[11px] text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2.5 transition-colors"
            >
              <span className="text-sm leading-none mt-0.5 shrink-0">⚙️</span>
              <div>
                <p className="font-semibold">Open Assumptions Editor</p>
                <p className="text-[9px] text-white/40 mt-0.5">Adjust WACC, margins and multiples</p>
              </div>
            </button>
          )}
          <a
            href={`/simplifier/${ticker}`}
            className="flex items-start gap-2.5 text-[11px] text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2.5 transition-colors"
          >
            <span className="text-sm leading-none mt-0.5 shrink-0">💾</span>
            <div>
              <p className="font-semibold">Save Valuation</p>
              <p className="text-[9px] text-white/40 mt-0.5">Track when price hits your estimate</p>
            </div>
          </a>
          <button
            onClick={() => {
              if (output.blendedFairValue != null) {
                navigator.clipboard?.writeText(output.blendedFairValue.toFixed(2)).catch(() => {})
              }
            }}
            className="flex items-start gap-2.5 text-left text-[11px] text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2.5 transition-colors"
          >
            <span className="text-sm leading-none mt-0.5 shrink-0">📋</span>
            <div>
              <p className="font-semibold">Copy Fair Value</p>
              <p className="text-[9px] text-white/40 mt-0.5">Copy blended estimate to clipboard</p>
            </div>
          </button>
          {onViewFullDCF && (
            <button
              onClick={onViewFullDCF}
              className="flex items-start gap-2.5 text-left text-[11px] text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2.5 transition-colors"
            >
              <span className="text-sm leading-none mt-0.5 shrink-0">📊</span>
              <div>
                <p className="font-semibold">View Full DCF Model</p>
                <p className="text-[9px] text-white/40 mt-0.5">Edit year-by-year projections</p>
              </div>
            </button>
          )}
        </div>
      </div>

      <p className="text-[9px] text-white/20 leading-relaxed pt-2 border-t border-white/10">
        Blended estimate from Forward P/E, EV/EBITDA, Revenue Multiple, and Core DCF. Not investment advice.
      </p>
    </div>
  )
}
