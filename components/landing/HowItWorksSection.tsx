'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Search, TrendingUp, SlidersHorizontal } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

const STEPS = [
  {
    n: '1',
    Icon: Search,
    title: 'Search a ticker',
    body: 'Find any public company in seconds.',
    color: '#5F790B',
  },
  {
    n: '2',
    Icon: TrendingUp,
    title: 'Review fair value & market expectations',
    body: "See what has to be true at today's price.",
    color: '#5F790B',
  },
  {
    n: '3',
    Icon: SlidersHorizontal,
    title: 'Stress-test the assumptions',
    body: 'Adjust key drivers and explore different scenarios.',
    color: '#5F790B',
  },
]

export default function HowItWorksSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="overflow-x-hidden"
      style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E6E0' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header — scale zoom in */}
        <motion.div
          className="flex items-start gap-4 mb-12"
          initial={reduced ? {} : { opacity: 0, scale: 0.93, y: 18 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <motion.div
            className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0 mt-0.5"
            initial={reduced ? {} : { scale: 0.6, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
          >
            <svg className="w-5 h-5 text-[#5F790B]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/>
            </svg>
          </motion.div>
          <div>
            <h2 className="text-[26px] sm:text-[32px] font-bold text-[#0A1424] leading-tight" style={{ letterSpacing: '-0.025em' }}>
              A first-pass valuation in seconds.
            </h2>
            <p className="text-[14px] text-[#536174] mt-1.5 leading-relaxed">
              Go from searching a ticker to a clear valuation summary in three simple steps.
            </p>
          </div>
        </motion.div>

        {/* Steps layout */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">

          {/* Connector line — draws left to right */}
          <motion.div
            className="hidden sm:block absolute"
            style={{
              top: '20px',
              left: 'calc(16.7% + 24px)',
              right: 'calc(16.7% + 24px)',
              height: '1px',
              background: '#E3E6E0',
              transformOrigin: 'left center',
            }}
            initial={reduced ? {} : { scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.85, ease: EASE, delay: 0.28 }}
            aria-hidden="true"
          />

          {STEPS.map((step, i) => {
            const Icon = step.Icon
            return (
              <motion.div
                key={i}
                initial={reduced ? {} : { opacity: 0, y: 28, scale: 0.94 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.58, ease: EASE, delay: 0.16 + i * 0.12 }}
                className="flex flex-col items-start gap-4"
              >
                {/* Number badge — pops in */}
                <motion.div
                  className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[15px] shrink-0 z-10"
                  style={{ background: step.color }}
                  initial={reduced ? {} : { scale: 0.5, opacity: 0 }}
                  animate={inView ? { scale: 1, opacity: 1 } : {}}
                  transition={{
                    duration: 0.42,
                    ease: EASE,
                    delay: 0.28 + i * 0.12,
                    type: 'spring',
                    stiffness: 260,
                    damping: 18,
                  }}
                >
                  {step.n}
                  {/* Ripple on first step */}
                  {i === 0 && inView && !reduced && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[#5F790B]"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.85, opacity: 0 }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.7, repeat: Infinity, repeatDelay: 2 }}
                    />
                  )}
                </motion.div>

                {/* Icon */}
                <motion.div
                  className="w-9 h-9 rounded-[10px] bg-[#F8F7F2] border border-[#E3E6E0] flex items-center justify-center"
                  initial={reduced ? {} : { opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.38 + i * 0.12, duration: 0.35 }}
                >
                  <Icon size={16} className="text-[#536174]" strokeWidth={1.8} />
                </motion.div>

                <div>
                  <h3 className="text-[15px] font-bold text-[#0A1424] mb-1.5 leading-snug">{step.title}</h3>
                  <p className="text-[13px] text-[#536174] leading-relaxed">{step.body}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
