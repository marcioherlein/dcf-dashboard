'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Bookmark, FileText, Search, Share2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { slideDown } from '@/lib/motion'
import { useStockNav } from '@/contexts/StockNavContext'
import { InsicLogoLockup, InsicAppIcon } from '@/components/ui/InsicLogo'

// ── Page title map — shown in TopBar when not on a stock page ─────────────────
const PAGE_TITLES: Array<{ match: (p: string) => boolean; title: string; sub?: string }> = [
  { match: (p) => p.startsWith('/markets'),    title: 'Markets',       sub: 'Indices, sectors, macro' },
  { match: (p) => p.startsWith('/etf'),        title: 'ETF Tracker',   sub: 'Value-oriented ETF lens' },
  { match: (p) => p.startsWith('/screener'),   title: 'Screener',      sub: 'NYSE & NASDAQ' },
  { match: (p) => p.startsWith('/valuations'), title: 'My Valuations', sub: 'Saved analyses' },
  { match: (p) => p.startsWith('/monitor'),    title: 'Portfolio',     sub: 'Holdings & returns' },
  { match: (p) => p.startsWith('/alerts'),     title: 'Alerts',        sub: undefined },
  { match: (p) => p === '/analyze' || p.startsWith('/analyze'), title: 'Analyze', sub: 'Stock research' },
  { match: (p) => p.startsWith('/simplifier'), title: 'Simplifier',    sub: undefined },
  { match: (p) => p.startsWith('/factor'),     title: 'Factor Ranking', sub: undefined },
  { match: (p) => p.startsWith('/compare'),    title: 'Compare',       sub: undefined },
  { match: (p) => p.startsWith('/strategies'), title: 'Strategies',    sub: undefined },
]

function getPageTitle(pathname: string): { title: string; sub?: string } | null {
  for (const entry of PAGE_TITLES) {
    if (entry.match(pathname)) return { title: entry.title, sub: entry.sub }
  }
  return null
}

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
      <div className="w-6 h-6 rounded-full bg-[#EEF4DD] border border-[#C8C8C8] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-[#5F790B] leading-none">{initials}</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={ticker}
      width={24}
      height={24}
      className="rounded-full border border-[#E5E5E5] shrink-0 object-cover"
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
        width={28}
        height={28}
        className="rounded-full ring-2 ring-[#E5E5E5] shrink-0"
      />
    )
  }

  return (
    <div
      className="w-7 h-7 rounded-full ring-2 ring-[#E5E5E5] bg-[#5F790B] flex items-center justify-center shrink-0"
      aria-label={name ?? undefined}
    >
      <span className="text-[10px] font-bold text-white leading-none">{initials}</span>
    </div>
  )
}

