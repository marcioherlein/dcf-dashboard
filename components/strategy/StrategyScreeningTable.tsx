'use client'

import { useState, useMemo } from 'react'
import type { StrategyReport } from '@/lib/strategy/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'finalScore' | 'recommendation' | 'conviction' | 'targetPct' | 'stopPct' | 'rr' | 'ticker'

const REC_ORDER: Record<string, number> = {
  STRONG_BUY: 0,
  BUY: 1,
  HOLD: 2,
  AVOID: 3,
  SHORT_CANDIDATE: 4,
}

const CONVICTION_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const REC_LABELS: Record<string, string> = {
  STRONG_BUY: 'Strong Buy',
  BUY: 'Buy',
  HOLD: 'Hold',
  AVOID: 'Avoid',
  SHORT_CANDIDATE: 'Short',
}

const REC_PILL: Record<string, string> = {
  STRONG_BUY:      'bg-secondary-container/50 text-on-secondary-container',
  BUY:             'bg-primary-fixed/40 text-on-primary-fixed-variant',
  HOLD:            'bg-surface-container text-on-surface-variant',
  AVOID:           'bg-error-container/40 text-on-error-container',
  SHORT_CANDIDATE: 'bg-error/15 text-error',
}

const CONVICTION_PILL: Record<string, string> = {
  HIGH:   'bg-secondary-container/30 text-on-secondary-container',
  MEDIUM: 'bg-primary-fixed/30 text-on-primary-fixed-variant',
  LOW:    'bg-surface-container-high text-on-surface-variant',
}

