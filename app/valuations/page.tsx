'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import {
  Bookmark, TrendingUp, CheckCircle, Clock,
  List, LayoutGrid, Search, ChevronDown, SlidersHorizontal,
  Plus, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { loadWatchlist, saveWatchlistEntry, deleteWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'
import { fmtPct } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ValuationTable, type SortKey } from '@/components/valuations/ValuationTable'

// ── Types ──────────────────────────────────────────────────────────────────────

type TabId    = 'all' | 'watch' | 'buy' | 'pass' | 'recent'
type ViewMode = 'table' | 'grid'
type FilterUpside     = 'all' | 'undervalued' | 'fair' | 'overvalued'
type FilterConfidence = 'all' | 'high' | 'medium' | 'low'

// ── Derivation helpers ─────────────────────────────────────────────────────────

function getVerdict(e: WatchlistEntry): 'Undervalued' | 'Fair Value' | 'Overvalued' | 'Needs Review' {
  if (e.snapshot.fairValue == null || e.snapshot.upsidePct == null) return 'Needs Review'
  if (e.snapshot.upsidePct > 0.15)  return 'Undervalued'
  if (e.snapshot.upsidePct > -0.15) return 'Fair Value'
  return 'Overvalued'
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function tabFilter(entries: WatchlistEntry[], tab: TabId): WatchlistEntry[] {
  if (tab === 'watch')  return entries.filter((e) => e.listTag === 'watch')
  if (tab === 'buy')    return entries.filter((e) => e.listTag === 'buy')
  if (tab === 'pass')   return entries.filter((e) => e.listTag === 'pass')
  if (tab === 'recent') return entries.filter((e) => daysSince(e.updatedAt) <= 7)
  return entries
}

function applyFilters(
  entries: WatchlistEntry[],
  query: string,
  upside: FilterUpside,
  confidence: FilterConfidence,
): WatchlistEntry[] {
  let res = entries
  if (query.trim()) {
    const q = query.toLowerCase()
    res = res.filter((e) => e.ticker.toLowerCase().includes(q) || e.companyName.toLowerCase().includes(q))
  }
  if (upside === 'undervalued')  res = res.filter((e) => (e.snapshot.upsidePct ?? 0) > 0.15)
  if (upside === 'fair')         res = res.filter((e) => { const u = e.snapshot.upsidePct ?? null; return u != null && u >= -0.15 && u <= 0.15 })
  if (upside === 'overvalued')   res = res.filter((e) => (e.snapshot.upsidePct ?? 0) < -0.15)
  if (confidence === 'high')     res = res.filter((e) => e.overallScore != null && e.overallScore >= 0.7)
  if (confidence === 'medium')   res = res.filter((e) => e.overallScore != null && e.overallScore >= 0.4 && e.overallScore < 0.7)
  if (confidence === 'low')      res = res.filter((e) => e.overallScore != null && e.overallScore < 0.4)
  return res
}

function sortEntries(entries: WatchlistEntry[], key: SortKey, dir: 'asc' | 'desc'): WatchlistEntry[] {
  return [...entries].sort((a, b) => {
    let va: string | number, vb: string | number
    switch (key) {
      case 'ticker':       va = a.ticker;                           vb = b.ticker;                           break
      case 'upsidePct':    va = a.snapshot.upsidePct ?? -Infinity;  vb = b.snapshot.upsidePct ?? -Infinity;  break
      case 'overallScore': va = a.overallScore ?? -Infinity;        vb = b.overallScore ?? -Infinity;        break
      case 'price':        va = a.snapshot.price ?? -Infinity;      vb = b.snapshot.price ?? -Infinity;      break
      case 'fairValue':    va = a.snapshot.fairValue ?? -Infinity;  vb = b.snapshot.fairValue ?? -Infinity;  break
      case 'updatedAt':    va = a.updatedAt;                        vb = b.updatedAt;                        break
    }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ?  1 : -1
    return 0
  })
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, iconCls, label, value, sub }: {
  icon:    React.ElementType
  iconCls: string
  label:   string
  value:   string | number
  sub?:    string
}) {
  return (
    <div className="bg-white border border-[#E6ECF5] rounded-2xl p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconCls)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-slate-600 mb-0.5">{label}</p>
        <p className="text-[26px] font-extrabold text-[#0F172A] leading-none tabular-nums">{value}</p>
        {sub && <p className="text-[12px] text-slate-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ── Segment Tabs ───────────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'all',    label: 'All' },
  { id: 'watch',  label: 'Watch' },
  { id: 'buy',    label: 'High Conviction' },
  { id: 'pass',   label: 'Avoid' },
  { id: 'recent', label: 'Recently Updated' },
]

function SegmentTabs({ active, counts, onSelect }: {
  active:   TabId
  counts:   Record<TabId, number>
  onSelect: (id: TabId) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Valuation lists"
      className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-b border-[#E6ECF5]"
    >
      {TABS.map(({ id, label }) => {
        const isActive = active === id
        const count    = counts[id]
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors',
              isActive
                ? 'text-[#2563EB] border-[#2563EB]'
                : 'text-[#475569] border-transparent hover:text-slate-800 hover:border-slate-300',
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
                isActive ? 'bg-olive-100 text-olive-700' : 'bg-slate-100 text-slate-600',
              )}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Filter Select ──────────────────────────────────────────────────────────────

function FilterSelect({ label, value, options, onChange }: {
  label:    string
  value:    string
  options:  Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-2 text-[12px] font-semibold text-[#334155] bg-white border border-[#DDE6F2] rounded-xl cursor-pointer hover:border-blue-300 focus:outline-none focus:border-blue-400 transition-colors min-h-[40px]"
        style={{ fontSize: '16px' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{label}: {o.label}</option>
        ))}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}

// ── Sort Dropdown ──────────────────────────────────────────────────────────────

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'updatedAt',    label: 'Updated' },
  { key: 'upsidePct',    label: 'Upside' },
  { key: 'fairValue',    label: 'Fair value' },
  { key: 'overallScore', label: 'Confidence' },
  { key: 'ticker',       label: 'Ticker' },
  { key: 'price',        label: 'Price' },
]

function SortDropdown({ current, dir, onSort }: {
  current: SortKey
  dir:     'asc' | 'desc'
  onSort:  (key: SortKey, dir: 'asc' | 'desc') => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentLabel = SORT_OPTIONS.find((o) => o.key === current)?.label ?? 'Updated'

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 text-[12px] font-semibold text-[#334155] bg-white border border-[#DDE6F2] rounded-xl hover:border-blue-300 transition-colors min-h-[40px]"
      >
        Sort: {currentLabel}
        <ChevronDown size={12} className="text-slate-400" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Sort by"
          className="absolute right-0 top-9 w-44 bg-white rounded-xl border border-slate-200 shadow-lg z-20 py-1 overflow-hidden"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              role="option"
              aria-selected={current === key}
              onClick={() => {
                onSort(key, key === current && dir === 'desc' ? 'asc' : 'desc')
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between px-3.5 py-2 text-[13px] transition-colors',
                current === key ? 'text-olive-700 bg-olive-50 font-semibold' : 'text-slate-700 hover:bg-slate-50',
              )}
            >
              {label}
              {current === key && (
                <span className="text-[11px] text-blue-600">{dir === 'desc' ? '↓' : '↑'}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Grid Card ──────────────────────────────────────────────────────────────────

function GridCard({ entry }: { entry: WatchlistEntry }) {
  const verdict     = getVerdict(entry)
  const upside      = entry.snapshot.upsidePct
  const verdictCls  = verdict === 'Undervalued'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : verdict === 'Overvalued'
    ? 'bg-red-50 text-red-600 border-red-200'
    : verdict === 'Needs Review'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <div className="bg-white border border-[#E6ECF5] rounded-2xl p-5 flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/stock/${entry.ticker}`} className="text-[15px] font-black text-slate-900 font-mono hover:text-blue-600 transition-colors">
            {entry.ticker}
          </Link>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{entry.companyName}</p>
        </div>
        <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border shrink-0', verdictCls)}>
          {verdict}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-slate-500 font-semibold mb-1">Price</p>
          <p className="text-[13px] font-bold text-slate-800 tabular-nums">
            {entry.snapshot.price != null ? `$${entry.snapshot.price.toFixed(2)}` : '—'}
          </p>
        </div>
        <div className={cn('rounded-xl px-3 py-2.5', upside != null ? (upside >= 0 ? 'bg-emerald-50' : 'bg-red-50') : 'bg-slate-50')}>
          <p className="text-[11px] text-slate-500 font-semibold mb-1">Fair Value</p>
          <p className={cn('text-[13px] font-bold tabular-nums', upside != null ? (upside >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400')}>
            {entry.snapshot.fairValue != null ? `$${entry.snapshot.fairValue.toFixed(2)}` : '—'}
          </p>
        </div>
      </div>

      {upside != null && (
        <p className={cn('text-[13px] font-bold tabular-nums', upside >= 0 ? 'text-emerald-600' : 'text-red-500')}>
          {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}% {upside >= 0 ? '↗' : '↘'}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
        <span className="text-[10px] text-slate-400">
          {new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
        <Link href={`/stock/${entry.ticker}`} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
          Reopen →
        </Link>
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────

const GHOST_ENTRIES = [
  { ticker: 'AAPL', company: 'Apple Inc.', price: '$189', fair: '$204', upside: '+7.8%', verdict: 'Undervalued', upCls: 'text-emerald-600', verdictCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { ticker: 'NVDA', company: 'NVIDIA Corp.', price: '$875', fair: '$652', upside: '−25.4%', verdict: 'Overvalued', upCls: 'text-red-500', verdictCls: 'bg-red-50 text-red-600 border-red-200' },
  { ticker: 'MSFT', company: 'Microsoft Corp.', price: '$412', fair: '$440', upside: '+6.8%', verdict: 'Undervalued', upCls: 'text-emerald-600', verdictCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white border border-[#E6ECF5] overflow-hidden">
      {/* Ghost preview */}
      <div className="px-5 pt-6 pb-4 border-b border-[#F1F5F9]">
        <p className="text-[11px] font-semibold text-slate-400 mb-3">
          Your list will look like this
        </p>
        <div className="space-y-2 opacity-40 pointer-events-none select-none">
          {GHOST_ENTRIES.map((g) => (
            <div
              key={g.ticker}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 font-mono shrink-0">
                  {g.ticker}
                </span>
                <span className="text-[13px] text-slate-700 truncate">{g.company}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[12px] text-slate-500 tabular-nums hidden sm:block">{g.price}</span>
                <span className="text-[13px] font-bold tabular-nums text-slate-800 hidden sm:block">{g.fair}</span>
                <span className={`text-[12px] font-bold tabular-nums ${g.upCls}`}>{g.upside}</span>
                <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border hidden sm:inline ${g.verdictCls}`}>
                  {g.verdict}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activation steps + CTAs */}
      <div className="px-5 py-6 sm:px-8 sm:py-8 flex flex-col items-center text-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Bookmark size={20} className="text-blue-500" />
        </div>

        <div>
          <h2 className="text-[17px] font-bold text-[#0F172A]">No saved valuations yet</h2>
          <p className="text-[13px] text-slate-500 mt-1 max-w-xs leading-relaxed">
            Analyze a stock, then save the result to track fair value and upside over time.
          </p>
        </div>

        {/* 3-step activation path */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-0 sm:gap-0 w-full max-w-sm">
          {[
            { n: '1', label: 'Search a stock', sub: 'any ticker on NYSE or NASDAQ' },
            { n: '2', label: 'Review the model', sub: 'fair value, scenarios, quality' },
            { n: '3', label: 'Save to this list', sub: 'tracks over time as prices move' },
          ].map((step, i) => (
            <div key={step.n} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-1.5 flex-1 relative py-2 sm:py-0">
              {i < 2 && (
                <div className="hidden sm:block absolute top-4 left-[calc(50%+12px)] right-0 h-px bg-slate-200" />
              )}
              <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 z-10">
                <span className="text-[11px] font-bold text-blue-600">{step.n}</span>
              </div>
              <div className="sm:text-center">
                <p className="text-[12px] font-semibold text-slate-800 leading-tight">{step.label}</p>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/analyze"
            className="w-full sm:w-auto rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-6 py-3 text-[14px] font-semibold transition-colors min-h-[48px] flex items-center justify-center"
          >
            Analyze a stock
          </Link>
          <Link
            href="/markets"
            className="w-full sm:w-auto rounded-xl border border-[#DDE6F2] text-[#334155] hover:bg-slate-50 px-6 py-3 text-[14px] font-semibold transition-colors min-h-[48px] flex items-center justify-center"
          >
            Explore popular analyses
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function Pagination({ total, page, pageSize, onPage, onPageSize }: {
  total:      number
  page:       number
  pageSize:   number
  onPage:     (p: number) => void
  onPageSize: (s: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  const start      = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end        = Math.min(page * pageSize, total)

  if (total === 0) return null

  const pages: number[] = []
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else if (page <= 3) {
    for (let i = 1; i <= 5; i++) pages.push(i)
  } else if (page >= totalPages - 2) {
    for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
  } else {
    for (let i = page - 2; i <= page + 2; i++) pages.push(i)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-1">
      <p className="text-[12px] text-[#64748B]">
        Showing {start} to {end} of {total} results
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#DDE6F2] text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={cn(
              'min-w-[44px] h-[44px] rounded-lg text-[12px] font-semibold border transition-colors',
              p === page
                ? 'bg-[#2563EB] border-[#2563EB] text-white'
                : 'border-[#DDE6F2] text-[#334155] hover:bg-slate-50',
            )}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#DDE6F2] text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] text-slate-500">Rows:</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => { onPageSize(Number(e.target.value)); onPage(1) }}
            className="appearance-none pl-2.5 pr-6 py-1 text-[12px] font-semibold text-[#334155] bg-white border border-[#DDE6F2] rounded-lg cursor-pointer focus:outline-none"
            style={{ fontSize: '16px' }}
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}

// ── Login Wall ─────────────────────────────────────────────────────────────────

function LoginWall() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-[#E6ECF5] rounded-2xl shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-olive-100 border border-olive-100 flex items-center justify-center">
          <Bookmark size={24} className="text-olive-700" />
        </div>
        <h1 className="text-[22px] font-extrabold text-[#0F172A] tracking-tight">My Valuations</h1>
        <p className="mt-2 text-[14px] text-slate-500 leading-relaxed max-w-xs mx-auto">
          Your saved analyses and watchlist are private. Sign in to access your personal workspace.
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/valuations' })}
          className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl bg-olive-700 hover:bg-olive-600 text-white py-3 px-4 text-[14px] font-semibold transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" fillOpacity=".9"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity=".8"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff" fillOpacity=".7"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity=".85"/>
          </svg>
          Continue with Google
        </button>
        <p className="mt-4 text-[12px] text-slate-400">Free during beta · No credit card required</p>
      </div>
    </div>
  )
}

// ── Page content (authenticated only) ─────────────────────────────────────────

function ValuationsPageContent({ userEmail }: { userEmail: string }) {
  const [entries,    setEntries]    = useState<WatchlistEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})

  // UI state
  const [activeTab,         setActiveTab]         = useState<TabId>('all')
  const [view,              setView]              = useState<ViewMode>('table')
  const [searchQuery,       setSearch]            = useState('')
  const [sortKey,           setSortKey]           = useState<SortKey>('updatedAt')
  const [sortDir,           setSortDir]           = useState<'asc' | 'desc'>('desc')
  const [filterUpside,      setFilterUpside]      = useState<FilterUpside>('all')
  const [filterConfidence,  setFilterConfidence]  = useState<FilterConfidence>('all')
  const [currentPage,       setCurrentPage]       = useState(1)
  const [pageSize,          setPageSize]          = useState(10)
  const [pendingGroups,     setPendingGroups]     = useState<string[]>([])
  const [groupInputOpen,    setGroupInputOpen]    = useState(false)
  const [groupInputValue,   setGroupInputValue]   = useState('')
  // Load data
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

  // KPI calculations
  const kpi = useMemo(() => {
    const tracked    = entries.length
    const withUpside = entries.filter((e) => e.snapshot.upsidePct != null)
    const avgUpside  = withUpside.length > 0
      ? withUpside.reduce((s, e) => s + (e.snapshot.upsidePct ?? 0), 0) / withUpside.length
      : null
    const undervalued = entries.filter((e) => (e.snapshot.upsidePct ?? 0) > 0.15).length
    const needsReview = entries.filter((e) => e.snapshot.fairValue == null || e.snapshot.upsidePct == null).length
    return { tracked, avgUpside, undervalued, needsReview }
  }, [entries])

  // Tab counts
  const tabCounts: Record<TabId, number> = useMemo(() => ({
    all:    entries.length,
    watch:  entries.filter((e) => e.listTag === 'watch').length,
    buy:    entries.filter((e) => e.listTag === 'buy').length,
    pass:   entries.filter((e) => e.listTag === 'pass').length,
    recent: entries.filter((e) => daysSince(e.updatedAt) <= 7).length,
  }), [entries])

  // Filter pipeline
  const displayEntries = useMemo(() => {
    const tabbed   = tabFilter(entries, activeTab)
    const filtered = applyFilters(tabbed, searchQuery, filterUpside, filterConfidence)
    return sortEntries(filtered, sortKey, sortDir)
  }, [entries, activeTab, searchQuery, filterUpside, filterConfidence, sortKey, sortDir])

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return displayEntries.slice(start, start + pageSize)
  }, [displayEntries, currentPage, pageSize])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [activeTab, searchQuery, filterUpside, filterConfidence, sortKey, sortDir])

  // Derived groups
  const derivedGroups = Array.from(new Set(entries.map((e) => e.groupName).filter((g): g is string => !!g)))
  const allGroups     = Array.from(new Set([...derivedGroups, ...pendingGroups]))

  // Handlers
  const handleDelete = async (ticker: string) => {
    await deleteWatchlistEntry(ticker, userEmail)
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker))
  }

  const handleTagUpdate = async (ticker: string, tag: ListTag) => {
    setEntries((prev) => prev.map((e) => e.ticker === ticker ? { ...e, listTag: tag } : e))
    const entry = entries.find((e) => e.ticker === ticker)
    if (entry) await saveWatchlistEntry({ ...entry, listTag: tag }, userEmail)
  }

  const handleGroupUpdate = async (ticker: string, groupName: string | null) => {
    setEntries((prev) => prev.map((e) => e.ticker === ticker ? { ...e, groupName: groupName ?? undefined } : e))
    if (groupName) setPendingGroups((prev) => prev.filter((g) => g !== groupName))
    const entry = entries.find((e) => e.ticker === ticker)
    if (entry) await saveWatchlistEntry({ ...entry, groupName: groupName ?? undefined }, userEmail)
  }

  const handleNoteSave = useCallback(async (ticker: string, note: string) => {
    const entry = entries.find((e) => e.ticker === ticker)
    if (!entry) return
    const updated = { ...entry, notes: { ...entry.notes, '__thesis__': note } }
    setEntries((prev) => prev.map((e) => e.ticker === ticker ? updated : e))
    await saveWatchlistEntry(updated, userEmail)
  }, [entries, userEmail])

  const handleSort = (key: SortKey, dir?: 'asc' | 'desc') => {
    if (dir) { setSortKey(key); setSortDir(dir) }
    else {
      if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else { setSortKey(key); setSortDir('desc') }
    }
  }

  const hasFilters = filterUpside !== 'all' || filterConfidence !== 'all' || !!searchQuery.trim()

  return (
    <div className="min-h-dvh bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0F172A] tracking-tight leading-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            My Valuations
          </h1>
          <p className="mt-1.5 text-[14px] text-slate-500">Saved analyses and watchlist ideas</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            onClick={() => setView('table')}
            title="Table view"
            aria-label="Table view"
            className={cn('p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center', view === 'table' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-400 hover:text-slate-600')}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setView('grid')}
            title="Grid view"
            aria-label="Grid view"
            className={cn('p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center', view === 'grid' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-400 hover:text-slate-600')}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* KPI cards — own row, not nested inside the header */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            icon={Bookmark}
            iconCls="bg-blue-50 text-blue-600"
            label="Tracked"
            value={kpi.tracked}
            sub="companies"
          />
          <KpiCard
            icon={TrendingUp}
            iconCls={kpi.avgUpside != null && kpi.avgUpside >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
            label="Avg Upside"
            value={kpi.avgUpside != null ? fmtPct(kpi.avgUpside) : '—'}
            sub="across all"
          />
          <KpiCard
            icon={CheckCircle}
            iconCls="bg-emerald-50 text-emerald-600"
            label="Undervalued"
            value={kpi.undervalued}
            sub="companies"
          />
          <KpiCard
            icon={Clock}
            iconCls="bg-amber-50 text-amber-600"
            label="Needs Review"
            value={kpi.needsReview}
            sub={kpi.needsReview === 0 ? 'all valuations complete' : 'missing fair value data'}
          />
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white border border-[#E6ECF5] rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-white border border-[#E6ECF5] rounded-2xl animate-pulse" />
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && <EmptyState />}

      {/* Content */}
      {!loading && entries.length > 0 && (
        <div className="space-y-5">

          {/* Toolbar */}
          <div className="bg-white border border-[#E6ECF5] rounded-2xl overflow-hidden shadow-sm">
            {/* Segment tabs */}
            <div className="flex items-center justify-between gap-2 px-4 pt-1">
              <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                <SegmentTabs active={activeTab} counts={tabCounts} onSelect={setActiveTab} />
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {groupInputOpen ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const name = groupInputValue.trim()
                      if (name && !allGroups.includes(name)) setPendingGroups((prev) => [...prev, name])
                      setGroupInputValue('')
                      setGroupInputOpen(false)
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={groupInputValue}
                      onChange={(e) => setGroupInputValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setGroupInputOpen(false); setGroupInputValue('') } }}
                      placeholder="Group name"
                      className="w-32 px-2.5 py-1.5 text-[12px] text-slate-800 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                      style={{ fontSize: '16px' }}
                    />
                    <button type="submit" className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-1.5 min-h-[34px]">Add</button>
                    <button type="button" onClick={() => { setGroupInputOpen(false); setGroupInputValue('') }} className="text-[12px] text-slate-400 hover:text-slate-600 px-1.5 py-1.5 min-h-[34px]">Cancel</button>
                  </form>
                ) : (
                  <button
                    onClick={() => setGroupInputOpen(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-[#2563EB] border border-dashed border-blue-300 bg-white hover:bg-blue-50 rounded-xl transition-colors whitespace-nowrap min-h-[40px]"
                  >
                    <Plus size={13} />
                    New group
                  </button>
                )}
              </div>
            </div>

            {/* Search + Sort + Filters */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 px-4 py-3 border-t border-[#EDF2F7]">
              <div className="relative flex-1 min-w-0 sm:min-w-[180px] sm:max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search valuations…"
                  className="w-full pl-8 pr-3 py-1.5 text-[16px] text-slate-800 bg-white border border-[#DDE6F2] rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder-slate-400"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap overflow-x-auto scrollbar-hide pb-0.5">
                <SortDropdown current={sortKey} dir={sortDir} onSort={handleSort} />
                <FilterSelect
                  label="Upside"
                  value={filterUpside}
                  options={[
                    { value: 'all',         label: 'Any' },
                    { value: 'undervalued', label: 'Undervalued (>15%)' },
                    { value: 'fair',        label: 'Fair Value (±15%)' },
                    { value: 'overvalued',  label: 'Overvalued (<−15%)' },
                  ]}
                  onChange={(v) => setFilterUpside(v as FilterUpside)}
                />
                <FilterSelect
                  label="Confidence"
                  value={filterConfidence}
                  options={[
                    { value: 'all',    label: 'Any' },
                    { value: 'high',   label: 'High (≥70%)' },
                    { value: 'medium', label: 'Medium (40–70%)' },
                    { value: 'low',    label: 'Low (<40%)' },
                  ]}
                  onChange={(v) => setFilterConfidence(v as FilterConfidence)}
                />
                <button
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border rounded-xl transition-colors min-h-[40px]',
                    hasFilters
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-[#DDE6F2] text-[#334155] hover:border-blue-300',
                  )}
                  onClick={() => { setFilterUpside('all'); setFilterConfidence('all'); setSearch('') }}
                  title={hasFilters ? 'Clear all filters' : 'Filters'}
                >
                  <SlidersHorizontal size={13} />
                  {hasFilters ? 'Clear filters' : 'Filters'}
                </button>
              </div>
            </div>
          </div>

          {/* Table or Grid */}
          {view === 'table' ? (
            <ValuationTable
              entries={paginatedEntries}
              sparklines={sparklines}
              groups={allGroups}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onDelete={handleDelete}
              onTagUpdate={handleTagUpdate}
              onGroupUpdate={handleGroupUpdate}
              onNoteSave={handleNoteSave}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedEntries.map((entry) => (
                <GridCard key={entry.ticker} entry={entry} />
              ))}
              {paginatedEntries.length === 0 && (
                <div className="col-span-full bg-white border border-[#E6ECF5] rounded-2xl p-10 text-center">
                  <p className="text-[14px] text-slate-500">No valuations match your filters.</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            total={displayEntries.length}
            page={currentPage}
            pageSize={pageSize}
            onPage={setCurrentPage}
            onPageSize={setPageSize}
          />
        </div>
      )}
    </div>
  )
}

// ── Auth-gating wrapper ────────────────────────────────────────────────────────

export default function ValuationsPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-4">
          <div className="h-10 w-48 bg-white border border-[#E6ECF5] rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white border border-[#E6ECF5] rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-white border border-[#E6ECF5] rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session?.user?.email) {
    return <LoginWall />
  }

  return <ValuationsPageContent userEmail={session.user.email} />
}
