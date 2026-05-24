'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ChevronDown, DollarSign, Shield, BarChart2 } from 'lucide-react'
import TickerStrip from '@/components/home/TickerStrip'
import StockCardStrip from '@/components/home/StockCardStrip'
import ChartSection from '@/components/home/ChartSection'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

const EXAMPLE_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'AMZN']

const MARKETS = [
  { flag: '🇺🇸', label: 'NYSE' },
  { flag: '🇺🇸', label: 'NASDAQ' },
]

// ── Scroll reveal hook ─────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
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

// ── Cycling word animation ─────────────────────────────────────────────────────
const ROTATING_PHRASES = [
  'worth buying',
  'undervalued',
  'overvalued',
  'a great deal',
  'a value trap',
  'a hidden gem',
]

function RotatingText({ phrases }: { phrases: string[] }) {
  const [idx, setIdx] = useState(0)
  const [stage, setStage] = useState<'in' | 'out'>('in')

  useEffect(() => {
    if (stage === 'in') {
      const t = setTimeout(() => setStage('out'), 1700)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setIdx(i => (i + 1) % phrases.length)
        setStage('in')
      }, 310)
      return () => clearTimeout(t)
    }
  }, [stage, phrases.length])

  return (
    <span
      className={stage === 'in' ? 'word-enter' : 'word-exit'}
      style={{ display: 'inline-block', color: '#F59E0B', minWidth: '9ch' }}
    >
      {phrases[idx]}
    </span>
  )
}

