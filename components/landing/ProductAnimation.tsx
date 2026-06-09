'use client'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  olive:         '#5F790B',
  oliveBg:       '#F6FAEA',
  oliveLighter:  '#7C9A19',
  oliveChip:     '#EEF4DD',
  green:         '#11875D',
  greenSoft:     '#E8F7EF',
  amber:         '#B56A00',
  amberSoft:     '#FFF4DA',
  red:           '#D83B3B',
  redSoft:       '#FCEAEA',
  text:          '#111111',
  textSecondary: '#6B6B6B',
  textMuted:     '#9B9B9B',
  border:        '#E5E5E5',
} as const

const EASE = [0.16, 1, 0.3, 1] as const

// ── Screen definitions ────────────────────────────────────────────────────────
const ANALYZE_TABS = [
  { key: 'overview',   label: '01 · Overview' },
  { key: 'valuation',  label: '02 · Valuation' },
  { key: 'conviction', label: '03 · Conviction' },
  { key: 'financials', label: '04 · Financials' },
  { key: 'news',       label: '05 · News' },
] as const

type AnalyzeTabKey = (typeof ANALYZE_TABS)[number]['key']
type SidebarItemKey = 'analyze' | 'screener' | 'my-valuations' | 'portfolio' | 'markets' | 'etf' | 'alerts' | 'settings'

// ── Mini SVG sparklines ───────────────────────────────────────────────────────
function Sparkline({ points, color, height = 28, width = 64 }: { points: string; color: string; height?: number; width?: number }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" style={{ display: 'block' }}>
      <polyline
        points={points}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ activeItem }: { activeItem: SidebarItemKey }) {
  const sections: Array<{
    label: string
    items: Array<{ key: SidebarItemKey; label: string; icon: React.ReactNode }>
  }> = [
    {
      label: 'Research',
      items: [
        {
          key: 'analyze',
          label: 'Analyze',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          ),
        },
        {
          key: 'screener',
          label: 'Screener',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Track',
      items: [
        {
          key: 'my-valuations',
          label: 'My Valuations',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ),
        },
        {
          key: 'portfolio',
          label: 'Portfolio',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Markets',
      items: [
        {
          key: 'markets',
          label: 'Markets',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          ),
        },
        {
          key: 'etf',
          label: 'ETF Tracker',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          key: 'alerts',
          label: 'Alerts',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          ),
        },
        {
          key: 'settings',
          label: 'Settings',
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        },
      ],
    },
  ]

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        width: 148,
        background: 'linear-gradient(to bottom, #0A0A0A, #0F1108)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        minHeight: '100%',
        padding: '12px 0',
      }}
    >
      {/* Logo */}
      <div className="px-3 pb-3 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: 14, color: '#FFFFFF', letterSpacing: '-0.03em' }}
        >
          insic
        </span>
      </div>

      {/* Nav sections */}
      <div className="flex flex-col gap-2 pt-2">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-1">
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.28)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {section.label}
              </span>
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.key === activeItem
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                    style={{
                      background: isActive ? 'rgba(95,121,11,0.20)' : 'transparent',
                      border: isActive ? '1px solid rgba(95,121,11,0.30)' : '1px solid transparent',
                      color: isActive ? C.olive : 'rgba(255,255,255,0.38)',
                    }}
                  >
                    {item.icon}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? C.olive : 'rgba(255,255,255,0.40)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ url }: { url?: string }) {
  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{ height: 42, borderBottom: `1px solid ${C.border}`, background: '#FFFFFF' }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.03em' }}>insic</span>

      <div
        className="flex items-center gap-1.5 rounded px-2.5"
        style={{ height: 26, background: '#F5F5F5', border: `1px solid ${C.border}`, minWidth: 170 }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth={2.5}>
          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <span style={{ fontSize: 10, color: C.textSecondary }}>{url ?? 'Search ticker or company…'}</span>
      </div>

      <div
        className="rounded-full flex items-center justify-center"
        style={{ width: 26, height: 26, background: C.olive }}
      >
        <span style={{ fontSize: 8.5, fontWeight: 700, color: '#FFFFFF' }}>MH</span>
      </div>
    </div>
  )
}

