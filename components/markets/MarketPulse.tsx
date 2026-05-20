'use client'
import { cn } from '@/lib/utils'
import type { MarketContextPayload, SentimentLabel } from '@/lib/market-context/types'

interface Props {
  pulse: MarketContextPayload['pulse']
}

function sentimentColor(label: SentimentLabel): string {
  if (label === 'Risk-On')      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (label === 'Constructive') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (label === 'Neutral')      return 'bg-white/8 text-slate-300 border-white/10'
  if (label === 'Cautious')     return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

function vixColor(vix: number): string {
  if (vix < 15) return 'text-amber-400'
  if (vix < 20) return 'text-emerald-400'
  if (vix < 25) return 'text-slate-200'
  if (vix < 35) return 'text-red-400'
  return 'text-red-400'
}

export default function MarketPulse({ pulse }: Props) {
  const { spxChange1d, vix, tnxYield, sentimentLabel } = pulse
  const spxUp = spxChange1d >= 0

  return (
    <div className="rounded-xl border border-[rgba(59,130,246,0.15)] glass-card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-100">Market Pulse</h2>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', sentimentColor(sentimentLabel))}>
          {sentimentLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {/* SPX change */}
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">S&P 500</p>
          <p className={cn('text-2xl font-extrabold font-mono tabular-nums', spxUp ? 'text-emerald-400' : 'text-red-400')}>
            {spxUp ? '+' : ''}{spxChange1d.toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Today</p>
        </div>
        {/* VIX */}
        <div className="text-center border-x border-[rgba(59,130,246,0.15)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">VIX</p>
          <p className={cn('text-2xl font-extrabold font-mono tabular-nums', vixColor(vix))}>
            {vix.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Fear Index</p>
        </div>
        {/* 10Y yield */}
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">10Y Treasury</p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-100">
            {tnxYield.toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Yield</p>
        </div>
      </div>
    </div>
  )
}
