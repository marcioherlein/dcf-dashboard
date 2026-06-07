'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Eye, LayoutGrid, Database, TrendingUp } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

export default function TransparencySection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="overflow-x-hidden" style={{ background: '#F5F5F5', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <motion.div
          className="mb-10 sm:mb-14"
          initial={reduced ? {} : { opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <h2
            className="text-[28px] sm:text-[36px] lg:text-[clamp(30px,3vw,42px)] text-[#111111]"
            style={{ fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: '12px', textWrap: 'balance' }}
          >
            No black boxes. Every assumption is yours.
          </h2>
          <p className="text-[15px] sm:text-[17px] text-[#6B6B6B] leading-relaxed" style={{ maxWidth: '480px' }}>
            Every model, source, and assumption is visible and adjustable.
          </p>
        </motion.div>

        {/* ── Anchor card — Transparent assumptions (lead feature) ── */}
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          className="rounded-[20px] bg-white border border-[#C8C8C8] p-7 sm:p-9 mb-4 sm:mb-5"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-start">
            <div>
              <div
                className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center mb-4"
                aria-hidden="true"
              >
                <Eye size={18} color="#5F790B" strokeWidth={1.8} />
              </div>
              <h3 className="text-[20px] sm:text-[24px] font-bold text-[#111111] mb-2" style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Transparent assumptions
              </h3>
              <p className="text-[15px] text-[#6B6B6B] leading-relaxed max-w-[420px]">
                See every driver that impacts value — growth rate, WACC, margins, terminal multiple. Adjust any input and watch the fair value update in real time.
              </p>
            </div>
            {/* Chips — right column on desktop, below on mobile */}
            <div className="flex flex-wrap sm:flex-col gap-2 sm:gap-2 sm:items-end shrink-0">
              {['Growth rate', 'WACC', 'Margins', 'Exit multiple'].map(chip => (
                <span
                  key={chip}
                  className="rounded-full border px-3 py-1 text-[12px] font-semibold whitespace-nowrap"
                  style={{ background: '#EEF4DD', color: '#5F790B', borderColor: '#BFD2A1' }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Three supporting cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {[
            {
              Icon: LayoutGrid,
              title: 'Multiple valuation methods',
              body: 'DCF, Reverse DCF, and multiples — all running in parallel.',
              chips: ['DCF', 'Reverse DCF', 'Multiples'],
              delay: 0.14,
            },
            {
              Icon: Database,
              title: 'Public data sources',
              body: 'Financials and estimates from trusted, verifiable providers.',
              chips: ['FRED', 'Yahoo Finance', 'SEC'],
              delay: 0.20,
            },
            {
              Icon: TrendingUp,
              title: 'Sensitivity & scenarios',
              body: 'Bear, base, and bull cases show how outcomes shift.',
              chips: ['Bear', 'Base', 'Bull'],
              delay: 0.26,
            },
          ].map(({ Icon, title, body, chips, delay }) => (
            <motion.div
              key={title}
              initial={reduced ? {} : { opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: EASE, delay }}
              className="rounded-[18px] bg-white border border-[#C8C8C8] p-5 flex flex-col"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
            >
              <div
                className="w-9 h-9 rounded-[8px] bg-[#EEF4DD] flex items-center justify-center mb-4 shrink-0"
                aria-hidden="true"
              >
                <Icon size={16} color="#5F790B" strokeWidth={1.8} />
              </div>
              <h3 className="text-[14px] font-bold text-[#111111] mb-1.5 leading-snug" style={{ letterSpacing: '-0.01em' }}>
                {title}
              </h3>
              <p className="text-[13px] text-[#6B6B6B] leading-relaxed mb-4 flex-1">
                {body}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map(chip => (
                  <span
                    key={chip}
                    className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: '#EEF4DD', color: '#5F790B', borderColor: '#BFD2A1' }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
