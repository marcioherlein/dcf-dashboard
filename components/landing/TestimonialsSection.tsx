'use client'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1] as const

const QUOTES = [
  {
    text: "The Reverse DCF gave me a framework to see exactly what growth rate any stock is pricing in — before I decide whether to buy.",
    name: 'Michael T.',
    role: 'Self-Directed Investor',
    initial: 'M',
    color: '#2563EB',
  },
  {
    text: "I love how fast it is. I can go from idea to verdict in under a minute and focus my time on the best opportunities.",
    name: 'Sarah L.',
    role: 'Portfolio Manager',
    initial: 'S',
    color: '#7C3AED',
  },
  {
    text: "Finally, a tool that shows what the market is assuming. It's become essential to my investment process.",
    name: 'David K.',
    role: 'Independent Analyst',
    initial: 'D',
    color: '#059669',
  },
]

export default function TestimonialsSection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section
      ref={ref}
      className="overflow-x-hidden"
      style={{ background: '#050D1F', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">

        {/* Heading */}
        <motion.div
          className="text-center mb-10 sm:mb-12"
          initial={reduced !== false ? {} : { opacity: 0, scale: 0.92, y: 20 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <h2
            className="text-[28px] sm:text-[36px] lg:text-[clamp(30px,3vw,42px)] [text-wrap:balance]"
            style={{
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#F8FAFC',
            }}
          >
            Built for people who do their own research.
          </h2>
        </motion.div>

        {/* Cards — staggered zoom from below */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto snap-x snap-mandatory pb-4 sm:pb-0 sm:overflow-visible">
          <div className="flex gap-4 w-max sm:w-auto sm:grid sm:grid-cols-3 sm:gap-6">
            {QUOTES.map((q, i) => (
              <motion.div
                key={i}
                initial={reduced !== false ? {} : { opacity: 0, scale: 0.90, y: 32 }}
                animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
                transition={{ duration: 0.65, ease: EASE, delay: 0.10 + i * 0.12 }}
                className="snap-start rounded-[20px] border p-6 sm:p-7 flex flex-col w-[82vw] max-w-[320px] sm:w-auto sm:max-w-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.10)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2), 0 6px 20px rgba(0,0,0,0.18)',
                }}
              >
                {/* Quote mark */}
                <svg width="24" height="18" viewBox="0 0 24 18" fill="none" className="mb-5 shrink-0" aria-hidden="true">
                  <path
                    d="M0 18V10.5C0 4.7 3.8 1.2 11.3 0l1 2C8.2 3 6.3 5 6 8h4.5V18H0zm13.5 0V10.5C13.5 4.7 17.3 1.2 24.8 0l1 2c-4.1 1-6 3-6.3 6H24V18H13.5z"
                    fill="rgba(191,219,254,0.35)"
                  />
                </svg>

                <p
                  className="text-base"
                  style={{ lineHeight: 1.6, color: '#CBD5E1', flexGrow: 1, marginBottom: '24px' }}
                >
                  &ldquo;{q.text}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
                    style={{ width: '38px', height: '38px', background: q.color, fontSize: '14px' }}
                    aria-label={q.name}
                  >
                    {q.initial}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 650, color: '#F1F5F9' }}>{q.name}</p>
                    <p style={{ fontSize: '12px', color: '#64748B' }}>{q.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.p
          className="text-center mt-8 text-[12px]"
          style={{ color: '#334155' }}
          initial={reduced !== false ? {} : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          Representative testimonials. Individual results vary.
        </motion.p>
      </div>
    </section>
  )
}
