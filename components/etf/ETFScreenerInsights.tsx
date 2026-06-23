'use client'

import Link from 'next/link'
import { ArrowRight, TrendingUp, DollarSign, Percent } from 'lucide-react'
import { ETFBatchItem } from '@/lib/data/etfTypes'
import { ALL_META, ETFMeta } from '@/lib/data/etfUniverse'
import { scoreColor } from '@/lib/data/etfScore'
import { fmtPctAbs } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface Props {
  data: Record<string, ETFBatchItem | null>
  loading: boolean
}

function SkeletonSection() {
  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
      <div className="h-4 w-32 bg-[#F0F1F6] rounded animate-pulse mb-3" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#F0F1F6] last:border-0">
          <div className="h-5 w-10 bg-[#F0F4E8] rounded-md animate-pulse" />
          <div className="h-3 flex-1 bg-[#F0F1F6] rounded animate-pulse" />
          <div className="h-4 w-8 bg-[#F0F1F6] rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function TickerChip({
  ticker,
  className,
}: {
  ticker: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-[700] shrink-0',
        className,
      )}
    >
      {ticker}
    </span>
  )
}

interface InsightRowProps {
  ticker: string
  name: string
  metric: string
  metricColor: string
  chipClass: string
}

function InsightRow({ ticker, name, metric, metricColor, chipClass }: InsightRowProps) {
  return (
    <Link
      href={`/etf/${ticker}`}
      className="flex items-center gap-2 py-1.5 border-b border-[#F0F1F6] last:border-0 hover:bg-[#FAFAF8] transition-colors rounded-sm"
    >
      <TickerChip ticker={ticker} className={chipClass} />
      <span className="text-[11px] text-[#6B6B6B] truncate flex-1 min-w-0">{name}</span>
      <span className={cn('text-[12px] font-[700] text-right tabular-nums shrink-0', metricColor)}>
        {metric}
      </span>
    </Link>
  )
}

export function ETFScreenerInsights({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
      </div>
    )
  }

  const items = Object.values(data).filter((item): item is ETFBatchItem => item !== null)

  if (items.length === 0) return null

  // Section 1: Best Value ETFs — sort by valueScore desc, filter > 0
  const bestValue = [...items]
    .filter((item) => item.valueScore > 0)
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 3)

  // Section 2: Lowest Cost ETFs — sort by expenseRatio asc, filter non-null
  const lowestCost = [...items]
    .filter((item) => item.expenseRatio != null && item.expenseRatio > 0)
    .sort((a, b) => (a.expenseRatio as number) - (b.expenseRatio as number))
    .slice(0, 3)

  // Section 3: Highest Yield ETFs — sort by yield desc, filter non-null/non-zero
  const highestYield = [...items]
    .filter((item) => item.yield != null && item.yield > 0)
    .sort((a, b) => (b.yield as number) - (a.yield as number))
    .slice(0, 3)

  // Find display name from ALL_META or fall back to item.name
  const metaMap = new Map<string, ETFMeta>(ALL_META.map((m) => [m.ticker, m]))
  const displayName = (item: ETFBatchItem): string =>
    metaMap.get(item.ticker)?.label ?? item.name

  const hasSections =
    bestValue.length > 0 || lowestCost.length > 0 || highestYield.length > 0
  if (!hasSections) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Section 1: Best Value ETFs */}
      {bestValue.length > 0 && (
        <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
          <div className="text-[13px] font-[700] text-[#111111] flex justify-between items-center mb-2">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-olive-700" />
              Best Value ETFs
            </span>
            <Link
              href="/etf?sort=valueScore"
              className="text-[11px] text-olive-700 hover:underline flex items-center gap-0.5"
            >
              See all <ArrowRight size={10} />
            </Link>
          </div>
          <div>
            {bestValue.map((item) => (
              <InsightRow
                key={item.ticker}
                ticker={item.ticker}
                name={displayName(item)}
                metric={String(item.valueScore)}
                metricColor={scoreColor(item.valueScore)}
                chipClass="bg-[#F0F4E8] text-olive-700"
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Lowest Cost ETFs */}
      {lowestCost.length > 0 && (
        <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
          <div className="text-[13px] font-[700] text-[#111111] flex justify-between items-center mb-2">
            <span className="flex items-center gap-1.5">
              <DollarSign size={13} className="text-[#15803D]" />
              Lowest Cost ETFs
            </span>
            <Link
              href="/etf?sort=expenseRatio"
              className="text-[11px] text-[#15803D] hover:underline flex items-center gap-0.5"
            >
              See all <ArrowRight size={10} />
            </Link>
          </div>
          <div>
            {lowestCost.map((item) => (
              <InsightRow
                key={item.ticker}
                ticker={item.ticker}
                name={displayName(item)}
                metric={
                  item.expenseRatio != null
                    ? (item.expenseRatio * 100).toFixed(2) + '%'
                    : '—'
                }
                metricColor="text-[#15803D]"
                chipClass="bg-[#DCFCE7] text-[#15803D]"
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Highest Yield ETFs */}
      {highestYield.length > 0 && (
        <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
          <div className="text-[13px] font-[700] text-[#111111] flex justify-between items-center mb-2">
            <span className="flex items-center gap-1.5">
              <Percent size={13} className="text-[#92580A]" />
              Highest Yield ETFs
            </span>
            <Link
              href="/etf?sort=yield"
              className="text-[11px] text-[#92580A] hover:underline flex items-center gap-0.5"
            >
              See all <ArrowRight size={10} />
            </Link>
          </div>
          <div>
            {highestYield.map((item) => (
              <InsightRow
                key={item.ticker}
                ticker={item.ticker}
                name={displayName(item)}
                metric={fmtPctAbs(item.yield)}
                metricColor="text-[#92580A]"
                chipClass="bg-[#FFF4DA] text-[#92580A]"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
