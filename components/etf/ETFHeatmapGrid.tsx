'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Plus, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel, scoreBadge } from '@/lib/data/etfScore'
import { fmtMultiple } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Sparkline } from '@/components/ui/Sparkline'
import type { ETFMeta } from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

interface Props {
  metas: ETFMeta[]
  data: Record<string, ETFBatchItem | null>
  watchlistedTickers: Set<string>
  onAdd: (ticker: string) => void
  cols?: 3 | 4
  hasError?: boolean
  sparklines?: Record<string, number[] | null>
}

export const ETFHeatmapGrid = memo(function ETFHeatmapGrid({ metas, data, watchlistedTickers, onAdd, cols = 3, hasError, sparklines = {} }: Props) {
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
    <div className={cn('grid gap-2', cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3')}>
      {metas.map((meta) => {
        const item    = data[meta.ticker] ?? null
        const score   = item?.valueScore ?? null
        const isWatchlisted = watchlistedTickers.has(meta.ticker)
        const sparkPrices = sparklines[meta.ticker]
        const hasChart    = sparkPrices != null && sparkPrices.length >= 2
        const sparkUp     = hasChart ? sparkPrices![sparkPrices!.length - 1] >= sparkPrices![0] : (item?.priceChangePct ?? 0) >= 0
        const changePct   = item?.priceChangePct ?? null
        const changeUp    = (changePct ?? 0) >= 0
        const changeStr   = changePct != null ? `${changeUp ? '+' : ''}${changePct.toFixed(2)}%` : null

        if (loading) {
          return <div key={meta.ticker} className="h-[120px] rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] motion-safe:animate-pulse" />
        }

        return (
          <div
            key={meta.ticker}
            className="group relative rounded-xl border border-[#E5E5E5] bg-white transition-all hover:border-[#BFD2A1] hover:shadow-sm cursor-pointer overflow-hidden"
          >
            {/* Full-card invisible link */}
            <Link href={`/etf/${meta.ticker}`} className="absolute inset-0 rounded-xl z-0" tabIndex={-1} aria-hidden="true" />

            {/* Top: ticker + add button + % change */}
            <div className="relative z-10 flex items-start justify-between gap-1 px-3 pt-2.5 pb-0">
              <Link href={`/etf/${meta.ticker}`} tabIndex={0} className="min-w-0 flex-1">
                <span className="block font-[700] text-[13px] text-[#111111] leading-none group-hover:text-olive-700 transition-colors">
                  {meta.ticker}
                </span>
                <span className="block text-[10px] text-[#9B9B9B] mt-0.5 leading-tight truncate">
                  {meta.label}
                </span>
              </Link>
              {/* % change today pill */}
              {changeStr ? (
                <span className={cn(
                  'shrink-0 text-[10px] font-[700] px-1.5 py-0.5 rounded-full tabular-nums leading-none',
                  changeUp ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#FCEAEA] text-[#D83B3B]',
                )}>
                  {changeStr}
                </span>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(meta.ticker) }}
                  data-no-min-h
                  className={cn(
                    'relative z-20 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-offset-1 focus-visible:outline-none',
                    isWatchlisted ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#F5F5F5] text-[#9B9B9B] hover:bg-olive-50 hover:text-olive-700',
                  )}
                  aria-label={isWatchlisted ? `${meta.ticker} is in your watchlist` : `Add ${meta.ticker} to watchlist`}
                >
                  {isWatchlisted ? <Check size={10} /> : <Plus size={10} />}
                </button>
              )}
            </div>

            {/* Score row */}
            <div className="relative z-10 flex items-center gap-1.5 flex-wrap px-3 pt-1.5 pb-0">
              {score != null ? (
                <>
                  <span className={cn('text-[12px] font-[700] tabular-nums leading-none', scoreColor(score))}>{score}</span>
                  <span className={cn('text-[10px] font-[600] px-1.5 py-0.5 rounded-full leading-none', scoreBadge(score))}>
                    {scoreLabel(score)}
                  </span>
                  <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." side="top" />
                </>
              ) : (
                <div className="h-4 w-12 rounded bg-[#E5E5E5] motion-safe:animate-pulse" />
              )}
              {item?.peRatio != null && (
                <span className="text-[10px] text-[#9B9B9B] ml-auto">
                  P/E <span className="font-[600] tabular-nums text-[#6B6B6B]">{fmtMultiple(item.peRatio)}</span>
                </span>
              )}
            </div>

            {/* Sparkline + YTD label */}
            <div className="relative h-[36px] mt-1.5">
              {hasChart ? (
                <>
                  <Sparkline prices={sparkPrices!} up={sparkUp} className="w-full h-[36px]" width={200} height={36} />
                  <span className="absolute bottom-1 right-2 text-[9px] font-[650] text-[#9B9B9B] bg-white/80 rounded px-1 leading-none">YTD</span>
                </>
              ) : (
                <div className="w-full h-[36px]" />
              )}
            </div>

            {/* Add button when changePct is showing (move it below) */}
            {changeStr && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(meta.ticker) }}
                data-no-min-h
                className={cn(
                  'absolute bottom-1.5 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-md transition-all focus-visible:ring-2 focus-visible:ring-olive-700',
                  isWatchlisted ? 'text-[#11875D]' : 'text-[#9B9B9B] hover:text-olive-700',
                )}
                aria-label={isWatchlisted ? `${meta.ticker} is in your watchlist` : `Add ${meta.ticker} to watchlist`}
              >
                {isWatchlisted ? <Check size={9} /> : <Plus size={9} />}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
})
