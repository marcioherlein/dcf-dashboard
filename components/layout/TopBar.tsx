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
  {
    href: '/?tab=monitor',
    label: 'Market Monitor',
    tab: 'monitor',
  },
  {
    href: '/?tab=portfolio',
    label: 'Portfolio',
    tab: 'portfolio',
  },
  {
    href: '/factor-ranking',
    label: 'Screener',
    tab: null,
  },
  {
    href: '/compare',
    label: 'Compare',
    tab: null,
  },
  {
    href: '/trading',
    label: 'Trading',
    tab: null,
  },
  {
    href: '/simplifier',
    label: 'Simplifier',
    tab: null,
  },
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
    <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-[#0a0a0a] border-b border-[#ff6600]/40 flex items-center px-4 gap-0">

      {/* Logo */}
      <Link href="/?tab=monitor" className="flex items-center gap-2 shrink-0 mr-6">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-[#ff6600] rounded-sm flex items-center justify-center">
            <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/>
            </svg>
          </div>
          <span className="font-mono text-sm font-bold text-[#ff6600] tracking-widest uppercase">DCF</span>
        </div>
        <span className="text-[#444] font-mono text-xs">|</span>
        <span className="font-mono text-[10px] text-[#888] tracking-wider uppercase">Terminal</span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-0 border-l border-[#222] mr-4 overflow-x-auto scrollbar-hide shrink-0">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'h-12 flex items-center px-4 font-mono text-[11px] font-medium uppercase tracking-wider border-r border-[#222] transition-colors whitespace-nowrap',
                active
                  ? 'text-[#ff6600] bg-[#1a0d00] border-b-2 border-b-[#ff6600]'
                  : 'text-[#aaa] hover:text-[#ff6600] hover:bg-[#111]',
              ].join(' ')}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Search */}
      <div className="relative flex-1 min-w-0 max-w-xs" ref={searchRef}>
        <div className="flex items-center gap-2 bg-[#111] border border-[#333] rounded-sm px-2.5 py-1.5 focus-within:border-[#ff6600]/60 transition-colors">
          <svg className="h-3 w-3 text-[#555] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="TICKER SEARCH"
            className="flex-1 min-w-0 bg-transparent font-mono text-[11px] text-[#e0e0e0] placeholder-[#444] focus:outline-none tracking-widest uppercase"
          />
          {loading && <div className="h-3 w-3 animate-spin rounded-full border border-[#444] border-t-[#ff6600] shrink-0" />}
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-0.5 overflow-hidden bg-[#0f0f0f] border border-[#333] shadow-2xl z-50">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => select(r.symbol)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#1a1a1a] border-b border-[#1e1e1e] last:border-b-0 transition-colors"
              >
                <span className="font-mono text-xs font-bold text-[#ff6600] tracking-wider w-16 shrink-0">{r.symbol}</span>
                <span className="font-mono text-[10px] text-[#888] truncate">{r.longname ?? r.shortname}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right section: time + auth */}
      <div className="ml-auto flex items-center gap-4 pl-4">
        <LiveClock />

        {session ? (
          <div className="flex items-center gap-2">
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={24}
                height={24}
                className="rounded-sm ring-1 ring-[#333]"
              />
            )}
            <button
              onClick={() => signOut()}
              className="font-mono text-[10px] text-[#666] hover:text-[#ff6600] transition-colors uppercase tracking-wider"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="font-mono text-[10px] text-[#888] border border-[#333] px-3 py-1 hover:border-[#ff6600] hover:text-[#ff6600] transition-colors uppercase tracking-wider"
          >
            Sign In
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
    <span className="font-mono text-[11px] text-[#555] tracking-widest tabular-nums">{time}</span>
  )
}
