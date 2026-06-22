'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { BrowserFrame } from './ProductScreenshots'

const EASE = [0.16, 1, 0.3, 1] as const

interface Tab {
  id: string
  label: string
  badge: string | null
  headline: string
  bullets: string[]
  src: string
  fallback: string  // shown while new screenshots haven't been taken yet
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
    url: 'insic.app/stock/NOW — Overview',
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
    url: 'insic.app/stock/NOW — Valuation',
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
    url: 'insic.app/stock/NOW — Financials',
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
]

export default function FeaturesShowcaseSection() {
  const [activeId, setActiveId] = useState('overview')
  const reduced = useReducedMotion()

  const active = TABS.find(t => t.id === activeId) ?? TABS[0]

  return (
    <section style={{ background: '#F8F9FA', borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#5F790B] mb-3">
            Everything in one place
          </p>
          <h2 className="text-[26px] sm:text-[34px] font-bold text-[#111111] leading-tight" style={{ letterSpacing: '-0.025em' }}>
            Every page. Every feature.
          </h2>
          <p className="text-[15px] text-[#6B6B6B] mt-2">
            Five focused views — from raw verdict to editable model to macro context.
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className="shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-all min-h-[36px]"
              style={{
                background: activeId === tab.id ? '#5F790B' : 'white',
                color: activeId === tab.id ? 'white' : '#6B6B6B',
                border: activeId === tab.id ? '1px solid #5F790B' : '1px solid #E5E5E5',
              }}
            >
              {tab.label}
              {tab.badge && (
                <span
                  className="text-[9px] font-[800] uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                  style={{
                    background: activeId === tab.id ? 'rgba(255,255,255,0.25)' : '#EEF2FA',
                    color: activeId === tab.id ? 'white' : '#5F790B',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content — 2-col on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 lg:gap-12 items-start">

          {/* Left: copy */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id + '-copy'}
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? {} : { opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="flex flex-col gap-4"
            >
              <h3 className="text-[19px] sm:text-[22px] font-bold text-[#111111] leading-snug" style={{ letterSpacing: '-0.02em' }}>
                {active.headline}
              </h3>
              <ul className="space-y-2.5">
                {active.bullets.map(b => (
                  <li key={b} className="flex items-start gap-2.5">
                    <Check size={14} className="text-[#5F790B] shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="text-[14px] text-[#566174] leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
              {active.badge === 'Pro' ? (
                <Link
                  href={active.href}
                  className="self-start inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#526A08]"
                  style={{ background: '#5F790B' }}
                >
                  Upgrade to Pro →
                </Link>
              ) : (
                <Link
                  href={active.href}
                  className="self-start inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-[#5F790B] border border-[#BFD2A1] bg-[#F6FAEA] hover:bg-[#EDF5D9] transition-colors"
                >
                  Try it free →
                </Link>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Right: screenshot */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id + '-shot'}
              initial={reduced ? {} : { opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? {} : { opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <BrowserFrame url={active.url}>
                <div className="overflow-hidden" style={{ background: '#F0F1F6' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={active.src}
                    alt={`insic — ${active.label} tab`}
                    width={1440}
                    height={900}
                    className="w-full h-auto block"
                    onError={(e) => {
                      const img = e.currentTarget
                      if (img.src !== window.location.origin + active.fallback) {
                        img.src = active.fallback
                      }
                    }}
                  />
                </div>
              </BrowserFrame>
            </motion.div>
          </AnimatePresence>

        </div>
      </div>
    </section>
  )
}
