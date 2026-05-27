'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import { ListTagBadge, cycleTag } from '@/components/simplifier/ListTagSelector'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'ticker' | 'upsidePct' | 'overallScore' | 'updatedAt' | 'price'

interface ValuationTableProps {
  entries: WatchlistEntry[]
  sparklines: Record<string, number[] | null>
  groups: string[]
  onDelete: (ticker: string) => void
  onTagUpdate: (ticker: string, tag: ListTag) => void
  onGroupUpdate: (ticker: string, groupName: string | null) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m === 1) return '1mo ago'
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

function sortEntries(entries: WatchlistEntry[], key: SortKey, dir: 'asc' | 'desc'): WatchlistEntry[] {
  return [...entries].sort((a, b) => {
    let va: string | number
    let vb: string | number
    switch (key) {
      case 'ticker':       va = a.ticker; vb = b.ticker; break
      case 'upsidePct':    va = a.snapshot.upsidePct ?? -Infinity; vb = b.snapshot.upsidePct ?? -Infinity; break
      case 'overallScore': va = a.overallScore ?? -Infinity; vb = b.overallScore ?? -Infinity; break
      case 'price':        va = a.snapshot.price ?? -Infinity; vb = b.snapshot.price ?? -Infinity; break
      case 'updatedAt':    va = a.updatedAt; vb = b.updatedAt; break
    }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  })
}

// ── Stock Logo ────────────────────────────────────────────────────────────────

function StockLogo({ ticker }: { ticker: string }) {
  const [failed, setFailed] = useState(false)
  const domain = ticker.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  if (failed) {
    return (
      <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
        <span className="text-[9px] font-bold text-slate-400 uppercase">{ticker.slice(0, 2)}</span>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={ticker}
      width={28}
      height={28}
      className="rounded-md w-7 h-7 object-cover flex-shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

// ── Score cell ────────────────────────────────────────────────────────────────

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-300 font-mono text-[13px]">—</span>
  const pct = Math.round(score * 100)
  const color = pct >= 65 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626'
  return <span className="font-mono text-[13px] font-semibold" style={{ color }}>{pct}%</span>
}

// ── Actions dropdown ──────────────────────────────────────────────────────────

function ActionsMenu({ entry, groups, onDelete, onTagUpdate, onGroupUpdate }: {
  entry: WatchlistEntry
  groups: string[]
  onDelete: () => void
  onTagUpdate: (tag: ListTag) => void
  onGroupUpdate: (groupName: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setMoveOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const close = () => { setOpen(false); setMoveOpen(false); setNewGroup('') }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setMoveOpen(false) }}
        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors sm:p-1.5 sm:min-h-0 sm:min-w-0 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="8" cy="13" r="1.3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-30 py-1 overflow-hidden">
          <Link
            href={`/stock/${entry.ticker}`}
            className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={close}
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Reopen analysis
          </Link>

          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => setMoveOpen((v) => !v)}
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H7m0 0l4-4m-4 4l4 4" />
            </svg>
            Move to group
            <svg className="w-3 h-3 ml-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {moveOpen && (
            <div className="border-t border-slate-100 bg-slate-50/60">
              {groups.filter((g) => g !== entry.groupName).map((g) => (
                <button
                  key={g}
                  onClick={() => { onGroupUpdate(g); close() }}
                  className="w-full text-left px-5 py-1.5 text-[12px] text-slate-600 hover:bg-white transition-colors"
                >
                  {g}
                </button>
              ))}
              {entry.groupName && (
                <button
                  onClick={() => { onGroupUpdate(null); close() }}
                  className="w-full text-left px-5 py-1.5 text-[12px] text-red-500 hover:bg-white transition-colors"
                >
                  Remove from group
                </button>
              )}
              <div className="px-3 py-1.5 flex gap-1.5 items-center">
                <input
                  type="text"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newGroup.trim()) { onGroupUpdate(newGroup.trim()); close() }
                    if (e.key === 'Escape') setMoveOpen(false)
                  }}
                  placeholder="New group…"
                  className="flex-1 text-[11px] border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 bg-white"
                  onClick={(e) => e.stopPropagation()}
                />
                {newGroup.trim() && (
                  <button
                    onClick={() => { onGroupUpdate(newGroup.trim()); close() }}
                    className="text-[11px] text-blue-600 font-semibold hover:text-blue-700 shrink-0"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => { onTagUpdate(cycleTag(entry.listTag)); close() }}
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Change tag
          </button>

          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              onClick={() => { onDelete(); close() }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sortable column header ────────────────────────────────────────────────────

function Th({ label, sortKey, current, dir, onSort, align = 'right' }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = current === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        'px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-600 transition-colors whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' ? 'justify-end' : 'justify-start')}>
        {label}
        <svg
          className={cn('w-3 h-3 transition-colors', active ? 'text-slate-600' : 'opacity-25')}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          {active && dir === 'asc' ? (
            <path d="M10 6l-4 4h8l-4-4z" />
          ) : active && dir === 'desc' ? (
            <path d="M10 14l4-4H6l4 4z" />
          ) : (
            <path d="M10 6l-4 4h8l-4-4zM10 14l4-4H6l4 4z" />
          )}
        </svg>
      </span>
    </th>
  )
}

