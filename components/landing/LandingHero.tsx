'use client'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { motion, useReducedMotion } from 'motion/react'
import HeroSearch from './HeroSearch'
import { SummaryMockScreen, ValuationMockScreen } from './ProductScreenshots'

export default function LandingHero() {
  const reducedMotion = useReducedMotion()

  return (
    <section
      className="relative overflow-x-hidden"
      style={{
        paddingTop: 'max(76px, 10vh)',
        paddingBottom: 'clamp(64px, 9vh, 96px)',
        background: '#050D1F',
      }}
    >
      {/* Subtle dot grid — dark adaptation + scroll-driven parallax */}
      <div
        className="hero-dot-grid absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />

      {/* DCF scenario fan — abstract projection tree at low opacity */}
      <svg
        className="absolute pointer-events-none"
        style={{
          right: 0,
          top: 0,
          width: '62%',
          height: '100%',
          opacity: 0.10,
          zIndex: 1,
        }}
        viewBox="0 0 700 500"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Bull scenario — curves upward */}
        <path
          d="M 60,250 C 220,248 380,110 640,72"
          stroke="#2563EB" strokeWidth="1" fill="none"
        />
        {/* Base scenario — straight across */}
        <path
          d="M 60,250 L 640,250"
          stroke="#2563EB" strokeWidth="1.25" fill="none"
        />
        {/* Bear scenario — curves downward */}
        <path
          d="M 60,250 C 220,252 380,390 640,428"
          stroke="#2563EB" strokeWidth="1" fill="none"
        />

        {/* Root node */}
        <circle cx="60"  cy="250" r="4"   fill="#2563EB" />

        {/* Year 1 measurement nodes */}
        <circle cx="190" cy="234" r="2.5" fill="#2563EB" />
        <circle cx="190" cy="250" r="2.5" fill="#2563EB" />
        <circle cx="190" cy="266" r="2.5" fill="#2563EB" />

        {/* Year 2 vertical tick */}
        <line x1="320" y1="162" x2="320" y2="338" stroke="#2563EB" strokeWidth="0.6" strokeDasharray="3 6" />
        <circle cx="320" cy="175" r="2.5" fill="#2563EB" />
        <circle cx="320" cy="250" r="2.5" fill="#2563EB" />
        <circle cx="320" cy="325" r="2.5" fill="#2563EB" />

        {/* Year 4 vertical tick */}
        <line x1="510" y1="110" x2="510" y2="390" stroke="#2563EB" strokeWidth="0.6" strokeDasharray="3 6" />
        <circle cx="510" cy="123" r="2.5" fill="#2563EB" />
        <circle cx="510" cy="250" r="2.5" fill="#2563EB" />
        <circle cx="510" cy="377" r="2.5" fill="#2563EB" />

        {/* Terminal value bracket */}
        <line x1="640" y1="72"  x2="640" y2="428" stroke="#2563EB" strokeWidth="0.8" />
        <line x1="630" y1="72"  x2="650" y2="72"  stroke="#2563EB" strokeWidth="0.8" />
        <line x1="630" y1="250" x2="650" y2="250" stroke="#2563EB" strokeWidth="0.8" />
        <line x1="630" y1="428" x2="650" y2="428" stroke="#2563EB" strokeWidth="0.8" />
        <circle cx="640" cy="72"  r="3.5" fill="#2563EB" />
        <circle cx="640" cy="250" r="4"   fill="#2563EB" />
        <circle cx="640" cy="428" r="3.5" fill="#2563EB" />

        {/* Horizontal dotted "fair value" range lines extending from terminal */}
        <line x1="644" y1="72"  x2="690" y2="72"  stroke="#2563EB" strokeWidth="0.6" strokeDasharray="3 4" />
        <line x1="644" y1="250" x2="690" y2="250" stroke="#2563EB" strokeWidth="0.6" strokeDasharray="3 4" />
        <line x1="644" y1="428" x2="690" y2="428" stroke="#2563EB" strokeWidth="0.6" strokeDasharray="3 4" />
      </svg>

      {/* Breathing Blueprint Blue aurora — animates behind screenshots */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          right: '-5%',
          top: '5%',
          width: '58%',
          height: '88%',
          background: 'radial-gradient(ellipse at 50% 40%, rgba(37,99,235,0.22) 0%, transparent 65%)',
          filter: 'blur(52px)',
        }}
        animate={
          reducedMotion
            ? {}
            : {
                x: [0, 32, -22, 0],
                y: [0, -22, 16, 0],
                opacity: [0.85, 1, 0.9, 0.85],
              }
        }
        transition={
          reducedMotion
            ? {}
            : {
                duration: 9,
                repeat: Infinity,
                ease: 'easeInOut',
                repeatType: 'mirror',
              }
        }
        aria-hidden="true"
      />

      {/* Secondary ambient cyan glow — left side depth */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '-12%',
          top: '25%',
          width: '45%',
          height: '55%',
          background:
            'radial-gradient(ellipse at 40% 50%, rgba(6,182,212,0.07) 0%, transparent 70%)',
          filter: 'blur(64px)',
        }}
        aria-hidden="true"
      />

      {/* Hero-specific styles */}
      <style>{`
        .hero-outline-cta {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.15);
          color: #CBD5E1;
        }
        .hero-outline-cta:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.28);
          color: #F1F5F9;
        }
      `}</style>

      <div
        className="relative mx-auto px-4 sm:px-6"
        style={{ maxWidth: '1280px' }}
      >
        <div
          className="grid items-center grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]"
          style={{ gap: '40px' }}
        >
          {/* ── Left: Copy ── */}
          <div className="min-w-0 text-center lg:text-left">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6"
              style={{
                background: 'rgba(37,99,235,0.15)',
                border: '1px solid rgba(37,99,235,0.38)',
              }}
            >
              <Shield size={12} className="text-blue-400" />
              <span
                className="text-[12px] font-bold text-blue-300"
                style={{ letterSpacing: '0.02em' }}
              >
                Built for self-directed investors
              </span>
            </motion.div>

            {/* Headline — blueprint-to-sky gradient */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="text-[36px] sm:text-[52px] lg:text-[clamp(44px,5.5vw,68px)]"
              style={{
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                marginBottom: '20px',
                background: 'linear-gradient(135deg, #F8FAFC 0%, #BFDBFE 55%, #93C5FD 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textWrap: 'balance',
              } as React.CSSProperties}
            >
              Invest with a process,
              <br />not a story.
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.16 }}
              className="text-base sm:text-lg mx-auto lg:mx-0"
              style={{
                fontWeight: 400,
                lineHeight: 1.55,
                color: '#94A3B8',
                marginBottom: '32px',
                maxWidth: '540px',
                textWrap: 'pretty',
              } as React.CSSProperties}
            >
              intrinsico shows you what today&apos;s stock price already assumes
              about growth, margins, and execution — so you can decide with
              confidence, not hope.
            </motion.p>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.24 }}
              className="mb-8"
            >
              <HeroSearch dark />
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.32 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
            >
              {/* Primary CTA — Blueprint Blue with breathing glow */}
              <div className="relative w-full sm:w-auto">
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  animate={
                    reducedMotion
                      ? {}
                      : {
                          boxShadow: [
                            '0 0 16px rgba(37,99,235,0.32)',
                            '0 0 36px rgba(37,99,235,0.56)',
                            '0 0 16px rgba(37,99,235,0.32)',
                          ],
                        }
                  }
                  transition={
                    reducedMotion
                      ? {}
                      : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
                  }
                />
                <button
                  onClick={() => signIn('google')}
                  className="relative w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-5 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                  style={{
                    background: '#2563EB',
                    boxShadow: '0 8px 24px rgba(37,99,235,0.30)',
                    fontWeight: 650,
                    minHeight: '44px',
                  }}
                >
                  Start free trial
                </button>
              </div>

              {/* Secondary CTA — dark glass */}
              <Link
                href="/stock/NVDA"
                className="hero-outline-cta w-full sm:w-auto inline-flex items-center justify-center rounded-xl border px-5 py-3 text-[15px] font-semibold transition-all active:scale-95"
                style={{
                  fontWeight: 650,
                  minHeight: '44px',
                }}
              >
                Explore sample valuation
              </Link>
            </motion.div>
          </div>

          {/* ── Right: Screenshots (desktop only) ── */}
          <div
            className="relative hidden lg:block min-w-0"
            style={{ minHeight: '480px' }}
          >
            {/* Main screenshot — spring physics entrance */}
            <motion.div
              initial={{ opacity: 0, x: 44, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 55,
                damping: 22,
                delay: 0.18,
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: '6%',
                zIndex: 2,
              }}
            >
              <SummaryMockScreen />
            </motion.div>

            {/* Secondary screenshot — heavier spring, lower stiffness */}
            <motion.div
              initial={{ opacity: 0, x: 44, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 42,
                damping: 20,
                delay: 0.36,
              }}
              style={{
                position: 'absolute',
                bottom: '-40px',
                right: 0,
                left: '12%',
                zIndex: 3,
              }}
            >
              <ValuationMockScreen />
            </motion.div>

            {/* Invisible spacer to set container height */}
            <div style={{ height: '600px' }} />
          </div>
        </div>
      </div>
    </section>
  )
}
