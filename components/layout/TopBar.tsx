'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { slideDown } from '@/lib/motion'

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
  const router   = useRouter()
  const { data: session } = useSession()

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const reduced = useReducedMotion()
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)

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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
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
    <header
      className="fixed top-0 left-0 right-0 z-40 glass-toolbar flex items-center px-4 gap-3"
      style={{ height: '52px' }}
    >

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-[30px] h-[30px] rounded-full overflow-hidden shrink-0">
          <Image src="/logos/logo.png" alt="Intrinsico" width={30} height={30} className="w-full h-full object-cover" />
        </div>
        <span className="font-bold text-slate-900 text-sm tracking-tight hidden sm:block" style={{ letterSpacing: '-0.02em' }}>
          Intrinsico
        </span>
      </Link>

      {/* Search */}
      <div className="relative flex-1 min-w-0 max-w-full lg:max-w-xs" ref={searchRef}>
        <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all border"
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="SEARCH TICKERS…"
            className="flex-1 min-w-0 bg-transparent text-[16px] lg:text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none uppercase font-mono tracking-wide"
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
              className="absolute left-0 right-0 top-full mt-1 overflow-hidden glass-card-light rounded-xl z-50 max-h-[70vh] overflow-y-auto"
            >
              <motion.div
                variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
                initial="hidden"
                animate="visible"
              >
                {results.map((r) => (
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

      {/* Right: clock + auth */}
      <div className="ml-auto flex items-center gap-3 pl-2">
        <LiveClock />

        {session ? (
          <div className="flex items-center gap-2">
            <UserAvatar
              image={session.user?.image ?? null}
              name={session.user?.name ?? null}
            />
            <span className="text-[12px] text-slate-600 hidden sm:block">
              Hi {session.user?.name?.split(' ')[0]}
            </span>
            <button
              onClick={() => signOut()}
              className="text-[12px] text-slate-400 hover:text-slate-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => signIn('google')}
              className="text-[12px] text-white px-3 py-1.5 rounded-lg transition-all font-semibold bg-blue-600 hover:bg-blue-500 shadow-sm whitespace-nowrap"
            >
              Start free trial
            </button>
            <button
              onClick={() => signIn('google')}
              className="text-[12px] text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap hidden sm:block"
            >
              Sign in
            </button>
          </div>
        )}
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
    <span className="font-mono text-[11px] text-slate-400 tabular-nums tracking-wider hidden sm:block">{time}</span>
  )
}
