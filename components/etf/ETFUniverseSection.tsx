'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Check, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtLarge, fmtPctAbs, fmtMultiple } from '@/lib/formatters'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { ETFHeatmapGrid } from '@/components/etf/ETFHeatmapGrid'
import { SECTOR_META, GEO_META, STYLE_META, ALL_META } from '@/lib/data/etfUniverse'
import type { ETFBatchItem } from '@/lib/data/etfTypes'
import type { ETFEntry } from '@/lib/data/etfTypes'
import type { ETFMeta, ETFGroup } from '@/lib/data/etfUniverse'
import { saveETFEntry } from '@/lib/data/etfWatchlistStore'

// ─── Leaderboard ──────────────────────────────────────────────────────────────

type SortKey = 'valueScore' | 'peRatio' | 'pbRatio' | 'expenseRatio' | 'yield' | 'aum'
type SortDir = 'asc' | 'desc'
type FilterGroup = 'all' | ETFGroup

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-slate-300" />
  return sortDir === 'desc'
    ? <ChevronDown size={11} className="text-[#5F790B]" />
    : <ChevronUp size={11} className="text-[#5F790B]" />
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

  useEffect(() => { localStorage.setItem('etf_lb_filter', filter) }, [filter])
  useEffect(() => { localStorage.setItem('etf_lb_sort_key', sortKey) }, [sortKey])
  useEffect(() => { localStorage.setItem('etf_lb_sort_dir', sortDir) }, [sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const FILTERS: { id: FilterGroup; label: string }[] = [
    { id: 'all',    label: 'All'          },
    { id: 'sector', label: 'Sectors'      },
    { id: 'geo',    label: 'Geographies'  },
    { id: 'style',  label: 'Styles'       },
  ]

  type ColDef = { key: SortKey; label: string }
  const COLS: ColDef[] = [
    { key: 'peRatio',      label: 'P/E'        },
    { key: 'pbRatio',      label: 'P/B'        },
    { key: 'expenseRatio', label: 'Exp. ratio' },
    { key: 'yield',        label: 'Yield'      },
    { key: 'aum',          label: 'AUM'        },
    { key: 'valueScore',   label: 'Value score' },
  ]

  const groupBadge: Record<ETFGroup, string> = {
    sector: 'bg-violet-50 text-violet-700 border-violet-200',
    geo:    'bg-sky-50 text-sky-700 border-sky-200',
    style:  'bg-amber-50 text-amber-700 border-amber-200',
  }
  const groupLabel: Record<ETFGroup, string> = {
    sector: 'Sector',
    geo:    'Geography',
    style:  'Style',
  }

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
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Rankings
        </h2>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-2.5 rounded-full text-[12px] font-semibold transition-colors border',
                filter === f.id
                  ? 'bg-[#5F790B] text-white border-[#5F790B]'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-[#BFD2A1] hover:text-[#5F790B]',
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
                <th scope="col" className="text-left pl-4 pr-3 py-2.5 text-[11px] font-semibold text-slate-500 w-[200px] sticky left-0 bg-slate-50">
                  ETF
                </th>
                <th scope="col" className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500">
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
                    <span className="inline-flex items-center justify-end gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                      {col.label}
                      <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(({ meta, item }) => {
                const score = item?.valueScore ?? null
                return (
                  <tr key={meta.ticker} className="hover:bg-slate-50 transition-colors group">
                    <td className="pl-4 pr-3 py-3 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors">
                      <Link href={`/etf/${meta.ticker}`} className="block">
                        <span className="font-mono font-black text-[13px] text-slate-900 hover:text-blue-600 transition-colors">
                          {meta.ticker}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                          {item?.name ?? meta.label}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', groupBadge[meta.group])}>
                        {groupLabel[meta.group]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.peRatio != null ? fmtMultiple(item.peRatio) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.pbRatio != null ? fmtMultiple(item.pbRatio) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.expenseRatio != null
                        ? (item.expenseRatio * 100).toFixed(2) + '%'
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.yield != null ? fmtPctAbs(item.yield) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-700">
                      {item?.aum != null ? fmtLarge(item.aum) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {score != null ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className={cn('text-[13px] font-black font-mono', scoreColor(score))}>{score}</span>
                          <span className={cn('text-[10px] font-semibold', scoreColor(score))}>{scoreLabel(score)}</span>
                          <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." side="top" />
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onAdd(meta.ticker)}
                        aria-label={watchlistedTickers.has(meta.ticker) ? `${meta.ticker} in watchlist` : `Add ${meta.ticker} to watchlist`}
                        className={cn(
                          'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all',
                          watchlistedTickers.has(meta.ticker)
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-400 hover:bg-[#F6FAEA] hover:text-[#5F790B]',
                        )}
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
  data: Record<string, ETFBatchItem | null>
  watchlist: ETFEntry[]
  userEmail: string | null
  onWatchlistUpdate: () => void
}

export function ETFUniverseSection({ data, watchlist, userEmail, onWatchlistUpdate }: Props) {
  const watchlistedTickers = useMemo(() => new Set(watchlist.map((e) => e.ticker)), [watchlist])

  const handleAdd = useCallback(async (ticker: string) => {
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
  }, [data, userEmail, watchlistedTickers, onWatchlistUpdate])

  return (
    <div className="space-y-10">
      {/* Sectors */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            Sectors
          </h2>
          <p className="text-[13px] text-slate-400 mt-0.5">US SPDR sector ETFs (GICS)</p>
        </div>
        <ETFHeatmapGrid
          metas={SECTOR_META}
          data={data}
          watchlistedTickers={watchlistedTickers}
          onAdd={handleAdd}
          cols={4}
        />
      </section>

      {/* Geographies */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            Geographies
          </h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Regional and country exposure</p>
        </div>
        <ETFHeatmapGrid
          metas={GEO_META}
          data={data}
          watchlistedTickers={watchlistedTickers}
          onAdd={handleAdd}
          cols={3}
        />
      </section>

      {/* Styles */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            Styles
          </h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Factor tilts and smart beta</p>
        </div>
        <ETFHeatmapGrid
          metas={STYLE_META}
          data={data}
          watchlistedTickers={watchlistedTickers}
          onAdd={handleAdd}
          cols={4}
        />
      </section>

      {/* Rankings leaderboard */}
      <div className="border-t border-slate-200 pt-8">
        <Leaderboard data={data} watchlistedTickers={watchlistedTickers} onAdd={handleAdd} />
      </div>
    </div>
  )
}
