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
  },
  {
    n: '2',
    Icon: TrendingUp,
    title: 'Review fair value & market expectations',
    body: "See what has to be true at today's price.",
  },
  {
    n: '3',
    Icon: SlidersHorizontal,
    title: 'Stress-test the assumptions',
    body: 'Adjust key drivers and explore different scenarios.',
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

        {/* Header */}
        <motion.div
          className="flex items-start gap-4 mb-10"
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-[#5F790B]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-[26px] sm:text-[32px] font-bold text-[#0A1424] leading-tight" style={{ letterSpacing: '-0.025em' }}>
              A first-pass valuation in seconds.
            </h2>
            <p className="text-[14px] text-[#536174] mt-1.5 leading-relaxed">
              Go from searching a ticker to a clear valuation summary in three simple steps.
            </p>
          </div>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.Icon
            return (
              <motion.div
                key={i}
                initial={reduced ? {} : { opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.55, ease: EASE, delay: 0.08 + i * 0.10 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[14px] shrink-0"
                    style={{ background: '#5F790B' }}
                  >
                    {step.n}
                  </div>
                </div>
                <div className="pb-4 sm:pb-0">
                  <div className="w-9 h-9 rounded-[10px] bg-[#F8F7F2] border border-[#E3E6E0] flex items-center justify-center mb-3">
                    <Icon size={16} className="text-[#536174]" strokeWidth={1.8} />
                  </div>
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
