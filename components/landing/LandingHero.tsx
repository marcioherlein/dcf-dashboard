'use client'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Play, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductAnimation from './ProductAnimation'

const EASE = [0.16, 1, 0.3, 1] as const

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

// ── Inline hero search bar ────────────────────────────────────────────────────
function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((d: SearchResult[]) => {
          setResults(d); setLoading(false)
          setOpen(d.length > 0)
        })
        .catch(() => { setLoading(false) })
    }, 280)
    return () => clearTimeout(debounce.current)
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (symbol: string) => {
    setOpen(false); setQuery('')
    router.push(`/stock/${symbol}`)
  }

  const submit = () => {
    const t = query.trim().toUpperCase()
    if (!t) return
    if (activeIndex >= 0 && results[activeIndex]) { select(results[activeIndex].symbol); return }
    const exact = results.find(r => r.symbol === t)
    if (exact) { select(exact.symbol); return }
    if (results.length > 0) { select(results[0].symbol); return }
    if (/^[A-Z0-9]{1,5}$/.test(t)) select(t)
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ maxWidth: '440px' }}>
      <div
        className="flex items-center gap-2 rounded-xl"
        style={{
          height: '52px',
          padding: '0 6px 0 14px',
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: open
            ? '1px solid rgba(124,154,25,0.6)'
            : '1px solid rgba(255,255,255,0.18)',
          boxShadow: open
            ? '0 0 0 3px rgba(95,121,11,0.14)'
            : '0 2px 12px rgba(0,0,0,0.18)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {loading
          ? <div className="h-4 w-4 rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-[#7C9A19] animate-spin shrink-0" />
          : <Search size={16} className="text-[rgba(255,255,255,0.55)] shrink-0" />
        }
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (open) setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)) }
            else if (e.key === 'Escape') { setOpen(false); setActiveIndex(-1) }
            else if (e.key === 'Enter') submit()
          }}
          placeholder="Try NVDA, AAPL, MELI…"
          className="flex-1 bg-transparent text-[15px] text-white placeholder-[rgba(255,255,255,0.40)] focus:outline-none"
          style={{ fontWeight: 500 }}
          aria-label="Search for a stock to analyze"
        />
        <button
          onClick={submit}
          className="shrink-0 rounded-lg px-4 text-[13px] font-bold text-white transition-all hover:-translate-y-px active:scale-95"
          style={{
            background: '#5F790B',
            height: '40px',
            boxShadow: '0 2px 8px rgba(95,121,11,0.30)',
          }}
        >
          Analyze →
        </button>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden z-50 text-left"
          style={{
            background: 'rgba(15,23,42,0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.40)',
          }}
          role="listbox"
        >
          {results.map((r, i) => (
            <button
              key={r.symbol}
              onClick={() => select(r.symbol)}
              className="flex w-full items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0 transition-colors"
              style={{
                minHeight: '44px',
                backgroundColor: i === activeIndex ? 'rgba(95,121,11,0.18)' : 'transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(95,121,11,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = i === activeIndex ? 'rgba(95,121,11,0.18)' : 'transparent' }}
            >
              <span className="text-[14px] font-bold text-white w-14 shrink-0">{r.symbol}</span>
              <span className="text-[13px] text-[rgba(255,255,255,0.50)] truncate">{r.longname ?? r.shortname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function LandingHero() {
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

            {/* Headline — line-by-line stagger */}
            <div className="mb-4 sm:mb-5" style={{ lineHeight: 1.05, letterSpacing: '-0.035em' }}>
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
              className="text-[14px] sm:text-[16px] leading-relaxed mb-6"
              style={{ maxWidth: '440px', color: 'rgba(255,255,255,0.82)' }}
            >
              See the fair value, the implied growth rate, and a conviction score for any NYSE or NASDAQ stock — in seconds, no spreadsheet needed.
            </motion.p>

            {/* Hero search bar */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.40 }}
              className="mb-4"
            >
              <HeroSearch />
              <p className="mt-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Free · No sign-up required to analyze
              </p>
            </motion.div>

            {/* Secondary CTA */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.50 }}
              className="flex items-center gap-4 mb-5"
            >
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-[13px] font-semibold transition-colors"
                style={{ color: 'rgba(255,255,255,0.55)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)' }}
              >
                <Play size={11} className="text-[#7C9A19]" fill="#7C9A19" />
                See how it works
              </a>
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
