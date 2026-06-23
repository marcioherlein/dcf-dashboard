'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Trash2, ChevronDown, ChevronUp, ChevronsUpDown, ArrowRight } from 'lucide-react'
import { ETFBatchItem, ETFEntry } from '@/lib/data/etfTypes'
import { scoreColor, scoreLabel, scoreBadge } from '@/lib/data/etfScore'
import { fmtLarge, fmtPctAbs } from '@/lib/formatters'
import { Sparkline } from '@/components/ui/Sparkline'
import { cn } from '@/lib/utils'

interface Props {
  entries: ETFEntry[]
  batchData: Record<string, ETFBatchItem | null>
  sparklines: Record<string, number[] | null>
  watchlistTickers: Set<string>
  selectedTickers: Set<string>
  onToggleSelect: (ticker: string) => void
  onDelete: (ticker: string) => void
  onAdd: (ticker: string) => void
  loading: boolean
}

type SortKey =
  | 'price'
  | 'priceChangePct'
  | 'return1M'
  | 'return1Y'
  | 'expenseRatio'
  | 'yield'
  | 'aum'
  | 'valueScore'

type SortDir = 'asc' | 'desc'

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  return '$' + v.toFixed(2)
}

function ReturnCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-[#8A95A6]">—</span>
  const isPos = value >= 0
  return (
    <span className={isPos ? 'text-[#11875D]' : 'text-[#D83B3B]'}>
      {isPos ? '+' : ''}
      {(value * 100).toFixed(2)}%
    </span>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="inline w-3 h-3 ml-0.5 text-[#B0BAC8]" />
  if (sortDir === 'desc') return <ChevronDown className="inline w-3 h-3 ml-0.5 text-[#5F790B]" />
  return <ChevronUp className="inline w-3 h-3 ml-0.5 text-[#5F790B]" />
}

const DEFAULT_EXPENSE_AVG = 0.002 // 0.20%

// ── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 12 }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3 rounded bg-[#E3E1DA] animate-pulse" style={{ width: i === 1 ? 80 : i === 10 ? 60 : 40 }} />
        </td>
      ))}
    </tr>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ETFWatchlistTable({
  entries,
  batchData,
  sparklines,
  watchlistTickers: _watchlistTickers,
  selectedTickers,
  onToggleSelect,
  onDelete,
  onAdd: _onAdd,
  loading,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(col)
      setSortDir('desc')
    }
  }

  // Merge entry + batchData, then sort
  const rows = [...entries]
    .sort((a, b) => {
      if (!sortKey) {
        // default: insertion order by addedAt
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
      }
      const ba = batchData[a.ticker]
      const bb = batchData[b.ticker]

      function getValue(entry: ETFEntry, batch: ETFBatchItem | null): number {
        if (!batch) return -Infinity
        switch (sortKey) {
          case 'price':         return batch.price ?? -Infinity
          case 'priceChangePct':return batch.priceChangePct ?? -Infinity
          case 'return1M':      return batch.return1M ?? -Infinity
          case 'return1Y':      return batch.return1Y ?? -Infinity
          case 'expenseRatio':  return batch.expenseRatio ?? Infinity
          case 'yield':         return batch.yield ?? -Infinity
          case 'aum':           return batch.aum ?? -Infinity
          case 'valueScore':    return batch.valueScore ?? -Infinity
          default:              return -Infinity
        }
      }

      const va = getValue(a, ba)
      const vb = getValue(b, bb)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'desc' ? -cmp : cmp
    })

  function ThSort({ col, label, className }: { col: SortKey; label: string; className?: string }) {
    return (
      <th
        className={cn(
          'px-3 py-2 text-right cursor-pointer select-none whitespace-nowrap',
          sortKey === col && 'text-[#5F790B]',
          className,
        )}
        onClick={() => handleSort(col)}
      >
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </th>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E3E1DA]">
      <table className="w-full min-w-[900px] bg-white text-[12px]">
        {/* ── Header ── */}
        <thead className="bg-[#F0F1F6] border-b border-[#E3E1DA] text-[11px] font-[600] text-[#566174]">
          <tr>
            {/* Checkbox */}
            <th className="px-3 py-2 w-6" />

            {/* ETF — sticky left */}
            <th className="px-3 py-2 text-left sticky left-0 z-10 bg-[#F0F1F6] min-w-[160px]">
              ETF
            </th>

            {/* Sortable columns */}
            <ThSort col="price"          label="Price"  className="min-w-[70px]" />
            <ThSort col="priceChangePct" label="1D%"    className="min-w-[60px]" />
            <ThSort col="return1M"       label="1M%"    className="min-w-[60px]" />
            <ThSort col="return1Y"       label="1Y%"    className="min-w-[60px]" />
            <ThSort col="expenseRatio"   label="Exp.%"  className="min-w-[62px]" />
            <ThSort col="yield"          label="Yield"  className="min-w-[60px]" />
            <ThSort col="aum"            label="AUM"    className="min-w-[72px]" />
            <ThSort col="valueScore"     label="Score"  className="min-w-[100px]" />

            {/* Chart */}
            <th className="px-3 py-2 text-center min-w-[72px]">Chart</th>

            {/* Action */}
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody className="divide-y divide-[#F0F1F6]">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : (
            rows.map(entry => {
              const ticker = entry.ticker
              const batch = batchData[ticker] ?? null
              const sparkPrices = sparklines[ticker] ?? []
              const isSelected = selectedTickers.has(ticker)
              const isUp = sparkPrices.length >= 2
                ? sparkPrices[sparkPrices.length - 1] >= sparkPrices[0]
                : true

              const expRatio = batch?.expenseRatio ?? null
              const expCheap = expRatio != null && expRatio < DEFAULT_EXPENSE_AVG

              const score = batch?.valueScore ?? 0
              const label = scoreLabel(
                score,
                batch?.peRatio ?? null,
                batch?.pbRatio ?? null,
              )
              const badgeCls = scoreBadge(score)
              const scoreTxtCls = scoreColor(score)

              return (
                <motion.tr
                  key={ticker}
                  layout
                  className={cn(
                    'transition-colors',
                    isSelected ? 'bg-[#F0F4E8]' : 'hover:bg-[#F9F8F5]',
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(ticker)}
                      className="w-4 h-4 rounded accent-olive-700 cursor-pointer"
                    />
                  </td>

                  {/* ETF name + ticker — sticky left */}
                  <td className={cn(
                    'px-3 py-2.5 sticky left-0 z-10',
                    isSelected ? 'bg-[#F0F4E8]' : 'bg-white group-hover:bg-[#F9F8F5]',
                  )}>
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/etf/${ticker}`}
                        className="flex items-center gap-1 group/link"
                      >
                        <span className="text-[13px] font-[700] text-[#111111] group-hover/link:text-olive-700 transition-colors">
                          {ticker}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#B0BAC8] opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </Link>
                      <span className="text-[11px] text-[#8A95A6] truncate max-w-[140px]">
                        {batch?.name ?? entry.name ?? ''}
                      </span>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#111111]">
                    {fmtPrice(batch?.price)}
                  </td>

                  {/* 1D% */}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <ReturnCell value={batch?.priceChangePct} />
                  </td>

                  {/* 1M% */}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <ReturnCell value={batch?.return1M} />
                  </td>

                  {/* 1Y% */}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <ReturnCell value={batch?.return1Y} />
                  </td>

                  {/* Exp.% */}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {expRatio == null ? (
                      <span className="text-[#8A95A6]">—</span>
                    ) : (
                      <span className={expCheap ? 'text-[#11875D]' : 'text-[#92580A]'}>
                        {(expRatio * 100).toFixed(2)}%
                      </span>
                    )}
                  </td>

                  {/* Yield */}
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#566174]">
                    {batch?.yield != null ? fmtPctAbs(batch.yield) : <span className="text-[#8A95A6]">—</span>}
                  </td>

                  {/* AUM */}
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#566174]">
                    {batch?.aum != null ? fmtLarge(batch.aum) : <span className="text-[#8A95A6]">—</span>}
                  </td>

                  {/* Score */}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {score > 0 && (
                        <span className={cn('text-[12px] font-[700] tabular-nums', scoreTxtCls)}>
                          {score}
                        </span>
                      )}
                      <span className={cn('text-[10px] font-[600] px-1.5 py-0.5 rounded-full whitespace-nowrap', badgeCls)}>
                        {label}
                      </span>
                    </div>
                  </td>

                  {/* Chart sparkline */}
                  <td className="px-3 py-2.5 text-center">
                    {sparkPrices.length >= 2 ? (
                      <Sparkline
                        prices={sparkPrices}
                        up={isUp}
                        width={60}
                        height={28}
                      />
                    ) : (
                      <div className="w-[60px] h-[28px] inline-flex items-center justify-center text-[#B0BAC8] text-[10px]">
                        —
                      </div>
                    )}
                  </td>

                  {/* Remove action */}
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => onDelete(ticker)}
                      aria-label={`Remove ${ticker} from watchlist`}
                      className="w-7 h-7 rounded-lg bg-[#F0F1F6] text-[#8A95A6] hover:bg-[#FCEAEA] hover:text-[#D83B3B] transition-all inline-flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </motion.tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
