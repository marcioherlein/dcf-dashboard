'use client'
import { useState, useEffect, useCallback } from 'react'
import type { RankedInstrument } from '@/app/api/factor-ranking/route'
import TickerMarquee from '@/components/screener/TickerMarquee'
import BubbleMap from '@/components/screener/BubbleMap'
import WarrenTable from '@/components/screener/WarrenTable'

type MarketFilter = 'all' | 'MERVAL' | 'NYSE' | 'NASDAQ' | 'ROFEX' | 'US'
type AssetFilter  = 'all' | 'equity' | 'future'

interface Metadata {
  computedAt: string
  totalInstruments: number
  marketCounts: Record<string, number>
  normalizedToUSD: boolean
  arsUsdRate?: number
}

const MARKET_OPTIONS: { id: MarketFilter; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'MERVAL', label: '🇦🇷 MERVAL' },
  { id: 'US',     label: '🇺🇸 US' },
  { id: 'NYSE',   label: 'NYSE' },
  { id: 'NASDAQ', label: 'NASDAQ' },
  { id: 'ROFEX',  label: '🌽 ROFEX' },
]

// KPI stats derived from data
function computeStats(instruments: RankedInstrument[]) {
  const total = instruments.length
  if (total === 0) return { total: 0, aboveEMA200: 0, rsGt70: 0, aboveSMA50: 0, unusualVol: 0, quality: 0 }

  let aboveEMA200 = 0, rsGt70 = 0, aboveSMA50 = 0, unusualVol = 0, quality = 0
  for (const inst of instruments) {
    const scores = inst.factorScores as unknown as Record<string, number>
    const km = inst.keyMetrics as Record<string, number | null>
    const rs = scores.momentum ?? 50
    const vs200 = km['vs 200MA'] ?? null
    const vs50  = km['vs 50MA'] ?? null
    const volC  = km['Vol Contract'] ?? null

    if (vs200 !== null && vs200 > 0) aboveEMA200++
    if (rs >= 70) rsGt70++
    if (vs50 !== null && vs50 > 0) aboveSMA50++
    if (volC !== null && volC > 1.1) unusualVol++  // volume expansion
    if (inst.finalScore >= 70) quality++
  }

  return { total, aboveEMA200, rsGt70, aboveSMA50, unusualVol, quality }
}

