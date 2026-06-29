'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import type { MoversData, Mover } from '@/app/api/markets/movers/route'

function pct(v: number) {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function MoverRow({ mover, rank, showVolume }: { mover: Mover; rank: number; showVolume?: boolean }) {
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
      <div className="flex items-center gap-1.5 shrink-0">
        {showVolume && mover.volumeRatio != null ? (
          <span className="text-[11px] font-semibold tabular-nums text-[#B56A00]">
            {mover.volumeRatio.toFixed(1)}× vol
          </span>
        ) : (
          <>
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
          </>
        )}
      </div>
    </Link>
  )
}

type Tab = 'gainers' | 'losers' | 'unusual'

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

  const movers =
    tab === 'gainers' ? (data?.gainers ?? []) :
    tab === 'losers'  ? (data?.losers ?? []) :
    (data?.unusual ?? [])

  const TABS: { id: Tab; label: string; activeCls: string }[] = [
    { id: 'gainers', label: 'Gainers', activeCls: 'bg-[#11875D] text-white' },
    { id: 'losers',  label: 'Losers',  activeCls: 'bg-[#D83B3B] text-white' },
    { id: 'unusual', label: 'Vol',      activeCls: 'bg-[#B56A00] text-white' },
  ]

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-[#E5E5E5] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-[700] text-[#111111] leading-tight">Top Movers</span>
          {tab === 'unusual' && (
            <Activity size={12} className="text-[#B56A00]" />
          )}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-[#E5E5E5] text-[10px] font-bold">
          {TABS.map(t => (
            <button
              key={t.id}
              data-no-min-h
              onClick={() => setTab(t.id)}
              className={cn(
                'px-2 py-1 h-7 capitalize transition-colors',
                tab === t.id ? t.activeCls : 'bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'unusual' && (
        <div className="px-4 py-1.5 bg-[#FFF9F0] border-b border-[#F3D391]">
          <p className="text-[10px] text-[#B56A00]">Volume ÷ 3-month average — anomalous surges vs normal pace</p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#E3E1DA]">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-[#E3E1DA] motion-safe:animate-pulse" />
            ))}
          </div>
        ) : movers.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-[#6B6B6B]">
            {tab === 'unusual' ? 'No unusual volume detected today' : 'No data available'}
          </div>
        ) : (
          movers.map((m, i) => (
            <MoverRow key={m.symbol} mover={m} rank={i + 1} showVolume={tab === 'unusual'} />
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-[#E5E5E5] flex items-center justify-between">
        <p className="text-[10px] text-[#6B6B6B]">Large-cap · click ticker to analyze</p>
        <Link
          href="/screener"
          className="text-[11px] font-semibold text-[#2563EB] hover:text-[#111111] transition-colors"
        >
          Open screener →
        </Link>
      </div>
    </div>
  )
}
