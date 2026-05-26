'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import TickerStrip from '@/components/home/TickerStrip'
import StockCardStrip from '@/components/home/StockCardStrip'

// ── Scroll hero helpers ───────────────────────────────────────────────────────

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }
function easeOut3(t: number) { return 1 - (1 - t) ** 3 }
function easeOut2(t: number) { return 1 - (1 - t) ** 2 }
function phase(start: number, end: number, t: number) {
  return clamp01((t - start) / (end - start))
}

// Recreates the i-in-crosshair logo as animated SVG layers.
// Outer ring: dark navy circle with 4 crosshair cuts
// Inner ring: electric blue circle
// Stem: white vertical bar
// Dot: electric blue circle — the element that "decouples" on scroll
function IntrinsicSVG({ p }: { p: number }) {
  // Phase breakdowns
  const riseP   = easeOut3(phase(0,    0.45, p))  // i rises
  const ringP   = easeOut2(phase(0.30, 0.70, p))  // rings fade+expand
  const glowP   = easeOut3(phase(0,    0.55, p))  // glow intensifies
  const dotY     = riseP * -88           // dot rises faster
  const stemY    = riseP * -44           // stem follows at half speed
  const dotScale = 1 + riseP * 0.55     // dot grows as it rises
  const dotGlow  = 2 + glowP * 18       // glow blur radius

  const ringOpacity = 1 - ringP * 0.92
  const ringScale   = 1 + ringP * 0.18

  return (
    <svg
      viewBox="0 0 180 180"
      width="180"
      height="180"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Glow filter for the dot */}
        <filter id="dot-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation={dotGlow} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Soft glow filter for inner ring */}
        <filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={3 + glowP * 6} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Outer ring + crosshair cuts ── */}
      <g
        style={{
          opacity: ringOpacity,
          transform: `scale(${ringScale})`,
          transformBox: 'fill-box',
          transformOrigin: 'center',
        }}
      >
        {/* Main outer ring */}
        <circle
          cx="90" cy="90" r="74"
          stroke="#1A3066"
          strokeWidth="14"
          fill="none"
          strokeDasharray="102 14"
          strokeDashoffset="109"
          transform="rotate(-90 90 90)"
        />
        {/* Crosshair tick marks (small rectangles at N/S/E/W extending inward) */}
        <rect x="83" y="3"   width="14" height="13" rx="2" fill="#1A3066" />
        <rect x="83" y="164" width="14" height="13" rx="2" fill="#1A3066" />
        <rect x="3"  y="83"  width="13" height="14" rx="2" fill="#1A3066" />
        <rect x="164" y="83" width="13" height="14" rx="2" fill="#1A3066" />
      </g>

      {/* ── Inner ring ── */}
      <g
        style={{
          opacity: ringOpacity,
          transform: `scale(${ringScale})`,
          transformBox: 'fill-box',
          transformOrigin: 'center',
        }}
      >
        <circle
          cx="90" cy="90" r="52"
          stroke="#3D5AF1"
          strokeWidth="4"
          fill="none"
          filter="url(#ring-glow)"
        />
      </g>

      {/* ── i stem — follows at half speed ── */}
      <g style={{ transform: `translateY(${stemY}px)` }}>
        <rect
          x="84" y="78"
          width="12" height="36"
          rx="5"
          fill="white"
          fillOpacity={0.90}
        />
      </g>

      {/* ── i dot — rises fast, glows, decouples ── */}
      <g
        style={{
          transform: `translateY(${dotY}px) scale(${dotScale})`,
          transformBox: 'fill-box',
          transformOrigin: '90px 58px',
        }}
        filter="url(#dot-glow)"
      >
        <circle cx="90" cy="58" r="8.5" fill="#3D5AF1" />
      </g>
    </svg>
  )
}

