'use client'
import { motion, useReducedMotion } from 'motion/react'
import { useState, useEffect } from 'react'

const EASE_OUT = [0.16, 1, 0.3, 1] as const

const CARDS = [
  {
    ticker: 'AAPL',
    company: 'Apple Inc.',
    upside: '+31%',
    verdict: 'Undervalued',
    fairValue: '$247',
    impliedCAGR: '7.7%',
    cagrLabel: 'implied 5Y CAGR',
    bg: 'linear-gradient(135deg, #1e3a1e 0%, #2d5a2d 100%)',
    rotate: -9,
    xOffset: -12,
    yOffset: -8,
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft Corp.',
    upside: '+14%',
    verdict: 'Attractive',
    fairValue: '$472',
    impliedCAGR: '12.3%',
    cagrLabel: 'implied 5Y CAGR',
    bg: 'linear-gradient(135deg, #0f1e3a 0%, #1a3158 100%)',
    rotate: -3,
    xOffset: -4,
    yOffset: 0,
  },
  {
    ticker: 'NVDA',
    company: 'NVIDIA Corp.',
    upside: '-9%',
    verdict: 'Overpriced',
    fairValue: '$187',
    impliedCAGR: '45.4%',
    cagrLabel: 'implied 5Y CAGR',
    bg: 'linear-gradient(135deg, #3a0f0f 0%, #5c1919 100%)',
    rotate: 4,
    xOffset: 4,
    yOffset: 6,
  },
  {
    ticker: 'WMT',
    company: 'Walmart Inc.',
    upside: '+22%',
    verdict: 'Undervalued',
    fairValue: '$115',
    impliedCAGR: '5.1%',
    cagrLabel: 'implied 5Y CAGR',
    bg: 'linear-gradient(135deg, #0a2929 0%, #134040 100%)',
    rotate: 10,
    xOffset: 12,
    yOffset: 12,
  },
]

// Which card sits on top (active). Others fan behind it.
function getFanConfig(activeIdx: number, cardIdx: number, totalCards: number) {
  const offset = cardIdx - activeIdx
  const wrapped = ((offset % totalCards) + totalCards) % totalCards
  // 0 = active (top), 1 = one behind, 2 = two behind, 3 = furthest back
  return {
    zIndex: totalCards - wrapped,
    behind: wrapped, // 0 = active
  }
}

export default function FannedVerdictCards() {
  const reduced = useReducedMotion()
  const [activeIdx, setActiveIdx] = useState(0)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Auto-cycle every 2.8 s
  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => {
      setActiveIdx(i => (i + 1) % CARDS.length)
    }, 2800)
    return () => clearInterval(id)
  }, [reduced])

  return (
    <section
      className="overflow-hidden relative"
      style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
        paddingTop: 'clamp(72px, 10vw, 120px)',
        paddingBottom: 'clamp(72px, 10vw, 120px)',
      }}
    >
      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse 60% 50% at 72% 50%, rgba(95,121,11,0.10) 0%, transparent 70%)',
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
              Every card shows what the market is pricing in — the implied growth rate baked into today&apos;s price — so you can judge whether it&apos;s realistic.
            </motion.p>

            {/* Stat pills */}
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

          {/* Right — fanned card stack */}
          <div className="flex flex-col items-center justify-center gap-6">
            <motion.div
              initial={reduced ? {} : { opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
            >
              {/* Card stack */}
              <div
                className="relative cursor-pointer"
                style={{ width: '280px', height: '200px' }}
                onClick={() => setActiveIdx(i => (i + 1) % CARDS.length)}
                role="region"
                aria-label="Verdict card examples — click to cycle"
              >
                {CARDS.map((card, idx) => {
                  const { zIndex, behind } = getFanConfig(activeIdx, idx, CARDS.length)
                  const isActive = behind === 0
                  const isHovered = hoveredIdx === idx

                  // Fan positions: active = center, others spread behind
                  const fanRotate = isActive ? 0 : behind === 1 ? -6 : behind === 2 ? -13 : -19
                  const fanX = isActive ? 0 : behind === 1 ? -14 : behind === 2 ? -26 : -36
                  const fanY = isActive ? 0 : behind === 1 ? 10 : behind === 2 ? 18 : 24
                  const fanScale = isActive ? 1 : behind === 1 ? 0.95 : behind === 2 ? 0.90 : 0.85
                  const fanOpacity = isActive ? 1 : behind === 1 ? 0.85 : behind === 2 ? 0.65 : 0.45

                  return (
                    <motion.div
                      key={card.ticker}
                      animate={reduced ? {} : {
                        rotate: fanRotate,
                        x: fanX,
                        y: fanY,
                        scale: isHovered && !isActive ? fanScale * 1.03 : fanScale,
                        opacity: fanOpacity,
                      }}
                      transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                      onClick={e => { e.stopPropagation(); setActiveIdx(idx) }}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="absolute rounded-2xl px-5 py-4 select-none"
                      style={{
                        width: '280px',
                        background: card.bg,
                        boxShadow: isActive
                          ? '0 24px 56px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)'
                          : '0 12px 32px rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        zIndex,
                        top: 0,
                        left: 0,
                        transformOrigin: 'bottom center',
                        cursor: isActive ? 'default' : 'pointer',
                      }}
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[11px] font-[800] tracking-[0.08em] px-2.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)' }}
                          >
                            {card.ticker}
                          </span>
                          <span className="text-[11px] text-[rgba(255,255,255,0.45)] truncate" style={{ maxWidth: 100 }}>
                            {card.company}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-[700] px-2.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: card.verdict === 'Overpriced'
                              ? 'rgba(220,38,38,0.22)' : 'rgba(95,121,11,0.28)',
                            color: card.verdict === 'Overpriced' ? '#fca5a5' : '#a3e635',
                            border: `1px solid ${card.verdict === 'Overpriced' ? 'rgba(220,38,38,0.30)' : 'rgba(95,121,11,0.40)'}`,
                          }}
                        >
                          {card.verdict}
                        </span>
                      </div>

                      {/* Upside number */}
                      <p
                        className="font-[900] leading-none tabular-nums mb-1"
                        style={{
                          fontSize: '42px',
                          color: card.upside.startsWith('-') ? '#fca5a5' : '#a3e635',
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {card.upside}
                      </p>
                      <p className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Fair value {card.fairValue} · vs current price
                      </p>

                      {/* Implied CAGR row */}
                      <div
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {card.cagrLabel}
                        </span>
                        <span className="text-[13px] font-[800] tabular-nums" style={{ color: 'rgba(255,255,255,0.90)' }}>
                          {card.impliedCAGR}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Indicator dots */}
              <div className="flex items-center justify-center gap-2 mt-6">
                {CARDS.map((card, idx) => (
                  <button
                    key={card.ticker}
                    onClick={() => setActiveIdx(idx)}
                    aria-label={`Show ${card.ticker} card`}
                    className="transition-all"
                    style={{
                      width: activeIdx === idx ? '20px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: activeIdx === idx ? '#7C9A19' : 'rgba(255,255,255,0.22)',
                    }}
                  />
                ))}
              </div>
              <p className="text-center text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.30)' }}>
                Click a card or dot to explore
              </p>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  )
}
