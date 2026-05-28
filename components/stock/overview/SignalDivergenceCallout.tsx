'use client'
import { cn } from '@/lib/utils'

interface Props {
  analystRecommendation: string
  analystTargetMean: number
  numAnalysts: number
  price: number
  currency: string
  upsidePct: number | null
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

  const isDivergent = (analystRec === 'buy' && model === 'sell') ||
                      (analystRec === 'sell' && model === 'buy')
  if (!isDivergent) return null

  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  const analystUpside = analystTargetMean > 0 && price > 0
    ? ((analystTargetMean - price) / price) * 100 : null
  const analystBullish = analystRec === 'buy'

  const shortExplanation = analystBullish
    ? 'Analysts price in growth optionality; our DCF anchors to current free cash flows. Check the Valuation tab to compare assumptions.'
    : 'Our DCF finds significant margin of safety at today\'s price. Analysts may reflect near-term caution. Review the model assumptions before acting.'

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">

      {/* Compact header row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-500 text-sm leading-none">⚡</span>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700">
          Analyst vs. Model Gap
        </p>
      </div>

      {/* Two mini-panels side by side */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">

        <div className="rounded-xl border border-amber-200 bg-white px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Wall Street{numAnalysts > 0 ? ` · ${numAnalysts} analysts` : ''}
          </p>
          <span className={cn(
            'inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-1.5',
            analystBullish
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          )}>
            {analystBullish ? 'BUY' : 'SELL'}
          </span>
          {analystTargetMean > 0 && (
            <p className="text-[12px] font-semibold text-slate-700 tabular-nums leading-tight">
              {sym}{analystTargetMean.toFixed(2)}
            </p>
          )}
          {analystUpside != null && (
            <p className={cn('text-[11px] tabular-nums', analystUpside >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {analystUpside >= 0 ? '+' : ''}{analystUpside.toFixed(1)}% from price
            </p>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 bg-white px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Intrinsico Model
          </p>
          <span className={cn(
            'inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-1.5',
            model === 'buy'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          )}>
            {model === 'buy' ? 'BUY' : 'AVOID'}
          </span>
          {fairValue != null && (
            <p className="text-[12px] font-semibold text-slate-700 tabular-nums leading-tight">
              {sym}{fairValue.toFixed(2)}
            </p>
          )}
          {upsidePct != null && (
            <p className={cn('text-[11px] tabular-nums', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}% vs price
            </p>
          )}
        </div>
      </div>

      <p className="text-[12px] text-amber-800 leading-relaxed">
        {shortExplanation}
      </p>
    </div>
  )
}
