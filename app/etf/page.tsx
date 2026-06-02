'use client'

import { useState, useEffect, useCallback } from 'react'
import { PieChart, Compass } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { ETFSearchBar } from '@/components/etf/ETFSearchBar'
import { ETFWatchlistCard } from '@/components/etf/ETFWatchlistCard'
import { ETFExploreTab } from '@/components/etf/ETFExploreTab'
import { loadETFWatchlist, deleteETFEntry } from '@/lib/data/etfWatchlistStore'
import type { ETFEntry } from '@/lib/data/etfTypes'

type Tab = 'watchlist' | 'explore'

export default function ETFTrackerPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<Tab>('watchlist')
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
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 pt-4 sm:pt-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <PieChart size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">ETF Tracker</h1>
          </div>
          <p className="text-[14px] text-slate-500 mb-4 ml-11">
            Track ETFs with a value-oriented lens — basket P/E, P/B, expense ratios, and a Value Score.
          </p>

          {/* Search */}
          <div className="mb-4">
            <ETFSearchBar />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px ml-11">
            {([
              { id: 'watchlist' as Tab, label: 'My Watchlist', icon: <PieChart size={13} /> },
              { id: 'explore'   as Tab, label: 'Explore',      icon: <Compass size={13} /> },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'watchlist' && watchlist.length > 0 && (
                  <span className={cn(
                    'ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                    activeTab === 'watchlist' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500',
                  )}>
                    {watchlist.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
        {activeTab === 'watchlist' ? (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 h-48 animate-pulse" />
              ))}
            </div>
          ) : watchlist.length > 0 ? (
            <>
              <p className="text-[14px] text-slate-500 mb-4">
                <span className="font-semibold text-slate-700">{watchlist.length}</span>{' '}
                tracked ETF{watchlist.length !== 1 ? 's' : ''}
              </p>
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
                Search above or browse the{' '}
                <button
                  onClick={() => setActiveTab('explore')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Explore tab
                </button>{' '}
                to find ETFs to track.
              </p>
            </div>
          )
        ) : (
          <ETFExploreTab
            watchlist={watchlist}
            userEmail={userEmail}
            onWatchlistUpdate={load}
          />
        )}
      </div>
    </div>
  )
}
