'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import TickerStrip from '@/components/home/TickerStrip'
import StockCardStrip from '@/components/home/StockCardStrip'
import ChartSection from '@/components/home/ChartSection'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

const EXAMPLE_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'AMZN']

// ── Scroll reveal hook ─────────────────────────────────────────────────────────
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

const LIVE_EXAMPLES = [
  {
    ticker: 'NVDA',
    price: '~$118',
    impliedCAGR: 22,
    interpretation: 'very_aggressive',
    question: "Do you believe NVIDIA can grow revenue 22% per year for the next 5 years?",
  },
  {
    ticker: 'AAPL',
    price: '~$211',
    impliedCAGR: 9,
    interpretation: 'reasonable',
    question: "Apple's price implies moderate 9% growth — does that match your view?",
  },
  {
    ticker: 'MELI',
    price: '~$2,100',
    impliedCAGR: 15,
    interpretation: 'aggressive',
    question: "MercadoLibre is priced for 15% growth — aggressive for a maturing LatAm market?",
  },
]

const INTERP_CHIP: Record<string, string> = {
  conservative:    'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  reasonable:      'bg-blue-500/15 border-blue-500/30 text-blue-400',
  aggressive:      'bg-amber-500/15 border-amber-500/30 text-amber-400',
  very_aggressive: 'bg-red-500/15 border-red-500/30 text-red-400',
}

const INTERP_LABEL: Record<string, string> = {
  conservative:    'Conservative',
  reasonable:      'Reasonable',
  aggressive:      'Aggressive',
  very_aggressive: 'Very Aggressive',
}

// ── Typewriter headline ────────────────────────────────────────────────────────
const TYPEWRITER_PHRASES = [
  'worth buying',
  'undervalued',
  'a great deal',
  'truly overpriced',
  'a value trap',
  'a hidden gem',
]

function TypewriterHeadline({ phrases }: { phrases: string[] }) {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [stage, setStage] = useState<'typing' | 'holding' | 'deleting'>('typing')

  // longest phrase reserves a fixed container width — layout never reflows as text changes
  const longest = phrases.reduce((a, b) => a.length > b.length ? a : b)

  useEffect(() => {
    const phrase = phrases[phraseIdx]
    let timer: ReturnType<typeof setTimeout>

    if (stage === 'typing') {
      const len = displayText.length
      if (len < phrase.length) {
        timer = setTimeout(() => setDisplayText(phrase.slice(0, len + 1)), 68)
      } else {
        timer = setTimeout(() => setStage('holding'), 80)
      }
    } else if (stage === 'holding') {
      timer = setTimeout(() => setStage('deleting'), 1600)
    } else {
      const len = displayText.length
      if (len > 0) {
        timer = setTimeout(() => setDisplayText(displayText.slice(0, len - 1)), 38)
      } else {
        setPhraseIdx(i => (i + 1) % phrases.length)
        setStage('typing')
      }
    }

    return () => clearTimeout(timer)
  }, [stage, displayText, phraseIdx, phrases])

  return (
    <span className="relative inline-block" style={{ verticalAlign: 'bottom' }}>
      {/* invisible spacer — locks the container to the longest phrase width so the h1 never reflows */}
      <span className="invisible whitespace-nowrap select-none pointer-events-none" aria-hidden="true">
        {longest}
      </span>
      {/* typewriter text overlaid on top — position:absolute keeps it out of layout flow */}
      <span className="absolute inset-0 text-blue-400 font-medium whitespace-nowrap">
        {displayText}
        <span
          className="inline-block w-[2px] h-[0.88em] bg-blue-400 ml-[2px] align-middle rounded-sm"
          style={{ animation: stage === 'holding' ? 'pulse 1s ease-in-out infinite' : 'none', opacity: stage === 'holding' ? undefined : 1 }}
        />
      </span>
    </span>
  )
}

// ── Mac browser mockup ─────────────────────────────────────────────────────────
const MOCK_SCREENS = [
  { label: 'Search', url: 'rationale.capital' },
  { label: 'Analysis', url: 'rationale.capital/stock/AAPL' },
  { label: 'DCF Model', url: 'rationale.capital/stock/AAPL#dcf' },
  { label: 'Watchlist', url: 'rationale.capital/valuations' },
]

