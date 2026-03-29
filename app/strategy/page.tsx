'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RankedInstrument } from '@/app/api/factor-ranking/route'
import type { StrategyReport } from '@/lib/strategy/types'
import { generateStrategy, computePeerStats } from '@/lib/strategy/generateStrategy'
import StrategyCard from '@/components/strategy/StrategyCard'
import MetricsDeepDive from '@/components/strategy/MetricsDeepDive'
import FactorExplanationPanel from '@/components/strategy/FactorExplanationPanel'
import StrategyScreeningTable from '@/components/strategy/StrategyScreeningTable'

// ── Market filter options ─────────────────────────────────────────────────────

const MARKETS = [
  { key: 'all',           label: 'All Markets' },
  { key: 'NYSE,NASDAQ',   label: 'US Stocks' },
  { key: 'MERVAL',        label: 'Merval' },
  { key: 'ROFEX',         label: 'Futures' },
]

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-container rounded ${className}`} />
}

function CardSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-48" />
      <div className="space-y-1.5 pt-1">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-5 gap-2 pt-1">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const [reports, setReports] = useState<StrategyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [market, setMarket] = useState('all')
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [selected, setSelected] = useState<StrategyReport | null>(null)
  const [lastFetch, setLastFetch] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ topN: '0' })
      if (market !== 'all') params.set('market', market)

      const res = await fetch(`/api/factor-ranking?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json() as { results: RankedInstrument[]; metadata: { computedAt: string } }
      const all = data.results

      // Generate strategies for all instruments
      const generated: StrategyReport[] = all.map((inst) => {
        const peerStats = computePeerStats(all, inst)
        return generateStrategy(inst, peerStats)
      })

      setReports(generated)
      setLastFetch(new Date(data.metadata.computedAt).toLocaleTimeString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [market])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Close detail panel when market filter changes
  useEffect(() => {
    setSelected(null)
  }, [market])

  // Summary stats
  const stats = {
    strongBuy:  reports.filter((r) => r.tradePlan.recommendation === 'STRONG_BUY').length,
    buy:        reports.filter((r) => r.tradePlan.recommendation === 'BUY').length,
    hold:       reports.filter((r) => r.tradePlan.recommendation === 'HOLD').length,
    avoid:      reports.filter((r) => r.tradePlan.recommendation === 'AVOID' || r.tradePlan.recommendation === 'SHORT_CANDIDATE').length,
    highConv:   reports.filter((r) => r.tradePlan.conviction === 'HIGH').length,
    goodRR:     reports.filter((r) => !r.tradePlan.poorRiskReward && (r.tradePlan.recommendation === 'STRONG_BUY' || r.tradePlan.recommendation === 'BUY')).length,
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page header */}
      <header className="bg-primary px-8 py-6 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-on-primary tracking-tight">Strategy Builder</h1>
            <p className="text-sm text-on-primary-container mt-0.5">
              Multi-factor trading signals — entry, exit, conviction & risk/reward
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastFetch && (
              <span className="text-[11px] text-on-primary-container">Updated {lastFetch}</span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary rounded-xl text-sm font-bold hover:bg-primary-container/80 transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                {loading ? 'progress_activity' : 'refresh'}
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Market filter */}
        <div className="flex gap-2 mt-5">
          {MARKETS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMarket(m.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                market === m.key
                  ? 'bg-on-primary text-primary'
                  : 'bg-white/10 text-on-primary-container hover:bg-white/20'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {/* Stats bar */}
      {!loading && reports.length > 0 && (
        <div className="bg-surface-container-lowest border-b border-outline-variant/10 px-8 py-3 flex items-center gap-6 flex-wrap shrink-0">
          <StatChip label="Strong Buy" value={stats.strongBuy} color="text-secondary" />
          <StatChip label="Buy"        value={stats.buy}       color="text-on-primary-fixed-variant" />
          <StatChip label="Hold"       value={stats.hold}      color="text-on-surface-variant" />
          <StatChip label="Avoid/Short" value={stats.avoid}    color="text-error" />
          <div className="h-4 w-px bg-outline-variant/30" />
          <StatChip label="High Conviction" value={stats.highConv} color="text-secondary" />
          <StatChip label="Good R/R Buys"   value={stats.goodRR}   color="text-primary" />
          <div className="ml-auto flex gap-1">
            <ViewToggle active={view === 'table'} onClick={() => setView('table')} icon="table_rows" label="Table" />
            <ViewToggle active={view === 'cards'} onClick={() => setView('cards')} icon="grid_view"  label="Cards" />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="m-6 p-4 bg-error-container/30 border border-error/20 rounded-xl text-sm text-on-error-container">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: table or cards */}
        <div className={`flex-1 overflow-y-auto ${selected ? 'lg:w-0' : ''}`}>
          {loading ? (
            view === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="p-6 space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            )
          ) : view === 'table' ? (
            <div className="bg-surface-container-lowest rounded-xl m-6 shadow-sm overflow-hidden border border-outline-variant/10">
              <StrategyScreeningTable
                reports={reports}
                onSelect={(r) => setSelected((prev) => prev?.ticker === r.ticker ? null : r)}
                selectedTicker={selected?.ticker}
                marketFilter={market}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
              {reports
                .filter((r) => {
                  if (market === 'all') return true
                  const markets = market.split(',')
                  return markets.includes(r.market)
                })
                .map((r) => (
                  <StrategyCard
                    key={r.ticker}
                    report={r}
                    onSelect={() => setSelected((prev) => prev?.ticker === r.ticker ? null : r)}
                    selected={selected?.ticker === r.ticker}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selected && (
          <aside className="w-[380px] shrink-0 border-l border-outline-variant/10 overflow-y-auto bg-surface-container-lowest">
            <div className="sticky top-0 bg-surface-container-lowest z-10 flex items-center justify-between px-5 py-3 border-b border-outline-variant/10">
              <div>
                <span className="font-extrabold text-primary">{selected.displayTicker}</span>
                <span className="text-xs text-on-surface-variant ml-2">{selected.name}</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Strategy Card (compact) */}
              <StrategyCard report={selected} selected />

              {/* Factor explanation */}
              <FactorExplanationPanel
                explanation={selected.explanation}
                tradePlan={selected.tradePlan}
                peerGroupSize={selected.peerGroupSize}
              />

              {/* Deep dive */}
              <MetricsDeepDive
                factorAlignment={selected.factorAlignment}
                keyMetrics={selected.keyMetrics}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

// ── Small helper components ───────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-extrabold ${color}`}>{value}</span>
      <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wide">{label}</span>
    </div>
  )
}

function ViewToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
        active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
      }`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  )
}
