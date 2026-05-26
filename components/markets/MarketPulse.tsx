'use client'
import { cn } from '@/lib/utils'
import type { MarketContextPayload, SentimentLabel } from '@/lib/market-context/types'

interface Props {
  pulse: MarketContextPayload['pulse']
}

function sentimentColor(label: SentimentLabel): string {
  if (label === 'Risk-On')      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (label === 'Constructive') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (label === 'Neutral')      return 'bg-slate-100 text-slate-600 border-slate-200'
  if (label === 'Cautious')     return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-red-50 text-red-700 border-red-200'
}

// VIX color: low VIX = calm = green, high VIX = fear = red
function vixColor(vix: number): string {
  if (vix < 15) return 'text-emerald-600'  // complacent calm
  if (vix < 20) return 'text-slate-700'    // normal
  if (vix < 25) return 'text-amber-600'    // elevated
  if (vix < 35) return 'text-red-600'      // fear
  return 'text-red-700'                    // panic
}

function gaugeColor(score: number): string {
  if (score >= 75) return '#059669'  // emerald-600
  if (score >= 60) return '#16a34a'  // green-600
  if (score >= 40) return '#d97706'  // amber-600
  if (score >= 25) return '#ea580c'  // orange-600
  return '#dc2626'                   // red-600
}

function gaugeLabel(score: number): string {
  if (score >= 80) return 'Risk-On'
  if (score >= 65) return 'Constructive'
  if (score >= 40) return 'Neutral'
  if (score >= 25) return 'Cautious'
  return 'Stressed'
}

function SentimentGauge({ score }: { score: number }) {
  const r = 36
  const cx = 50
  const cy = 46
  const halfCircumference = Math.PI * r // ≈ 113.1
  const filled = halfCircumference * (score / 100)
  const color = gaugeColor(score)

  const d = `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 50" className="w-24 h-auto">
        {/* Background arc */}
        <path d={d} fill="none" stroke="#e2e8f0" strokeWidth="7" strokeLinecap="round" />
        {/* Filled arc */}
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${halfCircumference}`}
          style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.5s ease' }}
        />
        {/* Score number */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="14" fontWeight="700" fontFamily="monospace">
          {score}
        </text>
      </svg>
      <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color }}>{gaugeLabel(score)}</p>
    </div>
  )
}

export default function MarketPulse({ pulse }: Props) {
  const { spxChange1d, vix, tnxYield, sentimentLabel, sentimentScore } = pulse
  const spxUp = spxChange1d >= 0

  const interpretation = (() => {
    if (sentimentScore >= 80) return 'Risk appetite is elevated. Broad participation and low volatility support risk assets.'
    if (sentimentScore >= 65) return 'Risk appetite is constructive. Market conditions are broadly supportive for long-duration analysis.'
    if (sentimentScore >= 40) return 'Mixed conditions. Elevated rates or uncertainty may warrant higher margin of safety in valuations.'
    if (sentimentScore >= 25) return 'Cautious market environment. Consider discount rate sensitivity in DCF assumptions.'
    return 'Risk-off conditions. Valuations may face elevated discount rates and reduced risk appetite.'
  })()

  return (
    <div className="rounded-2xl glass-card-light overflow-hidden h-full">
      <div className="px-4 py-2.5 border-b border-white/60 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market Pulse</span>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', sentimentColor(sentimentLabel))}>
          {sentimentLabel}
        </span>
      </div>
      <div className="px-5 py-4">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        {/* Left stats */}
        <div className="grid grid-cols-1 gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">S&P 500</p>
            <p className={cn('text-2xl font-extrabold font-mono tabular-nums', spxUp ? 'text-emerald-600' : 'text-red-600')}>
              {spxUp ? '+' : ''}{spxChange1d.toFixed(2)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Today</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">VIX</p>
            <p className={cn('text-2xl font-extrabold font-mono tabular-nums', vixColor(vix))}>
              {vix.toFixed(1)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Volatility</p>
          </div>
        </div>

        {/* Center gauge */}
        <div className="px-2">
          <SentimentGauge score={sentimentScore} />
        </div>

        {/* Right stats */}
        <div className="grid grid-cols-1 gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">10Y Treasury</p>
            <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
              {tnxYield.toFixed(2)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Yield</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Score</p>
            <p className="text-sm font-bold text-slate-700">{sentimentScore}/100</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Risk Appetite</p>
          </div>
        </div>
      </div>

      {/* Interpretation text */}
      <div className="mt-4 px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
        <p className="text-[11.5px] text-slate-600 leading-snug">{interpretation}</p>
      </div>
      </div>
    </div>
  )
}
