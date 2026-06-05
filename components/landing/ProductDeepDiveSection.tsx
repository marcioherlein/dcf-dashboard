'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { SummaryMockScreen, ValuationMockScreen } from './ProductScreenshots'

const EASE = [0.16, 1, 0.3, 1] as const

// Trimmed to 3 most essential bullets per panel
const SUMMARY_BULLETS = [
  { label: 'Investment Verdict', desc: 'Undervalued / Fairly Valued / Overvalued' },
  { label: 'Intrinsic Value', desc: 'Blended fair value estimate' },
  { label: 'Reverse DCF', desc: 'The growth rate the current price implies' },
]

const VALUATION_BULLETS = [
  { label: 'Blended Fair Value', desc: 'vs. current price' },
  { label: 'Scenario Range', desc: 'Bear / Base / Bull outcomes' },
  { label: 'Editable Assumptions', desc: 'Growth, margins, WACC, terminal rate' },
]

function AnimatedPanel({
  inView,
  reduced,
  delay,
  dotColor,
  title,
  subtitle,
  pullQuote,
  bullets,
  screenshot,
}: {
  inView: boolean
  reduced: boolean | null
  delay: number
  dotColor: string
  title: string
  subtitle: string
  pullQuote: string
  bullets: { label: string; desc: string }[]
  screenshot: React.ReactNode
}) {
  return (
    <div>
      {/* Copy block */}
      <motion.div
        className="mb-5"
        initial={reduced !== false ? {} : { opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: EASE, delay }}
      >
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0A1424', letterSpacing: '-0.015em', marginBottom: '8px' }}>
          {title}
        </h3>
        <p className="text-base" style={{ color: '#36455A', lineHeight: 1.6 }}>
          {subtitle}
        </p>
      </motion.div>

      {/* Bullet list — staggered x slide */}
      <div className="space-y-2 mb-5">
        {bullets.map((item, i) => (
          <motion.div
            key={item.label}
            initial={reduced !== false ? {} : { opacity: 0, x: -18 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.45, ease: EASE, delay: delay + 0.08 + i * 0.055 }}
            className="flex items-start gap-3"
          >
            <div
              className="rounded-full shrink-0"
              style={{ width: '6px', height: '6px', background: dotColor, marginTop: '7px' }}
            />
            <div>
              <span className="text-sm font-semibold" style={{ color: '#0A1424' }}>{item.label}</span>
              <span className="text-sm ml-1.5" style={{ color: '#536174' }}>{item.desc}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pull-quote — user-outcome sentence */}
      <motion.p
        className="text-[13px] italic mb-6"
        style={{ color: '#8A96A8', borderLeft: '2px solid #E3E6E0', paddingLeft: '12px' }}
        initial={reduced !== false ? {} : { opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, ease: EASE, delay: delay + 0.28 }}
      >
        {pullQuote}
      </motion.p>

      {/* Screenshot — Apple-style zoom in from below */}
      <motion.div
        className="relative"
        initial={reduced !== false ? {} : { opacity: 0, scale: 0.88, y: 40 }}
        animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
        transition={{ duration: 0.78, ease: EASE, delay: delay + 0.18 }}
      >
        {screenshot}
      </motion.div>
    </div>
  )
}

export default function ProductDeepDiveSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="overflow-x-hidden" style={{ background: 'white', borderBottom: '1px solid #E3E6E0' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">

        {/* Heading */}
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial={reduced !== false ? {} : { opacity: 0, scale: 0.92, y: 20 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <h2
            className="text-[28px] sm:text-[36px] lg:text-[clamp(30px,3vw,42px)] text-[#0A1424] [text-wrap:balance]"
            style={{
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              marginBottom: '16px',
            }}
          >
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p
            className="text-base sm:text-[17px] mx-auto"
            style={{ color: '#36455A', lineHeight: 1.6, maxWidth: '560px' }}
          >
            insic turns valuation into a structured workflow: price, intrinsic
            value, reverse DCF, business quality, risks, and assumptions.
          </p>
        </motion.div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <AnimatedPanel
            inView={inView}
            reduced={reduced}
            delay={0.10}
            dotColor="#2563EB"
            title="Summary at a glance"
            subtitle="One screen. Price, verdict, implied growth, and quality scores."
            pullQuote="You know whether the stock is cheap before reading a single analyst note."
            bullets={SUMMARY_BULLETS}
            screenshot={<SummaryMockScreen />}
          />
          <AnimatedPanel
            inView={inView}
            reduced={reduced}
            delay={0.20}
            dotColor="#5F790B"
            title="Valuation deep dive"
            subtitle="Bull, base, and bear scenarios. Model weights. Editable assumptions."
            pullQuote="Change one number and see how far the fair value moves. No spreadsheet needed."
            bullets={VALUATION_BULLETS}
            screenshot={<ValuationMockScreen />}
          />
        </div>
      </div>
    </section>
  )
}
