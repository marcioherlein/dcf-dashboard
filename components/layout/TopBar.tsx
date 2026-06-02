'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ChevronLeft, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { slideDown } from '@/lib/motion'
import { useStockNav } from '@/contexts/StockNavContext'
import type { TabId } from '@/components/stock/TabNav'

const STOCK_TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'valuation',  label: 'Valuation'  },
  { id: 'financials', label: 'Financials' },
  { id: 'risks',      label: 'Risks'      },
  { id: 'news',       label: 'News'       },
]

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchange?: string
  exchDisp?: string
  quoteType?: string
  supported: boolean
}

function CompanyLogo({ ticker }: { ticker: string }) {
  const [failed, setFailed] = useState(false)
  const src = `https://financialmodelingprep.com/image-stock/${ticker}.png`
  const initials = ticker.slice(0, 2).toUpperCase()

  if (failed) {
    return (
      <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold text-blue-700 leading-none">{initials}</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={ticker}
      width={24}
      height={24}
      className="rounded-full border border-slate-200 shrink-0 object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function UserAvatar({ image, name }: { image: string | null; name: string | null }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? ''}
        width={26}
        height={26}
        className="rounded-full ring-2 ring-blue-200 shrink-0"
      />
    )
  }

  return (
    <div
      className="w-[26px] h-[26px] rounded-full ring-2 ring-blue-200 bg-blue-600 flex items-center justify-center shrink-0"
      aria-label={name ?? undefined}
    >
      <span className="text-[10px] font-bold text-white leading-none">{initials}</span>
    </div>
  )
}