// ── Main Table ────────────────────────────────────────────────────────────────

export function ValuationTable({ entries, sparklines, groups, onDelete, onTagUpdate, onGroupUpdate }: ValuationTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = sortEntries(entries, sortKey, sortDir)

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">No stocks in this group yet.</p>
        <p className="text-xs text-slate-300 mt-1">Use the ··· menu on any row to move stocks here.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <Th label="Ticker" sortKey="ticker" current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
              <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-left whitespace-nowrap">
                Tag
              </th>
              <th className="hidden sm:table-cell px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-center whitespace-nowrap">
                1M
              </th>
              <Th label="Price" sortKey="price" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">
                Fair Value
              </th>
              <Th label="Upside" sortKey="upsidePct" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="hidden md:table-cell px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap">
                Since Save
              </th>
              <Th label="Score" sortKey="overallScore" current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Updated" sortKey="updatedAt" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((entry) => {
              const prices = sparklines[entry.ticker]
              const sparkLoading = !(entry.ticker in sparklines)
              const up = prices && prices.length >= 2 ? prices[prices.length - 1] >= prices[0] : true

              return (
                <tr key={entry.ticker} className="hover:bg-slate-50/60 transition-colors group">
                  {/* Ticker + Company */}
                  <td className="px-3 py-3 min-w-[140px]">
                    <div className="flex items-center gap-2.5">
                      <StockLogo ticker={entry.ticker} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold font-mono text-slate-900 leading-none">{entry.ticker}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[110px]">{entry.companyName}</div>
                      </div>
                    </div>
                  </td>

                  {/* Tag */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <ListTagBadge
                      tag={entry.listTag}
                      onClick={() => onTagUpdate(entry.ticker, cycleTag(entry.listTag))}
                    />
                  </td>

                  {/* 1M Sparkline — hidden on mobile */}
                  <td className="hidden sm:table-cell px-3 py-3">
                    <div className="flex items-center justify-center" style={{ minWidth: 88 }}>
                      {sparkLoading ? (
                        <SparklineSkeleton width={88} height={32} />
                      ) : prices && prices.length >= 2 ? (
                        <Sparkline prices={prices} up={up} width={88} height={32} />
                      ) : (
                        <div className="flex items-center justify-center text-slate-200 text-[11px]" style={{ width: 88, height: 32 }}>—</div>
                      )}
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <span className="text-[13px] font-mono text-slate-700">
                      {fmtPrice(entry.snapshot.price, 'USD')}
                    </span>
                  </td>

                  {/* Fair Value */}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <span className="text-[13px] font-mono text-slate-500">
                      {fmtPrice(entry.snapshot.fairValue, 'USD')}
                    </span>
                  </td>

                  {/* Upside */}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        'text-[13px] font-mono font-semibold',
                        entry.snapshot.upsidePct == null
                          ? 'text-slate-300'
                          : entry.snapshot.upsidePct >= 0
                          ? 'text-emerald-600'
                          : 'text-red-500',
                      )}
                    >
                      {fmtPct(entry.snapshot.upsidePct)}
                    </span>
                  </td>

                  {/* Since Save — hidden on mobile */}
                  <td className="hidden md:table-cell px-3 py-3 text-right whitespace-nowrap">
                    {(() => {
                      const currentPrice = prices?.[prices.length - 1] ?? null
                      const savedPrice = entry.snapshot.price
                      if (currentPrice == null || savedPrice == null || savedPrice === 0 || sparkLoading) {
                        return <span className="text-slate-300 font-mono text-[12px]">—</span>
                      }
                      const delta = (currentPrice - savedPrice) / savedPrice
                      const priceRose = delta > 0
                      const isUndervalued = (entry.snapshot.upsidePct ?? 0) > 0
                      const towardFV = (isUndervalued && priceRose) || (!isUndervalued && !priceRose)
                      return (
                        <div className="text-right">
                          <span className={cn('text-[13px] font-mono font-semibold', priceRose ? 'text-emerald-600' : 'text-red-500')}>
                            {priceRose ? '+' : ''}{(delta * 100).toFixed(1)}% {priceRose ? '↗' : '↘'}
                          </span>
                          {entry.snapshot.upsidePct != null && (
                            <div className={cn('text-[10px] mt-0.5', towardFV ? 'text-emerald-500' : 'text-slate-400')}>
                              {towardFV ? '↑ Toward FV' : '↓ Away from FV'}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </td>

                  {/* Score */}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <ScoreCell score={entry.overallScore} />
                  </td>

                  {/* Updated */}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <span className="text-[12px] text-slate-400">{relativeDate(entry.updatedAt)}</span>
                  </td>

                  {/* Actions — always visible on touch */}
                  <td className="px-2 py-3">
                    <ActionsMenu
                      entry={entry}
                      groups={groups}
                      onDelete={() => onDelete(entry.ticker)}
                      onTagUpdate={(tag) => onTagUpdate(entry.ticker, tag)}
                      onGroupUpdate={(groupName) => onGroupUpdate(entry.ticker, groupName)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
