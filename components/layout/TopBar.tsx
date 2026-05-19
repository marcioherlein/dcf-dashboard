'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchange?: string
  quoteType?: string
}



export default function TopBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { data: session } = useSession()

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
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
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm" style={{ height: '52px' }}>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#0F2A5E' }}>
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        </div>
        <span className="font-bold text-slate-900 text-sm tracking-tight hidden sm:block" style={{ letterSpacing: '-0.02em' }}>Clairo</span>
      </Link>

      {/* Primary nav — hidden on mobile, bottom nav handles navigation there */}
      <nav className="hidden lg:flex items-center gap-0.5 shrink-0">
        <Link
          href="/"
          className={[
            'h-8 flex items-center px-3 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap',
            pathname === '/' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
          ].join(' ')}
        >
          Analyze
        </Link>
        <Link
          href="/valuations"
          className={[
            'h-8 flex items-center px-3 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap',
            pathname.startsWith('/valuations') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
          ].join(' ')}
        >
          My Valuations
        </Link>
        <Link
          href="/compare"
          className={[
            'h-8 flex items-center px-3 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap',
            pathname.startsWith('/compare') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
          ].join(' ')}
        >
          Compare
        </Link>
        <Link
          href="/monitor?tab=portfolio"
          className={[
            'h-8 flex items-center px-3 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap',
            pathname.startsWith('/monitor') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
          ].join(' ')}
        >
          Portfolio
        </Link>
        <Link
          href="/markets"
          className={[
            'h-8 flex items-center px-3 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap',
            pathname.startsWith('/markets') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
          ].join(' ')}
        >
          Markets
        </Link>
        <Link
          href="/ai-stack"
          className={[
            'h-8 flex items-center px-3 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap',
            pathname.startsWith('/ai-stack') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
          ].join(' ')}
        >
          AI Stack
        </Link>
      </nav>

      {/* Search — full width on mobile, constrained on desktop */}
      <div className="relative flex-1 min-w-0 max-w-full lg:max-w-xs" ref={searchRef}>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-blue-400 focus-within:bg-white transition-colors">
          {loading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 shrink-0" />
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
            placeholder="Search Tickers…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none uppercase"
          />
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-card-md z-50 max-h-[70vh] overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => select(r.symbol)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px] font-bold text-slate-900 font-mono">{r.symbol}</span>
                    {r.exchange && (
                      <span className="text-[10px] text-slate-400 font-medium uppercase">{r.exchange}</span>
                    )}
                  </div>
                  <span className="text-[12px] text-slate-500 truncate block">{r.longname ?? r.shortname}</span>
                </div>
                {r.quoteType && (
                  <span className="shrink-0 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {r.quoteType === 'EQUITY' ? 'Equity' : r.quoteType === 'ETF' ? 'ETF' : r.quoteType === 'INDEX' ? 'Index' : r.quoteType}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: clock + auth */}
      <div className="ml-auto flex items-center gap-3 pl-2">
        <LiveClock />

        {session ? (
          <div className="flex items-center gap-2">
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={26}
                height={26}
                className="rounded-full ring-2 ring-slate-200"
              />
            )}
            <button
              onClick={() => signOut()}
              className="text-[12px] text-slate-500 hover:text-slate-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="text-[12px] text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            style={{ background: '#0F2A5E' }}
          >
            Sign in
          </button>
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
