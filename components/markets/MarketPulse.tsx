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

function vixColor(vix: number): string {
  if (vix < 15) return 'text-emerald-600'
  if (vix < 20) return 'text-slate-700'
  if (vix < 25) return 'text-amber-600'
  if (vix < 35) return 'text-red-600'
  return 'text-red-700'
}

function vixLabel(vix: number): string {
  if (vix < 15) return 'Calm'
  if (vix < 20) return 'Normal'
  if (vix < 25) return 'Elevated'
  if (vix < 35) return 'Stressed'
  return 'Panic'
}

function gaugeColor(score: number): string {
  if (score >= 75) return '#059669'
  if (score >= 60) return '#16a34a'
  if (score >= 40) return '#d97706'
  if (score >= 25) return '#ea580c'
  return '#dc2626'
}

function gaugeLabel(score: number): string {
  if (score >= 80) return 'Risk-On'
  if (score >= 65) return 'Constructive'
  if (score >= 40) return 'Neutral'
  if (score >= 25) return 'Cautious'
  return 'Stressed'
}

function SentimentGauge({ score }: { score: number }) {
  const r = 38
  const cx = 50
  const cy = 48
  const halfCircumference = Math.PI * r
  const filled = halfCircumference * (score / 100)
  const color = gaugeColor(score)
  const d = `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 52" className="w-28 h-auto">
        <path d={d} fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${halfCircumference}`}
          style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.5s ease' }}
        />
        <text x={cx} y={cy - 5} textAnchor="middle" fill={color} fontSize="16" fontWeight="800">
          {score}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="600" letterSpacing="1">
          / 100
        </text>
      </svg>
      <p className="text-[11px] font-bold uppercase tracking-wider mt-0.5" style={{ color }}>{gaugeLabel(score)}</p>
    </div>
  )
}

function StatBadge({ label, value, valueClass, sub }: { label: string; value: string; valueClass: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={cn('text-[14px] font-bold tabular-nums leading-none', valueClass)}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market Pulse</span>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', sentimentColor(sentimentLabel))}>
          {sentimentLabel}
        </span>
      </div>
      <div className="px-5 py-4 flex flex-col items-center gap-4">
        <SentimentGauge score={sentimentScore} />

        <div className="flex gap-2 w-full">
          <StatBadge
            label="S&P 500"
            value={(spxUp ? '+' : '') + spxChange1d.toFixed(2) + '%'}
            valueClass={spxUp ? 'text-emerald-600' : 'text-red-600'}
            sub="Momentum"
          />
          <StatBadge
            label="VIX"
            value={vix.toFixed(1)}
            valueClass={vixColor(vix)}
            sub={vixLabel(vix)}
          />
          <StatBadge
            label="10Y Yield"
            value={tnxYield.toFixed(2) + '%'}
            valueClass="text-slate-800"
            sub="Discount Rate"
          />
        </div>

        <div className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[11px] text-slate-600 leading-snug">{interpretation}</p>
        </div>
      </div>
    </div>
  )
}
