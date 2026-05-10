'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

const EXAMPLE_TICKERS = ['AAPL', 'MSFT', 'NVDA']

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Enter any stock',
    body: 'Search by ticker or company name. We support NYSE, NASDAQ, and international ADRs.',
  },
  {
    step: '02',
    title: 'See the full picture',
    body: 'Simplified financials, health scores, and a multi-method fair value — all in plain English.',
  },
  {
    step: '03',
    title: 'Model your assumptions',
    body: 'Adjust growth rate, discount rate, and terminal growth to see how fair value responds live.',
  },
]

const TRUST_POINTS = [
  {
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: '4 valuation methods, not just one',
    sub: 'FCFF, FCFE, Dividend Discount, and Multiples — weighted by company type.',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    label: 'Every input has a source',
    sub: 'Risk-free rate from FRED, ERP from Damodaran, beta via regression — nothing is hardcoded.',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'No black boxes',
    sub: "See exactly why the fair value is what it is — every assumption explained.",
  },
]

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
      <div className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 shadow-md px-5 py-4 focus-within:border-blue-400 focus-within:shadow-lg transition-all">
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
          ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 shrink-0" />
          : (
            <button
              onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors shrink-0"
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
              <span className="text-sm font-bold text-blue-600 w-16 shrink-0 font-mono">{r.symbol}</span>
              <span className="text-sm text-slate-500 truncate">{r.longname ?? r.shortname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#F8FAFB]">

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-[#F8FAFB] border-b border-slate-200 px-6 pt-20 pb-24">
        {/* Subtle grid background */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e2e8f040_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f040_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-xs font-semibold text-blue-700 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Free · No account required
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-5">
            Understand<br className="hidden sm:block" /> what you own
          </h1>
          <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto leading-relaxed">
            Professional-grade stock valuation, explained in plain English.
            See the fair value, understand why, and model your own assumptions.
          </p>

          <HeroSearch />

          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Try:</span>
            {EXAMPLE_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/stock/${t}`)}
                className="rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-all font-mono"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">How it works</h2>
          <p className="text-slate-500 text-sm">From ticker to insight in under a minute.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="relative">
              <div className="text-5xl font-black text-slate-100 mb-3 leading-none select-none">{item.step}</div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust points */}
      <section className="bg-white border-y border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Built on rigorous methodology</h2>
            <p className="text-slate-500 text-sm">Transparent assumptions. Verified sources. No guesswork.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {TRUST_POINTS.map((point) => (
              <div key={point.label} className="flex gap-4">
                <div className="mt-0.5 shrink-0 w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
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
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Ready to analyze your first stock?</h2>
        <p className="text-slate-500 text-sm mb-8">No account needed. Just enter a ticker and start.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {EXAMPLE_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => router.push(`/stock/${t}`)}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition-colors font-mono"
            >
              Analyze {t}
            </button>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-center">
        <p className="text-xs text-slate-400">
          Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research.
          This is a research tool, not financial advice.
        </p>
      </footer>
    </div>
  )
}
