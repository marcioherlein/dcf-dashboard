'use client'
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchange?: string
  exchDisp?: string
  quoteType?: string
  supported: boolean
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
    return { label: zone, cls: 'bg-olive-50 text-[#5F790B] border-[#BFD2A1]' }
  if (zone.toLowerCase().includes('fair'))
    return { label: zone, cls: 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]' }
  return { label: zone, cls: 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]' }
}

function expectationCls(exp: string) {
  if (exp === 'Conservative') return 'bg-olive-50 text-[#5F790B] border-[#BFD2A1]'
  if (exp === 'Moderate')     return 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
  return 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
}

function cagrBarColor(pct: number, type: 'implied' | 'historical') {
  if (type === 'historical') return 'bg-[#2563EB]'
  if (pct <= 15) return 'bg-olive-700'
  if (pct <= 30) return 'bg-[#B56A00]'
  return 'bg-[#D83B3B]'
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
  const [unsupportedError, setUnsupportedError] = useState<string | null>(null)
  const [showExplainer, setShowExplainer] = useState(false)
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listboxId = 'analyze-search-listbox'

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); setUnsupportedError(null); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d: SearchResult[]) => { setResults(d); setOpen(true); setLoading(false) })
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
    const match = results.find(r => r.symbol === symbol)
    if (match && !match.supported) {
      const exch = match.exchDisp ?? match.exchange ?? 'a foreign exchange'
      setUnsupportedError(`${match.symbol} trades on ${exch} — we only cover NYSE and NASDAQ stocks.`)
      setOpen(false)
      return
    }
    setOpen(false); setQuery(''); setUnsupportedError(null)
    const dest = match?.quoteType === 'ETF' ? `/etf/${symbol}` : `/stock/${symbol}`
    router.push(dest)
  }, [router, results])

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
    <div
      style={{
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '16px',
      }}
    >
      {/* Search input */}
      <div className="p-3 sm:p-4">
      <div className="relative" ref={searchRef}>
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition-all bg-white/95',
          open || query
            ? 'border-olive-600 ring-2 ring-olive-700/20'
            : 'border-white/30 hover:border-white/50',
        )}>
          {loading ? (
            <div className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-[#E5E5E5] border-t-olive-700 shrink-0" />
          ) : (
            <Search size={15} className="text-[#6B6B6B] shrink-0" />
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
            className="flex-1 min-w-0 bg-transparent text-[16px] text-ink-900 placeholder-[#9B9B9B] focus:outline-none"
          />
          {!query && (
            <kbd className="shrink-0 hidden sm:flex items-center rounded border border-[#E5E5E5] px-1.5 py-0.5 text-[10px] text-[#6B6B6B] font-mono leading-tight select-none">
              /
            </kbd>
          )}
          <button
            onClick={() => query.trim() && select(query.trim().toUpperCase())}
            disabled={!query.trim()}
            className="shrink-0 rounded-lg bg-olive-700 hover:bg-olive-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all px-4 py-1.5 text-[13px] font-semibold text-white min-h-[44px]"
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
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-white border border-[#E5E5E5] shadow-float overflow-hidden max-h-72 overflow-y-auto"
            >
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[12px] text-[#6B6B6B]">No results for &ldquo;{query}&rdquo;</p>
                  <p className="text-[11px] text-[#6B6B6B] mt-1">Try the full ticker symbol, e.g. MELI, NVDA</p>
                </div>
              ) : results.map((r, idx) => (
                <button
                  id={`analyze-result-${idx}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-4 py-3 text-left border-b border-[#E5E5E5] last:border-b-0 transition-colors min-h-[48px]',
                    !r.supported ? 'opacity-50 cursor-not-allowed' : idx === activeIdx ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold text-ink-900 font-mono">{r.symbol}</span>
                      {r.exchange && <span className="text-[11px] text-[#6B6B6B] uppercase">{r.exchDisp ?? r.exchange}</span>}
                    </div>
                    <span className="text-[12px] text-[#6B6B6B] truncate block">{r.longname ?? r.shortname}</span>
                  </div>
                  {r.supported ? (
                    r.quoteType && (
                      <span className="shrink-0 text-[11px] font-semibold text-olive-700 bg-olive-50 border border-[#BFD2A1] px-2 py-0.5 rounded-md">
                        {r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType}
                      </span>
                    )
                  ) : (
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white text-[#6B6B6B] border border-[#E5E5E5] whitespace-nowrap">
                      Not covered
                    </span>
                  )}
                </button>
              ))}
              {unsupportedError && (
                <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
                  <span className="text-amber-500 shrink-0 mt-0.5 text-[13px]">⚠</span>
                  <p className="text-[11px] text-amber-700 leading-snug">{unsupportedError}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Popular chips + explainer toggle */}
      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        <span className="text-[11px] font-[600] text-white/50 shrink-0 mr-0.5">Popular:</span>
        {POPULAR_CHIPS.map((t) => (
          <Link
            key={t}
            href={`/stock/${t}`}
            className="text-[12px] font-[600] text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1 transition-colors whitespace-nowrap shrink-0 min-h-[32px] flex items-center"
          >
            {t}
          </Link>
        ))}
        <span className="text-white/20 shrink-0 mx-0.5">|</span>
        <Link
          href="/screener"
          className="text-[12px] font-[600] text-white/60 hover:text-white/90 bg-white/10 hover:bg-white/15 border border-white/20 rounded-full px-3 py-1 transition-colors whitespace-nowrap shrink-0 min-h-[32px] flex items-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
          </svg>
          Screener
        </Link>
        <button
          type="button"
          onClick={() => setShowExplainer(v => !v)}
          aria-expanded={showExplainer}
          className="shrink-0 ml-auto text-[11px] text-white/50 hover:text-white/80 transition-colors whitespace-nowrap min-h-[32px] flex items-center gap-1"
        >
          {showExplainer ? 'Hide guide' : 'How to read this →'}
        </button>
      </div>

      {/* Inline explainer — collapsed by default */}
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
            <div className="mt-3 rounded-xl bg-white/10 border border-white/15 p-4 text-[12px] leading-relaxed text-white/80">
              <p className="font-semibold text-[13px] text-white mb-2">What insic measures</p>
              <p>Every stock price implies a 5-year revenue growth rate the market is betting on. insic calls this the <strong className="text-white">implied CAGR</strong> and compares it to the company&apos;s 3-year historical growth rate.</p>
              <div className="mt-3 space-y-2">
                <p className="font-semibold text-white mb-1">Expectation labels:</p>
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-semibold bg-olive-50 text-olive-700 border-[#BFD2A1]">Conservative</span>
                  <span>Implied growth is well below historical. Market is pricing in a slowdown.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-semibold bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]">Moderate</span>
                  <span>Implied growth roughly matches historical. Expectations are in line.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-semibold bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]">Aggressive</span>
                  <span>Implied growth far exceeds historical. Market is betting on a major acceleration.</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-white/50">Intrinsic value is a DCF-based model estimate. Not financial advice.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>{/* /p-3 sm:p-4 */}
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
  const [retryKey,   setRetryKey]   = useState(0)

  useEffect(() => {
    if (fairValue != null && retryKey === 0) { setFvLoading(false); return }
    const controller = new AbortController()
    setFvLoading(true)
    setFvError(false)
    const timer = setTimeout(() => {
      fetch(`/api/financials?ticker=${q.ticker}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          // Use cockpit blended fair value (Forward P/E + EV/EBITDA + Revenue Multiple + DCF)
          // to match exactly what the stock page shows. Falls back to triangulated DCF-only value.
          const fv    = data?.valuationMethods?.cockpitFairValue
                     ?? data?.valuationMethods?.triangulatedFairValue
                     ?? null
          const price = data?.quote?.price ?? q.price
          setFairValue(fv)
          if (fv != null && price && price > 0) setUpsidePct((fv - price) / price)
        })
        .catch((err) => { if (err?.name !== 'AbortError') setFvError(true) })
        .finally(() => setFvLoading(false))
    }, retryKey === 0 ? index * 200 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.ticker, retryKey])

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
            <span className="text-[11px] font-bold text-[#5F790B] bg-[#EEF4DD] border border-[#BFD2A1] rounded-md px-2 py-0.5 font-mono leading-tight">
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
        <p className="px-4 text-[13px] font-semibold text-ink-900 leading-tight">
          {q.name}
        </p>

        {/* Row 3: price + sparkline */}
        <div className="flex items-center justify-between px-4 mt-3 gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[19px] font-bold text-ink-900 tabular-nums leading-none">
              {q.price != null ? fmtPrice(q.price) : '—'}
            </span>
            <span className={cn('text-[12px] font-semibold tabular-nums', up ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
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
        <div className="mx-4 mt-3 border-t border-[#E5E5E5]" />

        {/* Row 4: intrinsic value + upside */}
        <div className="flex items-end justify-between px-4 py-3 mt-auto gap-3">
          <div>
            <p className="flex items-center gap-1 text-[11px] font-medium text-[#6B6B6B] mb-0.5">
              Intrinsic value
              <button
                type="button"
                aria-label="DCF-based fair value estimate using market-implied growth and WACC inputs"
                title="DCF-based fair value estimate using market-implied growth and WACC inputs"
                className="cursor-help inline-flex items-center p-0.5 -m-0.5 rounded min-h-[44px]"
              >
                <Info size={11} className="text-[#C4C4C4]" />
              </button>
            </p>
            {fvLoading ? (
              <div className="h-4 w-14 rounded bg-[#F5F5F5] motion-safe:animate-pulse mt-0.5" />
            ) : fvError ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRetryKey(k => k + 1) }}
                className="text-[11px] text-[#5F790B] hover:text-[#526A08] transition-colors min-h-[44px] inline-flex items-center"
              >
                Retry ↺
              </button>
            ) : fairValue != null ? (
              <p className={cn('text-[14px] font-bold tabular-nums', (upsidePct ?? 0) >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {fmtPrice(fairValue)}
              </p>
            ) : (
              <p className="text-[12px] text-[#6B6B6B]">No model yet</p>
            )}
          </div>
          {upsidePct != null && (
            <div className="text-right shrink-0">
              <p className="text-[11px] font-medium text-[#6B6B6B] mb-0.5">Upside</p>
              <p className={cn('text-[14px] font-bold tabular-nums', upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Row 5: market implies footer */}
        <div className="px-4 pb-3 -mt-1">
          <p className="text-[11px] text-[#6B6B6B]">
            Market implies{' '}
            <span className="font-semibold text-ink-900">
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
          <h2 className="text-[15px] font-bold text-ink-900">Popular analyses</h2>
          <p className="text-[12px] text-[#6B6B6B] mt-0.5">Top holdings from SPY · QQQ · DIA — no duplicates</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {dataStale && (
            <span className="text-[11px] text-[#B56A00] bg-[#FFF4DA] border border-[#F3D391] rounded-full px-2.5 py-0.5 whitespace-nowrap">
              Cached · live prices unavailable
            </span>
          )}
          <Link href="/markets" className="text-[12px] font-medium text-[#5F790B] hover:text-[#526A08] flex items-center gap-1 whitespace-nowrap">
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

  const rowData = useMemo(() => quotes.map(q => ({
    ...q,
    shortName: q.name.split(',')[0],
    impliedBarW: Math.min(100, Math.abs(q.impliedCagr) * BAR_SCALE),
    histBarW: Math.min(100, Math.abs(q.historicalCagr3y) * BAR_SCALE),
  })), [quotes])

  useEffect(() => {
    if (!showInfo) return
    function handleOutside(e: PointerEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false)
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [showInfo])

  return (
    <section className="glass-card-light rounded-2xl">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">What the market is pricing in</h2>
          <p className="text-[12px] text-[#6B6B6B] mt-0.5">Market-implied 5Y revenue growth vs. historical 3Y growth · model estimates</p>
        </div>
        <Link href="/markets" className="text-[12px] font-medium text-[#5F790B] hover:text-[#526A08] flex items-center gap-1 whitespace-nowrap">
          View full <ChevronRight size={13} />
        </Link>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="min-w-[520px]">
          {/* Sticky column headers */}
          <div className="sticky top-0 z-10 bg-white grid grid-cols-[150px_1fr_1fr_110px] sm:grid-cols-[170px_1fr_1fr_110px_minmax(0,200px)] gap-x-4 px-5 py-2.5 border-b border-[#E5E5E5]">
            <span className="text-[11px] font-semibold text-[#6B6B6B]">Stock</span>
            <span className="text-[11px] font-semibold text-[#6B6B6B]">Implied 5Y CAGR</span>
            <span className="text-[11px] font-semibold text-[#6B6B6B]">3Y Historical</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#6B6B6B]">
              Expectation
              <button
                type="button"
                aria-label="Conservative = implied well below historical (slowdown priced in); Moderate = roughly in line with history; Aggressive = implied significantly above historical (acceleration priced in)"
                className="cursor-help text-[#C4C4C4] hover:text-[#6B6B6B] transition-colors min-h-[44px] inline-flex items-center"
              >
                <Info size={10} />
              </button>
            </span>
            <span className="text-[11px] font-semibold text-[#6B6B6B] hidden sm:block">Interpretation</span>
          </div>

          <div ref={tableRef} className="divide-y divide-[#F5F5F5]">
            {rowData.map((q, rowIndex) => (
              <Link
                key={q.ticker}
                href={`/stock/${q.ticker}`}
                className="grid grid-cols-[150px_1fr_1fr_110px] sm:grid-cols-[170px_1fr_1fr_110px_minmax(0,200px)] gap-x-4 px-5 py-3 items-center hover:bg-[#FAFAFA] transition-colors"
              >
                {/* Stock */}
                <div className="min-w-0">
                  <span className="text-[12px] font-bold text-ink-900 font-mono">{q.ticker}</span>
                  <span className="text-[11px] text-[#6B6B6B] ml-1.5 hidden sm:inline truncate">{q.shortName}</span>
                </div>

                {/* Implied CAGR bar */}
                <div className="flex items-center gap-2">
                  <div className="overflow-hidden" style={{ width: `${q.impliedBarW}px` }}>
                    <motion.div
                      className={cn('h-2 rounded-full w-full', cagrBarColor(Math.abs(q.impliedCagr), 'implied'))}
                      style={{ transformOrigin: 'left' }}
                      initial={reduced ? {} : { scaleX: 0 }}
                      animate={reduced ? {} : { scaleX: inView ? 1 : 0 }}
                      transition={{ duration: 0.5, delay: rowIndex * 0.038, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-ink-900 tabular-nums whitespace-nowrap">
                    {q.impliedCagr > 0 ? '+' : ''}{q.impliedCagr}%
                  </span>
                </div>

                {/* Historical CAGR bar */}
                <div className="flex items-center gap-2">
                  <div className="overflow-hidden" style={{ width: `${q.histBarW}px` }}>
                    <motion.div
                      className="h-2 bg-[#2563EB] rounded-full w-full opacity-60"
                      style={{ transformOrigin: 'left' }}
                      initial={reduced ? {} : { scaleX: 0 }}
                      animate={reduced ? {} : { scaleX: inView ? 1 : 0 }}
                      transition={{ duration: 0.5, delay: rowIndex * 0.038 + 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-ink-900 tabular-nums whitespace-nowrap">
                    {q.historicalCagr3y}%
                  </span>
                </div>

                {/* Expectation badge */}
                <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap w-fit', expectationCls(q.expectation))}>
                  {q.expectation}
                </span>

                {/* Interpretation — desktop only */}
                <span
                  className="text-[11px] text-[#6B6B6B] hidden sm:block leading-relaxed line-clamp-2"
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
      <div ref={infoRef} className="flex items-center gap-1.5 px-5 py-3 border-t border-[#E5E5E5] relative">
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-ink-900 transition-colors min-h-[44px]"
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
              className="absolute left-5 bottom-full mb-2 z-20 w-72 max-w-[calc(100vw-40px)] rounded-xl bg-[#111111] text-white text-[11px] leading-relaxed px-3.5 py-3 shadow-float"
            >
              <p className="font-semibold mb-1">Reverse DCF method</p>
              <p className="text-[#6B6B6B]">Implied CAGR is the 5-year revenue growth rate that would justify the current stock price, computed via a reverse discounted cash flow model at the company&apos;s estimated WACC.</p>
              <p className="text-[#6B6B6B] mt-1.5">Historical CAGR is from annual revenue filings. Model estimates only — not financial advice.</p>
            </motion.div>
          )}
        </AnimatePresence>
        <span className="text-[#C4C4C4] mx-1">·</span>
        <span className="text-[11px] text-[#6B6B6B]">Click any row to open the full analysis</span>
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
      iconCls: 'text-[#2563EB] bg-[#EAF1FF]',
    },
    {
      icon: Bookmark,
      title: 'My Valuations',
      desc: 'Review saved analyses and track conviction over time.',
      href: '/valuations',
      iconCls: 'text-[#5F790B] bg-[#EEF4DD]',
    },
  ]

  return (
    <section>
      <h2 className="text-[15px] font-bold text-ink-900 mb-3">Go further</h2>
      <div className="glass-card-light rounded-xl divide-y divide-[#E5E5E5] overflow-hidden">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Link
              key={a.title}
              href={a.href}
              className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[#FAFAFA] active:bg-[#F5F5F5] transition-colors min-h-[64px] group"
            >
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', a.iconCls)}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink-900">{a.title}</p>
                <p className="text-[12px] text-[#6B6B6B] mt-0.5">{a.desc}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-[#C4C4C4] group-hover:text-[#6B6B6B] group-hover:translate-x-1 transition-all duration-150" />
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
      <h2 className="text-[15px] font-bold text-ink-900 mb-4">Recently viewed</h2>

      {recent.length === 0 ? (
        <div className="rounded-xl bg-white border border-[#E5E5E5] shadow-card px-6 py-8 flex flex-col items-center text-center gap-2">
          <Clock size={22} className="text-[#C4C4C4]" />
          <p className="text-[13px] font-medium text-[#6B6B6B]">No recent analyses yet</p>
          <p className="text-[12px] text-[#6B6B6B]">Stocks you open will appear here so you can quickly pick up where you left off.</p>
          <button
            onClick={() => document.getElementById('analyze-search-input')?.focus()}
            className="mt-2 text-[12px] font-semibold text-[#5F790B] hover:text-[#526A08] transition-colors min-h-[44px] inline-flex items-center"
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
              const up = (r.changePct ?? 0) >= 0
              return (
                <motion.div
                  key={r.ticker}
                  layout="position"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-center justify-between gap-3 rounded-xl bg-white border border-[#E5E5E5] shadow-card px-4 py-3 min-h-[56px]"
                >
                  <button
                    onClick={() => router.push(`/stock/${r.ticker}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-[44px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-[#5F790B] font-mono">{r.ticker}</span>
                        <span className={cn('text-[11px] font-semibold tabular-nums', up ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                          {fmtPct((r.changePct ?? 0) / 100)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B6B6B] truncate mt-0.5">{r.name}</p>
                    </div>
                    <span className="ml-auto text-[14px] font-bold text-ink-900 tabular-nums shrink-0">{fmtPrice(r.price)}</span>
                  </button>
                  <button
                    onClick={() => removeItem(r.ticker)}
                    aria-label={`Remove ${r.ticker} from history`}
                    className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-[#C4C4C4] hover:text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors"
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
              const up = (r.changePct ?? 0) >= 0
              return (
                <motion.div
                  key={r.ticker}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative flex-shrink-0 w-[160px] rounded-xl bg-white border border-[#E5E5E5] shadow-card hover:border-[#BFD2A1] hover:shadow-card-md transition-all"
                >
                  <button
                    onClick={() => router.push(`/stock/${r.ticker}`)}
                    className="w-full p-3 text-left"
                  >
                    <span className="text-[12px] font-bold text-[#5F790B] font-mono block">{r.ticker}</span>
                    <p className="text-[11px] text-[#6B6B6B] truncate mt-0.5 mb-2">{r.name}</p>
                    <p className="text-[15px] font-bold text-ink-900 tabular-nums">{fmtPrice(r.price)}</p>
                    <p className={cn('text-[11px] font-semibold tabular-nums mt-0.5', up ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                      {fmtPct((r.changePct ?? 0) / 100)}
                    </p>
                  </button>
                  <button
                    onClick={() => removeItem(r.ticker)}
                    aria-label={`Remove ${r.ticker} from history`}
                    className="absolute top-1 right-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-[#C4C4C4] hover:text-[#6B6B6B] hover:bg-[#F5F5F5] transition-all"
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

// Isolated to its own component so useSearchParams() is inside a Suspense boundary
function AnalyzePageInner() {
  const searchParams = useSearchParams()
  const [quotes, setQuotes]     = useState<FeaturedQuote[]>(STATIC_QUOTES)
  const [dataStale, setDataStale] = useState(false)
  const [showUpgradeToast, setShowUpgradeToast] = useState(false)

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeToast(true)
      const t = setTimeout(() => setShowUpgradeToast(false), 5000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/analyze/quotes')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.quotes)) setQuotes(d.quotes) })
      .catch(() => { setDataStale(true) })
  }, [])

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-olive-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:outline-none focus:shadow-float"
      >
        Skip to content
      </a>

      {showUpgradeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#11875D] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-float"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Welcome to Pro — unlimited stock analysis is now unlocked.
          <button
            onClick={() => setShowUpgradeToast(false)}
            aria-label="Dismiss"
            className="ml-1 p-0.5 rounded hover:bg-white/20 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Slate hero zone — contains search only ── */}
      <div className="relative overflow-hidden">
        {/* Slate gradient background */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(160deg, #1e293b 0%, #334155 55%, #475569 100%)',
          }}
        />
        {/* Olive ambient glow top-right */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(ellipse 50% 80% at 90% -10%, rgba(95,121,11,0.18) 0%, transparent 60%)',
          }}
        />
        {/* Bottom fade to white */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 pointer-events-none h-24"
          style={{ background: 'linear-gradient(to bottom, transparent, #ffffff)' }}
        />

        <div className="relative px-4 sm:px-6 lg:px-8 pt-8 pb-16 max-w-[960px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <SearchHero />
          </motion.div>
        </div>
      </div>

      {/* ── Content below hero — white background ── */}
      <div id="main-content" className="px-4 sm:px-6 lg:px-8 pb-8 max-w-[960px] mx-auto space-y-6 -mt-2" tabIndex={-1}>
        <PopularAnalysesSection quotes={quotes} dataStale={dataStale} />
        <MarketPricingLeaderboard quotes={quotes} />
        <QuickActions />
        <RecentlyViewed />
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzePageInner />
    </Suspense>
  )
}
