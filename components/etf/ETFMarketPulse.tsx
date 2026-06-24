'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import { fmtPctAbs } from '@/lib/formatters'
import { SECTOR_META, GEO_META, ALL_META } from '@/lib/data/etfUniverse'
import { Sparkline } from '@/components/ui/Sparkline'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

const SP500_HIST_AVG_PE = 18

// ETF names that contain leveraged/inverse signals — excluded from mover card
const LEVERAGED_PATTERN = /\b(2x|3x|bear|inverse|ultra|short|leveraged|daily)\b/i

interface Props {
  data: Record<string, ETFBatchItem | null>
  loading: boolean
  sparklines?: Record<string, number[] | null>
}

export function ETFMarketPulse({ data, loading, sparklines = {} }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[100px] rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }

  const entries = Object.values(data).filter(Boolean) as ETFBatchItem[]
  if (entries.length === 0) return null

  // ── Card 1: S&P 500 P/E ──────────────────────────────────────────────────────
  const spyPE = data['SPY']?.peRatio ?? null
  const spyPEColor = spyPE == null ? '' : spyPE <= 16 ? 'text-[#11875D]' : spyPE <= 22 ? 'text-[#B56A00]' : 'text-[#D83B3B]'
  const spyPELabel = spyPE == null ? '' : spyPE <= 16 ? 'Cheap' : spyPE <= 22 ? 'Fair' : 'Stretched'
  const spyPEContext = spyPE != null
    ? spyPE > SP500_HIST_AVG_PE
      ? `${((spyPE / SP500_HIST_AVG_PE - 1) * 100).toFixed(0)}% above historical avg`
      : `${((1 - spyPE / SP500_HIST_AVG_PE) * 100).toFixed(0)}% below historical avg`
    : null

  // ── Card 2: Best value sector ─────────────────────────────────────────────────
  const cheapestSector = SECTOR_META
    .map(m => ({ meta: m, item: data[m.ticker], score: data[m.ticker]?.valueScore ?? null }))
    .filter(x => x.score != null && (x.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  // ── Card 3: Highest yield ─────────────────────────────────────────────────────
  const topYield = ALL_META
    .map(m => ({ meta: m, item: data[m.ticker], yld: data[m.ticker]?.yield ?? null }))
    .filter(x => x.yld != null && x.yld > 0)
    .sort((a, b) => (b.yld ?? 0) - (a.yld ?? 0))[0] ?? null

  // ── Card 4: Best value geo ETF (replaces near-duplicate "best value pick") ────
  const bestValueGeo = GEO_META
    .map(m => ({ meta: m, item: data[m.ticker], score: data[m.ticker]?.valueScore ?? null }))
    .filter(x => x.score != null && (x.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  // ── Card 5: Biggest daily mover (non-leveraged, AUM ≥ $100M) ─────────────────
  const biggestMover = ALL_META
    .map(m => ({ meta: m, item: data[m.ticker] }))
    .filter(x =>
      x.item != null &&
      x.item.priceChangePct != null &&
      x.item.aum != null &&
      x.item.aum >= 100_000_000 &&
      !LEVERAGED_PATTERN.test(x.item.name ?? '')
    )
    .sort((a, b) =>
      Math.abs(b.item!.priceChangePct!) - Math.abs(a.item!.priceChangePct!)
    )[0] ?? null

  const fundName = (ticker: string, apiName: string | null | undefined) =>
    apiName ?? GEO_META.find(m => m.ticker === ticker)?.label
      ?? SECTOR_META.find(m => m.ticker === ticker)?.label
      ?? ticker

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

      {/* Card 1 — S&P 500 P/E */}
      {spyPE != null && (
        <PulseChip label="S&P 500 P/E" sub={spyPEContext ?? undefined} href="/etf/SPY" sparkPrices={sparklines['SPY']} changePct={data['SPY']?.priceChangePct ?? null}>
          <span className={cn('font-[700] text-[20px] tabular-nums leading-none', spyPEColor)}>{spyPE.toFixed(1)}×</span>
          <Badge color={spyPEColor} bgClass={spyPE <= 16 ? 'bg-[#E8F7EF]' : spyPE <= 22 ? 'bg-[#FFF4DA]' : 'bg-[#FCEAEA]'}>{spyPELabel}</Badge>
        </PulseChip>
      )}

      {/* Card 2 — Best value sector */}
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

      {/* Card 3 — Highest yield */}
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

      {/* Card 4 — Best value geo ETF */}
      {bestValueGeo && (
        <PulseChip
          label="Best value intl ETF"
          sub={fundName(bestValueGeo.meta.ticker, bestValueGeo.item?.name)}
          href={`/etf/${bestValueGeo.meta.ticker}`}
          sparkPrices={sparklines[bestValueGeo.meta.ticker]}
          changePct={bestValueGeo.item?.priceChangePct ?? null}
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#111111]">{bestValueGeo.meta.ticker}</span>
          <Badge color={scoreColor(bestValueGeo.score ?? 0)} bgClass={bestValueGeo.score && bestValueGeo.score >= 70 ? 'bg-[#E8F7EF]' : 'bg-[#EAF1FF]'}>
            {bestValueGeo.score} · {scoreLabel(bestValueGeo.score ?? 0)}
          </Badge>
        </PulseChip>
      )}

      {/* Card 5 — Biggest daily mover */}
      {biggestMover && (
        <PulseChip
          label="Biggest mover today"
          sub={fundName(biggestMover.meta.ticker, biggestMover.item?.name)}
          href={`/etf/${biggestMover.meta.ticker}`}
          sparkPrices={sparklines[biggestMover.meta.ticker]}
          changePct={biggestMover.item?.priceChangePct ?? null}
        >
          <span className="font-[700] text-[20px] tabular-nums leading-none text-[#111111]">{biggestMover.meta.ticker}</span>
          {biggestMover.item?.priceChangePct != null && (() => {
            const pct = biggestMover.item!.priceChangePct!
            const up = pct >= 0
            const Icon = up ? TrendingUp : TrendingDown
            return (
              <Badge
                color={up ? 'text-[#11875D]' : 'text-[#D83B3B]'}
                bgClass={up ? 'bg-[#E8F7EF]' : 'bg-[#FCEAEA]'}
              >
                <span className="inline-flex items-center gap-0.5">
                  <Icon size={9} strokeWidth={2.5} />
                  {up ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </Badge>
            )
          })()}
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
  const changeUp = (changePct ?? 0) >= 0
  const changeStr = changePct != null
    ? `${changeUp ? '+' : ''}${changePct.toFixed(2)}%`
    : null

  return (
    <Link
      href={href}
      className="block bg-white border border-[#E5E5E5] rounded-xl overflow-hidden hover:border-[#BFD2A1] hover:shadow-sm transition-all"
    >
      <div className="px-3 pt-2.5 pb-0">
        <span className="text-[10px] font-[600] text-[#9B9B9B] truncate block">{label}</span>
      </div>

      <div className="px-3 pt-1 pb-0">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-baseline gap-1.5 flex-wrap">{children}</div>
          {changeStr && (
            <span className={cn(
              'text-[11px] font-[700] px-2 py-0.5 rounded-full tabular-nums shrink-0',
              changeUp ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#FCEAEA] text-[#D83B3B]',
            )}>
              {changeStr}
            </span>
          )}
        </div>
        {sub && <span className="text-[10px] text-[#9B9B9B] truncate block mt-0.5">{sub}</span>}
      </div>

      <div className="relative h-[44px] mt-1.5">
        {hasChart ? (
          <>
            <Sparkline prices={sparkPrices!} up={up} className="w-full h-[44px]" width={200} height={44} />
            <span className="absolute bottom-1 right-2 text-[9px] font-[650] text-[#9B9B9B] bg-white/80 rounded px-1 leading-none">YTD</span>
          </>
        ) : (
          <div className="w-full h-[44px]" />
        )}
      </div>
    </Link>
  )
}

function Badge({ color, bgClass, children }: { color: string; bgClass: string; children: React.ReactNode }) {
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5', color, bgClass)}>{children}</span>
  )
}
