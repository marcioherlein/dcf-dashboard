'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchange?: string
  quoteType?: string
}

const TICKER_CHIPS = [
  { symbol: 'NVDA', label: 'NVDA' },
  { symbol: 'AAPL', label: 'AAPL' },
  { symbol: 'MSFT', label: 'MSFT' },
  { symbol: 'AMZN', label: 'AMZN' },
  { symbol: 'MELI', label: 'MELI' },
]

const TRUST_BULLETS = [
  'No signup required',
  'Results in seconds',
  'Intrinsic value + Reverse DCF',
]

export default function HeroSearch() {
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
    <div>
      {/* Search bar */}
      <div ref={containerRef} className="relative" style={{ maxWidth: '520px' }}>
        <div
          className="flex items-center gap-3 rounded-[14px] border bg-white transition-all"
          style={{
            height: '56px',
            padding: '0 16px',
            borderColor: open ? '#93C5FD' : '#CBD5E1',
            boxShadow: open
              ? '0 0 0 3px rgba(37,99,235,0.1), 0 2px 8px rgba(15,23,42,0.06)'
              : '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          {loading ? (
            <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin shrink-0" />
          ) : (
            <Search size={18} className="text-slate-400 shrink-0" />
          )}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase()) }}
            placeholder="Search any ticker — NVDA, AAPL, MELI..."
            className="flex-1 bg-transparent text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none"
            style={{ fontWeight: 500 }}
            aria-label="Search for a stock ticker"
          />
          <button
            onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
            className="shrink-0 rounded-[10px] px-4 py-2 text-[13px] font-bold text-white transition-all hover:-translate-y-px active:translate-y-0"
            style={{
              background: '#2563EB',
              boxShadow: '0 3px 10px rgba(37,99,235,0.28)',
              fontWeight: 650,
            }}
            aria-label="Analyze stock"
          >
            Analyze
          </button>
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-slate-200 overflow-hidden z-50"
            style={{ boxShadow: '0 16px 40px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)' }}
            role="listbox"
          >
            {results.map(r => (
              <button
                key={r.symbol}
                onClick={() => select(r.symbol)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                role="option"
              >
                <span className="text-[14px] font-bold text-slate-800 font-mono w-14 shrink-0">{r.symbol}</span>
                <span className="text-[13px] text-slate-500 truncate flex-1">{r.longname ?? r.shortname}</span>
                {r.exchange && (
                  <span className="shrink-0 text-[10px] font-medium text-slate-400 uppercase">{r.exchange}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticker chips */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-slate-400 font-medium">Try:</span>
        {TICKER_CHIPS.map(t => (
          <Link
            key={t.symbol}
            href={`/stock/${t.symbol}`}
            className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-bold text-slate-600 transition-all hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
            style={{
              borderColor: '#E2E8F0',
              background: 'white',
              fontFamily: 'var(--font-mono, monospace)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Trust bullets */}
      <div className="mt-5 flex items-center gap-5 flex-wrap">
        {TRUST_BULLETS.map(b => (
          <span key={b} className="flex items-center gap-1.5 text-[13px] text-slate-500">
            <span
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: '16px', height: '16px', background: '#EFF6FF' }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 5l2.5 2.5 3.5-4" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {b}
          </span>
        ))}
      </div>
    </div>
  )
}
