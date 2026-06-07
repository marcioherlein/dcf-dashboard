'use client'

import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import { SECTOR_META, ALL_META } from '@/lib/data/etfUniverse'
import { fmtPctAbs } from '@/lib/formatters'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

interface Props {
  data: Record<string, ETFBatchItem | null>
  loading: boolean
}

export function ETFMarketPulse({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[64px] rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }

  const entries = Object.values(data).filter(Boolean) as ETFBatchItem[]
  if (entries.length === 0) return null

  const spyPE = data['SPY']?.peRatio ?? null
  const spyPEColor = spyPE == null ? '' : spyPE <= 16 ? 'text-[#11875D]' : spyPE <= 22 ? 'text-[#B56A00]' : 'text-[#D83B3B]'
  const spyPELabel = spyPE == null ? '' : spyPE <= 16 ? 'Cheap' : spyPE <= 22 ? 'Fair' : 'Stretched'

  const cheapestSector = SECTOR_META
    .map((m) => ({ meta: m, score: data[m.ticker]?.valueScore ?? null }))
    .filter((x) => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  const topYield = ALL_META
    .map((m) => ({ meta: m, yld: data[m.ticker]?.yield ?? null }))
    .filter((x) => x.yld != null && x.yld > 0)
    .sort((a, b) => (b.yld ?? 0) - (a.yld ?? 0))[0] ?? null

  const bestValue = ALL_META
    .map((m) => ({ meta: m, score: data[m.ticker]?.valueScore ?? null }))
    .filter((x) => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
      {spyPE != null && (
        <Chip label="S&P 500 P/E">
          <span className={cn('font-mono text-[17px] font-bold', spyPEColor)}>{spyPE.toFixed(1)}x</span>
          <span className={cn('text-[11px] font-semibold', spyPEColor)}>{spyPELabel}</span>
        </Chip>
      )}

      {cheapestSector && (
        <Chip label="Best value sector">
          <span className="font-mono text-[17px] font-bold text-[#06101F]">{cheapestSector.meta.ticker}</span>
          <span className={cn('text-[11px] font-semibold', scoreColor(cheapestSector.score ?? 0))}>
            {cheapestSector.score} · {scoreLabel(cheapestSector.score ?? 0)}
          </span>
        </Chip>
      )}

      {topYield && (
        <Chip label="Highest yield">
          <span className="font-mono text-[17px] font-bold text-[#06101F]">{topYield.meta.ticker}</span>
          <span className="text-[11px] font-semibold text-[#11875D]">{fmtPctAbs(topYield.yld ?? 0)}</span>
        </Chip>
      )}

      {bestValue && (
        <Chip label="Best value pick">
          <span className="font-mono text-[17px] font-bold text-[#06101F]">{bestValue.meta.ticker}</span>
          <span className={cn('text-[11px] font-semibold', scoreColor(bestValue.score ?? 0))}>
            {bestValue.score} · {scoreLabel(bestValue.score ?? 0)}
          </span>
        </Chip>
      )}
    </div>
  )
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl px-4 py-3 flex flex-col gap-0.5 min-w-0 w-full sm:w-auto sm:min-w-[140px]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <span className="text-[11px] font-[650] text-[#566174] truncate">{label}</span>
      <div className="flex items-baseline gap-1.5 flex-wrap">{children}</div>
    </div>
  )
}
