'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Plus, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel, scoreBadge } from '@/lib/data/etfScore'
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
  hasError?: boolean
}

export const ETFHeatmapGrid = memo(function ETFHeatmapGrid({ metas, data, watchlistedTickers, onAdd, cols = 3, hasError }: Props) {
  const loading = !hasError && Object.keys(data).length === 0

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#8A95A6] py-4">
        <AlertCircle size={14} className="text-[#D83B3B] shrink-0" />
        <span>Could not load ETF data. Use Retry above to refresh.</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid gap-2',
        cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
      )}
    >
      {metas.map((meta) => {
        const item = data[meta.ticker] ?? null
        const score = item?.valueScore ?? null
        const isWatchlisted = watchlistedTickers.has(meta.ticker)

        if (loading) {
          return (
            <div key={meta.ticker} className="h-[76px] rounded-xl border border-[#E3E1DA] bg-[#F5F5F5] motion-safe:animate-pulse" />
          )
        }

        return (
          <div
            key={meta.ticker}
            className="group relative rounded-xl border border-[#E3E1DA] bg-white p-3 transition-all hover:border-[#BFD2A1] hover:shadow-sm cursor-pointer"
          >
            {/* Full-card invisible link */}
            <Link
              href={`/etf/${meta.ticker}`}
              className="absolute inset-0 rounded-xl z-0"
              tabIndex={-1}
              aria-hidden="true"
            />

            {/* Ticker + add button row */}
            <div className="relative z-10 flex items-start justify-between gap-1 mb-1.5">
              <Link href={`/etf/${meta.ticker}`} tabIndex={0} className="min-w-0 flex-1">
                <span className="block font-[700] text-[13px] text-[#111111] leading-none group-hover:text-olive-700 transition-colors">
                  {meta.ticker}
                </span>
                <span className="block text-[11px] text-[#8A95A6] mt-0.5 leading-tight truncate">
                  {meta.label}
                </span>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(meta.ticker) }}
                data-no-min-h
                className={cn(
                  'relative z-20 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-offset-1 focus-visible:outline-none',
                  isWatchlisted
                    ? 'bg-[#E8F7EF] text-[#11875D]'
                    : 'bg-[#F5F5F5] text-[#8A95A6] hover:bg-olive-50 hover:text-olive-700',
                )}
                aria-label={isWatchlisted ? `${meta.ticker} is in your watchlist` : `Add ${meta.ticker} to watchlist`}
              >
                {isWatchlisted ? <Check size={10} /> : <Plus size={10} />}
              </button>
            </div>

            {/* Score + stats row */}
            <div className="relative z-10 flex items-center gap-2 flex-wrap">
              {score != null ? (
                <>
                  <span className={cn('text-[12px] font-[700] tabular-nums leading-none', scoreColor(score))}>
                    {score}
                  </span>
                  <span className={cn('text-[10px] font-[600] px-1.5 py-0.5 rounded-full leading-none', scoreBadge(score))}>
                    {scoreLabel(score)}
                  </span>
                  <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." side="top" />
                </>
              ) : (
                <div className="h-4 w-12 rounded bg-[#E3E1DA] motion-safe:animate-pulse" />
              )}
              {item?.peRatio != null && (
                <span className="text-[10px] text-[#8A95A6] ml-auto">
                  P/E <span className="font-[600] tabular-nums text-[#566174]">{fmtMultiple(item.peRatio)}</span>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
})
