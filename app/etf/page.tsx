'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, GitCompare, CheckSquare, Square } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSession, signIn } from 'next-auth/react'
import { ETFSearchBar } from '@/components/etf/ETFSearchBar'
import { ETFWatchlistCard } from '@/components/etf/ETFWatchlistCard'
import { ETFMarketPulse } from '@/components/etf/ETFMarketPulse'
import { ETFHeatmapGrid } from '@/components/etf/ETFHeatmapGrid'
import { ETFHelpButton } from '@/components/etf/ETFOnboardBanner'
import ETFLoginToSaveModal from '@/components/etf/ETFLoginToSaveModal'
import { loadETFWatchlist, deleteETFEntry, saveETFEntry, readLocalWatchlist } from '@/lib/data/etfWatchlistStore'
import { ALL_TICKERS, SECTOR_META, GEO_META, STYLE_META, ALL_META } from '@/lib/data/etfUniverse'
import { fmtLarge, fmtPctAbs, fmtMultiple } from '@/lib/formatters'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { ChevronUp, ChevronDown, ChevronsUpDown, Plus, Check } from 'lucide-react'
import type { ETFMeta, ETFGroup } from '@/lib/data/etfUniverse'
import type { ETFEntry, ETFBatchItem } from '@/lib/data/etfTypes'

// ── Inline Rankings table (replaces ETFUniverseSection's Leaderboard) ────────

type SortKey = 'valueScore' | 'peRatio' | 'pbRatio' | 'expenseRatio' | 'yield' | 'aum'
type SortDir = 'asc' | 'desc'
type FilterGroup = 'all' | ETFGroup

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-[#8A95A6]" />
  return sortDir === 'desc'
    ? <ChevronDown size={11} className="text-olive-700" />
    : <ChevronUp size={11} className="text-olive-700" />
}

