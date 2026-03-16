'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchDisp?: string
}

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: 'FCFF DCF',
    subtitle: 'Free Cash Flow to Firm',
    desc: 'Projects 10 years of free cash flows discounted at WACC. Terminal value via Gordon Growth. Works for any profitable company.',
    color: 'text-blue-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    title: 'FCFE',
    subtitle: 'Free Cash Flow to Equity',
    desc: 'Uses net income as the equity cash flow proxy, discounted at cost of equity — the preferred model for banks and fintechs.',
    color: 'text-violet-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    title: 'DDM',
    subtitle: 'Dividend Discount Model',
    desc: 'Gordon Growth Model values the dividend stream: D₁ / (Ke − g). The natural model for utilities, REITs, and dividend aristocrats.',
    color: 'text-emerald-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    ),
    title: 'Relative Multiples',
    subtitle: 'Market Comparables',
    desc: 'P/E, EV/EBITDA, P/Book, P/Sales — compared against Damodaran sector medians to benchmark intrinsic value against market pricing.',
    color: 'text-amber-400',
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Search any ticker', body: 'Type a company name or symbol. 10,000+ equities across US, ADRs, and global markets.' },
  { step: '02', title: 'Automatic inputs', body: 'Beta is calculated from 5-year weekly regression vs SPY. Risk-free rate from the live FRED 10Y Treasury. WACC fully auto-populated.' },
  { step: '03', title: 'Company type detected', body: 'The engine classifies each company — financial, dividend, growth, startup, or standard — and selects the most appropriate valuation model.' },
  { step: '04', title: 'Triangulated result', body: 'All applicable models run in parallel. A weighted triangulation produces a single fair value with full model breakdown and upside.' },
]

const RATINGS_CATEGORIES = ['Profitability', 'Liquidity', 'Growth', 'Economic Moat', 'Valuation']

