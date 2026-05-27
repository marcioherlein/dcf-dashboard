'use client'
import { cn } from '@/lib/utils'

interface Props {
  // Analyst side
  analystRecommendation: string
  analystTargetMean: number
  numAnalysts: number
  price: number
  currency: string
  // Model side
  upsidePct: number | null   // positive = undervalued
  fairValue: number | null
}

function parseRec(rec: string): 'buy' | 'hold' | 'sell' {
  const r = rec.toLowerCase()
  if (r.includes('buy') || r === 'strong_buy' || r === 'strongbuy') return 'buy'
  if (r.includes('sell') || r.includes('underperform') || r.includes('underweight')) return 'sell'
  return 'hold'
}

function modelSignal(upsidePct: number | null): 'buy' | 'hold' | 'sell' | null {
  if (upsidePct == null) return null
  if (upsidePct >= 0.10) return 'buy'
  if (upsidePct <= -0.10) return 'sell'
  return 'hold'
}

export default function SignalDivergenceCallout({
  analystRecommendation, analystTargetMean, numAnalysts,
  price, currency, upsidePct, fairValue,
}: Props) {
  const analystRec = parseRec(analystRecommendation)
  const model = modelSignal(upsidePct)
  if (model == null) return null

  // Only render when the two signals meaningfully conflict
  const isDivergent = (analystRec === 'buy' && model === 'sell') ||
                      (analystRec === 'sell' && model === 'buy')
  if (!isDivergent) return null

  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  const analystUpside = analystTargetMean > 0 && price > 0
    ? ((analystTargetMean - price) / price) * 100
    : null

  const analystBullish = analystRec === 'buy'

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
        <span className="text-amber-600 text-base leading-none">⚡</span>
        <p className="text-[12px] font-bold uppercase tracking-widest text-amber-700">
          Signal Divergence
        </p>
      </div>

      {/* Two signals side by side */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 gap-3 mb-4">

          {/* Analyst signal */}
          <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Wall Street ({numAnalysts} analysts)
            </p>
            <span className={cn(
              'inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-1',
              analystBullish
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            )}>
              {analystBullish ? 'BUY' : 'SELL'}
            </span>
            {analystTargetMean > 0 && (
              <p className="text-[12px] font-semibold text-slate-700 tabular-nums">
                {sym}{analystTargetMean.toFixed(2)} avg target
              </p>
            )}
            {analystUpside != null && (
              <p className={cn('text-[11px] font-semibold tabular-nums', analystUpside >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {analystUpside >= 0 ? '+' : ''}{analystUpside.toFixed(1)}% from current
              </p>
            )}
          </div>

          {/* Model signal */}
          <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Our DCF Model
            </p>
            <span className={cn(
              'inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-1',
              model === 'buy'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            )}>
              {model === 'buy' ? 'BUY' : 'AVOID'}
            </span>
            {fairValue != null && (
              <p className="text-[12px] font-semibold text-slate-700 tabular-nums">
                {sym}{fairValue.toFixed(2)} intrinsic est.
              </p>
            )}
            {upsidePct != null && (
              <p className={cn('text-[11px] font-semibold tabular-nums', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}% vs current price
              </p>
            )}
          </div>
        </div>

        {/* Explanation */}
        <p className="text-[12px] text-amber-800 leading-relaxed">
          {analystBullish
            ? <>
                <strong>Why they differ:</strong> Sell-side analysts often price in optimistic growth scenarios and future optionality. Our DCF model anchors to current free cash flows — it may underestimate companies with high but unproven growth expectations. Both perspectives are valid; they answer different questions.
              </>
            : <>
                <strong>Why they differ:</strong> Analysts may be overly cautious, or the business has improved since their last update. Our DCF model sees a significant margin of safety at current prices based on current cash flows. Check the Valuation tab for the full model assumptions.
              </>
          }
        </p>
      </div>
    </div>
  )
}
