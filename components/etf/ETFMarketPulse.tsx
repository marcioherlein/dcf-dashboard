'use client'

import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import { fmtPctAbs } from '@/lib/formatters'
import { SECTOR_META, GEO_META, ALL_META } from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

// Historical S&P 500 P/E average for context
const SP500_HIST_AVG_PE = 18

interface Props {
  data: Record<string, ETFBatchItem | null>
  loading: boolean
}

export function ETFMarketPulse({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[76px] rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }

  const entries = Object.values(data).filter(Boolean) as ETFBatchItem[]
  if (entries.length === 0) return null

  const spyPE = data['SPY']?.peRatio ?? null
  const spyPEColor = spyPE == null ? '' : spyPE <= 16 ? 'text-[#11875D]' : spyPE <= 22 ? 'text-[#B56A00]' : 'text-[#D83B3B]'
  const spyPELabel = spyPE == null ? '' : spyPE <= 16 ? 'Cheap' : spyPE <= 22 ? 'Fair' : 'Stretched'
  const spyPEContext = spyPE != null
    ? spyPE > SP500_HIST_AVG_PE
      ? `${((spyPE / SP500_HIST_AVG_PE - 1) * 100).toFixed(0)}% above historical avg`
      : `${((1 - spyPE / SP500_HIST_AVG_PE) * 100).toFixed(0)}% below historical avg`
    : null

  const cheapestSector = SECTOR_META
    .map((m) => ({ meta: m, item: data[m.ticker], score: data[m.ticker]?.valueScore ?? null }))
    .filter((x) => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  const topYield = ALL_META
    .map((m) => ({ meta: m, item: data[m.ticker], yld: data[m.ticker]?.yield ?? null }))
    .filter((x) => x.yld != null && x.yld > 0)
    .sort((a, b) => (b.yld ?? 0) - (a.yld ?? 0))[0] ?? null

  // Best value across all ETFs (not just sectors)
  const bestValue = ALL_META
    .map((m) => ({ meta: m, item: data[m.ticker], score: data[m.ticker]?.valueScore ?? null }))
    .filter((x) => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  // Resolve a fund's display name: prefer API name, fall back to meta label
  const fundName = (ticker: string, apiName: string | null | undefined) =>
    apiName ?? GEO_META.find(m => m.ticker === ticker)?.label
      ?? SECTOR_META.find(m => m.ticker === ticker)?.label
      ?? ticker

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {spyPE != null && (
        <Chip label="S&P 500 P/E" sub={spyPEContext ?? undefined}>
          <span className={cn('font-mono text-[20px] font-bold leading-none', spyPEColor)}>{spyPE.toFixed(1)}×</span>
          <Badge color={spyPEColor}>{spyPELabel}</Badge>
        </Chip>
      )}

      {cheapestSector && (
        <Chip label="Best value sector" sub={fundName(cheapestSector.meta.ticker, cheapestSector.item?.name)}>
          <span className="font-mono text-[20px] font-bold leading-none text-[#06101F]">{cheapestSector.meta.ticker}</span>
          <Badge color={scoreColor(cheapestSector.score ?? 0)}>
            {cheapestSector.score} · {scoreLabel(cheapestSector.score ?? 0)}
          </Badge>
        </Chip>
      )}

      {topYield && (
        <Chip label="Highest yield" sub={fundName(topYield.meta.ticker, topYield.item?.name)}>
          <span className="font-mono text-[20px] font-bold leading-none text-[#06101F]">{topYield.meta.ticker}</span>
          <Badge color="text-[#11875D]">{fmtPctAbs(topYield.yld ?? 0)}</Badge>
        </Chip>
      )}

      {bestValue && (
        <Chip label="Best value pick" sub={fundName(bestValue.meta.ticker, bestValue.item?.name)}>
          <span className="font-mono text-[20px] font-bold leading-none text-[#06101F]">{bestValue.meta.ticker}</span>
          <Badge color={scoreColor(bestValue.score ?? 0)}>
            {bestValue.score} · {scoreLabel(bestValue.score ?? 0)}
          </Badge>
        </Chip>
      )}
    </div>
  )
}

function Chip({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl px-4 py-3 flex flex-col gap-1 min-w-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <span className="text-[11px] font-semibold text-[#8A95A6] truncate uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1.5 flex-wrap">{children}</div>
      {sub && <span className="text-[11px] text-[#8A95A6] truncate mt-0.5">{sub}</span>}
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={cn('text-[11px] font-semibold', color)}>{children}</span>
  )
}
