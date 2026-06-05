'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PieChart, RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { ETFSearchBar } from '@/components/etf/ETFSearchBar'
import { ETFWatchlistCard } from '@/components/etf/ETFWatchlistCard'
import { ETFUniverseSection } from '@/components/etf/ETFUniverseSection'
import { ETFMarketPulse } from '@/components/etf/ETFMarketPulse'
import { ETFOnboardBanner } from '@/components/etf/ETFOnboardBanner'
import { loadETFWatchlist, deleteETFEntry, saveETFEntry } from '@/lib/data/etfWatchlistStore'
import { ALL_TICKERS } from '@/lib/data/etfUniverse'
import type { ETFEntry, ETFBatchItem } from '@/lib/data/etfTypes'

const SESSION_CACHE_KEY = 'etf_batch_v1'
const SESSION_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function readBatchCache(): Record<string, ETFBatchItem | null> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: Record<string, ETFBatchItem | null>; ts: number }
    if (Date.now() - ts > SESSION_CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function writeBatchCache(data: Record<string, ETFBatchItem | null>): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // quota exceeded — silent fail
  }
}

export default function ETFTrackerPage() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  // ── Watchlist state ──────────────────────────────────────────────────────────
  const [watchlist, setWatchlist]   = useState<ETFEntry[]>([])
  const [wlLoading, setWlLoading]   = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const fetchedSparklines = useRef<Set<string>>(new Set())

  const loadWatchlist = useCallback(async () => {
    setWlLoading(true)
    const entries = await loadETFWatchlist(userEmail)
    setWatchlist(entries)
    setWlLoading(false)
  }, [userEmail])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  // Batch-fetch sparklines for new tickers only (deduplication)
  useEffect(() => {
    if (watchlist.length === 0) { setSparklines({}); return }
    const newTickers = watchlist.filter((e) => !fetchedSparklines.current.has(e.ticker))
    if (newTickers.length === 0) return

    Promise.allSettled(
      newTickers.map((e) =>
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
          const prices = r.value.prices.length >= 2 ? r.value.prices : null
          map[r.value.ticker] = prices
          fetchedSparklines.current.add(r.value.ticker)
        }
      }
      setSparklines((prev) => ({ ...prev, ...map }))
    })
  }, [watchlist])

  async function handleDelete(ticker: string) {
    const prev = watchlist
    setWatchlist((current) => current.filter((e) => e.ticker !== ticker))
    setDeleteError(null)
    try {
      await deleteETFEntry(ticker, userEmail)
    } catch {
      setWatchlist(prev)
      setDeleteError(`Failed to remove ${ticker}. Please try again.`)
    }
  }

  // ── Batch / universe state ───────────────────────────────────────────────────
  const [batchData, setBatchData]       = useState<Record<string, ETFBatchItem | null>>({})
  const [batchLoading, setBatchLoading] = useState(true)
  const [batchError, setBatchError]     = useState<string | null>(null)
  const [batchFetched, setBatchFetched] = useState(false)

  const fetchBatch = useCallback(async () => {
    if (batchFetched) return

    // Serve from sessionStorage cache if available
    const cached = readBatchCache()
    if (cached) {
      setBatchData(cached)
      setBatchFetched(true)
      setBatchLoading(false)
      return
    }

    setBatchLoading(true)
    setBatchError(null)
    try {
      const res = await fetch(`/api/etf/batch?tickers=${ALL_TICKERS.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setBatchData(json)
      // Only mark fetched if we actually got data
      const hasData = Object.values(json).some((v) => v !== null)
      if (hasData) {
        setBatchFetched(true)
        writeBatchCache(json)
      }
    } catch (e) {
      console.error('ETF batch fetch failed:', e)
      setBatchError('Failed to load ETF data.')
    } finally {
      setBatchLoading(false)
    }
  }, [batchFetched])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  // Quick-add handler for empty state buttons
  async function handleQuickAdd(ticker: string) {
    const item = batchData[ticker]
    if (!item) return
    await saveETFEntry(
      {
        ticker: item.ticker,
        name: item.name,
        valueScore: item.valueScore,
        expenseRatio: item.expenseRatio,
        yield: item.yield,
        peRatio: item.peRatio,
        pbRatio: item.pbRatio,
        totalAssets: item.aum,
        addedAt: new Date().toISOString(),
      },
      userEmail,
    )
    loadWatchlist()
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2]">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 pt-6 pb-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#5F790B] flex items-center justify-center shrink-0">
              <PieChart size={16} className="text-white" />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight text-slate-900"
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

        {/* Onboarding banner (first-run only) */}
        <ETFOnboardBanner />

        {/* Market Pulse */}
        {batchError ? (
          <div className="glass-card-light rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">{batchError}</p>
            <button
              onClick={() => { setBatchFetched(false); fetchBatch() }}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#5F790B] hover:text-[#6F8F12] transition-colors"
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : (
          <ETFMarketPulse data={batchData} loading={batchLoading} />
        )}

        {/* ── My Watchlist ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2
              className="text-lg font-bold text-slate-900"
            >
              My Watchlist
            </h2>
            {watchlist.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold bg-[#EEF4DD] text-[#5F790B]">
                {watchlist.length}
              </span>
            )}
          </div>

          {deleteError && (
            <p className="text-sm text-red-500 mb-3">{deleteError}</p>
          )}

          {wlLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-[340px] bg-slate-100 rounded-2xl border border-slate-200 animate-pulse" />
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
            <div className="glass-card-light rounded-2xl p-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                <PieChart size={22} className="text-slate-400" />
              </div>
              <h3 className="text-[14px] font-semibold text-slate-700 mb-1">Track ETFs by what they&apos;re actually worth</h3>
              <p className="text-[13px] text-slate-400 max-w-sm mb-5">
                Search for a ticker above, or browse and add from the sectors, geographies, and styles below.
              </p>
              {Object.keys(batchData).length > 0 && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {['SPY', 'VTV', 'VYM'].map((t) => (
                    <button
                      key={t}
                      onClick={() => handleQuickAdd(t)}
                      className="px-4 py-2 min-h-[44px] rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:border-[#BFD2A1] hover:text-[#5F790B] hover:bg-[#F6FAEA] transition-colors"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[12px] text-slate-400 mt-4">
                Or browse sectors, geographies, and styles below ↓
              </p>
            </div>
          )}
        </section>

        {/* ── Universe: sectors, geographies, styles, rankings ────────────── */}
        <div className="border-t border-slate-200">
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