// ── Inline SVG sparkline helpers ───────────────────────────────────────────────
function miniSparklinePath(data: number[]): string {
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  return data.map((v, i) => {
    const x = (i / (data.length - 1)) * 50
    const y = 14 - ((v - min) / range) * 12
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

// ── Animated investor journey ──────────────────────────────────────────────────
const THESIS_TEXT = "Apple's services segment grows 14% YoY. Hardware at 25x P/E is a discount on a software company."

const STEP_LABELS = [
  { n: '01', title: 'Search' },
  { n: '02', title: 'Read grade' },
  { n: '03', title: 'Adjust model' },
  { n: '04', title: 'Write thesis' },
]
const STEP_DURATIONS = [2800, 3200, 3400, 3600]

const FCF_BARS = [
  { year: 'FY1', val: 68, projected: false },
  { year: 'FY2', val: 76, projected: false },
  { year: 'FY3', val: 85, projected: true },
  { year: 'FY4', val: 96, projected: true },
  { year: 'FY5', val: 108, projected: true },
  { year: 'TV',  val: 112, projected: true, terminal: true },
]

const HEALTH_BARS_STEP1 = [
  { label: 'Profitability', score: 85, color: '#10B981' },
  { label: 'Liquidity',     score: 78, color: '#3B82F6' },
  { label: 'Growth',        score: 72, color: '#60A5FA' },
]

const BULL_SPARK = [168, 178, 190, 208, 222, 241, 265, 278]
const BEAR_SPARK = [168, 175, 172, 165, 162, 168, 170, 168]

function AnimatedJourney() {
  const [step, setStep] = useState(0)
  const [stepKey, setStepKey] = useState(0)
  const [typedTicker, setTypedTicker] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [thesisLen, setThesisLen] = useState(0)
  const [wacc, setWacc] = useState(9.2)
  const [fairValue, setFairValue] = useState(236)
  const [barsVisible, setBarsVisible] = useState(false)

  const goToStep = (i: number) => { setStep(i); setStepKey(k => k + 1) }

  useEffect(() => {
    const t = setTimeout(() => goToStep((step + 1) % 4), STEP_DURATIONS[step])
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepKey])

  useEffect(() => {
    setTypedTicker(''); setShowDropdown(false); setThesisLen(0)
    setWacc(9.2); setFairValue(236); setBarsVisible(false)
  }, [stepKey])

  useEffect(() => {
    if (step !== 0) return
    let i = 0
    const t = setInterval(() => {
      i++; setTypedTicker('AAPL'.slice(0, i))
      if (i >= 4) { clearInterval(t); setTimeout(() => setShowDropdown(true), 320) }
    }, 130)
    return () => clearInterval(t)
  }, [stepKey, step])

  useEffect(() => {
    if (step !== 1) return
    const t = setTimeout(() => setBarsVisible(true), 500)
    return () => clearTimeout(t)
  }, [stepKey, step])

  useEffect(() => {
    if (step !== 2) return
    let f = 0
    const t = setInterval(() => {
      f++; setWacc(v => Math.max(8.6, v - 0.033)); setFairValue(v => Math.min(251, v + 0.78))
      if (f >= 18) clearInterval(t)
    }, 70)
    return () => clearInterval(t)
  }, [stepKey, step])

  useEffect(() => {
    if (step !== 3) return
    let i = 0
    const t = setInterval(() => {
      i++; setThesisLen(i)
      if (i >= THESIS_TEXT.length) clearInterval(t)
    }, 26)
    return () => clearInterval(t)
  }, [stepKey, step])

  return (
    <div className="max-w-2xl mx-auto">
      {/* Browser chrome */}
      <div className="rounded-2xl overflow-hidden border border-[rgba(59,130,246,0.25)]" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 4px 12px rgba(59,130,246,0.1)' }}>
        {/* Title bar */}
        <div className="bg-[#0A1628] border-b border-[rgba(59,130,246,0.15)] px-4 py-2.5 flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          <div className="mx-auto flex items-center gap-1.5 bg-[#050D1F] border border-[rgba(59,130,246,0.2)] rounded-md px-3 py-0.5">
            <svg className="w-2.5 h-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={9}/></svg>
            <span className="text-[11px] text-slate-500 font-mono">rationale.capital/stock/AAPL</span>
          </div>
          <div className="w-3 h-3 opacity-0" />
        </div>

        {/* Screen */}
        <div
          key={stepKey}
          className="bg-[#070E1C] p-5 min-h-[260px] flex flex-col justify-center"
          style={{ animation: 'step-fade-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
        >
          {/* Step 0 — search */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Analyze any stock</p>
              <div className="flex items-center gap-2 rounded-xl bg-[#0A1628] border border-[rgba(59,130,246,0.2)] px-4 py-3">
                <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
                </svg>
                <span className="text-sm font-mono font-semibold text-slate-100 flex-1">
                  {typedTicker}
                  <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 align-middle animate-pulse" />
                </span>
                <span className="text-[12px] font-semibold text-white px-3 py-1 rounded-lg bg-[#F59E0B] shadow-glow-sm">Analyze</span>
              </div>
              {showDropdown && (
                <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.2)] overflow-hidden" style={{ animation: 'step-fade-in 0.22s ease forwards' }}>
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border-b border-[rgba(59,130,246,0.12)]">
                    <span className="text-[13px] font-bold text-blue-400 font-mono w-12">AAPL</span>
                    <span className="text-[12px] text-slate-300">Apple Inc.</span>
                    <span className="ml-auto text-[11px] font-semibold text-emerald-400">↗ +0.87%</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 opacity-30">
                    <span className="text-[13px] font-bold text-slate-500 font-mono w-12">AAPU</span>
                    <span className="text-[12px] text-slate-500">Apple Ultra ETF</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1 — grade card + health bars */}
          {step === 1 && (
            <div className="space-y-2.5">
              <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.2)] p-4 space-y-3" style={{ animation: 'step-scale-in 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <span className="text-2xl font-extrabold text-emerald-400 leading-none" style={{ fontFamily: 'Manrope, system-ui' }}>B+</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-bold bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400">AAPL</span>
                      <span className="text-[10px] text-slate-500">Technology</span>
                    </div>
                    <div className="text-sm font-bold text-slate-100">Apple Inc.</div>
                    <div className="text-[10px] text-slate-500">Good overall</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-extrabold text-slate-100 font-mono">$211.40</div>
                    <div className="text-[12px] font-semibold text-emerald-400">▲ +0.87%</div>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-300">
                  DCF model suggests <strong>11% upside</strong> — trading below our $236 estimate.
                </div>
              </div>

              <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.15)] px-4 py-3 space-y-2" style={{ animation: 'step-fade-in 0.3s ease 0.3s both' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Health scores</p>
                {HEALTH_BARS_STEP1.map(({ label, score, color }, i) => (
                  <div key={label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[10px] text-slate-400">{label}</span>
                      <span className="text-[10px] font-mono font-semibold text-slate-300">{score}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: barsVisible ? `${score}%` : '0%',
                          background: color,
                          transition: `width 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — DCF model with FCF bar chart */}
          {step === 2 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">DCF cash flow model</p>

              <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.15)] px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Projected free cash flow ($B)</p>
                <div className="flex items-end gap-1" style={{ height: 56 }}>
                  {FCF_BARS.map((bar, i) => (
                    <div key={bar.year} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${(bar.val / 120) * 46}px`,
                          background: bar.terminal ? '#F59E0B' : bar.projected ? '#1e3a6e' : '#3B82F6',
                          transformOrigin: 'bottom',
                          animation: `bar-grow-up 0.45s ease-out ${i * 80}ms both`,
                        }}
                      />
                      <span className="text-[7px] text-slate-500">{bar.year}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-3 text-[8px] text-slate-500">
                  <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#3B82F6] mr-1 align-middle" />Actual</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#1e3a6e] mr-1 align-middle opacity-75" />Projected</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#F59E0B] mr-1 align-middle" />Terminal</span>
                </div>
              </div>

              <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.15)] px-4 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-slate-300">WACC</span>
                  <span className="text-[12px] font-bold font-mono text-slate-100">{wacc.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-[#3B82F6] transition-all duration-150" style={{ width: `${Math.min(100, ((wacc - 7) / (12 - 7)) * 100)}%` }} />
                </div>
              </div>

              <div className="rounded-xl glass-card border border-emerald-500/20 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-300">Fair value per share</span>
                <span className="text-lg font-extrabold font-mono text-emerald-400">${Math.round(fairValue)}</span>
              </div>
            </div>
          )}

          {/* Step 3 — thesis with sparklines */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Investment thesis</p>
              <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.15)] px-4 py-3 min-h-[64px]">
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  {THESIS_TEXT.slice(0, thesisLen)}
                  {thesisLen < THESIS_TEXT.length && (
                    <span className="inline-block w-0.5 h-3.5 bg-blue-400 ml-0.5 align-middle animate-pulse" />
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 space-y-1.5">
                  <div className="text-[9px] font-bold uppercase text-emerald-400">Bull case</div>
                  <div className="text-sm font-bold font-mono text-emerald-300">$278</div>
                  <svg width="50" height="16" viewBox="0 0 50 16" className="w-full" style={{ overflow: 'visible' }}>
                    <path d={miniSparklinePath(BULL_SPARK)} fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 space-y-1.5">
                  <div className="text-[9px] font-bold uppercase text-amber-400">Bear case</div>
                  <div className="text-sm font-bold font-mono text-amber-300">$168</div>
                  <svg width="50" height="16" viewBox="0 0 50 16" className="w-full" style={{ overflow: 'visible' }}>
                    <path d={miniSparklinePath(BEAR_SPARK)} fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step selector */}
      <div className="mt-5 flex items-center justify-center gap-1">
        {STEP_LABELS.map((s, i) => (
          <button
            key={i}
            onClick={() => goToStep(i)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200"
            style={i === step
              ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)' }
              : { color: '#9CA3AF', background: 'transparent' }}
          >
            <span className="font-mono">{s.n}</span>
            <span className="hidden sm:inline">{s.title}</span>
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
    setOpen(false)
    setQuery('')
    router.push(`/stock/${symbol}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase())
  }

  return (
    <div className="relative w-full max-w-xl mx-auto" ref={containerRef}>
      <div className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 px-5 py-4 focus-within:border-amber-400/60 focus-within:bg-white/15 transition-all shadow-xl">
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
          ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400 shrink-0" />
          : (
            <button
              onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-stone-900 transition-all shrink-0 bg-[#F59E0B] hover:bg-[#FBBF24] shadow-md hover:shadow-lg hover:-translate-y-px"
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
              <span className="text-sm font-bold text-amber-400 w-16 shrink-0 font-mono">{r.symbol}</span>
              <span className="text-sm text-slate-400 truncate">{r.longname ?? r.shortname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Demo grade card ───────────────────────────────────────────────────────────
function DemoGradeCard({ onAnalyze }: { onAnalyze: (ticker: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl glass-card border border-[rgba(59,130,246,0.2)] overflow-hidden max-w-xl mx-auto">
      {/* Label */}
      <div className="px-5 pt-4 pb-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-[11px] font-semibold text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Example analysis · Apple Inc. (AAPL)
        </span>
      </div>

      {/* State 1 */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Grade badge */}
          <div className="w-[72px] h-[72px] shrink-0 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-[2.75rem] font-extrabold leading-none tracking-tight text-emerald-400" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              B+
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-400">AAPL</span>
                  <span className="text-[11px] text-slate-500">Technology</span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-slate-100">Apple Inc.</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Good overall</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold text-slate-100 font-mono tabular-nums">$211.40</div>
                <div className="mt-1 flex items-center justify-end gap-1 text-sm font-semibold text-emerald-400">
                  <TrendingUp size={13} />
                  <span>+1.82</span>
                  <span className="text-xs opacity-75">(+0.87%)</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Our DCF model suggests this may be undervalued — trading 11% below our estimate. See the assumptions.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 w-full flex items-center justify-between text-[12px] font-medium text-slate-500 hover:text-slate-200 transition-colors"
        >
          <span>{expanded ? 'Hide details' : 'See full picture — profitability, debt & growth'}</span>
          <ChevronDown size={14} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {/* State 2 */}
      {expanded && (
        <div className="border-t border-[rgba(59,130,246,0.1)] px-5 pb-5 pt-4 space-y-4 bg-[rgba(10,22,40,0.4)]">
          <div className="flex items-center justify-between rounded-xl glass-card border border-[rgba(59,130,246,0.15)] px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">What you pay today</p>
              <p className="mt-0.5 text-lg font-bold font-mono text-slate-100">$211.40</p>
            </div>
            <div className="text-slate-600 text-lg font-light">vs</div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Our DCF model&apos;s estimate</p>
              <p className="mt-0.5 text-lg font-bold font-mono text-emerald-400">$236.00</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Health check</p>
            {[
              { icon: <DollarSign size={14} />, label: 'Profitability', text: 'Strong and consistent — net margins above 25% for 5+ years.' },
              { icon: <Shield      size={14} />, label: 'Financial Health', text: 'Very low debt relative to earnings; substantial cash position.' },
              { icon: <BarChart2   size={14} />, label: 'Growth',         text: 'Services segment growing 14% year-over-year; hardware slower.' },
            ].map(({ icon, label, text }) => (
              <div key={label} className="flex items-start gap-2.5 rounded-xl glass-card border border-[rgba(59,130,246,0.12)] px-3 py-2.5" style={{ minHeight: '48px' }}>
                <span className="text-blue-400 mt-0.5">{icon}</span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">{label}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-[rgba(59,130,246,0.1)] px-5 py-4">
        <button
          onClick={() => onAnalyze('AAPL')}
          className="w-full rounded-xl py-2.5 text-[13px] font-bold text-stone-900 transition-all hover:shadow-lg hover:-translate-y-px bg-[#F59E0B] hover:bg-[#FBBF24]"
        >
          Open live analysis for AAPL →
        </button>
      </div>
    </div>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────────
const STATS = [
  { value: '2,400+', label: 'Analyses run', sub: 'and growing daily' },
  { value: '500+',   label: 'Stocks covered', sub: 'NYSE & NASDAQ' },
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
    label: 'Built on public financials — every number traceable',
    sub: 'Our estimates are based on DCF analysis using publicly reported financials. Risk-free rate from FRED, ERP from Damodaran.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'No black boxes',
    sub: 'See exactly why the fair value is what it is — every assumption is visible and adjustable.',
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
    benefit: 'Intrinsic value from free cash flows — not just multiples. Adjust WACC and growth yourself.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.745 3.745 0 0 1 3.296-1.043A3.745 3.745 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
    title: 'Health Scores',
    benefit: 'Piotroski F-Score, Altman Z-Score, Beneish M-Score, and ROIC vs WACC in one view.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    ),
    title: 'Scenario Analysis',
    benefit: 'Bear, base, and bull cases with probability weighting — see the full range, not just a point estimate.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
      </svg>
    ),
    title: 'Reverse DCF',
    benefit: "See what growth rate the market is pricing in — decide if that expectation is achievable.",
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
    <div className="min-h-screen" style={{ background: '#F9F5EF' }}>

      {/* ── Hero — dark treatment ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#050D1F] via-[#0A1628] to-[#0B1A35] border-b border-white/5 px-6 pt-20 pb-28">
        {/* Ambient glow layers */}
        <div className="pointer-events-none absolute inset-0 bg-radial-blue opacity-80" />
        <div className="pointer-events-none absolute top-0 right-0 w-[60%] h-[60%]" style={{ background: 'radial-gradient(ellipse 60% 60% at 80% 10%, rgba(245,158,11,0.06) 0%, transparent 60%)' }} />
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Social proof pill */}
          <div
            className="hero-reveal inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-8 border"
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(12px)',
              animationDelay: '0ms',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Free · No account required · 500+ stocks covered
          </div>

          {/* Headline with rotating word */}
          <h1
            className="hero-reveal font-display text-5xl sm:text-6xl text-slate-100 leading-tight mb-5"
            style={{ letterSpacing: '-0.04em', fontWeight: 500, animationDelay: '80ms' }}
          >
            Know if a stock is{' '}
            <RotatingText phrases={ROTATING_PHRASES} />
            {' '}—<br className="hidden sm:block" />{' '}
            <span className="text-slate-300">before you buy.</span>
          </h1>

          <p
            className="hero-reveal text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ animationDelay: '160ms' }}
          >
            DCF-based fair value, plain-English health grades, and interactive modeling.
            Designed for investors who want to understand, not just guess.
          </p>

          {/* Search */}
          <div className="hero-reveal relative z-10" style={{ animationDelay: '240ms' }}>
            <HeroSearch />
          </div>

          {/* Example tickers */}
          <div className="hero-reveal mt-5 flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: '320ms' }}>
            <span className="text-xs text-slate-500">Try:</span>
            {EXAMPLE_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/stock/${t}`)}
                className="rounded-lg border border-white/10 hover:border-amber-400/40 bg-white/5 hover:bg-amber-400/10 px-3 py-1 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-all font-mono"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Markets covered */}
          <div className="hero-reveal mt-3 flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: '370ms' }}>
            <span className="text-xs text-slate-500">Markets:</span>
            {MARKETS.map(({ flag, label }, i) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400"
                style={{ animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${400 + i * 60}ms both` }}
              >
                {flag} {label}
              </span>
            ))}
          </div>

          {/* Animated journey */}
          <div className="hero-reveal mt-14" style={{ animationDelay: '440ms' }}>
            <p className="text-xs text-slate-500 mb-5 uppercase tracking-widest font-semibold">See how it works</p>
            <AnimatedJourney />
          </div>

          {/* Demo card */}
          <div className="hero-reveal mt-14" style={{ animationDelay: '520ms' }}>
            <p className="text-xs text-slate-500 mb-5 uppercase tracking-widest font-semibold">What an analysis looks like</p>
            <DemoGradeCard onAnalyze={(t) => router.push(`/stock/${t}`)} />
          </div>
        </div>
      </section>

      {/* ── Live market ticker strip ── */}
      <TickerStrip />

      {/* ── Stats strip ── */}
      <div ref={statsRef} className="scroll-reveal">
        <section style={{ background: '#F0EBE3', borderBottom: '1px solid #E8E2D9' }}>
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="grid grid-cols-3 gap-8 text-center">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div
                    className="text-4xl font-display font-semibold mb-1"
                    style={{ color: '#1c1917', letterSpacing: '-0.03em' }}
                  >
                    {s.value}
                  </div>
                  <div className="text-sm font-semibold text-stone-700">{s.label}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Stock card strip ── */}
      <StockCardStrip />

      {/* ── Chart section ── */}
      <ChartSection />

      {/* ── Trust points ── */}
      <div ref={trustRef} className="scroll-reveal">
        <section style={{ background: '#FFFFFF', borderTop: '1px solid #E8E2D9', borderBottom: '1px solid #E8E2D9' }}>
          <div className="mx-auto max-w-5xl px-6 py-20">
            <div className="text-center mb-12">
              <h2
                className="font-display text-3xl sm:text-4xl mb-3"
                style={{ color: '#1c1917', fontWeight: 500, letterSpacing: '-0.03em' }}
              >
                Built on transparent methodology
              </h2>
              <p className="text-stone-500 text-base max-w-xl mx-auto">
                Every number is traceable back to a public source. No estimates hidden behind a paywall.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {TRUST_POINTS.map((point, i) => (
                <div
                  key={point.label}
                  className="scroll-reveal rounded-2xl bg-stone-50 border p-6 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  style={{ borderColor: '#E8E2D9', transitionDelay: `${i * 80}ms` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                    {point.icon}
                  </div>
                  <p className="text-sm font-bold text-stone-800 mb-2 leading-snug">{point.label}</p>
                  <p className="text-sm text-stone-500 leading-relaxed">{point.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Feature cards ── */}
      <div ref={featuresRef} className="scroll-reveal">
        <section style={{ background: '#F9F5EF', borderBottom: '1px solid #E8E2D9' }}>
          <div className="mx-auto max-w-5xl px-6 py-20">
            <div className="text-center mb-12">
              <h2
                className="font-display text-3xl sm:text-4xl mb-3"
                style={{ color: '#1c1917', fontWeight: 500, letterSpacing: '-0.03em' }}
              >
                Everything you need to value a stock
              </h2>
              <p className="text-stone-500 text-base">Four complementary methods. One clear verdict.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((card, i) => (
                <div
                  key={card.title}
                  className="scroll-reveal group rounded-2xl bg-white border p-6 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-lg transition-all cursor-default"
                  style={{ borderColor: '#E8E2D9', transitionDelay: `${i * 60}ms` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-900 mb-2">{card.title}</p>
                    <p className="text-sm text-stone-500 leading-relaxed">{card.benefit}</p>
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

      {/* ── CTA — inverted dark section ── */}
      <div ref={ctaRef} className="scroll-reveal">
        <section style={{ background: '#1c1917' }} className="px-6 py-24 text-center">
          <h2
            className="font-display text-4xl sm:text-5xl text-stone-100 mb-4"
            style={{ fontWeight: 400, letterSpacing: '-0.04em' }}
          >
            Ready to know what a stock<br className="hidden sm:block" /> is really worth?
          </h2>
          <p className="text-stone-400 text-lg mb-10 max-w-md mx-auto">
            Free to use. No account needed. Results in seconds.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {EXAMPLE_TICKERS.slice(0, 3).map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/stock/${t}`)}
                className="rounded-xl px-7 py-3.5 text-sm font-bold text-stone-900 transition-all bg-[#F59E0B] hover:bg-[#FBBF24] hover:shadow-lg hover:-translate-y-0.5 font-mono"
              >
                Analyze {t}
              </button>
            ))}
          </div>
          <p className="mt-8 text-xs text-stone-600">NYSE · NASDAQ · No signup required</p>
        </section>
      </div>

      <footer style={{ background: '#F0EBE3', borderTop: '1px solid #E8E2D9' }} className="px-6 py-10 text-center">
        <p className="text-sm text-stone-400 max-w-xl mx-auto leading-relaxed">
          Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research.
          This is a research tool, not financial advice. All estimates are model outputs, not recommendations.
        </p>
      </footer>
    </div>
  )
}
