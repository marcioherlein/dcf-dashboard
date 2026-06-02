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
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[68px] w-48 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
    )
  }

  const entries = Object.values(data).filter(Boolean) as ETFBatchItem[]
  if (entries.length === 0) return null

  const spyPE = data['SPY']?.peRatio ?? null
  const spyPEColor = spyPE == null ? '' : spyPE <= 16 ? 'text-emerald-600' : spyPE <= 22 ? 'text-amber-600' : 'text-red-600'
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
    <div className="flex gap-3 flex-wrap">
      {spyPE != null && (
        <Chip label="S&P 500 P/E">
          <span className={cn('font-mono text-[17px] font-bold', spyPEColor)}>{spyPE.toFixed(1)}x</span>
          <span className={cn('text-[11px] font-semibold', spyPEColor)}>{spyPELabel}</span>
        </Chip>
      )}

      {cheapestSector && (
        <Chip label="Cheapest sector">
          <span className="font-mono text-[17px] font-bold text-slate-900">{cheapestSector.meta.ticker}</span>
          <span className={cn('text-[11px] font-semibold', scoreColor(cheapestSector.score ?? 0))}>
            {cheapestSector.score} · {scoreLabel(cheapestSector.score ?? 0)}
          </span>
        </Chip>
      )}

      {topYield && (
        <Chip label="Highest yield">
          <span className="font-mono text-[17px] font-bold text-slate-900">{topYield.meta.ticker}</span>
          <span className="text-[11px] font-semibold text-emerald-600">{fmtPctAbs(topYield.yld ?? 0)}</span>
        </Chip>
      )}

      {bestValue && (
        <Chip label="Best value pick">
          <span className="font-mono text-[17px] font-bold text-slate-900">{bestValue.meta.ticker}</span>
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
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-1 min-w-[152px]">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <div className="flex items-baseline gap-1.5">{children}</div>
    </div>
  )
}
