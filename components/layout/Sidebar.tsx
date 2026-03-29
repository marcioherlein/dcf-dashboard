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
    href: '/?tab=brief',
    label: 'Morning Brief',
    tab: 'brief',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.36-.71.71M6.34 17.66l-.71.71m12.73 0-.71-.71M6.34 6.34l-.71-.71M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
      </svg>
    ),
  },
  {
    href: '/?tab=monitor',
    label: 'Market Monitor',
    tab: 'monitor',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M9 17V9m4 8V5m4 12v-4" />
      </svg>
    ),
  },
  {
    href: '/?tab=portfolio',
    label: 'Portfolio',
    tab: 'portfolio',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm0 0V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    href: '/factor-ranking',
    label: 'Factor Ranking',
    tab: null,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h4l2 10h10l2-10H7M9 17a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm8 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" />
      </svg>
    ),
  },
  {
    href: '/strategy',
    label: 'Strategy Builder',
    tab: null,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
    if (item.tab !== null) {
      return pathname === '/' && activeTab === item.tab
    }
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-primary text-on-primary flex flex-col z-40 shadow-[4px_0_24px_rgba(0,27,68,0.15)]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/?tab=brief" className="flex items-center gap-3 mb-0.5">
          <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-on-primary-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M9 17V9m4 8V5m4 12v-4" />
            </svg>
          </div>
          <div>
            <p className="font-headline text-sm font-extrabold text-on-primary leading-tight tracking-tight">DCF Dashboard</p>
            <p className="text-[10px] text-on-primary-container opacity-70 leading-tight">Research · Valuation · Strategy</p>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 pb-4" ref={searchRef}>
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 focus-within:bg-white/12 transition-colors">
            <svg className="h-3.5 w-3.5 text-on-primary-container shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search ticker…"
              className="flex-1 min-w-0 bg-transparent text-xs text-on-primary placeholder-on-primary-container/50 focus:outline-none"
            />
            {loading && (
              <div className="h-3 w-3 animate-spin rounded-full border border-on-primary-container/30 border-t-on-primary shrink-0" />
            )}
          </div>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(0,27,68,0.18)] border border-outline-variant/20 z-50">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-container-low transition-colors"
                >
                  <span className="text-xs font-bold text-primary font-headline">{r.symbol}</span>
                  <span className="text-[11px] text-on-surface-variant truncate">{r.longname ?? r.shortname}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <p className="px-2 mb-2 text-[9px] font-extrabold uppercase tracking-widest text-on-primary-container opacity-50">Navigation</p>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-container text-on-primary'
                  : 'text-on-primary-container hover:bg-white/8 hover:text-on-primary',
              ].join(' ')}
            >
              <span className={active ? 'text-on-primary' : 'text-on-primary-container opacity-70'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Auth */}
      <div className="px-3 py-4 border-t border-white/10">
        {session ? (
          <div className="flex items-center gap-3">
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-primary-container shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-on-primary truncate">{session.user?.name ?? 'User'}</p>
              <button
                onClick={() => signOut()}
                className="text-[10px] text-on-primary-container opacity-60 hover:opacity-100 transition-opacity"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-xs font-semibold text-on-primary hover:bg-white/15 transition-colors"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    </aside>
  )
}
