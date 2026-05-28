'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { loadWatchlist, saveWatchlistEntry, deleteWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { GroupTabs } from '@/components/valuations/GroupTabs'
import { ValuationTable } from '@/components/valuations/ValuationTable'

// ── Card view (grid toggle) ───────────────────────────────────────────────────

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
  const fv        = entry.snapshot.fairValue
  // Short format for mobile (MMM D), same compact format everywhere
  const updatedAt = new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const isUp      = upsidePct != null && upsidePct >= 0

  const TAG_BG: Record<NonNullable<ListTag>, string> = {
    buy:   'bg-emerald-500 text-white',
    watch: 'bg-amber-400 text-white',
    pass:  'bg-slate-400 text-white',
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all group">
      {/* Top: ticker + tag + upside */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-black text-slate-900 font-mono tracking-tight shrink-0">{entry.ticker}</span>
          {entry.listTag && (
            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0', TAG_BG[entry.listTag])}>
              {entry.listTag}
            </span>
          )}
        </div>
        {upsidePct != null && (
          <div className={cn('flex items-center gap-0.5 shrink-0 text-lg font-black font-mono tabular-nums whitespace-nowrap overflow-hidden', isUp ? 'text-emerald-500' : 'text-red-500')}>
            <span className="text-sm">{isUp ? '▲' : '▼'}</span>
            {fmtPct(Math.abs(upsidePct))}
          </div>
        )}
      </div>

      {/* Company name */}
      <p className="text-[11px] text-slate-400 -mt-1 truncate">{entry.companyName}</p>

      {/* Price vs Fair Value */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Price</p>
          <p className="text-sm font-bold font-mono text-slate-700">{price != null ? fmtPrice(price, 'USD') : '—'}</p>
        </div>
        <div className={cn('rounded-lg px-3 py-2', fv != null ? (isUp ? 'bg-emerald-50' : 'bg-red-50') : 'bg-slate-50')}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Fair Value</p>
          <p className={cn('text-sm font-bold font-mono', fv != null ? (isUp ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400')}>
            {fv != null ? fmtPrice(fv, 'USD') : '—'}
          </p>
        </div>
      </div>

      {/* Thesis score */}
      {entry.overallScore != null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Thesis score</p>
            <span className="text-[10px] font-bold font-mono text-slate-500">{Math.round(entry.overallScore * 100)}%</span>
          </div>
          <ScoreBar score={entry.overallScore} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-auto">
        <span className="text-[10px] text-slate-300">{updatedAt}</span>
        <Link
          href={`/stock/${entry.ticker}`}
          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          Reopen →
        </Link>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ValuationsPage() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  const [entries, setEntries]     = useState<WatchlistEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})
  const [view, setView]           = useState<'table' | 'grid'>('table')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  // Tracks groups the user created but hasn't assigned stocks to yet
  const [pendingGroups, setPendingGroups] = useState<string[]>([])

  // ── Load watchlist + sparklines ────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    loadWatchlist(userEmail).then((data) => {
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
  }, [userEmail])

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

  // Summary bar stats
  const buys = entries.filter((e) => e.listTag === 'buy')
  const avgBuyUpside = buys.length > 0
    ? buys.reduce((s, e) => s + (e.snapshot.upsidePct ?? 0), 0) / buys.length
    : null

  // ── Mutation handlers ──────────────────────────────────────────────────────
  const handleDelete = async (ticker: string) => {
    await deleteWatchlistEntry(ticker, userEmail)
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker))
  }

  const handleTagUpdate = async (ticker: string, tag: ListTag) => {
    setEntries((prev) => prev.map((e) => (e.ticker === ticker ? { ...e, listTag: tag } : e)))
    const entry = entries.find((e) => e.ticker === ticker)
    if (entry) await saveWatchlistEntry({ ...entry, listTag: tag }, userEmail)
  }

  const handleGroupUpdate = async (ticker: string, groupName: string | null) => {
    setEntries((prev) =>
      prev.map((e) => (e.ticker === ticker ? { ...e, groupName: groupName ?? undefined } : e)),
    )
    // Remove from pending groups if now assigned a stock
    if (groupName) setPendingGroups((prev) => prev.filter((g) => g !== groupName))
    const entry = entries.find((e) => e.ticker === ticker)
    if (entry) await saveWatchlistEntry({ ...entry, groupName: groupName ?? undefined }, userEmail)
  }

  const handleNewGroup = (name: string) => {
    if (!allGroups.includes(name)) {
      setPendingGroups((prev) => [...prev, name])
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <div className="px-3 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* Premium header banner */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 px-4 sm:px-6 py-4 sm:py-5 mb-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                My Valuations
              </h1>
              <p className="mt-0.5 text-sm text-white/60">
                {entries.length > 0
                  ? `${entries.length} saved ${entries.length === 1 ? 'analysis' : 'analyses'}`
                  : 'Save analyses from any stock page to track conviction'}
              </p>
            </div>

            {/* View toggle */}
            {entries.length > 0 && (
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1 shrink-0">
                <button
                  onClick={() => setView('table')}
                  title="Table view"
                  className={cn('p-1.5 rounded-md transition-colors', view === 'table' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('grid')}
                  title="Grid view"
                  className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Stats row */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Tracked</p>
                <p className="text-xl font-black tabular-nums">{entries.length}</p>
              </div>
              {buys.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Conviction Buys</p>
                  <p className="text-xl font-black tabular-nums text-emerald-400">{buys.length}</p>
                </div>
              )}
              {avgBuyUpside != null && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Avg Upside (Buys)</p>
                  <p className={cn('text-xl font-black tabular-nums', avgBuyUpside >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {avgBuyUpside >= 0 ? '+' : ''}{(avgBuyUpside * 100).toFixed(0)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white border border-slate-200 p-5 h-48 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="rounded-2xl bg-white border border-slate-200 p-8 sm:p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-700 mb-1">No saved analyses yet</h2>
            <p className="text-sm text-slate-400 mb-6">Search a stock and save your first analysis</p>
            <Link
              href="/analyze"
              className="flex sm:inline-flex items-center justify-center rounded-xl px-5 py-3 sm:py-2.5 text-sm font-bold text-white transition-colors"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((entry) => (
                  <ValuationCard key={entry.ticker} entry={entry} />
                ))}
                {filtered.length === 0 && activeGroup && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl bg-white border border-slate-200 p-10 text-center">
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
