'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  Search, Bookmark, ChevronRight,
  Clock, Info, X, BarChart3,
} from 'lucide-react'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import { fmtPrice, fmtPct, upsideZone } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { slideDown, fadeUp } from '@/lib/motion'
import type { FeaturedQuote } from '@/app/api/analyze/quotes/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchange?: string
  quoteType?: string
}

interface RecentItem {
  ticker: string
  name: string
  price: number
  changePct: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POPULAR_CHIPS = ['NVDA', 'MELI', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'TSLA', 'AMD', 'PLTR']

function statusBadge(zone: string | null): { label: string; cls: string } | null {
  if (!zone) return null
  if (zone.toLowerCase().includes('under'))
    return { label: zone, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (zone.toLowerCase().includes('fair'))
    return { label: zone, cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: zone, cls: 'bg-red-50 text-red-600 border-red-200' }
}

function expectationCls(exp: string) {
  if (exp === 'Conservative') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (exp === 'Moderate')     return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

function cagrBarColor(pct: number, type: 'implied' | 'historical') {
  if (type === 'historical') return 'bg-blue-400'
  if (pct <= 15) return 'bg-emerald-500'
  if (pct <= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

const BAR_SCALE = 2.2

// ─── Static baseline data (mirrors API route; live prices overlay on top) ─────

const STATIC_QUOTES: FeaturedQuote[] = [
  { ticker: 'AAPL', name: 'Apple Inc.',               etfSource: 'SPY', fairValue: null, impliedCagr: 6.2,  historicalCagr3y: 8.0,  expectation: 'Moderate',     interpretation: 'Growth expectations are fully priced in.',                  sparkData: [168, 172, 169, 175, 178, 174, 180, 179], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'NVDA', name: 'NVIDIA Corporation',       etfSource: 'SPY', fairValue: null, impliedCagr: 45.4, historicalCagr3y: 60.0, expectation: 'Aggressive',    interpretation: 'Market expects extreme AI-driven growth to continue.',      sparkData: [78,  85,  92,  88,  105, 115, 108, 118], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'MSFT', name: 'Microsoft Corporation',    etfSource: 'SPY', fairValue: null, impliedCagr: 12.1, historicalCagr3y: 14.0, expectation: 'Moderate',     interpretation: 'Expectations are reasonable for a mature compounder.',     sparkData: [380, 392, 405, 398, 410, 415, 412, 416], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.',         etfSource: 'QQQ', fairValue: null, impliedCagr: 9.8,  historicalCagr3y: 11.0, expectation: 'Moderate',     interpretation: 'AWS + ads make expectations look achievable.',              sparkData: [168, 175, 172, 180, 185, 182, 187, 186], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'META', name: 'Meta Platforms, Inc.',     etfSource: 'QQQ', fairValue: null, impliedCagr: 16.5, historicalCagr3y: 28.0, expectation: 'Moderate',     interpretation: 'Market prices in continued ad and AI-driven growth.',       sparkData: [420, 440, 462, 448, 490, 515, 538, 552], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'TSLA', name: 'Tesla, Inc.',              etfSource: 'QQQ', fairValue: null, impliedCagr: 25.0, historicalCagr3y: 9.0,  expectation: 'Aggressive',   interpretation: 'Market expects a strong robotaxi/energy acceleration.',     sparkData: [175, 182, 195, 188, 205, 215, 208, 220], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'UNH',  name: 'UnitedHealth Group Inc.',  etfSource: 'DIA', fairValue: null, impliedCagr: 5.8,  historicalCagr3y: 12.0, expectation: 'Conservative', interpretation: 'Market prices in a significant slowdown from peak growth.', sparkData: [530, 490, 455, 420, 380, 345, 315, 330], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'GS',   name: 'Goldman Sachs Group, Inc.',etfSource: 'DIA', fairValue: null, impliedCagr: 6.2,  historicalCagr3y: 9.0,  expectation: 'Conservative', interpretation: 'Market prices in steady investment banking earnings.',       sparkData: [375, 400, 420, 440, 465, 492, 512, 538], price: null, change: null, changePct: null, upsidePct: null },
  { ticker: 'HD',   name: 'Home Depot, Inc.',         etfSource: 'DIA', fairValue: null, impliedCagr: 5.5,  historicalCagr3y: 4.0,  expectation: 'Conservative', interpretation: 'Market prices in modest recovery as housing improves.',     sparkData: [318, 332, 340, 328, 348, 360, 362, 368], price: null, change: null, changePct: null, upsidePct: null },
]

// ─── Search Hero ──────────────────────────────────────────────────────────────

function SearchHero() {
  const router = useRouter()
  const reduced = useReducedMotion()

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d: SearchResult[]) => { setResults(d); setOpen(d.length > 0); setLoading(false) })
        .catch(() => setLoading(false))
    }, 300)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = useCallback((symbol: string) => {
    setOpen(false); setQuery(''); router.push(`/stock/${symbol}`)
  }, [router])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase())
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-5 sm:px-8 sm:py-6">
      {/* Headline + subtitle as a tight unit */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 leading-snug tracking-tight">
          What do you want to analyze today?
        </h1>
        <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">
          Search any company to see intrinsic value, market-implied growth, business quality, and valuation risk.
        </p>
      </div>

      {/* Search input */}
      <div className="relative" ref={searchRef}>
        <div className={cn(
          'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all bg-white',
          open || query
            ? 'border-blue-400 ring-2 ring-blue-100'
            : 'border-slate-200 hover:border-slate-300',
        )}>
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 shrink-0" />
          ) : (
            <Search size={15} className="text-slate-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            id="analyze-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search ticker or company name, e.g. NVDA, MercadoLibre…"
            className="flex-1 min-w-0 bg-transparent text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={() => query.trim() && select(query.trim().toUpperCase())}
            className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all px-4 py-1.5 text-[13px] font-semibold text-white"
          >
            Find analysis
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key="analyze-search-drop"
              variants={reduced ? {} : slideDown}
              initial="hidden" animate="visible" exit="exit"
              style={{ originY: 0 }}
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden max-h-72 overflow-y-auto"
            >
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold text-slate-800 font-mono">{r.symbol}</span>
                      {r.exchange && <span className="text-[10px] text-slate-400 uppercase">{r.exchange}</span>}
                    </div>
                    <span className="text-[12px] text-slate-500 truncate block">{r.longname ?? r.shortname}</span>
                  </div>
                  {r.quoteType && (
                    <span className="shrink-0 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                      {r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType}
                    </span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Popular ticker chips */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide shrink-0 mr-0.5">Popular:</span>
        {POPULAR_CHIPS.map((t) => (
          <Link
            key={t}
            href={`/stock/${t}`}
            className="text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 rounded-full px-3 py-0.5 transition-colors whitespace-nowrap"
          >
            {t}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Stock Analysis Card ──────────────────────────────────────────────────────

function StockAnalysisCard({ q, index }: { q: FeaturedQuote; index: number }) {
  const up     = (q.changePct ?? 0) >= 0
  const zone   = q.upsidePct != null ? upsideZone(q.upsidePct) : null
  const badge  = statusBadge(zone)
  const reduced = useReducedMotion()

  return (
    <motion.div
      variants={reduced ? {} : fadeUp}
      custom={index}
      transition={{ delay: index * 0.06 }}
      className="h-full"
    >
      <Link
        href={`/stock/${q.ticker}`}
        className="group flex flex-col h-full rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-150 overflow-hidden"
      >
        {/* Row 1: ticker + ETF badge | status badge */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 font-mono leading-tight">
              {q.ticker}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 uppercase tracking-wide leading-tight">
              {q.etfSource}
            </span>
          </div>
          {badge && (
            <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap shrink-0', badge.cls)}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Row 2: company name */}
        <p className="px-4 text-[13px] font-semibold text-slate-800 leading-tight">
          {q.name}
        </p>

        {/* Row 3: price + sparkline (baseline-aligned price & change) */}
        <div className="flex items-center justify-between px-4 mt-3 gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[19px] font-bold text-slate-900 tabular-nums leading-none">
              {q.price != null ? fmtPrice(q.price) : '—'}
            </span>
            <span className={cn('text-[12px] font-semibold tabular-nums', up ? 'text-emerald-600' : 'text-red-600')}>
              {q.changePct != null ? fmtPct(q.changePct / 100) : '—'}
            </span>
          </div>
          {q.price != null ? (
            <Sparkline prices={q.sparkData} up={up} width={72} height={28} />
          ) : (
            <SparklineSkeleton width={72} height={28} />
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 mt-3 border-t border-slate-100" />

        {/* Row 4: intrinsic value + upside (pushes to bottom) */}
        <div className="flex items-end justify-between px-4 py-3 mt-auto gap-3">
          <div>
            <p className="flex items-center gap-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
              Intrinsic value
              <span
                title="DCF-based fair value estimate using market-implied growth and WACC inputs"
                className="cursor-help"
              >
                <Info size={9} className="text-slate-300" />
              </span>
            </p>
            <p className={cn('text-[14px] font-bold tabular-nums', (q.upsidePct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {q.fairValue != null ? fmtPrice(q.fairValue) : '—'}
            </p>
          </div>
          {q.upsidePct != null && (
            <div className="text-right shrink-0">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Upside</p>
              <p className={cn('text-[14px] font-bold tabular-nums', q.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {q.upsidePct >= 0 ? '+' : ''}{(q.upsidePct * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Row 5: market implies footer */}
        <div className="px-4 pb-3 -mt-1">
          <p className="text-[11px] text-slate-400">
            Market implies{' '}
            <span className="font-semibold text-slate-600">
              {q.impliedCagr > 0 ? '+' : ''}{q.impliedCagr}%
            </span>
            {' '}5Y revenue CAGR
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Popular Analyses Section ─────────────────────────────────────────────────

function PopularAnalysesSection() {
  const [quotes, setQuotes] = useState<FeaturedQuote[]>(STATIC_QUOTES)
  const reduced = useReducedMotion()

  useEffect(() => {
    fetch('/api/analyze/quotes')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.quotes)) setQuotes(d.quotes) })
      .catch(() => {})
  }, [])

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Popular analyses</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Top holdings from SPY · QQQ · DIA — no duplicates</p>
        </div>
        <Link href="/markets" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap">
          View all <ChevronRight size={13} />
        </Link>
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {quotes.map((q, i) => (
          <div key={q.ticker} className="min-w-[230px] snap-start flex-shrink-0">
            <StockAnalysisCard q={q} index={i} />
          </div>
        ))}
      </div>

      {/* Desktop: equal-height grid */}
      <motion.div
        className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
        variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.06 } } }}
        initial="hidden"
        animate="visible"
      >
        {quotes.map((q, i) => (
          <StockAnalysisCard key={q.ticker} q={q} index={i} />
        ))}
      </motion.div>
    </section>
  )
}

// ─── Market Pricing Leaderboard ───────────────────────────────────────────────

function MarketPricingLeaderboard({ quotes }: { quotes: FeaturedQuote[] }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">What the market is pricing in</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Market-implied 5Y revenue growth vs. historical 3Y growth</p>
        </div>
        <Link href="/markets" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap">
          View full <ChevronRight size={13} />
        </Link>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="min-w-[520px]">
          {/* Sticky column headers */}
          <div className="sticky top-0 z-10 bg-white grid grid-cols-[150px_1fr_1fr_110px] sm:grid-cols-[170px_1fr_1fr_110px_minmax(0,200px)] gap-x-4 px-5 py-2.5 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Stock</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Implied 5Y CAGR</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">3Y Historical</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Expectation</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide hidden sm:block">Interpretation</span>
          </div>

          <div className="divide-y divide-slate-50">
            {quotes.map((q) => (
              <Link
                key={q.ticker}
                href={`/stock/${q.ticker}`}
                className="grid grid-cols-[150px_1fr_1fr_110px] sm:grid-cols-[170px_1fr_1fr_110px_minmax(0,200px)] gap-x-4 px-5 py-3 items-center hover:bg-slate-50 transition-colors"
              >
                {/* Stock */}
                <div className="min-w-0">
                  <span className="text-[12px] font-bold text-slate-800 font-mono">{q.ticker}</span>
                  <span className="text-[11px] text-slate-500 ml-1.5 hidden sm:inline truncate">{q.name.split(' ')[0]}</span>
                </div>

                {/* Implied CAGR bar */}
                <div className="flex items-center gap-2">
                  <div
                    className={cn('h-2 rounded-full shrink-0', cagrBarColor(Math.abs(q.impliedCagr), 'implied'))}
                    style={{ width: `${Math.min(100, Math.abs(q.impliedCagr) * BAR_SCALE)}px` }}
                  />
                  <span className="text-[12px] font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {q.impliedCagr > 0 ? '+' : ''}{q.impliedCagr}%
                  </span>
                </div>

                {/* Historical CAGR bar */}
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 bg-blue-400 rounded-full shrink-0"
                    style={{ width: `${Math.min(100, Math.abs(q.historicalCagr3y) * BAR_SCALE)}px` }}
                  />
                  <span className="text-[12px] font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {q.historicalCagr3y}%
                  </span>
                </div>

                {/* Expectation badge */}
                <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap w-fit', expectationCls(q.expectation))}>
                  {q.expectation}
                </span>

                {/* Interpretation — desktop, 2-line wrap with full text in title */}
                <span
                  className="text-[11px] text-slate-500 hidden sm:block leading-relaxed line-clamp-2"
                  title={q.interpretation}
                >
                  {q.interpretation}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with info tooltip */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-t border-slate-100 relative">
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Info size={12} />
          How is this calculated?
        </button>
        {showInfo && (
          <div className="absolute left-5 bottom-full mb-2 z-20 w-72 rounded-xl bg-slate-900 text-white text-[11px] leading-relaxed px-3.5 py-3 shadow-lg">
            <p className="font-semibold mb-1">Reverse DCF method</p>
            <p className="text-slate-300">Implied CAGR is the 5-year revenue growth rate that would justify the current stock price, computed via a reverse discounted cash flow model at the company&apos;s estimated WACC.</p>
            <p className="text-slate-400 mt-1.5">Historical CAGR is from annual revenue filings. Model estimates only — not financial advice.</p>
          </div>
        )}
        <span className="text-slate-200 mx-1">·</span>
        <span className="text-[11px] text-slate-400">Click any row to open the full analysis</span>
      </div>
    </section>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const router = useRouter()

  const cards = [
    {
      icon: Search,
      title: 'Analyze one stock',
      desc: 'Deep dive into intrinsic value, growth expectations, business quality, and risks.',
      cta: 'Analyze',
      onClick: () => document.getElementById('analyze-search-input')?.focus(),
      iconCls: 'text-blue-600 bg-blue-50',
    },
    {
      icon: BarChart3,
      title: 'Compare stocks',
      desc: 'Compare valuation, quality, and growth expectations across multiple companies.',
      cta: 'Compare',
      onClick: () => router.push('/compare'),
      iconCls: 'text-violet-600 bg-violet-50',
    },
    {
      icon: Bookmark,
      title: 'My Valuations',
      desc: 'Review your saved analyses and track conviction over time.',
      cta: 'My valuations',
      onClick: () => router.push('/valuations'),
      iconCls: 'text-emerald-600 bg-emerald-50',
    },
  ]

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-slate-900">More ways to research</h2>
        <p className="text-[12px] text-slate-500 mt-0.5">Explore what the price assumes, compare opportunities, and build conviction.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.title} className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', c.iconCls)}>
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-bold text-slate-900">{c.title}</p>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{c.desc}</p>
              </div>
              <button
                onClick={c.onClick}
                className="mt-auto w-full rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[.98] transition-all py-2 text-[13px] font-semibold text-white"
              >
                {c.cta}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Recently Viewed ──────────────────────────────────────────────────────────

function RecentlyViewed() {
  const [recent, setRecent] = useState<RecentItem[] | null>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = localStorage.getItem('intrinsico_recent')
      setRecent(stored ? (JSON.parse(stored) as RecentItem[]) : [])
    } catch {
      setRecent([])
    }
  }, [])

  const removeItem = useCallback((ticker: string) => {
    setRecent((prev) => {
      const next = (prev ?? []).filter((r) => r.ticker !== ticker)
      try { localStorage.setItem('intrinsico_recent', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  if (recent === null) return null

  return (
    <section>
      <h2 className="text-[15px] font-bold text-slate-900 mb-4">Recently viewed</h2>

      {recent.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-6 py-8 flex flex-col items-center text-center gap-2">
          <Clock size={22} className="text-slate-300" />
          <p className="text-[13px] font-medium text-slate-600">No recent analyses yet</p>
          <p className="text-[12px] text-slate-400">Stocks you open will appear here so you can quickly pick up where you left off.</p>
          <button
            onClick={() => document.getElementById('analyze-search-input')?.focus()}
            className="mt-2 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Search your first stock →
          </button>
        </div>
      ) : (
        <>
          {/* Mobile: vertical list */}
          <div className="sm:hidden flex flex-col gap-2">
            {recent.slice(0, 6).map((r) => {
              const up = r.changePct >= 0
              return (
                <div
                  key={r.ticker}
                  className="group flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3"
                >
                  <button
                    onClick={() => router.push(`/stock/${r.ticker}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-blue-700 font-mono">{r.ticker}</span>
                        <span className={cn('text-[11px] font-semibold tabular-nums', up ? 'text-emerald-600' : 'text-red-600')}>
                          {fmtPct(r.changePct / 100)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{r.name}</p>
                    </div>
                    <span className="ml-auto text-[14px] font-bold text-slate-900 tabular-nums shrink-0">{fmtPrice(r.price)}</span>
                  </button>
                  <button
                    onClick={() => removeItem(r.ticker)}
                    title="Remove from history"
                    className="shrink-0 p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Desktop: horizontal scroll */}
          <div className="hidden sm:flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {recent.slice(0, 8).map((r) => {
              const up = r.changePct >= 0
              return (
                <div
                  key={r.ticker}
                  className="group relative flex-shrink-0 w-[160px] rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
                >
                  <button
                    onClick={() => router.push(`/stock/${r.ticker}`)}
                    className="w-full p-3 text-left"
                  >
                    <span className="text-[12px] font-bold text-blue-700 font-mono block">{r.ticker}</span>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 mb-2">{r.name}</p>
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{fmtPrice(r.price)}</p>
                    <p className={cn('text-[11px] font-semibold tabular-nums mt-0.5', up ? 'text-emerald-600' : 'text-red-600')}>
                      {fmtPct(r.changePct / 100)}
                    </p>
                  </button>
                  <button
                    onClick={() => removeItem(r.ticker)}
                    title="Remove from history"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="space-y-6">

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <SearchHero />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <PopularAnalysesSection />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.10, ease: [0.16, 1, 0.3, 1] }}
        >
          <MarketPricingLeaderboard quotes={STATIC_QUOTES} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          <QuickActions />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <RecentlyViewed />
        </motion.div>

      </div>
    </div>
  )
}
