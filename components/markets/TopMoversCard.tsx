'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { MoversData, Mover } from '@/app/api/markets/movers/route'

function pct(v: number) {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function MoverRow({ mover, rank }: { mover: Mover; rank: number }) {
  const up = mover.changePct >= 0
  return (
    <Link
      href={`/stock/${mover.symbol}`}
      className="flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] hover:bg-[#F5F5F5] transition-colors group"
    >
      <span className="text-[10px] font-bold text-[#6B6B6B] w-3 shrink-0">{rank}</span>
      <span className="text-[11px] font-bold text-[#2563EB] bg-[#EAF1FF] border border-[#E5E5E5] px-1.5 py-0.5 rounded w-12 text-center shrink-0">
        {mover.symbol}
      </span>
      <span className="flex-1 text-[11px] font-medium text-[#6B6B6B] truncate group-hover:text-[#111111]">
        {mover.name}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {up
          ? <TrendingUp size={11} className="text-[#11875D]" />
          : <TrendingDown size={11} className="text-[#D83B3B]" />
        }
        <span className={cn(
          'text-[11px] font-semibold tabular-nums',
          up ? 'text-[#11875D]' : 'text-[#D83B3B]'
        )}>
          {pct(mover.changePct)}
        </span>
      </div>
    </Link>
  )
}

type Tab = 'gainers' | 'losers'

export default function TopMoversCard() {
  const [data, setData]       = useState<MoversData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>('gainers')

  useEffect(() => {
    fetch('/api/markets/movers')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const movers = tab === 'gainers' ? (data?.gainers ?? []) : (data?.losers ?? [])

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-[#E5E5E5] flex items-center justify-between">
        <span className="text-[13px] font-[700] text-[#111111] leading-tight">Top Movers</span>
        <div className="flex rounded-lg overflow-hidden border border-[#E5E5E5] text-[10px] font-bold">
          {(['gainers', 'losers'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-2.5 py-1 min-h-[44px] capitalize transition-colors',
                tab === t
                  ? t === 'gainers' ? 'bg-[#11875D] text-white' : 'bg-[#D83B3B] text-white'
                  : 'bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 divide-y divide-[#E3E1DA]">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-[#E3E1DA] motion-safe:animate-pulse" />
            ))}
          </div>
        ) : movers.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-[#6B6B6B]">No data available</div>
        ) : (
          movers.map((m, i) => <MoverRow key={m.symbol} mover={m} rank={i + 1} />)
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-[#E5E5E5] flex items-center justify-between">
        <p className="text-[10px] text-[#6B6B6B]">Large-cap · click ticker to analyze</p>
        <Link
          href="/markets/movers"
          className="text-[11px] font-semibold text-[#2563EB] hover:text-[#111111] transition-colors"
        >
          View all movers →
        </Link>
      </div>
    </div>
  )
}