export default function FactorRankingPage() {
  const [market, setMarket]         = useState<MarketFilter>('all')
  const [assetType, setAssetType]   = useState<AssetFilter>('all')
  const [sector, setSector]         = useState('all')
  const [onlyCedear, setOnlyCedear] = useState(false)
  const [noMaxFrom52w, setNoMaxFrom52w] = useState(false)

  const [results, setResults]   = useState<RankedInstrument[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [activeView, setActiveView] = useState<'bubble' | 'table'>('table')

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    const marketParam = market === 'US' ? 'NYSE,NASDAQ' : market !== 'all' ? market : 'all'
    if (marketParam !== 'all') params.set('market', marketParam)
    if (onlyCedear) params.set('cedear', '1')

    try {
      const res  = await fetch(`/api/factor-ranking?${params}`)
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
  }, [market, onlyCedear])

  useEffect(() => { fetchRankings() }, [fetchRankings])

  // Client-side filters
  const filtered = results.filter((r) => {
    if (assetType !== 'all' && r.assetType !== assetType) return false
    if (sector !== 'all' && r.sector !== sector) return false
    if (noMaxFrom52w) {
      const dist = (r.keyMetrics as Record<string, number | null>)['Dist 52w Hi'] ?? null
      if (dist === null || dist < -25) return false
    }
    return true
  })

  const sectors  = ['all', ...Array.from(new Set(results.filter((r) => r.sector).map((r) => r.sector!)))]
  const stats    = computeStats(filtered)

  const kpiCards = [
    { label: 'Active Tickers', value: stats.total, color: '#06101F' },
    { label: 'Above EMA 200', value: stats.aboveEMA200, color: '#11875D', pct: stats.total ? Math.round(stats.aboveEMA200 / stats.total * 100) : 0 },
    { label: 'RS Score > 70', value: stats.rsGt70, color: '#11875D', pct: stats.total ? Math.round(stats.rsGt70 / stats.total * 100) : 0 },
    { label: 'Above SMA 50', value: stats.aboveSMA50, color: '#B56A00', pct: stats.total ? Math.round(stats.aboveSMA50 / stats.total * 100) : 0 },
    { label: 'Vol Expansion', value: stats.unusualVol, color: '#B56A00', pct: stats.total ? Math.round(stats.unusualVol / stats.total * 100) : 0 },
    { label: 'Quality ≥ 70', value: stats.quality, color: '#2563EB', pct: stats.total ? Math.round(stats.quality / stats.total * 100) : 0 },
  ]

  return (
    <div className="flex flex-col min-h-dvh bg-[#F4F3EF]">

      {/* Ticker Marquee */}
      <TickerMarquee instruments={results} />

      {/* Page title */}
      <div className="px-4 sm:px-6 py-4 border-b border-[#E3E1DA] bg-white flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-[#06101F] tracking-tight">Market Screener</h1>
          <p className="text-[12px] text-[#566174] mt-0.5">
            Multi-factor ranking · MERVAL · NYSE · NASDAQ · ROFEX
            {lastFetch && <> · <span className="text-[#8A95A6]">updated {lastFetch.toLocaleTimeString()}</span></>}
          </p>
        </div>
        <button
          onClick={fetchRankings}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E3E1DA] text-xs font-medium text-[#566174] hover:bg-[#F4F3EF] transition-colors disabled:opacity-50"
        >
          <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-[#E3E1DA] bg-white flex flex-wrap items-center gap-3">
        {/* Market filter pills */}
        <div className="flex gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {MARKET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMarket(opt.id)}
              className={[
                'px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors shrink-0 min-h-[36px]',
                market === opt.id
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F4F3EF] text-[#566174] hover:bg-[#E3E1DA]',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-[#E3E1DA]" />

        {/* Asset type */}
        <select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value as AssetFilter)}
          className="bg-white border border-[#E3E1DA] text-[16px] sm:text-[12px] text-[#566174] rounded-lg px-2 py-1 min-h-[44px] focus:outline-none focus:border-blue-400"
        >
          <option value="all">All Types</option>
          <option value="equity">Equities</option>
          <option value="future">Futures</option>
        </select>

        {/* Sector */}
        {sectors.length > 2 && (
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="bg-white border border-[#E3E1DA] text-[16px] sm:text-[12px] text-[#566174] rounded-lg px-2 py-1 min-h-[44px] focus:outline-none focus:border-blue-400"
          >
            {sectors.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Sectors' : s}</option>
            ))}
          </select>
        )}

        {/* Toggles */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <div className={`relative w-7 h-4 rounded-full transition-colors ${onlyCedear ? 'bg-[#EAF1FF]0' : 'bg-[#E3E1DA]'}`}>
            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${onlyCedear ? 'translate-x-3' : ''}`} />
            <input type="checkbox" className="sr-only" checked={onlyCedear} onChange={(e) => setOnlyCedear(e.target.checked)} />
          </div>
          <span className="text-[12px] text-[#566174]">CEDEARs</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <div className={`relative w-7 h-4 rounded-full transition-colors ${noMaxFrom52w ? 'bg-[#EAF1FF]0' : 'bg-[#E3E1DA]'}`}>
            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${noMaxFrom52w ? 'translate-x-3' : ''}`} />
            <input type="checkbox" className="sr-only" checked={noMaxFrom52w} onChange={(e) => setNoMaxFrom52w(e.target.checked)} />
          </div>
          <span className="text-[12px] text-[#566174]">Within 25% of 52w High</span>
        </label>

        {/* View toggle */}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setActiveView('table')}
            className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${activeView === 'table' ? 'bg-[#F4F3EF] text-[#06101F]' : 'text-[#8A95A6] hover:text-[#566174]'}`}
          >
            ≡ Table
          </button>
          <button
            onClick={() => setActiveView('bubble')}
            className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${activeView === 'bubble' ? 'bg-[#F4F3EF] text-[#06101F]' : 'text-[#8A95A6] hover:text-[#566174]'}`}
          >
            ⬤ Map
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[#E3E1DA] border-b border-[#E3E1DA]">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-white px-4 py-3 flex flex-col gap-0.5">
            <span className="text-[10px] text-[#8A95A6] font-medium uppercase tracking-wide">{kpi.label}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold" style={{ color: kpi.color }}>{loading ? '—' : kpi.value}</span>
              {kpi.pct !== undefined && !loading && kpi.value > 0 && (
                <span className="text-[10px] text-[#8A95A6]">{kpi.pct}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-[#FCEAEA] border border-[#D83B3B]/30 px-4 py-3 text-xs text-[#D83B3B]">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-40 text-[#8A95A6] text-sm">
            <svg className="animate-spin w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Ranking {metadata?.totalInstruments ?? '…'} instruments…
          </div>
        )}

        {!loading && activeView === 'table' && (
          <div className="flex-1">
            <WarrenTable instruments={filtered} />
          </div>
        )}

        {!loading && activeView === 'bubble' && filtered.length > 0 && (
          <div className="p-6">
            <div className="bg-white rounded-xl border border-[#E3E1DA] p-4">
              <h2 className="text-xs font-semibold text-[#566174] uppercase tracking-wider mb-4">
                RS Score vs Distance from 52w High
              </h2>
              <BubbleMap instruments={filtered} />
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && activeView === 'table' && (
          <div className="px-4 py-2 border-t border-[#E3E1DA] text-[10px] text-[#8A95A6] flex flex-wrap gap-x-6 gap-y-1">
            <span><span className="text-[#566174] font-medium">Score</span> = weighted percentile within peer group (0–100)</span>
            <span><span className="text-[#566174] font-medium">Equity:</span> Momentum 40% · Trend 20% · Earnings 20% · Quality 10% · Risk 10%</span>
            <span><span className="text-[#566174] font-medium">Futures:</span> Momentum 50% · Term Structure 20% · Vol 20% · Liquidity 10%</span>
            <span className="ml-auto">{filtered.length} of {results.length} instruments shown</span>
          </div>
        )}

        {!loading && filtered.length === 0 && !error && results.length > 0 && (
          <div className="flex items-center justify-center h-32 text-[#8A95A6] text-sm">
            No instruments match current filters.
          </div>
        )}
      </div>
    </div>
  )
}
