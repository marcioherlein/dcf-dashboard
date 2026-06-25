'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SECTOR_META } from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

interface Props {
  data: Record<string, ETFBatchItem | null>
  loading: boolean
}

export function ETFSectorRotation({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-[#F0F1F6] motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const spyReturn = data['SPY']?.return1M ?? null

  const sectors = SECTOR_META
    .map(m => ({
      ticker: m.ticker,
      label: m.label,
      return1M: data[m.ticker]?.return1M ?? null,
      priceChangePct: data[m.ticker]?.priceChangePct ?? null,
    }))
    .filter(s => s.return1M != null)
    .sort((a, b) => (b.return1M ?? 0) - (a.return1M ?? 0))

  if (sectors.length === 0) return null

  // Clamp scale: max absolute value seen, minimum ±5%
  const maxAbs = Math.max(5, ...sectors.map(s => Math.abs(s.return1M ?? 0))) * 100

  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F0F1F6]">
        <div>
          <span className="text-[12px] font-[700] text-[#111111]">Sector Rotation</span>
          <span className="text-[10px] text-[#9B9B9B] ml-2">1-month return</span>
        </div>
        {spyReturn != null && (
          <span className="text-[10px] text-[#9B9B9B]">
            SPY <span className={cn('font-[600]', spyReturn >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
              {spyReturn >= 0 ? '+' : ''}{(spyReturn * 100).toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      {/* Bars */}
      <div className="px-4 py-3 space-y-1.5">
        {sectors.map(s => {
          const val = (s.return1M ?? 0) * 100
          const isPos = val >= 0
          const barPct = Math.min(100, (Math.abs(val) / maxAbs) * 100)

          // relative to SPY
          const relToSpy = spyReturn != null ? val - (spyReturn * 100) : null

          return (
            <Link
              key={s.ticker}
              href={`/etf/${s.ticker}`}
              className="flex items-center gap-2 group hover:bg-[#F9F8F5] rounded-lg px-1 -mx-1 py-0.5 transition-colors"
            >
              {/* Ticker */}
              <span className="text-[11px] font-[600] text-[#566174] w-8 shrink-0 group-hover:text-olive-700 transition-colors">
                {s.ticker}
              </span>

              {/* Bar — centered, grows left for negative, right for positive */}
              <div className="flex-1 flex items-center h-5 relative">
                <div className="absolute inset-0 flex items-center">
                  {/* Center line */}
                  <div className="absolute left-1/2 w-px h-full bg-[#E3E1DA]" />

                  {isPos ? (
                    <div
                      className="absolute h-3.5 rounded-sm bg-[#11875D] opacity-80"
                      style={{ left: '50%', width: `${barPct / 2}%` }}
                    />
                  ) : (
                    <div
                      className="absolute h-3.5 rounded-sm bg-[#D83B3B] opacity-80"
                      style={{ right: '50%', width: `${barPct / 2}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Return value */}
              <span className={cn(
                'text-[11px] font-[700] tabular-nums w-14 text-right shrink-0',
                isPos ? 'text-[#11875D]' : 'text-[#D83B3B]',
              )}>
                {isPos ? '+' : ''}{val.toFixed(1)}%
              </span>

              {/* vs SPY badge */}
              {relToSpy != null && (
                <span className={cn(
                  'text-[9px] font-[600] tabular-nums w-12 text-right shrink-0',
                  relToSpy > 0 ? 'text-[#11875D]' : relToSpy < 0 ? 'text-[#D83B3B]' : 'text-[#9B9B9B]',
                )}>
                  {relToSpy > 0 ? '+' : ''}{relToSpy.toFixed(1)}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {spyReturn != null && (
        <div className="px-4 pb-2.5 pt-0">
          <p className="text-[9px] text-[#9B9B9B]">Last column = vs SPY 1M</p>
        </div>
      )}
    </div>
  )
}
