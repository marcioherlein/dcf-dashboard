'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1] as const

const STATS = [
  { value: '50 000+', label: 'analyses run' },
  { value: '5 000+',  label: 'stocks covered' },
  { value: '5',       label: 'valuation methods blended' },
]

export default function TestimonialsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="overflow-x-hidden" style={{ background: '#F8F8F6', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <motion.div
          className="mb-10 sm:mb-12 text-center"
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <h2
            className="text-[26px] sm:text-[34px] font-bold text-[#111111] leading-tight mb-2"
            style={{ letterSpacing: '-0.025em' }}
          >
            Built for investors who do their own research
          </h2>
          <p className="text-[15px] text-[#6B6B6B]">
            No hype. No algorithms telling you what to buy. Just the numbers.
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-10 sm:gap-16"
          initial={reduced ? {} : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: 0.18 }}
        >
          {STATS.map(({ value, label }, i) => (
            <motion.div
              key={label}
              className="text-center"
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, ease: EASE, delay: 0.22 + i * 0.08 }}
            >
              <p className="text-[36px] sm:text-[42px] font-[800] text-[#111111] leading-none tabular-nums" style={{ letterSpacing: '-0.04em' }}>
                {value}
              </p>
              <p className="text-[13px] text-[#9B9B9B] mt-1.5">{label}</p>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  )
}
