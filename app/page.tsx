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
  { flag: '🇺🇸', label: 'NYSE · NASDAQ' },
  { flag: '🇧🇷', label: 'B3' },
  { flag: '🇬🇧', label: 'LSE' },
]

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
      style={{ display: 'inline-block', color: '#0F2A5E', minWidth: '9ch' }}
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
  { label: 'Profitability', score: 85, color: '#0B7A5E' },
  { label: 'Liquidity',     score: 78, color: '#0F2A5E' },
  { label: 'Growth',        score: 72, color: '#4a9eff' },
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

  // Auto-advance
  useEffect(() => {
    const t = setTimeout(() => goToStep((step + 1) % 4), STEP_DURATIONS[step])
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepKey])

  // Reset state on step change
  useEffect(() => {
    setTypedTicker(''); setShowDropdown(false); setThesisLen(0)
    setWacc(9.2); setFairValue(236); setBarsVisible(false)
  }, [stepKey])

  // Step 0: typewriter
  useEffect(() => {
    if (step !== 0) return
    let i = 0
    const t = setInterval(() => {
      i++; setTypedTicker('AAPL'.slice(0, i))
      if (i >= 4) { clearInterval(t); setTimeout(() => setShowDropdown(true), 320) }
    }, 130)
    return () => clearInterval(t)
  }, [stepKey, step])

  // Step 1: trigger health bars
  useEffect(() => {
    if (step !== 1) return
    const t = setTimeout(() => setBarsVisible(true), 500)
    return () => clearTimeout(t)
  }, [stepKey, step])

  // Step 2: animate WACC + fair value
  useEffect(() => {
    if (step !== 2) return
    let f = 0
    const t = setInterval(() => {
      f++; setWacc(v => Math.max(8.6, v - 0.033)); setFairValue(v => Math.min(251, v + 0.78))
      if (f >= 18) clearInterval(t)
    }, 70)
    return () => clearInterval(t)
  }, [stepKey, step])

  // Step 3: typewriter thesis
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
    <div className="max-w-xl mx-auto">
      {/* macOS browser chrome */}
      <div className="rounded-2xl overflow-hidden border border-slate-200/80" style={{ boxShadow: '0 24px 64px rgba(15,42,94,0.13), 0 4px 12px rgba(15,42,94,0.06)' }}>
        {/* Title bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          <div className="mx-auto flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-3 py-0.5">
            <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={9}/></svg>
            <span className="text-[11px] text-slate-400 font-mono">clairo.ai/stock/AAPL</span>
          </div>
          <div className="w-3 h-3 opacity-0" />
        </div>

        {/* Screen */}
        <div
          key={stepKey}
          className="bg-[#F6F7F9] p-5 min-h-[260px] flex flex-col justify-center"
          style={{ animation: 'step-fade-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
        >
          {/* Step 0 — search */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Analyze any stock</p>
              <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-sm">
                <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
                </svg>
                <span className="text-sm font-mono font-semibold text-slate-900 flex-1">
                  {typedTicker}
                  <span className="inline-block w-0.5 h-4 bg-slate-700 ml-0.5 align-middle animate-pulse" />
                </span>
                <span className="text-[12px] font-semibold text-white px-3 py-1 rounded-lg" style={{ background: '#0F2A5E' }}>Analyze</span>
              </div>
              {showDropdown && (
                <div className="rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden" style={{ animation: 'step-fade-in 0.22s ease forwards' }}>
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-slate-100">
                    <span className="text-[13px] font-bold text-blue-600 font-mono w-12">AAPL</span>
                    <span className="text-[12px] text-slate-600">Apple Inc.</span>
                    <span className="ml-auto text-[11px] font-semibold text-emerald-600">↗ +0.87%</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 opacity-30">
                    <span className="text-[13px] font-bold text-slate-400 font-mono w-12">AAPU</span>
                    <span className="text-[12px] text-slate-400">Apple Ultra ETF</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1 — grade card + health bars */}
          {step === 1 && (
            <div className="space-y-2.5">
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 space-y-3" style={{ animation: 'step-scale-in 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                    <span className="text-2xl font-extrabold text-white leading-none" style={{ fontFamily: 'Manrope, system-ui' }}>B+</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">AAPL</span>
                      <span className="text-[10px] text-slate-400">Technology</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">Apple Inc.</div>
                    <div className="text-[10px] text-slate-400">Good overall</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-extrabold text-slate-900 font-mono">$211.40</div>
                    <div className="text-[12px] font-semibold text-emerald-600">▲ +0.87%</div>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-800">
                  DCF model suggests <strong>11% upside</strong> — trading below our $236 estimate.
                </div>
              </div>

              {/* Animated health bars */}
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 space-y-2" style={{ animation: 'step-fade-in 0.3s ease 0.3s both' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Health scores</p>
                {HEALTH_BARS_STEP1.map(({ label, score, color }, i) => (
                  <div key={label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[10px] text-slate-500">{label}</span>
                      <span className="text-[10px] font-mono font-semibold text-slate-700">{score}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DCF cash flow model</p>

              {/* Mini FCF bar chart */}
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Projected free cash flow ($B)</p>
                <div className="flex items-end gap-1" style={{ height: 56 }}>
                  {FCF_BARS.map((bar, i) => (
                    <div key={bar.year} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${(bar.val / 120) * 46}px`,
                          background: bar.terminal ? '#C9A84C' : bar.projected ? '#1e3a6e' : '#0F2A5E',
                          transformOrigin: 'bottom',
                          animation: `bar-grow-up 0.45s ease-out ${i * 80}ms both`,
                        }}
                      />
                      <span className="text-[7px] text-slate-400">{bar.year}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-3 text-[8px] text-slate-400">
                  <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#0F2A5E] mr-1 align-middle" />Actual</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#1e3a6e] mr-1 align-middle opacity-75" />Projected</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#C9A84C] mr-1 align-middle" />Terminal</span>
                </div>
              </div>

              {/* WACC slider */}
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-slate-700">WACC</span>
                  <span className="text-[12px] font-bold font-mono text-slate-900">{wacc.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#0F2A5E] transition-all duration-150" style={{ width: `${Math.min(100, ((wacc - 7) / (12 - 7)) * 100)}%` }} />
                </div>
              </div>

              <div className="rounded-xl bg-white border border-emerald-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700">Fair value per share</span>
                <span className="text-lg font-extrabold font-mono text-emerald-700">${Math.round(fairValue)}</span>
              </div>
            </div>
          )}

          {/* Step 3 — thesis with sparklines */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Investment thesis</p>
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 min-h-[64px]">
                <p className="text-[12px] text-slate-700 leading-relaxed">
                  {THESIS_TEXT.slice(0, thesisLen)}
                  {thesisLen < THESIS_TEXT.length && (
                    <span className="inline-block w-0.5 h-3.5 bg-slate-700 ml-0.5 align-middle animate-pulse" />
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Bull case with sparkline */}
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 space-y-1.5">
                  <div className="text-[9px] font-bold uppercase text-emerald-600">Bull case</div>
                  <div className="text-sm font-bold font-mono text-emerald-700">$278</div>
                  <svg width="50" height="16" viewBox="0 0 50 16" className="w-full" style={{ overflow: 'visible' }}>
                    <path
                      d={miniSparklinePath(BULL_SPARK)}
                      fill="none"
                      stroke="#0B7A5E"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {/* Bear case with sparkline */}
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 space-y-1.5">
                  <div className="text-[9px] font-bold uppercase text-amber-600">Bear case</div>
                  <div className="text-sm font-bold font-mono text-amber-700">$168</div>
                  <svg width="50" height="16" viewBox="0 0 50 16" className="w-full" style={{ overflow: 'visible' }}>
                    <path
                      d={miniSparklinePath(BEAR_SPARK)}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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
              ? { background: '#0F2A5E', color: 'white' }
              : { color: '#94A3B8', background: 'transparent' }}
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
    <div className="relative w-full max-w-lg mx-auto" ref={containerRef}>
      <div className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 shadow-md px-5 py-4 focus-within:border-[#0F2A5E] focus-within:shadow-lg transition-all">
        <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter ticker or company name…"
          className="flex-1 bg-transparent text-base text-slate-900 placeholder-slate-400 focus:outline-none uppercase"
          autoFocus
        />
        {loading
          ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#0F2A5E] shrink-0" />
          : (
            <button
              onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition-colors shrink-0"
              style={{ background: '#0F2A5E' }}
            >
              Analyze
            </button>
          )
        }
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-lg z-50">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => select(r.symbol)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
            >
              <span className="text-sm font-bold text-[#0F2A5E] w-16 shrink-0 font-mono">{r.symbol}</span>
              <span className="text-sm text-slate-500 truncate">{r.longname ?? r.shortname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Demo grade card (static example, AAPL-inspired) ───────────────────────────
function DemoGradeCard({ onAnalyze }: { onAnalyze: (ticker: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl bg-white shadow-md border border-slate-200 overflow-hidden max-w-lg mx-auto">
      {/* Label */}
      <div className="px-5 pt-4 pb-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Example analysis · Apple Inc. (AAPL)
        </span>
      </div>

      {/* State 1 */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Grade badge */}
          <div className="w-[72px] h-[72px] shrink-0 rounded-2xl bg-emerald-600 flex items-center justify-center">
            <span className="text-[2.75rem] font-extrabold leading-none tracking-tight text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              B+
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">AAPL</span>
                  <span className="text-[11px] text-slate-400">Technology</span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-slate-900">Apple Inc.</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Good overall</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">$211.40</div>
                <div className="mt-1 flex items-center justify-end gap-1 text-sm font-semibold text-emerald-600">
                  <TrendingUp size={13} />
                  <span>+1.82</span>
                  <span className="text-xs opacity-75">(+0.87%)</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed rounded-lg px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-100">
              Our DCF model suggests this may be undervalued — trading 11% below our estimate. See the assumptions.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 w-full flex items-center justify-between text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span>{expanded ? 'Hide details' : 'See full picture — profitability, debt & growth'}</span>
          <ChevronDown size={14} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {/* State 2 */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4 bg-slate-50/60">
          {/* Fair value row */}
          <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What you pay today</p>
              <p className="mt-0.5 text-lg font-bold font-mono text-slate-900">$211.40</p>
            </div>
            <div className="text-slate-300 text-lg font-light">vs</div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Our DCF model&apos;s estimate</p>
              <p className="mt-0.5 text-lg font-bold font-mono text-emerald-700">$236.00</p>
            </div>
          </div>

          {/* Health pills */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Health check</p>
            {[
              { icon: <DollarSign size={14} />, label: 'Profitability', text: 'Strong and consistent — net margins above 25% for 5+ years.' },
              { icon: <Shield      size={14} />, label: 'Financial Health', text: 'Very low debt relative to earnings; substantial cash position.' },
              { icon: <BarChart2   size={14} />, label: 'Growth',         text: 'Services segment growing 14% year-over-year; hardware slower.' },
            ].map(({ icon, label, text }) => (
              <div key={label} className="flex items-start gap-2.5 rounded-xl bg-white border border-slate-100 px-3 py-2.5" style={{ minHeight: '48px' }}>
                <span className="text-slate-500 mt-0.5">{icon}</span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">{label}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-slate-100 px-5 py-4">
        <button
          onClick={() => onAnalyze('AAPL')}
          className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#0F2A5E' }}
        >
          Open live analysis for AAPL →
        </button>
      </div>
    </div>
  )
}

// ── Trust points ──────────────────────────────────────────────────────────────
const TRUST_POINTS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: '#0F2A5E' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: '4 valuation methods, not just one',
    sub: 'FCFF, FCFE, Dividend Discount, and Multiples — weighted by company type.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: '#0F2A5E' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    label: 'Built on public financials — every number is traceable',
    sub: 'Our estimates are based on DCF analysis using publicly reported financials. Risk-free rate from FRED, ERP from Damodaran.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: '#0F2A5E' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'No black boxes',
    sub: 'See exactly why the fair value is what it is — every assumption is visible and adjustable.',
  },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen" style={{ background: '#F6F7F9' }}>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 px-6 pt-16 pb-20"
        style={{ background: 'linear-gradient(to bottom, #EEF2F8, #F6F7F9)' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e2e8f040_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f040_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="relative mx-auto max-w-3xl text-center">
          {/* Social proof pill */}
          <div className="hero-reveal inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 mb-6 shadow-sm" style={{ animationDelay: '0ms' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Free · No account required · 500+ stocks covered
          </div>

          {/* Headline with rotating word */}
          <h1
            className="hero-reveal text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-4"
            style={{ letterSpacing: '-0.03em', animationDelay: '80ms' }}
          >
            Know if a stock is{' '}
            <RotatingText phrases={ROTATING_PHRASES} />
            {' '}—<br className="hidden sm:block" />{' '}
            <span style={{ color: '#0F2A5E' }}>before you buy.</span>
          </h1>
          <p className="hero-reveal text-lg text-slate-500 mb-8 max-w-xl mx-auto leading-relaxed" style={{ animationDelay: '180ms' }}>
            DCF-based fair value, plain-English health grades, and interactive modeling.
            Designed for investors who want to understand, not just guess.
          </p>

          {/* Search FIRST — F-pattern primary zone */}
          <div className="hero-reveal relative z-10" style={{ animationDelay: '260ms' }}>
            <HeroSearch />
          </div>

          {/* Example tickers + markets covered */}
          <div className="hero-reveal mt-4 flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: '340ms' }}>
            <span className="text-xs text-slate-400">Try:</span>
            {EXAMPLE_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/stock/${t}`)}
                className="rounded-lg bg-white border border-slate-200 hover:border-slate-400 hover:bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-all font-mono shadow-sm"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Markets covered */}
          <div className="hero-reveal mt-3 flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: '390ms' }}>
            <span className="text-xs text-slate-400">Markets:</span>
            {MARKETS.map(({ flag, label }, i) => (
              <span
                key={label}
                className="rounded-full bg-white/80 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                style={{
                  animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${420 + i * 60}ms both`,
                }}
              >
                {flag} {label}
              </span>
            ))}
          </div>

          {/* Animated investor journey */}
          <div className="hero-reveal mt-12" style={{ animationDelay: '460ms' }}>
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider font-semibold">See how it works</p>
            <AnimatedJourney />
          </div>

          {/* Demo card — supporting evidence */}
          <div className="hero-reveal mt-12" style={{ animationDelay: '540ms' }}>
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider font-semibold">What an analysis looks like</p>
            <DemoGradeCard onAnalyze={(t) => router.push(`/stock/${t}`)} />
          </div>
        </div>
      </section>

      {/* Live market ticker strip */}
      <TickerStrip />

      {/* Stock card strip — scroll-triggered */}
      <StockCardStrip />

      {/* Chart section — dark, data visualization */}
      <ChartSection />

      {/* Trust points — methodology transparency */}
      <section className="bg-white border-y border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Built on transparent methodology</h2>
            <p className="text-slate-500 text-sm">
              Our estimates are based on DCF analysis using publicly reported financials — every number is traceable. See the model for any stock.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {TRUST_POINTS.map((point) => (
              <div key={point.label} className="flex gap-4">
                <div className="mt-0.5 shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center" style={{ background: '#EEF2F8', borderColor: '#D4DCEA' }}>
                  {point.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">{point.label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{point.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ready to analyze your first stock?</h2>
        <p className="text-slate-500 text-sm mb-8">Free to use. No account needed to start.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {EXAMPLE_TICKERS.slice(0, 3).map((t) => (
            <button
              key={t}
              onClick={() => router.push(`/stock/${t}`)}
              className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 font-mono"
              style={{ background: '#0F2A5E' }}
            >
              Analyze {t}
            </button>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-center">
        <p className="text-xs text-slate-400">
          Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research.
          This is a research tool, not financial advice. All estimates are model outputs, not recommendations.
        </p>
      </footer>
    </div>
  )
}
