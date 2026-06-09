'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { SummaryMockScreen, ValuationMockScreen } from './ProductScreenshots'

const SPRING = { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 } as const

const SUMMARY_BULLETS = [
  { label: 'Verdict',       desc: 'Undervalued, fairly valued, or overpriced — at a glance' },
  { label: 'Fair value',    desc: 'Blended estimate from 4 DCF models' },
  { label: 'Implied growth','desc': 'The revenue CAGR the current price assumes' },
]

const VALUATION_BULLETS = [
  { label: 'Scenario range',  desc: 'Bear, base, and bull outcomes side by side' },
  { label: 'Editable inputs', desc: 'Growth, margins, WACC, terminal rate — all live' },
  { label: 'Model blend',     desc: 'P/E, EV/EBITDA, Revenue multiple, Core DCF' },
]

function Panel({
  inView,
  reduced,
  delay,
  dotColor,
  eyebrow,
  title,
  bullets,
  screenshot,
}: {
  inView:     boolean
  reduced:    boolean | null
  delay:      number
  dotColor:   string
  eyebrow:    string
  title:      string
  bullets:    { label: string; desc: string }[]
  screenshot: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      {/* Copy */}
      <motion.div
        initial={reduced ? {} : { opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={reduced ? {} : { ...SPRING, delay }}
      >
        <p
          className="text-[11px] font-[700] uppercase tracking-[0.1em] mb-3"
          style={{ color: dotColor }}
        >
          {eyebrow}
        </p>
        <h3
          className="text-[22px] sm:text-[26px] font-[700] text-[#111111] leading-tight mb-4"
          style={{ letterSpacing: '-0.018em' }}
        >
          {title}
        </h3>

        <div className="space-y-3">
          {bullets.map((item, i) => (
            <motion.div
              key={item.label}
              className="flex items-start gap-3"
              initial={reduced ? {} : { opacity: 0, x: -14 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={reduced ? {} : { ...SPRING, delay: delay + 0.06 + i * 0.05 }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]"
                style={{ background: dotColor }}
              />
              <p className="text-[14px] leading-snug">
                <span className="font-[600] text-[#111111]">{item.label}</span>
                <span className="text-[#566174]"> — {item.desc}</span>
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Screenshot — iOS spring zoom from below */}
      <motion.div
        initial={reduced ? {} : { opacity: 0, y: 36, scale: 0.94 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={reduced ? {} : { ...SPRING, delay: delay + 0.1 }}
        className="relative"
      >
        {screenshot}

        {/* Subtle glow beneath */}
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-8 blur-2xl pointer-events-none"
          style={{ background: dotColor, opacity: 0.15 }}
        />
      </motion.div>
    </div>
  )
}

export default function ProductDeepDiveSection() {
  const ref     = useRef<HTMLElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section
      ref={ref}
      className="overflow-x-hidden"
      style={{ background: '#FAFAF8', borderBottom: '1px solid #E5E5E5' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">

        {/* Section heading */}
        <motion.div
          className="text-center mb-12 sm:mb-20"
          initial={reduced ? {} : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={reduced ? {} : { ...SPRING }}
        >
          <p
            className="text-[11px] font-[700] uppercase tracking-[0.1em] mb-4"
            style={{ color: '#5F790B' }}
          >
            The product
          </p>
          <h2
            className="text-[clamp(28px,5vw,44px)] font-[700] text-[#111111] [text-wrap:balance] mx-auto"
            style={{ letterSpacing: '-0.028em', lineHeight: 1.08, maxWidth: '640px' }}
          >
            Every number that matters.<br className="hidden sm:block" />
            Nothing that doesn&apos;t.
          </h2>
          <p
            className="mt-4 text-[15px] sm:text-[17px] text-[#566174] mx-auto leading-relaxed"
            style={{ maxWidth: '520px' }}
          >
            A structured workflow from price to verdict — with the assumptions you can see and edit.
          </p>
        </motion.div>

        {/* Two-panel grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20">
          <Panel
            inView={inView}
            reduced={reduced}
            delay={0.08}
            dotColor="#2563EB"
            eyebrow="Summary tab"
            title="Price, verdict, and implied growth — in seconds."
            bullets={SUMMARY_BULLETS}
            screenshot={<SummaryMockScreen />}
          />
          <Panel
            inView={inView}
            reduced={reduced}
            delay={0.16}
            dotColor="#5F790B"
            eyebrow="Valuation cockpit"
            title="Four models. One blended answer. Fully editable."
            bullets={VALUATION_BULLETS}
            screenshot={<ValuationMockScreen />}
          />
        </div>
      </div>
    </section>
  )
}
