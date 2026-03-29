'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import MarketMonitor from '@/components/home/MarketMonitor'
import MorningBrief from '@/components/home/MorningBrief'
import Portfolio from '@/components/home/Portfolio'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

const TABS = [
  { id: 'brief',     label: 'Morning Brief' },
  { id: 'monitor',   label: 'Market Monitor' },
  { id: 'portfolio', label: 'Portfolio' },
]

function StockSearchHero() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
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
    <div className="bg-gradient-to-br from-primary to-primary-container px-6 py-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-extrabold text-on-primary mb-1 tracking-tight">
          Analyze any stock
        </h1>
        <p className="text-sm text-on-primary-container opacity-80 mb-5">
          DCF valuation · WACC · Factor scores · Trading signals
        </p>

        <div className="relative" ref={containerRef}>
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 focus-within:bg-white/15 transition-colors">
            <svg className="h-5 w-5 text-on-primary-container shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter ticker or company name…"
              className="flex-1 bg-transparent text-base text-on-primary placeholder-on-primary-container/60 focus:outline-none"
            />
            {loading
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary-container/30 border-t-on-primary shrink-0" />
              : (
                <button
                  onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
                  className="rounded-xl bg-on-primary/10 hover:bg-on-primary/20 px-4 py-1.5 text-sm font-bold text-on-primary transition-colors shrink-0"
                >
                  Search
                </button>
              )
            }
          </div>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(0,27,68,0.2)] border border-outline-variant/20 z-50">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors"
                >
                  <span className="text-sm font-bold text-primary font-headline w-16 shrink-0">{r.symbol}</span>
                  <span className="text-sm text-on-surface-variant truncate">{r.longname ?? r.shortname}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-on-primary-container opacity-50">
          Try: AAPL · GOOGL · NVDA · GGAL · YPF · MELI
        </p>
      </div>
    </div>
  )
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get('tab') ?? 'brief'

  return (
    <div className="min-h-screen bg-background text-on-background">
      <StockSearchHero />

      {/* Tab bar */}
      <div className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant/15">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/?tab=${t.id}`)}
                className={[
                  'relative px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'text-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                ].join(' ')}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {tab === 'brief'     && <MorningBrief />}
        {tab === 'monitor'   && <MarketMonitor />}
        {tab === 'portfolio' && <Portfolio />}
      </main>

      <footer className="border-t border-outline-variant/20 px-6 py-8 mt-12">
        <div className="mx-auto max-w-7xl flex flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-on-surface-variant/50">Educational use only — not investment advice.</p>
          <p className="text-xs text-on-surface-variant/50">Data via Yahoo Finance · RF rate via FRED · Methodology: Damodaran</p>
        </div>
      </footer>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  )
}
