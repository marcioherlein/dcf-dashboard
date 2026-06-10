'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeETFScore, scoreLabel, scoreBadge } from '@/lib/data/etfScore'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import type { ETFEntry } from '@/lib/data/etfTypes'

interface Props {
  entry: ETFEntry
  /** undefined = loading, null = unavailable, number[] = prices */
  sparklineData: number[] | null | undefined
  onDelete: (ticker: string) => void
}

export function ETFWatchlistCard({ entry, sparklineData, onDelete }: Props) {
  const { score } = computeETFScore(
    entry.peRatio,
    entry.pbRatio,
    entry.yield,
    entry.expenseRatio,
  )

  const sparkUp =
    sparklineData != null && sparklineData.length >= 2
      ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
      : true

  const price     = entry.price != null ? `$${entry.price.toFixed(2)}` : null
  const changePct = entry.priceChangePct
  const changeUp  = (changePct ?? 0) >= 0
  const changeStr = changePct != null
    ? `${changeUp ? '+' : ''}${changePct.toFixed(2)}%`
    : null

  return (
    <div className="relative bg-white border border-[#E5E5E5] rounded-xl overflow-hidden hover:bg-[#F5F5F5] transition-colors">

      {/* Delete button — absolutely positioned, outside link tap target */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(entry.ticker) }}
        aria-label={`Remove ${entry.ticker} from watchlist`}
        className="absolute top-2 right-2 z-10 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#9B9B9B] hover:text-[#D83B3B] hover:bg-[#FCEAEA] transition-colors focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1 focus-visible:outline-none"
      >
        <Trash2 size={13} />
      </button>

      {/* Full-card link */}
      <Link
        href={`/etf/${entry.ticker}`}
        className="flex items-center gap-4 px-4 py-3 pr-10 focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-inset focus-visible:outline-none"
      >

        {/* Left column: ticker + name + score chip */}
        <div className="w-[140px] shrink-0 min-w-0">
          <p className="text-[18px] font-[800] text-[#111111] leading-tight tracking-tight">
            {entry.ticker}
          </p>
          {entry.name && (
            <p className="text-[11px] text-[#6B6B6B] truncate mt-0.5 leading-snug">
              {entry.name}
            </p>
          )}
          <span className={cn(
            'inline-flex mt-1 text-[10px] font-[650] px-1.5 py-0.5 rounded-full leading-none',
            scoreBadge(score),
          )}>
            {scoreLabel(score)}
          </span>
        </div>

        {/* Center column: sparkline with YTD label */}
        <div className="relative flex-1 min-w-0 h-[48px]">
          {sparklineData === undefined ? (
            <SparklineSkeleton width={200} height={48} />
          ) : sparklineData && sparklineData.length >= 2 ? (
            <>
              <Sparkline
                prices={sparklineData}
                up={sparkUp}
                width={200}
                height={48}
                className="w-full h-[48px]"
              />
              <span className="absolute bottom-0 right-0 text-[9px] font-[650] text-[#9B9B9B] bg-white/80 rounded px-1 leading-none">YTD</span>
            </>
          ) : (
            <div className="w-full h-[48px] flex items-center justify-center">
              <span className="text-[11px] text-[#9B9B9B]">No data</span>
            </div>
          )}
        </div>

        {/* Right column: price + change pill */}
        <div className="w-[90px] shrink-0 text-right">
          {price && (
            <p className="text-[17px] font-[700] text-[#111111] tabular-nums leading-tight">
              {price}
            </p>
          )}
          {changeStr && (
            <span className={cn(
              'inline-flex mt-0.5 text-[11px] font-[650] px-2 py-0.5 rounded-full leading-none tabular-nums',
              changeUp
                ? 'text-[#11875D] bg-[#E8F7EF]'
                : 'text-[#D83B3B] bg-[#FCEAEA]',
            )}>
              {changeUp ? '+' : ''}{changePct!.toFixed(2)}%
            </span>
          )}
        </div>

      </Link>
    </div>
  )
}
