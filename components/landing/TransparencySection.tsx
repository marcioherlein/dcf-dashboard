'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Eye, LayoutGrid, Database, TrendingUp } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

const FEATURES = [
  {
    Icon: Eye,
    title: 'Transparent assumptions',
    body: 'See every driver that impacts value.',
  },
  {
    Icon: LayoutGrid,
    title: 'Multiple valuation methods',
    body: 'DCF, Reverse DCF, and multiples.',
  },
  {
    Icon: Database,
    title: 'Public data sources',
    body: 'Financials and estimates from trusted providers.',
  },
  {
    Icon: TrendingUp,
    title: 'Sensitivity & scenarios',
    body: 'See how outcomes change when assumptions change.',
  },
]

export default function TransparencySection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="overflow-x-hidden" style={{ background: '#F8F7F2', borderBottom: '1px solid #E3E6E0' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <motion.div
          className="flex items-start gap-4 mb-10"
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-[#5F790B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[26px] sm:text-[32px] font-bold text-[#0A1424] leading-tight" style={{ letterSpacing: '-0.025em' }}>
              No black boxes.<br />Every assumption is yours.
            </h2>
            <p className="text-[14px] text-[#536174] mt-1.5 leading-relaxed max-w-[480px]">
              We believe investors deserve transparency in how fair value is derived.
            </p>
          </div>
        </motion.div>

        {/* 2×2 feature grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {FEATURES.map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.50, ease: EASE, delay: 0.08 + i * 0.08 }}
              className="rounded-[16px] border border-[#E3E6E0] bg-white p-5 sm:p-6"
              style={{ boxShadow: '0 4px 16px rgba(6,16,31,0.05)' }}
            >
              <div className="w-9 h-9 rounded-[10px] bg-[#F8F7F2] border border-[#E3E6E0] flex items-center justify-center mb-3">
                <Icon size={16} className="text-[#5F790B]" strokeWidth={1.8} />
              </div>
              <h3 className="text-[14px] sm:text-[15px] font-bold text-[#0A1424] mb-1.5 leading-snug">{title}</h3>
              <p className="text-[12px] sm:text-[13px] text-[#536174] leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
