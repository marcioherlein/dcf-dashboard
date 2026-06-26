'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

const CYCLE_MS = 3800   // ms per tab before auto-advancing
const EASE = [0.25, 1, 0.35, 1] as const

interface Tab {
  id: string
  label: string
  badge: string | null
  headline: string
  bullets: string[]
  src: string
  fallback: string
  url: string
  href: string
}

const TABS: Tab[] = [
  {
    id: 'overview',
    label: 'Overview',
    badge: null,
    headline: 'Verdict, conviction score, and reverse DCF — above the fold.',
    bullets: [
      'Fair value vs current price',
      'Conviction Score (0–100) + 16-criterion checklist',
      'Market-implied 5Y growth rate',
      'Peer comparison + ETF exposure',
    ],
    src: '/screenshots/tab-overview.png',
    fallback: '/screenshots/summary-desktop.png',
    url: 'insic.app/stock/NVDA — Overview',
    href: '/analyze',
  },
  {
    id: 'valuation',
    label: 'Valuation',
    badge: 'Pro',
    headline: 'Edit any assumption. Watch fair value update live.',
    bullets: [
      '4 DCF models blended into one verdict',
      'Editable WACC, growth, margins, multiples',
      'Sensitivity heatmap (CAGR × WACC)',
      'Monte Carlo simulation — probability distribution',
    ],
    src: '/screenshots/tab-valuation.png',
    fallback: '/screenshots/valuation-cockpit.png',
    url: 'insic.app/stock/NVDA — Valuation',
    href: '/pricing',
  },
  {
    id: 'financials',
    label: 'Financials',
    badge: null,
    headline: 'Full 3-statement data, analyst estimates, and ownership.',
    bullets: [
      'Income statement, balance sheet, cash flow',
      'Growth + profitability + solvency views',
      'Wall Street analyst consensus + EPS surprises',
      'Insider & institutional ownership',
    ],
    src: '/screenshots/tab-financials.png',
    fallback: '/screenshots/valuation-desktop.png',
    url: 'insic.app/stock/NVDA — Financials',
    href: '/analyze',
  },
  {
    id: 'markets',
    label: 'Markets',
    badge: null,
    headline: 'Macro context before you open a stock.',
    bullets: [
      'Index + VIX + Treasury yield snapshot',
      'Sector rotation heatmap',
      'Earnings & economic calendar',
      'Yield curve chart',
    ],
    src: '/screenshots/tab-markets.png',
    fallback: '/screenshots/summary-desktop.png',
    url: 'insic.app/markets',
    href: '/markets',
  },
  {
    id: 'screener',
    label: 'Screener',
    badge: null,
    headline: 'Filter 5,000+ US stocks by fundamentals or plot them.',
    bullets: [
      '20+ fundamental filters (P/E, FCF, ROIC, growth)',
      'Scatter chart: plot any metric vs any metric',
      'Sort by valuation, profitability, momentum',
      'Click any row → full analysis instantly',
    ],
    src: '/screenshots/tab-screener.png',
    fallback: '/screenshots/summary-desktop.png',
    url: 'insic.app/screener',
    href: '/screener',
  },
  {
    id: 'etf',
    label: 'ETF Tracker',
    badge: null,
    headline: 'Track ETFs by value, cost, and holdings — not just price.',
    bullets: [
      'Value score — P/E, P/B, yield, expense ratio in one number',
      'Watchlist table with 1M/1Y returns, Sharpe, beta',
      'ETF Basket DCF — fair value signal across all holdings (Pro)',
      '60 ETFs across 8 groups: broad, sector, bond, thematic & more',
    ],
    src: '/screenshots/tab-etf.png',
    fallback: '/screenshots/summary-desktop.png',
    url: 'insic.app/etf',
    href: '/etf',
  },
]