export default function TopBar() {
  const router = useRouter()
  const { data: session } = useSession()
  const { stockNav, onTabChangeRef, onSaveRef } = useStockNav()

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [unsupportedError, setUnsupportedError] = useState<string | null>(null)
  const reduced   = useReducedMotion()
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); setUnsupportedError(null); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setOpen(d.length > 0); setLoading(false) })
        .catch(() => setLoading(false))
    }, 300)
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (symbol: string) => {
    const match = results.find(r => r.symbol === symbol)
    if (match && !match.supported) return
    setOpen(false); setQuery(''); setUnsupportedError(null)
    router.push(`/stock/${symbol}`)
  }

  const handleSubmit = (raw: string) => {
    const trimmed = raw.trim().toUpperCase()
    if (!trimmed) return
    const match = results.find(r => r.symbol.toUpperCase() === trimmed)
    if (match && !match.supported) {
      const exch = match.exchDisp ?? match.exchange ?? 'a foreign exchange'
      setUnsupportedError(`${match.symbol} trades on ${exch} — we only cover NYSE and NASDAQ stocks.`)
      setOpen(false)
      return
    }
    setOpen(false); setQuery(''); setUnsupportedError(null)
    router.push(`/stock/${trimmed}`)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass-toolbar">

      {/* ── Mobile two-row stock header (hidden on sm+) ── */}
      {stockNav && (
        <div className="sm:hidden flex flex-col" style={{ height: '88px' }}>
          {/* Row 1: back + identity + save icon */}
          <div className="h-[52px] flex items-center justify-between px-3 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={() => router.push('/analyze')}
                aria-label="Back to Analyze"
                className="text-slate-400 hover:text-blue-600 transition-colors shrink-0 p-1 -ml-1"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <CompanyLogo ticker={stockNav.ticker} />
              <span className="font-bold text-[14px] text-slate-900 tracking-tight shrink-0">
                {stockNav.ticker}
              </span>
              {stockNav.price != null && (
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-semibold text-[13px] text-slate-800 tabular-nums">
                    {stockNav.currency}{stockNav.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {stockNav.changePct != null && (
                    <span className={cn(
                      'text-[11px] font-medium tabular-nums',
                      stockNav.changePct >= 0 ? 'text-emerald-600' : 'text-red-500',
                    )}>
                      {stockNav.changePct >= 0 ? '+' : ''}{stockNav.changePct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Save icon only (no text label on mobile) */}
            <button
              onClick={() => onSaveRef.current?.()}
              className="shrink-0 p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
              aria-label="Save analysis"
            >
              <Bookmark size={18} strokeWidth={2} />
            </button>
          </div>
          {/* Row 2: scrollable tabs */}
          <div className="h-9 border-t border-slate-100 flex overflow-x-auto scrollbar-hide px-1" role="tablist" style={{ overscrollBehaviorX: 'contain' }}>
            {STOCK_TABS.map(({ id, label }) => {
              const active = stockNav.activeTab === id
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChangeRef.current?.(id)}
                  className={cn(
                    'relative flex items-center px-3 text-[12px] font-medium whitespace-nowrap transition-colors shrink-0 h-full',
                    active ? 'text-blue-600' : 'text-slate-500',
                  )}
                >
                  {label}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Desktop / non-stock: single 52px row ── */}
      <div
        className={cn(
          stockNav ? 'hidden sm:grid' : 'grid',
          'relative px-3 sm:px-4'
        )}
        style={{
          height: '52px',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* ── Column 1: Logo + name ── */}
        {/* On non-stock pages hide logo entirely on mobile to give search bar full width */}
        <div className={cn('flex items-center', !stockNav && 'hidden sm:flex')}>
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <Image
              src="/logos/logo-transparent.png"
              alt="intrinsico"
              width={28}
              height={28}
              className="shrink-0"
            />
            {!stockNav && (
              <span className="hidden sm:block text-[15px] font-bold tracking-tight text-slate-800 group-hover:text-blue-600 transition-colors select-none">
                intrinsico
              </span>
            )}
          </Link>
        </div>

        {/* ── Column 2: centered search OR stock identity + tabs ── */}
        {stockNav ? (
          <div className="flex items-center min-w-0 gap-0">
            {/* Identity + price */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pr-2 sm:pr-4 border-r border-slate-100 mr-1">
              <button
                onClick={() => router.push('/analyze')}
                aria-label="Back to Analyze"
                className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </button>
              {/* Company logo */}
              <CompanyLogo ticker={stockNav.ticker} />
              <span className="font-bold text-[13px] text-slate-900 tracking-tight shrink-0">
                {stockNav.ticker}
              </span>
              {stockNav.price != null && (
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="font-semibold text-[13px] text-slate-800 tabular-nums">
                    {stockNav.currency}{stockNav.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {stockNav.changePct != null && (
                    <span className={cn(
                      'text-[11px] font-medium tabular-nums hidden sm:inline',
                      stockNav.changePct >= 0 ? 'text-emerald-600' : 'text-red-500',
                    )}>
                      {stockNav.changePct >= 0 ? '+' : ''}{stockNav.changePct.toFixed(2)}%
                      {stockNav.changePct >= 0 ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Tabs — flex-1 min-w-0 so overflow-x-auto actually constrains scrolling */}
            <div className="flex flex-1 min-w-0 overflow-x-auto scrollbar-hide" role="tablist">
              {STOCK_TABS.map(({ id, label }) => {
                const active = stockNav.activeTab === id
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => onTabChangeRef.current?.(id)}
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 sm:px-3.5 text-[12px] font-medium whitespace-nowrap transition-colors shrink-0 h-[52px]',
                      active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800',
                    )}
                  >
                    {label}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          /* Wide centered search for non-stock pages */
          <div className="flex justify-center w-full mx-3 sm:mx-0">
            <div className="relative w-full sm:w-auto sm:max-w-[480px]" ref={searchRef}>
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all border"
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderColor: open ? 'rgba(99,102,241,0.35)' : 'rgba(148,163,184,0.35)',
                  boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
                }}
              >
                {loading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 shrink-0" />
                ) : (
                  <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
                  </svg>
                )}
                <input
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setUnsupportedError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter' && query.trim()) handleSubmit(query) }}
                  placeholder="Search tickers…"
                  className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <AnimatePresence>
                {open && (
                  <motion.div
                    key="search-dropdown"
                    variants={reduced ? {} : slideDown}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={{ originY: 0 }}
                    className="absolute left-0 right-0 top-full mt-1 overflow-hidden glass-card-light rounded-xl z-50 max-h-[70vh] overflow-y-auto"
                  >
                    <motion.div
                      variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
                      initial="hidden"
                      animate="visible"
                    >
                      {results.map(r => (
                        <motion.button
                          key={r.symbol}
                          variants={reduced ? {} : { hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0, transition: { duration: 0.18 } } }}
                          onClick={() => r.supported ? select(r.symbol) : undefined}
                          disabled={!r.supported}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-b-0 transition-colors ${
                            r.supported
                              ? 'hover:bg-slate-50 cursor-pointer'
                              : 'opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[14px] font-bold text-slate-800 font-mono">{r.symbol}</span>
                              {r.exchange && r.supported && (
                                <span className="text-[10px] text-slate-400 font-medium uppercase">{r.exchange}</span>
                              )}
                            </div>
                            <span className="text-[12px] text-slate-500 truncate block">{r.longname ?? r.shortname}</span>
                          </div>
                          {r.supported ? (
                            r.quoteType && (
                              <span className="shrink-0 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                                {r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType === 'INDEX' ? 'Index' : r.quoteType}
                              </span>
                            )
                          ) : (
                            <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 whitespace-nowrap">
                              Not available — {r.exchDisp ?? r.exchange}
                            </span>
                          )}
                        </motion.button>
                      ))}

                      {/* Unsupported error inline */}
                      {unsupportedError && (
                        <div className="px-4 py-3 flex items-start gap-2 bg-amber-50 border-t border-amber-100">
                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          <p className="text-[11px] text-amber-700 leading-snug">{unsupportedError}</p>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Column 3: watchlist button (stock only) + search (stock only) + auth ── */}
        <div className="flex items-center gap-2 sm:gap-3 justify-end min-w-0">

          {/* "Save analysis" — only on stock pages */}
          {stockNav && (
            <button
              onClick={() => onSaveRef.current?.()}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-white px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap shadow-sm"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Save analysis
            </button>
          )}

          {session ? (
            <div className="flex items-center gap-2 shrink-0">
              <UserAvatar
                image={session.user?.image ?? null}
                name={session.user?.name ?? null}
              />
              <button
                onClick={() => signOut()}
                className="text-[12px] text-slate-400 hover:text-slate-700 transition-colors whitespace-nowrap hidden sm:block"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => signIn('google')}
                className="text-[12px] text-white px-3 py-1.5 rounded-lg transition-all font-semibold bg-blue-600 hover:bg-blue-500 shadow-sm whitespace-nowrap"
              >
                Start free trial
              </button>
              <button
                onClick={() => signIn('google')}
                className="text-[12px] text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap hidden md:block"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
