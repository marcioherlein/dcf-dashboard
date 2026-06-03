'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1] as const

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

export default function FinalCTASection() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); setFetchError(false); return }
    clearTimeout(debounce.current)
    setFetchError(false)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setOpen(d.length > 0); setLoading(false) })
        .catch(() => { setLoading(false); setResults([]); setFetchError(true) })
    }, 300)
    return () => clearTimeout(debounce.current)
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!open) setActiveIndex(-1)
  }, [open])

  const select = (symbol: string) => {
    setOpen(false); setQuery('')
    router.push(`/stock/${symbol}`)
  }

  return (
    <section ref={sectionRef} className="overflow-x-hidden" style={{ background: 'white', borderBottom: '1px solid #E2E8F0' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">
        <motion.div
          className="rounded-[24px] text-center px-5 sm:px-8 py-10 sm:py-14"
          initial={reduced !== false ? {} : { opacity: 0, scale: 0.92, y: 28 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.70, ease: EASE }}
          style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #EFF6FF 100%)',
            border: '1px solid #BFDBFE',
            boxShadow: '0 1px 2px rgba(37,99,235,0.05), 0 12px 40px rgba(37,99,235,0.10)',
          }}
        >
          <h2
            className="text-[26px] sm:text-[36px] lg:text-[clamp(28px,3vw,42px)]"
            style={{
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#0F172A',
              marginBottom: '14px',
            }}
          >
            Ready to know what a stock is really worth?
          </h2>
          <p className="text-base sm:text-[17px]" style={{ color: '#475569', lineHeight: 1.55, marginBottom: '28px' }}>
            Type any ticker. See fair value, implied growth, and a verdict — in seconds.
          </p>

          {/* Search */}
          <div ref={containerRef} className="relative mx-auto w-full" style={{ maxWidth: '480px' }}>
            <div
              className="flex items-center gap-3 rounded-[14px] border bg-white transition-all"
              style={{
                height: '56px',
                padding: '0 16px',
                borderColor: open ? '#93C5FD' : '#CBD5E1',
                boxShadow: open
                  ? '0 0 0 3px rgba(37,99,235,0.10), 0 2px 8px rgba(15,23,42,0.06)'
                  : '0 2px 8px rgba(15,23,42,0.08)',
              }}
            >
              {loading
                ? <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin shrink-0" />
                : <Search size={18} className="text-slate-400 shrink-0" />
              }
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setFetchError(false) }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (open && results.length > 0) setActiveIndex(i => Math.min(i + 1, results.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex(i => Math.max(i - 1, -1))
                  } else if (e.key === 'Escape') {
                    setOpen(false)
                  } else if (e.key === 'Enter') {
                    if (activeIndex >= 0 && results[activeIndex]) select(results[activeIndex].symbol)
                    else if (query.trim()) select(query.trim().toUpperCase())
                  }
                }}
                placeholder="Search any ticker — NVDA, AAPL, MELI..."
                className="flex-1 bg-transparent text-base text-slate-800 placeholder-slate-400 focus:outline-none"
                style={{ fontWeight: 500, fontSize: '16px' }}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls="cta-search-listbox"
                aria-activedescendant={activeIndex >= 0 ? `cta-search-opt-${activeIndex}` : undefined}
                aria-label="Search for a stock ticker"
              />
              <button
                onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
                className="shrink-0 rounded-[10px] px-4 py-2.5 text-[13px] font-bold text-white transition-all hover:-translate-y-px active:scale-95"
                style={{
                  background: '#2563EB',
                  boxShadow: '0 3px 10px rgba(37,99,235,0.28)',
                  minHeight: '36px',
                }}
                aria-label="Analyze stock"
              >
                <Search size={16} />
              </button>
            </div>

            {open && results.length > 0 && (
              <div
                id="cta-search-listbox"
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-slate-200 overflow-hidden z-50 text-left"
                style={{ boxShadow: '0 16px 40px rgba(15,23,42,0.12)' }}
                role="listbox"
              >
                {results.map((r, i) => (
                  <button
                    key={r.symbol}
                    id={`cta-search-opt-${i}`}
                    onClick={() => select(r.symbol)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors active:scale-95"
                    role="option"
                    aria-selected={i === activeIndex}
                    style={{
                      minHeight: '44px',
                      backgroundColor: i === activeIndex ? '#EFF6FF' : undefined,
                    }}
                  >
                    <span className="text-[14px] font-bold text-slate-800 w-14 shrink-0">{r.symbol}</span>
                    <span className="text-[13px] text-slate-500 truncate">{r.longname ?? r.shortname}</span>
                  </button>
                ))}
              </div>
            )}

            {fetchError && !open && (
              <div
                className="absolute left-0 right-0 top-full mt-2 bg-red-50 rounded-xl border border-red-200 px-4 py-2.5 z-50 flex items-center gap-2"
                role="alert"
                style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}
              >
                <svg className="w-3.5 h-3.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M12 16h.01" />
                </svg>
                <p className="text-[13px] text-red-600 leading-snug">Search unavailable. Please try again.</p>
              </div>
            )}
          </div>

          {/* Trust bullets */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 flex-wrap">
            {['No signup required', 'Results in seconds', 'Cancel anytime'].map(b => (
              <span key={b} className="flex items-center gap-1.5 text-sm text-slate-500">
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
        </motion.div>
      </div>
    </section>
  )
}
