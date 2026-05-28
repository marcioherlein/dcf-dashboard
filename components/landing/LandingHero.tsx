'use client'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { signIn } from 'next-auth/react'
import HeroSearch from './HeroSearch'
import { SummaryMockScreen, ValuationMockScreen } from './ProductScreenshots'

export default function LandingHero() {
  return (
    <section
      className="relative overflow-x-hidden"
      style={{
        paddingTop: 'clamp(48px, 8vh, 96px)',
        paddingBottom: 'clamp(32px, 6vh, 64px)',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
      }}
    >
      {/* Dotted grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.45,
        }}
        aria-hidden="true"
      />

      {/* Radial blue glow behind screenshots */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: '-5%',
          top: '10%',
          width: '55%',
          height: '80%',
          background: 'radial-gradient(ellipse at 60% 30%, rgba(37,99,235,0.10) 0%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      <div
        className="relative mx-auto px-4 sm:px-6"
        style={{ maxWidth: '1280px' }}
      >
        <div
          className="grid items-center grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]"
          style={{ gap: '40px' }}
        >
          {/* ── Left: Copy ── */}
          <div className="min-w-0">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6"
              style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
              }}>
              <Shield size={12} className="text-blue-600" />
              <span className="text-[12px] font-bold text-[#1D4ED8]" style={{ letterSpacing: '0.02em' }}>
                Built for self-directed investors
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-[38px] sm:text-[52px] lg:text-[clamp(44px,5.5vw,68px)]"
              style={{
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                color: '#071633',
                marginBottom: '20px',
              }}
            >
              Invest with a process,
              <br />not a story.
            </h1>

            {/* Subheadline */}
            <p
              className="text-base sm:text-lg"
              style={{
                fontWeight: 400,
                lineHeight: 1.55,
                color: '#475569',
                marginBottom: '32px',
                maxWidth: '580px',
              }}
            >
              intrinsico shows you what today&apos;s stock price already assumes
              about growth, margins, and execution — so you can decide with
              confidence, not hope.
            </p>

            {/* Search */}
            <div className="mb-8">
              <HeroSearch />
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => signIn('google')}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                style={{
                  background: '#2563EB',
                  boxShadow: '0 8px 20px rgba(37,99,235,0.22)',
                  fontWeight: 650,
                  minHeight: '44px',
                }}
              >
                Start free trial
              </button>
              <Link
                href="/stock/NVDA"
                className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-[15px] font-semibold text-[#1D4ED8] transition-all hover:bg-[#EFF6FF] hover:border-[#93C5FD] active:scale-95"
                style={{
                  background: 'white',
                  borderColor: '#BFDBFE',
                  fontWeight: 650,
                  minHeight: '44px',
                }}
              >
                Explore sample valuation
              </Link>
            </div>
          </div>

          {/* ── Right: Screenshots ── */}
          <div
            className="relative hidden lg:block min-w-0"
            style={{ minHeight: '480px' }}
          >
            {/* Main screenshot */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: '6%',
                zIndex: 2,
              }}
            >
              <SummaryMockScreen />
            </div>

            {/* Secondary screenshot — offset below and right */}
            <div
              style={{
                position: 'absolute',
                bottom: '-40px',
                right: 0,
                left: '12%',
                zIndex: 3,
              }}
            >
              <ValuationMockScreen />
            </div>

            {/* Invisible spacer to set container height */}
            <div style={{ height: '600px' }} />
          </div>
        </div>

        {/* Mobile screenshot (stacked below copy) */}
        <div className="mt-8 lg:hidden">
          <SummaryMockScreen />
        </div>
      </div>
    </section>
  )
}
