'use client'
import { useState, useEffect, useRef, useId } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Bookmark, FileText, Search, Share2, X, BarChart2, DollarSign, Table2, Award, Newspaper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { slideDown } from '@/lib/motion'
import { useStockNav } from '@/contexts/StockNavContext'
import { useTopBarTabs } from '@/contexts/TopBarTabsContext'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'
import type { TabId } from '@/components/stock/TabNav'

// ── Page title map — shown in TopBar when not on a stock page ─────────────────
const PAGE_TITLES: Array<{ match: (p: string) => boolean; title: string; sub?: string }> = [
  { match: (p) => p.startsWith('/markets'),    title: 'Markets',       sub: 'Indices, sectors, macro' },
  { match: (p) => p.startsWith('/etf'),        title: 'ETF Tracker',   sub: 'Value-oriented ETF lens' },
  { match: (p) => p.startsWith('/screener'),   title: 'Screener',      sub: 'NYSE & NASDAQ' },
  { match: (p) => p.startsWith('/valuations'), title: 'Watchlist',      sub: 'Your saved stocks' },
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
      <div className="w-6 h-6 rounded-full bg-[#EEF2FA] border border-[#C8C8C8] flex items-center justify-center shrink-0">
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

// ── Stock tab pills — rendered inside the floating pill ──────────────────────
// These mirror the TABS in TabNav but render as compact pill buttons with
// the same spring animation. Uses StockNavContext for active tab + onChange.

const STOCK_TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'overview',   label: 'Overview',   Icon: BarChart2  },
  { id: 'valuation',  label: 'Valuation',  Icon: DollarSign },
  { id: 'conviction', label: 'Conviction', Icon: Award      },
  { id: 'financials', label: 'Financials', Icon: Table2     },
  { id: 'news',       label: 'News',       Icon: Newspaper  },
]

