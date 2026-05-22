'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { loadWatchlist, saveWatchlistEntry, deleteWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'
import { fmtPrice, fmtPct, fmtLargeCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { GroupTabs } from '@/components/valuations/GroupTabs'
import { ValuationTable } from '@/components/valuations/ValuationTable'

// ── Card view (grid toggle) ───────────────────────────────────────────────────

const TAG_STYLES = {
  buy:   'bg-emerald-100 text-emerald-700',
  watch: 'bg-amber-100 text-amber-700',
  pass:  'bg-red-100 text-red-700',
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = pct >= 65 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

function ValuationCard({ entry }: { entry: WatchlistEntry }) {
  const upsidePct = entry.snapshot.upsidePct
  const price     = entry.snapshot.price
  const marketCap = entry.snapshot.marketCap
  const updatedAt = new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-col gap-3 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 font-mono">{entry.ticker}</span>
            {entry.listTag && (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', TAG_STYLES[entry.listTag])}>
                {entry.listTag}
              </span>
            )}
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5 truncate max-w-[200px]">{entry.companyName}</p>
        </div>
        {upsidePct != null && (
          <span className={cn('text-sm font-bold font-mono shrink-0', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {fmtPct(upsidePct)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {price != null && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Price</p>
            <p className="text-[13px] font-mono font-semibold text-slate-800">{fmtPrice(price, 'USD')}</p>
          </div>
        )}
        {entry.snapshot.fairValue != null && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fair Value</p>
            <p className="text-[13px] font-mono font-semibold text-slate-800">{fmtPrice(entry.snapshot.fairValue, 'USD')}</p>
          </div>
        )}
        {entry.snapshot.fairValue == null && marketCap != null && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Market Cap</p>
            <p className="text-[13px] font-mono font-semibold text-slate-800">{fmtLargeCurrency(marketCap, 'USD')}</p>
          </div>
        )}
      </div>

      {entry.overallScore != null && (
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Thesis score</p>
          <ScoreBar score={entry.overallScore} />
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">Updated {updatedAt}</span>
        <Link
          href={`/stock/${entry.ticker}`}
          className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          Reopen analysis →
        </Link>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ValuationsPage() {
  const [entries, setEntries]     = useState<WatchlistEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})
  const [view, setView]           = useState<'table' | 'grid'>('table')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  // Tracks groups the user created but hasn't assigned stocks to yet
  const [pendingGroups, setPendingGroups] = useState<string[]>([])

  // ── Load watchlist + sparklines ────────────────────────────────────────────
  useEffect(() => {
    loadWatchlist(null).then((data) => {
      const sorted = data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      setEntries(sorted)
      setLoading(false)

      if (sorted.length === 0) return

      Promise.allSettled(
        sorted.map((e) =>
          fetch(`/api/historical?ticker=${encodeURIComponent(e.ticker)}&period=1mo`)
            .then((r) => r.json())
            .then((bars: Array<{ close: number }>) => ({
              ticker: e.ticker,
              prices: bars.map((b) => b.close).filter((v) => typeof v === 'number' && isFinite(v)),
            }))
            .catch(() => ({ ticker: e.ticker, prices: [] })),
        ),
      ).then((results) => {
        const map: Record<string, number[] | null> = {}
        for (const r of results) {
          if (r.status === 'fulfilled') {
            map[r.value.ticker] = r.value.prices.length >= 2 ? r.value.prices : null
          }
        }
        setSparklines(map)
      })
    })
  }, [])

  // ── Derived state ──────────────────────────────────────────────────────────
  const derivedGroups = Array.from(
    new Set(entries.map((e) => e.groupName).filter((g): g is string => !!g)),
  )
  const allGroups = Array.from(new Set([...derivedGroups, ...pendingGroups]))

  const groupCounts = Object.fromEntries(
    allGroups.map((g) => [g, entries.filter((e) => e.groupName === g).length]),
  )

  const filtered = activeGroup
    ? entries.filter((e) => e.groupName === activeGroup)
    : entries

  // ── Mutation handlers ──────────────────────────────────────────────────────
  const handleDelete = async (ticker: string) => {
    await deleteWatchlistEntry(ticker, null)
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker))
  }

  const handleTagUpdate = async (ticker: string, tag: ListTag) => {
    setEntries((prev) => prev.map((e) => (e.ticker === ticker ? { ...e, listTag: tag } : e)))
    const entry = entries.find((e) => e.ticker === ticker)
    if (entry) await saveWatchlistEntry({ ...entry, listTag: tag }, null)
  }

  const handleGroupUpdate = async (ticker: string, groupName: string | null) => {
    setEntries((prev) =>
      prev.map((e) => (e.ticker === ticker ? { ...e, groupName: groupName ?? undefined } : e)),
    )
    // Remove from pending groups if now assigned a stock
    if (groupName) setPendingGroups((prev) => prev.filter((g) => g !== groupName))
    const entry = entries.find((e) => e.ticker === ticker)
    if (entry) await saveWatchlistEntry({ ...entry, groupName: groupName ?? undefined }, null)
  }

  const handleNewGroup = (name: string) => {
    if (!allGroups.includes(name)) {
      setPendingGroups((prev) => [...prev, name])
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-extrabold text-slate-900"
              style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}
            >
              My Valuations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {entries.length > 0
                ? `${entries.length} saved ${entries.length === 1 ? 'analysis' : 'analyses'}`
                : 'Saved analyses from your research'}
            </p>
          </div>

          {/* View toggle */}
          {entries.length > 0 && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shrink-0">
              <button
                onClick={() => setView('table')}
                title="Table view"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  view === 'table' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setView('grid')}
                title="Grid view"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  view === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white border border-slate-200 p-5 h-48 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-700 mb-1">No saved analyses yet</h2>
            <p className="text-sm text-slate-400 mb-6">Search a stock and save your first analysis</p>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors"
              style={{ background: '#0F2A5E' }}
            >
              Analyze a stock →
            </Link>
          </div>
        )}

        {/* Content */}
        {!loading && entries.length > 0 && (
          <div className="space-y-5">
            <GroupTabs
              groups={allGroups}
              active={activeGroup}
              counts={groupCounts}
              totalCount={entries.length}
              onSelect={setActiveGroup}
              onNewGroup={handleNewGroup}
            />

            {view === 'table' ? (
              <ValuationTable
                entries={filtered}
                sparklines={sparklines}
                groups={allGroups}
                onDelete={handleDelete}
                onTagUpdate={handleTagUpdate}
                onGroupUpdate={handleGroupUpdate}
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((entry) => (
                  <ValuationCard key={entry.ticker} entry={entry} />
                ))}
                {filtered.length === 0 && activeGroup && (
                  <div className="col-span-3 rounded-xl bg-white border border-slate-200 p-10 text-center">
                    <p className="text-sm text-slate-400">No stocks in &quot;{activeGroup}&quot; yet.</p>
                    <p className="text-xs text-slate-300 mt-1">Use the ··· menu on any row in Table view to assign stocks here.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
