'use client'
import { motion, useReducedMotion } from 'motion/react'

const EASE_OUT = [0.16, 1, 0.3, 1] as const

// Verdict cards modelled after moby.co's stacked rotated performance cards
// Each card represents a real-ish stock verdict with color derived from verdict
const CARDS = [
  {
    ticker: 'AAPL',
    company: 'Apple Inc.',
    upside: '+31%',
    verdict: 'Undervalued',
    fairValue: '$247',
    // Dark olive-green for positive
    bg: 'linear-gradient(135deg, #1e3a1e 0%, #2d5a2d 100%)',
    rotate: -7,
    x: 2,
    y: 0,
    z: 1,
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft',
    upside: '+14%',
    verdict: 'Attractive',
    fairValue: '$472',
    // Deep navy
    bg: 'linear-gradient(135deg, #0f1e3a 0%, #1a3158 100%)',
    rotate: 3,
    x: 5,
    y: 28,
    z: 2,
  },
  {
    ticker: 'NVDA',
    company: 'NVIDIA',
    upside: '-9%',
    verdict: 'Overvalued',
    fairValue: '$187',
    // Dark red
    bg: 'linear-gradient(135deg, #3a0f0f 0%, #5c1919 100%)',
    rotate: -2,
    x: 8,
    y: 54,
    z: 3,
  },
  {
    ticker: 'WMT',
    company: 'Walmart',
    upside: '+22%',
    verdict: 'Undervalued',
    fairValue: '$115',
    // Deep teal
    bg: 'linear-gradient(135deg, #0a2929 0%, #134040 100%)',
    rotate: 8,
    x: 11,
    y: 12,
    z: 4,
  },
]

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
}

const cardVariant = (rotate: number) => ({
  hidden: { opacity: 0, y: 56, rotate: 0, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    rotate,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 150, damping: 22 },
  },
})

export default function FannedVerdictCards() {
  const reduced = useReducedMotion()

  return (
    <section
      className="overflow-hidden relative"
      style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
        paddingTop: 'clamp(72px, 10vw, 120px)',
        paddingBottom: 'clamp(72px, 10vw, 120px)',
      }}
    >
      {/* Subtle radial glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse 60% 50% at 75% 50%, rgba(95,121,11,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto px-4 sm:px-6" style={{ maxWidth: '1200px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — copy */}
          <div>
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="text-[11px] font-[700] uppercase tracking-[0.12em] mb-4"
              style={{ color: '#7C9A19' }}
            >
              Real verdicts. Any stock.
            </motion.p>

            <motion.h2
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.08 }}
              className="font-bold leading-[1.08] tracking-tight mb-6"
              style={{
                fontSize: 'clamp(28px, 5vw, 48px)',
                color: '#f8fafc',
                textWrap: 'balance',
              }}
            >
              Know if a stock is cheap<br />
              <span style={{ color: '#7C9A19' }}>before you invest.</span>
            </motion.h2>

            <motion.p
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.16 }}
              className="text-[16px] leading-relaxed mb-8"
              style={{ color: 'rgba(248,250,252,0.68)', maxWidth: '420px' }}
            >
              Insic computes a fair value for any NYSE or NASDAQ stock in seconds — using DCF models, analyst consensus, and financial health scores.
            </motion.p>

            {/* Stat pills — glassmorphism */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.24 }}
              className="flex flex-wrap gap-3"
            >
              {[
                { label: 'Models blended', value: '5×' },
                { label: 'Data updated', value: 'Daily' },
                { label: 'Always free', value: '10/mo' },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}
                >
                  <span className="font-bold text-white">{value}</span>
                  <span className="ml-1.5 text-[rgba(255,255,255,0.55)]">{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — fanned cards */}
          <div className="flex items-center justify-center">
            <div className="relative" style={{ width: '320px', height: '320px' }}>
              <motion.div
                variants={container}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                className="absolute inset-0"
              >
                {CARDS.map((card) => (
                  <motion.div
                    key={card.ticker}
                    variants={cardVariant(reduced ? 0 : card.rotate)}
                    className="absolute rounded-2xl px-5 py-4 select-none"
                    style={{
                      width: '220px',
                      background: card.bg,
                      boxShadow: '0 20px 48px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      left: `${card.x}%`,
                      top: `${card.y}px`,
                      zIndex: card.z,
                      transformOrigin: 'center bottom',
                    }}
                    whileHover={reduced ? {} : {
                      scale: 1.04,
                      zIndex: 10,
                      boxShadow: '0 28px 64px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.4)',
                      transition: { duration: 0.2 },
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-[11px] font-[800] tracking-[0.08em] px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        {card.ticker}
                      </span>
                      <span
                        className="text-[10px] font-[650] px-2 py-0.5 rounded-full"
                        style={{
                          background: card.verdict === 'Overvalued'
                            ? 'rgba(220,38,38,0.25)' : 'rgba(95,121,11,0.25)',
                          color: card.verdict === 'Overvalued'
                            ? '#fca5a5' : '#a3e635',
                        }}
                      >
                        {card.verdict}
                      </span>
                    </div>
                    <p
                      className="font-[900] leading-none tabular-nums mb-1"
                      style={{
                        fontSize: '36px',
                        color: card.upside.startsWith('-') ? '#fca5a5' : '#a3e635',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {card.upside}
                    </p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Fair value {card.fairValue} · {card.company}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
