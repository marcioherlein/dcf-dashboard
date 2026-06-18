'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Users, TrendingUp, BarChart2, BookOpen } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

const VALUES = [
  'Focus on long-term intrinsic value',
  'Cut through noise with a repeatable framework.',
  'Build positions based on numbers, not narrative',
  'Save, compare, and track your ideas',
]

// Animated check mark that draws itself
function AnimatedCheck({ visible, reduced }: { visible: boolean; reduced: boolean | null }) {
  return (
    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
      <motion.path
        d="M1 4L4 7.5L10 1"
        stroke="#5F790B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={visible ? { pathLength: 1, opacity: 1 } : {}}
        transition={{
          pathLength: reduced ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' },
          opacity: { duration: 0.1 },
        }}
      />
    </svg>
  )
}

export default function TestimonialsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="overflow-x-hidden" style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-16 items-center">

          {/* Left: header + animated value list */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, x: -24, filter: 'blur(6px)' }}
            animate={inView ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="flex items-start gap-4 mb-8">
              <motion.div
                className="w-10 h-10 rounded-md bg-[#EEF2FA] flex items-center justify-center shrink-0 mt-0.5"
                initial={reduced ? {} : { scale: 0.6, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
              >
                <Users size={18} className="text-[#5F790B]" strokeWidth={1.8} />
              </motion.div>
              <div>
                <h2 className="text-[26px] sm:text-[32px] font-bold text-[#111111] leading-tight" style={{ letterSpacing: '-0.025em', textWrap: 'balance' }}>
                  Built for investors who do their own research
                </h2>
              </div>
            </div>

            <div className="space-y-4">
              {VALUES.map((v, i) => (
                <motion.div
                  key={v}
                  initial={reduced ? {} : { opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.45, ease: EASE, delay: 0.18 + i * 0.09 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-[#EEF2FA] flex items-center justify-center shrink-0">
                    <AnimatedCheck
                      visible={inView}
                      reduced={reduced}
                    />
                  </div>
                  <span className="text-[14px] sm:text-[15px] text-[#111111] font-medium leading-snug">{v}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: proof block — stats + practitioner context */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: 30, scale: 0.95 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.65, ease: EASE, delay: 0.2 }}
            className="rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-6 sm:p-8 shadow-card"
          >
            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-4 sm:gap-5 mb-6">
              {[
                { icon: BarChart2, stat: '50 000+', label: 'DCF analyses run', sub: 'since launch' },
                { icon: Users, stat: '3 000+', label: 'active investors', sub: '' },
                { icon: TrendingUp, stat: '5 000+', label: 'stocks covered', sub: 'NYSE & NASDAQ' },
                { icon: BookOpen, stat: '100 %', label: 'formula-transparent', sub: 'no black boxes' },
              ].map(({ icon: Icon, stat, label, sub }, i) => (
                <motion.div
                  key={label}
                  initial={reduced ? {} : { opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.32 + i * 0.07 }}
                  className="flex flex-col gap-1.5 rounded-xl bg-white border border-[#E5E5E5] px-4 py-3.5"
                >
                  <Icon size={15} className="text-[#5F790B]" strokeWidth={1.8} aria-hidden="true" />
                  <span className="text-[22px] font-bold text-[#111111] leading-none" style={{ letterSpacing: '-0.03em' }}>{stat}</span>
                  <span className="text-[12px] text-[#6B6B6B] leading-snug">{label}</span>
                  {sub && <span className="text-[10px] text-[#9B9B9B] leading-none">{sub}</span>}
                </motion.div>
              ))}
            </div>

            {/* Practitioner note */}
            <motion.div
              initial={reduced ? {} : { opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.45, ease: EASE, delay: 0.6 }}
              className="flex items-start gap-3 pt-1"
            >
              <div className="w-1 self-stretch rounded-full bg-[#5F790B] shrink-0" aria-hidden="true" />
              <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
                Built by equity analysts and software engineers who use it for their own portfolios. Every model is open to inspection — no black boxes.
              </p>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
