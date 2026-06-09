'use client'
import { signIn, useSession } from 'next-auth/react'
import { motion, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

// ── Animated SVG path that draws itself ─────────────────────────────────────
function AnimatedPath({ d, stroke, strokeWidth, delay = 0, animate: shouldAnimate = true }: {
  d: string; stroke: string; strokeWidth: number; delay?: number; animate?: boolean
}) {
  const pathRef = useRef<SVGPathElement>(null)
  const [len, setLen] = useState(400)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength())
  }, [])

  useEffect(() => {
    if (!shouldAnimate) { setDrawn(true); return }
    const timer = setTimeout(() => setDrawn(true), delay * 1000 + 600)
    return () => clearTimeout(timer)
  }, [shouldAnimate, delay])

  return (
    <path
      ref={pathRef}
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      style={{
        strokeDasharray: len,
        strokeDashoffset: drawn ? 0 : len,
        transition: shouldAnimate ? `stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1) ${delay * 1000 + 600}ms` : 'none',
      }}
    />
  )
}

// ── Tab indicator — cycles through tabs on an interval ───────────────────────
const TABS = ['Overview', 'Valuation', 'Financials', 'Risks', 'News'] as const

function LiveTabIndicator({ activeTab }: { activeTab: number }) {
  return (
    <div className="flex border-b border-[#E5E5E5] px-4 gap-0">
      {TABS.map((t, i) => {
        const active = i === activeTab
        return (
          <span
            key={t}
            className="relative text-[11px] py-2.5 px-2 font-medium transition-colors duration-300"
            style={{ color: active ? '#111111' : '#9B9B9B' }}
          >
            {t}
            <span
              className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t transition-all duration-300"
              style={{
                background: '#5F790B',
                opacity: active ? 1 : 0,
                transform: active ? 'scaleX(1)' : 'scaleX(0)',
                transformOrigin: 'left',
              }}
            />
          </span>
        )
      })}
    </div>
  )
}

// ── Browser chrome frame ──────────────────────────────────────────────────────
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
      {/* Title bar — authentic macOS dark */}
      <div
        className="flex items-center gap-2 px-4"
        style={{
          height: '38px',
          background: 'linear-gradient(to bottom, #3C3C3C 0%, #2E2E2E 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.40)',
        }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #FF7A74, #FF5F56)',
              border: '0.5px solid rgba(0,0,0,0.18)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.25)',
            }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #FFCF4A, #FFBD2E)',
              border: '0.5px solid rgba(0,0,0,0.18)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.25)',
            }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #46D354, #28C840)',
              border: '0.5px solid rgba(0,0,0,0.18)',
              boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.25)',
            }}
          />
        </div>
        {/* Address bar */}
        <div
          className="flex-1 mx-3 rounded-md flex items-center px-3 gap-1.5"
          style={{ height: '22px', background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth={2.5} className="shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-[10px] text-[#6B6B6B] font-medium tracking-tight">insic.app/stock/AAPL</span>
        </div>
      </div>
      {/* Content */}
      <div style={{ background: '#FFFFFF' }}>
        {children}
      </div>
    </div>
  )
}

