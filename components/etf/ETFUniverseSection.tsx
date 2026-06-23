'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Check, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtLarge, fmtPctAbs, fmtMultiple } from '@/lib/formatters'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { ETFHeatmapGrid } from '@/components/etf/ETFHeatmapGrid'
import {
  BROAD_META, SECTOR_META, GEO_META, STYLE_META,
  BOND_META, DIVIDEND_META, THEMATIC_META, COMMODITY_META,
  ALL_META,
} from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'
import type { ETFEntry } from '@/lib/data/etfTypes'
import type { ETFMeta, ETFGroup } from '@/lib/data/etfUniverse'
import { saveETFEntry } from '@/lib/data/etfWatchlistStore'

// ─── Leaderboard ──────────────────────────────────────────────────────────────

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
  broad:     'bg-[#F0F4E8] text-[#5F790B] border-[#BFD2A1]',
  sector:    'bg-[#F0F1F6] text-[#566174] border-[#E3E1DA]',
  geo:       'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  style:     'bg-[#F0FDF4] text-[#11875D] border-[#BBF7D0]',
  bond:      'bg-[#FFF7ED] text-[#B56A00] border-[#FDE68A]',
  dividend:  'bg-[#FDF4FF] text-[#9333EA] border-[#E9D5FF]',
  thematic:  'bg-[#FFF1F2] text-[#D83B3B] border-[#FECACA]',
  commodity: 'bg-[#F5F5F5] text-[#4B5563] border-[#D1D5DB]',
}
const groupLabelDisplay: Record<ETFGroup, string> = {
  broad: 'Broad', sector: 'Sector', geo: 'Geography', style: 'Style',
  bond: 'Bond', dividend: 'Income', thematic: 'Thematic', commodity: 'Commodity',
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
  const [filter, setFilter]   = useState<FilterGroup>(() => {
    if (typeof window === 'undefined') return 'all'
    return (localStorage.getItem('etf_lb_filter') as FilterGroup) ?? 'all'
  })
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    if (typeof window === 'undefined') return 'valueScore'
    return (localStorage.getItem('etf_lb_sort_key') as SortKey) ?? 'valueScore'
  })
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    if (typeof window === 'undefined') return 'desc'
    return (localStorage.getItem('etf_lb_sort_dir') as SortDir) ?? 'desc'
  })
  // Track recently-added tickers for button animation
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())

  useEffect(() => { localStorage.setItem('etf_lb_filter', filter) }, [filter])
  useEffect(() => { localStorage.setItem('etf_lb_sort_key', sortKey) }, [sortKey])
  useEffect(() => { localStorage.setItem('etf_lb_sort_dir', sortDir) }, [sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  function handleAdd(ticker: string) {
    onAdd(ticker)
    setJustAdded((prev) => {
      const next = new Set(prev)
      next.add(ticker)
      setTimeout(() => setJustAdded((p) => { const n = new Set(p); n.delete(ticker); return n }), 600)
      return next
    })
  }

  const FILTERS: { id: FilterGroup; label: string }[] = [
    { id: 'all',       label: 'All'          },
    { id: 'broad',     label: 'Broad Market' },
    { id: 'sector',    label: 'Sectors'      },
    { id: 'geo',       label: 'International'},
    { id: 'style',     label: 'Styles'       },
    { id: 'bond',      label: 'Bonds'        },
    { id: 'dividend',  label: 'Income'       },
    { id: 'thematic',  label: 'Thematic'     },
    { id: 'commodity', label: 'Commodity'    },
  ]

  type ColDef = { key: SortKey; label: string }
  const COLS: ColDef[] = [
    { key: 'peRatio',      label: 'P/E'         },
    { key: 'pbRatio',      label: 'P/B'         },
    { key: 'expenseRatio', label: 'Exp. ratio'  },
    { key: 'yield',        label: 'Yield'       },
    { key: 'aum',          label: 'AUM'         },
    { key: 'valueScore',   label: 'Value score' },
  ]

  const rows = (ALL_META as ETFMeta[])
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

  return (
    <section>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
        <div>
          <h2 className="text-[13px] font-[700] text-[#111111]">Rankings</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">All ETFs ranked — click any column header to sort</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-2 rounded-full text-[12px] font-semibold transition-colors border',
                filter === f.id
                  ? 'bg-olive-700 text-white border-olive-700'
                  : 'bg-white text-[#566174] border-[#E3E1DA] hover:border-[#BFD2A1] hover:text-olive-700',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E3E1DA] [overflow:clip] mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E3E1DA] bg-[#F0F1F6]">
                <th scope="col" className="text-left pl-4 pr-3 py-2.5 text-[11px] font-semibold text-[#566174] w-[200px] sticky left-0 bg-[#F0F1F6]">
                  ETF
                </th>
                <th scope="col" className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#566174]">
                  Type
                </th>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-3 py-2.5 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort(col.key)}
                    aria-sort={
                      col.key === sortKey
                        ? sortDir === 'desc' ? 'descending' : 'ascending'
                        : 'none'
                    }
                  >
                    <span className="inline-flex items-center justify-end gap-1 text-[11px] font-semibold text-[#566174] hover:text-[#06101F] transition-colors">
                      {col.label}
                      <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F1F6]">
              {rows.map(({ meta, item }) => {
                const score = item?.valueScore ?? null
                const isWatchlisted = watchlistedTickers.has(meta.ticker)
                const wasJustAdded = justAdded.has(meta.ticker)
                return (
                  <tr key={meta.ticker} className="hover:bg-[#F0F1F6] transition-colors group">
                    <td className="pl-4 pr-3 py-3 sticky left-0 bg-white group-hover:bg-[#F0F1F6] transition-colors">
                      <Link href={`/etf/${meta.ticker}`} className="block">
                        <span className="font-[700] text-[13px] text-[#06101F] hover:text-olive-700 transition-colors">
                          {meta.ticker}
                        </span>
                        <span className="block text-[11px] text-[#8A95A6] mt-0.5 truncate max-w-[160px]">
                          {item?.name ?? meta.label}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', groupBadge[meta.group])}>
                        {groupLabelDisplay[meta.group]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[12px] text-[#06101F]">
                      {item?.peRatio != null ? fmtMultiple(item.peRatio) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[12px] text-[#06101F]">
                      {item?.pbRatio != null ? fmtMultiple(item.pbRatio) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[12px] text-[#06101F]">
                      {item?.expenseRatio != null
                        ? (item.expenseRatio * 100).toFixed(2) + '%'
                        : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[12px] text-[#06101F]">
                      {item?.yield != null ? fmtPctAbs(item.yield) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[12px] text-[#06101F]">
                      {item?.aum != null ? fmtLarge(item.aum) : <span className="text-[#8A95A6]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {score != null ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className={cn('text-[13px] font-[700]', scoreColor(score))}>{score}</span>
                          <span className={cn('text-[10px] font-semibold', scoreColor(score))}>{scoreLabel(score)}</span>
                          <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." side="top" />
                        </div>
                      ) : (
                        <span className="text-[#8A95A6]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => !isWatchlisted && handleAdd(meta.ticker)}
                        aria-label={isWatchlisted ? `${meta.ticker} in watchlist` : `Add ${meta.ticker} to watchlist`}
                        className={cn(
                          'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all duration-150',
                          isWatchlisted
                            ? 'bg-[#E8F7EF] text-[#11875D]'
                            : 'bg-[#F0F1F6] text-[#8A95A6] hover:bg-olive-50 hover:text-olive-700',
                          wasJustAdded && 'scale-125',
                        )}
                        style={wasJustAdded ? { transition: 'transform 0.15s ease' } : undefined}
                      >
                        {isWatchlisted ? <Check size={12} /> : <Plus size={12} />}
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

// ─── Empty watchlist CTA with top picks ───────────────────────────────────────

function EmptyWatchlistCTA({
  data,
  onQuickAdd,
}: {
  data: Record<string, ETFBatchItem | null>
  onQuickAdd: (ticker: string) => void
}) {
  const TOP_PICKS = ['SPY', 'VTV', 'VYM']

  return (
    <section>
      <h2 className="text-[13px] font-[700] text-[#111111] mb-5">My Watchlist</h2>
      <div className="bg-white border border-[#E3E1DA] rounded-2xl p-8 flex flex-col items-center text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="w-12 h-12 rounded-xl bg-[#F0F1F6] flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A95A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
        </div>
        <h3 className="text-[15px] font-bold text-[#06101F] mb-1">Track ETFs by what they&apos;re actually worth</h3>
        <p className="text-[13px] text-[#8A95A6] max-w-xs mb-5 leading-relaxed">
          Search for a ticker at the top of the page, or add directly from the rankings and grids below.
        </p>

        {Object.keys(data).length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {TOP_PICKS.map((t) => {
              const item = data[t]
              const score = item?.valueScore ?? null
              return (
                <button
                  key={t}
                  onClick={() => onQuickAdd(t)}
                  className="flex flex-col items-center px-4 py-2.5 min-h-[44px] rounded-xl border border-[#E3E1DA] bg-white hover:border-[#BFD2A1] hover:bg-olive-50 transition-colors"
                >
                  <span className="text-[13px] font-bold text-[#06101F]">+ {t}</span>
                  {score != null && (
                    <span className={cn('text-[11px] font-semibold mt-0.5', scoreColor(score))}>
                      {score} · {scoreLabel(score)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  data: Record<string, ETFBatchItem | null>
  watchlist: ETFEntry[]
  userEmail: string | null
  onWatchlistUpdate: () => void
  hasError?: boolean
  emptyWatchlist?: boolean
  batchData: Record<string, ETFBatchItem | null>
  onQuickAdd: (ticker: string) => void
  /** Optional override — when provided, bypasses the internal saveETFEntry (used for login gating) */
  onSave?: (ticker: string, name: string | null, item: ETFBatchItem) => Promise<void>
}

export function ETFUniverseSection({ data, watchlist, userEmail, onWatchlistUpdate, hasError, emptyWatchlist, batchData, onQuickAdd, onSave }: Props) {
  const watchlistedTickers = useMemo(() => new Set(watchlist.map((e) => e.ticker)), [watchlist])

  const handleAdd = useCallback(async (ticker: string) => {
    if (watchlistedTickers.has(ticker)) return
    const item = data[ticker]
    if (!item) return
    if (onSave) {
      await onSave(ticker, item.name, item)
      return
    }
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
        price: item.price ?? null,
        priceChangePct: item.priceChangePct ?? null,
        metricsUpdatedAt: new Date().toISOString(),
      },
      userEmail,
    )
    onWatchlistUpdate()
  }, [data, userEmail, watchlistedTickers, onWatchlistUpdate, onSave])

  return (
    <div className="space-y-10">

      {/* Empty watchlist CTA — shown above rankings when watchlist is empty */}
      {emptyWatchlist && (
        <EmptyWatchlistCTA data={batchData} onQuickAdd={onQuickAdd} />
      )}

      {/* Rankings leaderboard — most useful tool, shown first */}
      <Leaderboard data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} />

      {/* Heatmap grids */}
      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">Broad Market</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">S&amp;P 500, Nasdaq 100, total market</p>
        </div>
        <ETFHeatmapGrid metas={BROAD_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={4} hasError={hasError} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">Sectors</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">US SPDR sector ETFs (GICS)</p>
        </div>
        <ETFHeatmapGrid metas={SECTOR_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={4} hasError={hasError} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">International</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">Regional and country exposure</p>
        </div>
        <ETFHeatmapGrid metas={GEO_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={3} hasError={hasError} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">Style / Factor</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">Value, growth, quality, momentum</p>
        </div>
        <ETFHeatmapGrid metas={STYLE_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={4} hasError={hasError} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">Fixed Income</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">Treasury, corporate, and TIPS bonds — value scoring N/A</p>
        </div>
        <ETFHeatmapGrid metas={BOND_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={4} hasError={hasError} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">Dividend &amp; Income</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">High dividend and dividend growth ETFs</p>
        </div>
        <ETFHeatmapGrid metas={DIVIDEND_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={4} hasError={hasError} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">Thematic</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">Semiconductors, biotech, clean energy</p>
        </div>
        <ETFHeatmapGrid metas={THEMATIC_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={4} hasError={hasError} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[13px] font-[700] text-[#111111]">Commodities &amp; Alternatives</h2>
          <p className="text-[12px] text-[#8A95A6] mt-0.5">Gold, silver, REITs — value scoring N/A</p>
        </div>
        <ETFHeatmapGrid metas={COMMODITY_META} data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} cols={4} hasError={hasError} />
      </section>
    </div>
  )
}