// ── The full scroll-driven hero ────────────────────────────────────────────────
function ScrollHero({ _onSearchReady }: { _onSearchReady?: () => void }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [p, setP]   = useState(0)   // 0–1 scroll progress within this section

  const handleScroll = useCallback(() => {
    const el = sectionRef.current
    if (!el) return
    const scrolled     = -el.getBoundingClientRect().top
    const scrollable   = el.offsetHeight - window.innerHeight
    setP(clamp01(scrolled / scrollable))
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Derived animation values
  const textP    = easeOut3(phase(0.62, 1.00, p))
  const searchP  = easeOut3(phase(0.72, 1.00, p))
  const glowP    = easeOut3(phase(0,    0.60, p))

  // Background radial that follows the rising dot
  const dotRiseRaw = easeOut3(phase(0, 0.45, p))
  const glowCenterY = 52 - dotRiseRaw * 22   // % from top of viewport

  return (
    <div ref={sectionRef} style={{ height: '280vh', position: 'relative' }}>
      {/* ── Sticky canvas ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          background: '#040D1E',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow that follows the dot */}
        <div
          style={{
            position: 'absolute',
            top: `${glowCenterY}%`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${400 + glowP * 300}px`,
            height: `${400 + glowP * 300}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(61,90,241,${0.08 + glowP * 0.18}) 0%, transparent 65%)`,
            pointerEvents: 'none',
            transition: 'none',
          }}
        />

        {/* Subtle grid lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(61,90,241,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(61,90,241,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            pointerEvents: 'none',
            opacity: 1 - easeOut2(phase(0.5, 0.9, p)) * 0.7,
          }}
        />

        {/* ── Logo ── */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            marginBottom: textP > 0 ? `${textP * 32}px` : 0,
            transition: 'none',
          }}
        >
          <IntrinsicSVG p={p} />
        </div>

        {/* ── Text content — fades in as scroll progresses ── */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            padding: '0 24px',
            opacity: textP,
            transform: `translateY(${(1 - textP) * 28}px)`,
            maxWidth: '600px',
          }}
        >
          {/* Brand wordmark above headline */}
          <p
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.22em',
              color: 'rgba(61,90,241,0.85)',
              textTransform: 'uppercase',
              marginBottom: '18px',
            }}
          >
            intrinsico
          </p>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 700,
              color: '#F1F5F9',
              lineHeight: 1.06,
              letterSpacing: '-0.04em',
              marginBottom: '16px',
            }}
          >
            Invest with a{' '}
            <span style={{ color: '#4B6CF7' }}>process</span>,<br />
            not a story.
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              color: 'rgba(148,163,184,0.9)',
              lineHeight: 1.65,
              marginBottom: '32px',
              maxWidth: '440px',
              margin: '0 auto 32px',
            }}
          >
            See what a stock price already assumes — so you can decide
            with confidence, not hope.
          </p>

          {/* Search + tickers */}
          <div
            style={{
              opacity: searchP,
              transform: `translateY(${(1 - searchP) * 20}px)`,
            }}
          >
            <HeroSearchDark />
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.5)' }}>Try:</span>
              {EXAMPLE_TICKERS.map(t => (
                <a
                  key={t}
                  href={`/stock/${t}`}
                  style={{
                    borderRadius: '8px',
                    border: '1px solid rgba(61,90,241,0.25)',
                    background: 'rgba(61,90,241,0.08)',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'rgba(148,163,184,0.75)',
                    fontFamily: 'monospace',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                >
                  {t}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll hint — fades out as you scroll */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: 1 - easeOut2(phase(0, 0.15, p)) * 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>
            scroll
          </span>
          <div style={{ width: '1px', height: '28px', background: 'linear-gradient(to bottom, rgba(61,90,241,0.5), transparent)' }} />
        </div>

        {/* Bottom fade to dark */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '120px',
            background: 'linear-gradient(to bottom, transparent, #040D1E)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ── Dark-themed hero search ────────────────────────────────────────────────────
function HeroSearchDark() {
  const router   = useRouter()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce     = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setOpen(d.length > 0); setLoading(false) })
        .catch(() => setLoading(false))
    }, 300)
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

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderRadius: '16px',
          border: '1px solid rgba(61,90,241,0.35)',
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(12px)',
          padding: '14px 20px',
          boxShadow: '0 0 0 1px rgba(61,90,241,0.1) inset, 0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.6)" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase()) }}
          placeholder="Ticker or company…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: '#F1F5F9',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
          }}
        />
        {loading
          ? <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#4B6CF7', animation: 'spin 0.7s linear infinite' }} />
          : (
            <button
              onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
              style={{
                background: '#3D5AF1',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(61,90,241,0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              Analyze →
            </button>
          )
        }
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '100%',
          marginTop: '8px',
          background: 'rgba(8,18,40,0.97)',
          border: '1px solid rgba(61,90,241,0.3)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          zIndex: 100,
          backdropFilter: 'blur(20px)',
        }}>
          {results.map(r => (
            <button
              key={r.symbol}
              onClick={() => select(r.symbol)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#F1F5F9',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#4B6CF7', width: '60px', fontFamily: 'monospace' }}>{r.symbol}</span>
              <span style={{ fontSize: '13px', color: 'rgba(148,163,184,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.longname ?? r.shortname}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

const EXAMPLE_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'AMZN']

function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('in-view'); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return ref
}

// ── Reverse DCF example cards ────────────────────────────────────────────────
const LIVE_EXAMPLES = [
  {
    ticker: 'NVDA',
    price: '~$118',
    impliedCAGR: 22,
    interpretation: 'very_aggressive',
    question: 'Do you believe NVIDIA can grow revenue 22% per year for 5 years?',
  },
  {
    ticker: 'AAPL',
    price: '~$211',
    impliedCAGR: 9,
    interpretation: 'reasonable',
    question: "Apple's price implies 9% growth. Conservative, or fairly priced?",
  },
  {
    ticker: 'MELI',
    price: '~$2,100',
    impliedCAGR: 15,
    interpretation: 'aggressive',
    question: 'MercadoLibre priced for 15% growth — aggressive for a maturing LatAm market?',
  },
]

const INTERP_CHIP: Record<string, string> = {
  conservative:    'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  reasonable:      'bg-blue-500/15 border-blue-500/30 text-blue-400',
  aggressive:      'bg-amber-500/15 border-amber-500/30 text-amber-400',
  very_aggressive: 'bg-red-500/15 border-red-500/30 text-red-400',
}

const INTERP_LABEL: Record<string, string> = {
  conservative: 'Conservative', reasonable: 'Reasonable',
  aggressive: 'Aggressive', very_aggressive: 'Very Aggressive',
}


// ── How it works ─────────────────────────────────────────────────────────────
const HOW_STEPS = [
  {
    n: '1',
    title: 'Search any stock',
    body: 'Type a ticker or company name. NYSE and NASDAQ supported — no login, no card required.',
    color: '#6366f1',
  },
  {
    n: '2',
    title: 'Model runs instantly',
    body: 'DCF valuation, health scores, reverse DCF, and scenario analysis are calculated automatically from real financial data.',
    color: '#3b82f6',
  },
  {
    n: '3',
    title: 'Get a clear verdict',
    body: 'Fair value, upside %, a letter grade — and the implied growth already baked into today\'s price. Every assumption is yours to adjust.',
    color: '#10b981',
  },
]

// ── Feature visual panels ─────────────────────────────────────────────────────
function ReverseDCFMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-card-md bg-white">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reverse DCF — What growth is priced in?</span>
        <span className="text-[10px] text-slate-400">NVDA · $118</span>
      </div>
      <div className="p-4 space-y-4">
        {[
          { ticker: 'NVDA', cagr: 22, label: 'Very Aggressive', cls: 'bg-red-50 text-red-700 border-red-200' },
          { ticker: 'AAPL', cagr: 9,  label: 'Reasonable',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
          { ticker: 'MELI', cagr: 15, label: 'Aggressive',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        ].map(row => (
          <div key={row.ticker} className="flex items-center gap-3">
            <span className="text-xs font-bold font-mono text-slate-500 w-12">{row.ticker}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none">{row.cagr}%</span>
                <span className="text-xs text-slate-500">implied 5Y CAGR</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full" style={{ width: `${(row.cagr / 30) * 100}%`, background: row.cls.includes('red') ? '#ef4444' : row.cls.includes('amber') ? '#f59e0b' : '#3b82f6' }} />
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${row.cls}`}>{row.label}</span>
          </div>
        ))}
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-800">The question:</strong> Does NVDA need 22% annual growth to justify its price? If you think that&apos;s realistic — hold. If not — you have your answer.
        </div>
      </div>
    </div>
  )
}

function HealthScoreMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-card-md bg-white">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Financial Health · NVDA</span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-xs font-extrabold text-white" style={{ fontFamily: 'Manrope, system-ui' }}>A+</span>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {[
          { label: 'Profitability', score: 92, color: '#10b981' },
          { label: 'Growth',        score: 88, color: '#6366f1' },
          { label: 'Liquidity',     score: 81, color: '#3b82f6' },
          { label: 'Moat',          score: 85, color: '#8b5cf6' },
          { label: 'Valuation',     score: 61, color: '#f59e0b' },
        ].map(item => (
          <div key={item.label}>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-slate-600">{item.label}</span>
              <span className="text-xs font-mono font-semibold text-slate-700">{item.score}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full" style={{ width: `${item.score}%`, background: item.color }} />
            </div>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: 'Bear', val: '$168', cls: 'bg-red-50 text-red-700 border-red-200' },
            { label: 'Base', val: '$236', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Bull', val: '$278', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border px-2 py-2 text-center ${s.cls}`}>
              <div className="text-[9px] font-bold uppercase">{s.label}</div>
              <div className="text-sm font-extrabold font-mono mt-0.5">{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Social proof ──────────────────────────────────────────────────────────────
const QUOTES = [
  {
    text: "I used to buy stocks because they 'looked good' on a screener. Now I check the implied growth first. If NVDA needs 22% a year to justify its price, I at least know the bet I'm making.",
    name: 'Alex R.',
    role: 'Software engineer, self-directed investor',
    initial: 'A',
    color: '#6366f1',
  },
  {
    text: "The reverse DCF finally made sense of why I kept buying at bad prices. The number on Yahoo Finance told me nothing about whether it was expensive. The implied CAGR did.",
    name: 'Maria C.',
    role: 'Nurse, invested for 8 years',
    initial: 'M',
    color: '#3b82f6',
  },
  {
    text: "Transparency is everything for me. I can see the WACC formula, the FRED rate, the data sources. It's not a black box. I adjust the assumptions myself and the verdict changes — that's how you learn.",
    name: 'Daniel T.',
    role: 'Retired accountant, manages family portfolio',
    initial: 'D',
    color: '#10b981',
  },
]

// ── Pricing transparency ──────────────────────────────────────────────────────
const FREE_ITEMS = [
  'Unlimited stock analysis (any ticker)',
  'Full DCF valuation — fair value + letter grade',
  'Reverse DCF — what growth is priced in',
  'Financial health scores (Piotroski, Altman, Beneish)',
  'Bear / Base / Bull fair value range',
  'Adjust every assumption yourself',
  'Save up to 3 analyses to your Watchlist',
]

const PRO_ITEMS = [
  'Everything in Free',
  'Unlimited Watchlist saves',
  'Bull / Base / Bear scenario builder',
  'Sensitivity table — CAGR × WACC heat map',
  'AI Macro Brief for current market regime',
  'Price vs. fair value email alerts',
  'Portfolio fair value tracker',
  'PDF investment brief export',
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const howRef      = useScrollReveal()
  const panel1Ref   = useScrollReveal()
  const panel2Ref   = useScrollReveal()
  const trustRef    = useScrollReveal()
  const quotesRef   = useScrollReveal()
  const pricingRef  = useScrollReveal()
  const ctaRef      = useScrollReveal()

  return (
    <div className="min-h-screen" style={{ background: '#040D1E' }}>

      {/* ── Scroll-driven hero with i-decoupling logo ── */}
      <ScrollHero />

      {/* Transition stripe: hero dark → section dark */}
      <div style={{ height: '1px', background: 'rgba(61,90,241,0.15)' }} />

      {/* ── Reverse DCF band ── */}
      <div style={{ background: '#0A1628', borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Reverse DCF
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100" style={{ letterSpacing: '-0.03em' }}>
              What is today&apos;s price already betting on?
            </h2>
            <p className="mt-2 text-slate-400 text-sm max-w-xl mx-auto">
              Before you ask &ldquo;is this stock cheap?&rdquo; — ask what growth rate it requires to not be expensive.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {LIVE_EXAMPLES.map(ex => (
              <a
                key={ex.ticker}
                href={`/stock/${ex.ticker}`}
                className="group rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-blue-500/30 transition-all px-5 py-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-sm font-bold text-slate-200 font-mono">{ex.ticker}</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{ex.price}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${INTERP_CHIP[ex.interpretation]}`}>
                    {INTERP_LABEL[ex.interpretation]}
                  </span>
                </div>
                <p className="text-4xl font-extrabold font-mono text-slate-100 leading-none">{ex.impliedCAGR}%</p>
                <p className="text-[11px] text-slate-400 mt-1.5">implied annual growth <span className="text-slate-500">(5Y)</span></p>
                <p className="mt-4 text-[11px] text-slate-500 leading-relaxed border-t border-white/6 pt-3">
                  {ex.question}
                </p>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Ticker strip + stock cards (dark) ── */}
      <div style={{ background: '#050D1F' }}>
        <TickerStrip />
        <StockCardStrip />
      </div>

      {/* ── How it works ── */}
      <div ref={howRef} className="scroll-reveal">
        <section style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">How it works</p>
              <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}>
                A verdict in under 30 seconds
              </h2>
              <p className="text-slate-500 text-base max-w-xl mx-auto">
                No spreadsheet. No financial degree required.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
              <div className="hidden sm:block absolute top-[22px] left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] h-px bg-slate-200" />
              {HOW_STEPS.map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-4">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base z-10 shadow-card"
                    style={{ background: step.color }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 mb-1.5">{step.title}</p>
                    <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Feature panel 1: Reverse DCF ── */}
      <div ref={panel1Ref} className="scroll-reveal">
        <section style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 mb-3">Reverse DCF</p>
                <h2 className="font-display text-3xl sm:text-4xl mb-5" style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}>
                  Is today&apos;s price asking you to be an optimist?
                </h2>
                <p className="text-slate-500 text-base leading-relaxed mb-6">
                  Instead of asking &ldquo;what is this stock worth?&rdquo;, we flip it: &ldquo;what growth rate does this price already assume?&rdquo; If the implied CAGR is higher than you believe in, the stock is expensive — regardless of what the P/E ratio says.
                </p>
                <ul className="space-y-2 mb-8">
                  {[
                    'See implied 5Y revenue CAGR for any stock',
                    'Compare to analyst consensus and your own view',
                    'Interpretation badge: Conservative to Very Aggressive',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600">
                      <Check size={15} className="text-blue-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/stock/NVDA"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: '#2563EB', boxShadow: '0 2px 8px rgba(37,99,235,0.35)' }}
                >
                  See NVDA example <ArrowRight size={15} />
                </Link>
              </div>
              <div className="lg:order-first">
                <ReverseDCFMockup />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Feature panel 2: Health + Scenarios ── */}
      <div ref={panel2Ref} className="scroll-reveal">
        <section style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-3">Financial Health + Scenarios</p>
                <h2 className="font-display text-3xl sm:text-4xl mb-5" style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}>
                  Is the business quality there to grow into that price?
                </h2>
                <p className="text-slate-500 text-base leading-relaxed mb-6">
                  Fair value alone isn&apos;t enough. A stock can look cheap but be deteriorating underneath. Nine financial health signals — across profitability, liquidity, debt, and growth — tell you if the company is built to sustain it.
                </p>
                <ul className="space-y-2 mb-8">
                  {[
                    '9 signals across Piotroski, Altman Z, and Beneish M',
                    'Bear, Base, Bull fair value scenarios',
                    'Letter grade summarises the full picture',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600">
                      <Check size={15} className="text-emerald-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/stock/AAPL"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.35)' }}
                >
                  See AAPL example <ArrowRight size={15} />
                </Link>
              </div>
              <HealthScoreMockup />
            </div>
          </div>
        </section>
      </div>

      {/* ── Methodology / Trust ── */}
      <div ref={trustRef} className="scroll-reveal">
        <section style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center mb-10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Why trust the number</p>
              <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}>
                No black boxes. Every assumption is yours.
              </h2>
              <p className="text-slate-500 text-base max-w-xl mx-auto">
                Every input is traceable to a public source. Every assumption is a slider you can drag.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  color: '#6366f1',
                  title: 'Data from sources you already trust',
                  body: 'Financials from Yahoo Finance and FMP. Risk-free rate from FRED (US Federal Reserve). Country risk premiums from Damodaran (NYU Stern). Not invented — sourced.',
                },
                {
                  color: '#3b82f6',
                  title: 'Four methods, not just one',
                  body: 'FCFF, FCFE, Dividend Discount, and Multiples — weighted by company type. A consensus verdict is harder to game than a single DCF run.',
                },
                {
                  color: '#10b981',
                  title: 'Every assumption is a lever you can pull',
                  body: 'Adjust WACC, revenue growth, terminal growth, and margins yourself. See the fair value change in real time. Understanding replaces blind trust.',
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white border p-6 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  style={{ borderColor: '#E2E8F0' }}
                >
                  <div className="w-2 h-2 rounded-full mb-4" style={{ background: card.color }} />
                  <p className="text-sm font-bold text-slate-800 mb-2 leading-snug">{card.title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Social proof ── */}
      <div ref={quotesRef} className="scroll-reveal">
        <section style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center mb-10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">What investors say</p>
              <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}>
                Built for people who do their own research
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {QUOTES.map((q, i) => (
                <div key={i} className="rounded-2xl bg-white border p-6" style={{ borderColor: '#E2E8F0' }}>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">&ldquo;{q.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: q.color }}
                    >
                      {q.initial}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{q.name}</p>
                      <p className="text-[11px] text-slate-400">{q.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Pricing transparency ── */}
      <div ref={pricingRef} className="scroll-reveal">
        <section style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="text-center mb-10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Pricing</p>
              <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}>
                Start free. Upgrade when it matters.
              </h2>
              <p className="text-slate-500 text-base max-w-xl mx-auto">
                The core analysis is free forever — no trial, no credit card. Pro adds the tools serious investors come back for.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-2xl border p-7" style={{ borderColor: '#E2E8F0' }}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold text-slate-900">Free</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">No account needed to start. Always free.</p>
                <ul className="space-y-2.5 mb-8">
                  {FREE_ITEMS.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push('/stock/AAPL')}
                  className="w-full rounded-xl py-3 text-sm font-bold text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all"
                >
                  Analyze a stock free →
                </button>
              </div>

              <div
                className="rounded-2xl border p-7 relative"
                style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)', borderColor: '#BFDBFE' }}
              >
                <div className="absolute top-5 right-5">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-600 text-white uppercase tracking-wider">Pro</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold text-slate-900">Pro</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">For investors who do serious research.</p>
                <ul className="space-y-2.5 mb-8">
                  {PRO_ITEMS.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check size={15} className="text-blue-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="block w-full text-center rounded-xl py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: '#2563EB', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
                >
                  See Pro plans →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── CTA ── */}
      <div ref={ctaRef} className="scroll-reveal">
        <section className="px-6 py-20 text-center" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #050D1F 100%)' }}>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-400 mb-6"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Free · No account needed · Results in seconds
          </div>
          <h2
            className="font-display text-4xl sm:text-5xl text-slate-100 mb-4"
            style={{ fontWeight: 400, letterSpacing: '-0.04em' }}
          >
            Ready to know what a stock<br className="hidden sm:block" /> is really worth?
          </h2>
          <p className="text-slate-400 text-lg mb-9 max-w-md mx-auto">
            Type any ticker. See the fair value, the implied growth, and a verdict — in seconds.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => router.push('/stock/AAPL')}
              className="rounded-xl px-8 py-4 text-sm font-bold text-white transition-all hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: '#2563EB', boxShadow: '0 2px 10px rgba(37,99,235,0.45)' }}
            >
              Analyze any stock free →
            </button>
            <Link
              href="/stock/AAPL"
              className="rounded-xl px-8 py-4 text-sm font-semibold text-slate-300 border border-white/15 hover:border-white/30 hover:text-white transition-all"
            >
              See AAPL example
            </Link>
          </div>
          <p className="mt-8 text-xs text-slate-600">NYSE · NASDAQ · No signup required</p>
        </section>
      </div>

      <footer style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }} className="px-6 py-10 text-center">
        <p className="text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed mb-3">
          <strong className="text-slate-600">Not financial advice.</strong>{' '}
          All content — DCF models, fair value estimates, health scores, and scenario analyses — is provided
          for informational and educational purposes only. Model outputs are based on publicly available data
          and mathematical assumptions; they are not recommendations to buy, sell, or hold any security.
          Always consult a qualified financial advisor before making investment decisions.
        </p>
        <p className="text-xs text-slate-400 mb-4">
          Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research.
        </p>
        <div className="flex items-center justify-center gap-5 text-xs text-slate-400">
          <a href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</a>
          <span className="text-slate-300">·</span>
          <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
          <span className="text-slate-300">·</span>
          <a href="mailto:hello@intrinsico.capital" className="hover:text-slate-600 transition-colors">Contact</a>
        </div>
        <p className="mt-4 text-[11px] text-slate-300">© {new Date().getFullYear()} Intrinsico. All rights reserved.</p>
      </footer>
    </div>
  )
}
