'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Result {
  symbol: string
  shortname?: string
  longname?: string
}

export default function SimplifierSearch() {
  const router  = useRouter()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as Result[]
      setResults(data.slice(0, 6))
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    search(v)
  }

  function handleSelect(symbol: string) {
    setQuery('')
    setResults([])
    setOpen(false)
    router.push(`/simplifier/${symbol.toUpperCase()}`)
  }

  return (
    <div className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 focus-within:border-[#388bfd] transition-colors">
        {loading ? (
          <svg className="animate-spin text-[#8b949e]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#8b949e">
            <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
          </svg>
        )}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search ticker or company…"
          className="flex-1 bg-transparent text-[#e6edf3] text-sm placeholder-[#484f58] outline-none"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[#161b22] border border-[#30363d] rounded-lg shadow-float z-50 overflow-hidden">
          {results.map((r) => (
            <button
              key={r.symbol}
              onMouseDown={() => handleSelect(r.symbol)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#21262d] transition-colors text-left"
            >
              <span className="text-[#e6edf3] text-sm font-semibold font-mono w-16 shrink-0">{r.symbol}</span>
              <span className="text-[#8b949e] text-xs truncate">{r.shortname ?? r.longname ?? ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
