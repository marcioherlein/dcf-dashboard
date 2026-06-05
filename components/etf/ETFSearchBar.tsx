'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ETFResult {
  symbol: string
  name: string
  exchange: string
}

export function ETFSearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ETFResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
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

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
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
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-[16px] text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5F790B] focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            aria-label="Clear search"
            className="absolute right-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
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
          className="absolute top-full mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden"
        >
          {loading ? (
            <div className="px-4 py-3 text-[14px] text-slate-400 min-h-[48px] flex items-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-[14px] text-slate-400 min-h-[48px] flex items-center">
              No ETFs found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.symbol}
                role="option"
                aria-selected={false}
                onMouseDown={() => handleSelect(r.symbol)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left group min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-black text-slate-800 font-mono w-14 shrink-0">{r.symbol}</span>
                  <span className="text-[14px] text-slate-500 truncate">{r.name}</span>
                </div>
                <span className={cn('text-[10px] text-slate-400 font-medium shrink-0 ml-2')}>{r.exchange}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
