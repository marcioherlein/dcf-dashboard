'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Eye, LayoutGrid, Database, TrendingUp } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

const FEATURES = [
  {
    Icon: Eye,
    iconColor: '#5F790B',
    iconBg: '#EEF4DD',
    title: 'Transparent assumptions',
    body: 'See every driver that impacts value.',
    chips: ['Growth rate', 'WACC', 'Margins'],
    chipStyle: { bg: '#EEF4DD', text: '#5F790B', border: '#BFD2A1' },
  },
  {
    Icon: LayoutGrid,
    iconColor: '#5F790B',
    iconBg: '#EEF4DD',
    title: 'Multiple valuation methods',
    body: 'DCF, Reverse DCF, and multiples working together.',
    chips: ['DCF', 'Reverse DCF', 'Multiples'],
    chipStyle: { bg: '#EEF4DD', text: '#5F790B', border: '#BFD2A1' },
  },
  {
    Icon: Database,
    iconColor: '#6B6B6B',
    iconBg: '#FFFFFF',
    title: 'Public data sources',
    body: 'Financials and estimates from trusted providers.',
    chips: ['FRED', 'Yahoo Finance', 'SEC'],
    chipStyle: { bg: '#F5F5F5', text: '#6B6B6B', border: '#E5E5E5' },
  },
  {
    Icon: TrendingUp,
    iconColor: '#B56A00',
    iconBg: '#FFF4DA',
    title: 'Sensitivity & scenarios',
    body: 'See how outcomes change when assumptions change.',
    chips: ['Bear', 'Base', 'Bull'],
    chipStyle: { bg: '#FFF4DA', text: '#B56A00', border: '#F3D391' },
  },
]

export default function TransparencySection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="overflow-x-hidden" style={{ background: '#F5F5F5', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header — scale zoom, matches the original pattern */}
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial={reduced ? {} : { opacity: 0, scale: 0.93, y: 18 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <h2
            className="text-[28px] sm:text-[36px] lg:text-[clamp(30px,3vw,42px)] text-[#111111]"
            style={{ fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: '12px', textWrap: 'balance' }}
          >
            No black boxes. Every assumption is yours.
          </h2>
          <p className="text-[15px] sm:text-[17px] text-[#6B6B6B] mx-auto leading-relaxed" style={{ maxWidth: '520px' }}>
            We believe investors deserve transparency in how fair value is derived.
            Every model, source, and assumption is visible and adjustable.
          </p>
        </motion.div>

        {/* 2×2 card grid — horizontal scroll on mobile, stagger reveal on desktop */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto snap-x snap-mandatory pb-4 sm:pb-0 sm:overflow-visible">
          <div className="flex gap-4 w-max sm:w-auto sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
            {FEATURES.map(({ Icon, iconColor, iconBg, title, body, chips, chipStyle }, i) => (
              <motion.div
                key={title}
                initial={reduced ? {} : { opacity: 0, scale: 0.94 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.5, ease: [0.34, 1, 0.64, 1], delay: 0.1 + i * 0.08 }}
                whileHover={reduced ? {} : { y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.09)' }}
                className="snap-start flex flex-col rounded-[18px] bg-white border border-[#C8C8C8] p-6 transition-shadow w-[72vw] max-w-[280px] sm:w-auto sm:max-w-none"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
              >
                {/* Icon */}
                <div
                  className="flex items-center justify-center rounded-[10px] mb-5 shrink-0"
                  style={{ width: '42px', height: '42px', background: iconBg }}
                  aria-hidden="true"
                >
                  <Icon size={18} color={iconColor} strokeWidth={1.8} />
                </div>

                <h3 className="text-[15px] font-bold text-[#111111] mb-2 leading-snug" style={{ letterSpacing: '-0.01em' }}>
                  {title}
                </h3>
                <p className="text-[13px] text-[#6B6B6B] leading-relaxed mb-4 flex-1">
                  {body}
                </p>

                {/* Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: chipStyle.bg, color: chipStyle.text, borderColor: chipStyle.border }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
