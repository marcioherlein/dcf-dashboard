'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'

const STEPS = [
  {
    n: '1',
    title: 'Search any stock.',
    body: 'Find any public company in seconds. No onboarding or credit card required.',
    color: '#2563EB',
  },
  {
    n: '2',
    title: 'Model runs instantly.',
    body: 'We analyze fundamentals, run multiple valuation methods, and reverse DCF the price.',
    color: '#7C3AED',
  },
  {
    n: '3',
    title: 'Get a clear verdict.',
    body: 'See fair value, upside/downside, and what the market is already pricing in.',
    color: '#059669',
  },
]

const EASE = [0.16, 1, 0.3, 1] as const

export default function HowItWorksSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="overflow-x-hidden"
      style={{ background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">

        {/* Heading — scale zoom in */}
        <motion.div
          initial={reduced !== false ? {} : { opacity: 0, scale: 0.92, y: 20 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: EASE }}
          className="text-center mb-10 sm:mb-14"
        >
          <h2
            className="text-[28px] sm:text-[38px] lg:text-[clamp(32px,3.2vw,44px)] text-slate-900 [text-wrap:balance]"
            style={{
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              marginBottom: '12px',
            }}
          >
            A verdict in under 30 seconds.
          </h2>
          <p className="text-base sm:text-[17px] text-slate-600 leading-[1.55]">
            No spreadsheet. No financial degree required.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Connector line — draws from left */}
          <motion.div
            className="hidden sm:block absolute"
            style={{
              top: '32px',
              left: 'calc(16.7% + 20px)',
              right: 'calc(16.7% + 20px)',
              height: '1px',
              background: 'linear-gradient(90deg, #BFDBFE 0%, #E2E8F0 50%, #BFDBFE 100%)',
              transformOrigin: 'left center',
            }}
            initial={reduced !== false ? {} : { scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
            aria-hidden="true"
          />

          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={reduced !== false ? {} : { opacity: 0, scale: 0.93, y: 28 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ duration: 0.62, ease: EASE, delay: 0.12 + i * 0.10 }}
              className="flex flex-col items-center text-center rounded-[18px] border bg-white p-7"
              style={{
                borderColor: '#E6ECF5',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)',
              }}
            >
              {/* Number badge — pop */}
              <motion.div
                initial={reduced !== false ? {} : { opacity: 0, scale: 0.55 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.38, ease: EASE, delay: 0.28 + i * 0.10 }}
                className="flex items-center justify-center rounded-full text-white font-bold z-10 mb-5"
                style={{
                  width: '44px',
                  height: '44px',
                  background: step.color,
                  fontSize: '16px',
                  boxShadow: `0 4px 14px ${step.color}44`,
                }}
                aria-label={`Step ${step.n}`}
              >
                {step.n}
              </motion.div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#0F172A',
                  marginBottom: '10px',
                  letterSpacing: '-0.015em',
                }}
              >
                {step.title}
              </h3>
              <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#475569' }}>
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Arrow hint */}
        <motion.div
          className="hidden sm:flex justify-center mt-6"
          initial={reduced !== false ? {} : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.55 }}
        >
          <div className="flex items-center gap-2 text-[13px] text-slate-400">
            <ArrowRight size={14} />
            <span>Seconds from search to verdict</span>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