function StockTabPills() {
  const { stockNav, onTabChangeRef } = useStockNav()
  const pillId = useId()
  const reduced = useReducedMotion()

  if (!stockNav) return null
  const activeTab = stockNav.activeTab

  return (
    <>
      {STOCK_TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onTabChangeRef.current?.(id)}
            style={{ padding: '6px 8px' }}
            className={cn(
              'relative flex items-center gap-1.5 rounded-[10px] whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(95,121,11,0.7)]',
              'text-[13px] sm:gap-1.5',
              active ? 'text-white font-[650]' : 'text-[rgba(255,255,255,0.42)] hover:text-[rgba(255,255,255,0.80)] font-[500]',
            )}
          >
            {active && (
              <motion.span
                layoutId={`${pillId}-stock-tab`}
                className="absolute inset-0 rounded-[10px]"
                style={{
                  background: 'rgba(255,255,255,0.13)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }}
                aria-hidden="true"
              />
            )}
            <Icon
              size={13}
              className={cn('relative z-10 shrink-0', active ? 'text-[#7CB518]' : 'text-[rgba(255,255,255,0.30)]')}
              aria-hidden="true"
            />
            {/* sm+: show full label. mobile: icon only — saves ~100px in the tab row */}
            <span className="relative z-10 hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </>
  )
}

// ── Reusable search bar for non-stock pages ───────────────────────────────────

interface NonStockSearchBarProps {
  query: string; setQuery: (v: string) => void
  open: boolean; loading: boolean; searchError: boolean
  activeIdx: number; results: SearchResult[]
  unsupportedError: string | null
  topbarListboxId: string
  reduced: boolean | null
  searchRef: React.RefObject<HTMLDivElement>
  select: (symbol: string) => void
  handleSubmit: (raw: string) => void
  setOpen: (v: boolean) => void
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>
  setUnsupportedError: (v: string | null) => void
  setSearchError: (v: boolean) => void
  maxWidth: string
  onFocus?: () => void
  onBlur?: () => void
}

function NonStockSearchBar({
  query, setQuery, open, loading, searchError, activeIdx, results, unsupportedError,
  topbarListboxId, reduced, searchRef, select, handleSubmit,
  setOpen, setActiveIdx, setUnsupportedError, setSearchError, maxWidth,
  onFocus, onBlur,
}: NonStockSearchBarProps) {
  return (
    <div className="relative w-full" style={{ maxWidth }} ref={searchRef}>
      <div
        className="flex items-center gap-2 rounded-[999px] px-3.5 py-2 transition-all border"
        style={{
          background: open ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: open ? 'rgba(95,121,11,0.45)' : 'rgba(0,0,0,0.13)',
          boxShadow: open
            ? '0 0 0 3px rgba(95,121,11,0.09), 0 2px 8px rgba(0,0,0,0.08)'
            : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {loading
          ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#5F790B] shrink-0" />
          : <Search size={14} className={searchError ? 'text-[#D83B3B] shrink-0' : 'text-[#9B9B9B] shrink-0'} />
        }
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
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); return }
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open && results.length > 0) setOpen(true); setActiveIdx(prev => Math.min(prev + 1, results.length - 1)); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(prev => Math.max(prev - 1, -1)); return }
            if (e.key === 'Enter') {
              if (activeIdx >= 0 && results[activeIdx]?.supported) select(results[activeIdx].symbol)
              else if (query.trim()) handleSubmit(query)
            }
          }}
          placeholder="Search ticker or company…"
          className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-[13px] text-[#111111] placeholder-[#9B9B9B] focus:outline-none"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        {searchError && !open && <span className="text-[11px] text-[#D83B3B] shrink-0 whitespace-nowrap">Search unavailable</span>}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            key="search-dropdown"
            id={topbarListboxId}
            role="listbox"
            aria-label="Search suggestions"
            variants={reduced ? {} : slideDown}
            initial="hidden" animate="visible" exit="exit"
            style={{ originY: 0 }}
            className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden glass-card-light rounded-xl z-50 max-h-[70vh] overflow-y-auto"
          >
            <motion.div
              variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
              initial="hidden" animate="visible"
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
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left border-b border-[#E5E5E5] last:border-b-0 transition-colors ${idx === activeIdx ? 'bg-[#F6FAEA]' : ''} ${r.supported ? 'hover:bg-[#F6FAEA] cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-bold text-[#111111] font-mono">{r.symbol}</span>
                      {r.exchange && r.supported && <span className="text-[10px] text-[#6B6B6B] font-medium uppercase">{r.exchange}</span>}
                    </div>
                    <span className="text-[12px] text-[#6B6B6B] truncate block">{r.longname ?? r.shortname}</span>
                  </div>
                  {r.supported
                    ? r.quoteType && <span className="shrink-0 text-[11px] font-semibold text-[#5F790B] bg-[#EEF2FA] border border-[#BFD2A1] px-2 py-0.5 rounded-md">{r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType}</span>
                    : <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white text-[#6B6B6B] border border-[#E5E5E5] whitespace-nowrap">Not available — {r.exchDisp ?? r.exchange}</span>
                  }
                </motion.button>
              ))}
              {unsupportedError && (
                <div role="alert" className="px-4 py-3 flex items-start gap-2 bg-[#FFF4DA] border-t border-[#F3D391]">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B56A00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  <p className="text-[11px] text-[#B56A00] leading-snug">{unsupportedError}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Liquid glass shared style ────────────────────────────────────────────────
// Applied to all four pills. display:flex + align-items:center included
// so spreading onto a div gives full layout + visual treatment.

const PILL_H = 40

function glassPill(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    height: PILL_H,
    background: 'rgba(20, 30, 48, 0.68)',
    backdropFilter: 'blur(28px) saturate(200%)',
    WebkitBackdropFilter: 'blur(28px) saturate(200%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: [
      '0 8px 32px rgba(0,0,0,0.32)',
      'inset 0 1px 0 rgba(255,255,255,0.12)',
      'inset 0 -1px 0 rgba(0,0,0,0.20)',
    ].join(', '),
    borderRadius: 14,
    ...extra,
  }
}

// ── Stock floating bar ───────────────────────────────────────────────────────

interface StockFloatingBarProps {
  stockNav: import('@/contexts/StockNavContext').StockNavState
  onSaveRef: React.MutableRefObject<(() => void) | null>
  onShareRef: React.MutableRefObject<(() => void) | null>
  query: string; setQuery: (v: string) => void
  results: SearchResult[]; open: boolean; loading: boolean
  searchError: boolean; activeIdx: number
  unsupportedError: string | null; topbarListboxId: string
  reduced: boolean | null
  select: (s: string) => void
  handleSubmit: (raw: string) => void
  setOpen: (v: boolean) => void
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>
  setUnsupportedError: (v: string | null) => void
  setSearchError: (v: boolean) => void
}