export default function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { stockNav, onSaveRef, onShareRef } = useStockNav()

  const pageTitle = !stockNav ? getPageTitle(pathname) : null

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [unsupportedError, setUnsupportedError] = useState<string | null>(null)
  const [isPro, setIsPro]     = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const reduced   = useReducedMotion()
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)
  const topbarListboxId = 'topbar-search-listbox'

  useEffect(() => {
    if (!session?.user?.email) return
    fetch('/api/user/plan').then(r => r.json()).then(d => setIsPro(d?.plan === 'pro')).catch(() => {})
  }, [session?.user?.email])

  async function openBillingPortal() {
    const res = await fetch('/api/lemonsqueezy/portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); setUnsupportedError(null); setSearchError(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      setSearchError(false)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setOpen(d.length > 0); setLoading(false); setActiveIdx(-1) })
        .catch(() => { setLoading(false); setSearchError(true) })
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
    const dest = match?.quoteType === 'ETF' ? `/etf/${symbol}` : `/stock/${symbol}`
    router.push(dest)
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
    const dest = match?.quoteType === 'ETF' ? `/etf/${trimmed}` : `/stock/${trimmed}`
    router.push(dest)
  }

  return (
    <header className="fixed top-0 left-0 lg:left-[240px] right-0 z-40 glass-toolbar" data-topbar>

      {/* ── Mobile page-title search overlay ── */}
      {pageTitle && !stockNav && mobileSearchOpen && (
        <div className="sm:hidden flex items-center justify-between px-3 gap-2 border-t border-[#E5E5E5] bg-white" style={{ height: '52px' }}>
          <Search size={14} className="text-[#9B9B9B] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setUnsupportedError(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && query.trim()) { handleSubmit(query); setMobileSearchOpen(false) }
              if (e.key === 'Escape') { setMobileSearchOpen(false); setQuery(''); setOpen(false) }
            }}
            placeholder="Search ticker or company…"
            className="flex-1 text-[16px] bg-transparent text-[#111111] placeholder-[#9B9B9B] focus:outline-none"
            autoFocus
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            onClick={() => { setMobileSearchOpen(false); setQuery(''); setOpen(false) }}
            className="text-[#9B9B9B] hover:text-[#111111] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Mobile stock header: single row (tabs live in TabNav below) ── */}
      {stockNav && (
        <div className="sm:hidden flex items-center justify-between px-3 gap-2" style={{ height: '52px' }}>
          {mobileSearchOpen ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search size={14} className="text-[#9B9B9B] shrink-0" />
              <input
                ref={mobileSearchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setUnsupportedError(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && query.trim()) { handleSubmit(query); setMobileSearchOpen(false) }
                  if (e.key === 'Escape') { setMobileSearchOpen(false); setQuery(''); setOpen(false) }
                }}
                placeholder="Search ticker…"
                className="flex-1 text-[16px] bg-transparent text-[#111111] placeholder-[#9B9B9B] focus:outline-none"
                autoFocus
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                onClick={() => { setMobileSearchOpen(false); setQuery(''); setOpen(false) }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#9B9B9B] hover:text-[#6B6B6B] shrink-0"
                aria-label="Close search"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <CompanyLogo ticker={stockNav.ticker} />
                <span className="font-bold text-[14px] text-[#111111] tracking-tight shrink-0">
                  {stockNav.ticker}
                </span>
                {stockNav.price != null && (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-semibold text-[13px] text-[#111111] tabular-nums">
                      {stockNav.currency}{stockNav.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {stockNav.changePct != null && (
                      <span className={cn(
                        'text-[11px] font-medium tabular-nums',
                        stockNav.changePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]',
                      )}>
                        {stockNav.changePct >= 0 ? '+' : ''}{stockNav.changePct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setMobileSearchOpen(true); setTimeout(() => mobileSearchRef.current?.focus(), 50) }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#9B9B9B] hover:text-olive-700 hover:bg-olive-50 transition-colors"
                  aria-label="Search for a stock"
                >
                  <Search size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => onShareRef.current?.()}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors"
                  aria-label="Share analysis"
                >
                  <Share2 size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => onSaveRef.current?.()}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-olive-700 text-olive-700 hover:bg-olive-50 transition-colors"
                  aria-label="Save analysis"
                >
                  <Bookmark size={16} strokeWidth={2} />
                </button>
              </div>
            </>
          )}
          {/* Mobile search results dropdown */}
          {mobileSearchOpen && open && results.length > 0 && (
            <div className="absolute left-0 right-0 z-50 bg-white border-b border-[#E5E5E5] shadow-lg" style={{ top: 'calc(52px + env(safe-area-inset-top, 0px))' }}>
              {results.slice(0, 6).map(r => (
                <button
                  key={r.symbol}
                  onClick={() => { if (!r.supported) return; select(r.symbol); setMobileSearchOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    r.supported ? 'hover:bg-olive-50' : 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <span className="font-mono font-bold text-[13px] text-[#111111] w-14 shrink-0">{r.symbol}</span>
                  <span className="text-[12px] text-[#6B6B6B] truncate flex-1">{r.longname ?? r.shortname}</span>
                  <span className="text-[10px] text-[#9B9B9B] shrink-0">{r.exchDisp ?? r.exchange}</span>
                </button>
              ))}
            </div>
          )}
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
        {/* ── Column 1: Logo — hidden on lg+ (sidebar owns that space) ── */}
        <div className="flex items-center lg:hidden">
          <Link href={session ? '/analyze' : '/'} className="flex items-center leading-none shrink-0" aria-label="insic home">
            {/* Mobile: app icon tile */}
            <InsicAppIcon size={32} className="sm:hidden" />
            {/* sm–md: full lockup */}
            <span className="hidden sm:block" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))' }}>
              <InsicLogoLockup size="md" />
            </span>
          </Link>
        </div>

        {/* ── Column 2: search bar — always centered on lg+; stock identity on sm–lg when on stock page ── */}
        {stockNav ? (
          <>
            {/* sm–lg: show stock identity (no room for search alongside sidebar) */}
            <div className="flex items-center min-w-0 gap-2 pl-1 lg:hidden">
              <CompanyLogo ticker={stockNav.ticker} />
              <span className="font-bold text-[13px] text-[#111111] tracking-tight shrink-0">
                {stockNav.ticker}
              </span>
              {stockNav.price != null && (
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="font-semibold text-[13px] text-[#111111] tabular-nums">
                    {stockNav.currency}{stockNav.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {stockNav.changePct != null && (
                    <span className={cn(
                      'text-[11px] font-medium tabular-nums',
                      stockNav.changePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]',
                    )}>
                      {stockNav.changePct >= 0 ? '+' : ''}{stockNav.changePct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* lg+: full search bar — same as non-stock pages */}
            <div className="hidden lg:flex justify-center w-full">
              <div className="relative w-full sm:w-auto sm:max-w-[480px]" ref={searchRef}>
                <div
                  className="flex items-center gap-2 rounded-[999px] px-3.5 py-2 transition-all border"
                  style={{
                    background: 'rgba(255, 255, 255, 0.80)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderColor: open ? 'rgba(95, 121, 11, 0.45)' : '#E5E5E5',
                    boxShadow: open ? '0 0 0 3px rgba(95, 121, 11, 0.09)' : 'none',
                  }}
                >
                  {loading ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#5F790B] shrink-0" />
                  ) : (
                    <Search size={14} className={searchError ? 'text-[#D83B3B] shrink-0' : 'text-[#9B9B9B] shrink-0'} />
                  )}
                  <input
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                    aria-controls={open ? topbarListboxId : undefined}
                    aria-activedescendant={activeIdx >= 0 ? `topbar-result-${activeIdx}` : undefined}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setUnsupportedError(null); setSearchError(false) }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); return }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        if (!open && results.length > 0) setOpen(true)
                        setActiveIdx(prev => Math.min(prev + 1, results.length - 1))
                        return
                      }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(prev => Math.max(prev - 1, -1)); return }
                      if (e.key === 'Enter') {
                        if (activeIdx >= 0 && results[activeIdx]?.supported) { select(results[activeIdx].symbol) }
                        else if (query.trim()) { handleSubmit(query) }
                      }
                    }}
                    placeholder="Search ticker or company…"
                    className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-[13px] text-[#111111] placeholder-[#9B9B9B] focus:outline-none"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  {searchError && !open && (
                    <span className="text-[11px] text-[#D83B3B] shrink-0 whitespace-nowrap">Search unavailable</span>
                  )}
                </div>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      key="search-dropdown-stock"
                      id={topbarListboxId}
                      role="listbox"
                      aria-label="Search suggestions"
                      variants={reduced ? {} : slideDown}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      style={{ originY: 0 }}
                      className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden glass-card-light rounded-xl z-50 max-h-[70vh] overflow-y-auto"
                    >
                      <motion.div
                        variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
                        initial="hidden"
                        animate="visible"
                      >
                        {results.map((r, idx) => (
                          <motion.button
                            key={r.symbol}
                            id={`topbar-result-${idx}`}
                            role="option"
                            aria-selected={idx === activeIdx}
                            variants={reduced ? {} : { hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0, transition: { duration: 0.16 } } }}
                            onClick={() => r.supported ? select(r.symbol) : undefined}
                            disabled={!r.supported}
                            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left border-b border-[#E5E5E5] last:border-b-0 transition-colors ${
                              idx === activeIdx ? 'bg-[#F6FAEA]' : ''
                            } ${
                              r.supported
                                ? 'hover:bg-[#F6FAEA] cursor-pointer'
                                : 'opacity-40 cursor-not-allowed'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[14px] font-bold text-[#111111] font-mono">{r.symbol}</span>
                                {r.exchange && r.supported && (
                                  <span className="text-[10px] text-[#6B6B6B] font-medium uppercase">{r.exchange}</span>
                                )}
                              </div>
                              <span className="text-[12px] text-[#6B6B6B] truncate block">{r.longname ?? r.shortname}</span>
                            </div>
                            {r.supported ? (
                              r.quoteType && (
                                <span className="shrink-0 text-[11px] font-semibold text-[#5F790B] bg-[#EEF4DD] border border-[#BFD2A1] px-2 py-0.5 rounded-md">
                                  {r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType === 'INDEX' ? 'Index' : r.quoteType}
                                </span>
                              )
                            ) : (
                              <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FFFFFF] text-[#6B6B6B] border border-[#E5E5E5] whitespace-nowrap">
                                Not available — {r.exchDisp ?? r.exchange}
                              </span>
                            )}
                          </motion.button>
                        ))}
                        {unsupportedError && (
                          <div
                            role="alert"
                            aria-live="assertive"
                            aria-atomic="true"
                            className="px-4 py-3 flex items-start gap-2 bg-[#FFF4DA] border-t border-[#F3D391]"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B56A00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <p className="text-[11px] text-[#B56A00] leading-snug">{unsupportedError}</p>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        ) : pageTitle ? (
          /* Page title — shown on named pages (Markets, ETF Tracker, etc.) */
          <div className="flex items-center gap-3 min-w-0 pl-1">
            <div className="min-w-0">
              <p className="text-[14px] font-[700] text-[#111111] leading-tight tracking-tight">
                {pageTitle.title}
              </p>
              {pageTitle.sub && (
                <p className="text-[11px] text-[#8A95A6] leading-none mt-0.5 hidden sm:block">
                  {pageTitle.sub}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            <div className="relative w-full max-w-[calc(100vw-120px)] sm:w-auto sm:max-w-[480px]" ref={searchRef}>
              <div
                className="flex items-center gap-2 rounded-[999px] px-3.5 py-2 transition-all border"
                style={{
                  background: 'rgba(255, 255, 255, 0.80)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderColor: open ? 'rgba(95, 121, 11, 0.45)' : '#E5E5E5',
                  boxShadow: open ? '0 0 0 3px rgba(95, 121, 11, 0.09)' : 'none',
                }}
              >
                {loading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#5F790B] shrink-0" />
                ) : (
                  <Search size={14} className={searchError ? 'text-[#D83B3B] shrink-0' : 'text-[#9B9B9B] shrink-0'} />
                )}
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={open}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  aria-controls={open ? topbarListboxId : undefined}
                  aria-activedescendant={activeIdx >= 0 ? `topbar-result-${activeIdx}` : undefined}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setUnsupportedError(null); setSearchError(false) }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); return }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      if (!open && results.length > 0) setOpen(true)
                      setActiveIdx(prev => Math.min(prev + 1, results.length - 1))
                      return
                    }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(prev => Math.max(prev - 1, -1)); return }
                    if (e.key === 'Enter') {
                      if (activeIdx >= 0 && results[activeIdx]?.supported) { select(results[activeIdx].symbol) }
                      else if (query.trim()) { handleSubmit(query) }
                    }
                  }}
                  placeholder="Search ticker or company…"
                  className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-[13px] text-[#111111] placeholder-[#9B9B9B] focus:outline-none"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                {searchError && !open && (
                  <span className="text-[11px] text-[#D83B3B] shrink-0 whitespace-nowrap">Search unavailable</span>
                )}
              </div>

              <AnimatePresence>
                {open && (
                  <motion.div
                    key="search-dropdown"
                    id={topbarListboxId}
                    role="listbox"
                    aria-label="Search suggestions"
                    variants={reduced ? {} : slideDown}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={{ originY: 0 }}
                    className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden glass-card-light rounded-xl z-50 max-h-[70vh] overflow-y-auto"
                  >
                    <motion.div
                      variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
                      initial="hidden"
                      animate="visible"
                    >
                      {results.map((r, idx) => (
                        <motion.button
                          key={r.symbol}
                          id={`topbar-result-${idx}`}
                          role="option"
                          aria-selected={idx === activeIdx}
                          variants={reduced ? {} : { hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0, transition: { duration: 0.16 } } }}
                          onClick={() => r.supported ? select(r.symbol) : undefined}
                          disabled={!r.supported}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left border-b border-[#E5E5E5] last:border-b-0 transition-colors ${
                            idx === activeIdx ? 'bg-[#F6FAEA]' : ''
                          } ${
                            r.supported
                              ? 'hover:bg-[#F6FAEA] cursor-pointer'
                              : 'opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[14px] font-bold text-[#111111] font-mono">{r.symbol}</span>
                              {r.exchange && r.supported && (
                                <span className="text-[10px] text-[#6B6B6B] font-medium uppercase">{r.exchange}</span>
                              )}
                            </div>
                            <span className="text-[12px] text-[#6B6B6B] truncate block">{r.longname ?? r.shortname}</span>
                          </div>
                          {r.supported ? (
                            r.quoteType && (
                              <span className="shrink-0 text-[11px] font-semibold text-[#5F790B] bg-[#EEF4DD] border border-[#BFD2A1] px-2 py-0.5 rounded-md">
                                {r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType === 'INDEX' ? 'Index' : r.quoteType}
                              </span>
                            )
                          ) : (
                            <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FFFFFF] text-[#6B6B6B] border border-[#E5E5E5] whitespace-nowrap">
                              Not available — {r.exchDisp ?? r.exchange}
                            </span>
                          )}
                        </motion.button>
                      ))}

                      {unsupportedError && (
                        <div className="px-4 py-3 flex items-start gap-2 bg-[#FFF4DA] border-t border-[#F3D391]">
                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B56A00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          <p className="text-[11px] text-[#B56A00] leading-snug">{unsupportedError}</p>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Column 3: stock identity (lg only) + save + auth + search (page-title mode) ── */}
        <div className="flex items-center gap-2 sm:gap-3 justify-end min-w-0">

          {/* Search icon — shown on page-title pages so user can still search on mobile */}
          {pageTitle && !stockNav && (
            <button
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Search stocks"
              className="flex items-center justify-center min-w-[44px] min-h-[44px] text-[#6B6B6B] hover:text-[#111111] transition-colors"
            >
              <Search size={16} />
            </button>
          )}

          {/* On desktop, show stock identity here (search is in col 2 instead) */}
          {stockNav && (
            <div className="hidden lg:flex items-center gap-2 pl-1 border-r border-[#E5E5E5] pr-3 mr-1 shrink-0">
              <CompanyLogo ticker={stockNav.ticker} />
              <span className="font-bold text-[13px] text-[#111111] tracking-tight">
                {stockNav.ticker}
              </span>
              {stockNav.price != null && (
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-[13px] text-[#111111] tabular-nums">
                    {stockNav.currency}{stockNav.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {stockNav.changePct != null && (
                    <span className={cn(
                      'text-[11px] font-medium tabular-nums',
                      stockNav.changePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]',
                    )}>
                      {stockNav.changePct >= 0 ? '+' : ''}{stockNav.changePct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {stockNav && (
            <button
              onClick={() => onShareRef.current?.()}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6B6B6B] px-3 py-1.5 rounded-lg border border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
              aria-label="Share analysis"
            >
              <Share2 size={13} strokeWidth={2} />
              Share
            </button>
          )}

          {stockNav && (
            <a
              href="/pricing"
              className="hidden sm:flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6B6B6B] px-3 py-1.5 rounded-lg border border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
              aria-label="Export as PDF (Pro feature)"
              title="Pro feature — upgrade to export"
            >
              <FileText size={13} strokeWidth={2} />
              PDF
              <span className="ml-1 text-[9px] font-bold bg-[#EEF4DD] text-[#5F790B] px-1 py-0.5 rounded">PRO</span>
            </a>
          )}

          {stockNav && (
            <button
              onClick={() => onSaveRef.current?.()}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-olive-700 px-3 py-1.5 rounded-lg border border-olive-700 bg-white hover:bg-olive-50 transition-colors whitespace-nowrap"
            >
              <Bookmark size={13} strokeWidth={2} />
              Save
            </button>
          )}

          {session ? (
            <div className="flex items-center gap-2 shrink-0 lg:hidden">
              <UserAvatar
                image={session.user?.image ?? null}
                name={session.user?.name ?? null}
              />
              {isPro && (
                <button
                  onClick={openBillingPortal}
                  className="text-[12px] text-[#6B6B6B] hover:text-[#111111] transition-colors whitespace-nowrap hidden sm:block"
                >
                  Billing
                </button>
              )}
              <button
                onClick={() => signOut()}
                className="text-[12px] text-[#6B6B6B] hover:text-[#111111] transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => signIn('google')}
                className="text-[12.5px] text-white px-3.5 py-2.5 min-h-[44px] rounded-[10px] transition-colors font-semibold bg-[#5F790B] hover:bg-[#526A08] active:bg-[#4A5E07] shadow-sm whitespace-nowrap"
              >
                Get started free
              </button>
              <button
                onClick={() => signIn('google')}
                className="text-[12.5px] text-[#6B6B6B] hover:text-[#111111] transition-colors whitespace-nowrap hidden md:block"
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