// ── Browser chrome ────────────────────────────────────────────────────────────

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[14px] overflow-hidden w-full"
      style={{
        boxShadow: '0 0 0 1px rgba(0,0,0,0.09), 0 32px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center px-3.5 gap-0 shrink-0"
        style={{
          height: '36px',
          background: 'linear-gradient(to bottom, #EBEBEB 0%, #DCDCDC 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.13)',
        }}
      >
        <div className="flex items-center gap-[6px] mr-3">
          <div className="w-[11px] h-[11px] rounded-full bg-[#FC605C] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.5)]" />
          <div className="w-[11px] h-[11px] rounded-full bg-[#FDBC40] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.5)]" />
          <div className="w-[11px] h-[11px] rounded-full bg-[#34C749] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.5)]" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div
            className="flex items-center gap-1.5 px-2.5 rounded-md text-[11px] text-[#555] max-w-[260px] w-full truncate"
            style={{ height: '21px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(0,0,0,0.15)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}
          >
            <svg className="w-2.5 h-2.5 text-[#999] shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a5 5 0 0 0-5 5v1H2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V6a5 5 0 0 0-5-5zm0 1.5A3.5 3.5 0 0 1 11.5 6v1h-7V6A3.5 3.5 0 0 1 8 2.5z" />
            </svg>
            <span className="truncate">{url}</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function FeaturesShowcaseSection() {
  const [activeIdx, setActiveIdx]   = useState(0)
  const [paused, setPaused]         = useState(false)
  const [progress, setProgress]     = useState(0)   // 0–100
  const reduced                     = useReducedMotion()
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  const advance = useCallback(() => {
    setActiveIdx(i => (i + 1) % TABS.length)
    setProgress(0)
  }, [])

  // Start/stop auto-cycle
  useEffect(() => {
    if (paused || reduced) { setProgress(0); return }
    setProgress(0)

    // Progress bar — updates every 40ms for smooth animation
    const TICK = 40
    progressRef.current = setInterval(() => {
      setProgress(p => {
        const next = p + (TICK / CYCLE_MS) * 100
        return next >= 100 ? 100 : next
      })
    }, TICK)

    intervalRef.current = setInterval(advance, CYCLE_MS)

    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current)
      if (progressRef.current)  clearInterval(progressRef.current)
    }
  }, [paused, reduced, advance, activeIdx])

  function goTo(idx: number) {
    setActiveIdx(idx)
    setProgress(0)
    // Reset cycle timer when user clicks
    if (intervalRef.current)  clearInterval(intervalRef.current)
    if (progressRef.current)  clearInterval(progressRef.current)
  }

  const active = TABS[activeIdx]

  return (
    <section
      style={{ background: '#F3F4F6', borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <p className="text-[11px] font-[800] uppercase tracking-[0.12em] text-[#5F790B] mb-3">
            Everything in one place
          </p>
          <h2 className="text-[26px] sm:text-[36px] font-bold text-[#111111] leading-tight" style={{ letterSpacing: '-0.03em' }}>
            Every page. Every feature.
          </h2>
          <p className="text-[15px] text-[#6B6B6B] mt-2 max-w-lg">
            Six focused views — from raw verdict to editable model to ETF decision cockpit.
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide" role="tablist">
          {TABS.map((tab, idx) => {
            const isActive = idx === activeIdx
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => goTo(idx)}
                className="relative shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-[600] transition-all min-h-[36px] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B]"
                style={{
                  background: isActive ? '#111111' : 'white',
                  color:      isActive ? 'white'    : '#6B6B6B',
                  border:     isActive ? '1px solid transparent' : '1px solid #E5E5E5',
                  boxShadow:  isActive ? '0 2px 8px rgba(0,0,0,0.18)' : '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {/* Progress bar fill — bottom of pill */}
                {isActive && !reduced && (
                  <span
                    className="absolute bottom-0 left-0 h-[2px] bg-[#5F790B] rounded-full transition-none"
                    style={{ width: `${progress}%`, opacity: paused ? 0.4 : 1 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                {tab.badge && (
                  <span
                    className="relative z-10 text-[9px] font-[800] uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.18)' : '#EEF2FA',
                      color:      isActive ? 'white' : '#5F790B',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Main content: screenshot + overlaid copy on desktop, stacked on mobile */}
        <div className="relative">
          {/* Screenshot — full width */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={reduced ? {} : { opacity: 0, y: 10, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced   ? {} : { opacity: 0, y: -6, scale: 0.998 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <BrowserChrome url={active.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.src}
                  alt={`insic — ${active.label} tab`}
                  width={1248}
                  height={722}
                  className="w-full h-auto block"
                  style={{ display: 'block', background: '#0d1117' }}
                  onError={(e) => {
                    const img = e.currentTarget
                    if (img.src.endsWith(active.src) && active.fallback) {
                      img.src = active.fallback
                    }
                  }}
                />
              </BrowserChrome>
            </motion.div>
          </AnimatePresence>

          {/* Overlaid copy — left column, desktop only */}
          <div
            className="hidden lg:block absolute top-[36px] left-0 bottom-0 w-[300px] pointer-events-none"
            aria-hidden="true"
            style={{
              background: 'linear-gradient(to right, rgba(243,244,246,0.97) 75%, transparent 100%)',
            }}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id + '-copy'}
              initial={reduced ? {} : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced   ? {} : { opacity: 0, x: -6 }}
              transition={{ duration: 0.22, ease: EASE, delay: 0.04 }}
              className="hidden lg:flex flex-col gap-4 absolute left-6 bottom-8 w-[260px] pointer-events-auto"
            >
              <h3
                className="text-[18px] font-[800] text-[#111111] leading-snug"
                style={{ letterSpacing: '-0.025em' }}
              >
                {active.headline}
              </h3>
              <ul className="space-y-2">
                {active.bullets.map(b => (
                  <li key={b} className="flex items-start gap-2">
                    <Check size={13} className="text-[#5F790B] shrink-0 mt-[2px]" strokeWidth={3} />
                    <span className="text-[13px] text-[#444] leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
              {active.badge === 'Pro' ? (
                <Link
                  href={active.href}
                  className="self-start inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-[700] text-white transition-colors hover:opacity-90"
                  style={{ background: '#111111' }}
                >
                  Upgrade to Pro →
                </Link>
              ) : (
                <Link
                  href={active.href}
                  className="self-start inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-[700] text-[#5F790B] border border-[#BFD2A1] bg-[#F6FAEA] hover:bg-[#EDF5D9] transition-colors"
                >
                  Try it free →
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile copy — below screenshot */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id + '-mobile-copy'}
            initial={reduced ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced   ? {} : { opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="lg:hidden mt-6 flex flex-col gap-3"
          >
            <h3 className="text-[18px] font-[700] text-[#111111] leading-snug" style={{ letterSpacing: '-0.02em' }}>
              {active.headline}
            </h3>
            <ul className="space-y-2">
              {active.bullets.map(b => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check size={14} className="text-[#5F790B] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-[14px] text-[#566174] leading-snug">{b}</span>
                </li>
              ))}
            </ul>
            {active.badge === 'Pro' ? (
              <Link href={active.href} className="self-start inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-[600] text-white bg-[#111111] hover:opacity-90 transition-opacity">
                Upgrade to Pro →
              </Link>
            ) : (
              <Link href={active.href} className="self-start inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-[600] text-[#5F790B] border border-[#BFD2A1] bg-[#F6FAEA] hover:bg-[#EDF5D9] transition-colors">
                Try it free →
              </Link>
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  )
}
