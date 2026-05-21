'use client'
import { cn } from '@/lib/utils'
import type { MarketContextPayload, SentimentLabel } from '@/lib/market-context/types'

interface Props {
  pulse: MarketContextPayload['pulse']
}

function sentimentColor(label: SentimentLabel): string {
  if (label === 'Risk-On')      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (label === 'Constructive') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (label === 'Neutral')      return 'bg-slate-100 text-slate-600 border-slate-200'
  if (label === 'Cautious')     return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

function vixColor(vix: number): string {
  if (vix < 15) return 'text-amber-600'
  if (vix < 20) return 'text-emerald-600'
  if (vix < 25) return 'text-slate-700'
  if (vix < 35) return 'text-red-600'
  return 'text-red-600'
}

export default function MarketPulse({ pulse }: Props) {
  const { spxChange1d, vix, tnxYield, sentimentLabel } = pulse
  const spxUp = spxChange1d >= 0

  return (
    <div className="rounded-xl card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-900">Market Pulse</h2>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', sentimentColor(sentimentLabel))}>
          {sentimentLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {/* SPX change */}
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">S&P 500</p>
          <p className={cn('text-2xl font-extrabold font-mono tabular-nums', spxUp ? 'text-emerald-600' : 'text-red-600')}>
            {spxUp ? '+' : ''}{spxChange1d.toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Today</p>
        </div>
        {/* VIX */}
        <div className="text-center border-x border-slate-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">VIX</p>
          <p className={cn('text-2xl font-extrabold font-mono tabular-nums', vixColor(vix))}>
            {vix.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Fear Index</p>
        </div>
        {/* 10Y yield */}
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">10Y Treasury</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
            {tnxYield.toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Yield</p>
        </div>
      </div>
    </div>
  )
}