function ScreenSearch() {
  return (
    <div className="p-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Analyze any stock</p>
      <div className="flex items-center gap-2 rounded-xl bg-[#0A1628] border border-[rgba(59,130,246,0.35)] px-4 py-3 shadow-inner">
        <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
        </svg>
        <span className="text-sm font-mono text-slate-200 flex-1">Apple Inc.</span>
        <span className="text-[11px] text-slate-500 border-l border-white/10 pl-2">AAPL</span>
        <span className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-[#2563EB] shadow">Analyze →</span>
      </div>
      <div className="rounded-xl border border-[rgba(59,130,246,0.18)] overflow-hidden" style={{ background: 'rgba(10,22,40,0.5)' }}>
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border-b border-[rgba(59,130,246,0.1)]">
          <span className="text-[12px] font-bold text-blue-400 font-mono w-12 shrink-0">AAPL</span>
          <span className="text-[11px] text-slate-300">Apple Inc.</span>
          <span className="ml-auto text-[11px] font-semibold text-emerald-400">↗ +0.87%</span>
          <span className="text-[11px] font-mono text-slate-200 ml-2">$211.40</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 opacity-25">
          <span className="text-[12px] font-bold text-slate-500 font-mono w-12">AAPU</span>
          <span className="text-[11px] text-slate-500">Apple Ultra 2× ETF</span>
        </div>
      </div>
      <div className="pt-1">
        <p className="text-[9px] text-slate-500 mb-2">Popular searches</p>
        <div className="flex gap-1.5 flex-wrap">
          {['NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META'].map(t => (
            <span key={t} className="rounded-md border border-white/8 bg-white/4 px-2 py-1 text-[10px] font-mono font-semibold text-slate-400">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScreenAnalysis() {
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-[rgba(59,130,246,0.18)] px-4 py-3" style={{ background: 'rgba(10,22,40,0.5)' }}>
        <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <span className="text-xl font-extrabold text-emerald-400 leading-none" style={{ fontFamily: 'Manrope, system-ui' }}>B+</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400 font-mono">AAPL</span>
            <span className="text-[9px] text-slate-500">Technology · NASDAQ</span>
          </div>
          <div className="text-sm font-bold text-slate-100 leading-tight">Apple Inc.</div>
          <div className="text-[10px] text-slate-500">Good overall</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-extrabold text-slate-100 font-mono">$211.40</div>
          <div className="text-[11px] font-semibold text-emerald-400">▲ +0.87%</div>
        </div>
      </div>
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-300">
        11% upside · DCF fair value <strong className="text-emerald-200">$236.00</strong> vs current $211.40
      </div>
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Health scores</p>
        {[
          { label: 'Profitability', score: 85, color: '#10B981' },
          { label: 'Liquidity',     score: 78, color: '#3B82F6' },
          { label: 'Growth',        score: 72, color: '#60A5FA' },
        ].map(({ label, score, color }, i) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-slate-400">{label}</span>
              <span className="text-[9px] font-mono font-semibold text-slate-300">{score}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${score}%`, background: color, transition: `width 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 120}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenDCF() {
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">DCF Model · AAPL</p>
        <span className="text-[9px] font-semibold text-blue-400 border border-blue-500/20 bg-blue-500/10 rounded px-2 py-0.5">Interactive</span>
      </div>
      <div className="rounded-xl border border-[rgba(59,130,246,0.15)] overflow-hidden" style={{ background: 'rgba(10,22,40,0.4)' }}>
        <div className="grid grid-cols-4 text-[8px] text-slate-500 bg-white/3 px-3 py-1.5 border-b border-white/5">
          <span>Year</span><span className="text-right">FCF ($B)</span><span className="text-right">Growth</span><span className="text-right">PV</span>
        </div>
        {[
          { year: 'FY1', fcf: 68,  growth: '—',      pv: 62.0, proj: false },
          { year: 'FY2', fcf: 76,  growth: '+11.8%',  pv: 64.1, proj: false },
          { year: 'FY3', fcf: 85,  growth: '+11.8%',  pv: 66.5, proj: true },
          { year: 'FY4', fcf: 96,  growth: '+12.9%',  pv: 69.4, proj: true },
          { year: 'FY5', fcf: 108, growth: '+12.5%',  pv: 72.7, proj: true },
        ].map(row => (
          <div key={row.year} className={`grid grid-cols-4 px-3 py-1.5 border-b border-white/3 text-[9px] ${row.proj ? 'bg-blue-500/3' : ''}`}>
            <span className="text-slate-400 font-mono">{row.year}</span>
            <span className="text-right text-slate-300 font-mono">${row.fcf}B</span>
            <span className="text-right text-slate-500">{row.growth}</span>
            <span className="text-right text-slate-300 font-mono">${row.pv}B</span>
          </div>
        ))}
        <div className="px-3 py-2 text-[9px] bg-emerald-500/6 border-t border-emerald-500/15 flex justify-between items-center">
          <span className="text-slate-400">WACC 8.9% · Terminal growth 3%</span>
          <span className="text-emerald-300 font-bold font-mono text-[12px]">$236.00</span>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-center">
          <div className="text-[8px] font-bold uppercase text-red-400 mb-0.5">Bear</div>
          <div className="text-[13px] font-extrabold font-mono text-red-300">$168</div>
        </div>
        <div className="flex-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-center">
          <div className="text-[8px] font-bold uppercase text-blue-400 mb-0.5">Base</div>
          <div className="text-[13px] font-extrabold font-mono text-blue-300">$236</div>
        </div>
        <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
          <div className="text-[8px] font-bold uppercase text-emerald-400 mb-0.5">Bull</div>
          <div className="text-[13px] font-extrabold font-mono text-emerald-300">$278</div>
        </div>
      </div>
    </div>
  )
}

function ScreenWatchlist() {
  const rows = [
    { ticker: 'AAPL', name: 'Apple Inc.',     grade: 'B+', price: 211.40, fv: 236.00, upside:  11.7 },
    { ticker: 'NVDA', name: 'NVIDIA Corp.',    grade: 'A+', price: 118.20, fv: 163.50, upside:  38.3 },
    { ticker: 'MSFT', name: 'Microsoft',       grade: 'A',  price: 415.10, fv: 506.40, upside:  22.0 },
    { ticker: 'TSLA', name: 'Tesla Inc.',       grade: 'C',  price: 177.80, fv: 134.50, upside: -24.3 },
  ]
  return (
    <div className="p-5 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">My Watchlist</p>
        <span className="text-[9px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5">4 stocks</span>
      </div>
      {rows.map(r => (
        <div key={r.ticker} className="flex items-center gap-2.5 rounded-lg border border-white/6 px-3 py-2.5 hover:bg-white/3 transition-colors" style={{ background: 'rgba(10,22,40,0.4)' }}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-extrabold ${r.upside > 0 ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'}`} style={{ fontFamily: 'Manrope, system-ui' }}>
            {r.grade}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-slate-200 font-mono leading-tight">{r.ticker}</div>
            <div className="text-[9px] text-slate-500 truncate">{r.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-slate-200">${r.price.toFixed(2)}</div>
            <div className={`text-[9px] font-semibold ${r.upside > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.upside > 0 ? '▲' : '▼'} {Math.abs(r.upside).toFixed(1)}%
            </div>
          </div>
          <div className="text-right border-l border-white/8 pl-2.5">
            <div className="text-[9px] text-slate-600">Fair value</div>
            <div className="text-[11px] font-mono text-blue-300">${r.fv.toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const MOCK_SCREEN_COMPONENTS = [
  <ScreenSearch key="search" />,
  <ScreenAnalysis key="analysis" />,
  <ScreenDCF key="dcf" />,
  <ScreenWatchlist key="watchlist" />,
]

function MacMockup() {
  const [screenIdx, setScreenIdx] = useState(0)
  const [fading, setFading] = useState(false)

  const goTo = (i: number) => {
    if (i === screenIdx || fading) return
    setFading(true)
    setTimeout(() => { setScreenIdx(i); setFading(false) }, 260)
  }

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setScreenIdx(prev => (prev + 1) % MOCK_SCREENS.length)
        setFading(false)
      }, 260)
    }, 3600)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: '1px solid rgba(59,130,246,0.22)',
          boxShadow: '0 28px 72px rgba(0,0,0,0.65), 0 4px 14px rgba(59,130,246,0.1), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Mac title bar */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ background: 'linear-gradient(to bottom, #0F1C30, #0A1628)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-sm" />
          </div>
          {/* URL bar */}
          <div className="flex-1 flex justify-center">
            <div
              className="flex items-center gap-2 rounded-md px-3 py-1 max-w-[300px] w-full"
              style={{ background: '#050D1F', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <svg className="w-2.5 h-2.5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx={11} cy={11} r={7} /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4-4" />
              </svg>
              <span
                className="text-[10.5px] text-slate-500 font-mono truncate transition-all duration-300"
                key={MOCK_SCREENS[screenIdx].url}
                style={{ animation: 'step-fade-in 0.25s ease forwards' }}
              >
                {MOCK_SCREENS[screenIdx].url}
              </span>
            </div>
          </div>
          <div className="w-[54px] shrink-0" />
        </div>

        {/* App content */}
        <div
          className="overflow-hidden"
          style={{
            background: '#070E1C',
            minHeight: 290,
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.24s ease',
          }}
        >
          {MOCK_SCREEN_COMPONENTS[screenIdx]}
        </div>
      </div>

      {/* Screen navigation pills */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {MOCK_SCREENS.map((s, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 focus:outline-none"
            style={i === screenIdx
              ? { background: 'rgba(59,130,246,0.15)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.35)' }
              : { color: '#6B7280', background: 'transparent', border: '1px solid transparent' }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 transition-all"
              style={{ background: i === screenIdx ? '#3B82F6' : '#374151' }}
            />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Hero search ───────────────────────────────────────────────────────────────
function HeroSearch() {
  const router = useRouter()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce    = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { setResults(d); setOpen(d.length > 0); setLoading(false) })
        .catch(() => setLoading(false))
    }, 300)
  }, [query])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const select = (symbol: string) => {
    setOpen(false); setQuery('')
    router.push(`/stock/${symbol}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase())
  }

  return (
    <div className="relative w-full max-w-xl mx-auto" ref={containerRef}>
      <div className="flex items-center gap-3 rounded-2xl border px-5 py-4 transition-all shadow-xl focus-within:border-blue-500/50 focus-within:shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.15)' }}
      >
        <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter ticker or company name…"
          className="flex-1 bg-transparent text-base text-slate-100 placeholder-slate-500 focus:outline-none uppercase"
          autoFocus
        />
        {loading
          ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500 shrink-0" />
          : (
            <button
              onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all shrink-0 hover:shadow-lg hover:-translate-y-px"
              style={{ background: '#2563EB', boxShadow: '0 2px 8px rgba(37,99,235,0.4)' }}
            >
              Analyze →
            </button>
          )
        }
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl glass-card border border-[rgba(59,130,246,0.2)] z-50">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => select(r.symbol)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/5 border-b border-[rgba(59,130,246,0.08)] last:border-b-0 transition-colors"
            >
              <span className="text-sm font-bold text-blue-400 w-16 shrink-0 font-mono">{r.symbol}</span>
              <span className="text-sm text-slate-400 truncate">{r.longname ?? r.shortname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────────
const STATS = [
  { value: '2,400+', label: 'Analyses run',     sub: 'and growing daily' },
  { value: '500+',   label: 'Stocks covered',   sub: 'NYSE & NASDAQ' },
  { value: '4',      label: 'Valuation methods', sub: 'DCF, DDM, FCFE, Multiples' },
]

// ── Trust points ──────────────────────────────────────────────────────────────
const TRUST_POINTS = [
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: '4 valuation methods, not just one',
    sub: 'FCFF, FCFE, Dividend Discount, and Multiples — weighted by company type.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    label: 'Every number is traceable',
    sub: 'Financials from Yahoo Finance. Risk-free rate from FRED. ERP from Damodaran. No black boxes.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'See and change every assumption',
    sub: 'Adjust WACC, growth rates, and terminal value yourself. Understand why the verdict changes.',
  },
]

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: 'DCF Valuation',
    benefit: 'What is this stock actually worth based on its cash flows? Adjust growth and discount rate yourself — see the fair value change in real time.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.745 3.745 0 0 1 3.296-1.043A3.745 3.745 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
    title: 'Financial Health',
    benefit: 'Is this company financially sound? Nine signals across profitability, debt, and efficiency — plus earnings quality and bankruptcy risk — in one view.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    ),
    title: 'Scenario Analysis',
    benefit: 'What if I\'m wrong? Bear, base, and bull cases with probability weighting show the full range — not just the optimistic number.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
      </svg>
    ),
    title: 'Reverse DCF',
    benefit: "What growth is this stock already priced for? Know if today's price requires you to be an optimist — before you buy.",
  },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const statsRef    = useScrollReveal()
  const trustRef    = useScrollReveal()
  const featuresRef = useScrollReveal()
  const ctaRef      = useScrollReveal()

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-20" style={{ background: 'linear-gradient(135deg, #050D1F 0%, #0A1628 55%, #0B1E38 100%)' }}>
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 bg-radial-blue opacity-70" />
        <div className="pointer-events-none absolute top-0 right-0 w-1/2 h-1/2" style={{ background: 'radial-gradient(ellipse 55% 55% at 85% 10%, rgba(59,130,246,0.12) 0%, transparent 65%)' }} />
        <div className="pointer-events-none absolute bottom-0 left-0 w-1/3 h-1/2" style={{ background: 'radial-gradient(ellipse 50% 60% at 10% 95%, rgba(16,185,129,0.06) 0%, transparent 65%)' }} />
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-25" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Social proof pill */}
          <div
            className="hero-reveal inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-7"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', animationDelay: '0ms' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Free · No account required · 500+ stocks
          </div>

          {/* Headline */}
          <h1
            className="hero-reveal font-display text-5xl sm:text-[3.6rem] text-slate-100 leading-[1.1] mb-5"
            style={{ letterSpacing: '-0.04em', fontWeight: 500, animationDelay: '80ms' }}
          >
            Know what growth a stock<br className="hidden sm:block" />
            <span className="text-blue-400"> is already priced for</span>
            <br className="hidden sm:block" />
            <span className="text-slate-300" style={{ fontWeight: 400 }}>— before you buy.</span>
          </h1>

          <p
            className="hero-reveal text-[1.1rem] text-slate-400 mb-9 max-w-2xl mx-auto leading-relaxed"
            style={{ animationDelay: '160ms' }}
          >
            Most stocks fail because expectations were too high, not because the company was bad.
            See exactly what today&apos;s price assumes.
          </p>

          {/* Search */}
          <div className="hero-reveal relative z-10" style={{ animationDelay: '240ms' }}>
            <HeroSearch />
          </div>

          {/* Example tickers */}
          <div className="hero-reveal mt-4 flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: '310ms' }}>
            <span className="text-xs text-slate-500">Try:</span>
            {EXAMPLE_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/stock/${t}`)}
                className="rounded-lg border border-white/10 hover:border-blue-500/40 bg-white/5 hover:bg-blue-500/10 px-3 py-1 text-xs font-semibold text-slate-400 hover:text-blue-300 transition-all font-mono"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Mac mockup */}
          <div className="hero-reveal mt-12" style={{ animationDelay: '400ms' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-5">See how it works</p>
            <MacMockup />
          </div>
        </div>
      </section>

      {/* ── Live Example strip ── */}
      <div style={{ background: '#0A1628', borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
        <div className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-6">
            What today&apos;s price already assumes
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {LIVE_EXAMPLES.map((ex) => (
              <a
                key={ex.ticker}
                href={`/stock/${ex.ticker}`}
                className="group rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-blue-500/30 transition-all px-5 py-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-200 font-mono">{ex.ticker}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{ex.price}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${INTERP_CHIP[ex.interpretation]}`}>
                    {INTERP_LABEL[ex.interpretation]}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono text-slate-100 leading-none">{ex.impliedCAGR}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">implied annual growth <span className="text-slate-500">(5Y)</span></p>
                </div>
                <p className="mt-3 text-[11px] text-slate-500 leading-relaxed border-t border-white/6 pt-3">
                  {ex.question}
                </p>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Unified dark band: tickers + stock cards ── */}
      <div style={{ background: '#050D1F' }}>
        <TickerStrip />
        <StockCardStrip />
      </div>

      {/* ── Stats strip ── */}
      <div ref={statsRef} className="scroll-reveal">
        <section style={{ background: '#FFFFFF', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-5xl px-6 py-10">
            <div className="grid grid-cols-3 gap-6 text-center divide-x divide-slate-100">
              {STATS.map((s) => (
                <div key={s.label} className="px-4">
                  <div
                    className="font-display font-semibold mb-1"
                    style={{ color: '#0F172A', letterSpacing: '-0.03em', fontSize: '2.25rem', lineHeight: 1 }}
                  >
                    {s.value}
                  </div>
                  <div className="text-sm font-semibold text-slate-700 mt-1">{s.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Chart section ── */}
      <ChartSection />

      {/* ── Trust points ── */}
      <div ref={trustRef} className="scroll-reveal">
        <section style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center mb-10">
              <h2
                className="font-display text-3xl sm:text-4xl mb-3"
                style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}
              >
                Built on transparent methodology
              </h2>
              <p className="text-slate-500 text-base max-w-xl mx-auto">
                Every number is traceable back to a public source. No estimates hidden behind a paywall.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {TRUST_POINTS.map((point, i) => (
                <div
                  key={point.label}
                  className="scroll-reveal rounded-2xl bg-white border p-6 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  style={{ borderColor: '#E2E8F0', transitionDelay: `${i * 80}ms` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                    {point.icon}
                  </div>
                  <p className="text-sm font-bold text-slate-800 mb-2 leading-snug">{point.label}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{point.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Feature cards ── */}
      <div ref={featuresRef} className="scroll-reveal">
        <section style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center mb-10">
              <h2
                className="font-display text-3xl sm:text-4xl mb-3"
                style={{ color: '#0F172A', fontWeight: 500, letterSpacing: '-0.03em' }}
              >
                Everything you need to value a stock
              </h2>
              <p className="text-slate-500 text-base">Four complementary methods. One clear verdict.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((card, i) => (
                <div
                  key={card.title}
                  className="scroll-reveal group rounded-2xl bg-white border p-6 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-lg transition-all cursor-default"
                  style={{ borderColor: '#E2E8F0', transitionDelay: `${i * 60}ms` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 mb-2">{card.title}</p>
                    <p className="text-sm text-slate-500 leading-relaxed">{card.benefit}</p>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600 text-xs font-semibold mt-auto">
                    <span>Try it</span>
                    <svg
                      className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── CTA ── */}
      <div ref={ctaRef} className="scroll-reveal">
        <section
          className="px-6 py-20 text-center"
          style={{ background: 'linear-gradient(135deg, #0A1628 0%, #050D1F 100%)' }}
        >
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
          <p className="text-slate-500 text-lg mb-9 max-w-md mx-auto">
            Start with any ticker — free, no signup required.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {EXAMPLE_TICKERS.slice(0, 3).map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/stock/${t}`)}
                className="rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5 font-mono"
                style={{ background: '#2563EB', boxShadow: '0 2px 10px rgba(37,99,235,0.35)' }}
              >
                Analyze {t}
              </button>
            ))}
          </div>
          <p className="mt-8 text-xs text-slate-600">NYSE · NASDAQ · No signup required</p>
        </section>
      </div>

      <footer style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }} className="px-6 py-9 text-center">
        <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research.
          This is a research tool, not financial advice. All estimates are model outputs, not recommendations.
        </p>
      </footer>
    </div>
  )
}
