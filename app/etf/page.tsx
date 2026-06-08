'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PieChart, RefreshCw, GitCompare, CheckSquare, Square } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSession, signIn } from 'next-auth/react'
import { ETFSearchBar } from '@/components/etf/ETFSearchBar'
import { ETFWatchlistCard } from '@/components/etf/ETFWatchlistCard'
import { ETFUniverseSection } from '@/components/etf/ETFUniverseSection'
import { ETFMarketPulse } from '@/components/etf/ETFMarketPulse'
import { ETFHelpButton } from '@/components/etf/ETFOnboardBanner'
import ETFLoginToSaveModal from '@/components/etf/ETFLoginToSaveModal'
import { loadETFWatchlist, deleteETFEntry, saveETFEntry, readLocalWatchlist } from '@/lib/data/etfWatchlistStore'
import { ALL_TICKERS } from '@/lib/data/etfUniverse'
import type { ETFEntry, ETFBatchItem } from '@/lib/data/etfTypes'

const SESSION_CACHE_KEY = 'etf_batch_v1'
const SESSION_CACHE_TTL = 30 * 60 * 1000

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
  } catch {}
}

// ── Undo toast ────────────────────────────────────────────────────────────────

interface UndoToast {
  ticker: string
  entry: ETFEntry
  timer: ReturnType<typeof setTimeout>
}

