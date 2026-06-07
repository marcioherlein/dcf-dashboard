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
      style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E5E5' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-12 sm:py-20">

        {/* Header */}
        <motion.div
          className="mb-10 sm:mb-14"
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <h2 className="text-[24px] sm:text-[32px] font-bold text-[#111111] leading-tight" style={{ letterSpacing: '-0.025em' }}>
            A first-pass valuation in seconds.
          </h2>
          <p className="text-[14px] text-[#6B6B6B] mt-2 leading-relaxed max-w-md">
            Go from searching a ticker to a clear valuation summary in three simple steps.
          </p>
        </motion.div>

        {/* ── Desktop: 3-column grid with horizontal connector ── */}
        <div className="hidden sm:block">
          <div className="relative grid grid-cols-3 gap-8 sm:gap-10">
            {/* Connector line */}
            <motion.div
              className="absolute"
              style={{
                top: '20px',
                left: 'calc(16.7% + 20px)',
                right: 'calc(16.7% + 20px)',
                height: '1px',
                background: '#E5E5E5',
                transformOrigin: 'left center',
              }}
              initial={reduced ? {} : { scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.85, ease: EASE, delay: 0.3 }}
              aria-hidden="true"
            />

            {STEPS.map(({ n, Icon: _Icon, title, body }, i) => (
              <motion.div
                key={i}
                initial={reduced ? {} : { opacity: 0, x: i === 0 ? -20 : i === 2 ? 20 : 0, y: i === 1 ? 16 : 0 }}
                animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
                transition={{ duration: 0.52, ease: EASE, delay: 0.14 + i * 0.1 }}
                className="flex flex-col gap-4"
              >
                {/* Badge — number only, clean */}
                <motion.div
                  className="relative w-10 h-10 rounded-full bg-[#5F790B] flex items-center justify-center text-white font-bold text-[15px] shrink-0 z-10"
                  initial={reduced ? {} : { scale: 0.6, opacity: 0 }}
                  animate={inView ? { scale: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.28 + i * 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                >
                  {n}
                  {i === 0 && inView && !reduced && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[#5F790B]"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.85, opacity: 0 }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.8, repeat: Infinity, repeatDelay: 2.5 }}
                    />
                  )}
                </motion.div>

                <div>
                  <h3 className="text-[15px] font-bold text-[#111111] mb-1.5 leading-snug">{title}</h3>
                  <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Mobile: vertical list, number + text side-by-side ── */}
        <div className="sm:hidden flex flex-col">
          {STEPS.map(({ n, Icon, title, body }, i) => (
            <motion.div
              key={i}
              initial={reduced ? {} : { opacity: 0, x: -16 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.45, ease: EASE, delay: 0.12 + i * 0.1 }}
              className="flex gap-4 relative"
            >
              {/* Left column: badge + vertical connector */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 40 }}>
                <div className="w-10 h-10 rounded-full bg-[#5F790B] flex items-center justify-center text-white font-bold text-[15px] shrink-0 z-10 relative">
                  {n}
                  {i === 0 && inView && !reduced && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[#5F790B]"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.85, opacity: 0 }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.8, repeat: Infinity, repeatDelay: 2.5 }}
                    />
                  )}
                </div>
                {/* Vertical connector — hidden on last item */}
                {i < STEPS.length - 1 && (
                  <motion.div
                    className="w-px flex-1 mt-2"
                    style={{ background: '#E5E5E5', minHeight: 32 }}
                    initial={reduced ? {} : { scaleY: 0, originY: 0 }}
                    animate={inView ? { scaleY: 1 } : {}}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.3 + i * 0.1 }}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Right column: icon + text */}
              <div className={i < STEPS.length - 1 ? 'pb-8' : 'pb-0'}>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-[8px] bg-[#EEF4DD] flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-[#5F790B]" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#111111] leading-snug">{title}</h3>
                </div>
                <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
