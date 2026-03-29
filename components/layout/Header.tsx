'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
}

export default function Header() {
  const router = useRouter()
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

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

  const select = (symbol: string) => {
    setOpen(false)
    setQuery('')
    router.push(`/stock/${symbol}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) select(query.trim().toUpperCase())
  }

  return (
    <header className="sticky top-0 z-40 bg-surface-container-lowest border-b border-outline-variant/15 shadow-nav">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-on-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M9 17V9m4 8V5m4 12v-4" />
            </svg>
          </div>
          <span className="font-headline text-sm font-bold text-primary tracking-tight">Morning Brief</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="flex items-center rounded-full bg-surface-container-low px-4 py-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <svg className="h-4 w-4 text-on-surface-variant shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search ticker or company…"
              className="flex-1 bg-transparent pl-2 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none"
            />
            {loading && (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-outline-variant border-t-primary shrink-0" />
            )}
          </div>

          {open && (
            <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-float border border-outline-variant/20">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors"
                >
                  <span className="text-sm font-bold text-primary font-headline">{r.symbol}</span>
                  <span className="text-xs text-on-surface-variant truncate">{r.longname ?? r.shortname}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {session ? (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? ''}
                  width={32}
                  height={32}
                  className="rounded-full ring-2 ring-primary-fixed"
                />
              )}
              <button
                onClick={() => signOut()}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:bg-primary-container transition-all shadow-card"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
