'use client'

import { useState, useEffect, useCallback } from 'react'
import { PieChart } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { ETFSearchBar } from '@/components/etf/ETFSearchBar'
import { ETFWatchlistCard } from '@/components/etf/ETFWatchlistCard'
import { ETFUniverseSection } from '@/components/etf/ETFUniverseSection'
import { ETFMarketPulse } from '@/components/etf/ETFMarketPulse'
import { loadETFWatchlist, deleteETFEntry } from '@/lib/data/etfWatchlistStore'
import { ALL_TICKERS } from '@/lib/data/etfUniverse'
import type { ETFEntry, ETFBatchItem } from '@/lib/data/etfTypes'

export default function ETFTrackerPage() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  // ── Watchlist state ──────────────────────────────────────────────────────────
  const [watchlist, setWatchlist]   = useState<ETFEntry[]>([])
  const [wlLoading, setWlLoading]   = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})

  const loadWatchlist = useCallback(async () => {
    setWlLoading(true)
    const entries = await loadETFWatchlist(userEmail)
    setWatchlist(entries)
    setWlLoading(false)
  }, [userEmail])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  // Batch-fetch sparklines whenever watchlist changes
  useEffect(() => {
    if (watchlist.length === 0) { setSparklines({}); return }
    Promise.allSettled(
      watchlist.map((e) =>
        fetch(`/api/price-history?ticker=${e.ticker}`)
          .then((r) => r.json())
          .then((bars: Array<{ close: number }>) => ({
            ticker: e.ticker,
            prices: bars.map((b) => b.close).filter((v) => typeof v === 'number' && isFinite(v)),
          }))
          .catch(() => ({ ticker: e.ticker, prices: [] as number[] })),
      ),
    ).then((results) => {
      const map: Record<string, number[] | null> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map[r.value.ticker] = r.value.prices.length >= 2 ? r.value.prices : null
        }
      }
      setSparklines(map)
    })
  }, [watchlist])

  async function handleDelete(ticker: string) {
    await deleteETFEntry(ticker, userEmail)
    setWatchlist((prev) => prev.filter((e) => e.ticker !== ticker))
  }

  // ── Batch / universe state (lifted so ETFMarketPulse can share it) ──────────
  const [batchData, setBatchData]   = useState<Record<string, ETFBatchItem | null>>({})
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchFetched, setBatchFetched] = useState(false)

  const fetchBatch = useCallback(async () => {
    if (batchFetched) return
    setBatchLoading(true)
    try {
      const res = await fetch(`/api/etf/batch?tickers=${ALL_TICKERS.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setBatchData(json)
      setBatchFetched(true)
    } catch (e) {
      console.error('ETF batch fetch failed:', e)
    } finally {
      setBatchLoading(false)
    }
  }, [batchFetched])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  return (
    <div className="min-h-screen bg-[#F1F5F9]">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 pt-6 pb-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <PieChart size={16} className="text-white" />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}
            >
              ETF Tracker
            </h1>
          </div>
          <p className="text-[14px] text-slate-500 mb-5 ml-11">
            Value-oriented lens on the ETF universe — basket P/E, P/B, expense ratios, and a Value Score.
          </p>
          <ETFSearchBar />
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-10">

        {/* Market Pulse */}
        <ETFMarketPulse data={batchData} loading={batchLoading} />

        {/* ── My Watchlist ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2
              className="text-lg font-bold text-slate-900"
              style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}
            >
              My Watchlist
            </h2>
            {watchlist.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                {watchlist.length}
              </span>
            )}
          </div>

          {wlLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-[340px] bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : watchlist.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {watchlist.map((entry) => (
                <ETFWatchlistCard
                  key={entry.ticker}
                  entry={entry}
                  sparklineData={
                    entry.ticker in sparklines ? sparklines[entry.ticker] : undefined
                  }
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                <PieChart size={22} className="text-slate-400" />
              </div>
              <h3 className="text-[14px] font-semibold text-slate-700 mb-1">No ETFs tracked yet</h3>
              <p className="text-[13px] text-slate-400 max-w-sm">
                Search for a ticker above, or browse and add from the sectors, geographies, and styles below.
              </p>
            </div>
          )}
        </section>

        {/* ── Universe: sectors, geographies, styles, rankings ────────────── */}
        <div className="border-t border-slate-200 pt-10">
          <ETFUniverseSection
            data={batchData}
            watchlist={watchlist}
            userEmail={userEmail}
            onWatchlistUpdate={loadWatchlist}
          />
        </div>

      </div>
    </div>
  )
}
