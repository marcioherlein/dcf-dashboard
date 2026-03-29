'use client'
import { useState, useEffect, useCallback } from 'react'
import type { RankedInstrument } from '@/app/api/factor-ranking/route'
import RankingTable from '@/components/factor/RankingTable'

type MarketFilter = 'all' | 'MERVAL' | 'NYSE' | 'NASDAQ' | 'ROFEX' | 'US'
type AssetFilter = 'all' | 'equity' | 'future'
type SectorFilter = 'all' | string

interface Metadata {
  computedAt: string
  totalInstruments: number
  marketCounts: Record<string, number>
  normalizedToUSD: boolean
  arsUsdRate?: number
}

const MARKET_OPTIONS: { id: MarketFilter; label: string }[] = [
  { id: 'all',    label: 'All Markets' },
  { id: 'MERVAL', label: 'MERVAL 🇦🇷' },
  { id: 'US',     label: 'US (NYSE + NASDAQ)' },
  { id: 'NYSE',   label: 'NYSE' },
  { id: 'NASDAQ', label: 'NASDAQ' },
  { id: 'ROFEX',  label: 'ROFEX Futures 🌽' },
]

const TOP_N_OPTIONS = [0, 10, 20, 30, 50]

const MARKET_COLORS: Record<string, string> = {
  MERVAL: 'bg-blue-50 text-blue-700 border-blue-200',
  NYSE:   'bg-primary-fixed/30 text-on-primary-fixed-variant border-primary-fixed/50',
  NASDAQ: 'bg-violet-50 text-violet-700 border-violet-200',
  ROFEX:  'bg-amber-50 text-amber-700 border-amber-200',
}

