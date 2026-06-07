'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import {
  SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown,
  Search, RotateCcw, TrendingUp, ChevronDown,
} from 'lucide-react'
import type { ScreenerStock } from '@/app/api/screener/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = [
  'All Sectors',
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Communication Services',
  'Industrials',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
]

const CAP_TIERS = [
  { id: 'all',   label: 'All',   sub: '' },
  { id: 'mega',  label: 'Mega',  sub: '>$200B' },
  { id: 'large', label: 'Large', sub: '$10–200B' },
  { id: 'mid',   label: 'Mid',   sub: '$2–10B' },
  { id: 'small', label: 'Small', sub: '$300M–2B' },
]

const EXCHANGES = [
  { id: 'all',    label: 'NYSE + NASDAQ' },
  { id: 'NYSE',   label: 'NYSE only' },
  { id: 'NASDAQ', label: 'NASDAQ only' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'marketCap' | 'price' | 'beta' | 'dividendYield' | 'sector' | 'trailingPE'
type SortDir = 'asc' | 'desc'

interface Filters {
  sector: string
  capTier: string
  exchange: string
  dividendsOnly: boolean
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCap(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

function fmtPrice(v: number | null): string {
  if (v == null) return '—'
  return `$${v.toFixed(2)}`
}

function fmtBeta(v: number | null): string {
  if (v == null) return '—'
  return v.toFixed(2)
}

function fmtDiv(v: number | null): string {
  if (v == null || v <= 0) return '—'
  return `${(v * 100).toFixed(2)}%`
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-[#E3E1DA] animate-pulse" style={{ animationDelay: `${index * 30}ms` }}>
      <td className="sticky left-0 z-10 bg-white px-4 py-3.5 w-[220px]">
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 bg-[#E3E1DA] rounded w-14" />
          <div className="h-3 bg-[#F4F3EF] rounded w-28" />
        </div>
      </td>
      <td className="px-4 py-3.5"><div className="h-3.5 bg-[#F4F3EF] rounded w-20 ml-auto" /></td>
      <td className="px-4 py-3.5"><div className="h-3.5 bg-[#F4F3EF] rounded w-16 ml-auto" /></td>
      <td className="px-4 py-3.5 hidden sm:table-cell"><div className="h-3.5 bg-[#F4F3EF] rounded w-12 ml-auto" /></td>
      <td className="px-4 py-3.5 hidden sm:table-cell"><div className="h-3.5 bg-[#F4F3EF] rounded w-10 ml-auto" /></td>
      <td className="px-4 py-3.5 hidden md:table-cell"><div className="h-3.5 bg-[#F4F3EF] rounded w-12 ml-auto" /></td>
      <td className="px-4 py-3.5 hidden lg:table-cell"><div className="h-3.5 bg-[#F4F3EF] rounded w-24 ml-auto" /></td>
    </tr>
  )
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, active, dir, onClick, className,
}: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onClick: (k: SortKey) => void; className?: string
}) {
  return (
    <th
      className={`px-4 py-3 text-right text-[11px] font-semibold text-[#566174] whitespace-nowrap cursor-pointer select-none hover:text-[#06101F] transition-colors ${className ?? ''}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {active
          ? dir === 'desc'
            ? <ArrowDown size={11} className="text-olive-700 shrink-0" />
            : <ArrowUp size={11} className="text-olive-700 shrink-0" />
          : <ArrowUpDown size={10} className="text-[#8A95A6] shrink-0" />}
      </span>
    </th>
  )
}

// ─── Sector badge ─────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  'Technology':             'bg-[#EAF1FF] text-[#2563EB]',
  'Healthcare':             'bg-[#E8F7EF] text-[#11875D]',
  'Financial Services':     'bg-violet-50 text-violet-700',
  'Consumer Cyclical':      'bg-orange-50 text-orange-700',
  'Consumer Defensive':     'bg-[#FFF4DA] text-[#B56A00]',
  'Communication Services': 'bg-cyan-50 text-cyan-700',
  'Industrials':            'bg-[#F4F3EF] text-[#566174]',
  'Energy':                 'bg-[#FFF4DA] text-[#B56A00]',
  'Basic Materials':        'bg-lime-50 text-lime-700',
  'Real Estate':            'bg-rose-50 text-rose-700',
  'Utilities':              'bg-teal-50 text-teal-700',
}

function SectorBadge({ sector }: { sector: string | null }) {
  if (!sector) return <span className="text-[#8A95A6] text-[11px]">—</span>
  const cls = SECTOR_COLORS[sector] ?? 'bg-[#F4F3EF] text-[#566174]'
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {sector}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScreenerPage() {
  const router = useRouter()
  const reduced = useReducedMotion()

  const [stocks, setStocks]     = useState<ScreenerStock[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [searchQ, setSearchQ]   = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('marketCap')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')
  const [filters, setFilters]   = useState<Filters>({
    sector: 'All Sectors',
    capTier: 'all',
    exchange: 'all',
    dividendsOnly: false,
  })

  const abortRef = useRef<AbortController | null>(null)

  const fetchStocks = useCallback(async (f: Filters) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (f.sector !== 'All Sectors') params.set('sector', f.sector)
    if (f.capTier !== 'all')        params.set('capTier', f.capTier)
    if (f.exchange !== 'all')       params.set('exchange', f.exchange)
    if (f.dividendsOnly)            params.set('dividends', '1')

    try {
      const res = await fetch(`/api/screener?${params}`, {
        signal: abortRef.current.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `API error ${res.status}`)
      }
      const data: ScreenerStock[] = await res.json()
      setStocks(data)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load screener data.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort() }, [])

  // Initial load
  useEffect(() => { fetchStocks(filters) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filters change — skip first render (initial load above handles it)
  const isFirstFilterRender = useRef(true)
  const filterKey = JSON.stringify(filters)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (isFirstFilterRender.current) { isFirstFilterRender.current = false; return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchStocks(filters), 300)
    return () => clearTimeout(timerRef.current)
  }, [filterKey, fetchStocks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sort + filter client-side
  const displayed = useMemo(() => {
    let result = stocks
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase()
      result = result.filter(
        s => s.ticker.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q)
      )
    }
    return [...result].sort((a, b) => {
      let va: number | string | null
      let vb: number | string | null
      if (sortKey === 'name')           { va = a.name;          vb = b.name }
      else if (sortKey === 'sector')    { va = a.sector ?? '';  vb = b.sector ?? '' }
      else if (sortKey === 'marketCap') { va = a.marketCap;     vb = b.marketCap }
      else if (sortKey === 'price')     { va = a.price;         vb = b.price }
      else if (sortKey === 'beta')      { va = a.beta;          vb = b.beta }
      else if (sortKey === 'trailingPE'){ va = (a as any).trailingPE; vb = (b as any).trailingPE }
      else                              { va = a.dividendYield; vb = b.dividendYield }

      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      const na = va as number | null
      const nb = vb as number | null
      if (na == null && nb == null) return 0
      if (na == null) return 1
      if (nb == null) return -1
      return sortDir === 'asc' ? na - nb : nb - na
    })
  }, [stocks, searchQ, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function resetFilters() {
    setFilters({ sector: 'All Sectors', capTier: 'all', exchange: 'all', dividendsOnly: false })
    setSearchQ('')
  }

  const hasActiveFilters = filters.sector !== 'All Sectors' ||
    filters.capTier !== 'all' || filters.exchange !== 'all' || filters.dividendsOnly

  return (
    <div className="min-h-dvh" style={{ background: '#F4F3EF' }}>
      {/* Page header */}
      <div className="bg-white border-b border-[#E3E1DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-[#EAF1FF] flex items-center justify-center shrink-0">
                  <SlidersHorizontal size={14} className="text-olive-700" />
                </div>
                <h1 className="text-[22px] font-bold text-[#06101F] tracking-tight">Stock Screener</h1>
              </div>
              <p className="text-[13px] text-[#566174] ml-[36px]">
                Filter NYSE and NASDAQ stocks by sector, market cap, and dividend. Click any row to open the full analysis.
              </p>
            </div>
            {!loading && !error && (
              <div className="flex items-center gap-1.5 text-[12px] text-[#8A95A6] mt-1 shrink-0" aria-live="polite" aria-atomic="true">
                <TrendingUp size={13} />
                <span className="tabular-nums">{displayed.length.toLocaleString()} stocks</span>
                {searchQ || hasActiveFilters ? <span>· filtered</span> : <span>· NYSE + NASDAQ</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Filter bar ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm mb-5">
          <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">
            {/* Row 1: search + exchange */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-[280px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A95A6] pointer-events-none" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Ticker or name…"
                  aria-label="Search by ticker or company name"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  className="w-full pl-8 pr-3 py-2 text-[16px] border border-[#E3E1DA] rounded-lg bg-white text-[#06101F] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[rgba(95,121,11,0.25)] focus:border-transparent transition-shadow"
                />
              </div>

              {/* Exchange toggle */}
              <div className="flex rounded-lg overflow-hidden border border-[#E3E1DA] text-[12px] shrink-0">
                {EXCHANGES.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => setFilters(f => ({ ...f, exchange: ex.id }))}
                    className={`px-3 py-2.5 min-h-[44px] border-r border-[#E3E1DA] last:border-r-0 transition-colors whitespace-nowrap ${
                      filters.exchange === ex.id
                        ? 'bg-[#EAF1FF] text-olive-700 font-semibold'
                        : 'text-[#566174] hover:bg-[#F4F3EF]'
                    }`}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>

              {/* Dividend toggle */}
              <button
                onClick={() => setFilters(f => ({ ...f, dividendsOnly: !f.dividendsOnly }))}
                className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg border text-[12px] font-medium transition-colors shrink-0 ${
                  filters.dividendsOnly
                    ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]'
                    : 'bg-white border-[#E3E1DA] text-[#566174] hover:border-[#CDD1C8] hover:text-[#06101F]'
                }`}
                aria-pressed={filters.dividendsOnly}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${filters.dividendsOnly ? 'bg-[#E8F7EF]0' : 'bg-[#CDD1C8]'}`} />
                Dividends only
              </button>

              {/* Reset */}
              {(hasActiveFilters || searchQ) && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-[12px] text-[#8A95A6] hover:text-[#06101F] transition-colors px-1 shrink-0"
                  aria-label="Reset all filters"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>

            {/* Row 2: sector + cap tier */}
            <div className="flex items-start gap-4 flex-wrap">
              {/* Sector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-[#8A95A6]">Sector</span>
                <div className="relative">
                  <select
                    value={filters.sector}
                    onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}
                    aria-label="Filter by sector"
                    className="appearance-none pl-3 pr-8 py-2 text-[13px] border border-[#E3E1DA] rounded-lg bg-white text-[#06101F] focus:outline-none focus:ring-2 focus:ring-[rgba(95,121,11,0.25)] cursor-pointer min-w-[180px]"
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A95A6] pointer-events-none" />
                </div>
              </div>

              {/* Market cap tier */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-[#8A95A6]">Market Cap</span>
                <div className="flex rounded-lg overflow-hidden border border-[#E3E1DA]">
                  {CAP_TIERS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setFilters(f => ({ ...f, capTier: t.id }))}
                      title={t.sub || undefined}
                      className={`px-3 py-2.5 min-h-[44px] text-[12px] border-r border-[#E3E1DA] last:border-r-0 transition-colors whitespace-nowrap ${
                        filters.capTier === t.id
                          ? 'bg-[#EAF1FF] text-olive-700 font-semibold'
                          : 'text-[#566174] hover:bg-[#F4F3EF]'
                      }`}
                    >
                      {t.label}
                      {t.sub && <span className="hidden sm:inline text-[10px] text-current opacity-60 ml-1">{t.sub}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Results table ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm">

          {/* Error state */}
          {error && (
            <div className="px-5 py-12 text-center">
              <p className="text-[14px] font-medium text-[#06101F] mb-1">Screener unavailable</p>
              <p className="text-[13px] text-[#566174] mb-4">{error}</p>
              <button
                onClick={() => fetchStocks(filters)}
                className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-olive-700 text-white hover:bg-olive-600 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Table */}
          {!error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#E3E1DA] bg-[#F4F3EF]/60">
                    {/* Company — left-aligned, sticky */}
                    <th
                      className="sticky left-0 z-10 bg-[#F4F3EF] px-4 py-3 text-left text-[11px] font-semibold text-[#566174] w-[220px] min-w-[200px] cursor-pointer select-none hover:text-[#06101F] transition-colors"
                      onClick={() => toggleSort('name')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Company
                        {sortKey === 'name'
                          ? sortDir === 'desc' ? <ArrowDown size={11} className="text-olive-700" /> : <ArrowUp size={11} className="text-olive-700" />
                          : <ArrowUpDown size={10} className="text-[#8A95A6]" />}
                      </span>
                    </th>
                    <SortTh label="Market Cap" sortKey="marketCap" active={sortKey === 'marketCap'} dir={sortDir} onClick={toggleSort} />
                    <SortTh label="Price"      sortKey="price"     active={sortKey === 'price'}     dir={sortDir} onClick={toggleSort} className="hidden sm:table-cell" />
                    <SortTh label="P/E"        sortKey="trailingPE" active={sortKey === 'trailingPE'} dir={sortDir} onClick={toggleSort} className="hidden sm:table-cell" />
                    <SortTh label="Beta"       sortKey="beta"      active={sortKey === 'beta'}       dir={sortDir} onClick={toggleSort} className="hidden md:table-cell" />
                    <SortTh label="Div. Yield" sortKey="dividendYield" active={sortKey === 'dividendYield'} dir={sortDir} onClick={toggleSort} className="hidden md:table-cell" />
                    <SortTh label="Sector" sortKey="sector" active={sortKey === 'sector'} dir={sortDir} onClick={toggleSort} className="hidden lg:table-cell text-left" />
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 15 }).map((_, i) => (
                    <SkeletonRow key={i} index={i} />
                  ))}

                  {!loading && displayed.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <p className="text-[14px] font-medium text-[#06101F] mb-1">No stocks match your filters</p>
                        <p className="text-[13px] text-[#8A95A6] mb-4">Try broadening your sector, cap tier, or removing the dividend filter.</p>
                        <button
                          onClick={resetFilters}
                          className="text-[13px] font-semibold text-olive-700 hover:underline"
                        >
                          Reset filters
                        </button>
                      </td>
                    </tr>
                  )}

                  {!loading && (
                    <>
                      {displayed.map((stock, i) => (
                        <motion.tr
                          key={stock.ticker}
                          initial={reduced ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15, delay: Math.min(i * 0.012, 0.18) }}
                          className={`border-b border-[#E3E1DA] hover:bg-olive-50/60 cursor-pointer transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-olive-700 ${i % 2 === 1 ? 'bg-[#F4F3EF]/50' : ''}`}
                          onClick={() => router.push(`/stock/${stock.ticker}`)}
                          role="row"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/stock/${stock.ticker}`) } }}
                          aria-label={`${stock.name} (${stock.ticker}) — open full analysis`}
                        >
                      {/* Company */}
                      <td className="sticky left-0 z-10 bg-inherit group-hover:bg-olive-50/60 transition-colors px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-bold text-[#06101F] font-mono tracking-tight group-hover:text-olive-700 transition-colors">
                            {stock.ticker}
                          </span>
                          <span className="text-[11.5px] text-[#566174] truncate max-w-[170px]">
                            {stock.name}
                          </span>
                        </div>
                      </td>

                      {/* Market cap */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-mono text-[#06101F] tabular-nums">{fmtCap(stock.marketCap)}</span>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                        <span className="text-[13px] font-mono text-[#06101F] tabular-nums">{fmtPrice(stock.price)}</span>
                      </td>

                      {/* P/E */}
                      <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                        <span className={`text-[13px] font-mono tabular-nums ${
                          (stock as any).trailingPE == null ? 'text-[#8A95A6]' :
                          (stock as any).trailingPE > 40 ? 'text-orange-600' :
                          (stock as any).trailingPE < 15 ? 'text-[#11875D]' :
                          'text-[#06101F]'
                        }`}>
                          {(stock as any).trailingPE != null ? `${(stock as any).trailingPE.toFixed(1)}×` : '—'}
                        </span>
                      </td>

                      {/* Beta */}
                      <td className="px-4 py-3.5 text-right hidden md:table-cell">
                        <span className={`text-[13px] font-mono tabular-nums ${
                          stock.beta == null ? 'text-[#8A95A6]' :
                          stock.beta > 1.5 ? 'text-orange-600' :
                          stock.beta < 0.7 ? 'text-[#11875D]' :
                          'text-[#06101F]'
                        }`}>
                          {fmtBeta(stock.beta)}
                        </span>
                      </td>

                      {/* Dividend yield */}
                      <td className="px-4 py-3.5 text-right hidden md:table-cell">
                        <span className={`text-[13px] font-mono tabular-nums ${
                          stock.dividendYield != null && stock.dividendYield > 0
                            ? 'text-[#11875D] font-semibold'
                            : 'text-[#8A95A6]'
                        }`}>
                          {fmtDiv(stock.dividendYield)}
                        </span>
                      </td>

                      {/* Sector */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <SectorBadge sector={stock.sector} />
                      </td>
                    </motion.tr>
                  ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer */}
          {!loading && !error && displayed.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[#E3E1DA] flex items-center justify-between">
              <p className="text-[11px] text-[#8A95A6]">
                {displayed.length.toLocaleString()} result{displayed.length !== 1 ? 's' : ''} · Click a row to open the full valuation analysis
              </p>
              <p className="text-[11px] text-[#8A95A6]">Source: FMP · Data refreshed every 30 minutes</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