const groupBadge: Record<ETFGroup, string> = {
  sector: 'bg-[#F4F3EF] text-[#566174] border-[#E3E1DA]',
  geo:    'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  style:  'bg-[#F0FDF4] text-[#11875D] border-[#BBF7D0]',
}
const groupLabel: Record<ETFGroup, string> = { sector: 'Sector', geo: 'Geography', style: 'Style' }

function Rankings({
  data,
  watchlistedTickers,
  onAdd,
}: {
  data: Record<string, ETFBatchItem | null>
  watchlistedTickers: Set<string>
  onAdd: (ticker: string) => void
}) {
  const [filter, setFilter] = useState<FilterGroup>('all')
  const [sortKey, setSortKey] = useState<SortKey>('valueScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAll, setShowAll] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const FILTERS: { id: FilterGroup; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'sector', label: 'Sectors' },
    { id: 'geo', label: 'Geographies' },
    { id: 'style', label: 'Styles' },
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
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[12px] font-[600] transition-colors border',
                filter === f.id
                  ? 'bg-olive-700 text-white border-olive-700'
                  : 'bg-white text-[#566174] border-[#E3E1DA] hover:border-[#BFD2A1] hover:text-olive-700',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#8A95A6]">Click column to sort</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E3E1DA] overflow-clip">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E3E1DA] bg-[#F4F3EF]">
                <th className="text-left pl-4 pr-3 py-2 text-[11px] font-[600] text-[#566174] sticky left-0 bg-[#F4F3EF]">ETF</th>
                <th className="text-left px-3 py-2 text-[11px] font-[600] text-[#566174]">Type</th>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort(col.key)}
                    aria-sort={col.key === sortKey ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  >
                    <span className="inline-flex items-center justify-end gap-1 text-[11px] font-[600] text-[#566174] hover:text-[#111111] transition-colors">
                      {col.label}
                      <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F3EF]">
              {rows.map(({ meta, item }) => {
                const score = item?.valueScore ?? null
                const isWatchlisted = watchlistedTickers.has(meta.ticker)
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
                        {groupLabel[meta.group]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#111111]">
                      {item?.peRatio != null ? fmtMultiple(item.peRatio) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#111111]">
                      {item?.pbRatio != null ? fmtMultiple(item.pbRatio) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#111111]">
                      {item?.expenseRatio != null ? (item.expenseRatio * 100).toFixed(2) + '%' : <span className="text-[#8A95A6]">—</span>}
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
                          <span className={cn('text-[12px] font-[700]', scoreColor(score))}>{score}</span>
                          <span className={cn('text-[10px] font-[600] hidden sm:block', scoreColor(score))}>{scoreLabel(score)}</span>
                          <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." side="top" />
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
                          isWatchlisted ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#F4F3EF] text-[#8A95A6] hover:bg-olive-50 hover:text-olive-700',
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
  } catch {
    return null
  }
}

function writeBatchCache(data: Record<string, ETFBatchItem | null>): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

// ── Undo toast ────────────────────────────────────────────────────────────────

interface UndoToast {
  ticker: string
  entry: ETFEntry
  timer: ReturnType<typeof setTimeout>
}

export default function ETFTrackerPage() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  // ── Login-to-save gate ───────────────────────────────────────────────────────
  const [loginModal, setLoginModal] = useState<{ ticker: string; name: string | null; valueScore: number | null } | null>(null)

  // After sign-in: sync any locally-saved entries to Supabase
  useEffect(() => {
    if (!userEmail) return
    const local = readLocalWatchlist()
    if (local.length === 0) return
    local.forEach((entry) => {
      saveETFEntry(entry, userEmail).catch(() => {})
    })
  }, [userEmail])

  // ── Watchlist state ──────────────────────────────────────────────────────────
  const [watchlist, setWatchlist]   = useState<ETFEntry[]>([])
  const [wlLoading, setWlLoading]   = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})
  const fetchedSparklines = useRef<Set<string>>(new Set())

  // Undo-delete toast
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null)

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
          const prices = r.value.prices.length >= 2 ? r.value.prices : null
          map[r.value.ticker] = prices
          fetchedSparklines.current.add(r.value.ticker)
        }
      }
      setSparklines((prev) => ({ ...prev, ...map }))
    })
  }, [watchlist])

  function handleDelete(ticker: string) {
    const entry = watchlist.find((e) => e.ticker === ticker)
    if (!entry) return

    // Clear any existing toast
    if (undoToast) {
      clearTimeout(undoToast.timer)
      deleteETFEntry(undoToast.ticker, userEmail).catch(() => {})
    }

    // Optimistically remove
    setWatchlist((current) => current.filter((e) => e.ticker !== ticker))

    // Schedule permanent deletion after 5s
    const timer = setTimeout(() => {
      deleteETFEntry(ticker, userEmail).catch(() => {
        // If delete fails, silently restore
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

  // Dismiss toast without undoing (user navigated away, etc.)
  useEffect(() => () => { if (undoToast) clearTimeout(undoToast.timer) }, [undoToast])

  // ── Batch / universe state ───────────────────────────────────────────────────
  const [batchData, setBatchData]       = useState<Record<string, ETFBatchItem | null>>({})
  const [batchLoading, setBatchLoading] = useState(true)
  const [batchError, setBatchError]     = useState<string | null>(null)
  const [batchFetched, setBatchFetched] = useState(false)
  const [pulseSparklines, setPulseSparklines] = useState<Record<string, number[] | null>>({})

  // Fetch YTD sparklines for the pulse card tickers
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
    if (cached) {
      setBatchData(cached)
      setBatchFetched(true)
      setBatchLoading(false)
      return
    }
    setBatchLoading(true)
    setBatchError(null)
    try {
      const res = await fetch(`/api/etf/batch?tickers=${ALL_TICKERS.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setBatchData(json)
      const hasData = Object.values(json).some((v) => v !== null)
      if (hasData) {
        setBatchFetched(true)
        writeBatchCache(json)
      }
    } catch (e) {
      console.error('ETF batch fetch failed:', e)
      setBatchError('Failed to load ETF data.')
    } finally {
      setBatchLoading(false)
    }
  }, [batchFetched])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  // When batch data arrives, merge live price/metrics into watchlist entries
  useEffect(() => {
    if (Object.keys(batchData).length === 0) return
    setWatchlist((prev) =>
      prev.map((entry) => {
        const live = batchData[entry.ticker]
        if (!live) return entry
        return {
          ...entry,
          peRatio: live.peRatio,
          pbRatio: live.pbRatio,
          yield: live.yield,
          expenseRatio: live.expenseRatio,
          valueScore: live.valueScore,
          price: live.price,
          priceChangePct: live.priceChangePct,
          metricsUpdatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [batchData])

  async function handleSaveWithGate(
    ticker: string,
    name: string | null,
    entry: Omit<ETFEntry, 'ticker' | 'name' | 'addedAt'> & { ticker?: string; name?: string | null; addedAt?: string },
    valueScore: number | null,
  ) {
    if (!userEmail) {
      setLoginModal({ ticker, name, valueScore })
      return
    }
    await saveETFEntry(
      { ticker, name, addedAt: new Date().toISOString(), ...entry },
      userEmail,
    )
    loadWatchlist()
  }

  async function handleQuickAdd(ticker: string) {
    const item = batchData[ticker]
    if (!item) return
    await handleSaveWithGate(ticker, item.name, {
      valueScore: item.valueScore,
      expenseRatio: item.expenseRatio,
      yield: item.yield,
      peRatio: item.peRatio,
      pbRatio: item.pbRatio,
      totalAssets: item.aum,
      price: item.price,
      priceChangePct: item.priceChangePct,
      metricsUpdatedAt: new Date().toISOString(),
    }, item.valueScore)
  }

  const hasWatchlist = !wlLoading && watchlist.length > 0

  // ── Compare mode ──────────────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set())

  function toggleCompareSelect(ticker: string) {
    setCompareSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else if (next.size < 4) next.add(ticker)
      return next
    })
  }

  const compareUrl = compareSelected.size >= 2
    ? `/etf/compare?symbols=${Array.from(compareSelected).join(',')}`
    : null

  // ── Subtab state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview' | 'sectors' | 'geographies' | 'styles'>('overview')

  const TABS = [
    { id: 'overview' as const,     label: 'Overview'     },
    { id: 'sectors' as const,      label: 'Sectors'      },
    { id: 'geographies' as const,  label: 'Geographies'  },
    { id: 'styles' as const,       label: 'Styles'       },
  ]

  return (
    <div className="min-h-dvh bg-[#F9F8F5]">

      {/* ── Login-to-save modal ──────────────────────────────────────────────── */}
      {loginModal && (
        <ETFLoginToSaveModal
          ticker={loginModal.ticker}
          name={loginModal.name}
          valueScore={loginModal.valueScore}
          onClose={() => setLoginModal(null)}
        />
      )}

      {/* ── Compact page header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E3E1DA] px-4 sm:px-8 pt-4 pb-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <ETFSearchBar
              onAdd={async (symbol, name) => {
                const item = batchData[symbol]
                await handleSaveWithGate(symbol, item?.name ?? name, {
                  valueScore: item?.valueScore ?? null,
                  expenseRatio: item?.expenseRatio ?? null,
                  yield: item?.yield ?? null,
                  peRatio: item?.peRatio ?? null,
                  pbRatio: item?.pbRatio ?? null,
                  totalAssets: item?.aum ?? null,
                  price: item?.price ?? null,
                  priceChangePct: item?.priceChangePct ?? null,
                  metricsUpdatedAt: new Date().toISOString(),
                }, item?.valueScore ?? null)
              }}
              watchlistedTickers={new Set(watchlist.map((e) => e.ticker))}
            />
            <Link
              href="/etf/compare"
              className="shrink-0 hidden sm:flex items-center gap-1.5 text-[12px] font-[600] text-[#566174] hover:text-olive-700 border border-[#E3E1DA] hover:border-[#BFD2A1] rounded-lg px-3 py-2.5 transition-colors bg-white whitespace-nowrap"
            >
              <GitCompare size={13} />
              Compare
            </Link>
            <ETFHelpButton />
          </div>

          {/* Subtab nav */}
          <div className="flex gap-0 mt-3 overflow-x-auto scrollbar-hide border-b-0 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 text-[13px] font-[600] whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'text-olive-700 border-olive-700'
                    : 'text-[#6B6B6B] border-transparent hover:text-[#111111] hover:border-[#CDD1C8]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-5 sm:py-6 max-w-7xl mx-auto space-y-6">

        {/* Error banner */}
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
            {/* Market Pulse */}
            {!batchError && <ETFMarketPulse data={batchData} loading={batchLoading} sparklines={pulseSparklines} />}

            {/* My Watchlist */}
            {hasWatchlist && (
              <section>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h2 className="text-[13px] font-[700] text-[#111111]">My Watchlist</h2>
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-[700] bg-olive-100 text-olive-700">
                    {watchlist.length}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {!userEmail && (
                      <button
                        onClick={() => signIn('google', { callbackUrl: window.location.href })}
                        className="text-[11px] font-[600] text-olive-700 hover:text-olive-600 transition-colors"
                      >
                        Sign in to sync
                      </button>
                    )}
                    {compareMode && compareSelected.size > 0 && (
                      <span className="text-[11px] text-[#6B6B6B]">{compareSelected.size}/4 selected</span>
                    )}
                    {compareMode && compareUrl && (
                      <Link
                        href={compareUrl}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-[600] bg-olive-700 text-white rounded-lg hover:bg-olive-600 transition-colors"
                      >
                        <GitCompare size={12} />
                        Compare {compareSelected.size}
                      </Link>
                    )}
                    {watchlist.length >= 2 && (
                      <button
                        onClick={() => { setCompareMode((v) => !v); setCompareSelected(new Set()) }}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-[600] rounded-lg border transition-colors',
                          compareMode
                            ? 'bg-olive-50 border-[#BFD2A1] text-olive-700'
                            : 'bg-white border-[#E3E1DA] text-[#6B6B6B] hover:border-[#BFD2A1] hover:text-olive-700',
                        )}
                      >
                        <GitCompare size={12} />
                        {compareMode ? 'Cancel' : 'Compare'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {watchlist.map((entry) => (
                    <div key={entry.ticker} className="relative">
                      {compareMode && (
                        <button
                          onClick={() => toggleCompareSelect(entry.ticker)}
                          aria-label={compareSelected.has(entry.ticker) ? `Deselect ${entry.ticker}` : `Select ${entry.ticker} for comparison`}
                          className="absolute top-3 left-3 z-20 w-9 h-9 flex items-center justify-center rounded-md bg-white border border-[#E3E1DA] shadow-sm transition-colors hover:border-olive-700"
                        >
                          {compareSelected.has(entry.ticker)
                            ? <CheckSquare size={15} className="text-olive-700" />
                            : <Square size={15} className="text-[#8A95A6]" />
                          }
                        </button>
                      )}
                      <div className={cn('transition-opacity', compareMode && compareSelected.size >= 4 && !compareSelected.has(entry.ticker) ? 'opacity-40' : 'opacity-100')}>
                        <ETFWatchlistCard
                          entry={entry}
                          sparklineData={entry.ticker in sparklines ? sparklines[entry.ticker] : undefined}
                          onDelete={handleDelete}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {wlLoading && (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[80px] bg-white rounded-xl border border-[#E5E5E5] motion-safe:animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty watchlist prompt */}
            {!hasWatchlist && !wlLoading && (
              <div className="bg-white border border-[#E3E1DA] rounded-xl p-6 flex flex-col items-center text-center gap-3">
                <p className="text-[14px] font-[600] text-[#111111]">Track ETFs by what they&apos;re actually worth</p>
                <p className="text-[13px] text-[#8A95A6] max-w-xs">Search above or add from Sectors, Geographies, or Styles tabs.</p>
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
                        <span className="text-[13px] font-[700] text-[#111111]">+ {t}</span>
                        {score != null && (
                          <span className={cn('text-[11px] font-[600] mt-0.5', scoreColor(score))}>
                            {score} · {scoreLabel(score)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rankings */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[13px] font-[700] text-[#111111]">Rankings</h2>
              </div>
              <Rankings
                data={batchData}
                watchlistedTickers={new Set(watchlist.map((e) => e.ticker))}
                onAdd={handleQuickAdd}
              />
            </section>
          </>
        )}

        {/* ── SECTORS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'sectors' && (
          <section>
            <p className="text-[12px] text-[#8A95A6] mb-3">US SPDR sector ETFs (GICS) — click a card to analyze, + to track</p>
            <ETFHeatmapGrid
              metas={SECTOR_META}
              data={batchData}
              watchlistedTickers={new Set(watchlist.map((e) => e.ticker))}
              onAdd={handleQuickAdd}
              cols={4}
              hasError={!!batchError}
              sparklines={pulseSparklines}
            />
          </section>
        )}

        {/* ── GEOGRAPHIES TAB ──────────────────────────────────────────────── */}
        {activeTab === 'geographies' && (
          <section>
            <p className="text-[12px] text-[#8A95A6] mb-3">Regional and country exposure</p>
            <ETFHeatmapGrid
              metas={GEO_META}
              data={batchData}
              watchlistedTickers={new Set(watchlist.map((e) => e.ticker))}
              onAdd={handleQuickAdd}
              cols={3}
              hasError={!!batchError}
              sparklines={pulseSparklines}
            />
          </section>
        )}

        {/* ── STYLES TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'styles' && (
          <section>
            <p className="text-[12px] text-[#8A95A6] mb-3">Factor tilts and smart beta</p>
            <ETFHeatmapGrid
              metas={STYLE_META}
              data={batchData}
              watchlistedTickers={new Set(watchlist.map((e) => e.ticker))}
              onAdd={handleQuickAdd}
              cols={4}
              hasError={!!batchError}
              sparklines={pulseSparklines}
            />
          </section>
        )}

      </div>

      {/* ── Undo toast ───────────────────────────────────────────────────────── */}
      {undoToast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#06101F] text-white rounded-xl px-4 py-3 shadow-lg text-[13px] font-medium whitespace-nowrap" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)' }}>
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
