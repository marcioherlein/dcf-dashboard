'use client'

import Link from 'next/link'
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
          <div key={i} className="h-[88px] rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }

  const entries = Object.values(data).filter(Boolean) as ETFBatchItem[]
  if (entries.length === 0) return null

  const spyPE = data['SPY']?.peRatio ?? null
  const spyPEColor = spyPE == null ? '' : spyPE <= 16 ? 'text-[#11875D]' : spyPE <= 22 ? 'text-[#B56A00]' : 'text-[#D83B3B]'
  const spyPELabel = spyPE == null ? '' : spyPE <= 16 ? 'Cheap' : spyPE <= 22 ? 'Fair' : 'Stretched'
  const spyBorderColor = spyPE == null ? '' : spyPE <= 16 ? 'border-l-[#11875D]' : spyPE <= 22 ? 'border-l-[#B56A00]' : 'border-l-[#D83B3B]'
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

  const bestValue = ALL_META
    .map((m) => ({ meta: m, item: data[m.ticker], score: data[m.ticker]?.valueScore ?? null }))
    .filter((x) => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  const fundName = (ticker: string, apiName: string | null | undefined) =>
    apiName ?? GEO_META.find(m => m.ticker === ticker)?.label
      ?? SECTOR_META.find(m => m.ticker === ticker)?.label
      ?? ticker

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {spyPE != null && (
        <Chip label="S&P 500 P/E" sub={spyPEContext ?? undefined} href="/etf/SPY" borderColor={spyBorderColor}>
          <span className={cn('font-[700] text-[20px] tabular-nums leading-none', spyPEColor)}>{spyPE.toFixed(1)}×</span>
          <Badge color={spyPEColor} bgClass={spyPE <= 16 ? 'bg-[#E8F7EF]' : spyPE <= 22 ? 'bg-[#FFF4DA]' : 'bg-[#FCEAEA]'}>{spyPELabel}</Badge>
        </Chip>
      )}

      {cheapestSector && (
        <Chip
          label="Best value sector"
          sub={fundName(cheapestSector.meta.ticker, cheapestSector.item?.name)}
          href={`/etf/${cheapestSector.meta.ticker}`}
          borderColor={cheapestSector.score && cheapestSector.score >= 70 ? 'border-l-[#11875D]' : cheapestSector.score && cheapestSector.score >= 50 ? 'border-l-[#2563EB]' : 'border-l-[#B56A00]'}
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#06101F]">{cheapestSector.meta.ticker}</span>
          <Badge color={scoreColor(cheapestSector.score ?? 0)} bgClass={cheapestSector.score && cheapestSector.score >= 70 ? 'bg-[#E8F7EF]' : 'bg-[#EAF1FF]'}>
            {cheapestSector.score} · {scoreLabel(cheapestSector.score ?? 0)}
          </Badge>
        </Chip>
      )}

      {topYield && (
        <Chip
          label="Highest yield"
          sub={fundName(topYield.meta.ticker, topYield.item?.name)}
          href={`/etf/${topYield.meta.ticker}`}
          borderColor="border-l-[#11875D]"
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#06101F]">{topYield.meta.ticker}</span>
          <Badge color="text-[#11875D]" bgClass="bg-[#E8F7EF]">{fmtPctAbs(topYield.yld ?? 0)}</Badge>
        </Chip>
      )}

      {bestValue && (
        <Chip
          label="Best value pick"
          sub={fundName(bestValue.meta.ticker, bestValue.item?.name)}
          href={`/etf/${bestValue.meta.ticker}`}
          borderColor={bestValue.score && bestValue.score >= 70 ? 'border-l-[#11875D]' : 'border-l-[#2563EB]'}
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#06101F]">{bestValue.meta.ticker}</span>
          <Badge color={scoreColor(bestValue.score ?? 0)} bgClass={bestValue.score && bestValue.score >= 70 ? 'bg-[#E8F7EF]' : 'bg-[#EAF1FF]'}>
            {bestValue.score} · {scoreLabel(bestValue.score ?? 0)}
          </Badge>
        </Chip>
      )}
    </div>
  )
}

function Chip({ label, sub, children, href }: {
  label: string
  sub?: string
  children: React.ReactNode
  href: string
  borderColor?: string  // kept for API compat but no longer applied
}) {
  return (
    <Link
      href={href}
      className="block bg-white border border-[#E3E1DA] rounded-xl px-4 py-3 flex flex-col gap-1 min-w-0 hover:border-[#BFD2A1] hover:shadow-sm transition-all"
    >
      <span className="text-[10px] font-semibold text-[#8A95A6] truncate uppercase tracking-[0.08em]">{label}</span>
      <div className="flex items-baseline gap-1.5 flex-wrap">{children}</div>
      {sub && <span className="text-[10px] text-[#9B9B9B] truncate mt-0.5">{sub}</span>}
    </Link>
  )
}

function Badge({ color, bgClass, children }: { color: string; bgClass: string; children: React.ReactNode }) {
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', color, bgClass)}>{children}</span>
  )
}
