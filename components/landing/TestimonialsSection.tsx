'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Users, Check } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

const VALUES = [
  'Focus on long-term intrinsic value',
  'Ignore noise. Follow the process.',
  'Make better decisions with clarity',
  'Save, compare, and track your ideas',
]

export default function TestimonialsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="overflow-x-hidden" style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E6E0' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 items-start">

          {/* Left: section header + value list */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0 mt-0.5">
                <Users size={18} className="text-[#5F790B]" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-[26px] sm:text-[30px] font-bold text-[#0A1424] leading-tight" style={{ letterSpacing: '-0.025em' }}>
                  Built for investors<br />who do their<br />own research
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {VALUES.map((v, i) => (
                <motion.div
                  key={v}
                  initial={reduced ? {} : { opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.12 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-[#EEF4DD] flex items-center justify-center shrink-0">
                    <Check size={11} className="text-[#5F790B]" strokeWidth={2.5} />
                  </div>
                  <span className="text-[14px] text-[#0A1424] font-medium">{v}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: testimonial card */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, ease: EASE, delay: 0.14 }}
          >
            <div
              className="rounded-[16px] border border-[#E3E6E0] bg-[#FBFAF7] p-6"
              style={{ boxShadow: '0 4px 16px rgba(6,16,31,0.05)' }}
            >
              <p className="text-[14px] sm:text-[15px] text-[#0A1424] leading-relaxed mb-5" style={{ fontStyle: 'italic' }}>
                &ldquo;Finally, a tool that shows me what the market is pricing in and lets me test my own assumptions.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                {/* Avatar placeholder */}
                <div className="w-10 h-10 rounded-full bg-[#E3E6E0] flex items-center justify-center shrink-0 overflow-hidden">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#8A96A8]" fill="currentColor">
                    <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0A1424]">Michael T.</p>
                  <p className="text-[12px] text-[#8A96A8]">Individual Investor</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
