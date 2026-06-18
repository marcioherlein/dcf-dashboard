'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Eye, LayoutGrid, Database, TrendingUp } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const

// Primary features — elevated treatment, larger card, expanded description
const PRIMARY = [
  {
    Icon: Eye,
    iconColor: '#5F790B',
    iconBg: '#EEF2FA',
    title: 'Transparent assumptions',
    body: 'Every driver that affects fair value — growth rate, WACC, terminal margins — is visible and editable. No parameter hidden behind a paywall or buried in a black box.',
    chips: ['Growth rate', 'WACC', 'Margins'],
    chipStyle: { bg: '#EEF2FA', text: '#5F790B', border: '#BFD2A1' },
  },
  {
    Icon: LayoutGrid,
    iconColor: '#5F790B',
    iconBg: '#EEF2FA',
    title: 'Multiple valuation methods',
    body: 'DCF, Reverse DCF, and multiples work together in the same view. Compare outputs side-by-side and understand why they diverge.',
    chips: ['DCF', 'Reverse DCF', 'Multiples'],
    chipStyle: { bg: '#EEF2FA', text: '#5F790B', border: '#BFD2A1' },
  },
]

// Supporting features — compact list treatment
const SECONDARY = [
  {
    Icon: Database,
    iconColor: '#6B6B6B',
    iconBg: '#F0F0F0',
    title: 'Public data sources',
    detail: 'FRED · Yahoo Finance · SEC',
  },
  {
    Icon: TrendingUp,
    iconColor: '#B56A00',
    iconBg: '#FFF4DA',
    title: 'Sensitivity & scenarios',
    detail: 'Bear · Base · Bull',
  },
]

export default function TransparencySection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section ref={ref} className="[overflow-x:clip]" style={{ background: '#F5F5F5', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial={reduced ? {} : { opacity: 0, scale: 0.94 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
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

        {/* Primary tier — 2 large cards, side by side */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto snap-x snap-mandatory pb-4 sm:pb-0 sm:overflow-visible mb-4 sm:mb-5">
          <div className="flex gap-4 w-max sm:w-auto sm:grid sm:grid-cols-2 sm:gap-5">
            {PRIMARY.map(({ Icon, iconColor, iconBg, title, body, chips, chipStyle }, i) => (
              <motion.div
                key={title}
                initial={reduced ? {} : { opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, ease: [0.34, 1, 0.64, 1], delay: 0.1 + i * 0.08 }}
                whileHover={reduced ? {} : { y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.09)' }}
                className="snap-start flex flex-col rounded-2xl bg-white border border-[#C8C8C8] p-7 transition-shadow w-[80vw] max-w-[340px] sm:w-auto sm:max-w-none shadow-card"
              >
                {/* Icon */}
                <div
                  className="flex items-center justify-center rounded-md mb-5 shrink-0"
                  style={{ width: '44px', height: '44px', background: iconBg }}
                  aria-hidden="true"
                >
                  <Icon size={20} color={iconColor} strokeWidth={1.8} />
                </div>

                <h3 className="text-[17px] font-bold text-[#111111] mb-3 leading-snug" style={{ letterSpacing: '-0.02em' }}>
                  {title}
                </h3>
                <p className="text-[14px] text-[#6B6B6B] leading-relaxed mb-5 flex-1">
                  {body}
                </p>

                {/* Chips */}
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border px-3 py-1 text-[12px] font-semibold"
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

        {/* Secondary tier — compact row list */}
        <div className="grid sm:grid-cols-2 gap-3">
          {SECONDARY.map(({ Icon, iconColor, iconBg, title, detail }, i) => (
            <motion.div
              key={title}
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.07 }}
              className="flex items-center gap-4 rounded-xl bg-white border border-[#E5E5E5] px-5 py-4"
            >
              <div
                className="flex items-center justify-center rounded-md shrink-0"
                style={{ width: '36px', height: '36px', background: iconBg }}
                aria-hidden="true"
              >
                <Icon size={16} color={iconColor} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#111111] leading-snug" style={{ letterSpacing: '-0.01em' }}>
                  {title}
                </p>
                <p className="text-[12px] text-[#9B9B9B] mt-0.5 leading-none">
                  {detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
