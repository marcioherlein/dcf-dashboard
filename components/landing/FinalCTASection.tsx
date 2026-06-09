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
  const [noResults, setNoResults] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    if (query.length < 1) {
      setResults([])
      setOpen(false)
      setFetchError(false)
      setNoResults(false)
      return
    }
    clearTimeout(debounce.current)
    setFetchError(false)
    setNoResults(false)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((d: SearchResult[]) => {
          setResults(d)
          setLoading(false)
          if (d.length > 0) {
            setOpen(true)
            setNoResults(false)
          } else {
            setOpen(false)
            setNoResults(true)
          }
        })
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
    setOpen(false); setQuery(''); setNoResults(false)
    router.push(`/stock/${symbol}`)
  }

  const handleSubmit = () => {
    const trimmed = query.trim().toUpperCase()
    if (!trimmed) return
    // If there are results and one is active, navigate to it
    if (activeIndex >= 0 && results[activeIndex]) {
      select(results[activeIndex].symbol)
      return
    }
    // If results loaded and have content, navigate to the first match or exact match
    const exact = results.find(r => r.symbol === trimmed)
    if (exact) { select(exact.symbol); return }
    if (results.length > 0) { select(results[0].symbol); return }
    // No results loaded yet — navigate only if it looks like a valid ticker format
    // (1–5 uppercase letters/digits). Show error for company names or invalid formats.
    if (/^[A-Z0-9]{1,5}$/.test(trimmed)) {
      select(trimmed)
    } else {
      setNoResults(true)
    }
  }

  return (
    <section
      ref={sectionRef}
      className="overflow-x-hidden"
      style={{
        background: '#000000',
        paddingBottom: 'max(64px, calc(64px + env(safe-area-inset-bottom, 0px)))',
      }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">
        <motion.div
          className="rounded-2xl text-center px-5 sm:px-8 py-10 sm:py-14 pb-10 sm:pb-14"
          initial={reduced !== false ? {} : { opacity: 0, y: 32, filter: 'blur(8px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.65, ease: EASE }}
          style={{
            background: '#111111',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 0 0 1px rgba(95,121,11,0.08), 0 16px 48px rgba(0,0,0,0.4)',
          }}
        >
          <h2
            className="text-[26px] sm:text-[36px] lg:text-[clamp(28px,3vw,42px)]"
            style={{
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              marginBottom: '14px',
            }}
          >
            Know what has to be true before you buy.
          </h2>
          <p className="text-base sm:text-[17px]" style={{ color: 'rgba(255,255,255,0.60)', lineHeight: 1.55, marginBottom: '28px' }}>
            A first-pass valuation in seconds. Go deeper when it matters.
          </p>

          {/* Search */}
          <motion.div
            initial={reduced !== false ? {} : { opacity: 0, scale: 0.96 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
          >
          <div ref={containerRef} className="relative mx-auto w-full" style={{ maxWidth: '480px' }}>
            <div
              className="flex items-center gap-3 rounded-xl border bg-[#1C1C1C] transition-all"
              style={{
                height: '56px',
                padding: '0 16px',
                borderColor: open ? 'rgba(95,121,11,0.55)' : noResults ? 'rgba(184,69,69,0.45)' : 'rgba(255,255,255,0.10)',
                boxShadow: open
                  ? '0 0 0 3px rgba(95,121,11,0.12), 0 2px 8px rgba(0,0,0,0.18)'
                  : '0 2px 8px rgba(0,0,0,0.14)',
              }}
            >
              {loading
                ? <div className="flex items-center gap-1.5 shrink-0">
                    <div className="h-4 w-4 rounded-full border-2 border-[#9B9B9B] border-t-[#7C9A19] motion-safe:animate-spin" />
                    <span className="text-[11px] text-[#9B9B9B] hidden sm:block">Searching…</span>
                  </div>
                : <Search size={18} className="text-[#9B9B9B] shrink-0" />
              }
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setFetchError(false); setNoResults(false) }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (open && results.length > 0) setActiveIndex(i => Math.min(i + 1, results.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex(i => Math.max(i - 1, -1))
                  } else if (e.key === 'Escape') {
                    setOpen(false); setNoResults(false); setActiveIndex(-1)
                  } else if (e.key === 'Enter') {
                    handleSubmit()
                  }
                }}
                placeholder="US ticker (NYSE/NASDAQ) — NVDA, AAPL, MELI…"
                className="flex-1 bg-transparent text-[16px] text-[#FFFFFF] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#7C9A19] focus:ring-inset focus:rounded-sm"
                style={{ fontWeight: 500 }}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls="cta-search-listbox"
                aria-activedescendant={activeIndex >= 0 ? `cta-search-opt-${activeIndex}` : undefined}
                aria-label="Search for a stock ticker"
              />
              <button
                onClick={handleSubmit}
                className="shrink-0 rounded-md px-4 text-[13px] font-bold text-white transition-all hover:-translate-y-px active:scale-95 flex items-center gap-1.5"
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

            {/* Search results dropdown */}
            {open && results.length > 0 && (
              <div
                id="cta-search-listbox"
                className="absolute left-0 right-0 top-full mt-2 bg-[#1C1C1C] rounded-xl border border-[rgba(255,255,255,0.10)] overflow-hidden z-50 text-left"
                style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.28)' }}
                role="listbox"
              aria-label="Search results. Use arrow keys to navigate, Enter to select."
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
                    <span className="text-[14px] font-bold text-[#FFFFFF] w-14 shrink-0">{r.symbol}</span>
                    <span className="text-[13px] text-[#6B6B6B] truncate">{r.longname ?? r.shortname}</span>
                  </button>
                ))}
              </div>
            )}

            {/* No results state */}
            {noResults && !open && !fetchError && query.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1C1C1C] px-4 py-3 z-50 text-left"
                role="status"
                aria-live="polite"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.24)' }}
              >
                <p className="text-[13px] text-[#6B6B6B] leading-snug">
                  No results for &ldquo;{query}&rdquo;.{' '}
                  <span className="text-[#C4C4C4]">Try NVDA, AAPL, or MELI.</span>
                </p>
                <p className="text-[11px] text-[#6B6B6B] mt-1">insic covers NYSE and NASDAQ-listed stocks. Use the ticker symbol (1–5 letters).</p>
              </div>
            )}

            {/* Fetch error state */}
            {fetchError && !open && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[#F0B8B8] bg-[#FCEAEA] px-4 py-2.5 z-50 flex items-center gap-2"
                role="alert"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              >
                <svg className="w-3.5 h-3.5 shrink-0 text-[#C41E1E]" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M12 16h.01" />
                </svg>
                <p className="text-[13px] text-[#C41E1E] leading-snug">Search unavailable. Please try again.</p>
              </div>
            )}
          </div>
          </motion.div>

          {/* Trust bullets */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 flex-wrap">
            {['Free to analyze', 'No credit card required', 'Results in seconds'].map(b => (
              <span key={b} className="flex items-center gap-1.5 text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
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
