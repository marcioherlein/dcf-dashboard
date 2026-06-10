'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import { fmtPctAbs } from '@/lib/formatters'
import { SECTOR_META, GEO_META, ALL_META } from '@/lib/data/etfUniverse'
import { Sparkline } from '@/components/ui/Sparkline'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

const SP500_HIST_AVG_PE = 18

interface Props {
  data: Record<string, ETFBatchItem | null>
  loading: boolean
  sparklines?: Record<string, number[] | null>
}

export function ETFMarketPulse({ data, loading, sparklines = {} }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[100px] rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] motion-safe:animate-pulse" />
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
    .map(m => ({ meta: m, item: data[m.ticker], score: data[m.ticker]?.valueScore ?? null }))
    .filter(x => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  const topYield = ALL_META
    .map(m => ({ meta: m, item: data[m.ticker], yld: data[m.ticker]?.yield ?? null }))
    .filter(x => x.yld != null && x.yld > 0)
    .sort((a, b) => (b.yld ?? 0) - (a.yld ?? 0))[0] ?? null

  const bestValue = ALL_META
    .map(m => ({ meta: m, item: data[m.ticker], score: data[m.ticker]?.valueScore ?? null }))
    .filter(x => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  const fundName = (ticker: string, apiName: string | null | undefined) =>
    apiName ?? GEO_META.find(m => m.ticker === ticker)?.label
      ?? SECTOR_META.find(m => m.ticker === ticker)?.label
      ?? ticker

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {spyPE != null && (
        <PulseChip label="S&P 500 P/E" sub={spyPEContext ?? undefined} href="/etf/SPY" sparkPrices={sparklines['SPY']} changePct={data['SPY']?.priceChangePct ?? null}>
          <span className={cn('font-[700] text-[20px] tabular-nums leading-none', spyPEColor)}>{spyPE.toFixed(1)}×</span>
          <Badge color={spyPEColor} bgClass={spyPE <= 16 ? 'bg-[#E8F7EF]' : spyPE <= 22 ? 'bg-[#FFF4DA]' : 'bg-[#FCEAEA]'}>{spyPELabel}</Badge>
        </PulseChip>
      )}

      {cheapestSector && (
        <PulseChip
          label="Best value sector"
          sub={fundName(cheapestSector.meta.ticker, cheapestSector.item?.name)}
          href={`/etf/${cheapestSector.meta.ticker}`}
          sparkPrices={sparklines[cheapestSector.meta.ticker]}
          changePct={cheapestSector.item?.priceChangePct ?? null}
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#111111]">{cheapestSector.meta.ticker}</span>
          <Badge color={scoreColor(cheapestSector.score ?? 0)} bgClass={cheapestSector.score && cheapestSector.score >= 70 ? 'bg-[#E8F7EF]' : 'bg-[#EAF1FF]'}>
            {cheapestSector.score} · {scoreLabel(cheapestSector.score ?? 0)}
          </Badge>
        </PulseChip>
      )}

      {topYield && (
        <PulseChip
          label="Highest yield"
          sub={fundName(topYield.meta.ticker, topYield.item?.name)}
          href={`/etf/${topYield.meta.ticker}`}
          sparkPrices={sparklines[topYield.meta.ticker]}
          changePct={topYield.item?.priceChangePct ?? null}
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#111111]">{topYield.meta.ticker}</span>
          <Badge color="text-[#11875D]" bgClass="bg-[#E8F7EF]">{fmtPctAbs(topYield.yld ?? 0)}</Badge>
        </PulseChip>
      )}

      {bestValue && (
        <PulseChip
          label="Best value pick"
          sub={fundName(bestValue.meta.ticker, bestValue.item?.name)}
          href={`/etf/${bestValue.meta.ticker}`}
          sparkPrices={sparklines[bestValue.meta.ticker]}
          changePct={bestValue.item?.priceChangePct ?? null}
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#111111]">{bestValue.meta.ticker}</span>
          <Badge color={scoreColor(bestValue.score ?? 0)} bgClass={bestValue.score && bestValue.score >= 70 ? 'bg-[#E8F7EF]' : 'bg-[#EAF1FF]'}>
            {bestValue.score} · {scoreLabel(bestValue.score ?? 0)}
          </Badge>
        </PulseChip>
      )}
    </div>
  )
}

function PulseChip({ label, sub, children, href, sparkPrices, changePct }: {
  label: string
  sub?: string
  children: React.ReactNode
  href: string
  sparkPrices?: number[] | null
  changePct?: number | null
}) {
  const hasChart = sparkPrices != null && sparkPrices.length >= 2
  const up = hasChart ? sparkPrices![sparkPrices!.length - 1] >= sparkPrices![0] : (changePct ?? 0) >= 0

  return (
    <Link
      href={href}
      className="block bg-white border border-[#E5E5E5] rounded-xl overflow-hidden hover:border-[#BFD2A1] hover:shadow-sm transition-all"
    >
      {/* Top: label + metric */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-[600] text-[#9B9B9B] truncate block mb-1.5">{label}</span>
        <div className="flex items-baseline gap-1.5 flex-wrap">{children}</div>
        {sub && <span className="text-[10px] text-[#9B9B9B] truncate block mt-0.5">{sub}</span>}
      </div>

      {/* Bottom: sparkline */}
      {hasChart ? (
        <div className="h-[40px] mt-1">
          <Sparkline prices={sparkPrices!} up={up} className="w-full h-[40px]" width={200} height={40} />
        </div>
      ) : (
        <div className="h-[40px] mt-1" />
      )}
    </Link>
  )
}

function Badge({ color, bgClass, children }: { color: string; bgClass: string; children: React.ReactNode }) {
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', color, bgClass)}>{children}</span>
  )
}