function StockFloatingBar({
  stockNav, onSaveRef, onShareRef,
  query, setQuery, results, open, loading,
  searchError: _searchError, activeIdx, unsupportedError, topbarListboxId,
  reduced: _reduced, select, handleSubmit,
  setOpen, setActiveIdx, setUnsupportedError, setSearchError,
}: StockFloatingBarProps) {
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!searchExpanded) return
    const h = (e: MouseEvent) => {
      if (searchPillRef.current && !searchPillRef.current.contains(e.target as Node)) {
        setSearchExpanded(false); setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [searchExpanded, setOpen])

  const openSearch = () => { setSearchExpanded(true); setTimeout(() => searchInputRef.current?.focus(), 60) }
  const closeSearch = () => { setSearchExpanded(false); setQuery(''); setOpen(false) }

  return (
    // Full-width row, 52px tall, transparent — pills float inside it
    <div
      className="pointer-events-auto flex items-center gap-2 px-4 sm:px-6"
      style={{ height: 52 }}
    >

      {/* ── Pill 1: Tabs (left-aligned, takes natural width) ──────────────── */}
      <nav
        style={glassPill({ padding: '0 6px', gap: 2, flexShrink: 0 })}
        role="tablist"
        aria-label="Stock sections"
      >
        <StockTabPills />
      </nav>

      {/* ── Spacer ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0" />

      {/* ── Right group: stock · features · search ────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Pill 2: Stock identity */}
        <div style={glassPill({ padding: '0 12px', gap: 8 })}>
          <CompanyLogo ticker={stockNav.ticker} />
          <span className="font-[700] text-[13.5px] text-white tracking-tight leading-none">
            {stockNav.ticker}
          </span>
          {stockNav.price != null && (
            <span className="text-[13px] font-[500] text-[rgba(255,255,255,0.72)] tabular-nums hidden sm:block">
              {stockNav.currency}{stockNav.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {stockNav.changePct != null && (
            <span
              className="text-[12px] font-[650] tabular-nums hidden sm:block"
              style={{ color: stockNav.changePct >= 0 ? '#4ade80' : '#fca5a5' }}
            >
              {stockNav.changePct >= 0 ? '+' : ''}{stockNav.changePct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Pill 3: Features */}
        <div style={glassPill({ padding: '0 6px', gap: 2 })}>
          <button
            onClick={() => onShareRef.current?.()}
            className="flex items-center justify-center rounded-xl text-[rgba(255,255,255,0.55)] hover:text-white hover:bg-[rgba(255,255,255,0.10)] transition-all"
            style={{ width: 32, height: 32 }}
            aria-label="Share analysis"
          >
            <Share2 size={15} strokeWidth={1.8} />
          </button>
          <a
            href="/pricing"
            title="Pro — upgrade to export"
            className="hidden sm:flex items-center justify-center rounded-xl text-[rgba(255,255,255,0.55)] hover:text-white hover:bg-[rgba(255,255,255,0.10)] transition-all"
            style={{ width: 32, height: 32 }}
            aria-label="Export PDF (Pro)"
          >
            <FileText size={15} strokeWidth={1.8} />
          </a>
          <button
            onClick={() => onSaveRef.current?.()}
            className="flex items-center gap-1.5 rounded-xl text-[12px] font-[650] transition-colors"
            style={{
              height: 30, paddingLeft: 10, paddingRight: 12,
              background: 'rgba(95,121,11,0.30)',
              border: '1px solid rgba(124,154,25,0.40)',
              color: '#a3e635',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(95,121,11,0.50)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(95,121,11,0.30)' }}
            aria-label="Save valuation"
          >
            <Bookmark size={13} strokeWidth={2} />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>

        {/* Pill 4: Search — collapses to icon, springs open on click */}
        <div ref={searchPillRef} className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {!searchExpanded ? (
              <motion.button
                key="search-collapsed"
                initial={{ opacity: 0, scale: 0.80 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.80 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                onClick={openSearch}
                aria-label="Search for a stock"
                className="flex items-center justify-center text-[rgba(255,255,255,0.55)] hover:text-white transition-colors"
                style={glassPill({ width: PILL_H, padding: 0, justifyContent: 'center' })}
              >
                <Search size={16} strokeWidth={1.8} />
              </motion.button>
            ) : (
              <motion.div
                key="search-expanded"
                initial={{ opacity: 0, scaleX: 0.6, originX: 1 }}
                animate={{ opacity: 1, scaleX: 1, originX: 1 }}
                exit={{ opacity: 0, scaleX: 0.6, originX: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="flex items-center gap-2"
                style={glassPill({
                  padding: '0 12px',
                  width: 'min(280px, 48vw)',
                  border: '1px solid rgba(124,154,25,0.50)',
                  boxShadow: '0 0 0 3px rgba(95,121,11,0.16), 0 8px 32px rgba(0,0,0,0.32)',
                })}
              >
                {loading
                  ? <div className="w-3.5 h-3.5 rounded-full border-2 border-[rgba(255,255,255,0.15)] border-t-[#7CB518] animate-spin shrink-0" />
                  : <Search size={14} className="text-[rgba(255,255,255,0.40)] shrink-0" strokeWidth={1.8} />
                }
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setUnsupportedError(null); setSearchError(false) }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { closeSearch(); setActiveIdx(-1) }
                    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!open && results.length > 0) setOpen(true); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
                    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
                    else if (e.key === 'Enter') {
                      if (activeIdx >= 0 && results[activeIdx]?.supported) select(results[activeIdx].symbol)
                      else if (query.trim()) handleSubmit(query)
                    }
                  }}
                  placeholder="Ticker or company…"
                  className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder-[rgba(255,255,255,0.28)] focus:outline-none"
                  autoCorrect="off" autoCapitalize="characters" spellCheck={false}
                />
                <button
                  onClick={closeSearch}
                  className="text-[rgba(255,255,255,0.35)] hover:text-white transition-colors shrink-0"
                  aria-label="Close search"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search results dropdown */}
          {searchExpanded && open && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="absolute right-0 overflow-hidden rounded-[14px] z-50"
              style={{
                top: PILL_H + 6,
                width: 'min(320px, 80vw)',
                background: 'rgba(16, 24, 40, 0.98)',
                backdropFilter: 'blur(32px) saturate(200%)',
                WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.48)',
              }}
              role="listbox"
              id={topbarListboxId}
            >
              {results.slice(0, 6).map((r, idx) => (
                <button
                  key={r.symbol}
                  id={`topbar-result-${idx}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  onClick={() => { if (!r.supported) return; select(r.symbol); closeSearch() }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0 text-left transition-colors',
                    r.supported ? 'hover:bg-[rgba(95,121,11,0.14)] cursor-pointer' : 'opacity-40 cursor-not-allowed',
                    idx === activeIdx ? 'bg-[rgba(95,121,11,0.14)]' : '',
                  )}
                >
                  <span className="font-mono font-bold text-[13px] text-white w-14 shrink-0">{r.symbol}</span>
                  <span className="text-[12px] text-[rgba(255,255,255,0.50)] truncate flex-1">{r.longname ?? r.shortname}</span>
                </button>
              ))}
              {unsupportedError && (
                <div className="px-4 py-3 border-t border-[rgba(181,106,0,0.30)] bg-[rgba(181,106,0,0.10)]">
                  <p className="text-[11px] text-[#fcd34d] leading-snug">{unsupportedError}</p>
                </div>
              )}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  )
}


export default function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { stockNav, onSaveRef, onShareRef } = useStockNav()

  const pageTitle = !stockNav ? getPageTitle(pathname) : null
  const { tabsState } = useTopBarTabs()
  const pagePillId = useId()
  const pageTabSpring = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 } as const

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [unsupportedError, setUnsupportedError] = useState<string | null>(null)
  const [isPro, setIsPro]     = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const _mobileSearchRef = useRef<HTMLInputElement>(null)
  const reduced   = useReducedMotion()
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)
  const topbarListboxId = 'topbar-search-listbox'
  const expandSpring = { type: 'spring', stiffness: 420, damping: 36 } as const

  useEffect(() => {
    if (!session?.user?.email) return
    fetch('/api/user/plan').then(r => r.json()).then(d => setIsPro(d?.plan === 'pro')).catch(() => {})
  }, [session?.user?.email])

  async function openBillingPortal() {
    window.open('https://www.paypal.com/myaccount/autopay', '_blank', 'noopener,noreferrer')
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
    setOpen(false); setQuery(''); setUnsupportedError(null); setSearchExpanded(false)
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
    setOpen(false); setQuery(''); setUnsupportedError(null); setSearchExpanded(false)
    const dest = match?.quoteType === 'ETF' ? `/etf/${trimmed}` : `/stock/${trimmed}`
    router.push(dest)
  }

  return (
    <header
      className="fixed top-0 left-0 lg:left-[192px] right-0 z-40 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      data-topbar
    >

      {/* ══════════════════════════════════════════════════════════════════════
          STOCK PAGE — four separate liquid-glass pills, no background
          ══════════════════════════════════════════════════════════════════════ */}
      {stockNav && (
        <StockFloatingBar
          stockNav={stockNav}
          onSaveRef={onSaveRef}
          onShareRef={onShareRef}
          query={query} setQuery={setQuery}
          results={results} open={open} loading={loading}
          searchError={searchError} activeIdx={activeIdx}
          unsupportedError={unsupportedError}
          topbarListboxId={topbarListboxId}
          reduced={reduced}
          select={select} handleSubmit={handleSubmit}
          setOpen={setOpen} setActiveIdx={setActiveIdx}
          setUnsupportedError={setUnsupportedError}
          setSearchError={setSearchError}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          NON-STOCK PAGES — standard topbar with background
          ══════════════════════════════════════════════════════════════════════ */}
      {!stockNav && (
        <div className="glass-toolbar pointer-events-auto" style={{ borderBottom: '1px solid #E3E1DA' }}>
          {/* ── Mobile: search overlay when mobileSearchOpen ─────────── */}
          {pageTitle && mobileSearchOpen && (
            <div className="sm:hidden flex items-center justify-between px-3 gap-2 bg-white" style={{ height: '52px' }}>
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
                autoFocus autoCorrect="off" autoCapitalize="characters" spellCheck={false}
              />
              {open && results.length > 0 && (
                <div className="absolute left-0 right-0 top-[52px] overflow-hidden glass-card-light rounded-xl z-50 max-h-[60vh] overflow-y-auto border border-[#E5E5E5] shadow-lg">
                  {results.map((r) => (
                    <button
                      key={r.symbol}
                      onClick={() => { if (r.supported) { select(r.symbol); setMobileSearchOpen(false) } }}
                      disabled={!r.supported}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left border-b border-[#F5F5F5] last:border-b-0 ${r.supported ? 'hover:bg-[#F6FAEA] active:bg-[#F6FAEA]' : 'opacity-40'}`}
                    >
                      <div className="min-w-0">
                        <span className="text-[15px] font-bold text-[#111111] font-mono block">{r.symbol}</span>
                        <span className="text-[12px] text-[#6B6B6B] truncate block">{r.longname ?? r.shortname}</span>
                      </div>
                      {r.supported && r.quoteType && (
                        <span className="shrink-0 text-[11px] font-semibold text-[#5F790B] bg-[#EEF2FA] border border-[#BFD2A1] px-2 py-0.5 rounded-md">{r.quoteType === 'EQUITY' ? 'Stock' : r.quoteType}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setMobileSearchOpen(false); setQuery(''); setOpen(false) }}
                className="text-[#9B9B9B] hover:text-[#111111] min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close search"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div
            className="relative px-3 sm:px-4 grid"
            style={{ height: '52px', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '8px' }}
          >
            {/* Col 1: Logo — always show lockup, no dual-image switching */}
            <div className="flex items-center lg:hidden">
              <Link href={session ? '/analyze' : '/'} className="flex items-center leading-none shrink-0" aria-label="insic home">
                <InsicLogoLockup size="md" />
              </Link>
            </div>

            {/* Col 2: page title + tabs + search (desktop)  |  just search (mobile when expanded) */}
            {pageTitle ? (
              <>
                {/* Mobile: hidden when search overlay is open */}
                <div className={`flex items-center gap-3 min-w-0 pl-1 lg:hidden ${mobileSearchOpen ? 'hidden' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-[14px] font-[700] text-[#111111] leading-tight tracking-tight">{pageTitle.title}</p>
                    {pageTitle.sub && <p className="text-[11px] text-[#8A95A6] leading-none mt-0.5 hidden sm:block">{pageTitle.sub}</p>}
                  </div>
                </div>

                {/* Desktop: expanding search */}
                <div className="hidden lg:flex items-center gap-3 w-full min-w-0 overflow-hidden">
                  {/* Page title + tabs — collapse when search is expanded */}
                  <AnimatePresence>
                    {!searchExpanded && (
                      <motion.div
                        key="title-tabs"
                        className="flex items-center gap-3 shrink-0 overflow-hidden"
                        initial={reduced ? {} : { opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduced ? {} : { opacity: 0, x: -12 }}
                        transition={reduced ? { duration: 0 } : expandSpring}
                      >
                        <div className="shrink-0">
                          <p className="text-[14px] font-[700] text-[#111111] leading-tight tracking-tight">{pageTitle.title}</p>
                          {pageTitle.sub && !tabsState && <p className="text-[11px] text-[#8A95A6] leading-none mt-0.5">{pageTitle.sub}</p>}
                        </div>
                        {tabsState && (
                          <div
                            className="flex items-center gap-0.5 rounded-full p-[3px] flex-shrink-0"
                            style={{
                              background: 'rgba(240,241,246,0.85)',
                              backdropFilter: 'blur(12px)',
                              WebkitBackdropFilter: 'blur(12px)',
                              border: '1px solid rgba(0,0,0,0.07)',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
                            }}
                          >
                            {tabsState.tabs.map(tab => {
                              const isActive = tabsState.activeId === tab.id
                              return (
                                <button
                                  key={tab.id}
                                  onClick={() => tabsState.onChange(tab.id)}
                                  className="relative flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] min-h-[28px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.6)]"
                                  style={{ color: isActive ? '#111111' : '#6B6B6B', fontWeight: isActive ? 650 : 500 }}
                                >
                                  {isActive && (
                                    <motion.span
                                      layoutId={`${pagePillId}-page-tab`}
                                      className="absolute inset-0 rounded-full"
                                      style={{
                                        background: 'rgba(255,255,255,0.95)',
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                                      }}
                                      transition={reduced ? { duration: 0 } : pageTabSpring}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="relative z-10">{tab.label}</span>
                                  {tab.badge && <span className="relative z-10">{tab.badge}</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Search — expands to fill available space on focus */}
                  <motion.div
                    className="min-w-0"
                    animate={reduced ? {} : { flex: searchExpanded ? '1 1 0%' : '0 0 260px' }}
                    transition={reduced ? { duration: 0 } : expandSpring}
                  >
                    <NonStockSearchBar
                      query={query} setQuery={setQuery} open={open} loading={loading}
                      searchError={searchError} activeIdx={activeIdx} results={results}
                      unsupportedError={unsupportedError} topbarListboxId={topbarListboxId}
                      reduced={reduced} searchRef={searchRef} select={select}
                      handleSubmit={handleSubmit} setOpen={setOpen} setActiveIdx={setActiveIdx}
                      setUnsupportedError={setUnsupportedError} setSearchError={setSearchError}
                      maxWidth="100%"
                      onFocus={() => setSearchExpanded(true)}
                      onBlur={() => { if (!open) setSearchExpanded(false) }}
                    />
                  </motion.div>
                </div>
              </>
            ) : (
              <div className="flex justify-center w-full">
                <NonStockSearchBar
                  query={query} setQuery={setQuery} open={open} loading={loading}
                  searchError={searchError} activeIdx={activeIdx} results={results}
                  unsupportedError={unsupportedError} topbarListboxId={topbarListboxId}
                  reduced={reduced} searchRef={searchRef} select={select}
                  handleSubmit={handleSubmit} setOpen={setOpen} setActiveIdx={setActiveIdx}
                  setUnsupportedError={setUnsupportedError} setSearchError={setSearchError}
                  maxWidth="480px"
                />
              </div>
            )}

            {/* Col 3: search icon / auth */}
            <div className="flex items-center gap-2 sm:gap-3 justify-end min-w-0">
              {pageTitle && (
                <button
                  onClick={() => setMobileSearchOpen(v => !v)}
                  aria-label="Search stocks"
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl transition-colors hover:bg-[#F0F1F6] active:bg-[#E8E9EF]"
                  style={{ color: '#111111' }}
                >
                  <Search size={18} strokeWidth={2} />
                </button>
              )}
              {session ? (
                <div className="flex items-center gap-2 shrink-0 lg:hidden">
                  <UserAvatar image={session.user?.image ?? null} name={session.user?.name ?? null} />
                  {isPro && <button onClick={openBillingPortal} className="text-[12px] text-[#6B6B6B] hover:text-[#111111] transition-colors whitespace-nowrap hidden sm:block">Billing</button>}
                  <button
                    onClick={() => { try { localStorage.removeItem('etf_watchlist'); localStorage.removeItem('simplifier_watchlist'); localStorage.removeItem('intrinsico_recent') } catch {} signOut() }}
                    className="text-[12px] text-[#6B6B6B] hover:text-[#111111] transition-colors whitespace-nowrap"
                  >Sign out</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => signIn('google')} className="text-[12.5px] text-white px-3.5 py-2.5 min-h-[44px] rounded-[10px] transition-colors font-semibold bg-[#5F790B] hover:bg-[#526A08] shadow-sm whitespace-nowrap">Get started free</button>
                  <button onClick={() => signIn('google')} className="text-[12.5px] text-[#6B6B6B] hover:text-[#111111] transition-colors whitespace-nowrap hidden md:block">Sign in</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )

}
