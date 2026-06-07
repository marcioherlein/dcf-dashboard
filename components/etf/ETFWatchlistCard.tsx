'use client'

import Link from 'next/link'
import { Trash2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPctAbs } from '@/lib/formatters'
import { computeETFScore, scoreColor, scoreLabel, scoreBadge } from '@/lib/data/etfScore'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { ETFEntry } from '@/lib/data/etfTypes'

interface Props {
  entry: ETFEntry
  /** undefined = loading, null = unavailable, number[] = prices */
  sparklineData: number[] | null | undefined
  onDelete: (ticker: string) => void
}

export function ETFWatchlistCard({ entry, sparklineData, onDelete }: Props) {
  const { score, breakdown } = computeETFScore(
    entry.peRatio,
    entry.pbRatio,
    entry.yield,
    entry.expenseRatio,
  )

  const sparkUp =
    sparklineData != null && sparklineData.length >= 2
      ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
      : true

  const pe  = entry.peRatio      != null ? entry.peRatio.toFixed(1) + 'x'           : '—'
  const pb  = entry.pbRatio      != null ? entry.pbRatio.toFixed(1) + 'x'           : '—'
  const yld = entry.yield        != null ? fmtPctAbs(entry.yield)                   : '—'
  const er  = entry.expenseRatio != null ? (entry.expenseRatio * 100).toFixed(2) + '%' : '—'

  // Breakdown bar: 4 stacked segments out of 100 total
  const barSegments = [
    { width: breakdown.pe,             color: 'bg-[#D8E6FF]',    title: `P/E +${breakdown.pe}` },
    { width: breakdown.pb,             color: 'bg-[#BFCFEE]',    title: `P/B +${breakdown.pb}` },
    { width: breakdown.yieldPts,       color: 'bg-[#11875D]',    title: `Yield +${breakdown.yieldPts}` },
    { width: breakdown.expensePenalty, color: 'bg-[#D83B3B]',    title: `Exp. −${breakdown.expensePenalty}` },
  ]

  return (
    <div className="flex flex-col gap-4 bg-white border border-[#E3E1DA] rounded-2xl p-5 hover:shadow-md transition-shadow" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block font-mono font-black text-[22px] text-[#06101F] leading-none tracking-tight">
            {entry.ticker}
          </span>
          {entry.name && (
            <p className="text-[13px] text-[#566174] mt-1 truncate leading-snug">
              {entry.name}
            </p>
          )}
        </div>
        <button
          onClick={() => onDelete(entry.ticker)}
          aria-label={`Remove ${entry.ticker} from watchlist`}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#8A95A6] hover:text-[#D83B3B] hover:bg-[#FCEAEA] transition-colors border border-transparent hover:border-red-100 focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-offset-1 focus-visible:outline-none"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Sparkline */}
      <div className="h-12 rounded-lg overflow-hidden">
        {sparklineData === undefined ? (
          <SparklineSkeleton width={400} height={48} />
        ) : sparklineData && sparklineData.length >= 2 ? (
          <Sparkline prices={sparklineData} up={sparkUp} className="w-full h-12" width={400} height={48} />
        ) : (
          <div className="w-full h-12 flex items-center justify-center">
            <span className="text-[11px] text-[#8A95A6]">No chart data</span>
          </div>
        )}
      </div>

      {/* Value Score + Breakdown bar */}
      <div className="flex items-start gap-4">
        {/* Number + badge */}
        <div className="shrink-0">
          <div className="flex items-baseline gap-2">
            <span className={cn('font-mono font-black text-[32px] leading-none', scoreColor(score))}>
              {score}
            </span>
            <span className="text-[11px] text-[#8A95A6] font-medium">/100</span>
          </div>
          <span className={cn('inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full', scoreBadge(score))}>
            {scoreLabel(score)}
          </span>
        </div>

        {/* Stacked bar only — title attrs on segments carry the breakdown */}
        <div className="flex-1 pt-1.5">
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px bg-[#F4F3EF]">
            {barSegments.map((s) => s.width > 0 && (
              <div
                key={s.title}
                className={cn('h-full', s.color)}
                style={{ width: `${s.width}%` }}
                title={s.title}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <p className="text-[10px] text-[#8A95A6]">Score breakdown / 100</p>
            <InfoTooltip text="P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio (up to −20 pts) = 0–100. 70+ = Deep Value." side="top" />
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-2 border-t border-[#E3E1DA] pt-3">
        {[
          { label: 'P/E',       value: pe  },
          { label: 'P/B',       value: pb  },
          { label: 'Yield',     value: yld },
          { label: 'Exp. ratio', value: er  },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-[#8A95A6]">{label}</p>
            <p className="text-[12px] font-semibold font-mono text-[#06101F] mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <Link
        href={`/etf/${entry.ticker}`}
        aria-label={`View ${entry.ticker} ETF details`}
        className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-[#F4F3EF] hover:bg-olive-50 hover:text-olive-700 text-[#566174] text-[12px] font-semibold py-2.5 transition-colors border border-[#E3E1DA] min-h-[44px]"
      >
        <ExternalLink size={11} />
        View full analysis
      </Link>
    </div>
  )
}
