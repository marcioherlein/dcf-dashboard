'use client'
import { cn } from '@/lib/utils'
import { vixRegime } from '@/lib/market-context/scoring'
import type { MarketContextPayload, SentimentLabel } from '@/lib/market-context/types'

interface Props {
  pulse: MarketContextPayload['pulse']
}

function sentimentColor(label: SentimentLabel): string {
  if (label === 'Risk-On')      return 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
  if (label === 'Constructive') return 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]'
  if (label === 'Neutral')      return 'bg-[#F5F5F5] text-[#6B6B6B] border-[#E5E5E5]'
  if (label === 'Cautious')     return 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
  return 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
}

function vixColor(vix: number): string {
  if (vix < 15) return 'text-[#11875D]'
  if (vix < 20) return 'text-[#11875D]'
  if (vix < 25) return 'text-[#B56A00]'
  if (vix < 35) return 'text-[#D83B3B]'
  return 'text-[#D83B3B]'
}

function gaugeColor(score: number): string {
  if (score >= 75) return '#11875D'
  if (score >= 60) return '#11875D'
  if (score >= 40) return '#B56A00'
  if (score >= 25) return '#B56A00'
  return '#D83B3B'
}

function gaugeLabel(score: number): string {
  if (score >= 75) return 'Risk-On'
  if (score >= 60) return 'Constructive'
  if (score >= 40) return 'Neutral'
  if (score >= 25) return 'Cautious'
  return 'Risk-Off'
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
        <path d={d} fill="none" stroke="#E5E5E5" strokeWidth="8" strokeLinecap="round" />
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
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#6B6B6B" fontSize="7" fontWeight="600" letterSpacing="1">
          / 100
        </text>
      </svg>
      <p className="text-[11px] font-bold mt-0.5" style={{ color }}>{gaugeLabel(score)}</p>
    </div>
  )
}

function StatBadge({ label, value, valueClass, sub }: { label: string; value: string; valueClass: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-lg bg-[#F5F5F5] border border-[#E5E5E5] px-2.5 py-2 text-center">
      <p className="text-[10px] font-[700] text-[#6B6B6B] mb-1 uppercase tracking-wide leading-none">{label}</p>
      <p className={cn('text-[15px] font-[750] tabular-nums leading-none', valueClass)}>{value}</p>
      {sub && <p className="text-[10px] text-[#9B9B9B] mt-1 leading-none">{sub}</p>}
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
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 pt-3 pb-3 flex flex-col items-center gap-3 flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] font-[700] text-[#6B6B6B]">Sentiment</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sentimentColor(sentimentLabel)}`}>
            {sentimentLabel}
          </span>
        </div>
        <SentimentGauge score={sentimentScore} />

        <div className="flex gap-2 w-full">
          <StatBadge
            label="S&P 500"
            value={(spxUp ? '+' : '') + spxChange1d.toFixed(2) + '%'}
            valueClass={spxUp ? 'text-[#11875D]' : 'text-[#D83B3B]'}
            sub="Today"
          />
          <StatBadge
            label="VIX"
            value={vix.toFixed(1)}
            valueClass={vixColor(vix)}
            sub={vixRegime(vix).label}
          />
          <StatBadge
            label="10Y Yield"
            value={tnxYield.toFixed(2) + '%'}
            valueClass="text-[#111111]"
            sub="Rate"
          />
        </div>

        <div className="w-full rounded-lg bg-[#F5F5F5] border border-[#E5E5E5] px-3 py-2">
          <p className="text-[11px] text-[#6B6B6B] leading-snug">{interpretation}</p>
        </div>
      </div>
    </div>
  )
}
