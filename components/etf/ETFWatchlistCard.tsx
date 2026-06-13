'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeETFScore, scoreLabel, scoreBadge, explainScore } from '@/lib/data/etfScore'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import type { ETFEntry } from '@/lib/data/etfTypes'

interface Props {
  entry: ETFEntry
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

  const explain = explainScore(breakdown, score, {
    peRatio:     entry.peRatio,
    pbRatio:     entry.pbRatio,
    yieldVal:    entry.yield,
    expenseRatio: entry.expenseRatio,
  })

  const scoreLines = [
    entry.peRatio     != null ? `P/E ${entry.peRatio.toFixed(1)}× → ${breakdown.pe}/30 pts` : null,
    entry.pbRatio     != null ? `P/B ${entry.pbRatio.toFixed(1)}× → ${breakdown.pb}/25 pts` : null,
    entry.yield       != null && entry.yield > 0 ? `Yield ${(entry.yield * 100).toFixed(1)}% → ${breakdown.yieldPts}/25 pts` : null,
    entry.expenseRatio != null ? `Expense ${(entry.expenseRatio * 100).toFixed(2)}% → −${breakdown.expensePenalty} pts` : null,
  ].filter(Boolean).join('\n')

  const scoreTooltip = scoreLines ? `${explain}\n\n${scoreLines}` : explain

  const sparkUp =
    sparklineData != null && sparklineData.length >= 2
      ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
      : true

  const price    = entry.price != null ? `$${entry.price.toFixed(2)}` : null
  const changePct = entry.priceChangePct
  const changeUp  = (changePct ?? 0) >= 0
  const changeStr = changePct != null
    ? `${changeUp ? '+' : ''}${changePct.toFixed(2)}%`
    : null

  return (
    <div className="relative bg-white border border-[#E5E5E5] rounded-xl overflow-hidden hover:border-[#BFD2A1] hover:shadow-sm transition-all group">

      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(entry.ticker) }}
        aria-label={`Remove ${entry.ticker} from watchlist`}
        className="absolute top-1/2 -translate-y-1/2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-transparent group-hover:text-[#9B9B9B] hover:!text-[#D83B3B] hover:bg-[#FCEAEA] transition-all"
      >
        <Trash2 size={13} />
      </button>

      <Link
        href={`/etf/${entry.ticker}`}
        className="flex items-center gap-3 px-4 py-3 pr-12 focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-inset focus-visible:outline-none"
      >
        {/* Left: ticker + name + score chip + breakdown tooltip */}
        <div className="w-[130px] shrink-0 min-w-0">
          <p className="text-[15px] font-[800] text-[#111111] leading-tight tracking-tight">
            {entry.ticker}
          </p>
          {entry.name && (
            <p className="text-[11px] text-[#6B6B6B] truncate mt-0.5 leading-snug">
              {entry.name}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn('inline-flex text-[10px] font-[650] px-1.5 py-0.5 rounded-full leading-none', scoreBadge(score))}
              title={scoreTooltip}
            >
              {score} · {scoreLabel(score)}
            </span>
          </div>
        </div>

        {/* Center: sparkline */}
        <div className="relative flex-1 min-w-0 h-[44px]">
          {sparklineData === undefined ? (
            <SparklineSkeleton width={200} height={44} />
          ) : sparklineData && sparklineData.length >= 2 ? (
            <>
              <Sparkline prices={sparklineData} up={sparkUp} width={200} height={44} className="w-full h-[44px]" />
              <span className="absolute bottom-0 right-0 text-[9px] font-[650] text-[#9B9B9B] bg-white/80 rounded px-1 leading-none">YTD</span>
            </>
          ) : (
            <div className="w-full h-[44px] flex items-center justify-center">
              <span className="text-[11px] text-[#9B9B9B]">No data</span>
            </div>
          )}
        </div>

        {/* Right: price + change + expense hint */}
        <div className="w-[90px] shrink-0 text-right">
          {price && (
            <p className="text-[14px] font-[700] text-[#111111] tabular-nums leading-tight">{price}</p>
          )}
          {changeStr && (
            <span className={cn(
              'inline-flex mt-0.5 text-[10px] font-[650] px-1.5 py-0.5 rounded-full leading-none tabular-nums',
              changeUp ? 'text-[#11875D] bg-[#E8F7EF]' : 'text-[#D83B3B] bg-[#FCEAEA]',
            )}>
              {changeStr}
            </span>
          )}
          {entry.expenseRatio != null && (
            <p className="text-[9px] text-[#9B9B9B] mt-1 tabular-nums">
              {(entry.expenseRatio * 100).toFixed(2)}% exp.
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
