'use client'

import { useState, useEffect, useCallback, useRef, useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { RefreshCw, ChevronDown, ChevronRight, Plus, ArrowUpRight, Trash2, Info } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSession, signIn } from 'next-auth/react'
import { ETFSearchBar } from '@/components/etf/ETFSearchBar'
import { ETFMarketPulse } from '@/components/etf/ETFMarketPulse'
import { ETFHeatmapGrid } from '@/components/etf/ETFHeatmapGrid'
import { ETFHelpButton } from '@/components/etf/ETFOnboardBanner'
import ETFLoginToSaveModal from '@/components/etf/ETFLoginToSaveModal'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import { loadETFWatchlist, deleteETFEntry, saveETFEntry, readLocalWatchlist } from '@/lib/data/etfWatchlistStore'
import {
  ALL_TICKERS, ALL_META, SECTOR_META, GEO_META, STYLE_META,
  BROAD_META, BOND_META, DIVIDEND_META, THEMATIC_META, COMMODITY_META, CATEGORY_AVG_EXPENSE,
} from '@/lib/data/etfUniverse'
import { fmtLarge, fmtPctAbs, fmtMultiple } from '@/lib/formatters'
import { scoreColor, scoreLabel, scoreBadge, computeETFScore } from '@/lib/data/etfScore'
import { ChevronUp, ChevronsUpDown, Check } from 'lucide-react'
import type { ETFMeta, ETFGroup } from '@/lib/data/etfUniverse'
import type { ETFEntry, ETFBatchItem } from '@/lib/data/etfTypes'
import { useSetTopBarTabs } from '@/contexts/TopBarTabsContext'

// ── Inline Rankings table ─────────────────────────────────────────────────────

type SortKey = 'valueScore' | 'peRatio' | 'pbRatio' | 'expenseRatio' | 'yield' | 'aum'
type SortDir = 'asc' | 'desc'
type FilterGroup = 'all' | ETFGroup

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-[#9B9B9B] opacity-60" />
  return sortDir === 'desc'
    ? <ChevronDown size={12} className="text-olive-700" />
    : <ChevronUp size={12} className="text-olive-700" />
}

