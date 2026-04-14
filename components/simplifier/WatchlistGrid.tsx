'use client'

import type { WatchlistEntry } from '@/lib/simplifier/types'
import WatchlistCard from './WatchlistCard'

interface WatchlistGridProps {
  entries: WatchlistEntry[]
  onDelete: (ticker: string) => void
}

export default function WatchlistGrid({ entries, onDelete }: WatchlistGridProps) {
  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 16 16" fill="#8b949e">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.5h2.5a.75.75 0 0 1 0 1.5H8.5v2.5a.75.75 0 0 1-1.5 0V8.75H4.75a.75.75 0 0 1 0-1.5H7v-2.5a.75.75 0 0 1 1.5 0Z"/>
          </svg>
        </div>
        <p className="text-[#e6edf3] font-semibold text-sm mb-1">No stocks analysed yet</p>
        <p className="text-[#8b949e] text-xs max-w-xs">
          Search for a ticker above to start your first 5-phase analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {entries.map((entry) => (
        <WatchlistCard
          key={entry.ticker}
          entry={entry}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
