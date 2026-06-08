'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ETFResult {
  symbol: string
  name: string
  exchange: string
}

interface Props {
  /** If provided, shows a + button on each search result to add without navigating */
  onAdd?: (symbol: string, name: string) => Promise<void>
  /** Set of already-watchlisted tickers to show check state */
  watchlistedTickers?: Set<string>
}

export function ETFSearchBar({ onAdd, watchlistedTickers }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ETFResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = 'etf-search-listbox'
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/etf/search?q=${encodeURIComponent(query)}`)
        if (!res.ok) {
          setResults([])
          setOpen(query.length >= 2)
          return
        }
        const data: ETFResult[] = await res.json()
        setResults(data)
        setOpen(query.length >= 2)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(symbol: string) {
    setQuery('')
    setOpen(false)
    router.push(`/etf/${symbol}`)
  }

  async function handleAdd(e: React.MouseEvent, symbol: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!onAdd) return
    await onAdd(symbol, name)
    setJustAdded((prev) => {
      const next = new Set(prev)
      next.add(symbol)
      setTimeout(() => setJustAdded((p) => { const n = new Set(p); n.delete(symbol); return n }), 1500)
      return next
    })
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3.5 text-[#8A95A6] pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-label="Search ETFs"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ETF — SPY, QQQ, VTI, SCHD…"
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#E3E1DA] bg-white text-[16px] text-[#06101F] placeholder:text-[#8A95A6] shadow-sm focus:outline-none focus:ring-2 focus:ring-olive-700 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            aria-label="Clear search"
            className="absolute right-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8A95A6] hover:text-[#6B6B6B]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="ETF search results"
          className="absolute top-full mt-1.5 w-full bg-white rounded-xl border border-[#E3E1DA] shadow-lg z-50 overflow-hidden"
        >
          {loading ? (
            <div className="px-4 py-3 text-[14px] text-[#8A95A6] min-h-[48px] flex items-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-[14px] text-[#8A95A6] min-h-[48px] flex items-center">
              No ETFs found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((r) => {
              const isWatchlisted = watchlistedTickers?.has(r.symbol) ?? false
              const wasJustAdded = justAdded.has(r.symbol)
              return (
                <div
                  key={r.symbol}
                  role="option"
                  aria-selected={false}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[#F5F5F5] transition-colors group min-h-[48px]"
                >
                  <button
                    onMouseDown={() => handleSelect(r.symbol)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <span className="text-[14px] font-bold text-[#06101F] font-mono w-14 shrink-0">{r.symbol}</span>
                    <span className="text-[14px] text-[#6B6B6B] truncate">{r.name}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] text-[#8A95A6] font-medium hidden sm:block">{r.exchange}</span>
                    {onAdd && (
                      <button
                        onMouseDown={(e) => handleAdd(e, r.symbol, r.name)}
                        aria-label={isWatchlisted || wasJustAdded ? `${r.symbol} in watchlist` : `Add ${r.symbol} to watchlist`}
                        className={cn(
                          'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border transition-all',
                          isWatchlisted || wasJustAdded
                            ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]'
                            : 'bg-white border-[#E3E1DA] text-[#8A95A6] hover:bg-olive-50 hover:border-[#BFD2A1] hover:text-olive-700',
                        )}
                      >
                        {isWatchlisted || wasJustAdded ? <Check size={12} /> : <Plus size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
