'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import type { WatchlistEntry } from '@/lib/simplifier/types'
import { loadWatchlist, deleteWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import WatchlistGrid from '@/components/simplifier/WatchlistGrid'
import SimplifierSearch from '@/components/simplifier/SimplifierSearch'

export default function SimplifierPage() {
  const { data: session } = useSession()
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  const userEmail = session?.user?.email ?? null

  useEffect(() => {
    setLoading(true)
    loadWatchlist(userEmail).then((data) => {
      setEntries(data)
      setLoading(false)
    })
  }, [userEmail])

  async function handleDelete(ticker: string) {
    await deleteWatchlistEntry(ticker, userEmail)
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker))
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#e6edf3]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-semibold text-[#e6edf3] font-headline">Stock Simplifier</h1>
            <p className="text-[#8b949e] text-sm mt-0.5">
              5-phase guided analysis — Business Quality · Moat · Growth · Management · Risk
            </p>
          </div>
          <SimplifierSearch />
        </div>

        {/* Stats bar */}
        {entries.length > 0 && (
          <div className="flex gap-6 mb-6 pb-6 border-b border-[#21262d]">
            <div>
              <p className="text-[#8b949e] text-xs">Analysed</p>
              <p className="text-[#e6edf3] text-lg font-semibold font-mono">{entries.length}</p>
            </div>
            <div>
              <p className="text-[#8b949e] text-xs">Complete</p>
              <p className="text-[#e6edf3] text-lg font-semibold font-mono">
                {entries.filter((e) => e.overallScore != null && Object.keys(e.answers).length >= 26).length}
              </p>
            </div>
            <div>
              <p className="text-[#8b949e] text-xs">Avg Score</p>
              <p className="text-[#e6edf3] text-lg font-semibold font-mono">
                {entries.length > 0
                  ? `${Math.round(
                      entries.reduce((s, e) => s + (e.overallScore ?? 0), 0) / entries.length * 100
                    )}%`
                  : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-[#8b949e] text-sm">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Loading watchlist…
            </div>
          </div>
        ) : (
          <WatchlistGrid entries={entries} onDelete={handleDelete} />
        )}
      </div>
    </div>
  )
}