// ── Product mock card ─────────────────────────────────────────────────────────
function ProductMockCard({ inView, reduced }: { inView: boolean; reduced: boolean | null }) {
  const [activeTab, setActiveTab] = useState(0)
  const [verdictVisible, setVerdictVisible] = useState(false)
  const [metricsVisible, setMetricsVisible] = useState(false)
  const [chartVisible, setChartVisible] = useState(false)
  const [cagrVisible, setCagrVisible] = useState(false)
  const [barDrawn, setBarDrawn] = useState(false)

  // Tab cycling: pause on Valuation (index 1) for longer
  useEffect(() => {
    if (!inView || reduced) return
    const sequence = [
      { tab: 0, wait: 2200 },
      { tab: 1, wait: 4000 },
      { tab: 2, wait: 2200 },
      { tab: 0, wait: 2200 },
    ]
    let i = 0
    let timer: ReturnType<typeof setTimeout>

    function advance() {
      const { tab, wait } = sequence[i % sequence.length]
      setActiveTab(tab)
      i++
      timer = setTimeout(advance, wait)
    }

    timer = setTimeout(advance, 1800)
    return () => clearTimeout(timer)
  }, [inView, reduced])

  useEffect(() => {
    if (!inView || reduced) {
      setVerdictVisible(true); setMetricsVisible(true)
      setChartVisible(true); setCagrVisible(true); setBarDrawn(true)
      return
    }
    const t1 = setTimeout(() => setVerdictVisible(true), 300)
    const t2 = setTimeout(() => setMetricsVisible(true), 700)
    const t3 = setTimeout(() => setChartVisible(true), 1100)
    const t4 = setTimeout(() => setCagrVisible(true), 1500)
    const t5 = setTimeout(() => setBarDrawn(true), 1800)
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, [inView, reduced])

  return (
    <BrowserChrome>
      {/* Mobile height cap: ~340px with fade-out peek effect; full height on sm+ */}
      <div className="relative overflow-hidden max-h-[340px] sm:overflow-visible sm:max-h-none">
      {/* App top bar */}
      <div
        className="flex items-center justify-between px-4"
        style={{ height: '44px', borderBottom: '1px solid #E5E5E5', background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)' }}
      >
        {/* Logo */}
        <span className="font-bold text-[13px] tracking-tight" style={{ color: '#111111', letterSpacing: '-0.03em' }}>insic</span>
        {/* Search mock */}
        <div className="flex items-center gap-1.5 rounded px-2.5 py-1.5" style={{ background: '#F5F5F5', border: '1px solid #E5E5E5' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9B9B9B" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <span className="text-[10px] text-[#6B6B6B]">Search tickers…</span>
        </div>
        {/* Avatar */}
        <div className="w-6 h-6 rounded-full bg-[#5F790B] flex items-center justify-center">
          <span className="text-[8px] font-bold text-white">MH</span>
        </div>
      </div>

      {/* Stock header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#FAFAFA', borderBottom: '1px solid #E5E5E5' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#F0F0F0] border border-[#E5E5E5] flex items-center justify-center text-[10px] font-bold text-[#111111]">A</div>
          <div>
            <span className="text-[13px] font-bold text-[#111111] mr-1.5">AAPL</span>
            <span className="text-[11px] text-[#6B6B6B]">Apple Inc.</span>
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-bold tabular-nums text-[#111111]">$183.42</span>
          <motion.span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: '#11875D' }}
            initial={{ opacity: 0, x: 4 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.4, ease: EASE }}
          >
            +1.25%
          </motion.span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white' }}>
        <LiveTabIndicator activeTab={activeTab} />
      </div>

      {/* Content area */}
      <div style={{ background: 'white', padding: '0 0 4px' }}>

        {/* Verdict card */}
        <motion.div
          className="mx-4 mt-3 mb-2 rounded-lg px-4 py-3"
          style={{ border: '1px solid #BFD2A1', background: 'linear-gradient(135deg, #F6FAEA 0%, #EEF4DD 100%)' }}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={verdictVisible ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#5F790B] mb-1.5">INSIC VERDICT</p>
          <p className="text-[15px] font-bold text-[#111111] leading-snug">
            AAPL looks{' '}
            <motion.span
              style={{ color: '#5F790B' }}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={verdictVisible ? { opacity: 1, filter: 'blur(0px)' } : {}}
              transition={{ delay: 0.2, duration: 0.45, ease: EASE }}
            >
              Undervalued
            </motion.span>
          </p>
          <div className="flex items-center gap-2 mt-2">
            <motion.span
              className="text-[9.5px] font-semibold rounded-full px-2 py-0.5"
              style={{ color: '#11875D', background: '#E8F7EF', border: '1px solid #A7D7C0' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={verdictVisible ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.32, duration: 0.38, ease: EASE }}
            >
              High confidence
            </motion.span>
            <motion.span
              className="text-[9.5px] text-[#6B6B6B]"
              initial={{ opacity: 0 }}
              animate={verdictVisible ? { opacity: 1 } : {}}
              transition={{ delay: 0.44, duration: 0.35 }}
            >
              4 of 4 models
            </motion.span>
          </div>
        </motion.div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 mx-4 mb-3 rounded-md overflow-hidden" style={{ border: '1px solid #E8E6E0' }}>
          {[
            { label: 'Fair Value', val: '$226.80', color: '#5F790B', bg: '#F6FAEA', delay: 0 },
            { label: 'Current Price', val: '$183.42', color: '#111111', bg: '#FAFAFA', delay: 0.07 },
            { label: 'Upside', val: '+23.6%', color: '#11875D', bg: '#F6FAEA', delay: 0.14 },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              className="text-center py-2.5"
              style={{ background: m.bg, borderRight: i < 2 ? '1px solid #E8E6E0' : 'none' }}
              initial={{ opacity: 0, y: 8 }}
              animate={metricsVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: m.delay, duration: 0.4, ease: EASE }}
            >
              <p className="text-[8px] text-[#6B6B6B] uppercase tracking-wider mb-0.5">{m.label}</p>
              <p className="text-[13px] font-bold tabular-nums" style={{ color: m.color }}>{m.val}</p>
            </motion.div>
          ))}
        </div>

        {/* Scenario range */}
        <motion.div
          className="mx-4 mb-3"
          initial={{ opacity: 0 }}
          animate={metricsVisible ? { opacity: 1 } : {}}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <p className="text-[8.5px] text-[#6B6B6B] mb-1.5">Scenario range</p>
          <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #F0B8B8 0%, #E5E5E5 42%, #BFD2A1 100%)' }}>
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-sm"
              style={{ left: '42%', border: '2px solid #5F790B' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={metricsVisible ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.4, duration: 0.5, type: 'spring', stiffness: 300, damping: 20 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-[#6B6B6B]">$150.10 Bear</span>
            <span className="text-[8px] font-semibold text-[#5F790B]">$226.60 Base</span>
            <span className="text-[8px] text-[#6B6B6B]">$305.40 Bull</span>
          </div>
        </motion.div>

        {/* Price chart */}
        <motion.div
          className="mx-4 mb-3"
          initial={{ opacity: 0, y: 6 }}
          animate={chartVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="flex items-center gap-4 mb-2">
            {[['Price', '#111111'], ['Fair Value', '#5F790B'], ['Analyst Target', '#2563EB']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-[8.5px] text-[#6B6B6B]">
                <span style={{ display: 'inline-block', width: 14, height: 2, background: c, borderRadius: 1 }} />
                {l}
              </span>
            ))}
          </div>
          <div className="rounded overflow-hidden" style={{ background: '#FAFAFA', border: '1px solid #E8E6E0', padding: '8px 8px 4px' }}>
            <svg viewBox="0 0 260 64" className="w-full" style={{ height: 52, display: 'block' }}>
              {/* Area fill under price line */}
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111111" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#111111" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,52 C20,49 40,45 60,42 C80,39 90,35 110,29 C130,23 150,25 170,21 C190,17 210,13 230,11 C245,9 255,7 260,7 L260,64 L0,64 Z"
                fill="url(#priceGrad)"
                opacity={chartVisible ? 1 : 0}
                style={{ transition: 'opacity 0.6s ease 0.8s' }}
              />
              <AnimatedPath
                d="M0,52 C20,49 40,45 60,42 C80,39 90,35 110,29 C130,23 150,25 170,21 C190,17 210,13 230,11 C245,9 255,7 260,7"
                stroke="#111111"
                strokeWidth={1.5}
                animate={chartVisible && !reduced}
              />
              <AnimatedPath
                d="M0,40 L260,26"
                stroke="#5F790B"
                strokeWidth={1.5}
                delay={0.3}
                animate={chartVisible && !reduced}
              />
              <path d="M0,34 L260,34" stroke="#2563EB" strokeWidth={1} fill="none" strokeDasharray="4 3"
                opacity={chartVisible ? 0.7 : 0}
                style={{ transition: 'opacity 0.4s ease 1.8s' }}
              />
              {['Jul','Oct','2025','Apr','Jul'].map((t, i) => (
                <text key={t} x={[2,65,120,175,230][i]} y="63" fontSize="6.5" fill="#B0B8C4">{t}</text>
              ))}
            </svg>
          </div>
        </motion.div>

        {/* CAGR card */}
        <motion.div
          className="mx-4 mb-4 rounded-md px-3 py-2.5"
          style={{ border: '1px solid #E5E5E5', background: '#FAFAFA' }}
          initial={{ opacity: 0, y: 10 }}
          animate={cagrVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className="text-[8.5px] text-[#6B6B6B] mb-1.5">Market-implied 5Y revenue CAGR at today&apos;s price</p>
          <div className="flex items-center justify-between">
            <motion.span
              className="text-[17px] font-bold tabular-nums text-[#111111]"
              initial={{ opacity: 0 }}
              animate={cagrVisible ? { opacity: 1 } : {}}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              12.1%
            </motion.span>
            <motion.span
              className="text-[9.5px] font-semibold rounded-full px-2.5 py-0.5"
              style={{ background: '#FFF4DA', color: '#B56A00', border: '1px solid #F3D391' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={cagrVisible ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.22, duration: 0.38, ease: EASE }}
            >
              Moderate
            </motion.span>
          </div>
          <div className="relative mt-2 h-1 rounded-full overflow-hidden" style={{ background: '#E5E5E5' }}>
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white"
              style={{ border: '2px solid #5F790B' }}
              initial={{ left: '5%', opacity: 0 }}
              animate={barDrawn ? { left: '38%', opacity: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.9, ease: [0.34, 1, 0.64, 1] }}
            />
          </div>
          <div className="flex justify-between mt-1">
            {['Conservative\n<8%', 'Moderate\n8–15%', 'Aggressive\n15–25%', 'Very Aggressive\n>25%'].map(l => (
              <span key={l} className="text-[7.5px] text-[#B0B8C4] text-center leading-tight" style={{ whiteSpace: 'pre-line' }}>{l}</span>
            ))}
          </div>
        </motion.div>

      </div>
      {/* Fade mask on mobile only — implies more content below */}
      <div
        className="sm:hidden pointer-events-none absolute bottom-0 left-0 right-0"
        style={{ height: '64px', background: 'linear-gradient(to bottom, transparent, #FFFFFF)' }}
        aria-hidden="true"
      />
      </div>
    </BrowserChrome>
  )
}

// ── Animated financial background ────────────────────────────────────────────
function HeroBackground({ reduced }: { reduced: boolean | null }) {
  const animStyle = reduced
    ? {}
    : {
        animation: 'chartDrift 7s ease-in-out infinite alternate',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <style>{`
        @keyframes chartDrift {
          0%   { transform: translateY(0px); }
          100% { transform: translateY(-12px); }
        }
      `}</style>
      <svg width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal grid lines at 20%, 40%, 60%, 80% */}
        <line x1="0" y1="20%" x2="100%" y2="20%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="40%" x2="100%" y2="40%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="60%" x2="100%" y2="60%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="80%" x2="100%" y2="80%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

        {/* Vertical tick marks every ~10% of width */}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => (
          <line
            key={x}
            x1={`${x}%`} y1="0"
            x2={`${x}%`} y2="100%"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        ))}

        {/* Price lines — wrapped in a group so animation applies to both */}
        <g style={animStyle}>
          {/* Primary olive price line — slow-rising curved path */}
          <path
            d="M -5% 85% C 15% 78%, 30% 65%, 50% 52% C 65% 42%, 78% 32%, 105% 18%"
            stroke="rgba(95,121,11,0.22)"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Secondary white price line */}
          <path
            d="M -5% 92% C 10% 85%, 28% 76%, 48% 68% C 62% 62%, 80% 55%, 105% 44%"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
            fill="none"
          />
        </g>
      </svg>
    </div>
  )
}

// ── Market pricing teaser ────────────────────────────────────────────────────
// Now lives in MarketTeaserSection.tsx (extracted from hero for clean narrative boundary)

// ── Main component ───────────────────────────────────────────────────────────
export default function LandingHero() {
  const { data: session } = useSession()
  const reduced = useReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardInView, setCardInView] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setCardInView(true); obs.disconnect() }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      className="overflow-x-hidden relative"
      style={{
        paddingTop: 'max(72px, calc(60px + 2vh))',
        paddingBottom: 'clamp(52px, 6vh, 80px)',
        background: '#000000',
      }}
    >
      {/* Animated financial chart background */}
      <HeroBackground reduced={reduced} />

      {/* Subtle radial olive aurora — behind content */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 55% at 70% 45%, rgba(95,121,11,0.12) 0%, transparent 65%)',
          zIndex: 0,
        }}
      />

      <div className="relative mx-auto px-4 sm:px-6" style={{ maxWidth: '1200px', zIndex: 1 }}>
        <div className="grid items-start grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Left: Copy ── */}
          <div className="text-left">

            {/* Badge */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-5"
              style={{
                background: 'rgba(95,121,11,0.15)',
                border: '1px solid rgba(95,121,11,0.35)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#5F790B]" />
              <span className="text-[12px] font-semibold text-[#7C9A19]">
                DCF-grade analysis tools for individual investors
              </span>
            </motion.div>

            {/* Headline — line-by-line stagger */}
            <div className="mb-3 sm:mb-4" style={{ lineHeight: 1.05, letterSpacing: '-0.035em' }}>
              {[
                { text: 'Invest with', delay: 0.06, plain: true },
                { text: 'a process,', delay: 0.14, plain: true },
                { text: 'not a story.', delay: 0.22, plain: false },
              ].map(({ text, delay, plain }) => (
                <motion.div
                  key={text}
                  initial={reduced ? {} : { opacity: 0, y: 20, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.6, ease: EASE, delay }}
                  className="font-bold block"
                  style={{
                    fontSize: 'clamp(32px, 9.5vw, 60px)',
                    color: plain ? '#FFFFFF' : '#7C9A19',
                    textWrap: 'balance',
                  }}
                >
                  {text}
                </motion.div>
              ))}
            </div>

            {/* Sub-copy */}
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.32 }}
              className="text-[14px] sm:text-[16px] leading-relaxed mb-6"
              style={{ maxWidth: '440px', color: 'rgba(255,255,255,0.72)' }}
            >
              Instantly see if a stock is undervalued or overpriced. Analyze any ticker in seconds — no spreadsheets required.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.42 }}
              className="flex flex-col sm:flex-row gap-3 mb-6"
            >
              {session ? (
                <Link
                  href="/analyze"
                  className="inline-flex items-center justify-center rounded-md px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                  style={{ background: '#5F790B', boxShadow: '0 4px 16px rgba(95,121,11,0.28)', minHeight: '52px' }}
                >
                  Analyze for free
                </Link>
              ) : (
                <motion.button
                  onClick={() => signIn('google')}
                  className="inline-flex items-center justify-center rounded-md px-6 py-3.5 text-[15px] font-semibold text-white transition-all active:scale-95"
                  style={{ background: '#5F790B', minHeight: '52px' }}
                  whileHover={reduced ? {} : { y: -2, boxShadow: '0 8px 24px rgba(95,121,11,0.38)' }}
                  transition={{ duration: 0.2 }}
                  initial={{ boxShadow: '0 4px 16px rgba(95,121,11,0.28)' }}
                >
                  Analyze for free
                </motion.button>
              )}
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.28)] transition-colors"
                style={{ minHeight: '52px' }}
              >
                <Play size={13} className="text-[#7C9A19]" fill="#7C9A19" />
                See how it works
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={reduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.56 }}
              className="flex items-center gap-3"
            >
              <div className="flex -space-x-2">
                {['#C8C8C8', '#C4C4C4', '#9B9B9B'].map((bg, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center" style={{ background: bg }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/></svg>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className="w-3.5 h-3.5" fill="#5F790B" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <span className="text-[12px] text-[rgba(255,255,255,0.55)]">Trusted by investors who do their own research</span>
              </div>
            </motion.div>
          </div>

          {/* ── Right: Product card ── */}
          <motion.div
            ref={cardRef}
            initial={reduced ? {} : { opacity: 0, x: 28, y: 6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 55, damping: 20, delay: 0.2 }}
            className="w-full max-w-[360px] sm:max-w-[420px] mx-auto lg:mx-0 lg:max-w-[500px] lg:ml-auto"
          >
            <ProductMockCard inView={cardInView} reduced={reduced} />
          </motion.div>

        </div>
      </div>

      {/* Reduced motion override */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
    </section>
  )
}
