'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  sectors: MarketInstrument[]
}

const SECTOR_NAMES: Record<string, string> = {
  XLK:  'Technology',
  XLF:  'Financials',
  XLV:  'Health Care',
  XLY:  'Cons. Disc.',
  XLC:  'Comm. Svcs',
  XLI:  'Industrials',
  XLP:  'Cons. Staples',
  XLE:  'Energy',
  XLB:  'Materials',
  XLRE: 'Real Estate',
  XLU:  'Utilities',
}

export default function SectorPerformanceCard({ sectors }: Props) {
  const [showAll, setShowAll] = useState(false)

  const sorted = [...sectors]
    .filter(s => s.changePct != null)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))

  const maxAbs = Math.max(...sorted.map(s => Math.abs(s.changePct ?? 0)), 0.1)
  const visible = showAll ? sorted : sorted.slice(0, 6)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sector Performance</span>
        <p className="text-[10px] text-slate-400 mt-0.5">Daily change · S&P 500 sectors</p>
      </div>

      <div className="px-4 py-3 space-y-2 flex-1">
        {visible.map(s => {
          const p = s.changePct ?? 0
          const up = p >= 0
          const barHalfW = (Math.abs(p) / maxAbs) * 50
          const name = SECTOR_NAMES[s.symbol] ?? s.name ?? s.symbol
          return (
            <div key={s.symbol} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 w-[88px] shrink-0 truncate">{name}</span>
              <div className="flex-1 relative h-3 flex items-center">
                <div className="absolute inset-0 rounded-full bg-slate-100" />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" />
                {up ? (
                  <div
                    className="absolute top-0.5 bottom-0.5 rounded-r-full bg-emerald-400"
                    style={{ left: '50%', width: `${barHalfW}%` }}
                  />
                ) : (
                  <div
                    className="absolute top-0.5 bottom-0.5 rounded-l-full bg-red-400"
                    style={{ right: '50%', width: `${barHalfW}%` }}
                  />
                )}
              </div>
              <span className={cn(
                'text-[10px] font-semibold tabular-nums w-12 text-right shrink-0',
                up ? 'text-emerald-600' : 'text-red-500'
              )}>
                {p >= 0 ? '+' : ''}{p.toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>

      {sorted.length > 6 && (
        <div className="px-4 pb-3 border-t border-slate-50 pt-2">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors min-h-[44px] flex items-center"
          >
            {showAll ? 'Show fewer sectors' : `Show all ${sorted.length} sectors`}
          </button>
        </div>
      )}
    </div>
  )
}
