'use client'

import { memo, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scoreColor, scoreLabel, scoreBadge, computeETFScore, explainScore } from '@/lib/data/etfScore'
import { fmtMultiple } from '@/lib/formatters'
import { Sparkline } from '@/components/ui/Sparkline'
import type { ETFMeta } from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'

// ── Category-average expense ratios ─────────────────────────────────────────
const CATEGORY_AVG_EXPENSE: Record<string, number> = {
  sector: 0.0013,  // SPDR sectors ~0.13%
  geo:    0.0035,  // international ETFs ~0.35%
  style:  0.0015,  // factor/style ETFs ~0.15%
}

interface TopHolding { symbol: string; holdingName?: string; holdingPercent?: number | null }

interface Props {
  metas: ETFMeta[]
  data: Record<string, ETFBatchItem | null>
  watchlistedTickers: Set<string>
  onAdd: (ticker: string) => void
  cols?: 3 | 4
  hasError?: boolean
  sparklines?: Record<string, number[] | null>
}

// ── Score breakdown tooltip ──────────────────────────────────────────────────
function ScoreBreakdownTooltip({ item }: { item: ETFBatchItem }) {
  const { score, breakdown } = computeETFScore(item.peRatio, item.pbRatio, item.yield, item.expenseRatio)
  const explain = explainScore(breakdown, score, {
    peRatio: item.peRatio,
    pbRatio: item.pbRatio,
    yieldVal: item.yield,
    expenseRatio: item.expenseRatio,
  })
  const lines = [
    item.peRatio != null ? `P/E ${item.peRatio.toFixed(1)}× → ${breakdown.pe}/30 pts` : null,
    item.pbRatio != null ? `P/B ${item.pbRatio.toFixed(1)}× → ${breakdown.pb}/25 pts` : null,
    item.yield != null && item.yield > 0 ? `Yield ${(item.yield * 100).toFixed(1)}% → ${breakdown.yieldPts}/25 pts` : null,
    item.expenseRatio != null ? `Expense ${(item.expenseRatio * 100).toFixed(2)}% → −${breakdown.expensePenalty} pts` : null,
  ].filter(Boolean).join('\n')
  const fullText = lines ? `${explain}\n\n${lines}` : explain

  return (
    <button
      data-no-min-h
      title={fullText}
      className="text-[9px] text-[#9B9B9B] hover:text-olive-700 transition-colors px-0.5"
      onClick={(e) => e.preventDefault()}
      aria-label="Why this score"
    >
      ?
    </button>
  )
}

