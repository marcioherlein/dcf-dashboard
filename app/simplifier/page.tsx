'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'
import { loadWatchlist, deleteWatchlistEntry, updateListTag } from '@/lib/simplifier/watchlistStore'
import WatchlistTable from '@/components/simplifier/WatchlistTable'
import SimplifierSearch from '@/components/simplifier/SimplifierSearch'

type FilterTab = 'all' | 'buy' | 'watch' | 'pass'

const FILTER_CONFIG: { id: FilterTab; label: string; dot: string }[] = [
  { id: 'all',   label: 'All',   dot: '#2D2C31' },
  { id: 'buy',   label: 'Buy',   dot: '#22c55e' },
  { id: 'watch', label: 'Watch', dot: '#eab308' },
  { id: 'pass',  label: 'Pass',  dot: '#ef4444' },
]

export default function SimplifierPage() {
  const { data: session } = useSession()
  const [entries,    setEntries]    = useState<WatchlistEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<FilterTab>('all')

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
    setEntries(prev => prev.filter(e => e.ticker !== ticker))
  }

  async function handleTagUpdate(ticker: string, tag: ListTag) {
    // Optimistic update
    setEntries(prev => prev.map(e => e.ticker === ticker ? { ...e, listTag: tag } : e))
    await updateListTag(ticker, tag, userEmail)
  }

  // Counts
  const counts: Record<FilterTab, number> = {
    all:   entries.length,
    buy:   entries.filter(e => e.listTag === 'buy').length,
    watch: entries.filter(e => e.listTag === 'watch').length,
    pass:  entries.filter(e => e.listTag === 'pass').length,
  }

  const filtered = activeTab === 'all'
    ? entries
    : entries.filter(e => e.listTag === activeTab)

  return (
    <div className="min-h-screen bg-[#F7F6F1]">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Top header card ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-sm mb-4 overflow-hidden">

          {/* Brand + CTA */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E6E0]">
            <div className="flex items-center gap-2.5">
              {/* Checkmark icon */}
              <div className="w-8 h-8 rounded-lg bg-[#1f6feb] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[15px] font-bold text-[#2D2C31]">Stock Simplifier</h1>
                  <span className="text-[10px] font-semibold text-[#1f6feb] bg-[#EEF4FF] px-1.5 py-0.5 rounded border border-[#DCE6F5]">BETA</span>
                </div>
                <p className="text-[#6B6A72] text-xs mt-0.5">My Watch Lists</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SimplifierSearch />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="px-6 flex items-center justify-between border-b border-[#E8E6E0]">
            <div className="flex items-center gap-1">
              {FILTER_CONFIG.map(tab => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition-colors ${
                      isActive
                        ? 'border-[#2D2C31] text-[#2D2C31]'
                        : 'border-transparent text-[#6B6A72] hover:text-[#2D2C31]'
                    }`}
                  >
                    <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: tab.dot }} />
                    {tab.label}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#2D2C31] text-white' : 'bg-[#F3F4F6] text-[#6B6A72]'
                    }`}>
                      {counts[tab.id]}
                    </span>
                  </button>
                )
              })}

              <button className="flex items-center gap-1 px-3 py-3 text-[12px] text-[#6B6A72] hover:text-[#2D2C31] transition-colors border-b-2 border-transparent">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
                </svg>
                New List
              </button>
            </div>

            {/* Right side: sign in + filter */}
            <div className="flex items-center gap-2">
              {!session && (
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#6B6A72] border border-[#E8E6E0] rounded-lg hover:border-[#1f6feb] hover:text-[#1f6feb] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#6B6A72] border border-[#E8E6E0] rounded-lg hover:border-[#2D2C31] transition-colors">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.75 3h14.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1 0-1.5ZM3 7.75A.75.75 0 0 1 3.75 7h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 7.75Zm3 4a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/>
                </svg>
                Filter
              </button>
            </div>
          </div>

          {/* Table */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-[#6B6A72] text-sm">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Loading watchlist…
                </div>
              </div>
            ) : (
              <>
                {/* Group label */}
                {filtered.length > 0 && activeTab !== 'all' && (
                  <div className="px-4 py-2 text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider border-b border-[#E8E6E0]">
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{
                        color: FILTER_CONFIG.find(f => f.id === activeTab)?.dot,
                      }}
                    >
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: FILTER_CONFIG.find(f => f.id === activeTab)?.dot }} />
                      {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} ({filtered.length})
                    </span>
                  </div>
                )}
                <WatchlistTable
                  entries={filtered}
                  onDelete={handleDelete}
                  onTagUpdate={handleTagUpdate}
                />
              </>
            )}
          </div>
        </div>

        {/* Sign-in notice when not logged in */}
        {!session && entries.length > 0 && (
          <div className="rounded-xl border border-[#DCE6F5] bg-[#EEF4FF] px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#1f6feb">
              <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
            </svg>
            <p className="text-[12px] text-[#1f6feb]">
              Your data is saved locally.{' '}
              <button onClick={() => signIn('google')} className="font-semibold underline hover:no-underline">
                Sign in with Google
              </button>{' '}
              to sync across devices.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
