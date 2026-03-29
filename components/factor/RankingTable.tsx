'use client'
import { useState, useMemo } from 'react'
import type { RankedInstrument } from '@/app/api/factor-ranking/route'
import { ScoreBar, ScoreBadge } from './ScoreBar'

type SortKey = 'rank' | 'finalScore' | 'momentum' | 'trend' | 'earnings' | 'quality' | 'risk' |
  'termStructure' | 'volatility' | 'liquidity' | 'change1DPct' | 'price'

interface Props {
  results: RankedInstrument[]
  loading: boolean
  normalizeUSD: boolean
}

function isEquityScores(s: RankedInstrument['factorScores']): s is {
  momentum: number; trend: number; earnings: number; quality: number; risk: number; finalScore: number
} {
  return 'trend' in s
}

function isFuturesScores(s: RankedInstrument['factorScores']): s is {
  momentum: number; termStructure: number; volatility: number; liquidity: number; finalScore: number
} {
  return 'termStructure' in s
}

function ChangeCell({ pct }: { pct: number }) {
  const up = pct >= 0
  return (
    <span className={`text-xs font-semibold tabular-nums ${up ? 'text-secondary dark:text-secondary-container' : 'text-error dark:text-error-container'}`}>
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function MetricPill({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === undefined) return null
  const isGood = label.includes('Gr') || label.includes('Ret') || label === 'ROE' || label === 'Trend'
  const isBad  = label === 'ATR%' || label === 'Max DD 6M'
  const good = isGood ? value > 0 : !isBad ? true : false
  const cls = isGood
    ? (value > 0 ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-error-container/30 text-on-error-container')
    : isBad
      ? (value < 3 ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-error-container/30 text-on-error-container')
      : 'bg-surface-container text-on-surface-variant'
  void good
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium ${cls}`}>
      {label} <strong>{typeof value === 'number' && !isNaN(value) ? `${value > 0 && isGood ? '+' : ''}${value.toFixed(1)}%` : '—'}</strong>
    </span>
  )
}

export default function RankingTable({ results, loading, normalizeUSD }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'rank' ? 'asc' : 'desc') }
  }

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      let av: number, bv: number
      switch (sortKey) {
        case 'rank':          av = a.rank;          bv = b.rank;          break
        case 'finalScore':    av = a.finalScore;    bv = b.finalScore;    break
        case 'change1DPct':   av = a.change1DPct;   bv = b.change1DPct;   break
        case 'price':         av = a.price;         bv = b.price;         break
        case 'momentum':      av = a.factorScores.momentum;  bv = b.factorScores.momentum;  break
        case 'trend':
          av = isEquityScores(a.factorScores) ? a.factorScores.trend : 0
          bv = isEquityScores(b.factorScores) ? b.factorScores.trend : 0
          break
        case 'earnings':
          av = isEquityScores(a.factorScores) ? a.factorScores.earnings : 0
          bv = isEquityScores(b.factorScores) ? b.factorScores.earnings : 0
          break
        case 'quality':
          av = isEquityScores(a.factorScores) ? a.factorScores.quality : 0
          bv = isEquityScores(b.factorScores) ? b.factorScores.quality : 0
          break
        case 'risk':
          av = isEquityScores(a.factorScores) ? a.factorScores.risk : 0
          bv = isEquityScores(b.factorScores) ? b.factorScores.risk : 0
          break
        case 'termStructure':
          av = isFuturesScores(a.factorScores) ? a.factorScores.termStructure : 0
          bv = isFuturesScores(b.factorScores) ? b.factorScores.termStructure : 0
          break
        case 'volatility':
          av = isFuturesScores(a.factorScores) ? a.factorScores.volatility : 0
          bv = isFuturesScores(b.factorScores) ? b.factorScores.volatility : 0
          break
        case 'liquidity':
          av = isFuturesScores(a.factorScores) ? a.factorScores.liquidity : 0
          bv = isFuturesScores(b.factorScores) ? b.factorScores.liquidity : 0
          break
        default: av = a.rank; bv = b.rank
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [results, sortKey, sortDir])

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th
        className="px-3 py-2.5 text-left cursor-pointer select-none whitespace-nowrap"
        onClick={() => toggleSort(k)}
      >
        <span className={`flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider ${active ? 'text-primary dark:text-primary-fixed-dim' : 'text-on-surface-variant dark:text-white/30'}`}>
          {label}
          <span className={`text-[8px] ${active ? 'opacity-100' : 'opacity-30'}`}>
            {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </span>
      </th>
    )
  }

  const MARKET_COLORS: Record<string, string> = {
    MERVAL: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    NYSE:   'bg-primary-fixed/60 text-on-primary-fixed-variant dark:bg-primary-fixed/20 dark:text-primary-fixed-dim',
    NASDAQ: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
    ROFEX:  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-container dark:bg-white/5" />
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-on-surface-variant dark:text-white/30">
        No instruments match the current filters.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8">
      <table className="w-full min-w-[1100px] text-sm border-collapse">
        <thead className="bg-surface-container-low dark:bg-white/[0.03] sticky top-0 z-10">
          <tr>
            <SortHeader label="#" k="rank" />
            <th className="px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant dark:text-white/30 whitespace-nowrap">Instrument</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant dark:text-white/30">Market</th>
            <SortHeader label="Price" k="price" />
            <SortHeader label="1D %" k="change1DPct" />
            <SortHeader label="Score" k="finalScore" />
            <SortHeader label="Momentum" k="momentum" />
            <SortHeader label="Trend" k="trend" />
            <SortHeader label="Earnings" k="earnings" />
            <SortHeader label="Quality" k="quality" />
            <SortHeader label="Risk" k="risk" />
            <th className="px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant dark:text-white/30">Tags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10 dark:divide-white/[0.04]">
          {sorted.map((row) => {
            const isExpanded = expandedTicker === row.ticker
            const isEq = isEquityScores(row.factorScores)
            const fs = row.factorScores

            return (
              <>
                <tr
                  key={row.ticker}
                  className="hover:bg-primary-fixed/10 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                  onClick={() => setExpandedTicker(isExpanded ? null : row.ticker)}
                >
                  {/* Rank */}
                  <td className="px-3 py-3 tabular-nums font-mono text-xs text-on-surface-variant dark:text-white/30">
                    {row.rank}
                  </td>

                  {/* Instrument */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div>
                        <p className="font-headline font-bold text-sm text-primary dark:text-primary-fixed-dim">{row.displayTicker}</p>
                        <p className="text-[10px] text-on-surface-variant dark:text-white/30 max-w-[160px] truncate">{row.name}</p>
                      </div>
                    </div>
                  </td>

                  {/* Market */}
                  <td className="px-3 py-3">
                    <span className={`text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${MARKET_COLORS[row.market] ?? 'bg-surface-container text-on-surface-variant'}`}>
                      {row.market}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-3 py-3 tabular-nums text-sm font-semibold text-on-surface dark:text-white/80">
                    {normalizeUSD && row.currency === 'USD' ? '$' : row.currency === 'ARS' ? '$' : '$'}
                    {row.price < 10 ? row.price.toFixed(3) : row.price < 100 ? row.price.toFixed(2) : row.price.toFixed(0)}
                    {!normalizeUSD && row.currency === 'ARS' && <span className="text-[9px] text-on-surface-variant dark:text-white/20 ml-0.5">ARS</span>}
                  </td>

                  {/* 1D % */}
                  <td className="px-3 py-3">
                    <ChangeCell pct={row.change1DPct} />
                  </td>

                  {/* Final Score */}
                  <td className="px-3 py-3 min-w-[100px]">
                    <ScoreBar score={row.finalScore} />
                  </td>

                  {/* Momentum */}
                  <td className="px-3 py-3 min-w-[80px]">
                    <ScoreBar score={fs.momentum} size="sm" />
                  </td>

                  {/* Trend (equity) / TermStructure (futures) */}
                  <td className="px-3 py-3 min-w-[80px]">
                    {isEq
                      ? <ScoreBar score={(fs as { trend: number }).trend} size="sm" />
                      : <ScoreBar score={isFuturesScores(fs) ? fs.termStructure : 50} size="sm" />
                    }
                  </td>

                  {/* Earnings (equity) / Volatility (futures) */}
                  <td className="px-3 py-3 min-w-[80px]">
                    {isEq
                      ? <ScoreBar score={(fs as { earnings: number }).earnings} size="sm" />
                      : <ScoreBar score={isFuturesScores(fs) ? fs.volatility : 50} size="sm" />
                    }
                  </td>

                  {/* Quality (equity) / Liquidity (futures) */}
                  <td className="px-3 py-3 min-w-[80px]">
                    {isEq
                      ? <ScoreBar score={(fs as { quality: number }).quality} size="sm" />
                      : <ScoreBar score={isFuturesScores(fs) ? fs.liquidity : 50} size="sm" />
                    }
                  </td>

                  {/* Risk (equity only) */}
                  <td className="px-3 py-3 min-w-[80px]">
                    {isEq
                      ? <ScoreBar score={(fs as { risk: number }).risk} size="sm" />
                      : <span className="text-[10px] text-on-surface-variant/40 dark:text-white/15">—</span>
                    }
                  </td>

                  {/* Tags */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.isCedear && (
                        <span className="text-[9px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-secondary-container/40 text-on-secondary-container dark:bg-secondary/20 dark:text-secondary-container">
                          CEDEAR
                        </span>
                      )}
                      {row.assetType === 'future' && (
                        <span className="text-[9px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-tertiary-fixed/40 text-on-tertiary-fixed-variant dark:bg-amber-500/20 dark:text-amber-400">
                          FUT
                        </span>
                      )}
                      <ScoreBadge score={row.finalScore} />
                    </div>
                  </td>
                </tr>

                {/* Expanded detail row */}
                {isExpanded && (
                  <tr key={`${row.ticker}-detail`} className="bg-surface-container-low dark:bg-white/[0.025]">
                    <td colSpan={12} className="px-6 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                        {/* Factor breakdown */}
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant dark:text-white/30 mb-2">
                            Factor Breakdown
                          </p>
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-xs text-on-surface-variant dark:text-white/40">Momentum (40%)</span>
                              </div>
                              <ScoreBar score={fs.momentum} />
                            </div>
                            {isEq ? (
                              <>
                                <div>
                                  <span className="text-xs text-on-surface-variant dark:text-white/40">Trend (20%)</span>
                                  <ScoreBar score={(fs as { trend: number }).trend} />
                                </div>
                                <div>
                                  <span className="text-xs text-on-surface-variant dark:text-white/40">Earnings (20%)</span>
                                  <ScoreBar score={(fs as { earnings: number }).earnings} />
                                </div>
                                <div>
                                  <span className="text-xs text-on-surface-variant dark:text-white/40">Quality (10%)</span>
                                  <ScoreBar score={(fs as { quality: number }).quality} />
                                </div>
                                <div>
                                  <span className="text-xs text-on-surface-variant dark:text-white/40">Risk (10%)</span>
                                  <ScoreBar score={(fs as { risk: number }).risk} />
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className="text-xs text-on-surface-variant dark:text-white/40">Term Structure (20%)</span>
                                  <ScoreBar score={isFuturesScores(fs) ? fs.termStructure : 50} />
                                </div>
                                <div>
                                  <span className="text-xs text-on-surface-variant dark:text-white/40">Volatility (20%)</span>
                                  <ScoreBar score={isFuturesScores(fs) ? fs.volatility : 50} />
                                </div>
                                <div>
                                  <span className="text-xs text-on-surface-variant dark:text-white/40">Liquidity (10%)</span>
                                  <ScoreBar score={isFuturesScores(fs) ? fs.liquidity : 50} />
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Key metrics */}
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant dark:text-white/30 mb-2">
                            Key Metrics
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.keyMetrics).map(([k, v]) => (
                              <MetricPill key={k} label={k} value={v} />
                            ))}
                          </div>
                        </div>

                        {/* CEDEAR info + identity */}
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant dark:text-white/30 mb-2">
                            Instrument Details
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant dark:text-white/30">Ticker</span>
                              <span className="font-mono font-bold text-on-surface dark:text-white/80">{row.ticker}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant dark:text-white/30">Market</span>
                              <span className="font-semibold text-on-surface dark:text-white/70">{row.market}</span>
                            </div>
                            {row.sector && (
                              <div className="flex justify-between">
                                <span className="text-on-surface-variant dark:text-white/30">Sector</span>
                                <span className="font-semibold text-on-surface dark:text-white/70">{row.sector}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant dark:text-white/30">Currency</span>
                              <span className="font-semibold text-on-surface dark:text-white/70">{row.currency}</span>
                            </div>
                            {row.isCedear && (
                              <>
                                <div className="flex justify-between border-t border-outline-variant/10 dark:border-white/5 pt-1 mt-1">
                                  <span className="text-on-surface-variant dark:text-white/30">CEDEAR Ticker (BYMA)</span>
                                  <span className="font-mono font-bold text-secondary dark:text-secondary-container">{row.cedearTicker}</span>
                                </div>
                                {row.cedearRatio && (
                                  <div className="flex justify-between">
                                    <span className="text-on-surface-variant dark:text-white/30">CEDEAR Ratio</span>
                                    <span className="font-semibold text-on-surface dark:text-white/70">{row.cedearRatio}:1</span>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex justify-between border-t border-outline-variant/10 dark:border-white/5 pt-1 mt-1">
                              <span className="text-on-surface-variant dark:text-white/30">Market Rank</span>
                              <span className="font-bold text-on-surface dark:text-white/80">#{row.marketRank} in {row.market}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
