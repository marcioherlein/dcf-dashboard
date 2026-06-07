'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel, scoreBgCell, scoreBadge } from '@/lib/data/etfScore'
import { fmtMultiple } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { ETFMeta } from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

interface Props {
  metas: ETFMeta[]
  data: Record<string, ETFBatchItem | null>
  watchlistedTickers: Set<string>
  onAdd: (ticker: string) => void
  cols?: 3 | 4
}

export const ETFHeatmapGrid = memo(function ETFHeatmapGrid({ metas, data, watchlistedTickers, onAdd, cols = 3 }: Props) {
  const loading = Object.keys(data).length === 0

  return (
    <div
      className={cn(
        'grid gap-3',
        cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
      )}
    >
      {metas.map((meta) => {
        const item = data[meta.ticker] ?? null
        const score = item?.valueScore ?? null
        const isWatchlisted = watchlistedTickers.has(meta.ticker)

        if (loading) {
          return (
            <div key={meta.ticker} className="h-[108px] rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] motion-safe:animate-pulse" />
          )
        }

        return (
          <div
            key={meta.ticker}
            className={cn(
              'group relative rounded-xl border p-3 transition-all hover:shadow-sm',
              score != null ? scoreBgCell(score) : 'bg-white border-[#E3E1DA]',
            )}
          >
            {/* Full-card invisible link — navigates on click anywhere except the button */}
            <Link
              href={`/etf/${meta.ticker}`}
              className="absolute inset-0 rounded-xl z-0"
              tabIndex={-1}
              aria-hidden="true"
            />

            {/* Header row */}
            <div className="relative z-10 flex items-start justify-between gap-1 mb-2">
              <Link href={`/etf/${meta.ticker}`} tabIndex={0} className="min-w-0 flex-1">
                <span className="block font-mono font-black text-[14px] text-[#06101F] leading-none group-hover:text-olive-700 transition-colors">
                  {meta.ticker}
                </span>
                <span className="block text-[11px] text-[#566174] mt-0.5 leading-tight truncate">
                  {meta.label}
                </span>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(meta.ticker) }}
                className={cn(
                  'relative z-20 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-offset-1 focus-visible:outline-none',
                  isWatchlisted
                    ? 'bg-[#E8F7EF] text-[#11875D]'
                    : 'bg-white/80 text-[#8A95A6] hover:bg-olive-50 hover:text-olive-700 border border-[#E3E1DA] hover:border-[#BFD2A1]',
                )}
                aria-label={isWatchlisted ? `${meta.ticker} is in your watchlist` : `Add ${meta.ticker} to watchlist`}
              >
                {isWatchlisted ? <Check size={12} /> : <Plus size={12} />}
              </button>
            </div>

            {/* Score */}
            <div className="relative z-10 flex items-center gap-1.5 mb-2">
              {score != null ? (
                <>
                  <span className={cn('font-mono font-black text-[22px] leading-none', scoreColor(score))}>
                    {score}
                  </span>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', scoreBadge(score))}>
                    {scoreLabel(score)}
                  </span>
                  <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." side="top" />
                </>
              ) : (
                <div className="h-6 w-16 rounded bg-[#F4F3EF] motion-safe:animate-pulse" />
              )}
            </div>

            {/* Stat row */}
            <div className="relative z-10 flex items-center gap-2.5 text-[11px]">
              {item?.peRatio != null && (
                <span className="text-[#566174]">
                  P/E <span className="font-mono font-semibold text-[#06101F]">{fmtMultiple(item.peRatio)}</span>
                </span>
              )}
              {item?.expenseRatio != null && (
                <span className="text-[#566174]">
                  ER <span className="font-mono font-semibold text-[#06101F]">{(item.expenseRatio * 100).toFixed(2)}%</span>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
})
