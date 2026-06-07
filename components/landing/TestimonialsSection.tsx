'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Users } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

const VALUES = [
  'Focus on long-term intrinsic value',
  'Ignore noise. Follow the process.',
  'Make better decisions with clarity',
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
            initial={reduced ? {} : { opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="flex items-start gap-4 mb-8">
              <motion.div
                className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0 mt-0.5"
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
                  initial={reduced ? {} : { opacity: 0, x: -16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.45, ease: EASE, delay: 0.18 + i * 0.09 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-[#EEF4DD] flex items-center justify-center shrink-0">
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

          {/* Right: testimonial card — float animation */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: 30, scale: 0.95 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.65, ease: EASE, delay: 0.2 }}
          >
            <motion.div
              className="rounded-[18px] border border-[#E5E5E5] bg-[#FAFAFA] p-6 sm:p-8 relative"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
              animate={reduced ? {} : { y: [0, -6, 0] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {/* Quote mark */}
              <div
                className="absolute -top-3 left-6 w-7 h-7 rounded-full bg-[#EEF4DD] border border-[#BFD2A1] flex items-center justify-center"
                aria-hidden="true"
              >
                <span className="text-[#5F790B] font-bold text-[14px]" style={{ lineHeight: 1 }}>&ldquo;</span>
              </div>

              <p className="text-[15px] sm:text-[16px] text-[#111111] leading-relaxed mb-6 pt-2">
                Finally, a tool that shows me what the market is pricing in and lets me test my own assumptions.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5F790B] flex items-center justify-center shrink-0">
                  <span className="text-[13px] font-bold text-white leading-none">MT</span>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#111111]">Michael T.</p>
                  <p className="text-[12px] text-[#6B6B6B]">Self-directed investor</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