// ── Expense ratio bar ────────────────────────────────────────────────────────
function ExpenseBar({ expenseRatio, group }: { expenseRatio: number | null; group: string }) {
  if (expenseRatio == null) return null
  const avg = CATEGORY_AVG_EXPENSE[group] ?? 0.002
  const isCheap    = expenseRatio <= avg * 0.75
  const isExpensive = expenseRatio > avg * 1.5
  const barColor   = isCheap ? 'bg-[#11875D]' : isExpensive ? 'bg-[#D83B3B]' : 'bg-[#B56A00]'
  const maxRatio   = avg * 2
  const barW       = Math.min(100, (expenseRatio / maxRatio) * 100)
  const avgW       = Math.min(100, (avg / maxRatio) * 100)
  const erPct      = (expenseRatio * 100).toFixed(2)
  const avgPct     = (avg * 100).toFixed(2)

  return (
    <div className="px-3 pb-2 pt-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] font-[600] text-[#9B9B9B] tracking-wide uppercase leading-none">Expense ratio</span>
        <span className={cn(
          'text-[10px] font-[700] tabular-nums leading-none',
          isCheap ? 'text-[#11875D]' : isExpensive ? 'text-[#D83B3B]' : 'text-[#B56A00]',
        )}>
          {erPct}%
        </span>
      </div>
      <div className="relative h-1 rounded-full bg-[#F0F0F0]">
        <div className={cn('absolute left-0 top-0 h-1 rounded-full', barColor)} style={{ width: `${barW}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-[#9B9B9B] opacity-60"
          style={{ left: `${avgW}%` }}
          title={`Category avg: ${avgPct}%`}
        />
      </div>
      <p className="text-[9px] text-[#9B9B9B] mt-0.5 leading-none">
        {isCheap
          ? `${((1 - expenseRatio / avg) * 100).toFixed(0)}% below avg (${avgPct}%)`
          : isExpensive
          ? `${((expenseRatio / avg - 1) * 100).toFixed(0)}% above avg (${avgPct}%)`
          : `Near avg (${avgPct}%)`}
      </p>
    </div>
  )
}

// ── Top-5 holdings expandable ────────────────────────────────────────────────
function HoldingsPreview({ ticker, group }: { ticker: string; group: string }) {
  const [holdings, setHoldings] = useState<TopHolding[] | null>(null)
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)

  const load = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (holdings !== null) { setOpen(v => !v); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/etf/profile?ticker=${ticker}`)
      if (res.ok) {
        const json = await res.json()
        setHoldings(json?.holdings ?? [])
      } else {
        setHoldings([])
      }
    } catch {
      setHoldings([])
    } finally {
      setLoading(false)
      setOpen(true)
    }
  }, [ticker, holdings])

  // Geo ETFs hold country exposure, not individual stocks — skip
  if (group === 'geo') return null

  const top5 = (holdings ?? []).slice(0, 5)

  return (
    <div className="relative z-20 px-3 pb-2.5">
      <button
        onClick={load}
        className="flex items-center gap-1 text-[9px] font-[600] text-[#9B9B9B] hover:text-olive-700 transition-colors"
        data-no-min-h
      >
        {loading ? (
          <span>Loading…</span>
        ) : open ? (
          <><ChevronUp size={9} />Hide holdings</>
        ) : (
          <><ChevronDown size={9} />Top holdings</>
        )}
      </button>

      {open && (
        <div className="mt-1">
          {top5.length > 0 ? (
            <>
              {top5.map((h) => (
                <div key={h.symbol} className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] font-[650] text-[#111111]">{h.symbol}</span>
                  {h.holdingPercent != null && (
                    <span className="text-[10px] text-[#6B6B6B] tabular-nums">
                      {(h.holdingPercent * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
              <Link
                href={`/etf/${ticker}`}
                onClick={(e) => e.stopPropagation()}
                className="block text-[9px] text-olive-700 hover:underline mt-1 leading-none"
              >
                All holdings →
              </Link>
            </>
          ) : (
            <p className="text-[9px] text-[#9B9B9B]">No holdings data</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Category rank badge ──────────────────────────────────────────────────────
function CategoryRankBadge({ score, allScores }: { score: number; allScores: number[] }) {
  const sorted = [...allScores].sort((a, b) => b - a)
  const rank   = sorted.findIndex(s => s <= score) + 1
  const total  = sorted.length
  const pct    = Math.round((rank / total) * 100)
  const isTop  = pct <= 33
  return (
    <span className={cn(
      'text-[9px] font-[600] px-1 py-px rounded leading-none',
      isTop ? 'text-[#11875D] bg-[#E8F7EF]' : 'text-[#9B9B9B] bg-[#F5F5F5]',
    )}>
      Top {pct}%
    </span>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export const ETFHeatmapGrid = memo(function ETFHeatmapGrid({
  metas, data, watchlistedTickers, onAdd, cols = 3, hasError, sparklines = {}
}: Props) {
  const loading = !hasError && Object.keys(data).length === 0

  const allScores = metas
    .map(m => data[m.ticker]?.valueScore)
    .filter((s): s is number => s != null)

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#8A95A6] py-4">
        <AlertCircle size={14} className="text-[#D83B3B] shrink-0" />
        <span>Could not load ETF data. Use Retry above to refresh.</span>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-2', cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3')}>
      {metas.map((meta) => {
        const item          = data[meta.ticker] ?? null
        const score         = item?.valueScore ?? null
        const isWatchlisted = watchlistedTickers.has(meta.ticker)
        const sparkPrices   = sparklines[meta.ticker]
        const hasChart      = sparkPrices != null && sparkPrices.length >= 2
        const sparkUp       = hasChart
          ? sparkPrices![sparkPrices!.length - 1] >= sparkPrices![0]
          : (item?.priceChangePct ?? 0) >= 0
        const changePct     = item?.priceChangePct ?? null
        const changeUp      = (changePct ?? 0) >= 0
        const changeStr     = changePct != null ? `${changeUp ? '+' : ''}${changePct.toFixed(2)}%` : null

        if (loading) {
          return <div key={meta.ticker} className="h-[160px] rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] motion-safe:animate-pulse" />
        }

        return (
          <div
            key={meta.ticker}
            className="group relative rounded-xl border border-[#E5E5E5] bg-white transition-all hover:border-[#BFD2A1] hover:shadow-sm overflow-hidden"
          >
            <Link href={`/etf/${meta.ticker}`} className="absolute inset-0 rounded-xl z-0" tabIndex={-1} aria-hidden="true" />

            {/* Ticker + change pill */}
            <div className="relative z-10 flex items-start justify-between gap-1 px-3 pt-2.5 pb-0">
              <Link href={`/etf/${meta.ticker}`} tabIndex={0} className="min-w-0 flex-1">
                <span className="block font-[700] text-[13px] text-[#111111] leading-none group-hover:text-olive-700 transition-colors">
                  {meta.ticker}
                </span>
                <span className="block text-[10px] text-[#9B9B9B] mt-0.5 leading-tight truncate">
                  {meta.label}
                </span>
              </Link>
              {changeStr ? (
                <span className={cn(
                  'shrink-0 text-[10px] font-[700] px-1.5 py-0.5 rounded-full tabular-nums leading-none',
                  changeUp ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#FCEAEA] text-[#D83B3B]',
                )}>
                  {changeStr}
                </span>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(meta.ticker) }}
                  data-no-min-h
                  className={cn(
                    'relative z-20 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all',
                    isWatchlisted ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#F5F5F5] text-[#9B9B9B] hover:bg-olive-50 hover:text-olive-700',
                  )}
                  aria-label={isWatchlisted ? `${meta.ticker} is in your watchlist` : `Add ${meta.ticker} to watchlist`}
                >
                  {isWatchlisted ? <Check size={10} /> : <Plus size={10} />}
                </button>
              )}
            </div>

            {/* Score + rank + breakdown tooltip */}
            <div className="relative z-10 flex items-center gap-1.5 flex-wrap px-3 pt-1.5 pb-0">
              {score != null ? (
                <>
                  <span className={cn('text-[12px] font-[700] tabular-nums leading-none', scoreColor(score))}>{score}</span>
                  <span className={cn('text-[10px] font-[600] px-1.5 py-0.5 rounded-full leading-none', scoreBadge(score))}>
                    {scoreLabel(score)}
                  </span>
                  {item && <ScoreBreakdownTooltip item={item} />}
                  {allScores.length > 1 && <CategoryRankBadge score={score} allScores={allScores} />}
                </>
              ) : (
                <div className="h-4 w-12 rounded bg-[#E5E5E5] motion-safe:animate-pulse" />
              )}
              {item?.peRatio != null && (
                <span className="text-[10px] text-[#9B9B9B] ml-auto">
                  P/E <span className="font-[600] tabular-nums text-[#6B6B6B]">{fmtMultiple(item.peRatio)}</span>
                </span>
              )}
            </div>

            {/* YTD sparkline */}
            <div className="relative h-[32px] mt-1">
              {hasChart ? (
                <>
                  <Sparkline prices={sparkPrices!} up={sparkUp} className="w-full h-[32px]" width={200} height={32} />
                  <span className="absolute bottom-0.5 right-2 text-[9px] font-[650] text-[#9B9B9B] bg-white/80 rounded px-1 leading-none">YTD</span>
                </>
              ) : (
                <div className="w-full h-[32px]" />
              )}
              {changeStr && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(meta.ticker) }}
                  data-no-min-h
                  className={cn(
                    'absolute bottom-1 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-md transition-all',
                    isWatchlisted ? 'text-[#11875D]' : 'text-[#9B9B9B] hover:text-olive-700',
                  )}
                  aria-label={isWatchlisted ? `${meta.ticker} is in your watchlist` : `Add ${meta.ticker} to watchlist`}
                >
                  {isWatchlisted ? <Check size={9} /> : <Plus size={9} />}
                </button>
              )}
            </div>

            {/* Expense ratio bar vs category avg */}
            {item?.expenseRatio != null && (
              <ExpenseBar expenseRatio={item.expenseRatio} group={meta.group} />
            )}

            {/* Top-5 holdings expandable */}
            <HoldingsPreview ticker={meta.ticker} group={meta.group} />
          </div>
        )
      })}
    </div>
  )
})
