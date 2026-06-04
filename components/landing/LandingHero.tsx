'use client'
import { signIn, useSession } from 'next-auth/react'
import { motion, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'
import Link from 'next/link'

const EASE = [0.16, 1, 0.3, 1] as const

// Inline product mockup card — mirrors the design screenshot
function ProductMockCard() {
  return (
    <div
      className="relative w-full rounded-[20px] border border-[#E3E6E0] bg-white overflow-hidden"
      style={{ boxShadow: '0 16px 48px rgba(6,16,31,0.10)' }}
    >
      {/* Stock header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E6E0] bg-[#FBFAF7]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F8F7F2] border border-[#E3E6E0] flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5"><path d="M8 2a6 6 0 100 12A6 6 0 008 2z" fill="#0A1424" opacity=".15"/><circle cx="8" cy="8" r="2.5" fill="#0A1424"/></svg>
          </div>
          <span className="text-[12px] font-bold text-[#0A1424]">AAPL</span>
          <span className="text-[11px] text-[#536174]">Apple Inc.</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-bold tabular-nums text-[#0A1424]">$183.42</span>
          <span className="text-[11px] font-semibold text-[#11875D] tabular-nums">+1.25%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E3E6E0] px-4 gap-4">
        {['Overview', 'Valuation', 'Financials', 'Risks', 'News'].map((t, i) => (
          <span key={t} className={`text-[11px] py-2.5 font-medium border-b-2 -mb-px ${i === 0 ? 'border-[#5F790B] text-[#0A1424]' : 'border-transparent text-[#8A96A8]'}`}>{t}</span>
        ))}
      </div>

      {/* Verdict */}
      <div className="mx-4 mt-3 mb-2 rounded-[12px] border border-[#BFD2A1] bg-[#F6FAEA] px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F790B] mb-1">INSIC VERDICT</p>
        <p className="text-[14px] font-bold text-[#0A1424]">AAPL looks <span className="text-[#5F790B]">Undervalued</span></p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-semibold text-[#11875D] bg-[#E8F7EF] border border-[#A7D7C0] rounded-full px-2 py-0.5">High confidence</span>
          <span className="text-[10px] text-[#536174]">4 of 4 models</span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-0 mx-4 mb-3">
        {[
          { label: 'Fair Value', val: '$226.80', cls: 'text-[#5F790B]' },
          { label: 'Current Price', val: '$183.42', cls: 'text-[#0A1424]' },
          { label: 'Upside', val: '+23.6%', cls: 'text-[#11875D]' },
        ].map(m => (
          <div key={m.label} className="text-center">
            <p className="text-[9px] text-[#8A96A8] mb-0.5">{m.label}</p>
            <p className={`text-[13px] font-bold tabular-nums ${m.cls}`}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Scenario range bar */}
      <div className="mx-4 mb-3">
        <p className="text-[9px] text-[#8A96A8] mb-1.5">Scenario range</p>
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-[#F0B8B8] via-[#E3E6E0] to-[#BFD2A1]">
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#5F790B] shadow-sm" style={{ left: '42%' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[#8A96A8]">$150.10 Bear</span>
          <span className="text-[9px] font-semibold text-[#5F790B]">$226.60 Base</span>
          <span className="text-[9px] text-[#8A96A8]">$305.40 Bull</span>
        </div>
      </div>

      {/* Mini price chart */}
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-3 mb-1.5">
          {[['Price', '#0A1424', '—'], ['Fair Value (Base)', '#5F790B', '—'], ['Analyst Target', '#2563EB', '- -']].map(([l, c, s]) => (
            <span key={l} className="flex items-center gap-1 text-[9px] text-[#536174]">
              <span style={{ display: 'inline-block', width: 12, height: 1.5, background: c, opacity: s === '- -' ? 0.7 : 1 }} />
              {l}
            </span>
          ))}
        </div>
        <svg viewBox="0 0 260 70" className="w-full" style={{ height: 56 }}>
          <path d="M0,55 C20,52 40,48 60,45 C80,42 90,38 110,32 C130,26 150,28 170,24 C190,20 210,16 230,14 C245,12 255,10 260,10" stroke="#0A1424" strokeWidth="1.5" fill="none"/>
          <path d="M0,42 L260,28" stroke="#5F790B" strokeWidth="1.5" fill="none"/>
          <path d="M0,36 L260,36" stroke="#2563EB" strokeWidth="1" fill="none" strokeDasharray="4 3"/>
          <text x="2" y="68" fontSize="7" fill="#8A96A8">Jul</text>
          <text x="65" y="68" fontSize="7" fill="#8A96A8">Oct</text>
          <text x="120" y="68" fontSize="7" fill="#8A96A8">2025</text>
          <text x="175" y="68" fontSize="7" fill="#8A96A8">Apr</text>
          <text x="230" y="68" fontSize="7" fill="#8A96A8">Jul</text>
        </svg>
      </div>

      {/* Market implied CAGR */}
      <div className="mx-4 mb-4 rounded-[10px] border border-[#E3E6E0] bg-[#FBFAF7] px-3 py-2.5">
        <p className="text-[9px] text-[#536174] mb-1">Market-implied 5Y revenue CAGR at today&apos;s price</p>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold tabular-nums text-[#0A1424]">12.1%</span>
          <span className="text-[10px] font-semibold bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391] rounded-full px-2 py-0.5">Moderate</span>
        </div>
        <div className="relative mt-2 h-1 rounded-full bg-[#E3E6E0]">
          <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#5F790B]" style={{ left: '38%' }} />
        </div>
        <div className="flex justify-between mt-1">
          {['Conservative\n<8%', 'Moderate\n8–15%', 'Aggressive\n15–25%', 'Very Aggressive\n>25%'].map(l => (
            <span key={l} className="text-[8px] text-[#8A96A8] text-center leading-tight" style={{ whiteSpace: 'pre-line' }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LandingHero() {
  const { data: session } = useSession()
  const reduced = useReducedMotion()

  return (
    <section
      className="overflow-x-hidden"
      style={{
        paddingTop: 'max(72px, calc(60px + 2vh))',
        paddingBottom: 'clamp(48px, 7vh, 80px)',
        background: '#F8F7F2',
      }}
    >
      <div className="mx-auto px-4 sm:px-6" style={{ maxWidth: '1200px' }}>
        <div className="grid items-center grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Left: Copy ── */}
          <div className="text-left">

            {/* Badge */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-5"
              style={{
                background: 'rgba(95,121,11,0.10)',
                border: '1px solid rgba(95,121,11,0.25)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#5F790B]" />
              <span className="text-[12px] font-semibold text-[#5F790B]" style={{ letterSpacing: '0.01em' }}>
                Institutional-quality valuation tools for individual investors
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={reduced ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.06 }}
              className="text-[40px] sm:text-[52px] lg:text-[clamp(42px,4.5vw,60px)] font-bold text-[#0A1424]"
              style={{ lineHeight: 1.05, letterSpacing: '-0.035em', marginBottom: '16px' }}
            >
              Invest with<br />
              a process,<br />
              <span style={{ color: '#5F790B' }}>not a story.</span>
            </motion.h1>

            {/* Sub-copy */}
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.14 }}
              className="text-[16px] text-[#536174] leading-relaxed mb-8"
              style={{ maxWidth: '440px' }}
            >
              insic helps you value businesses through fair value estimates,
              market-implied expectations, and transparent assumptions — so you
              can understand what has to be true before you invest.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.22 }}
              className="flex flex-col sm:flex-row gap-3 mb-8"
            >
              {session ? (
                <Link
                  href="/analyze"
                  className="inline-flex items-center justify-center rounded-[10px] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                  style={{ background: '#5F790B', boxShadow: '0 4px 16px rgba(95,121,11,0.28)', minHeight: '52px' }}
                >
                  Start analyzing for free
                </Link>
              ) : (
                <button
                  onClick={() => signIn('google')}
                  className="inline-flex items-center justify-center rounded-[10px] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                  style={{ background: '#5F790B', boxShadow: '0 4px 16px rgba(95,121,11,0.28)', minHeight: '52px' }}
                >
                  Start analyzing for free
                </button>
              )}
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#CBD1C4] bg-white px-6 py-3.5 text-[15px] font-semibold text-[#0A1424] hover:bg-[#F6FAEA] hover:border-[#5F790B] transition-colors"
                style={{ minHeight: '52px' }}
              >
                <Play size={13} className="text-[#5F790B]" fill="#5F790B" />
                See how it works
              </a>
            </motion.div>

            {/* Social proof row */}
            <motion.div
              initial={reduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.34 }}
              className="flex items-center gap-3"
            >
              <div className="flex -space-x-2">
                {['bg-[#CBD1C4]', 'bg-[#B6BFCC]', 'bg-[#8A96A8]'].map((c, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-white ${c} flex items-center justify-center`}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/></svg>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className="w-3.5 h-3.5 text-[#5F790B]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <span className="text-[12px] text-[#536174]">Trusted by investors who do their own research</span>
              </div>
            </motion.div>
          </div>

          {/* ── Right: Product card ── */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, x: 32, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 60, damping: 22, delay: 0.15 }}
            className="w-full max-w-[420px] mx-auto lg:mx-0 lg:max-w-none"
          >
            <ProductMockCard />
          </motion.div>

        </div>
      </div>

      {/* "What the market is pricing in" teaser below hero */}
      <div className="mt-12 mx-auto px-4 sm:px-6" style={{ maxWidth: '1200px' }}>
        <div className="rounded-[16px] border border-[#E3E6E0] bg-white p-5 sm:p-6" style={{ boxShadow: '0 4px 16px rgba(6,16,31,0.05)' }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-[10px] bg-[#EEF4DD] flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-[#5F790B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#0A1424]">What the market is pricing in</h2>
              <p className="text-[13px] text-[#536174] mt-0.5">
                See the growth and profitability the market is expecting over the coming years.
              </p>
            </div>
          </div>

          {/* Example: AAPL market pricing table */}
          <p className="text-[11px] font-semibold text-[#8A96A8] mb-2 uppercase tracking-[0.06em]">Example: Apple Inc. (AAPL)</p>
          <div className="divide-y divide-[#F3F2EC]">
            {[
              ['Implied 5Y Revenue CAGR', '12.1%', ''],
              ['3Y Historical CAGR', '6.7%', ''],
              ['Analyst Estimate (5Y CAGR)', '9.3%', ''],
              ['Market Interpretation', 'Moderate', 'badge'],
            ].map(([label, val, type]) => (
              <div key={label} className="flex items-center justify-between py-2">
                <span className="text-[13px] text-[#536174]">{label}</span>
                {type === 'badge' ? (
                  <span className="text-[11px] font-semibold bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391] rounded-full px-2.5 py-0.5">{val}</span>
                ) : (
                  <span className="text-[13px] font-semibold tabular-nums text-[#0A1424]">{val}</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-[#8A96A8] leading-relaxed">
            At today&apos;s price, the market implies 12.1% annual revenue growth over the next 5 years.
          </p>
        </div>
      </div>
    </section>
  )
}