export default function ETFTrackerPage() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  // ── Login-to-save gate ───────────────────────────────────────────────────────
  const [loginModal, setLoginModal] = useState<{ ticker: string; name: string | null; valueScore: number | null } | null>(null)

  // After sign-in: sync any locally-saved entries to Supabase
  useEffect(() => {
    if (!userEmail) return
    const local = readLocalWatchlist()
    if (local.length === 0) return
    local.forEach((entry) => {
      saveETFEntry(entry, userEmail).catch(() => {})
    })
  }, [userEmail])

  // ── Watchlist state ──────────────────────────────────────────────────────────
  const [watchlist, setWatchlist]   = useState<ETFEntry[]>([])
  const [wlLoading, setWlLoading]   = useState(true)
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({})
  const fetchedSparklines = useRef<Set<string>>(new Set())

  // Undo-delete toast
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null)

  const loadWatchlist = useCallback(async () => {
    setWlLoading(true)
    const entries = await loadETFWatchlist(userEmail)
    setWatchlist(entries)
    setWlLoading(false)
  }, [userEmail])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  useEffect(() => {
    if (watchlist.length === 0) { setSparklines({}); return }
    const newTickers = watchlist.filter((e) => !fetchedSparklines.current.has(e.ticker))
    if (newTickers.length === 0) return

    Promise.allSettled(
      newTickers.map((e) =>
        fetch(`/api/historical?ticker=${e.ticker}&period=1mo`)
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

  function handleDelete(ticker: string) {
    const entry = watchlist.find((e) => e.ticker === ticker)
    if (!entry) return

    // Clear any existing toast
    if (undoToast) {
      clearTimeout(undoToast.timer)
      deleteETFEntry(undoToast.ticker, userEmail).catch(() => {})
    }

    // Optimistically remove
    setWatchlist((current) => current.filter((e) => e.ticker !== ticker))

    // Schedule permanent deletion after 5s
    const timer = setTimeout(() => {
      deleteETFEntry(ticker, userEmail).catch(() => {
        // If delete fails, silently restore
        setWatchlist((prev) => {
          const has = prev.some((e) => e.ticker === ticker)
          return has ? prev : [entry, ...prev]
        })
      })
      setUndoToast(null)
    }, 5000)

    setUndoToast({ ticker, entry, timer })
  }

  function handleUndo() {
    if (!undoToast) return
    clearTimeout(undoToast.timer)
    setWatchlist((prev) => {
      const has = prev.some((e) => e.ticker === undoToast.ticker)
      return has ? prev : [undoToast.entry, ...prev]
    })
    setUndoToast(null)
  }

  // Dismiss toast without undoing (user navigated away, etc.)
  useEffect(() => () => { if (undoToast) clearTimeout(undoToast.timer) }, [undoToast])

  // ── Batch / universe state ───────────────────────────────────────────────────
  const [batchData, setBatchData]       = useState<Record<string, ETFBatchItem | null>>({})
  const [batchLoading, setBatchLoading] = useState(true)
  const [batchError, setBatchError]     = useState<string | null>(null)
  const [batchFetched, setBatchFetched] = useState(false)

  const fetchBatch = useCallback(async () => {
    if (batchFetched) return
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

  // When batch data arrives, merge live price/metrics into watchlist entries
  useEffect(() => {
    if (Object.keys(batchData).length === 0) return
    setWatchlist((prev) =>
      prev.map((entry) => {
        const live = batchData[entry.ticker]
        if (!live) return entry
        return {
          ...entry,
          peRatio: live.peRatio,
          pbRatio: live.pbRatio,
          yield: live.yield,
          expenseRatio: live.expenseRatio,
          valueScore: live.valueScore,
          price: live.price,
          priceChangePct: live.priceChangePct,
          metricsUpdatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [batchData])

  async function handleSaveWithGate(
    ticker: string,
    name: string | null,
    entry: Omit<ETFEntry, 'ticker' | 'name' | 'addedAt'> & { ticker?: string; name?: string | null; addedAt?: string },
    valueScore: number | null,
  ) {
    if (!userEmail) {
      setLoginModal({ ticker, name, valueScore })
      return
    }
    await saveETFEntry(
      { ticker, name, addedAt: new Date().toISOString(), ...entry },
      userEmail,
    )
    loadWatchlist()
  }

  async function handleQuickAdd(ticker: string) {
    const item = batchData[ticker]
    if (!item) return
    await handleSaveWithGate(ticker, item.name, {
      valueScore: item.valueScore,
      expenseRatio: item.expenseRatio,
      yield: item.yield,
      peRatio: item.peRatio,
      pbRatio: item.pbRatio,
      totalAssets: item.aum,
      price: item.price,
      priceChangePct: item.priceChangePct,
      metricsUpdatedAt: new Date().toISOString(),
    }, item.valueScore)
  }

  const hasWatchlist = !wlLoading && watchlist.length > 0

  // ── Compare mode ──────────────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set())

  function toggleCompareSelect(ticker: string) {
    setCompareSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else if (next.size < 4) next.add(ticker)
      return next
    })
  }

  const compareUrl = compareSelected.size >= 2
    ? `/etf/compare?symbols=${Array.from(compareSelected).join(',')}`
    : null

  return (
    <div className="min-h-dvh bg-[#F9F8F5]">

      {/* ── Login-to-save modal ──────────────────────────────────────────────── */}
      {loginModal && (
        <ETFLoginToSaveModal
          ticker={loginModal.ticker}
          name={loginModal.name}
          valueScore={loginModal.valueScore}
          onClose={() => setLoginModal(null)}
        />
      )}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E3E1DA] px-4 sm:px-8 pt-6 pb-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-olive-700 flex items-center justify-center shrink-0">
                <PieChart size={15} className="text-white" />
              </div>
              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#06101F]">
                ETF Tracker
              </h1>
              <ETFHelpButton />
            </div>
            <Link
              href="/etf/compare"
              className="hidden sm:flex items-center gap-1.5 text-[12px] font-semibold text-[#6B6B6B] hover:text-olive-700 border border-[#E3E1DA] hover:border-[#BFD2A1] rounded-lg px-3 py-2 transition-colors whitespace-nowrap bg-white"
            >
              <GitCompare size={13} />
              Compare ETFs
            </Link>
          </div>
          <p className="text-[13px] text-[#6B6B6B] mb-5 ml-[42px]">
            Value-oriented lens on the ETF universe — basket P/E, P/B, expense ratios, and a Value Score.
          </p>
          <ETFSearchBar
            onAdd={async (symbol, name) => {
              const item = batchData[symbol]
              await handleSaveWithGate(symbol, item?.name ?? name, {
                valueScore: item?.valueScore ?? null,
                expenseRatio: item?.expenseRatio ?? null,
                yield: item?.yield ?? null,
                peRatio: item?.peRatio ?? null,
                pbRatio: item?.pbRatio ?? null,
                totalAssets: item?.aum ?? null,
                price: item?.price ?? null,
                priceChangePct: item?.priceChangePct ?? null,
                metricsUpdatedAt: new Date().toISOString(),
              }, item?.valueScore ?? null)
            }}
            watchlistedTickers={new Set(watchlist.map((e) => e.ticker))}
          />
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-10">

        {/* Market Pulse — always first */}
        {batchError ? (
          <div className="bg-white border border-[#E3E1DA] rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-[#566174]">{batchError}</p>
            <button
              onClick={() => { setBatchFetched(false); fetchBatch() }}
              className="flex items-center gap-1.5 text-sm font-semibold text-olive-700 hover:text-olive-600 transition-colors"
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : (
          <ETFMarketPulse data={batchData} loading={batchLoading} />
        )}

        {/* ── My Watchlist (only shown when it has items) ──────────────────── */}
        {hasWatchlist && (
          <section>
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <h2 className="text-[18px] font-bold text-[#06101F]">My Watchlist</h2>
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold bg-olive-100 text-olive-700">
                {watchlist.length}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {!userEmail && (
                  <button
                    onClick={() => signIn('google', { callbackUrl: window.location.href })}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5F790B] hover:text-[#6F8F12] transition-colors"
                    title="Sign in to sync your watchlist across devices"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5" aria-hidden="true">
                      <rect x="3" y="7" width="10" height="8" rx="1.5" />
                      <path d="M5 7V5a3 3 0 016 0v2" />
                    </svg>
                    Sign in to sync
                  </button>
                )}
                {compareMode && compareSelected.size > 0 && (
                  <span className="text-[12px] text-[#6B6B6B]">{compareSelected.size}/4 selected</span>
                )}
                {compareMode && compareUrl && (
                  <Link
                    href={compareUrl}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-olive-700 text-white rounded-lg hover:bg-olive-600 transition-colors min-h-[36px]"
                  >
                    <GitCompare size={12} />
                    Compare {compareSelected.size}
                  </Link>
                )}
                {watchlist.length >= 2 && (
                  <button
                    onClick={() => { setCompareMode((v) => !v); setCompareSelected(new Set()) }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg border transition-colors min-h-[36px]',
                      compareMode
                        ? 'bg-olive-50 border-[#BFD2A1] text-olive-700'
                        : 'bg-white border-[#E3E1DA] text-[#6B6B6B] hover:border-[#BFD2A1] hover:text-olive-700',
                    )}
                  >
                    <GitCompare size={12} />
                    {compareMode ? 'Cancel' : 'Compare'}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {watchlist.map((entry) => (
                <div key={entry.ticker} className="relative">
                  {compareMode && (
                    <button
                      onClick={() => toggleCompareSelect(entry.ticker)}
                      aria-label={compareSelected.has(entry.ticker) ? `Deselect ${entry.ticker}` : `Select ${entry.ticker} for comparison`}
                      className="absolute top-3 left-3 z-20 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-white border border-[#E3E1DA] shadow-sm transition-colors hover:border-olive-700"
                    >
                      {compareSelected.has(entry.ticker)
                        ? <CheckSquare size={16} className="text-olive-700" />
                        : <Square size={16} className="text-[#8A95A6]" />
                      }
                    </button>
                  )}
                  <div className={cn('transition-opacity', compareMode && compareSelected.size >= 4 && !compareSelected.has(entry.ticker) ? 'opacity-40' : 'opacity-100')}>
                    <ETFWatchlistCard
                      entry={entry}
                      sparklineData={entry.ticker in sparklines ? sparklines[entry.ticker] : undefined}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Loading skeletons for watchlist */}
        {wlLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-[340px] bg-white rounded-2xl border border-[#E3E1DA] motion-safe:animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Universe: sectors, geographies, styles, rankings ─────────────── */}
        <ETFUniverseSection
          data={batchData}
          watchlist={watchlist}
          userEmail={userEmail}
          onWatchlistUpdate={loadWatchlist}
          hasError={!!batchError}
          emptyWatchlist={!hasWatchlist && !wlLoading}
          batchData={batchData}
          onQuickAdd={handleQuickAdd}
          onSave={async (ticker, name, item) => {
            await handleSaveWithGate(ticker, name, {
              valueScore: item.valueScore,
              expenseRatio: item.expenseRatio,
              yield: item.yield,
              peRatio: item.peRatio,
              pbRatio: item.pbRatio,
              totalAssets: item.aum,
              price: item.price ?? null,
              priceChangePct: item.priceChangePct ?? null,
              metricsUpdatedAt: new Date().toISOString(),
            }, item.valueScore)
          }}
        />

      </div>

      {/* ── Undo toast ───────────────────────────────────────────────────────── */}
      {undoToast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#06101F] text-white rounded-xl px-4 py-3 shadow-lg text-[13px] font-medium whitespace-nowrap animate-in slide-in-from-bottom-2 duration-200 lg:bottom-6" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)' }}>
          <span>{undoToast.ticker} removed from watchlist</span>
          <button
            onClick={handleUndo}
            className="font-bold text-olive-400 hover:text-olive-300 transition-colors underline underline-offset-2"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
