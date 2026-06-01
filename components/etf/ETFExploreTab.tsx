'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Check, ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtLarge, fmtPctAbs, fmtMultiple } from '@/lib/formatters'
import { saveETFEntry } from '@/lib/data/etfWatchlistStore'
import type { ETFEntry } from '@/lib/data/etfTypes'

// ─── Universe ────────────────────────────────────────────────────────────────

type ETFGroup = 'sector' | 'geo' | 'style'

interface ETFMeta {
  ticker: string
  group: ETFGroup
  label: string
}

const SECTOR_META: ETFMeta[] = [
  { ticker: 'XLK',  group: 'sector', label: 'Technology' },
  { ticker: 'XLV',  group: 'sector', label: 'Healthcare' },
  { ticker: 'XLF',  group: 'sector', label: 'Financials' },
  { ticker: 'XLY',  group: 'sector', label: 'Cons. Cyclical' },
  { ticker: 'XLI',  group: 'sector', label: 'Industrials' },
  { ticker: 'XLC',  group: 'sector', label: 'Comm. Services' },
  { ticker: 'XLP',  group: 'sector', label: 'Cons. Defensive' },
  { ticker: 'XLE',  group: 'sector', label: 'Energy' },
  { ticker: 'XLRE', group: 'sector', label: 'Real Estate' },
  { ticker: 'XLB',  group: 'sector', label: 'Materials' },
  { ticker: 'XLU',  group: 'sector', label: 'Utilities' },
]

const GEO_META: ETFMeta[] = [
  { ticker: 'SPY',  group: 'geo', label: 'US Large Cap' },
  { ticker: 'EFA',  group: 'geo', label: 'Developed World' },
  { ticker: 'EEM',  group: 'geo', label: 'Emerging Markets' },
  { ticker: 'EWJ',  group: 'geo', label: 'Japan' },
  { ticker: 'FXI',  group: 'geo', label: 'China' },
  { ticker: 'EWZ',  group: 'geo', label: 'Brazil' },
  { ticker: 'EWU',  group: 'geo', label: 'UK' },
  { ticker: 'EWG',  group: 'geo', label: 'Germany' },
  { ticker: 'INDA', group: 'geo', label: 'India' },
]

const STYLE_META: ETFMeta[] = [
  { ticker: 'VTV',  group: 'style', label: 'Value' },
  { ticker: 'VUG',  group: 'style', label: 'Growth' },
  { ticker: 'VYM',  group: 'style', label: 'High Dividend' },
  { ticker: 'USMV', group: 'style', label: 'Low Volatility' },
  { ticker: 'QUAL', group: 'style', label: 'Quality' },
  { ticker: 'IWM',  group: 'style', label: 'Small Cap' },
  { ticker: 'IWB',  group: 'style', label: 'Large Cap' },
]

const ALL_META: ETFMeta[] = [...SECTOR_META, ...GEO_META, ...STYLE_META]
const ALL_TICKERS = ALL_META.map((m) => m.ticker)

// ─── Types ───────────────────────────────────────────────────────────────────

interface ETFBatchItem {
  ticker: string
  name: string
  category: string | null
  peRatio: number | null
  pbRatio: number | null
  expenseRatio: number | null
  yield: number | null
  aum: number | null
  valueScore: number
}

type SortKey = 'valueScore' | 'peRatio' | 'pbRatio' | 'expenseRatio' | 'yield' | 'aum'
type SortDir = 'asc' | 'desc'

// ─── Value Score helpers ──────────────────────────────────────────────────────

