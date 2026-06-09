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
  text:          '#111111',
  textSecondary: '#6B6B6B',
  textMuted:     '#9B9B9B',
  border:        '#E5E5E5',
} as const

const EASE = [0.16, 1, 0.3, 1] as const

// ── Screen index → tab key ────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',    label: '01 · Overview' },
  { key: 'valuation',   label: '02 · Valuation' },
  { key: 'conviction',  label: '03 · Conviction' },
  { key: 'financials',  label: '04 · Financials' },
  { key: 'news',        label: '05 · News' },
] as const

type TabKey = (typeof TABS)[number]['key']

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar() {
  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        width: 120,
        background: 'linear-gradient(to bottom, #0A0A0A, #0F1108)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        minHeight: '100%',
        padding: '12px 0',
      }}
    >
      {/* Logo area */}
      <div className="px-3 pb-3 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: 13, color: '#FFFFFF', letterSpacing: '-0.03em' }}
        >
          insic
        </span>
      </div>

      {/* Section label */}
      <div className="px-3 pb-1">
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Research
        </span>
      </div>

      {/* Nav items */}
      <div className="px-2 flex flex-col gap-0.5">
        {/* Analyze — active */}
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded-md"
          style={{
            background: 'rgba(95,121,11,0.18)',
            border: '1px solid rgba(95,121,11,0.28)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.olive} strokeWidth={2.2} strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.olive }}>Analyze</span>
        </div>

        {/* Conviction */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeLinecap="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.40)' }}>Conviction</span>
        </div>
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{ height: 40, borderBottom: `1px solid ${C.border}`, background: '#FFFFFF' }}
    >
      {/* Logo text */}
      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.03em' }}>insic</span>

      {/* Search bar */}
      <div
        className="flex items-center gap-1.5 rounded px-2.5"
        style={{ height: 26, background: '#F5F5F5', border: `1px solid ${C.border}`, minWidth: 160 }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth={2.5}>
          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <span style={{ fontSize: 10, color: C.textSecondary }}>Search ticker or company…</span>
      </div>

      {/* Avatar */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{ width: 24, height: 24, background: C.olive }}
      >
        <span style={{ fontSize: 8, fontWeight: 700, color: '#FFFFFF' }}>MH</span>
      </div>
    </div>
  )
}

// ── Tab bar with sliding indicator ────────────────────────────────────────────
function TabBar({ activeKey, reduced }: { activeKey: TabKey; reduced: boolean | null }) {
  return (
    <div
      className="flex items-end shrink-0 overflow-x-auto"
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: '#FFFFFF',
        scrollbarWidth: 'none',
      }}
    >
      {TABS.map((tab) => {
        const active = tab.key === activeKey
        return (
          <div
            key={tab.key}
            className="relative shrink-0 flex items-center justify-center"
            style={{
              padding: '9px 10px 8px',
              background: active ? C.oliveBg : 'transparent',
              transition: reduced ? 'none' : 'background 0.3s ease',
            }}
          >
            <span
              style={{
                fontSize: 10,
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
        <span style={{ fontSize: 8, color: C.textSecondary }}>$170 Bear</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: C.olive }}>$226 Base</span>
        <span style={{ fontSize: 8, color: C.textSecondary }}>$295 Bull</span>
      </div>
    </div>
  )
}

// ── Screen 1: Overview ────────────────────────────────────────────────────────
function OverviewScreen() {
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* SummaryHeroCard */}
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #F6FAEA 0%, #EEF4DD 100%)', border: '1px solid #BFD2A1' }}
      >
        <p style={{ fontSize: 8.5, fontWeight: 700, color: C.olive, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          INSIC VERDICT
        </p>
        <p style={{ fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
          AAPL looks <span style={{ color: C.olive }}>Undervalued</span>
        </p>
        <p style={{ fontSize: 10, color: C.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
          The stock trades below our estimated fair value with meaningful upside.
        </p>

        {/* Metrics row */}
        <div className="flex items-center gap-2 mt-3">
          <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Fair value: <span style={{ color: C.olive }}>$226.80</span></span>
          <span style={{ width: 1, height: 12, background: C.border, display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>vs current price: +23.6%</span>
        </div>

        {/* Confidence chip */}
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 mt-3"
          style={{ background: C.greenSoft, border: `1px solid #A7D7C0` }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={2.8} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: C.green }}>High Confidence · 6/6 models</span>
        </div>

        {/* Analyst line */}
        <p style={{ fontSize: 10, color: C.textSecondary, marginTop: 6 }}>
          Analysts: <span style={{ fontWeight: 600, color: C.text }}>Strong Buy</span> · target{' '}
          <span style={{ fontWeight: 600, color: C.text }}>$245.00</span>
        </p>
      </div>

      {/* Scenario bar */}
      <div>
        <p style={{ fontSize: 8.5, color: C.textSecondary, marginBottom: 6 }}>Scenario range</p>
        <ScenarioBar />
      </div>
    </div>
  )
}

// ── Screen 2: Valuation ───────────────────────────────────────────────────────
function ValuationScreen() {
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* VerdictHero */}
      <div>
        <p style={{ fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
          AAPL looks <span style={{ color: C.olive }}>Undervalued</span>
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={2.8} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.green }}>High confidence · 6 of 6 models</span>
        </div>
      </div>

      {/* Three-cell grid */}
      <div
        className="grid grid-cols-3 rounded-xl overflow-hidden"
        style={{ border: `1px solid ${C.border}` }}
      >
        {[
          { label: 'Fair Value',     value: '$226.80', sub: null,     color: C.olive },
          { label: 'Current Price',  value: '$183.42', sub: '-2.41%', color: C.text, subColor: C.red },
          { label: 'Upside',         value: '+23.6%',  sub: null,     color: C.green },
        ].map((cell, i) => (
          <div
            key={cell.label}
            className="flex flex-col items-center justify-center py-3"
            style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}
          >
            <span style={{ fontSize: 9, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              {cell.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: cell.color, fontVariantNumeric: 'tabular-nums' }}>
              {cell.value}
            </span>
            {cell.sub && (
              <span style={{ fontSize: 9, fontWeight: 600, color: cell.subColor ?? C.textSecondary, marginTop: 1 }}>
                {cell.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Efficiency line */}
      <p style={{ fontSize: 10, color: C.textSecondary }}>
        You pay <span style={{ fontWeight: 600, color: C.text }}>$0.81</span> per{' '}
        <span style={{ fontWeight: 600, color: C.text }}>$1</span> of estimated value
      </p>

      {/* Scenario bar */}
      <div>
        <p style={{ fontSize: 8.5, color: C.textSecondary, marginBottom: 6 }}>Scenario range</p>
        <ScenarioBar />
      </div>
    </div>
  )
}

// ── Screen 3: Conviction ──────────────────────────────────────────────────────
const DIMENSIONS = [
  { label: 'Valuation Attractiveness', score: 78,  color: C.green },
  { label: 'Business Quality',         score: 94,  color: C.green },
  { label: 'Financial Health',         score: 81,  color: C.green },
  { label: 'Growth Momentum',          score: 79,  color: C.green },
  { label: 'Earnings Integrity',       score: 96,  color: C.green },
  { label: 'Analyst Sentiment',        score: 71,  color: C.amber },
] as const

function ConvictionScreen() {
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Score header */}
      <div className="flex items-center gap-4">
        <span style={{ fontSize: 48, fontWeight: 800, color: C.olive, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          82
        </span>
        <div className="flex flex-col gap-1">
          <div
            className="inline-flex items-center rounded-full px-2.5 py-0.5"
            style={{ background: C.oliveChip, border: `1px solid #BFD2A1` }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: C.olive }}>A−</span>
          </div>
          <p style={{ fontSize: 10, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
            Excellent business,<br />priced attractively
          </p>
        </div>
      </div>

      {/* Verdict */}
      <p style={{ fontSize: 10, color: C.textSecondary, lineHeight: 1.4 }}>
        Strong fundamentals with meaningful valuation upside.
      </p>

      {/* 2×3 dimension bars */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {DIMENSIONS.map((dim) => (
          <div key={dim.label}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 9, fontWeight: 600, color: C.textSecondary }}>{dim.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                {dim.score}
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 6, background: '#F0F0F0' }}
            >
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

// ── Screen content map ────────────────────────────────────────────────────────
const SCREENS: Record<number, { tabKey: TabKey; content: React.ReactNode }> = {
  0: { tabKey: 'overview',   content: <OverviewScreen /> },
  1: { tabKey: 'valuation',  content: <ValuationScreen /> },
  2: { tabKey: 'conviction', content: <ConvictionScreen /> },
}

// ── Browser chrome (reusable) ─────────────────────────────────────────────────
function BrowserChrome({ children }: { children: React.ReactNode }) {
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
              style={{ width: 12, height: 12, background: bg, border: '0.5px solid rgba(0,0,0,0.18)', boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.25)' }}
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
          <span style={{ fontSize: 10, color: '#6B6B6B', fontWeight: 500, letterSpacing: '-0.01em' }}>insic.app/stock/AAPL</span>
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

  // Cycle through screens every ~3 seconds while in view
  useEffect(() => {
    if (!shouldAnimate) return
    const DURATIONS = [3000, 3000, 3200] // ms per screen

    let timer: ReturnType<typeof setTimeout>
    function advance(idx: number) {
      const next = (idx + 1) % 3
      timer = setTimeout(() => {
        setScreenIndex(next)
        advance(next)
      }, DURATIONS[idx])
    }
    advance(screenIndex)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate])

  const screen = SCREENS[screenIndex]

  return (
    <BrowserChrome>
      {/* Mobile: cap height so card doesn't blow out the layout */}
      <div className="relative overflow-hidden max-h-[370px] sm:overflow-visible sm:max-h-none">
        {/* App shell: sidebar + main */}
        <div className="flex" style={{ minHeight: 380 }}>

          {/* Sidebar — hidden on narrow mock, visible on wider */}
          <div className="hidden sm:flex">
            <Sidebar />
          </div>

          {/* Main content column */}
          <div className="flex flex-col flex-1 min-w-0">
            <TopBar />
            <TabBar activeKey={screen.tabKey} reduced={reduced} />

            {/* Animated screen content */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={screenIndex}
                  initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
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

        {/* Mobile fade mask */}
        <div
          className="sm:hidden pointer-events-none absolute bottom-0 left-0 right-0"
          style={{ height: 64, background: 'linear-gradient(to bottom, transparent, #FFFFFF)' }}
          aria-hidden="true"
        />
      </div>
    </BrowserChrome>
  )
}
