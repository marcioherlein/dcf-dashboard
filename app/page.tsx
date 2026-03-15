'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchDisp?: string
}

export default function HomePage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

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

  const examples = ['AAPL', 'MSFT', 'NVDA', 'TGS', 'YPFD', 'GGAL', 'JPM', 'META']

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-900">DCF Dashboard</h1>
          <p className="mt-3 text-base text-gray-500">
            Enter any ticker — WACC, Beta, and fair value are calculated automatically.
          </p>
        </div>

        <div className="relative">
          <div className="flex items-center rounded-2xl border border-gray-300 bg-white shadow-md focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-200">
            <span className="pl-5 text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search ticker or company name…"
              className="flex-1 bg-transparent py-4 pl-3 pr-4 text-base text-gray-900 placeholder-gray-400 focus:outline-none"
              ref={inputRef}
            />
            {loading && (
              <span className="pr-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
              </span>
            )}
          </div>

          {open && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50"
                >
                  <div>
                    <span className="text-sm font-bold text-gray-900">{r.symbol}</span>
                    <span className="ml-3 text-sm text-gray-500">{r.longname ?? r.shortname}</span>
                  </div>
                  <span className="text-xs text-gray-400">{r.exchDisp}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <span className="text-xs text-gray-400">Try:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => select(ex)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
            >
              {ex}
            </button>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-gray-400">
          Educational use only — not investment advice. Data via Yahoo Finance. WACC auto-calculated from public financials.
        </p>
      </div>
    </main>
  )
}
