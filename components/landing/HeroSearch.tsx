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

interface Props {
  dark?: boolean
}

export default function HeroSearch({ dark = false }: Props) {
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
      <div ref={containerRef} className="relative w-full" style={{ maxWidth: '520px' }}>
        <div
          className="flex items-center gap-3 rounded-[14px] border transition-all"
          style={{
            height: '56px',
            padding: '0 16px',
            background: dark
              ? 'rgba(10,22,40,0.65)'
              : '#FFFFFF',
            backdropFilter: dark ? 'blur(20px)' : undefined,
            WebkitBackdropFilter: dark ? 'blur(20px)' : undefined,
            borderColor: open
              ? (dark ? 'rgba(96,165,250,0.55)' : '#93C5FD')
              : (dark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'),
            boxShadow: open
              ? `0 0 0 3px rgba(37,99,235,0.12), 0 2px 8px rgba(15,23,42,0.${dark ? '20' : '06'})`
              : `0 1px 3px rgba(15,23,42,0.${dark ? '18' : '06'}), 0 1px 2px rgba(15,23,42,0.04)`,
          }}
        >
          {loading ? (
            <div className="h-4 w-4 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin shrink-0" />
          ) : (
            <Search size={18} className={dark ? 'text-slate-500 shrink-0' : 'text-slate-400 shrink-0'} />
          )}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase()) }}
            placeholder="Search any ticker — NVDA, AAPL, MELI..."
            className={`flex-1 bg-transparent text-base focus:outline-none ${
              dark
                ? 'text-slate-100 placeholder-slate-500'
                : 'text-slate-800 placeholder-slate-400'
            }`}
            style={{ fontWeight: 500, fontSize: '16px' }}
            aria-label="Search for a stock ticker"
          />
          <button
            onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
            className="shrink-0 rounded-[10px] px-4 py-2.5 text-[13px] font-bold text-white transition-all hover:-translate-y-px active:scale-95"
            style={{
              background: '#2563EB',
              boxShadow: '0 3px 10px rgba(37,99,235,0.28)',
              fontWeight: 650,
              minHeight: '36px',
            }}
            aria-label="Analyze stock"
          >
            Analyze
          </button>
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-2 rounded-xl border overflow-hidden z-50"
            style={{
              background: dark ? 'rgba(10,22,40,0.95)' : '#FFFFFF',
              backdropFilter: dark ? 'blur(20px)' : undefined,
              borderColor: dark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
              boxShadow: '0 16px 40px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)',
            }}
            role="listbox"
          >
            {results.map(r => (
              <button
                key={r.symbol}
                onClick={() => select(r.symbol)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left border-b last:border-b-0 transition-colors active:scale-95 ${
                  dark
                    ? 'border-white/[0.07] hover:bg-white/[0.05]'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
                role="option"
                style={{ minHeight: '44px' }}
              >
                <span className={`text-[14px] font-bold font-mono w-14 shrink-0 ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {r.symbol}
                </span>
                <span className={`text-[13px] truncate flex-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {r.longname ?? r.shortname}
                </span>
                {r.exchange && (
                  <span className={`shrink-0 text-[10px] font-medium uppercase ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                    {r.exchange}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticker chips */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className={`text-[12px] font-medium ${dark ? 'text-slate-400' : 'text-slate-400'}`}>Try:</span>
        {TICKER_CHIPS.map(t => (
          <Link
            key={t.symbol}
            href={`/stock/${t.symbol}`}
            className={`inline-flex items-center rounded-full border px-3 py-2 text-[12px] font-bold transition-all hover:border-blue-400 hover:text-blue-400 active:scale-95 ${
              dark
                ? 'border-white/[0.14] text-slate-400 hover:bg-blue-500/10'
                : 'border-slate-200 text-slate-600 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
            }`}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontVariantNumeric: 'tabular-nums',
              minHeight: '36px',
              background: dark ? 'rgba(255,255,255,0.04)' : undefined,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Trust bullets */}
      <div className="mt-5 flex items-center gap-5 flex-wrap">
        {TRUST_BULLETS.map(b => (
          <span key={b} className={`flex items-center gap-1.5 text-[13px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: '16px',
                height: '16px',
                background: dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF',
              }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 5l2.5 2.5 3.5-4" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {b}
          </span>
        ))}
      </div>
    </div>
  )
}
