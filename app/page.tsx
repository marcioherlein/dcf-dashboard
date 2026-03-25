'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MarketMonitor from '@/components/home/MarketMonitor'
import MorningBrief from '@/components/home/MorningBrief'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchDisp?: string
}


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

      {/* ── Market Monitor ────────────────────────────────────────────────── */}
      <MarketMonitor />

      {/* ── Morning Brief ─────────────────────────────────────────────────── */}
      <MorningBrief />

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
