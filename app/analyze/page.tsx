'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence, useReducedMotion, useInView } from 'motion/react'
import {
  Search, Bookmark, ChevronRight,
  Clock, Info, X, BarChart3,
} from 'lucide-react'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import { fmtPrice, fmtPct, upsideZone } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { slideDown, fadeUp } from '@/lib/motion'
import type { FeaturedQuote } from '@/app/api/analyze/quotes/route'

const ConceptBanner = dynamic(() => import('@/components/onboarding/ConceptBanner'), { ssr: false })

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

  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchResult[]>([])
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [activeIdx, setActiveIdx]   = useState(-1)
  const [showExplainer, setShowExplainer] = useState(false)
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listboxId = 'analyze-search-listbox'

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

  useEffect(() => { setActiveIdx(-1) }, [results])

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const select = useCallback((symbol: string) => {
    setOpen(false); setQuery(''); router.push(`/stock/${symbol}`)
  }, [router])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open && results.length > 0) setOpen(true)
      setActiveIdx(prev => Math.min(prev + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(prev => Math.max(prev - 1, -1))
      return
    }
    if (e.key === 'Enter') {
      if (activeIdx >= 0 && results[activeIdx]) {
        select(results[activeIdx].symbol)
      } else if (query.trim()) {
        select(query.trim().toUpperCase())
      }
    }
  }

  return (
    <div className="glass-card-light rounded-2xl px-6 py-6 sm:px-8 sm:py-7">
      {/* Headline + subtitle */}
      <div className="mb-5">
        <h1 className="text-[28px] font-black sm:text-[32px] text-slate-900 leading-tight tracking-tight" style={{ textWrap: 'balance' }}>
          What do you want to analyze today?
        </h1>
        <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">
          Search any company to see intrinsic value, market-implied growth, business quality, and valuation risk.{' '}
          <button
            type="button"
            onClick={() => setShowExplainer(v => !v)}
            aria-expanded={showExplainer}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors hover:underline underline-offset-2"
          >
            How to read this
          </button>
        </p>

        <AnimatePresence>
          {showExplainer && (
            <motion.div
              key="concept-explainer"
              initial={reduced ? {} : { opacity: 0, height: 0 }}
              animate={reduced ? {} : { opacity: 1, height: 'auto' }}
              exit={reduced ? {} : { opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4 text-[12px] leading-relaxed text-slate-700">
                <p className="font-semibold text-[13px] text-slate-800 mb-2">What Insic measures</p>
                <p>Every stock price implies a 5-year revenue growth rate the market is betting on. Insic calls this the <strong>implied CAGR</strong> and compares it to the company&apos;s 3-year historical growth rate. The gap is where the signal lives.</p>
                <div className="mt-3 space-y-2">
                  <p className="font-semibold text-slate-700 mb-1">Expectation labels:</p>
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">Conservative</span>
                    <span className="text-slate-600">Implied growth is well below historical. Market is pricing in a slowdown or headwinds.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-semibold bg-amber-50 text-amber-700 border-amber-200">Moderate</span>
                    <span className="text-slate-600">Implied growth roughly matches historical. Expectations are broadly in line with the past.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-semibold bg-red-50 text-red-600 border-red-200">Aggressive</span>
                    <span className="text-slate-600">Implied growth significantly exceeds historical. Market is betting on a major acceleration.</span>
                  </div>
                </div>
                <p className="mt-3 text-slate-400 text-[11px]">Intrinsic value is a DCF-based model estimate. All outputs are not financial advice.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={activeIdx >= 0 ? `analyze-result-${activeIdx}` : undefined}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search ticker or company name, e.g. NVDA, MercadoLibre…"
            className="flex-1 min-w-0 bg-transparent text-[16px] text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={() => query.trim() && select(query.trim().toUpperCase())}
            disabled={!query.trim()}
            className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all px-4 py-1.5 text-[13px] font-semibold text-white min-h-[44px]"
          >
            Analyze
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key="analyze-search-drop"
              id={listboxId}
              role="listbox"
              aria-label="Search suggestions"
              variants={reduced ? {} : slideDown}
              initial="hidden" animate="visible" exit="exit"
              style={{ originY: 0 }}
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden max-h-72 overflow-y-auto"
            >
              {results.map((r, idx) => (
                <button
                  id={`analyze-result-${idx}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-b-0 transition-colors min-h-[48px]',
                    idx === activeIdx ? 'bg-slate-50' : 'hover:bg-slate-50',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold text-slate-800 font-mono">{r.symbol}</span>
                      {r.exchange && <span className="text-[11px] text-slate-500 uppercase">{r.exchange}</span>}
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
      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        <span className="text-[11px] font-semibold text-slate-500 shrink-0 mr-0.5">Popular:</span>
        {POPULAR_CHIPS.map((t) => (
          <Link
            key={t}
            href={`/stock/${t}`}
            className="text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 hover:scale-105 active:scale-95 border border-blue-200 rounded-full px-3 py-1 transition-all whitespace-nowrap shrink-0 min-h-[32px] flex items-center"
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
  const reduced = useReducedMotion()

  const [fairValue,  setFairValue]  = useState<number | null>(q.fairValue)
  const [upsidePct,  setUpsidePct]  = useState<number | null>(q.upsidePct)
  const [fvLoading,  setFvLoading]  = useState(q.fairValue == null)
  const [fvError,    setFvError]    = useState(false)

  useEffect(() => {
    if (fairValue != null) { setFvLoading(false); return }
    const timer = setTimeout(() => {
      fetch(`/api/financials?ticker=${q.ticker}`)
        .then((r) => r.json())
        .then((data) => {
          const fv    = data?.valuationMethods?.triangulatedFairValue ?? null
          const price = data?.quote?.price ?? q.price
          setFairValue(fv)
          if (fv != null && price && price > 0) setUpsidePct((fv - price) / price)
        })
        .catch(() => { setFvError(true) })
        .finally(() => setFvLoading(false))
    }, index * 200)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.ticker])

  const zone  = upsidePct != null ? upsideZone(upsidePct) : null
  const badge = statusBadge(zone)

  return (
    <motion.div
      variants={reduced ? {} : fadeUp}
      custom={index}
      transition={{ delay: index * 0.06 }}
      whileTap={reduced ? {} : { scale: 0.985 }}
      className="h-full"
    >
      <Link
        href={`/stock/${q.ticker}`}
        className="group flex flex-col h-full rounded-xl glass-card-light glass-interactive overflow-hidden"
      >
        {/* Row 1: ticker + ETF badge | status badge */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 font-mono leading-tight">
              {q.ticker}
            </span>
          </div>
          {badge && (
            <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap shrink-0', badge.cls)}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Row 2: company name */}
        <p className="px-4 text-[13px] font-semibold text-slate-800 leading-tight">
          {q.name}
        </p>

        {/* Row 3: price + sparkline */}
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

        {/* Row 4: intrinsic value + upside */}
        <div className="flex items-end justify-between px-4 py-3 mt-auto gap-3">
          <div>
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mb-0.5">
              Intrinsic value
              <button
                type="button"
                aria-label="DCF-based fair value estimate using market-implied growth and WACC inputs"
                className="cursor-help inline-flex items-center"
              >
                <Info size={11} className="text-slate-300" />
              </button>
            </p>
            {fvLoading ? (
              <div className="h-4 w-14 rounded bg-slate-100 animate-pulse mt-0.5" />
            ) : fvError ? (
              <p className="text-[12px] text-slate-400">Unavailable</p>
            ) : fairValue != null ? (
              <p className={cn('text-[14px] font-bold tabular-nums', (upsidePct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {fmtPrice(fairValue)}
              </p>
            ) : (
              <p className="text-[12px] text-slate-400">No model yet</p>
            )}
          </div>
          {upsidePct != null && (
            <div className="text-right shrink-0">
              <p className="text-[11px] font-medium text-slate-500 mb-0.5">Upside</p>
              <p className={cn('text-[14px] font-bold tabular-nums', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Row 5: market implies footer */}
        <div className="px-4 pb-3 -mt-1">
          <p className="text-[11px] text-slate-500">
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

function PopularAnalysesSection({
  quotes,
  dataStale,
}: {
  quotes: FeaturedQuote[]
  dataStale: boolean
}) {
  const reduced  = useReducedMotion()
  const featured = quotes.slice(0, 3)

  return (
    <section>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-slate-900">Popular analyses</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Top holdings from SPY · QQQ · DIA — no duplicates</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {dataStale && (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
              Cached · live prices unavailable
            </span>
          )}
          <Link href="/markets" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap">
            View all <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* Mobile: horizontal scroll — all 9 */}
      <div className="sm:hidden flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {quotes.map((q, i) => (
          <div key={q.ticker} className="min-w-[280px] snap-start flex-shrink-0">
            <StockAnalysisCard q={q} index={i} />
          </div>
        ))}
      </div>

      {/* Desktop: 3 featured cards only — leaderboard below shows the full picture */}
      <motion.div
        className="hidden sm:grid grid-cols-3 gap-4 items-stretch"
        variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.06 } } }}
        initial="hidden"
        animate="visible"
      >
        {featured.map((q, i) => (
          <StockAnalysisCard key={q.ticker} q={q} index={i} />
        ))}
      </motion.div>
    </section>
  )
}

// ─── Market Pricing Leaderboard ───────────────────────────────────────────────

function MarketPricingLeaderboard({ quotes }: { quotes: FeaturedQuote[] }) {
  const [showInfo, setShowInfo] = useState(false)
  const reduced   = useReducedMotion()
  const tableRef  = useRef<HTMLDivElement>(null)
  const infoRef   = useRef<HTMLDivElement>(null)
  const inView    = useInView(tableRef, { once: true, margin: '-60px' })

  useEffect(() => {
    if (!showInfo) return
    function handleOutside(e: PointerEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false)
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [showInfo])

  return (
    <section className="glass-card-light rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">What the market is pricing in</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Market-implied 5Y revenue growth vs. historical 3Y growth · model estimates</p>
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
            <span className="text-[11px] font-semibold text-slate-500">Stock</span>
            <span className="text-[11px] font-semibold text-slate-500">Implied 5Y CAGR</span>
            <span className="text-[11px] font-semibold text-slate-500">3Y Historical</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              Expectation
              <button
                type="button"
                aria-label="Conservative = implied well below historical (slowdown priced in); Moderate = roughly in line with history; Aggressive = implied significantly above historical (acceleration priced in)"
                className="cursor-help text-slate-300 hover:text-slate-500 transition-colors"
              >
                <Info size={10} />
              </button>
            </span>
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:block">Interpretation</span>
          </div>

          <div ref={tableRef} className="divide-y divide-slate-50">
            {quotes.map((q, rowIndex) => (
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
                  <div className="overflow-hidden" style={{ width: `${Math.min(100, Math.abs(q.impliedCagr) * BAR_SCALE)}px` }}>
                    <motion.div
                      className={cn('h-2 rounded-full w-full', cagrBarColor(Math.abs(q.impliedCagr), 'implied'))}
                      style={{ transformOrigin: 'left' }}
                      initial={reduced ? {} : { scaleX: 0 }}
                      animate={reduced ? {} : { scaleX: inView ? 1 : 0 }}
                      transition={{ duration: 0.5, delay: rowIndex * 0.038, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {q.impliedCagr > 0 ? '+' : ''}{q.impliedCagr}%
                  </span>
                </div>

                {/* Historical CAGR bar */}
                <div className="flex items-center gap-2">
                  <div className="overflow-hidden" style={{ width: `${Math.min(100, Math.abs(q.historicalCagr3y) * BAR_SCALE)}px` }}>
                    <motion.div
                      className="h-2 bg-blue-400 rounded-full w-full"
                      style={{ transformOrigin: 'left' }}
                      initial={reduced ? {} : { scaleX: 0 }}
                      animate={reduced ? {} : { scaleX: inView ? 1 : 0 }}
                      transition={{ duration: 0.5, delay: rowIndex * 0.038 + 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {q.historicalCagr3y}%
                  </span>
                </div>

                {/* Expectation badge */}
                <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap w-fit', expectationCls(q.expectation))}>
                  {q.expectation}
                </span>

                {/* Interpretation — desktop only */}
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
      <div ref={infoRef} className="flex items-center gap-1.5 px-5 py-3 border-t border-slate-100 relative">
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Info size={12} />
          How is this calculated?
        </button>
        <AnimatePresence>
          {showInfo && (
            <motion.div
              key="leaderboard-info"
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-5 bottom-full mb-2 z-20 w-72 max-w-[calc(100vw-40px)] rounded-xl bg-slate-900 text-white text-[11px] leading-relaxed px-3.5 py-3 shadow-lg"
            >
              <p className="font-semibold mb-1">Reverse DCF method</p>
              <p className="text-slate-300">Implied CAGR is the 5-year revenue growth rate that would justify the current stock price, computed via a reverse discounted cash flow model at the company&apos;s estimated WACC.</p>
              <p className="text-slate-400 mt-1.5">Historical CAGR is from annual revenue filings. Model estimates only — not financial advice.</p>
            </motion.div>
          )}
        </AnimatePresence>
        <span className="text-slate-200 mx-1">·</span>
        <span className="text-[11px] text-slate-500">Click any row to open the full analysis</span>
      </div>
    </section>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    {
      icon: BarChart3,
      title: 'Compare stocks',
      desc: 'Side-by-side valuation, quality, and growth expectations.',
      href: '/compare',
      iconCls: 'text-violet-600 bg-violet-50',
    },
    {
      icon: Bookmark,
      title: 'My Valuations',
      desc: 'Review saved analyses and track conviction over time.',
      href: '/valuations',
      iconCls: 'text-emerald-600 bg-emerald-50',
    },
  ]

  return (
    <section>
      <h2 className="text-[15px] font-bold text-slate-900 mb-3">Go further</h2>
      <div className="glass-card-light rounded-xl divide-y divide-slate-100/60 overflow-hidden">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Link
              key={a.title}
              href={a.href}
              className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[64px] group"
            >
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', a.iconCls)}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-slate-900">{a.title}</p>
                <p className="text-[12px] text-slate-600 mt-0.5">{a.desc}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-150" />
            </Link>
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
            <AnimatePresence initial={false}>
            {recent.slice(0, 6).map((r) => {
              const up = r.changePct >= 0
              return (
                <motion.div
                  key={r.ticker}
                  layout="position"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3 min-h-[56px]"
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
                    aria-label={`Remove ${r.ticker} from history`}
                    className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              )
            })}
            </AnimatePresence>
          </div>

          {/* Desktop: horizontal scroll */}
          <div className="hidden sm:flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            <AnimatePresence initial={false}>
            {recent.slice(0, 8).map((r) => {
              const up = r.changePct >= 0
              return (
                <motion.div
                  key={r.ticker}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
                    aria-label={`Remove ${r.ticker} from history`}
                    className="absolute top-1 right-1 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              )
            })}
            </AnimatePresence>
          </div>
        </>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const [quotes, setQuotes]     = useState<FeaturedQuote[]>(STATIC_QUOTES)
  const [dataStale, setDataStale] = useState(false)

  useEffect(() => {
    fetch('/api/analyze/quotes')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.quotes)) setQuotes(d.quotes) })
      .catch(() => { setDataStale(true) })
  }, [])

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:outline-none focus:shadow-lg"
      >
        Skip to content
      </a>
      <div id="main-content" className="space-y-8" tabIndex={-1}>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <SearchHero />
        </motion.div>

        <ConceptBanner />
        <PopularAnalysesSection quotes={quotes} dataStale={dataStale} />
        <MarketPricingLeaderboard quotes={quotes} />
        <QuickActions />
        <RecentlyViewed />

      </div>
    </div>
  )
}