export default function HomePage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHeroVisible(true)
    inputRef.current?.focus()
  }, [])

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

  const select = (symbol: string) => {
    setOpen(false)
    setQuery('')
    router.push(`/stock/${symbol}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase())
  }

  const examples = ['AAPL', 'NVDA', 'KO', 'JPM', 'NU', 'BABA', 'META', 'MSFT']

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(120,80,255,0.18) 0%, rgba(0,0,0,0) 70%)',
          }}
        />

        <div
          className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.9s ease, transform 0.9s ease',
          }}
        >
          {/* Eyebrow */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-white/60 tracking-wide">Multi-Model Equity Valuation</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl" style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            Institutional-grade<br />
            <span style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              valuation.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-lg text-white/50 leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
            Four models. One ticker. FCFF · FCFE · DDM · Multiples — automatically selected for each company type and triangulated into a single fair value.
          </p>

          {/* Search */}
          <div className="relative mt-10 w-full max-w-lg">
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md focus-within:border-white/25 focus-within:bg-white/8 transition-all"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)' }}
            >
              <span className="pl-5 text-white/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
                </svg>
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search ticker or company…"
                className="flex-1 bg-transparent py-4 pl-3 pr-4 text-base text-white placeholder-white/25 focus:outline-none"
              />
              {loading && (
                <span className="pr-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                </span>
              )}
            </div>

            {open && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl backdrop-blur-md">
                {results.map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => select(r.symbol)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-bold text-white">{r.symbol}</span>
                      <span className="ml-3 text-sm text-white/40">{r.longname ?? r.shortname}</span>
                    </div>
                    <span className="text-xs text-white/25">{r.exchDisp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Example chips */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="text-xs text-white/25">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => select(ex)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50 hover:border-white/20 hover:text-white/80 transition-all"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/20 animate-bounce">
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── The right model for every company ─────────────────────────────── */}
      <section className="px-4 py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-4">Methodology</p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ letterSpacing: '-0.03em' }}>
              The right model<br />for every company.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/40 leading-relaxed">
              A bank is not a chip maker. A utility is not a startup. Applying a single DCF to all of them produces wrong answers. This platform detects the company type and applies the academically correct model.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/8 bg-white/3 p-6 transition-all hover:border-white/15 hover:bg-white/5"
                style={{ backdropFilter: 'blur(12px)' }}
              >
                <div className={`mb-4 ${f.color}`}>{f.icon}</div>
                <p className="text-sm font-bold text-white tracking-tight">{f.title}</p>
                <p className="mb-3 text-xs text-white/30">{f.subtitle}</p>
                <p className="text-xs text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Triangulation callout ──────────────────────────────────────────── */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <div
            className="rounded-3xl border border-white/8 p-10 sm:p-14 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(120,80,255,0.08) 0%, rgba(60,160,255,0.06) 50%, rgba(52,211,153,0.06) 100%)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-4">Damodaran Principle</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ letterSpacing: '-0.03em' }}>
              Triangulate.<br />Never rely on one model.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/40 leading-relaxed">
              When FCFF, FCFE, DDM, and comparable multiples converge on the same price — confidence is high. When they diverge — that is the signal to dig deeper.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center max-w-lg mx-auto">
              {[
                { label: 'FCFF', weight: '60%', note: 'Standard' },
                { label: 'FCFE', weight: '65%', note: 'Financial' },
                { label: 'DDM', weight: '50%', note: 'Dividend' },
                { label: 'Multiples', weight: '70%', note: 'Pre-profit' },
              ].map((w) => (
                <div key={w.label} className="rounded-xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-sm font-bold text-white">{w.label}</p>
                  <p className="text-xs text-white/30">{w.note} type</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="px-4 py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-4">Process</p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ letterSpacing: '-0.03em' }}>
              How it works.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-px bg-white/5 rounded-2xl overflow-hidden sm:grid-cols-2">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} className="bg-black/80 p-8 hover:bg-white/3 transition-colors">
                <span className="text-xs font-bold text-white/20 tracking-widest">{item.step}</span>
                <h3 className="mt-3 text-base font-bold text-white tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm text-white/40 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ratings ───────────────────────────────────────────────────────── */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-4">Analysis Ratings</p>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ letterSpacing: '-0.03em' }}>
            Every dimension scored.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/40 leading-relaxed">
            Five categories — each graded A+ through F using objective financial thresholds. No black box. Every score is derived from public financial data.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {RATINGS_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white/60"
              >
                {cat}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's included ───────────────────────────────────────────────── */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-4">What&apos;s Inside</p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ letterSpacing: '-0.03em' }}>
              Everything in one page.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { title: 'Price & Chart', body: '1M / 3M / 1Y / 5Y interactive chart. 52-week range. Analyst consensus target.' },
              { title: 'WACC Breakdown', body: 'Beta from 5Y regression vs SPY. RF rate from live FRED 10Y. Every input shown and editable.' },
              { title: 'CAGR Analysis', body: 'Blended from 3-year historical revenue and analyst estimates. Confidence score. Growth drivers.' },
              { title: 'DCF Model', body: '10-year FCF projections. Gordon Growth terminal value. Bull / base / bear scenarios.' },
              { title: 'Multi-Model Valuation', body: 'FCFF + FCFE + DDM + Relative Multiples triangulated into one weighted fair value.' },
              { title: 'Ratings', body: 'A+ to F across Profitability, Liquidity, Growth, Moat, and Valuation — with per-metric dot scores.' },
              { title: 'Business Model', body: 'Company description, margins overview, and historical revenue bar chart.' },
              { title: 'Insider Transactions', body: 'Recent buy/sell activity from Yahoo Finance with transaction values.' },
              { title: 'Valuation History', body: 'Save snapshots to track your thesis over time. Supabase + localStorage fallback.' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/8 bg-white/3 p-5 hover:border-white/15 transition-colors">
                <p className="text-sm font-bold text-white mb-1.5">{item.title}</p>
                <p className="text-xs text-white/40 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section className="px-4 py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ letterSpacing: '-0.03em' }}>
            Start with any ticker.
          </h2>
          <p className="mt-4 text-base text-white/40">
            No account required. No API key. Live data, instant analysis.
          </p>

          <div className="relative mt-10 mx-auto max-w-md">
            <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md focus-within:border-white/25 transition-all"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)' }}
            >
              <span className="pl-5 text-white/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="AAPL, KO, JPM, NU…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    select(e.currentTarget.value.trim().toUpperCase())
                  }
                }}
                className="flex-1 bg-transparent py-4 pl-3 pr-4 text-base text-white placeholder-white/25 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-4 py-8">
        <div className="mx-auto max-w-5xl flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-white/20">
            Educational use only — not investment advice.
          </p>
          <p className="text-xs text-white/20">
            Data via Yahoo Finance · RF rate via FRED · Methodology: Damodaran
          </p>
        </div>
      </footer>
    </div>
  )
}
