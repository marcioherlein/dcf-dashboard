'use client'
import { signIn, useSession } from 'next-auth/react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ProductAnimation from './ProductAnimation'
import AnimatedCounter from './AnimatedCounter'

const EASE = [0.16, 1, 0.3, 1] as const

// Glassmorphism stat shown in the hero — counts up on load
const HERO_STATS = [
  { value: 85.1, prefix: '+', suffix: '%', decimals: 1, label: 'avg implied return on undervalued picks' },
  { value: 5, prefix: '', suffix: ' models', decimals: 0, label: 'blended valuation methods' },
  { value: 10, prefix: '', suffix: '/mo free', decimals: 0, label: 'analyses, no credit card' },
]

// ── Main component ───────────────────────────────────────────────────────────
export default function LandingHero() {
  const { data: session } = useSession()
  const reduced = useReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [cardInView, setCardInView] = useState(false)

  // Parallax: product card drifts up slightly as user scrolls past hero
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const cardY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -40])
  const cardOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.6])

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
      ref={sectionRef}
      className="overflow-x-hidden relative"
      style={{
        paddingTop: 'max(96px, calc(80px + 2vh))',
        paddingBottom: 'clamp(72px, 8vh, 100px)',
      }}
    >
      {/* Greyscale gradient background — top-left dark, bottom-right lighter */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(160deg, #1e293b 0%, #334155 50%, #475569 100%)',
          zIndex: 0,
        }}
      />

      {/* Subtle light accent in top-right to separate product card visually */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse at 70% 0%, rgba(148,163,184,0.10) 0%, transparent 55%)',
          zIndex: 1,
        }}
      />

      {/* Olive ambient glow behind product card */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse 40% 40% at 78% 55%, rgba(95,121,11,0.09) 0%, transparent 65%)',
          zIndex: 1,
        }}
      />

      {/* Bottom fade — bridges hero into white HowItWorks section */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '80px',
          background: 'linear-gradient(to bottom, transparent, #ffffff)',
          zIndex: 3,
        }}
      />

      <div className="relative mx-auto px-4 sm:px-6" style={{ maxWidth: '1200px', zIndex: 2 }}>
        <div className="grid items-start grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Left: Copy ── */}
          <div className="text-left">

            {/* iOS-glass copy block */}
            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(20px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '20px',
                padding: 'clamp(20px, 3vw, 32px)',
                marginBottom: '20px',
              }}
            >
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
                      color: plain ? 'rgba(255,255,255,0.92)' : '#7C9A19',
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
                className="text-[14px] sm:text-[16px] leading-relaxed"
                style={{ maxWidth: '440px', color: 'rgba(255,255,255,0.82)' }}
              >
                Instantly see if a stock is undervalued or overpriced. Analyze any ticker in seconds — no spreadsheets required.
              </motion.p>
            </div>

            {/* CTAs */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.42 }}
              className="flex flex-col sm:flex-row gap-3 mb-5"
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

            {/* Glassmorphism stat pills with counting numbers */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.52 }}
              className="flex flex-wrap gap-2 mb-5"
            >
              {HERO_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(12px) saturate(1.4)',
                    WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
                    border: '1px solid rgba(255,255,255,0.13)',
                  }}
                >
                  <AnimatedCounter
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                    className="text-[14px] font-[800] tabular-nums"
                    style={{ color: '#7C9A19' }}
                  />
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.52)' }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={reduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.64 }}
              className="flex items-center gap-3"
            >
              <div className="flex -space-x-2">
                {[
                  { initials: 'MH', bg: '#3b4a6b' },
                  { initials: 'AK', bg: '#4a5568' },
                  { initials: 'SR', bg: '#2d3748' },
                ].map(({ initials, bg }) => (
                  <div key={initials} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white" style={{ background: bg }}>
                    {initials}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className="w-3.5 h-3.5" fill="#5F790B" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <span className="text-[12px] text-[rgba(255,255,255,0.72)]">Trusted by investors who do their own research</span>
              </div>
            </motion.div>
          </div>

          {/* ── Right: Product card with parallax ── */}
          <motion.div
            ref={cardRef}
            style={{ y: cardY, opacity: cardOpacity }}
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
