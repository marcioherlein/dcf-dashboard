'use client'

import { useState, useEffect, useCallback } from 'react'
import { PieChart } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { ETFSearchBar } from '@/components/etf/ETFSearchBar'
import { ETFWatchlistCard } from '@/components/etf/ETFWatchlistCard'
import { loadETFWatchlist, deleteETFEntry } from '@/lib/data/etfWatchlistStore'
import type { ETFEntry } from '@/lib/data/etfTypes'

export default function ETFTrackerPage() {
  const { data: session } = useSession()
  const [watchlist, setWatchlist] = useState<ETFEntry[]>([])
  const [loading, setLoading] = useState(true)

  const userEmail = session?.user?.email ?? null

  const load = useCallback(async () => {
    setLoading(true)
    const entries = await loadETFWatchlist(userEmail)
    setWatchlist(entries)
    setLoading(false)
  }, [userEmail])

  useEffect(() => { load() }, [load])

  async function handleDelete(ticker: string) {
    await deleteETFEntry(ticker, userEmail)
    setWatchlist((prev) => prev.filter((e) => e.ticker !== ticker))
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <PieChart size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">ETF Tracker</h1>
          </div>
          <p className="text-[14px] text-slate-500 mb-5 ml-11">
            Track ETFs with a value-oriented lens — basket P/E, P/B, expense ratios, and a Value Score.
          </p>
          <ETFSearchBar />
        </div>
      </div>

      {/* Watchlist */}
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-48 animate-pulse" />
            ))}
          </div>
        ) : watchlist.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[14px] text-slate-500">
                <span className="font-semibold text-slate-700">{watchlist.length}</span> tracked ETF{watchlist.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {watchlist.map((entry) => (
                <ETFWatchlistCard key={entry.ticker} entry={entry} onDelete={handleDelete} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <PieChart size={24} className="text-slate-400" />
            </div>
            <h3 className="text-[14px] font-semibold text-slate-700 mb-1">No ETFs tracked yet</h3>
            <p className="text-[13px] text-slate-400 max-w-xs mb-4">
              Search for an ETF above to view its value metrics and add it to your watchlist.
            </p>
            <button
              onClick={() => document.querySelector<HTMLInputElement>('input[type="text"]')?.focus()}
              className="min-h-[48px] py-3 px-6 w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold transition-colors"
            >
              Search an ETF
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
