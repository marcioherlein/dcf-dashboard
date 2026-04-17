'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

const NAV_ITEMS = [
  { href: '/?tab=monitor',   label: 'Market Monitor', tab: 'monitor' },
  { href: '/?tab=portfolio', label: 'Portfolio',       tab: 'portfolio' },
  { href: '/factor-ranking', label: 'Screener',        tab: null },
  { href: '/compare',        label: 'Compare',         tab: null },
  { href: '/trading',        label: 'Trading',         tab: null },
  { href: '/simplifier',     label: 'Simplifier',      tab: null },
]

export default function TopBar() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { data: session } = useSession()

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce  = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)

  const activeTab = searchParams.get('tab') ?? 'brief'

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

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.tab !== null) return pathname === '/' && activeTab === item.tab
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-13 bg-white border-b border-slate-200 flex items-center px-4 gap-0 shadow-sm" style={{ height: '52px' }}>

      {/* Logo */}
      <Link href="/?tab=monitor" className="flex items-center gap-2 shrink-0 mr-6">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/>
          </svg>
        </div>
        <span className="font-semibold text-slate-900 text-sm tracking-tight">DCF Dashboard</span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center overflow-x-auto scrollbar-hide shrink-0 mr-4 gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'h-8 flex items-center px-3 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
              ].join(' ')}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Search */}
      <div className="relative flex-1 min-w-0 max-w-xs" ref={searchRef}>
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
            placeholder="Search ticker…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none uppercase"
          />
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-card-md z-50">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => select(r.symbol)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                <span className="text-[13px] font-semibold text-blue-600 w-16 shrink-0 font-mono">{r.symbol}</span>
                <span className="text-[12px] text-slate-500 truncate">{r.longname ?? r.shortname}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: clock + auth */}
      <div className="ml-auto flex items-center gap-3 pl-4">
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
            className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
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
