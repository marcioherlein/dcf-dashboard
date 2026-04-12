'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import MarketMonitor from '@/components/home/MarketMonitor'
import Portfolio from '@/components/home/Portfolio'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

const TABS = [
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
    <div className="bg-[#0d1117] border-b border-[#21262d] px-6 py-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-mono text-xl font-bold text-[#e6edf3] mb-1 tracking-tight uppercase">
          Analyze any stock
        </h1>
        <p className="font-mono text-xs text-[#8b949e] mb-5 uppercase tracking-widest">
          DCF · WACC · Factor Scores · Trading Signals
        </p>

        <div className="relative" ref={containerRef}>
          <div className="flex items-center gap-3 rounded bg-[#161b22] border border-[#30363d] px-4 py-2.5 focus-within:border-[#ff6600] transition-colors">
            <svg className="h-4 w-4 text-[#6e7681] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter ticker or company name…"
              className="flex-1 bg-transparent font-mono text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none uppercase"
            />
            {loading
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#30363d] border-t-[#ff6600] shrink-0" />
              : (
                <button
                  onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
                  className="rounded bg-[#ff6600] hover:bg-[#e55a00] px-3 py-1 font-mono text-xs font-bold text-black transition-colors shrink-0"
                >
                  Search
                </button>
              )
            }
          </div>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded bg-[#161b22] border border-[#30363d] shadow-xl z-50">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#21262d] transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-[#ff6600] w-16 shrink-0">{r.symbol}</span>
                  <span className="font-mono text-xs text-[#8b949e] truncate">{r.longname ?? r.shortname}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 font-mono text-[10px] text-[#484f58] uppercase tracking-widest">
          Try: AAPL · NVDA · GOOGL · MELI · GGAL · YPF
        </p>
      </div>
    </div>
  )
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get('tab') ?? 'monitor'

  return (
    <div className="min-h-screen bg-[#080808] text-[#e6edf3]">
      <StockSearchHero />

      {/* Tab bar */}
      <div className="sticky top-12 z-30 bg-[#0d1117] border-b border-[#21262d]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/?tab=${t.id}`)}
                className={[
                  'relative px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'text-[#ff6600]'
                    : 'text-[#8b949e] hover:text-[#e6edf3]',
                ].join(' ')}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff6600]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main>
        {tab === 'monitor'   && <MarketMonitor />}
        {tab === 'portfolio' && <div className="mx-auto max-w-7xl px-6 py-8"><Portfolio /></div>}
      </main>
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
