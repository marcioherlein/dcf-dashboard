'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { loadWatchlist } from '@/lib/simplifier/watchlistStore'
import type { WatchlistEntry } from '@/lib/simplifier/types'
import { fmtPrice, fmtPct, fmtLargeCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const TAG_STYLES = {
  buy:   'bg-emerald-100 text-emerald-700',
  watch: 'bg-amber-100 text-amber-700',
  pass:  'bg-red-100 text-red-700',
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = pct >= 65 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

function ValuationCard({ entry }: { entry: WatchlistEntry }) {
  const upsidePct = entry.snapshot.upsidePct
  const price     = entry.snapshot.price
  const marketCap = entry.snapshot.marketCap
  const updatedAt = new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-col gap-3 hover:border-blue-200 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 font-mono">{entry.ticker}</span>
            {entry.listTag && (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', TAG_STYLES[entry.listTag])}>
                {entry.listTag}
              </span>
            )}
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5 truncate max-w-[200px]">{entry.companyName}</p>
        </div>
        {upsidePct != null && (
          <span className={cn('text-sm font-bold font-mono shrink-0', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {fmtPct(upsidePct)}
          </span>
        )}
      </div>

      {/* Snapshot stats */}
      <div className="grid grid-cols-2 gap-2">
        {price != null && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Price</p>
            <p className="text-[13px] font-mono font-semibold text-slate-800">{fmtPrice(price, 'USD')}</p>
          </div>
        )}
        {marketCap != null && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Market Cap</p>
            <p className="text-[13px] font-mono font-semibold text-slate-800">{fmtLargeCurrency(marketCap, 'USD')}</p>
          </div>
        )}
      </div>

      {/* Thesis score */}
      {entry.overallScore != null && (
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Thesis score</p>
          <ScoreBar score={entry.overallScore} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">Updated {updatedAt}</span>
        <Link
          href={`/stock/${entry.ticker}`}
          className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          Reopen analysis →
        </Link>
      </div>
    </div>
  )
}

export default function ValuationsPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWatchlist(null).then((data) => {
      setEntries(data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
            My Valuations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Saved analyses from your research. Reopen any to continue where you left off.
          </p>
        </div>

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white border border-slate-200 p-5 h-48 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-700 mb-1">No saved analyses yet</h2>
            <p className="text-sm text-slate-400 mb-6">Search a stock and save your first analysis</p>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors"
              style={{ background: '#0F2A5E' }}
            >
              Analyze a stock →
            </Link>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => (
              <ValuationCard key={entry.ticker} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
