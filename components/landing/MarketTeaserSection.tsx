'use client'
import { motion, useReducedMotion } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1] as const

const TEASER_ROWS = [
  { label: 'Implied 5Y Revenue CAGR', val: '12.1%',    type: 'hero',   i: 0 },
  { label: '3Y Historical CAGR',      val: '6.7%',     type: 'normal', i: 1 },
  { label: 'Analyst Estimate (5Y)',   val: '9.3%',     type: 'normal', i: 2 },
  { label: 'Market Interpretation',   val: 'Moderate', type: 'badge',  i: 3 },
] as const

function CAGRBar({ reduced }: { reduced: boolean | null }) {
  const position = 47
  const zones = [
    { label: 'Conservative', sub: '<8%',    width: 28 },
    { label: 'Moderate',     sub: '8–15%',  width: 26 },
    { label: 'Aggressive',   sub: '15–25%', width: 26 },
    { label: 'Very Agr.',    sub: '>25%',   width: 20 },
  ]
  const zoneColors  = ['#E8F7EF', '#EEF4DD', '#FFF4DA', '#FCEAEA']
  const zoneBorders = ['#A7D7C0', '#BFD2A1', '#F3D391', '#F0B8B8']

  return (
    <div className="mt-5">
      <div className="relative flex rounded-full overflow-hidden h-2 mb-3" style={{ gap: 2 }}>
        {zones.map((z, i) => (
          <div
            key={z.label}
            className="h-full relative"
            style={{ width: `${z.width}%`, background: zoneColors[i], border: `1px solid ${zoneBorders[i]}` }}
          />
        ))}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 z-10"
          style={{ left: `${position}%` }}
          initial={reduced ? {} : { scale: 0, opacity: 0 }}
          whileInView={reduced ? {} : { scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: 0.5, duration: 0.4, type: 'spring', stiffness: 280, damping: 18 }}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#5F790B] shadow-sm -translate-x-1/2" />
        </motion.div>
      </div>
      <div className="flex text-[10px] text-[#6B6B6B]">
        {zones.map((z, i) => (
          <div key={z.label} className="flex flex-col items-center leading-tight" style={{ width: `${z.width}%` }}>
            <span className={i === 1 ? 'font-semibold text-[#5F790B]' : ''}>{z.label}</span>
            <span>{z.sub}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MarketTeaserSection() {
  const reduced = useReducedMotion()

  return (
    <section className="overflow-x-hidden" style={{ background: '#F5F5F5', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-12 sm:py-16">
        <motion.div
          className="rounded-[20px] border border-[#E5E5E5] bg-white overflow-hidden"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          initial={reduced ? {} : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-[#F5F5F5]">
            <motion.div
              className="w-10 h-10 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0 mt-0.5"
              whileInView={reduced ? {} : { scale: [0.8, 1.12, 1] }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
            >
              <svg className="w-[18px] h-[18px] text-[#5F790B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </motion.div>
            <div>
              <h2 className="text-[17px] font-bold text-[#111111] leading-tight">What the market is pricing in</h2>
              <p className="text-[13px] text-[#6B6B6B] mt-1 leading-relaxed">
                See the growth and profitability the market expects over the coming years.
              </p>
            </div>
          </div>

          {/* Body: two-column on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#F5F5F5]">

            {/* Left: data rows */}
            <div className="px-6 py-5">
              <p className="text-[11px] font-bold text-[#6B6B6B] mb-4 tracking-[0.05em] uppercase">Example: Apple Inc. (AAPL)</p>
              <div className="space-y-0">
                {TEASER_ROWS.map(({ label, val, type, i }) => (
                  <motion.div
                    key={label}
                    className="flex items-center justify-between py-3 border-b border-[#F5F5F5] last:border-0"
                    initial={reduced ? {} : { opacity: 0, x: -14 }}
                    whileInView={reduced ? {} : { opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
                  >
                    <span className={`text-[13px] leading-snug ${type === 'hero' ? 'font-semibold text-[#111111]' : 'text-[#6B6B6B]'}`}>
                      {label}
                    </span>
                    {type === 'badge' ? (
                      <motion.span
                        className="text-[11px] font-semibold bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391] rounded-full px-2.5 py-0.5 shrink-0"
                        initial={reduced ? {} : { opacity: 0, scale: 0.85 }}
                        whileInView={reduced ? {} : { opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.32, duration: 0.35, ease: EASE }}
                      >
                        {val}
                      </motion.span>
                    ) : type === 'hero' ? (
                      <span className="text-[18px] font-bold tabular-nums text-[#5F790B] shrink-0">{val}</span>
                    ) : (
                      <span className="text-[13px] font-semibold tabular-nums text-[#111111] shrink-0">{val}</span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: spectrum + summary */}
            <div className="px-6 py-5">
              <p className="text-[11px] font-bold text-[#6B6B6B] mb-4 tracking-[0.05em] uppercase">Growth spectrum</p>
              <div className="flex items-baseline gap-2 mb-1">
                <motion.span
                  className="text-[40px] font-bold tabular-nums text-[#111111] leading-none"
                  initial={reduced ? {} : { opacity: 0, y: 8 }}
                  whileInView={reduced ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
                >
                  12.1%
                </motion.span>
                <span className="text-[13px] text-[#6B6B6B]">implied annually</span>
              </div>
              <p className="text-[12px] text-[#6B6B6B] mb-1">vs. 6.7% historical track record</p>
              <CAGRBar reduced={reduced} />
              <motion.p
                className="mt-4 text-[12px] text-[#6B6B6B] leading-relaxed"
                initial={reduced ? {} : { opacity: 0 }}
                whileInView={reduced ? {} : { opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                At today&apos;s price, the market implies 12.1% annual revenue growth over the next 5 years — above Apple&apos;s recent track record of 6.7%.
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