export default function FactorRankingPage() {
  const [market, setMarket] = useState<MarketFilter>('all')
  const [assetType, setAssetType] = useState<AssetFilter>('all')
  const [sector, setSector] = useState<SectorFilter>('all')
  const [topN, setTopN] = useState(0)
  const [onlyCedear, setOnlyCedear] = useState(false)
  const [normalizeUSD, setNormalizeUSD] = useState(false)

  const [results, setResults] = useState<RankedInstrument[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    const marketParam = market === 'US' ? 'NYSE,NASDAQ' : market !== 'all' ? market : 'all'
    if (marketParam !== 'all') params.set('market', marketParam)
    if (topN > 0) params.set('topN', String(topN))
    if (onlyCedear) params.set('cedear', '1')
    if (normalizeUSD) params.set('usd', '1')

    try {
      const res = await fetch(`/api/factor-ranking?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Server error'); return }
      setResults(data.results ?? [])
      setMetadata(data.metadata ?? null)
      setLastFetch(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [market, topN, onlyCedear, normalizeUSD])

  useEffect(() => { fetchRankings() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = results.filter((r) => {
    if (assetType !== 'all' && r.assetType !== assetType) return false
    if (sector !== 'all' && r.sector !== sector) return false
    return true
  })

  const sectors = ['all', ...Array.from(new Set(results.filter((r) => r.sector).map((r) => r.sector!)))]

  return (
    <div className="min-h-screen bg-background text-on-background">

      {/* Page header */}
      <div className="bg-primary px-6 py-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-headline font-bold text-on-primary tracking-tight">
                Factor Ranking Engine
              </h1>
              <p className="mt-0.5 text-sm text-on-primary-container opacity-80">
                Cross-market ranking · MERVAL · NYSE · NASDAQ · ROFEX · Multi-factor model
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastFetch && (
                <span className="text-[11px] text-on-primary-container opacity-60">
                  Updated {lastFetch.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchRankings}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-primary-container text-on-primary px-4 py-2 text-sm font-bold hover:bg-primary-container/80 transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Ranking…' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Market summary chips */}
          {metadata && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(metadata.marketCounts).map(([key, count]) => {
                const [mkt] = key.split('_')
                return (
                  <span key={key} className={`text-[10px] font-semibold rounded px-2 py-0.5 border ${MARKET_COLORS[mkt] ?? 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`}>
                    {key.replace('_', ' ')} · {count}
                  </span>
                )
              })}
              {metadata.normalizedToUSD && metadata.arsUsdRate && (
                <span className="text-[10px] font-semibold rounded px-2 py-0.5 border bg-surface-container text-on-surface-variant border-outline-variant/20">
                  ARS/USD ~ {(1 / metadata.arsUsdRate).toFixed(0)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/10 sticky top-0 z-20">
        <div className="mx-auto max-w-[1400px] px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">

            {/* Market filter */}
            <div className="flex gap-1 bg-surface-container rounded-xl p-1">
              {MARKET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMarket(opt.id)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
                    market === opt.id
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Asset type */}
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetFilter)}
              className="rounded-xl bg-surface-container border-none px-3 py-1.5 text-xs font-semibold text-on-surface-variant focus:ring-1 focus:ring-primary/30"
            >
              <option value="all">All types</option>
              <option value="equity">Equities only</option>
              <option value="future">Futures only</option>
            </select>

            {/* Sector */}
            {sectors.length > 2 && (
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="rounded-xl bg-surface-container border-none px-3 py-1.5 text-xs font-semibold text-on-surface-variant focus:ring-1 focus:ring-primary/30"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>{s === 'all' ? 'All sectors' : s}</option>
                ))}
              </select>
            )}

            {/* Top N */}
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="rounded-xl bg-surface-container border-none px-3 py-1.5 text-xs font-semibold text-on-surface-variant focus:ring-1 focus:ring-primary/30"
            >
              {TOP_N_OPTIONS.map((n) => (
                <option key={n} value={n}>{n === 0 ? 'All instruments' : `Top ${n}`}</option>
              ))}
            </select>

            {/* Toggles */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`relative w-9 h-5 rounded-full transition-colors ${onlyCedear ? 'bg-secondary' : 'bg-surface-container-high'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${onlyCedear ? 'translate-x-4' : ''}`} />
                <input type="checkbox" className="sr-only" checked={onlyCedear} onChange={(e) => setOnlyCedear(e.target.checked)} />
              </div>
              <span className="text-xs font-medium text-on-surface-variant whitespace-nowrap group-hover:text-on-surface">
                CEDEARs only
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`relative w-9 h-5 rounded-full transition-colors ${normalizeUSD ? 'bg-primary' : 'bg-surface-container-high'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${normalizeUSD ? 'translate-x-4' : ''}`} />
                <input type="checkbox" className="sr-only" checked={normalizeUSD} onChange={(e) => setNormalizeUSD(e.target.checked)} />
              </div>
              <span className="text-xs font-medium text-on-surface-variant whitespace-nowrap group-hover:text-on-surface">
                Normalize to USD
              </span>
            </label>

            <span className="ml-auto text-xs text-on-surface-variant whitespace-nowrap">
              {filtered.length} instruments
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-[1400px] px-6 py-6">

        {error && (
          <div className="mb-4 rounded-xl bg-error-container/60 border border-error/20 p-4 text-sm text-on-error-container">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Column header legend */}
        {!loading && filtered.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] text-on-surface-variant">
            <span><strong>Score</strong> = weighted composite (0–100 percentile)</span>
            <span><strong>Equity factors:</strong> Momentum 40% · Trend 20% · Earnings 20% · Quality 10% · Risk 10%</span>
            <span><strong>Futures factors:</strong> Momentum 50% · Term Structure 20% · Volatility 20% · Liquidity 10%</span>
            <span>Click any row to expand details · Rankings within peer group</span>
          </div>
        )}

        <RankingTable results={filtered} loading={loading} normalizeUSD={normalizeUSD} />

        {!loading && filtered.length > 0 && (
          <p className="mt-4 text-[10px] text-on-surface-variant/40 text-center">
            Factor model: Momentum (6M skip 1M, 12M, RS vs benchmark, dist. to 52w high) · Trend (vs 200/50MA, slope, % days above MA50) ·
            Earnings (EPS/Rev growth YoY, EPS surprise) · Quality (ROE, gross margin, debt/EBITDA) · Risk (ATR%, max drawdown, vol contraction).
            Rankings are percentiles within each peer group (MERVAL / US equities / ROFEX futures). CEDEAR = Argentine depositary receipt listed on BYMA.
            ROFEX futures data via CBOT/CME proxies · Educational use only — not investment advice.
          </p>
        )}
      </div>
    </div>
  )
}