const groupBadge: Record<ETFGroup, string> = {
  broad:     'bg-[#F0F4E8] text-[#5F790B] border-[#BFD2A1]',
  sector:    'bg-[#F0F1F6] text-[#566174] border-[#E3E1DA]',
  geo:       'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  style:     'bg-[#F0FDF4] text-[#11875D] border-[#BBF7D0]',
  bond:      'bg-[#FFF7ED] text-[#92580A] border-[#FDE68A]',
  dividend:  'bg-[#FDF4FF] text-[#9333EA] border-[#E9D5FF]',
  thematic:  'bg-[#FFF1F2] text-[#D83B3B] border-[#FECACA]',
  commodity: 'bg-[#F5F5F5] text-[#4B5563] border-[#D1D5DB]',
}
const groupLabelDisplay: Record<ETFGroup, string> = {
  broad: 'Broad', sector: 'Sector', geo: 'Geography', style: 'Style',
  bond: 'Bond', dividend: 'Income', thematic: 'Thematic', commodity: 'Commodity',
}

function Rankings({
  data,
  watchlistedTickers,
  onAdd,
  initialFilter,
}: {
  data: Record<string, ETFBatchItem | null>
  watchlistedTickers: Set<string>
  onAdd: (ticker: string) => void
  initialFilter?: FilterGroup
}) {
  const [filter, setFilter] = useState<FilterGroup>(initialFilter ?? 'all')
  const [sortKey, setSortKey] = useState<SortKey>('valueScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAll, setShowAll] = useState(false)

  // Sync initialFilter if it changes (e.g. from overview deep-link)
  useEffect(() => { if (initialFilter) setFilter(initialFilter) }, [initialFilter])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const FILTERS: { id: FilterGroup; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'broad',     label: 'Broad Market' },
    { id: 'sector',    label: 'Sectors' },
    { id: 'geo',       label: 'International' },
    { id: 'style',     label: 'Styles' },
    { id: 'bond',      label: 'Bonds' },
    { id: 'dividend',  label: 'Income' },
    { id: 'thematic',  label: 'Thematic' },
    { id: 'commodity', label: 'Commodity' },
  ]

  const COLS: { key: SortKey; label: string }[] = [
    { key: 'peRatio', label: 'P/E' },
    { key: 'pbRatio', label: 'P/B' },
    { key: 'expenseRatio', label: 'Exp.' },
    { key: 'yield', label: 'Yield' },
    { key: 'aum', label: 'AUM' },
    { key: 'valueScore', label: 'Score' },
  ]

  const allRows = (ALL_META as ETFMeta[])
    .filter((m) => filter === 'all' || m.group === filter)
    .map((m) => ({ meta: m, item: data[m.ticker] ?? null }))
    .sort((a, b) => {
      const va = a.item?.[sortKey] ?? null
      const vb = b.item?.[sortKey] ?? null
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number)
    })

  const rows = showAll ? allRows : allRows.slice(0, 10)

  return (
    <div>
      {/* Disclosure banner */}
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5">
        <Info size={13} className="mt-0.5 shrink-0 text-[#B56A00]" />
        <p className="text-[11px] text-[#8A95A6] leading-snug">
          <strong className="text-[#B56A00]">Value Score</strong> measures cheapness via P/E, P/B, yield, and cost.
          Growth ETFs (QQQ, XLK) and non-equity ETFs (GLD, TLT) score low <em>by design</em> — not mispriced.
          Bonds and commodities are rated &ldquo;Not rated&rdquo; since traditional multiples don&apos;t apply.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                'px-3 py-2 rounded-full text-[12px] font-[600] transition-colors border min-h-[36px]',
                filter === f.id
                  ? 'bg-olive-700 text-white border-olive-700'
                  : 'bg-white text-[#566174] border-[#E3E1DA] hover:border-[#BFD2A1] hover:text-olive-700 hover:bg-[#F0F4E8]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E3E1DA] overflow-clip">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E3E1DA] bg-[#F0F1F6]">
                <th className="text-left pl-4 pr-3 py-2 text-[11px] font-[600] text-[#566174] sticky left-0 bg-[#F0F1F6]">ETF</th>
                <th className="text-left px-3 py-2 text-[11px] font-[600] text-[#566174]">Type</th>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    className="px-0 py-0 text-right whitespace-nowrap"
                    aria-sort={col.key === sortKey ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  >
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="w-full px-3 py-2 inline-flex items-center justify-end gap-1 text-[11px] font-[600] text-[#566174] hover:text-[#111111] transition-colors cursor-pointer select-none"
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F1F6]">
              {rows.map(({ meta, item }) => {
                const score = item?.valueScore ?? null
                const isWatchlisted = watchlistedTickers.has(meta.ticker)

                // Expense ratio color vs group avg
                const avg = CATEGORY_AVG_EXPENSE[meta.group] ?? 0.002
                const erColor = item?.expenseRatio == null ? 'text-[#111111]'
                  : item.expenseRatio <= avg * 0.75 ? 'text-[#11875D]'
                  : item.expenseRatio > avg * 1.5   ? 'text-[#D83B3B]'
                  : 'text-[#92580A]'
                return (
                  <tr key={meta.ticker} className="hover:bg-[#F9F8F5] transition-colors group">
                    <td className="pl-4 pr-3 py-2.5 sticky left-0 bg-white group-hover:bg-[#F9F8F5] transition-colors">
                      <Link href={`/etf/${meta.ticker}`} className="block">
                        <span className="font-[700] text-[12px] text-[#111111] hover:text-olive-700 transition-colors">{meta.ticker}</span>
                        <span className="block text-[11px] text-[#8A95A6] mt-0.5 truncate max-w-[140px]">{item?.name ?? meta.label}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-[600] border', groupBadge[meta.group])}>
                        {groupLabelDisplay[meta.group]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#111111]">
                      {item?.peRatio != null ? fmtMultiple(item.peRatio) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#111111]">
                      {item?.pbRatio != null ? fmtMultiple(item.pbRatio) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px]">
                      {item?.expenseRatio != null
                        ? <span className={erColor}>{(item.expenseRatio * 100).toFixed(2)}%</span>
                        : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#111111]">
                      {item?.yield != null ? fmtPctAbs(item.yield) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#111111]">
                      {item?.aum != null ? fmtLarge(item.aum) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {score != null ? (
                        <div className="inline-flex items-center gap-1 justify-end">
                          {score > 0 && <span className={cn('text-[12px] font-[700]', scoreColor(score))}>{score}</span>}
                          <span className={cn('text-[10px] font-[600] hidden sm:block', score > 0 ? scoreColor(score) : 'text-[#9B9B9B]')}>{scoreLabel(score)}</span>
                        </div>
                      ) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => !isWatchlisted && onAdd(meta.ticker)}
                        data-no-min-h
                        aria-label={isWatchlisted ? `${meta.ticker} in watchlist` : `Add ${meta.ticker} to watchlist`}
                        className={cn(
                          'w-7 h-7 flex items-center justify-center rounded-lg transition-all',
                          isWatchlisted ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#F0F1F6] text-[#8A95A6] hover:bg-olive-50 hover:text-olive-700',
                        )}
                      >
                        {isWatchlisted ? <Check size={10} /> : <Plus size={10} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {allRows.length > 10 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full py-2.5 text-[12px] font-[600] text-[#566174] hover:text-olive-700 hover:bg-[#F9F8F5] border-t border-[#E3E1DA] transition-colors"
          >
            {showAll ? `Show less ↑` : `Show all ${allRows.length} ETFs ↓`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  description,
  onViewAll,
  defaultOpen = true,
  children,
}: {
  title: string
  description: string
  onViewAll: () => void
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 group min-h-[44px]"
            aria-expanded={open}
          >
            <h2 className="text-[13px] font-[700] text-[#111111] group-hover:text-olive-700 transition-colors">
              {title}
            </h2>
            {open
              ? <ChevronDown size={14} className="text-[#8A95A6] group-hover:text-olive-700 transition-colors" />
              : <ChevronRight size={14} className="text-[#8A95A6] group-hover:text-olive-700 transition-colors" />
            }
          </button>
          {!open && (
            <span className="text-[11px] text-[#8A95A6] truncate hidden sm:block">{description}</span>
          )}
        </div>
        <button
          onClick={onViewAll}
          className="shrink-0 flex items-center gap-1 text-[11px] font-[600] text-[#566174] hover:text-olive-700 transition-colors min-h-[44px]"
        >
          Rankings
          <ArrowUpRight size={11} />
        </button>
      </div>
      {open && children}
    </section>
  )
}

// ── Watchlist row (My Valuations style) ──────────────────────────────────────

function WatchlistRow({
  entry,
  sparklineData,
  onDelete,
}: {
  entry: ETFEntry
  sparklineData: number[] | null | undefined
  onDelete: (ticker: string) => void
}) {
  const { score } = computeETFScore(entry.peRatio, entry.pbRatio, entry.yield, entry.expenseRatio)

  const sparkUp =
    sparklineData != null && sparklineData.length >= 2
      ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
      : true

  const price     = entry.price != null ? `$${entry.price.toFixed(2)}` : null
  const changePct = entry.priceChangePct
  const changeUp  = (changePct ?? 0) >= 0
  const changeStr = changePct != null
    ? `${changeUp ? '+' : ''}${changePct.toFixed(2)}%`
    : null

  return (
    <div className="relative bg-white border border-[#E5E5E5] rounded-xl overflow-hidden hover:border-[#BFD2A1] hover:shadow-sm transition-all group">
      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(entry.ticker) }}
        aria-label={`Remove ${entry.ticker} from watchlist`}
        className="absolute top-1/2 -translate-y-1/2 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-[#C8C8C8] group-hover:text-[#9B9B9B] hover:!text-[#D83B3B] hover:bg-[#FCEAEA] transition-all focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:outline-none"
      >
        <Trash2 size={13} />
      </button>

      {/* Row link */}
      <Link
        href={`/etf/${entry.ticker}`}
        className="flex items-center gap-3 px-4 py-3 pr-12 focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-inset focus-visible:outline-none"
      >
        {/* Left: ticker + name + score */}
        <div className="w-[130px] shrink-0 min-w-0">
          <p className="text-[15px] font-[800] text-[#111111] leading-tight tracking-tight">
            {entry.ticker}
          </p>
          {entry.name && (
            <p className="text-[11px] text-[#6B6B6B] truncate mt-0.5 leading-snug">
              {entry.name}
            </p>
          )}
        </div>

        {/* Center: sparkline */}
        <div className="relative flex-1 min-w-0 h-[44px]">
          {sparklineData === undefined ? (
            <SparklineSkeleton width={200} height={44} />
          ) : sparklineData && sparklineData.length >= 2 ? (
            <>
              <Sparkline
                prices={sparklineData}
                up={sparkUp}
                width={200}
                height={44}
                className="w-full h-[44px]"
              />
              <span className="absolute bottom-0 right-0 text-[9px] font-[650] text-[#9B9B9B] bg-white/80 rounded px-1 leading-none">YTD</span>
            </>
          ) : (
            <div className="w-full h-[44px]" />
          )}
        </div>

        {/* Right: score chip + price + change */}
        <div className="w-[100px] shrink-0 text-right flex flex-col items-end gap-0.5">
          <span className={cn('inline-flex text-[10px] font-[650] px-1.5 py-0.5 rounded-full leading-none', scoreBadge(score))}>
            {score > 0 ? `${score} · ` : ''}{scoreLabel(score)}
          </span>
          {price && (
            <p className="text-[14px] font-[700] text-[#111111] tabular-nums leading-tight mt-0.5">
              {price}
            </p>
          )}
          {changeStr && (
            <span className={cn(
              'inline-flex text-[10px] font-[650] px-1.5 py-0.5 rounded-full leading-none tabular-nums',
              changeUp ? 'text-[#11875D] bg-[#E8F7EF]' : 'text-[#D83B3B] bg-[#FCEAEA]',
            )}>
              {changeStr}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}

// ── Session cache ─────────────────────────────────────────────────────────────

const SESSION_CACHE_KEY = 'etf_batch_v1'
const SESSION_CACHE_TTL = 30 * 60 * 1000

function readBatchCache(): Record<string, ETFBatchItem | null> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: Record<string, ETFBatchItem | null>; ts: number }
    if (Date.now() - ts > SESSION_CACHE_TTL) return null
    return data
  } catch { return null }
}

function writeBatchCache(data: Record<string, ETFBatchItem | null>): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

// ── Undo toast ────────────────────────────────────────────────────────────────

interface UndoToast { ticker: string; entry: ETFEntry; timer: ReturnType<typeof setTimeout> }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ETFTrackerPage() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  const [loginModal, setLoginModal] = useState<{ ticker: string; name: string | null; valueScore: number | null } | null>(null)

  useEffect(() => {
    if (!userEmail) return
    const local = readLocalWatchlist()
    if (local.length === 0) return
    local.forEach((entry) => { saveETFEntry(entry, userEmail).catch(() => {}) })
  }, [userEmail])

  // ── Watchlist ────────────────────────────────────────────────────────────────
  const [watchlist, setWatchlist]   = useState<ETFEntry[]>([])
  const [wlLoading, setWlLoading]   = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})
  const fetchedSparklines = useRef<Set<string>>(new Set())
  const [undoToast, setUndoToast]   = useState<UndoToast | null>(null)

  const loadWatchlist = useCallback(async () => {
    setWlLoading(true)
    const entries = await loadETFWatchlist(userEmail)
    setWatchlist(entries)
    setWlLoading(false)
  }, [userEmail])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  useEffect(() => {
    if (watchlist.length === 0) { setSparklines({}); return }
    const newTickers = watchlist.filter((e) => !fetchedSparklines.current.has(e.ticker))
    if (newTickers.length === 0) return
    Promise.allSettled(
      newTickers.map((e) =>
        fetch(`/api/historical?ticker=${e.ticker}&period=ytd`)
          .then((r) => r.json())
          .then((bars: Array<{ close: number }>) => ({
            ticker: e.ticker,
            prices: bars.map((b) => b.close).filter((v) => typeof v === 'number' && isFinite(v)),
          }))
          .catch(() => ({ ticker: e.ticker, prices: [] as number[] })),
      ),
    ).then((results) => {
      const map: Record<string, number[] | null> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map[r.value.ticker] = r.value.prices.length >= 2 ? r.value.prices : null
          fetchedSparklines.current.add(r.value.ticker)
        }
      }
      setSparklines((prev) => ({ ...prev, ...map }))
    })
  }, [watchlist])

  function handleDelete(ticker: string) {
    const entry = watchlist.find((e) => e.ticker === ticker)
    if (!entry) return
    if (undoToast) {
      clearTimeout(undoToast.timer)
      deleteETFEntry(undoToast.ticker, userEmail).catch(() => {})
    }
    setWatchlist((current) => current.filter((e) => e.ticker !== ticker))
    const timer = setTimeout(() => {
      deleteETFEntry(ticker, userEmail).catch(() => {
        setWatchlist((prev) => {
          const has = prev.some((e) => e.ticker === ticker)
          return has ? prev : [entry, ...prev]
        })
      })
      setUndoToast(null)
    }, 5000)
    setUndoToast({ ticker, entry, timer })
  }

  function handleUndo() {
    if (!undoToast) return
    clearTimeout(undoToast.timer)
    setWatchlist((prev) => {
      const has = prev.some((e) => e.ticker === undoToast.ticker)
      return has ? prev : [undoToast.entry, ...prev]
    })
    setUndoToast(null)
  }

  useEffect(() => () => { if (undoToast) clearTimeout(undoToast.timer) }, [undoToast])

  // ── Batch data ───────────────────────────────────────────────────────────────
  const [batchData, setBatchData]       = useState<Record<string, ETFBatchItem | null>>({})
  const [batchLoading, setBatchLoading] = useState(true)
  const [batchError, setBatchError]     = useState<string | null>(null)
  const [batchFetched, setBatchFetched] = useState(false)
  const [pulseSparklines, setPulseSparklines] = useState<Record<string, number[] | null>>({})

  useEffect(() => {
    const tickers = ['SPY', 'XLF', 'EWZ', 'AGG', 'QQQ', 'VTI', 'XLE', 'XLK', 'VNQ', 'GLD',
      'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC',
      'EFA', 'EEM', 'VEA', 'VWO', 'IWM', 'IJR', 'IVV']
    Promise.allSettled(
      tickers.map(t =>
        fetch(`/api/historical?ticker=${t}&period=ytd`)
          .then(r => r.json())
          .then((bars: Array<{ close: number }>) => ({
            ticker: t,
            prices: bars.map(b => b.close).filter(v => typeof v === 'number' && isFinite(v)),
          }))
          .catch(() => ({ ticker: t, prices: [] as number[] }))
      )
    ).then(results => {
      const map: Record<string, number[] | null> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map[r.value.ticker] = r.value.prices.length >= 2 ? r.value.prices : null
        }
      }
      setPulseSparklines(map)
    })
  }, [])

  const fetchBatch = useCallback(async () => {
    if (batchFetched) return
    const cached = readBatchCache()
    if (cached) { setBatchData(cached); setBatchFetched(true); setBatchLoading(false); return }
    setBatchLoading(true)
    setBatchError(null)
    try {
      const res = await fetch(`/api/etf/batch?tickers=${ALL_TICKERS.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setBatchData(json)
      const hasData = Object.values(json).some((v) => v !== null)
      if (hasData) { setBatchFetched(true); writeBatchCache(json) }
    } catch (e) {
      console.error('ETF batch fetch failed:', e)
      setBatchError('Failed to load ETF data.')
    } finally { setBatchLoading(false) }
  }, [batchFetched])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  useEffect(() => {
    if (Object.keys(batchData).length === 0) return
    setWatchlist((prev) =>
      prev.map((entry) => {
        const live = batchData[entry.ticker]
        if (!live) return entry
        return { ...entry, peRatio: live.peRatio, pbRatio: live.pbRatio, yield: live.yield,
          expenseRatio: live.expenseRatio, valueScore: live.valueScore, price: live.price,
          priceChangePct: live.priceChangePct, metricsUpdatedAt: new Date().toISOString() }
      }),
    )
  }, [batchData])

  async function handleSaveWithGate(
    ticker: string,
    name: string | null,
    entry: Omit<ETFEntry, 'ticker' | 'name' | 'addedAt'> & { ticker?: string; name?: string | null; addedAt?: string },
    valueScore: number | null,
  ) {
    if (!userEmail) { setLoginModal({ ticker, name, valueScore }); return }
    await saveETFEntry({ ticker, name, addedAt: new Date().toISOString(), ...entry }, userEmail)
    loadWatchlist()
  }

  async function handleQuickAdd(ticker: string) {
    const item = batchData[ticker]
    if (!item) return
    await handleSaveWithGate(ticker, item.name, {
      valueScore: item.valueScore, expenseRatio: item.expenseRatio, yield: item.yield,
      peRatio: item.peRatio, pbRatio: item.pbRatio, totalAssets: item.aum,
      price: item.price, priceChangePct: item.priceChangePct, metricsUpdatedAt: new Date().toISOString(),
    }, item.valueScore)
  }

  const hasWatchlist = !wlLoading && watchlist.length > 0

  // ── Tab state (2 tabs only) ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview' | 'rankings'>('overview')
  const [rankingsFilter, setRankingsFilter] = useState<FilterGroup>('all')
  const etfPillId  = useId()
  const etfReduced = useReducedMotion()
  const ETF_SPRING = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 } as const

  function goToRankings(filter: FilterGroup = 'all') {
    setRankingsFilter(filter)
    setActiveTab('rankings')
  }

  const TABS = [
    { id: 'overview' as const,  label: 'Overview'  },
    { id: 'rankings' as const,  label: 'Rankings'  },
  ]

  // Push tabs into TopBar
  const etfTopTabs = useMemo(() => TABS, []) // eslint-disable-line react-hooks/exhaustive-deps
  useSetTopBarTabs(etfTopTabs, activeTab, (id) => setActiveTab(id as 'overview' | 'rankings'))

  const watchlistTickers = new Set(watchlist.map((e) => e.ticker))

  return (
    <div className="min-h-dvh bg-[#F9F8F5]">

      {loginModal && (
        <ETFLoginToSaveModal
          ticker={loginModal.ticker}
          name={loginModal.name}
          valueScore={loginModal.valueScore}
          onClose={() => setLoginModal(null)}
        />
      )}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E3E1DA] px-4 sm:px-8 pt-4 pb-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <ETFSearchBar
              onAdd={async (symbol, name) => {
                const item = batchData[symbol]
                await handleSaveWithGate(symbol, item?.name ?? name, {
                  valueScore: item?.valueScore ?? null, expenseRatio: item?.expenseRatio ?? null,
                  yield: item?.yield ?? null, peRatio: item?.peRatio ?? null, pbRatio: item?.pbRatio ?? null,
                  totalAssets: item?.aum ?? null, price: item?.price ?? null,
                  priceChangePct: item?.priceChangePct ?? null, metricsUpdatedAt: new Date().toISOString(),
                }, item?.valueScore ?? null)
              }}
              watchlistedTickers={watchlistTickers}
            />
            <Link
              href="/etf/compare"
              className="shrink-0 hidden sm:flex items-center gap-1.5 text-[12px] font-[600] text-[#566174] hover:text-olive-700 border border-[#E3E1DA] hover:border-[#BFD2A1] rounded-lg px-3 py-2.5 transition-colors bg-white whitespace-nowrap"
            >
              Compare
            </Link>
            <ETFHelpButton />
          </div>

          <div className="flex items-center mt-3 w-full sm:w-auto lg:hidden">
            <div
              role="tablist"
              aria-label="ETF Tracker sections"
              className="flex w-full sm:w-auto sm:inline-flex items-center gap-0.5 rounded-full p-[3px]"
              style={{
                background: 'rgba(240,241,246,0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(0,0,0,0.07)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex flex-1 sm:flex-none items-center justify-center rounded-full px-3.5 py-1.5 text-[13px] min-h-[32px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.6)]"
                    style={{ color: isActive ? '#111111' : '#6B6B6B', fontWeight: isActive ? 650 : 500 }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={`${etfPillId}-etf-pill`}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'rgba(255,255,255,0.95)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                        }}
                        transition={etfReduced ? { duration: 0 } : ETF_SPRING}
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-5 sm:py-6 max-w-7xl mx-auto space-y-6">

        {batchError && (
          <div className="bg-white border border-[#E3E1DA] rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-[#566174]">{batchError}</p>
            <button
              onClick={() => { setBatchFetched(false); fetchBatch() }}
              className="flex items-center gap-1.5 text-sm font-[600] text-olive-700 hover:text-olive-600 transition-colors"
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Market Pulse — 4 summary cards */}
            {!batchError && (
              <ETFMarketPulse data={batchData} loading={batchLoading} sparklines={pulseSparklines} />
            )}

            {/* My Watchlist */}
            {hasWatchlist && (
              <section>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-[700] text-[#111111]">My Watchlist</h2>
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-[700] bg-olive-100 text-olive-700">
                      {watchlist.length}
                    </span>
                  </div>
                  {!userEmail && (
                    <button
                      onClick={() => signIn('google', { callbackUrl: window.location.href })}
                      className="text-[11px] font-[600] text-olive-700 hover:text-olive-600 transition-colors"
                    >
                      Sign in to sync
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {watchlist.map((entry) => (
                    <WatchlistRow
                      key={entry.ticker}
                      entry={entry}
                      sparklineData={entry.ticker in sparklines ? sparklines[entry.ticker] : undefined}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {wlLoading && (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[72px] bg-white rounded-xl border border-[#E5E5E5] motion-safe:animate-pulse" />
                ))}
              </div>
            )}

            {!hasWatchlist && !wlLoading && (
              <div className="bg-white border border-[#E3E1DA] rounded-xl p-5 flex flex-col items-center text-center gap-3">
                <p className="text-[13px] font-[600] text-[#111111]">Track ETFs by what they&apos;re actually worth</p>
                <p className="text-[12px] text-[#8A95A6] max-w-xs">Search above or add from any section below.</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {['SPY', 'VTV', 'VYM'].map((t) => {
                    const item = batchData[t]
                    const score = item?.valueScore ?? null
                    return (
                      <button
                        key={t}
                        onClick={() => handleQuickAdd(t)}
                        className="flex flex-col items-center px-4 py-2 rounded-xl border border-[#E3E1DA] bg-white hover:border-[#BFD2A1] hover:bg-olive-50 transition-colors"
                      >
                        <span className="text-[12px] font-[700] text-[#111111]">+ {t}</span>
                        {score != null && (
                          <span className={cn('text-[10px] font-[600] mt-0.5', scoreColor(score))}>
                            {score} · {scoreLabel(score)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Broad Market */}
            <CollapsibleSection
              title="Broad Market"
              description="S&P 500, Nasdaq 100, total market"
              onViewAll={() => goToRankings('broad')}
            >
              <ETFHeatmapGrid
                metas={BROAD_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={4}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>

            {/* Sectors */}
            <CollapsibleSection
              title="Sectors"
              description="US SPDR sector ETFs"
              onViewAll={() => goToRankings('sector')}
              defaultOpen={false}
            >
              <ETFHeatmapGrid
                metas={SECTOR_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={4}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>

            {/* International */}
            <CollapsibleSection
              title="International"
              description="Regional and country exposure"
              onViewAll={() => goToRankings('geo')}
              defaultOpen={false}
            >
              <ETFHeatmapGrid
                metas={GEO_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={3}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>

            {/* Styles */}
            <CollapsibleSection
              title="Style / Factor"
              description="Value, growth, quality, momentum, low-vol"
              onViewAll={() => goToRankings('style')}
              defaultOpen={false}
            >
              <ETFHeatmapGrid
                metas={STYLE_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={4}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>

            {/* Fixed Income */}
            <CollapsibleSection
              title="Fixed Income"
              description="Treasury, corporate, and TIPS bonds · Not rated (equity multiples N/A)"
              onViewAll={() => goToRankings('bond')}
              defaultOpen={false}
            >
              <ETFHeatmapGrid
                metas={BOND_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={4}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>

            {/* Dividend */}
            <CollapsibleSection
              title="Dividend & Income"
              description="High dividend and dividend growth ETFs"
              onViewAll={() => goToRankings('dividend')}
              defaultOpen={false}
            >
              <ETFHeatmapGrid
                metas={DIVIDEND_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={4}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>

            {/* Thematic */}
            <CollapsibleSection
              title="Thematic"
              description="Semiconductors, biotech, clean energy, and more"
              onViewAll={() => goToRankings('thematic')}
              defaultOpen={false}
            >
              <ETFHeatmapGrid
                metas={THEMATIC_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={4}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>

            {/* Commodities */}
            <CollapsibleSection
              title="Commodities & Alternatives"
              description="Gold, silver, REITs, broad commodities · Not rated (equity multiples N/A)"
              onViewAll={() => goToRankings('commodity')}
              defaultOpen={false}
            >
              <ETFHeatmapGrid
                metas={COMMODITY_META}
                data={batchData}
                watchlistedTickers={watchlistTickers}
                onAdd={handleQuickAdd}
                cols={4}
                hasError={!!batchError}
                sparklines={pulseSparklines}
              />
            </CollapsibleSection>
          </>
        )}

        {/* ── RANKINGS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'rankings' && (
          <Rankings
            data={batchData}
            watchlistedTickers={watchlistTickers}
            onAdd={handleQuickAdd}
            initialFilter={rankingsFilter}
          />
        )}

      </div>

      {/* ── Undo toast ───────────────────────────────────────────────────────── */}
      {undoToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#06101F] text-white rounded-xl px-4 py-3 shadow-lg text-[13px] font-medium whitespace-nowrap"
          style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <span>{undoToast.ticker} removed from watchlist</span>
          <button
            onClick={handleUndo}
            className="font-bold text-olive-400 hover:text-olive-300 transition-colors underline underline-offset-2"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
