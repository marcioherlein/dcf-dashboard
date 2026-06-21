'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1] as const

const QUOTES = [
  {
    text: "I was about to buy MELI at $1,500. Ran the reverse DCF and saw the market was pricing in 28% revenue growth for 5 years. Made me think twice before sizing up.",
    author: 'Alex K.',
    role: 'Individual investor, 7 years',
    attribution: 'Beta tester · Nov 2024',
    initials: 'AK',
    bg: '#3b4a6b',
  },
  {
    text: "The Conviction Score is what got me. It's not just 'undervalued' — it tells you whether the business actually deserves a buy. Saved me from a value trap.",
    author: 'Sarah R.',
    role: 'CFA candidate',
    attribution: 'Beta tester · Dec 2024',
    initials: 'SR',
    bg: '#4a5568',
  },
  {
    text: "I used to spend 2 hours building DCF models in Excel. Now I do a first pass in 2 minutes and only go deep when the numbers warrant it.",
    author: 'Marcus H.',
    role: 'Software engineer, DIY investor',
    attribution: 'Beta tester · Jan 2025',
    initials: 'MH',
    bg: '#2d3748',
  },
]

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
          className="mb-10 sm:mb-12"
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

        {/* Quote cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {QUOTES.map((q, i) => (
            <motion.div
              key={q.author}
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: EASE, delay: 0.10 + i * 0.08 }}
              className="rounded-2xl bg-white border border-[#E5E5E5] p-6 flex flex-col gap-4 shadow-card"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} className="w-3.5 h-3.5" fill="#5F790B" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>

              <p className="text-[14px] text-[#333333] leading-relaxed flex-1" style={{ fontStyle: 'italic' }}>
                &ldquo;{q.text}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-1 border-t border-[#F0F0F0]">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: q.bg }}
                >
                  {q.initials}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#111111] leading-none">{q.author}</p>
                  <p className="text-[11px] text-[#9B9B9B] mt-0.5 leading-none">{q.role}</p>
                  <p className="text-[10px] text-[#C0C0C0] mt-0.5 leading-none">{q.attribution}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats row */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-12"
          initial={reduced ? {} : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: 0.42 }}
        >
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-[26px] font-bold text-[#111111] leading-none" style={{ letterSpacing: '-0.03em' }}>
                {value}
              </p>
              <p className="text-[12px] text-[#9B9B9B] mt-1">{label}</p>
            </div>
          ))}
          <div className="text-center">
            <p className="text-[13px] text-[#6B6B6B] max-w-[220px] leading-relaxed">
              Built by equity analysts who use it for their own portfolios.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