// ── Tab bar (Analyze tabs) ────────────────────────────────────────────────────
function TabBar({ activeKey, reduced }: { activeKey: AnalyzeTabKey; reduced: boolean | null }) {
  return (
    <div
      className="flex items-end shrink-0 overflow-x-auto"
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: '#FFFFFF',
        scrollbarWidth: 'none',
      }}
    >
      {ANALYZE_TABS.map((tab) => {
        const active = tab.key === activeKey
        return (
          <div
            key={tab.key}
            className="relative shrink-0 flex items-center justify-center"
            style={{
              padding: '9px 11px 8px',
              background: active ? C.oliveBg : 'transparent',
              transition: reduced ? 'none' : 'background 0.3s ease',
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: active ? 600 : 500,
                color: active ? C.olive : C.textSecondary,
                whiteSpace: 'nowrap',
                transition: reduced ? 'none' : 'color 0.3s ease',
              }}
            >
              {tab.label}
            </span>
            {active && (
              <motion.div
                layoutId="landing-tab-indicator"
                className="absolute bottom-0 left-0 right-0"
                style={{ height: 2, background: C.olive, borderRadius: '2px 2px 0 0' }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 32 }
                }
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Page header (used by Markets & ETF) ──────────────────────────────────────
function PageHeader({ title, badge }: { title: string; badge?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 shrink-0"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{title}</span>
      {badge}
    </div>
  )
}

// ── Scenario bar ──────────────────────────────────────────────────────────────
function ScenarioBar() {
  return (
    <div>
      <div
        className="relative rounded-full overflow-hidden"
        style={{ height: 8, background: 'linear-gradient(to right, #E8B4B4 0%, #E5C97C 45%, #A8D5A2 100%)' }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ width: 12, height: 12, left: '44%', border: '2px solid #5F790B', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span style={{ fontSize: 8.5, color: C.textSecondary }}>$170 Bear</span>
        <span style={{ fontSize: 8.5, fontWeight: 600, color: C.olive }}>$226 Base</span>
        <span style={{ fontSize: 8.5, color: C.textSecondary }}>$295 Bull</span>
      </div>
    </div>
  )
}

// ── Screen 1: Overview ────────────────────────────────────────────────────────
function OverviewScreen() {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* SummaryHeroCard */}
      <div
        className="rounded-xl px-4 py-4"
        style={{ background: 'linear-gradient(135deg, #F6FAEA 0%, #EEF4DD 100%)', border: '1px solid #BFD2A1' }}
      >
        <p style={{ fontSize: 9, fontWeight: 700, color: C.olive, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
          INSIC VERDICT
        </p>
        <p style={{ fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
          AAPL looks <span style={{ color: C.olive }}>Undervalued</span>
        </p>
        <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 5, lineHeight: 1.4 }}>
          The stock trades below our estimated fair value with meaningful upside.
        </p>

        {/* Metrics row */}
        <div className="flex items-center gap-2.5 mt-3.5">
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
            Fair value: <span style={{ color: C.olive }}>$226.80</span>
          </span>
          <span style={{ width: 1, height: 14, background: C.border, display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>+23.6% upside</span>
        </div>

        {/* Confidence chip */}
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 mt-3"
          style={{ background: C.greenSoft, border: `1px solid #A7D7C0` }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={2.8} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.green }}>High Confidence · 6/6 models agree</span>
        </div>

        {/* Analyst line */}
        <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 8 }}>
          Analysts: <span style={{ fontWeight: 600, color: C.text }}>Strong Buy</span>
          {' · '}target <span style={{ fontWeight: 600, color: C.text }}>$245.00</span>
        </p>
      </div>

      {/* Scenario bar */}
      <div>
        <p style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
          Scenario Range
        </p>
        <ScenarioBar />
      </div>
    </div>
  )
}

// ── Screen 2: Valuation ───────────────────────────────────────────────────────
function ValuationScreen() {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Verdict hero */}
      <div>
        <p style={{ fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
          AAPL looks <span style={{ color: C.olive }}>Undervalued</span>
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={2.8} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: C.green }}>High confidence · 6 of 6 models</span>
        </div>
      </div>

      {/* Three-cell grid */}
      <div
        className="grid grid-cols-3 rounded-xl overflow-hidden"
        style={{ border: `1px solid ${C.border}` }}
      >
        {([
          { label: 'Fair Value',    value: '$226.80', sub: null,     color: C.olive,  subColor: C.red },
          { label: 'Current Price', value: '$183.42', sub: '-2.41%', color: C.text,   subColor: C.red },
          { label: 'Upside',        value: '+23.6%',  sub: null,     color: C.green,  subColor: C.red },
        ] as const).map((cell, i) => (
          <div
            key={cell.label}
            className="flex flex-col items-center justify-center py-3.5"
            style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: C.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
              }}
            >
              {cell.label}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: cell.color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {cell.value}
            </span>
            {cell.sub && (
              <span style={{ fontSize: 9, fontWeight: 600, color: cell.subColor, marginTop: 2 }}>
                {cell.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Efficiency line */}
      <p style={{ fontSize: 11, color: C.textSecondary }}>
        You pay <span style={{ fontWeight: 600, color: C.text }}>$0.81</span> per{' '}
        <span style={{ fontWeight: 600, color: C.text }}>$1</span> of estimated intrinsic value
      </p>

      {/* Scenario bar */}
      <div>
        <p style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
          Scenario Range
        </p>
        <ScenarioBar />
      </div>
    </div>
  )
}

// ── Screen 3: Conviction ──────────────────────────────────────────────────────
const DIMENSIONS = [
  { label: 'Valuation Attractiveness', score: 78, color: C.green },
  { label: 'Business Quality',         score: 94, color: C.green },
  { label: 'Financial Health',         score: 81, color: C.green },
  { label: 'Growth Momentum',          score: 79, color: C.green },
  { label: 'Earnings Integrity',       score: 96, color: C.green },
  { label: 'Analyst Sentiment',        score: 71, color: C.amber },
] as const

function ConvictionScreen() {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Score header */}
      <div className="flex items-center gap-5">
        <span
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: C.olive,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          82
        </span>
        <div className="flex flex-col gap-1.5">
          <div
            className="inline-flex items-center rounded-full px-3 py-0.5"
            style={{ background: C.oliveChip, border: `1px solid #BFD2A1` }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: C.olive }}>A−</span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
            Excellent business,<br />priced attractively
          </p>
        </div>
      </div>

      <p style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5 }}>
        Strong fundamentals with meaningful valuation upside across all six scoring dimensions.
      </p>

      {/* 2×3 dimension bars */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {DIMENSIONS.map((dim) => (
          <div key={dim.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ fontSize: 9.5, fontWeight: 600, color: C.textSecondary }}>{dim.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: dim.color, fontVariantNumeric: 'tabular-nums' }}>
                {dim.score}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#F0F0F0' }}>
              <div
                className="rounded-full"
                style={{ height: '100%', width: `${dim.score}%`, background: dim.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Screen 4: Markets ─────────────────────────────────────────────────────────
const MARKET_INDICES = [
  {
    name: 'S&P 500',
    value: '7,435.55',
    change: '+0.70%',
    positive: true,
    chip: 'Constructive',
    chipColor: C.green,
    chipBg: C.greenSoft,
    // up sparkline: x steps 0..63, y from ~18 down to ~8
    sparkPoints: '0,22 10,20 20,18 30,14 40,16 50,10 63,8',
  },
  {
    name: 'Nasdaq 100',
    value: '29,544',
    change: '+2.03%',
    positive: true,
    chip: 'Risk-On',
    chipColor: C.olive,
    chipBg: C.oliveChip,
    sparkPoints: '0,24 10,20 20,22 30,16 40,12 50,10 63,6',
  },
  {
    name: 'VIX',
    value: '18.1',
    change: '-15.6%',
    positive: false,
    chip: 'Normal',
    chipColor: C.textSecondary,
    chipBg: '#F5F5F5',
    // declining: good (lower VIX = calmer)
    sparkPoints: '0,8 10,10 20,12 30,14 40,16 50,20 63,22',
  },
] as const

function MarketsScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PageHeader
        title="Markets Overview"
        badge={
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: C.greenSoft, border: `1px solid #A7D7C0` }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
            <span style={{ fontSize: 9.5, fontWeight: 600, color: C.green }}>Market Open</span>
          </div>
        }
      />

      {/* Index strip */}
      <div
        className="flex items-center gap-0 shrink-0 overflow-x-auto"
        style={{
          borderBottom: `1px solid ${C.border}`,
          background: '#FAFAFA',
          scrollbarWidth: 'none',
          padding: '7px 16px',
          gap: 20,
        }}
      >
        {[
          { label: 'S&P 500',    value: '7,435', change: '+0.70%', pos: true },
          { label: 'Nasdaq 100', value: '29,544', change: '+2.03%', pos: true },
          { label: 'VIX',        value: '18.1',  change: '-15.6%', pos: false },
        ].map((idx) => (
          <div key={idx.label} className="flex items-center gap-2 shrink-0">
            <span style={{ fontSize: 9.5, fontWeight: 600, color: C.textSecondary }}>{idx.label}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
              {idx.value}
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                color: idx.pos ? C.green : C.red,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {idx.change}
            </span>
          </div>
        ))}
      </div>

      {/* Index cards */}
      <div
        className="grid grid-cols-3 gap-3"
        style={{ padding: '12px 16px' }}
      >
        {MARKET_INDICES.map((idx) => (
          <div
            key={idx.name}
            className="rounded-xl flex flex-col gap-2 p-3"
            style={{ border: `1px solid ${C.border}`, background: '#FFFFFF' }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{idx.name}</span>
              <div
                className="rounded-full px-1.5 py-0.5"
                style={{ background: idx.chipBg }}
              >
                <span style={{ fontSize: 8.5, fontWeight: 600, color: idx.chipColor }}>{idx.chip}</span>
              </div>
            </div>
            <Sparkline
              points={idx.sparkPoints}
              color={idx.positive ? C.green : C.red}
              width={64}
              height={28}
            />
            <div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.text,
                  display: 'block',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {idx.value}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: idx.positive ? C.green : C.red,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {idx.change} Today
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Screen 5: ETF Tracker ─────────────────────────────────────────────────────
const ETF_ROWS = [
  {
    ticker: 'SPY',
    name: 'S&P 500 ETF Trust',
    price: '$587.42',
    change: '+0.68%',
    positive: true,
    chip: 'Fairly Valued',
    chipColor: C.amber,
    chipBg: C.amberSoft,
    sparkPoints: '0,20 10,18 20,16 30,14 40,12 50,10 63,8',
  },
  {
    ticker: 'QQQ',
    name: 'Invesco QQQ Trust',
    price: '$498.31',
    change: '+1.94%',
    positive: true,
    chip: 'Fairly Valued',
    chipColor: C.amber,
    chipBg: C.amberSoft,
    sparkPoints: '0,22 10,20 20,18 30,14 40,10 50,8 63,5',
  },
  {
    ticker: 'VTI',
    name: 'Vanguard Total Market ETF',
    price: '$261.08',
    change: '+0.72%',
    positive: true,
    chip: 'Undervalued',
    chipColor: C.olive,
    chipBg: C.oliveChip,
    sparkPoints: '0,20 10,19 20,17 30,15 40,13 50,11 63,9',
  },
] as const

function ETFTrackerScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="ETF Tracker" />

      <div
        className="flex flex-col gap-2.5"
        style={{ padding: '12px 16px' }}
      >
        {ETF_ROWS.map((etf) => (
          <div
            key={etf.ticker}
            className="flex items-center rounded-xl px-3 py-2.5"
            style={{ border: `1px solid ${C.border}`, background: '#FFFFFF', gap: 10 }}
          >
            {/* Ticker badge */}
            <div
              className="shrink-0 rounded-lg flex items-center justify-center"
              style={{ width: 36, height: 36, background: '#F5F5F5', border: `1px solid ${C.border}` }}
            >
              <span style={{ fontSize: 9.5, fontWeight: 700, color: C.text }}>{etf.ticker}</span>
            </div>

            {/* Name + chip */}
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 2 }}>{etf.ticker}</p>
              <p
                style={{
                  fontSize: 9.5,
                  color: C.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {etf.name}
              </p>
            </div>

            {/* Sparkline */}
            <Sparkline points={etf.sparkPoints} color={etf.positive ? C.green : C.red} width={48} height={24} />

            {/* Price + change */}
            <div className="shrink-0 text-right">
              <p style={{ fontSize: 12, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                {etf.price}
              </p>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: etf.positive ? C.green : C.red,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {etf.change}
              </p>
            </div>

            {/* Verdict chip */}
            <div
              className="shrink-0 rounded-full px-2 py-0.5"
              style={{ background: etf.chipBg, border: `1px solid ${etf.positive ? '#A7D7C0' : C.border}` }}
            >
              <span style={{ fontSize: 9, fontWeight: 600, color: etf.chipColor, whiteSpace: 'nowrap' }}>
                {etf.chip}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Screen metadata ───────────────────────────────────────────────────────────
type ScreenMeta =
  | { kind: 'analyze'; tabKey: AnalyzeTabKey; content: React.ReactNode }
  | { kind: 'page'; sidebarKey: SidebarItemKey; url: string; content: React.ReactNode }

const SCREEN_COUNT = 5

const SCREENS: Record<number, ScreenMeta> = {
  0: { kind: 'analyze', tabKey: 'overview',   content: <OverviewScreen /> },
  1: { kind: 'analyze', tabKey: 'valuation',  content: <ValuationScreen /> },
  2: { kind: 'analyze', tabKey: 'conviction', content: <ConvictionScreen /> },
  3: { kind: 'page',    sidebarKey: 'markets', url: 'insic.app/markets',       content: <MarketsScreen /> },
  4: { kind: 'page',    sidebarKey: 'etf',     url: 'insic.app/etf',           content: <ETFTrackerScreen /> },
}

// Derive active sidebar key from screen
function activeSidebarKey(s: ScreenMeta): SidebarItemKey {
  if (s.kind === 'analyze') return 'analyze'
  return s.sidebarKey
}

// ── Browser chrome ────────────────────────────────────────────────────────────
function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div
      className="w-full rounded-xl overflow-hidden"
      style={{
        boxShadow:
          '0 2px 0 rgba(255,255,255,0.10) inset, 0 40px 80px rgba(0,0,0,0.32), 0 16px 32px rgba(0,0,0,0.16), 0 4px 8px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      {/* macOS dark title bar */}
      <div
        className="flex items-center gap-2 px-4"
        style={{
          height: 38,
          background: 'linear-gradient(to bottom, #3C3C3C 0%, #2E2E2E 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.40)',
        }}
      >
        <div className="flex items-center gap-2">
          {[
            'radial-gradient(circle at 35% 35%, #FF7A74, #FF5F56)',
            'radial-gradient(circle at 35% 35%, #FFCF4A, #FFBD2E)',
            'radial-gradient(circle at 35% 35%, #46D354, #28C840)',
          ].map((bg, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 12,
                height: 12,
                background: bg,
                border: '0.5px solid rgba(0,0,0,0.18)',
                boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
        {/* Address bar */}
        <div
          className="flex-1 mx-3 rounded-md flex items-center px-3 gap-1.5"
          style={{ height: 22, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontSize: 10, color: '#6B6B6B', fontWeight: 500, letterSpacing: '-0.01em' }}>{url}</span>
        </div>
      </div>
      {/* White content area */}
      <div style={{ background: '#FFFFFF' }}>{children}</div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ProductAnimation({
  inView,
  reduced,
}: {
  inView: boolean
  reduced: boolean | null
}) {
  const prefersReduced = useReducedMotion()
  const shouldAnimate = inView && !reduced && !prefersReduced

  const [screenIndex, setScreenIndex] = useState(0)

  // Cycle through all screens
  useEffect(() => {
    if (!shouldAnimate) return
    const DURATIONS = [3000, 3000, 3200, 3000, 3000] // one entry per screen

    let timer: ReturnType<typeof setTimeout>
    function advance(idx: number) {
      const duration = DURATIONS[idx % DURATIONS.length] ?? 3000
      const next = (idx + 1) % SCREEN_COUNT
      timer = setTimeout(() => {
        setScreenIndex(next)
        advance(next)
      }, duration)
    }
    advance(screenIndex)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate])

  const screen = SCREENS[screenIndex]
  const sidebarKey = activeSidebarKey(screen)
  const currentUrl =
    screen.kind === 'analyze'
      ? 'insic.app/stock/AAPL'
      : screen.url

  return (
    <BrowserChrome url={currentUrl}>
      <div className="relative overflow-hidden">
        {/* App shell: sidebar + main */}
        <div className="flex" style={{ minHeight: 520 }}>

          {/* Sidebar — always visible inside the fixed-width chrome mock */}
          <Sidebar activeItem={sidebarKey} />

          {/* Main content column */}
          <div className="flex flex-col flex-1 min-w-0">
            <TopBar />

            {/* Tab bar for Analyze screens; page header area handled inside screen content */}
            {screen.kind === 'analyze' && (
              <TabBar activeKey={screen.tabKey} reduced={reduced} />
            )}

            {/* Animated screen content */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={screenIndex}
                  initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{
                    duration: shouldAnimate ? 0.38 : 0,
                    ease: EASE,
                  }}
                >
                  {screen.content}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </BrowserChrome>
  )
}
