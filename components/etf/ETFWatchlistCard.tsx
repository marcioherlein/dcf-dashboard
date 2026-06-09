'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
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

  const price        = entry.price != null ? `$${entry.price.toFixed(2)}` : null
  const changePct    = entry.priceChangePct
  const changeUp     = (changePct ?? 0) >= 0
  const changeStr    = changePct != null
    ? `${changeUp ? '+' : ''}${changePct.toFixed(2)}%`
    : null

  // Staleness indicator for metrics
  const metricsDate = entry.metricsUpdatedAt
    ? new Date(entry.metricsUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null
  const isStale = entry.metricsUpdatedAt
    ? (Date.now() - new Date(entry.metricsUpdatedAt).getTime()) > 7 * 24 * 60 * 60 * 1000
    : true

  return (
    <div className="relative flex flex-col gap-0 bg-white border border-[#E3E1DA] rounded-2xl overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

      {/* Delete button — floats top-right, not part of the link */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(entry.ticker) }}
        aria-label={`Remove ${entry.ticker} from watchlist`}
        className="absolute top-3 right-3 z-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#8A95A6] hover:text-[#D83B3B] hover:bg-[#FCEAEA] transition-colors focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-offset-1 focus-visible:outline-none"
      >
        <Trash2 size={14} />
      </button>

      {/* The entire card body is a link */}
      <Link href={`/etf/${entry.ticker}`} className="flex flex-col gap-0 p-5 pb-4 focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-inset focus-visible:outline-none">

        {/* Header: ticker + name */}
        <div className="pr-10 mb-3">
          <span className="block font-sans font-bold text-[20px] text-[#06101F] leading-none tracking-tight">
            {entry.ticker}
          </span>
          {entry.name && (
            <p className="text-[12px] text-[#6B6B6B] mt-1 truncate leading-snug">
              {entry.name}
            </p>
          )}
        </div>

        {/* Price row */}
        {(price || changeStr) && (
          <div className="flex items-baseline gap-2 mb-3">
            {price && (
              <span className="text-[16px] font-semibold font-mono text-[#06101F] tabular-nums leading-none">
                {price}
              </span>
            )}
            {changeStr && (
              <span className={cn(
                'text-[13px] font-semibold tabular-nums leading-none px-1.5 py-0.5 rounded-full',
                changeUp
                  ? 'text-[#11875D] bg-[#E8F7EF]'
                  : 'text-[#D83B3B] bg-[#FCEAEA]',
              )}>
                {changeUp ? '▲' : '▼'} {changeStr}
              </span>
            )}
          </div>
        )}

        {/* Sparkline */}
        <div className="relative h-[72px] rounded-lg overflow-hidden mb-4">
          {sparklineData === undefined ? (
            <SparklineSkeleton width={400} height={72} />
          ) : sparklineData && sparklineData.length >= 2 ? (
            <>
              <Sparkline prices={sparklineData} up={sparkUp} className="w-full h-[72px]" width={400} height={72} />
              <span className="absolute bottom-1 left-2 text-[10px] font-semibold text-[#8A95A6] bg-white/80 rounded px-1">1M</span>
            </>
          ) : (
            <div className="w-full h-[72px] flex items-center justify-center bg-[#F4F3EF] rounded-lg">
              <span className="text-[11px] text-[#8A95A6]">No chart data</span>
            </div>
          )}
        </div>

        {/* Value Score */}
        <div className="flex items-start gap-4 mb-3">
          <div className="shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className={cn('font-sans font-bold text-[44px] leading-[1] tabular-nums', scoreColor(score))}>
                {score}
              </span>
              <span className="text-[11px] text-[#8A95A6] font-medium self-end pb-1">/100</span>
            </div>
            <span className={cn('inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full', scoreBadge(score))}>
              {scoreLabel(score)}
            </span>
          </div>

          {/* Breakdown bar with labeled segments */}
          <div className="flex-1 pt-2">
            <div className="flex h-3 rounded-md overflow-hidden gap-0.5 bg-[#E3E1DA]">
              {breakdown.pe > 0 && (
                <div className="h-full bg-[#2563EB]" style={{ width: `${breakdown.pe}%` }} />
              )}
              {breakdown.pb > 0 && (
                <div className="h-full bg-[#93C5FD]" style={{ width: `${breakdown.pb}%` }} />
              )}
              {breakdown.yieldPts > 0 && (
                <div className="h-full bg-[#11875D]" style={{ width: `${breakdown.yieldPts}%` }} />
              )}
              {breakdown.expensePenalty > 0 && (
                <div className="h-full bg-[#D83B3B]" style={{ width: `${breakdown.expensePenalty}%` }} />
              )}
            </div>
            <div className="grid grid-cols-4 gap-0 mt-1.5">
              <div>
                <p className="text-[9px] text-[#8A95A6] leading-none">P/E</p>
                <p className="text-[10px] font-mono font-semibold text-[#2563EB] mt-0.5">{breakdown.pe}/30</p>
              </div>
              <div>
                <p className="text-[9px] text-[#8A95A6] leading-none">P/B</p>
                <p className="text-[10px] font-mono font-semibold text-[#2563EB] mt-0.5">{breakdown.pb}/25</p>
              </div>
              <div>
                <p className="text-[9px] text-[#8A95A6] leading-none">Yield</p>
                <p className="text-[10px] font-mono font-semibold text-[#11875D] mt-0.5">{breakdown.yieldPts}/25</p>
              </div>
              <div>
                <p className="text-[9px] text-[#8A95A6] leading-none">Exp.</p>
                <p className="text-[10px] font-mono font-semibold text-[#D83B3B] mt-0.5">−{breakdown.expensePenalty}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics rail */}
        <div className="grid grid-cols-4 divide-x divide-[#E3E1DA] border-t border-[#E3E1DA] pt-3">
          {[
            { label: 'P/E',   value: pe  },
            { label: 'P/B',   value: pb  },
            { label: 'Yield', value: yld },
            { label: 'Exp',   value: er  },
          ].map(({ label, value }) => (
            <div key={label} className="px-2 first:pl-0 last:pr-0">
              <p className="text-[10px] font-semibold text-[#8A95A6]">{label}</p>
              <p className="text-[12px] font-semibold font-mono text-[#06101F] mt-0.5 tabular-nums">{value}</p>
            </div>
          ))}
        </div>

      </Link>

      {/* Footer: staleness indicator + score tooltip */}
      <div className="flex items-center justify-between px-5 pb-3 pt-1">
        {metricsDate ? (
          <span className={cn('text-[10px]', isStale ? 'text-[#B56A00]' : 'text-[#8A95A6]')}>
            {isStale ? '⚠ ' : ''}Metrics as of {metricsDate}
          </span>
        ) : (
          <span className="text-[10px] text-[#8A95A6]">Metrics from save time</span>
        )}
        <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (up to −20 pts). 70+ = Deep Value." side="top" />
      </div>
    </div>
  )
}
