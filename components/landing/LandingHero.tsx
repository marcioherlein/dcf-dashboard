'use client'
import { signIn, useSession } from 'next-auth/react'
import { motion, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ProductAnimation from './ProductAnimation'

const EASE = [0.16, 1, 0.3, 1] as const

// ── Animated financial background ────────────────────────────────────────────
function HeroBackground({ reduced }: { reduced: boolean | null }) {
  const animStyle = reduced
    ? {}
    : {
        animation: 'chartDrift 7s ease-in-out infinite alternate',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <style>{`
        @keyframes chartDrift {
          0%   { transform: translateY(0px); }
          100% { transform: translateY(-12px); }
        }
      `}</style>
      <svg width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal grid lines at 20%, 40%, 60%, 80% */}
        <line x1="0" y1="20%" x2="100%" y2="20%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="40%" x2="100%" y2="40%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="60%" x2="100%" y2="60%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="80%" x2="100%" y2="80%" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

        {/* Vertical tick marks every ~10% of width */}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => (
          <line
            key={x}
            x1={`${x}%`} y1="0"
            x2={`${x}%`} y2="100%"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        ))}

        {/* Price lines — wrapped in a group so animation applies to both */}
        <g style={animStyle}>
          {/* Primary olive price line — slow-rising curved path */}
          <path
            d="M -5% 85% C 15% 78%, 30% 65%, 50% 52% C 65% 42%, 78% 32%, 105% 18%"
            stroke="rgba(95,121,11,0.22)"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Secondary white price line */}
          <path
            d="M -5% 92% C 10% 85%, 28% 76%, 48% 68% C 62% 62%, 80% 55%, 105% 44%"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
            fill="none"
          />
        </g>
      </svg>
    </div>
  )
}

// ── Market pricing teaser ────────────────────────────────────────────────────
// Now lives in MarketTeaserSection.tsx (extracted from hero for clean narrative boundary)

// ── Main component ───────────────────────────────────────────────────────────
export default function LandingHero() {
  const { data: session } = useSession()
  const reduced = useReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardInView, setCardInView] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setCardInView(true); obs.disconnect() }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      className="overflow-x-hidden relative"
      style={{
        paddingTop: 'max(72px, calc(60px + 2vh))',
        paddingBottom: 'clamp(52px, 6vh, 80px)',
        background: '#000000',
      }}
    >
      {/* Animated financial chart background */}
      <HeroBackground reduced={reduced} />

      {/* Subtle radial olive aurora — behind content */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 55% at 70% 45%, rgba(95,121,11,0.12) 0%, transparent 65%)',
          zIndex: 0,
        }}
      />

      <div className="relative mx-auto px-4 sm:px-6" style={{ maxWidth: '1200px', zIndex: 1 }}>
        <div className="grid items-start grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Left: Copy ── */}
          <div className="text-left">

            {/* Badge */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-5"
              style={{
                background: 'rgba(95,121,11,0.15)',
                border: '1px solid rgba(95,121,11,0.35)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#5F790B]" />
              <span className="text-[12px] font-semibold text-[#7C9A19]">
                DCF-grade analysis tools for individual investors
              </span>
            </motion.div>

            {/* Headline — line-by-line stagger */}
            <div className="mb-3 sm:mb-4" style={{ lineHeight: 1.05, letterSpacing: '-0.035em' }}>
              {[
                { text: 'Invest with', delay: 0.06, plain: true },
                { text: 'a process,', delay: 0.14, plain: true },
                { text: 'not a story.', delay: 0.22, plain: false },
              ].map(({ text, delay, plain }) => (
                <motion.div
                  key={text}
                  initial={reduced ? {} : { opacity: 0, y: 20, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.6, ease: EASE, delay }}
                  className="font-bold block"
                  style={{
                    fontSize: 'clamp(32px, 9.5vw, 60px)',
                    color: plain ? '#FFFFFF' : '#7C9A19',
                    textWrap: 'balance',
                  }}
                >
                  {text}
                </motion.div>
              ))}
            </div>

            {/* Sub-copy */}
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.32 }}
              className="text-[14px] sm:text-[16px] leading-relaxed mb-6"
              style={{ maxWidth: '440px', color: 'rgba(255,255,255,0.72)' }}
            >
              Instantly see if a stock is undervalued or overpriced. Analyze any ticker in seconds — no spreadsheets required.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.42 }}
              className="flex flex-col sm:flex-row gap-3 mb-6"
            >
              {session ? (
                <Link
                  href="/analyze"
                  className="inline-flex items-center justify-center rounded-md px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                  style={{ background: '#5F790B', boxShadow: '0 4px 16px rgba(95,121,11,0.28)', minHeight: '52px' }}
                >
                  Analyze for free
                </Link>
              ) : (
                <motion.button
                  onClick={() => signIn('google')}
                  className="inline-flex items-center justify-center rounded-md px-6 py-3.5 text-[15px] font-semibold text-white transition-all active:scale-95"
                  style={{ background: '#5F790B', minHeight: '52px' }}
                  whileHover={reduced ? {} : { y: -2, boxShadow: '0 8px 24px rgba(95,121,11,0.38)' }}
                  transition={{ duration: 0.2 }}
                  initial={{ boxShadow: '0 4px 16px rgba(95,121,11,0.28)' }}
                >
                  Analyze for free
                </motion.button>
              )}
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.28)] transition-colors"
                style={{ minHeight: '52px' }}
              >
                <Play size={13} className="text-[#7C9A19]" fill="#7C9A19" />
                See how it works
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={reduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.56 }}
              className="flex items-center gap-3"
            >
              <div className="flex -space-x-2">
                {['#C8C8C8', '#C4C4C4', '#9B9B9B'].map((bg, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center" style={{ background: bg }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/></svg>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className="w-3.5 h-3.5" fill="#5F790B" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <span className="text-[12px] text-[rgba(255,255,255,0.55)]">Trusted by investors who do their own research</span>
              </div>
            </motion.div>
          </div>

          {/* ── Right: Product card ── */}
          <motion.div
            ref={cardRef}
            initial={reduced ? {} : { opacity: 0, x: 28, y: 6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 55, damping: 20, delay: 0.2 }}
            className="w-full max-w-[360px] sm:max-w-[420px] mx-auto lg:mx-0 lg:max-w-[500px] lg:ml-auto"
          >
            <ProductAnimation inView={cardInView} reduced={reduced} />
          </motion.div>

        </div>
      </div>

      {/* Reduced motion override */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
    </section>
  )
}