function scoreLabel(score: number): string {
  if (score >= 70) return 'Deep Value'
  if (score >= 50) return 'Fair'
  if (score >= 30) return 'Stretched'
  return 'Expensive'
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-700'
  if (score >= 50) return 'text-blue-600'
  if (score >= 30) return 'text-amber-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'bg-blue-50 border-blue-200'
  if (score >= 30) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

// ─── Shelf Card ───────────────────────────────────────────────────────────────

function ShelfCard({
  meta,
  data,
  isWatchlisted,
  onAdd,
}: {
  meta: ETFMeta
  data: ETFBatchItem | null
  isWatchlisted: boolean
  onAdd: (ticker: string) => void
}) {
  const score = data?.valueScore ?? null

  return (
    <Link
      href={`/etf/${meta.ticker}`}
      className="group relative flex flex-col gap-2.5 bg-white rounded-xl border border-slate-200 p-3.5 w-[152px] shrink-0 hover:border-blue-200 hover:shadow-md transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <span className="block text-[15px] font-black font-mono text-slate-900 leading-none">
            {meta.ticker}
          </span>
          <span className="block text-[11px] text-slate-400 mt-1 leading-tight line-clamp-1">
            {meta.label}
          </span>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onAdd(meta.ticker) }}
          className={cn(
            'shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all',
            isWatchlisted
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600',
          )}
          title={isWatchlisted ? 'In watchlist' : 'Add to watchlist'}
        >
          {isWatchlisted ? <Check size={12} /> : <Plus size={12} />}
        </button>
      </div>

      {/* Score badge */}
      {score != null ? (
        <div className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1.5 border', scoreBg(score))}>
          <span className={cn('text-lg font-black font-mono leading-none', scoreColor(score))}>
            {score}
          </span>
          <span className={cn('text-[10px] font-semibold leading-tight', scoreColor(score))}>
            {scoreLabel(score)}
          </span>
        </div>
      ) : (
        <div className="h-9 rounded-lg bg-slate-100 animate-pulse" />
      )}

      {/* Stats */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-medium">P/E</span>
          <span className="text-[11px] font-mono font-semibold text-slate-700">
            {data?.peRatio != null ? fmtMultiple(data.peRatio) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-medium">ER</span>
          <span className="text-[11px] font-mono font-semibold text-slate-700">
            {data?.expenseRatio != null ? (data.expenseRatio * 100).toFixed(2) + '%' : '—'}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Shelf Row ────────────────────────────────────────────────────────────────

function ShelfRow({
  title,
  description,
  metas,
  data,
  watchlistedTickers,
  onAdd,
}: {
  title: string
  description: string
  metas: ETFMeta[]
  data: Record<string, ETFBatchItem | null>
  watchlistedTickers: Set<string>
  onAdd: (ticker: string) => void
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
        <span className="text-[12px] text-slate-400">{description}</span>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {metas.map((meta) => (
          <div key={meta.ticker} style={{ scrollSnapAlign: 'start' }}>
            <ShelfCard
              meta={meta}
              data={data[meta.ticker] ?? null}
              isWatchlisted={watchlistedTickers.has(meta.ticker)}
              onAdd={onAdd}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

type FilterGroup = 'all' | ETFGroup

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-slate-300" />
  return sortDir === 'desc'
    ? <ChevronDown size={11} className="text-blue-500" />
    : <ChevronUp size={11} className="text-blue-500" />
}

function Leaderboard({
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

  const FILTERS: { id: FilterGroup; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'sector', label: 'Sectors' },
    { id: 'geo', label: 'Geographies' },
    { id: 'style', label: 'Styles' },
  ]

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const rows = ALL_META
    .filter((m) => filter === 'all' || m.group === filter)
    .map((m) => ({ meta: m, item: data[m.ticker] ?? null }))
    .sort((a, b) => {
      const va = a.item?.[sortKey] ?? null
      const vb = b.item?.[sortKey] ?? null
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return sortDir === 'desc' ? vb - va : va - vb
    })

  const groupBadge: Record<ETFGroup, string> = {
    sector: 'bg-violet-50 text-violet-700 border-violet-200',
    geo: 'bg-sky-50 text-sky-700 border-sky-200',
    style: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const groupLabel: Record<ETFGroup, string> = {
    sector: 'Sector',
    geo: 'Geography',
    style: 'Style',
  }

  type ColDef = { key: SortKey; label: string; align: 'left' | 'right' }
  const COLS: ColDef[] = [
    { key: 'peRatio',      label: 'P/E',   align: 'right' },
    { key: 'pbRatio',      label: 'P/B',   align: 'right' },
    { key: 'expenseRatio', label: 'Exp. Ratio', align: 'right' },
    { key: 'yield',        label: 'Yield', align: 'right' },
    { key: 'aum',          label: 'AUM',   align: 'right' },
    { key: 'valueScore',   label: 'Val. Score', align: 'right' },
  ]

  return (
    <section>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <h2 className="text-[15px] font-bold text-slate-900">Rankings</h2>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1 rounded-full text-[12px] font-semibold transition-colors border',
                filter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left pl-4 pr-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[200px] sticky left-0 bg-slate-50">
                  ETF
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center justify-end gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                      {col.label}
                      <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(({ meta, item }) => {
                const score = item?.valueScore ?? null
                return (
                  <tr
                    key={meta.ticker}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    {/* ETF name — sticky, links to detail */}
                    <td className="pl-4 pr-3 py-3 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors">
                      <Link href={`/etf/${meta.ticker}`} className="block">
                        <span className="font-black font-mono text-[13px] text-slate-900 hover:text-blue-600 transition-colors">
                          {meta.ticker}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                          {item?.name ?? meta.label}
                        </span>
                      </Link>
                    </td>

                    {/* Group badge */}
                    <td className="px-3 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                        groupBadge[meta.group],
                      )}>
                        {groupLabel[meta.group]}
                      </span>
                    </td>

                    {/* P/E */}
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.peRatio != null ? fmtMultiple(item.peRatio) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* P/B */}
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.pbRatio != null ? fmtMultiple(item.pbRatio) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Expense Ratio */}
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.expenseRatio != null
                        ? (item.expenseRatio * 100).toFixed(2) + '%'
                        : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Yield */}
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.yield != null ? fmtPctAbs(item.yield) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* AUM */}
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.aum != null ? fmtLarge(item.aum) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Value Score */}
                    <td className="px-3 py-3 text-right">
                      {score != null ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className={cn('text-[13px] font-black font-mono', scoreColor(score))}>
                            {score}
                          </span>
                          <span className={cn('text-[10px] font-semibold', scoreColor(score))}>
                            {scoreLabel(score)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Add to watchlist */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onAdd(meta.ticker)}
                        className={cn(
                          'w-7 h-7 flex items-center justify-center rounded-lg transition-all',
                          watchlistedTickers.has(meta.ticker)
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 opacity-0 group-hover:opacity-100',
                        )}
                        title={watchlistedTickers.has(meta.ticker) ? 'In watchlist' : 'Add to watchlist'}
                      >
                        {watchlistedTickers.has(meta.ticker) ? <Check size={12} /> : <Plus size={12} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  watchlist: ETFEntry[]
  userEmail: string | null
  onWatchlistUpdate: () => void
}

export function ETFExploreTab({ watchlist, userEmail, onWatchlistUpdate }: Props) {
  const [data, setData] = useState<Record<string, ETFBatchItem | null>>({})
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const watchlistedTickers = new Set(watchlist.map((e) => e.ticker))

  const fetchAll = useCallback(async () => {
    if (fetched) return
    setLoading(true)
    try {
      const res = await fetch(`/api/etf/batch?tickers=${ALL_TICKERS.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setFetched(true)
    } catch (e) {
      console.error('ETF batch fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [fetched])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAdd(ticker: string) {
    if (watchlistedTickers.has(ticker)) return
    const item = data[ticker]
    if (!item) return
    await saveETFEntry(
      {
        ticker: item.ticker,
        name: item.name,
        valueScore: item.valueScore,
        expenseRatio: item.expenseRatio,
        yield: item.yield,
        peRatio: item.peRatio,
        pbRatio: item.pbRatio,
        totalAssets: item.aum,
        addedAt: new Date().toISOString(),
      },
      userEmail,
    )
    onWatchlistUpdate()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={22} className="text-blue-500 animate-spin" />
        <p className="text-[13px] text-slate-400">Loading {ALL_TICKERS.length} ETFs…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ShelfRow
        title="Sectors"
        description="US SPDR sector ETFs (GICS)"
        metas={SECTOR_META}
        data={data}
        watchlistedTickers={watchlistedTickers}
        onAdd={handleAdd}
      />
      <ShelfRow
        title="Geographies"
        description="Regional and country exposure"
        metas={GEO_META}
        data={data}
        watchlistedTickers={watchlistedTickers}
        onAdd={handleAdd}
      />
      <ShelfRow
        title="Styles"
        description="Factor tilts and smart beta"
        metas={STYLE_META}
        data={data}
        watchlistedTickers={watchlistedTickers}
        onAdd={handleAdd}
      />

      <div className="border-t border-slate-200 pt-6">
        <Leaderboard data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} />
      </div>
    </div>
  )
}
