'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { ALL_META } from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

interface Props {
  data: Record<string, ETFBatchItem | null>
  loading: boolean
}

const LEVERAGED = /\b(2x|3x|bear|inverse|ultra|short|leveraged|daily)\b/i

function pct(v: number) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
}

export function ETFMoversStrip({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1].map(i => (
          <div key={i} className="h-[140px] rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }

  const candidates = ALL_META
    .map(m => ({ meta: m, item: data[m.ticker] }))
    .filter(x =>
      x.item?.priceChangePct != null &&
      x.item?.aum != null &&
      x.item.aum >= 500_000_000 &&          // filter micro ETFs
      !LEVERAGED.test(x.item.name ?? '')
    )

  if (candidates.length < 3) return null

  const sorted = [...candidates].sort(
    (a, b) => (b.item!.priceChangePct!) - (a.item!.priceChangePct!)
  )

  const gainers = sorted.slice(0, 5)
  const losers  = sorted.slice(-5).reverse()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <MoverList title="Today's Winners" icon={TrendingUp} items={gainers} up />
      <MoverList title="Today's Losers"  icon={TrendingDown} items={losers} up={false} />
    </div>
  )
}

function MoverList({
  title,
  icon: Icon,
  items,
  up,
}: {
  title: string
  icon: React.ElementType
  items: { meta: { ticker: string; label: string }; item: ETFBatchItem | null | undefined }[]
  up: boolean
}) {
  const accent = up ? '#11875D' : '#D83B3B'
  const accentBg = up ? '#E8F7EF' : '#FCEAEA'

  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F0F1F6]">
        <Icon size={13} style={{ color: accent }} strokeWidth={2.5} />
        <span className="text-[12px] font-[700] text-[#111111]">{title}</span>
        <span className="text-[10px] text-[#9B9B9B] ml-auto">1D return</span>
      </div>
      <div className="divide-y divide-[#F0F1F6]">
        {items.map(({ meta, item }) => {
          const change = item?.priceChangePct ?? 0
          return (
            <Link
              key={meta.ticker}
              href={`/etf/${meta.ticker}`}
              className="flex items-center gap-3 px-4 py-2 hover:bg-[#F9F8F5] transition-colors group"
            >
              <span className="text-[12px] font-[700] text-[#111111] w-10 shrink-0 group-hover:text-olive-700 transition-colors">
                {meta.ticker}
              </span>
              <span className="text-[11px] text-[#8A95A6] truncate flex-1">
                {item?.name ?? meta.label}
              </span>
              {/* Mini relative bar */}
              <div className="w-16 shrink-0">
                <div className="h-1 rounded-full bg-[#F0F1F6] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.abs(change) * 500)}%`,
                      background: accent,
                    }}
                  />
                </div>
              </div>
              <span
                className="text-[12px] font-[700] tabular-nums w-16 text-right shrink-0 rounded-md px-1.5 py-0.5"
                style={{ color: accent, background: accentBg }}
              >
                {pct(change)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