// ── Sort header ───────────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  right,
}: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  right?: boolean
}) {
  return (
    <th
      className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-widest cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
      onClick={() => onSort(sortKey)}
    >
      {label}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────

interface StrategyScreeningTableProps {
  reports: StrategyReport[]
  onSelect?: (r: StrategyReport) => void
  selectedTicker?: string
  marketFilter?: string
}

export default function StrategyScreeningTable({
  reports,
  onSelect,
  selectedTicker,
  marketFilter,
}: StrategyScreeningTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('finalScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [recFilter, setRecFilter] = useState<string>('all')
  const [assetFilter, setAssetFilter] = useState<'all' | 'equity' | 'future'>('all')

  function handleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    let rows = reports
    if (marketFilter && marketFilter !== 'all') {
      const markets = marketFilter.toUpperCase().split(',')
      rows = rows.filter((r) => markets.includes(r.market))
    }
    if (recFilter !== 'all') {
      rows = rows.filter((r) => r.tradePlan.recommendation === recFilter)
    }
    if (assetFilter !== 'all') {
      rows = rows.filter((r) => r.assetType === assetFilter)
    }
    return rows
  }, [reports, marketFilter, recFilter, assetFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'finalScore':    diff = a.finalScore - b.finalScore; break
        case 'recommendation': diff = REC_ORDER[a.tradePlan.recommendation] - REC_ORDER[b.tradePlan.recommendation]; break
        case 'conviction':    diff = CONVICTION_ORDER[a.tradePlan.conviction] - CONVICTION_ORDER[b.tradePlan.conviction]; break
        case 'targetPct':     diff = a.tradePlan.exitLevels.primaryTarget.pctFromCurrent - b.tradePlan.exitLevels.primaryTarget.pctFromCurrent; break
        case 'stopPct':       diff = a.tradePlan.exitLevels.stopLoss.pctFromCurrent - b.tradePlan.exitLevels.stopLoss.pctFromCurrent; break
        case 'rr':            diff = a.tradePlan.riskRewardRatio - b.tradePlan.riskRewardRatio; break
        case 'ticker':        diff = a.displayTicker.localeCompare(b.displayTicker); break
      }
      return sortDir === 'asc' ? diff : -diff
    })
  }, [filtered, sortKey, sortDir])

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest flex-wrap">
        <div className="flex gap-1">
          {(['all', 'STRONG_BUY', 'BUY', 'HOLD', 'AVOID', 'SHORT_CANDIDATE'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRecFilter(r)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
                recFilter === r
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {r === 'all' ? 'All' : REC_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-outline-variant/30" />
        <div className="flex gap-1">
          {(['all', 'equity', 'future'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAssetFilter(a)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
                assetFilter === a
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {a === 'all' ? 'All' : a === 'equity' ? 'Stocks' : 'Futures'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-on-surface-variant font-medium">{sorted.length} instruments</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-surface-container-low/50 border-b border-outline-variant/10">
              <SortHeader label="Ticker"      sortKey="ticker"         active={sortKey === 'ticker'}         dir={sortDir} onSort={handleSort} />
              <SortHeader label="Signal"      sortKey="recommendation" active={sortKey === 'recommendation'} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Conviction"  sortKey="conviction"     active={sortKey === 'conviction'}     dir={sortDir} onSort={handleSort} />
              <SortHeader label="Score"       sortKey="finalScore"     active={sortKey === 'finalScore'}     dir={sortDir} onSort={handleSort} right />
              <th className="px-4 py-3 text-left text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">Entry</th>
              <SortHeader label="Target %"   sortKey="targetPct"      active={sortKey === 'targetPct'}      dir={sortDir} onSort={handleSort} right />
              <SortHeader label="Stop %"     sortKey="stopPct"        active={sortKey === 'stopPct'}        dir={sortDir} onSort={handleSort} right />
              <SortHeader label="R/R"        sortKey="rr"             active={sortKey === 'rr'}             dir={sortDir} onSort={handleSort} right />
              <th className="px-4 py-3 text-left text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">Horizon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {sorted.map((r) => {
              const tp = r.tradePlan
              const targetPct = tp.exitLevels.primaryTarget.pctFromCurrent
              const stopPct = tp.exitLevels.stopLoss.pctFromCurrent
              const currencySymbol = r.currency === 'USD' ? '$' : r.currency === 'ARS' ? '$' : r.currency

              return (
                <tr
                  key={r.ticker}
                  onClick={() => onSelect?.(r)}
                  className={`cursor-pointer transition-colors ${
                    selectedTicker === r.ticker
                      ? 'bg-primary/6'
                      : 'hover:bg-surface-container-low/50'
                  }`}
                >
                  {/* Ticker */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-primary">{r.displayTicker}</span>
                      {r.isCedear && (
                        <span className="px-1 py-0.5 bg-tertiary-fixed/30 text-on-tertiary-fixed-variant text-[8px] font-bold rounded uppercase">C</span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant truncate max-w-[140px]">{r.name}</p>
                  </td>

                  {/* Signal */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${REC_PILL[tp.recommendation]}`}>
                      {REC_LABELS[tp.recommendation]}
                    </span>
                  </td>

                  {/* Conviction */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${CONVICTION_PILL[tp.conviction]}`}>
                      {tp.conviction}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-extrabold text-primary">{r.finalScore.toFixed(1)}</span>
                  </td>

                  {/* Entry */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-on-surface">
                      {currencySymbol}{r.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {tp.entryZone.waitForPullback && (
                      <span className="ml-1 text-[9px] text-tertiary-fixed-dim font-bold">⚠</span>
                    )}
                  </td>

                  {/* Target % */}
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-bold ${targetPct >= 0 ? 'text-secondary' : 'text-error'}`}>
                      {targetPct >= 0 ? '+' : ''}{targetPct.toFixed(1)}%
                    </span>
                    <div className="text-[10px] text-on-surface-variant">
                      {currencySymbol}{tp.exitLevels.primaryTarget.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>

                  {/* Stop % */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-error">
                      {stopPct.toFixed(1)}%
                    </span>
                    <div className="text-[10px] text-on-surface-variant">
                      {currencySymbol}{tp.exitLevels.stopLoss.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>

                  {/* R/R */}
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-extrabold ${tp.poorRiskReward ? 'text-on-surface-variant' : 'text-secondary'}`}>
                      {tp.riskRewardRatio.toFixed(1)}×
                    </span>
                  </td>

                  {/* Horizon */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-on-surface-variant">{tp.timeHorizon}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="py-12 text-center text-on-surface-variant text-sm">
            No instruments match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}
