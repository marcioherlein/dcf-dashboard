'use client'
import { signIn, useSession } from 'next-auth/react'
import { motion, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

// ── Animated path that draws itself ─────────────────────────────────────────
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
        transition: shouldAnimate ? `stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1) ${delay * 1000 + 600}ms` : 'none',
      }}
    />
  )
}

// ── Typewriter "tab" indicator cycles through tabs ───────────────────────────
function LiveTabIndicator() {
  const tabs = ['Overview', 'Valuation', 'Financials', 'Risks', 'News']
  const [active, setActive] = useState(0)

  useEffect(() => {
    const cycle = [0, 1800, 2800, 3600, 4400]
    const timers = cycle.map((t, i) =>
      setTimeout(() => setActive(i), t)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex border-b border-[#E3E6E0] px-4 gap-4">
      {tabs.map((t, i) => (
        <span
          key={t}
          className="text-[11px] py-2.5 font-medium border-b-2 -mb-px transition-all duration-300"
          style={{
            borderColor: i === active ? '#5F790B' : 'transparent',
            color: i === active ? '#0A1424' : '#8A96A8',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

// ── Product mock card with internal "demo" animations ───────────────────────
function ProductMockCard({ inView, reduced }: { inView: boolean; reduced: boolean | null }) {
  const [verdictVisible, setVerdictVisible] = useState(false)
  const [metricsVisible, setMetricsVisible] = useState(false)
  const [chartVisible, setChartVisible] = useState(false)
  const [cagrVisible, setCagrVisible] = useState(false)
  const [barDrawn, setBarDrawn] = useState(false)

  useEffect(() => {
    if (!inView || reduced) {
      setVerdictVisible(true); setMetricsVisible(true)
      setChartVisible(true); setCagrVisible(true); setBarDrawn(true)
      return
    }
    const t1 = setTimeout(() => setVerdictVisible(true), 400)
    const t2 = setTimeout(() => setMetricsVisible(true), 900)
    const t3 = setTimeout(() => setChartVisible(true), 1300)
    const t4 = setTimeout(() => setCagrVisible(true), 1700)
    const t5 = setTimeout(() => setBarDrawn(true), 2000)
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, [inView, reduced])

  return (
    <div
      className="relative w-full rounded-[20px] border border-[#E3E6E0] bg-white overflow-hidden"
      style={{ boxShadow: '0 16px 48px rgba(6,16,31,0.12), 0 4px 16px rgba(6,16,31,0.06)' }}
    >
      {/* Stock header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E6E0] bg-[#FBFAF7]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F0F0F0] border border-[#E3E6E0] flex items-center justify-center text-[9px] font-bold text-[#0A1424]">A</div>
          <span className="text-[12px] font-bold text-[#0A1424]">AAPL</span>
          <span className="text-[11px] text-[#536174]">Apple Inc.</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-bold tabular-nums text-[#0A1424]">$183.42</span>
          <motion.span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: '#11875D' }}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            +1.25%
          </motion.span>
        </div>
      </div>

      {/* Animated tabs */}
      <LiveTabIndicator />

      {/* Verdict — slides in */}
      <motion.div
        className="mx-4 mt-3 mb-2 rounded-[12px] border border-[#BFD2A1] bg-[#F6FAEA] px-4 py-3"
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={verdictVisible ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F790B] mb-1">INSIC VERDICT</p>
        <p className="text-[14px] font-bold text-[#0A1424]">
          AAPL looks{' '}
          <motion.span
            style={{ color: '#5F790B' }}
            initial={{ opacity: 0 }}
            animate={verdictVisible ? { opacity: 1 } : {}}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            Undervalued
          </motion.span>
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <motion.span
            className="text-[10px] font-semibold text-[#11875D] bg-[#E8F7EF] border border-[#A7D7C0] rounded-full px-2 py-0.5"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={verdictVisible ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.35, duration: 0.35, ease: EASE }}
          >
            High confidence
          </motion.span>
          <motion.span
            className="text-[10px] text-[#536174]"
            initial={{ opacity: 0 }}
            animate={verdictVisible ? { opacity: 1 } : {}}
            transition={{ delay: 0.45, duration: 0.3 }}
          >
            4 of 4 models
          </motion.span>
        </div>
      </motion.div>

      {/* Metrics — counter animation */}
      <div className="grid grid-cols-3 gap-0 mx-4 mb-3">
        {[
          { label: 'Fair Value', val: '$226.80', cls: '#5F790B', delay: 0 },
          { label: 'Current Price', val: '$183.42', cls: '#0A1424', delay: 0.08 },
          { label: 'Upside', val: '+23.6%', cls: '#11875D', delay: 0.16 },
        ].map(m => (
          <motion.div
            key={m.label}
            className="text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={metricsVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: m.delay, duration: 0.4, ease: EASE }}
          >
            <p className="text-[9px] text-[#8A96A8] mb-0.5">{m.label}</p>
            <p className="text-[13px] font-bold tabular-nums" style={{ color: m.cls }}>{m.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Scenario range bar */}
      <div className="mx-4 mb-3">
        <p className="text-[9px] text-[#8A96A8] mb-1.5">Scenario range</p>
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-[#F0B8B8] via-[#E3E6E0] to-[#BFD2A1]">
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#5F790B] shadow-sm"
            style={{ left: '42%' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={metricsVisible ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: 0.3, duration: 0.4, type: 'spring', stiffness: 250, damping: 18 }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[#8A96A8]">$150.10 Bear</span>
          <span className="text-[9px] font-semibold text-[#5F790B]">$226.60 Base</span>
          <span className="text-[9px] text-[#8A96A8]">$305.40 Bull</span>
        </div>
      </div>

      {/* Price chart — draws itself */}
      <motion.div
        className="mx-4 mb-3"
        initial={{ opacity: 0 }}
        animate={chartVisible ? { opacity: 1 } : {}}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-1.5">
          {[['Price', '#0A1424'], ['Fair Value (Base)', '#5F790B'], ['Analyst Target', '#2563EB']].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1 text-[9px] text-[#536174]">
              <span style={{ display: 'inline-block', width: 12, height: 1.5, background: c }} />
              {l}
            </span>
          ))}
        </div>
        <svg viewBox="0 0 260 70" className="w-full" style={{ height: 56 }}>
          <AnimatedPath
            d="M0,55 C20,52 40,48 60,45 C80,42 90,38 110,32 C130,26 150,28 170,24 C190,20 210,16 230,14 C245,12 255,10 260,10"
            stroke="#0A1424"
            strokeWidth={1.5}
            animate={chartVisible && !reduced}
          />
          <AnimatedPath
            d="M0,42 L260,28"
            stroke="#5F790B"
            strokeWidth={1.5}
            delay={0.3}
            animate={chartVisible && !reduced}
          />
          <path d="M0,36 L260,36" stroke="#2563EB" strokeWidth={1} fill="none" strokeDasharray="4 3" opacity={chartVisible ? 1 : 0} style={{ transition: 'opacity 0.4s ease 1.6s' }} />
          {['Jul','Oct','2025','Apr','Jul'].map((t, i) => (
            <text key={t} x={[2,65,120,175,230][i]} y="68" fontSize="7" fill="#8A96A8">{t}</text>
          ))}
        </svg>
      </motion.div>

      {/* Market implied CAGR */}
      <motion.div
        className="mx-4 mb-4 rounded-[10px] border border-[#E3E6E0] bg-[#FBFAF7] px-3 py-2.5"
        initial={{ opacity: 0, y: 8 }}
        animate={cagrVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <p className="text-[9px] text-[#536174] mb-1">Market-implied 5Y revenue CAGR at today&apos;s price</p>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold tabular-nums text-[#0A1424]">12.1%</span>
          <motion.span
            className="text-[10px] font-semibold bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391] rounded-full px-2 py-0.5"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={cagrVisible ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.35, ease: EASE }}
          >
            Moderate
          </motion.span>
        </div>
        <div className="relative mt-2 h-1 rounded-full bg-[#E3E6E0] overflow-hidden">
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full bg-[#E3E6E0]"
            style={{ width: '100%' }}
          />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#5F790B]"
            initial={{ left: '0%', opacity: 0 }}
            animate={barDrawn ? { left: '38%', opacity: 1 } : {}}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.34, 1, 0.64, 1] }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {['Conservative\n<8%', 'Moderate\n8–15%', 'Aggressive\n15–25%', 'Very Aggressive\n>25%'].map(l => (
            <span key={l} className="text-[8px] text-[#8A96A8] text-center leading-tight" style={{ whiteSpace: 'pre-line' }}>{l}</span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ── Market pricing teaser ────────────────────────────────────────────────────
// Hardened: values visible by default (no opacity:0 gate), animate on enter.
// Uses whileInView directly — no manual IntersectionObserver needed.

const TEASER_ROWS = [
  { label: 'Implied 5Y Revenue CAGR', val: '12.1%',    type: 'hero',   i: 0 },
  { label: '3Y Historical CAGR',      val: '6.7%',     type: 'normal', i: 1 },
  { label: 'Analyst Estimate (5Y)',   val: '9.3%',     type: 'normal', i: 2 },
  { label: 'Market Interpretation',   val: 'Moderate', type: 'badge',  i: 3 },
] as const

// The CAGR spectrum bar — shows where 12.1% sits
function CAGRBar({ reduced }: { reduced: boolean | null }) {
  // 12.1% is in "Moderate" zone (8–15%). Map to position: ~47% across
  const position = 47

  const zones = [
    { label: 'Conservative', sub: '<8%',     width: 28 },
    { label: 'Moderate',     sub: '8–15%',   width: 26 },
    { label: 'Aggressive',   sub: '15–25%',  width: 26 },
    { label: 'Very Agr.',    sub: '>25%',    width: 20 },
  ]

  const zoneColors = ['#E8F7EF', '#EEF4DD', '#FFF4DA', '#FCEAEA']
  const zoneBorders = ['#A7D7C0', '#BFD2A1', '#F3D391', '#F0B8B8']

  return (
    <div className="mt-5">
      {/* Zone bar */}
      <div className="relative flex rounded-full overflow-hidden h-2 mb-3" style={{ gap: 2 }}>
        {zones.map((z, i) => (
          <div
            key={z.label}
            className="h-full relative"
            style={{ width: `${z.width}%`, background: zoneColors[i], border: `1px solid ${zoneBorders[i]}` }}
          />
        ))}
        {/* Indicator dot */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 z-10"
          style={{ left: `${position}%` }}
          initial={reduced ? {} : { scale: 0, opacity: 0 }}
          whileInView={reduced ? {} : { scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: 0.5, duration: 0.4, type: 'spring', stiffness: 280, damping: 18 }}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#5F790B] shadow-sm -translate-x-1/2" />
        </motion.div>
      </div>

      {/* Zone labels */}
      <div className="flex text-[10px] text-[#8A96A8]">
        {zones.map((z, i) => (
          <div key={z.label} className="flex flex-col items-center leading-tight" style={{ width: `${z.width}%` }}>
            <span className={i === 1 ? 'font-semibold text-[#5F790B]' : ''}>{z.label}</span>
            <span>{z.sub}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketTeaserSection({ reduced }: { reduced: boolean | null }) {
  return (
    <motion.div
      className="mt-10 mx-auto px-4 sm:px-6 relative"
      style={{ maxWidth: '1200px', zIndex: 1 }}
      initial={reduced ? {} : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div
        className="rounded-[20px] border border-[#E3E6E0] bg-white overflow-hidden"
        style={{ boxShadow: '0 8px 32px rgba(6,16,31,0.07)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-[#F3F2EC]">
          <motion.div
            className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0 mt-0.5"
            whileInView={reduced ? {} : { scale: [0.8, 1.12, 1] }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
          >
            <svg className="w-4.5 h-4.5 text-[#5F790B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </motion.div>
          <div>
            <h2 className="text-[17px] font-bold text-[#0A1424] leading-tight">What the market is pricing in</h2>
            <p className="text-[13px] text-[#536174] mt-1 leading-relaxed">
              See the growth and profitability the market expects over the coming years.
            </p>
          </div>
        </div>

        {/* Body: two-column on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#F3F2EC]">

          {/* Left: data rows */}
          <div className="px-6 py-5">
            <p className="text-[11px] font-bold text-[#8A96A8] mb-4 tracking-[0.05em]">Example: Apple Inc. (AAPL)</p>

            <div className="space-y-0">
              {TEASER_ROWS.map(({ label, val, type, i }) => (
                <motion.div
                  key={label}
                  className="flex items-center justify-between py-3 border-b border-[#F3F2EC] last:border-0"
                  // Hardened: visible by default, animates in on scroll
                  initial={reduced ? {} : { opacity: 0, x: -14 }}
                  whileInView={reduced ? {} : { opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: EASE_OUT_EXPO }}
                >
                  <span className={`text-[13px] leading-snug ${type === 'hero' ? 'font-semibold text-[#0A1424]' : 'text-[#536174]'}`}>
                    {label}
                  </span>
                  {type === 'badge' ? (
                    <motion.span
                      className="text-[11px] font-semibold bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391] rounded-full px-2.5 py-0.5 shrink-0"
                      initial={reduced ? {} : { opacity: 0, scale: 0.85 }}
                      whileInView={reduced ? {} : { opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.32, duration: 0.35, ease: EASE }}
                    >
                      {val}
                    </motion.span>
                  ) : type === 'hero' ? (
                    <span className="text-[18px] font-bold tabular-nums text-[#5F790B] shrink-0">{val}</span>
                  ) : (
                    <span className="text-[13px] font-semibold tabular-nums text-[#0A1424] shrink-0">{val}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right: spectrum + summary */}
          <div className="px-6 py-5">
            <p className="text-[11px] font-bold text-[#8A96A8] mb-4 tracking-[0.05em]">Growth spectrum</p>

            {/* Big callout number */}
            <div className="flex items-baseline gap-2 mb-1">
              <motion.span
                className="text-[40px] font-bold tabular-nums text-[#0A1424] leading-none"
                initial={reduced ? {} : { opacity: 0, y: 8 }}
                whileInView={reduced ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
              >
                12.1%
              </motion.span>
              <span className="text-[13px] text-[#536174]">implied annually</span>
            </div>
            <p className="text-[12px] text-[#8A96A8] mb-1">vs. 6.7% historical track record</p>

            <CAGRBar reduced={reduced} />

            <motion.p
              className="mt-4 text-[12px] text-[#536174] leading-relaxed"
              initial={reduced ? {} : { opacity: 0 }}
              whileInView={reduced ? {} : { opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              At today&apos;s price, the market implies 12.1% annual revenue growth over the next 5 years — above Apple&apos;s recent track record of 6.7%.
            </motion.p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

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
        paddingTop: 'max(96px, calc(80px + 2vh))',
        paddingBottom: 'clamp(48px, 7vh, 80px)',
        background: '#F8F7F2',
      }}
    >
      {/* Subtle radial olive aurora — behind content */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 55% at 70% 45%, rgba(95,121,11,0.07) 0%, transparent 65%)',
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
                background: 'rgba(95,121,11,0.09)',
                border: '1px solid rgba(95,121,11,0.22)',
              }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-[#5F790B]"
                animate={reduced ? {} : { scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="text-[12px] font-semibold text-[#5F790B]">
                Institutional-quality valuation tools for individual investors
              </span>
            </motion.div>

            {/* Headline — line-by-line stagger */}
            <div className="mb-4" style={{ lineHeight: 1.05, letterSpacing: '-0.035em' }}>
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
                  className="text-[40px] sm:text-[52px] lg:text-[clamp(42px,4.5vw,60px)] font-bold block"
                  style={{ color: plain ? '#0A1424' : '#5F790B' }}
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
              className="text-[16px] text-[#536174] leading-relaxed mb-8"
              style={{ maxWidth: '440px' }}
            >
              insic helps you value businesses through fair value estimates,
              market-implied expectations, and transparent assumptions — so you
              can understand what has to be true before you invest.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.42 }}
              className="flex flex-col sm:flex-row gap-3 mb-8"
            >
              {session ? (
                <Link
                  href="/analyze"
                  className="inline-flex items-center justify-center rounded-[10px] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                  style={{ background: '#5F790B', boxShadow: '0 4px 16px rgba(95,121,11,0.28)', minHeight: '52px' }}
                >
                  Start analyzing for free
                </Link>
              ) : (
                <motion.button
                  onClick={() => signIn('google')}
                  className="inline-flex items-center justify-center rounded-[10px] px-6 py-3.5 text-[15px] font-semibold text-white transition-all active:scale-95"
                  style={{ background: '#5F790B', minHeight: '52px' }}
                  whileHover={reduced ? {} : { y: -2, boxShadow: '0 8px 24px rgba(95,121,11,0.38)' }}
                  transition={{ duration: 0.2 }}
                  initial={{ boxShadow: '0 4px 16px rgba(95,121,11,0.28)' }}
                >
                  Start analyzing for free
                </motion.button>
              )}
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#CBD1C4] bg-white px-6 py-3.5 text-[15px] font-semibold text-[#0A1424] hover:bg-[#F6FAEA] hover:border-[#5F790B] transition-colors"
                style={{ minHeight: '52px' }}
              >
                <Play size={13} className="text-[#5F790B]" fill="#5F790B" />
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
                {['#CBD1C4', '#B6BFCC', '#8A96A8'].map((bg, i) => (
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
                <span className="text-[12px] text-[#536174]">Trusted by investors who do their own research</span>
              </div>
            </motion.div>
          </div>

          {/* ── Right: Product card ── */}
          <motion.div
            ref={cardRef}
            initial={reduced ? {} : { opacity: 0, x: 28, y: 6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 55, damping: 20, delay: 0.2 }}
            className="w-full max-w-[420px] mx-auto lg:mx-0 lg:max-w-none"
          >
            <ProductMockCard inView={cardInView} reduced={reduced} />
          </motion.div>

        </div>
      </div>

      <MarketTeaserSection reduced={reduced} />

      {/* Reduced motion override */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
    </section>
  )
}
