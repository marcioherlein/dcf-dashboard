'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { slideDown } from '@/lib/motion'

const TOPBAR_TICKER = [
  { sym: 'S&P 500',  val: '5,841.47',  chg: '+0.62%', up: true  },
  { sym: 'NASDAQ',   val: '18,983.54', chg: '+0.89%', up: true  },
  { sym: 'DOW',      val: '43,155.12', chg: '+0.47%', up: true  },
  { sym: 'VIX',      val: '14.23',     chg: '−3.21%', up: false },
  { sym: 'NVDA',     val: '119.83',    chg: '+2.14%', up: true  },
  { sym: 'AAPL',     val: '195.64',    chg: '−0.28%', up: false },
  { sym: 'MSFT',     val: '421.45',    chg: '+0.83%', up: true  },
  { sym: 'AMZN',     val: '189.22',    chg: '+1.17%', up: true  },
  { sym: 'META',     val: '561.78',    chg: '+0.54%', up: true  },
  { sym: 'TSLA',     val: '268.45',    chg: '−0.91%', up: false },
  { sym: 'GOOGL',    val: '178.33',    chg: '+0.41%', up: true  },
  { sym: 'JPM',      val: '248.90',    chg: '+0.31%', up: true  },
  { sym: '10Y UST',  val: '4.28%',     chg: '−2bp',   up: false },
  { sym: 'GS',       val: '538.12',    chg: '+0.22%', up: true  },
  { sym: 'AMD',      val: '115.22',    chg: '+1.82%', up: true  },
  { sym: 'UNH',      val: '329.45',    chg: '−1.14%', up: false },
]

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchange?: string
  quoteType?: string
}

function UserAvatar({ image, name }: { image: string | null; name: string | null }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? ''}
        width={26}
        height={26}
        className="rounded-full ring-2 ring-blue-200 shrink-0"
      />
    )
  }

  return (
    <div
      className="w-[26px] h-[26px] rounded-full ring-2 ring-blue-200 bg-blue-600 flex items-center justify-center shrink-0"
      aria-label={name ?? undefined}
    >
      <span className="text-[10px] font-bold text-white leading-none">{initials}</span>
    </div>
  )
}

export default function TopBar() {
  const router = useRouter()
  const { data: session } = useSession()

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const reduced   = useReducedMotion()
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)

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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (symbol: string) => {
    setOpen(false); setQuery('')
    router.push(`/stock/${symbol}`)
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 glass-toolbar"
      style={{ height: '52px' }}
    >
      {/* ── Ambient scrolling market ticker ───────────────────────────────── */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none select-none"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        <div className="animate-marquee h-full items-center">
          {[0, 1].map((copy) =>
            TOPBAR_TICKER.map((d) => (
              <span
                key={`${d.sym}-${copy}`}
                className="inline-flex items-baseline gap-1 mx-6 opacity-[0.14]"
              >
                <span className="text-[9px] font-bold font-mono tracking-widest text-slate-500 uppercase">
                  {d.sym}
                </span>
                <span className={`text-[9px] font-semibold font-mono tabular-nums ${d.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {d.up ? '▲' : '▼'} {d.val}
                </span>
                <span className={`text-[8px] font-mono tabular-nums ${d.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {d.chg}
                </span>
              </span>
            ))
          )}
        </div>
        {/* Soft fade at edges to blend with glass toolbar */}
        <div className="absolute inset-y-0 left-0 w-40 pointer-events-none"
          style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.70) 60%, transparent 100%)' }} />
        <div className="absolute inset-y-0 right-0 w-40 pointer-events-none"
          style={{ background: 'linear-gradient(to left, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.70) 60%, transparent 100%)' }} />
      </div>

      {/* Three-column grid: logo | Intrinsico (center) | search + auth */}
      <div
        className="relative h-full px-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
          alignItems: 'center',
          gap: '12px',
          zIndex: 1,
        }}
      >
        {/* ── Column 1: Logo icon ── */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/logos/logo.png"
              alt="Intrinsico"
              width={28}
              height={28}
              className="shrink-0"
            />
          </Link>
        </div>

        {/* ── Column 2: Brand wordmark (centered) ── */}
        <Link href="/" className="flex items-center justify-center">
          <span
            className="font-black whitespace-nowrap"
            style={{
              fontSize: '17px',
              letterSpacing: '-0.04em',
              background: 'linear-gradient(135deg, #0F172A 20%, #1E40AF 65%, #2563EB 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Intrinsico
          </span>
        </Link>

        {/* ── Column 3: Search + clock + auth (right-aligned) ── */}
        <div className="flex items-center gap-3 justify-end min-w-0">

          {/* Search */}
          <div className="relative" ref={searchRef} style={{ width: '220px' }}>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all border"
              style={{
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderColor: open ? 'rgba(99,102,241,0.35)' : 'rgba(148,163,184,0.35)',
                boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
              }}
            >
              {loading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 shrink-0" />
              ) : (
                <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
                </svg>
              )}
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase()) }}
                placeholder="Search tickers…"
                className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>

            <AnimatePresence>
              {open && (
                <motion.div
                  key="search-dropdown"
                  variants={reduced ? {} : slideDown}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ originY: 0 }}
                  className="absolute right-0 top-full mt-1 w-[300px] overflow-hidden glass-card-light rounded-xl z-50 max-h-[70vh] overflow-y-auto"
                >
                  <motion.div
                    variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
                    initial="hidden"
                    animate="visible"
                  >
                    {results.map(r => (
                      <motion.button
                        key={r.symbol}
                        variants={reduced ? {} : { hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0, transition: { duration: 0.18 } } }}
                        onClick={() => select(r.symbol)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[14px] font-bold text-slate-800 font-mono">{r.symbol}</span>
                            {r.exchange && (
                              <span className="text-[10px] text-slate-400 font-medium uppercase">{r.exchange}</span>
                            )}
                          </div>
                          <span className="text-[12px] text-slate-500 truncate block">{r.longname ?? r.shortname}</span>
                        </div>
                        {r.quoteType && (
                          <span className="shrink-0 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                            {r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType === 'INDEX' ? 'Index' : r.quoteType}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <LiveClock />

          {session ? (
            <div className="flex items-center gap-2 shrink-0">
              <UserAvatar
                image={session.user?.image ?? null}
                name={session.user?.name ?? null}
              />
              <span className="text-[12px] text-slate-600 hidden md:block whitespace-nowrap">
                Hi {session.user?.name?.split(' ')[0]}
              </span>
              <button
                onClick={() => signOut()}
                className="text-[12px] text-slate-400 hover:text-slate-700 transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => signIn('google')}
                className="text-[12px] text-white px-3 py-1.5 rounded-lg transition-all font-semibold bg-blue-600 hover:bg-blue-500 shadow-sm whitespace-nowrap"
              >
                Start free trial
              </button>
              <button
                onClick={() => signIn('google')}
                className="text-[12px] text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap hidden md:block"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function LiveClock() {
  const [time, setTime] = useState<string>('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-[11px] text-slate-400 tabular-nums tracking-wider hidden lg:block whitespace-nowrap">{time}</span>
  )
}
