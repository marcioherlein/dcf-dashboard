'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import TickerStrip from '@/components/home/TickerStrip'
import StockCardStrip from '@/components/home/StockCardStrip'

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

// ── Mac mockup ───────────────────────────────────────────────────────────────
const MOCK_SCREENS = [
  { label: 'Search',    url: 'rationale.capital' },
  { label: 'Analysis',  url: 'rationale.capital/stock/AAPL' },
  { label: 'DCF Model', url: 'rationale.capital/stock/AAPL#dcf' },
  { label: 'Watchlist', url: 'rationale.capital/valuations' },
]

function ScreenSearch() {
  return (
    <div className="p-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Analyze any stock</p>
      <div className="flex items-center gap-2 rounded-xl bg-[#0A1628] border border-[rgba(59,130,246,0.35)] px-4 py-3">
        <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
        </svg>
        <span className="text-sm font-mono text-slate-200 flex-1">Apple Inc.</span>
        <span className="text-[11px] text-slate-500 border-l border-white/10 pl-2">AAPL</span>
        <span className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-[#2563EB]">Analyze →</span>
      </div>
      <div className="rounded-xl border border-[rgba(59,130,246,0.18)] overflow-hidden" style={{ background: 'rgba(10,22,40,0.5)' }}>
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border-b border-[rgba(59,130,246,0.1)]">
          <span className="text-[12px] font-bold text-blue-400 font-mono w-12">AAPL</span>
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
          {['NVDA','MSFT','AMZN','GOOGL','META'].map(t => (
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
          <div className="text-sm font-bold text-slate-100">Apple Inc.</div>
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
              <div className="h-1.5 rounded-full" style={{ width: `${score}%`, background: color, transition: `width 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 120}ms` }} />
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
          { year: 'FY3', fcf: 85,  growth: '+11.8%',  pv: 66.5, proj: true  },
          { year: 'FY4', fcf: 96,  growth: '+12.9%',  pv: 69.4, proj: true  },
          { year: 'FY5', fcf: 108, growth: '+12.5%',  pv: 72.7, proj: true  },
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
        <div key={r.ticker} className="flex items-center gap-2.5 rounded-lg border border-white/6 px-3 py-2.5" style={{ background: 'rgba(10,22,40,0.4)' }}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-extrabold ${r.upside > 0 ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'}`} style={{ fontFamily: 'Manrope, system-ui' }}>
            {r.grade}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-slate-200 font-mono">{r.ticker}</div>
            <div className="text-[9px] text-slate-500 truncate">{r.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-slate-200">${r.price.toFixed(2)}</div>
            <div className={`text-[9px] font-semibold ${r.upside > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.upside > 0 ? '▲' : '▼'} {Math.abs(r.upside).toFixed(1)}%
            </div>
          </div>
          <div className="text-right border-l border-white/8 pl-2.5">
            <div className="text-[9px] text-slate-600">FV</div>
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
    setTimeout(() => { setScreenIdx(i); setFading(false) }, 250)
  }

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setScreenIdx(prev => (prev + 1) % MOCK_SCREENS.length)
        setFading(false)
      }, 250)
    }, 3800)
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
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'linear-gradient(to bottom, #0F1C30, #0A1628)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 rounded-md px-3 py-1 max-w-[300px] w-full" style={{ background: '#050D1F', border: '1px solid rgba(255,255,255,0.07)' }}>
              <svg className="w-2.5 h-2.5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx={11} cy={11} r={7} /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4-4" />
              </svg>
              <span className="text-[10.5px] text-slate-500 font-mono truncate">{MOCK_SCREENS[screenIdx].url}</span>
            </div>
          </div>
          <div className="w-[54px] shrink-0" />
        </div>

        {/* Content with fade overlay — overlay fades, not content */}
        <div className="relative overflow-hidden" style={{ background: '#070E1C', minHeight: 300 }}>
          {MOCK_SCREEN_COMPONENTS[screenIdx]}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: '#070E1C',
              opacity: fading ? 1 : 0,
              transition: 'opacity 0.22s ease',
              zIndex: 10,
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {MOCK_SCREENS.map((s, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all focus:outline-none"
            style={i === screenIdx
              ? { background: 'rgba(59,130,246,0.15)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.35)' }
              : { color: '#6B7280', background: 'transparent', border: '1px solid transparent' }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: i === screenIdx ? '#3B82F6' : '#374151' }} />
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

  return (
    <div className="relative w-full max-w-xl mx-auto" ref={containerRef}>
      <div
        className="flex items-center gap-3 rounded-2xl border px-5 py-4 transition-all shadow-xl focus-within:border-blue-500/50"
        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.15)' }}
      >
        <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase()) }}
          placeholder="Enter ticker or company name…"
          className="flex-1 bg-transparent text-base text-slate-100 placeholder-slate-500 focus:outline-none uppercase"
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
          {results.map(r => (
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
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-20" style={{ background: 'linear-gradient(135deg, #050D1F 0%, #0A1628 55%, #0B1E38 100%)' }}>
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

          <p className="hero-reveal text-[1.1rem] text-slate-400 mb-9 max-w-2xl mx-auto leading-relaxed" style={{ animationDelay: '160ms' }}>
            Most stocks fail because expectations were too high, not because the company was bad.
            See exactly what today&apos;s price assumes — and decide if you believe it.
          </p>

          {/* Search */}
          <div className="hero-reveal relative z-10" style={{ animationDelay: '240ms' }}>
            <HeroSearch />
          </div>

          {/* Example tickers */}
          <div className="hero-reveal mt-4 flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: '310ms' }}>
            <span className="text-xs text-slate-500">Try:</span>
            {EXAMPLE_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => router.push(`/stock/${t}`)}
                className="rounded-lg border border-white/10 hover:border-blue-500/40 bg-white/5 hover:bg-blue-500/10 px-3 py-1 text-xs font-semibold text-slate-400 hover:text-blue-300 transition-all font-mono"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Mockup */}
          <div className="hero-reveal mt-12" style={{ animationDelay: '400ms' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-5">See how it works</p>
            <MacMockup />
          </div>
        </div>
      </section>

      {/* ── Reverse DCF band — seamlessly continues dark ── */}
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
              {/* Connector line (desktop only) */}
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
              {/* Free */}
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

              {/* Pro */}
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
              onClick={() => {
                const el = document.querySelector('input[type="text"]') as HTMLInputElement
                if (el) { el.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }) }
              }}
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

      <footer style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }} className="px-6 py-9 text-center">
        <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research.
          This is a research tool, not financial advice. All estimates are model outputs, not recommendations.
        </p>
      </footer>
    </div>
  )
}
