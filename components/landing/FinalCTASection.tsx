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
    <section ref={sectionRef} className="overflow-x-hidden" style={{ background: '#F8F7F2', borderBottom: '1px solid #E3E6E0' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">
        <motion.div
          className="rounded-[20px] text-center px-5 sm:px-8 py-10 sm:py-14"
          initial={reduced !== false ? {} : { opacity: 0, scale: 0.92, y: 28 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.70, ease: EASE }}
          style={{
            background: '#0A1424',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 16px 48px rgba(6, 16, 31, 0.24)',
          }}
        >
          <h2
            className="text-[26px] sm:text-[36px] lg:text-[clamp(28px,3vw,42px)]"
            style={{
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#F8F7F2',
              marginBottom: '14px',
            }}
          >
            Know what has to be true before you buy.
          </h2>
          <p className="text-base sm:text-[17px]" style={{ color: '#8A96A8', lineHeight: 1.55, marginBottom: '28px' }}>
            A first-pass valuation in seconds. Go deeper when it matters.
          </p>

          {/* Search */}
          <div ref={containerRef} className="relative mx-auto w-full" style={{ maxWidth: '480px' }}>
            <div
              className="flex items-center gap-3 rounded-[14px] border bg-[#111C2E] transition-all"
              style={{
                height: '56px',
                padding: '0 16px',
                borderColor: open ? 'rgba(95,121,11,0.55)' : 'rgba(255,255,255,0.10)',
                boxShadow: open
                  ? '0 0 0 3px rgba(95,121,11,0.12), 0 2px 8px rgba(6,16,31,0.18)'
                  : '0 2px 8px rgba(6,16,31,0.14)',
              }}
            >
              {loading
                ? <div className="h-4 w-4 rounded-full border-2 border-[#8A96A8] border-t-[#7C9A19] animate-spin shrink-0" />
                : <Search size={18} className="text-[#8A96A8] shrink-0" />
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
                className="flex-1 bg-transparent text-[16px] text-[#F8F7F2] placeholder-[#536174] focus:outline-none"
                style={{ fontWeight: 500 }}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls="cta-search-listbox"
                aria-activedescendant={activeIndex >= 0 ? `cta-search-opt-${activeIndex}` : undefined}
                aria-label="Search for a stock ticker"
              />
              <button
                onClick={() => { if (query.trim()) select(query.trim().toUpperCase()) }}
                className="shrink-0 rounded-[10px] px-4 text-[13px] font-bold text-white transition-all hover:-translate-y-px active:scale-95 flex items-center gap-1.5"
                style={{
                  background: '#5F790B',
                  boxShadow: '0 3px 10px rgba(95,121,11,0.28)',
                  minHeight: '44px',
                }}
                aria-label="Analyze stock"
              >
                Analyze →
              </button>
            </div>

            {open && results.length > 0 && (
              <div
                id="cta-search-listbox"
                className="absolute left-0 right-0 top-full mt-2 bg-[#111C2E] rounded-xl border border-[rgba(255,255,255,0.10)] overflow-hidden z-50 text-left"
                style={{ boxShadow: '0 16px 40px rgba(6,16,31,0.28)' }}
                role="listbox"
              >
                {results.map((r, i) => (
                  <button
                    key={r.symbol}
                    id={`cta-search-opt-${i}`}
                    onClick={() => select(r.symbol)}
                    className="flex w-full items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0 transition-colors active:scale-95"
                    role="option"
                    aria-selected={i === activeIndex}
                    style={{
                      minHeight: '44px',
                      backgroundColor: i === activeIndex ? 'rgba(95,121,11,0.15)' : undefined,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(95,121,11,0.10)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = i === activeIndex ? 'rgba(95,121,11,0.15)' : 'transparent' }}
                  >
                    <span className="text-[14px] font-bold text-[#F8F7F2] w-14 shrink-0">{r.symbol}</span>
                    <span className="text-[13px] text-[#8A96A8] truncate">{r.longname ?? r.shortname}</span>
                  </button>
                ))}
              </div>
            )}

            {fetchError && !open && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[#F0B8B8] bg-[#FCEAEA] px-4 py-2.5 z-50 flex items-center gap-2"
                role="alert"
                style={{ boxShadow: '0 4px 12px rgba(6,16,31,0.08)' }}
              >
                <svg className="w-3.5 h-3.5 shrink-0 text-[#D83B3B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M12 16h.01" />
                </svg>
                <p className="text-[13px] text-[#D83B3B] leading-snug">Search unavailable. Please try again.</p>
              </div>
            )}
          </div>

          {/* Trust bullets */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 flex-wrap">
            {['No signup required', 'Results in seconds', 'Cancel anytime'].map(b => (
              <span key={b} className="flex items-center gap-1.5 text-[13px] text-[#8A96A8]">
                <span
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: '16px', height: '16px', background: 'rgba(95,121,11,0.20)' }}
                >
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="#7C9A19" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
