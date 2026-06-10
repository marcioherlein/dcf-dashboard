'use client'
import { signIn, useSession } from 'next-auth/react'
import { motion, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ProductAnimation from './ProductAnimation'

const EASE = [0.16, 1, 0.3, 1] as const

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
        paddingTop: 'max(96px, calc(80px + 2vh))',
        paddingBottom: 'clamp(52px, 6vh, 80px)',
      }}
    >
      {/* Photo background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/hero-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          zIndex: 0,
        }}
      />

      {/* Dark overlay + subtle blur scrim so text stays readable */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.45) 100%)',
          backdropFilter: 'blur(1px)',
          WebkitBackdropFilter: 'blur(1px)',
          zIndex: 1,
        }}
      />

      <div className="relative mx-auto px-4 sm:px-6" style={{ maxWidth: '1200px', zIndex: 2 }}>
        <div className="grid items-start grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Left: Copy ── */}
          <div className="text-left">

            {/* iOS-glass copy block */}
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(18px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
                border: '1px solid rgba(255,255,255,0.10)',
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
                style={{ maxWidth: '440px', color: 'rgba(255,255,255,0.62)' }}
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
