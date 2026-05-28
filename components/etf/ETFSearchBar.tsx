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
        const data: ETFResult[] = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
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
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ETF — SPY, QQQ, VTI, SCHD…"
          className="w-full pl-10 pr-9 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-3 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
          ) : (
            results.map((r) => (
              <button
                key={r.symbol}
                onMouseDown={() => handleSelect(r.symbol)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-slate-800 font-mono w-14 shrink-0">{r.symbol}</span>
                  <span className="text-sm text-slate-500 truncate">{r.name}</span>
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
