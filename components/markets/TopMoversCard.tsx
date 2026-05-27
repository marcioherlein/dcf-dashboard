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
      className="flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] hover:bg-indigo-50/40 transition-colors group"
    >
      <span className="text-[10px] font-bold text-slate-300 w-3 shrink-0">{rank}</span>
      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded w-12 text-center shrink-0">
        {mover.symbol}
      </span>
      <span className="flex-1 text-[11px] font-medium text-slate-600 truncate group-hover:text-slate-900">
        {mover.name}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {up
          ? <TrendingUp size={11} className="text-emerald-500" />
          : <TrendingDown size={11} className="text-red-500" />
        }
        <span className={cn(
          'text-[11px] font-semibold tabular-nums',
          up ? 'text-emerald-600' : 'text-red-500'
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Movers</span>
        <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[10px] font-bold">
          {(['gainers', 'losers'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-2.5 py-1 capitalize transition-colors',
                tab === t
                  ? t === 'gainers' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 divide-y divide-slate-50">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : movers.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">No data available</div>
        ) : (
          movers.map((m, i) => <MoverRow key={m.symbol} mover={m} rank={i + 1} />)
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[10px] text-slate-400">Large-cap · click ticker to analyze</p>
        <Link
          href="/markets/movers"
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          View all movers →
        </Link>
      </div>
    </div>
  )
}
