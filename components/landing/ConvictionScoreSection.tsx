'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, useInView, useReducedMotion, useMotionValue, animate } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1] as const

const DIMENSIONS = [
  { label: 'Valuation Attractiveness', score: 62, color: '#B56A00' },
  { label: 'Business Quality',         score: 89, color: '#11875D' },
  { label: 'Financial Health',         score: 75, color: '#11875D' },
  { label: 'Growth Momentum',          score: 82, color: '#11875D' },
  { label: 'Earnings Integrity',       score: 91, color: '#11875D' },
  { label: 'Analyst Sentiment',        score: 68, color: '#B56A00' },
] as const

const PILLS = [
  'Valuation Attractiveness',
  'Business Quality',
  'Financial Health',
  'Growth Momentum',
  'Earnings Integrity',
  'Analyst Sentiment',
] as const

function AnimatedScore({ inView, reduced }: { inView: boolean; reduced: boolean | null }) {
  const count = useMotionValue(0)
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      if (spanRef.current) spanRef.current.textContent = '78'
      return
    }
    const controls = animate(count, 78, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate(v) {
        if (spanRef.current) spanRef.current.textContent = Math.round(v).toString()
      },
    })
    return () => controls.stop()
  }, [inView, reduced, count])

  return (
    <span
      ref={spanRef}
      className="text-[64px] font-[800] leading-none tabular-nums"
      style={{ color: '#5F790B' }}
    >
      0
    </span>
  )
}

export default function ConvictionScoreSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const inView     = useInView(sectionRef, { once: true, margin: '-80px' })
  const reduced    = useReducedMotion()

  return (
    <section
      ref={sectionRef}
      className="overflow-x-hidden py-16 sm:py-24"
      style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E5E5' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — copy */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <h2
              className="text-[28px] sm:text-[36px] font-bold text-[#111111] leading-tight mb-4"
              style={{ letterSpacing: '-0.025em' }}
            >
              One score that synthesizes everything.
            </h2>

            <p className="text-[17px] text-[#6B6B6B] leading-relaxed mb-4">
              Valuation tells you the price. The Conviction Score tells you whether to trust it.
            </p>

            <p className="text-[15px] text-[#6B6B6B] leading-relaxed mb-8">
              Six independent checks — financial health, earnings quality, analyst sentiment, and more — compressed into a single 0–100 score with a plain-English verdict. No jargon. No black boxes.
            </p>

            {/* Dimension pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              {PILLS.map((pill, i) => (
                <motion.span
                  key={pill}
                  initial={reduced ? {} : { opacity: 0, y: 8 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
                  className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold"
                  style={{
                    background: '#EEF3D8',
                    borderColor: '#C8D98A',
                    color: '#5F790B',
                  }}
                >
                  {pill}
                </motion.span>
              ))}
            </div>

            <Link
              href="/analyze"
              className="text-[14px] font-semibold hover:underline underline-offset-2 transition-colors"
              style={{ color: '#5F790B' }}
            >
              See the Conviction Score on any stock →
            </Link>
          </motion.div>

          {/* Right — example score card */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <div
              className="bg-white rounded-xl shadow-card flex flex-col gap-5 p-6"
              style={{ border: '1px solid #E5E5E5' }}
            >
              {/* Card header */}
              <div>
                <p className="text-[12px] font-[650] text-[#6B6B6B] mb-1">NVDA — Conviction Score</p>

                {/* Score + grade */}
                <div className="flex items-end gap-3">
                  <AnimatedScore inView={inView} reduced={reduced} />
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold mb-2"
                    style={{ background: '#EEF3D8', color: '#5F790B', border: '1px solid #C8D98A' }}
                  >
                    B+
                  </span>
                </div>

                <p className="text-[14px] text-[#6B6B6B] leading-snug mt-1">
                  Quality business with earnings growth, priced for strong expectations.
                </p>
              </div>

              {/* Dimension bars — 2×3 grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {DIMENSIONS.map((dim) => (
                  <div key={dim.label} className="flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] text-[#6B6B6B] leading-none truncate pr-1">{dim.label}</span>
                      <span className="text-[11px] text-[#6B6B6B] tabular-nums shrink-0">{dim.score}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F0F0' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: dim.color }}
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${dim.score}%` } : { width: 0 }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <p className="text-[10px]" style={{ color: '#9B9B9B' }}>
                Example only. Real scores update with live data.
              </p>
            </div>
          </motion.div>

        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-[14.5px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
            style={{ background: '#5F790B', boxShadow: '0 4px 14px rgba(95,121,11,0.28)', minHeight: '48px' }}
          >
            Check any stock&apos;s Conviction Score →
          </Link>
        </div>

      </div>
    </section>
  )
}
