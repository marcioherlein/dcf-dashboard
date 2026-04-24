'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ValuationMetrics } from '@/lib/ai-stack/scoring'
import { metricColor, getScoreLabel } from '@/lib/ai-stack/scoring'
import { LAYER_COLORS } from '@/lib/ai-stack/tickers'

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtNum(v: number | null, decimals = 1): string {
  if (v === null || !isFinite(v)) return '—'
  return v.toFixed(decimals)
}

function fmtPct(v: number | null, isDecimal = true): string {
  if (v === null || !isFinite(v)) return '—'
  const val = isDecimal ? v * 100 : v
  return (val >= 0 ? '+' : '') + val.toFixed(1) + '%'
}

function fmtPctPlain(v: number | null, isDecimal = true): string {
  if (v === null || !isFinite(v)) return '—'
  const val = isDecimal ? v * 100 : v
  return val.toFixed(1) + '%'
}

function fmtMktCap(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9)  return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(0) + 'M'
  return '$' + v.toFixed(0)
}

function fmtPrice(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  if (v >= 1000) return '$' + v.toFixed(0)
  return '$' + v.toFixed(2)
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey = keyof ValuationMetrics
type SortDir = 'asc' | 'desc'

const LAYER_LABELS: Record<number, string> = {
  0:  'L0 Edge',
  1:  'L1 Hyperscalers',
  2:  'L2 GPU Cloud',
  3:  'L3 DC Facilities',
  4:  'L4 Chip Design',
  5:  'L5 Semi Mfg',
  6:  'L6 Connectivity',
  7:  'L7 Optical',
  8:  'L8 Networking',
  9:  'L9 Rack/OEM',
  10: 'L10 Power/Cool',
  11: 'L11 Power Semi',
  12: 'L12 Construction',
  13: 'L13 Logistics',
  14: 'L14 Energy',
  15: 'L15 Materials',
}

// ─── Table column config ─────────────────────────────────────────────────────

interface ColDef {
  key: SortKey
  label: string
  tooltip: string
  fmt: (row: ValuationMetrics) => string
  colorFn?: (row: ValuationMetrics) => string
  defaultDir?: SortDir
}

const COLUMNS: ColDef[] = [
  {
    key: 'price', label: 'Price', tooltip: 'Last price from Yahoo Finance',
    fmt: r => fmtPrice(r.price),
    defaultDir: 'desc',
  },
  {
    key: 'marketCap', label: 'Mkt Cap', tooltip: 'Market capitalization',
    fmt: r => fmtMktCap(r.marketCap),
    defaultDir: 'desc',
  },
  {
    key: 'change1d', label: '1D%', tooltip: 'Today\'s price change %',
    fmt: r => fmtPct(r.change1d, false),
    colorFn: r => r.change1d === null ? 'text-slate-400' : r.change1d >= 0 ? 'text-emerald-600' : 'text-red-500',
    defaultDir: 'desc',
  },
  {
    key: 'change52w', label: '52W%', tooltip: '52-week price performance',
    fmt: r => fmtPct(r.change52w),
    colorFn: r => r.change52w === null ? 'text-slate-400' : r.change52w >= 0 ? 'text-emerald-600' : 'text-red-500',
    defaultDir: 'desc',
  },
  {
    key: 'pe', label: 'P/E', tooltip: 'Price / Trailing 12-month EPS',
    fmt: r => fmtNum(r.pe),
    colorFn: r => metricColor(r.pe, 'pe'),
    defaultDir: 'asc',
  },
  {
    key: 'forwardPe', label: 'Fwd P/E', tooltip: 'Price / Forward EPS estimate',
    fmt: r => fmtNum(r.forwardPe),
    colorFn: r => metricColor(r.forwardPe, 'pe'),
    defaultDir: 'asc',
  },
  {
    key: 'peg', label: 'PEG', tooltip: 'PEG = P/E ÷ EPS growth rate. < 1 is considered undervalued (Lynch/Buffett)',
    fmt: r => fmtNum(r.peg),
    colorFn: r => metricColor(r.peg, 'peg'),
    defaultDir: 'asc',
  },
  {
    key: 'pfcf', label: 'P/FCF', tooltip: 'Price / Free Cash Flow. < 15x is attractive.',
    fmt: r => fmtNum(r.pfcf),
    colorFn: r => metricColor(r.pfcf, 'pfcf'),
    defaultDir: 'asc',
  },
  {
    key: 'pb', label: 'P/B', tooltip: 'Price / Book Value. Buffett: buy below book when possible.',
    fmt: r => fmtNum(r.pb),
    colorFn: r => metricColor(r.pb, 'pb'),
    defaultDir: 'asc',
  },
  {
    key: 'ps', label: 'P/S', tooltip: 'Price / Sales (TTM). < 3x often attractive.',
    fmt: r => fmtNum(r.ps),
    colorFn: r => metricColor(r.ps, 'ps'),
    defaultDir: 'asc',
  },
  {
    key: 'evEbitda', label: 'EV/EBITDA', tooltip: 'Enterprise Value / EBITDA. Preferred by Damodaran. < 12x is good.',
    fmt: r => fmtNum(r.evEbitda),
    colorFn: r => metricColor(r.evEbitda, 'evEbitda'),
    defaultDir: 'asc',
  },
  {
    key: 'evRevenue', label: 'EV/Rev', tooltip: 'Enterprise Value / Revenue',
    fmt: r => fmtNum(r.evRevenue),
    colorFn: r => metricColor(r.evRevenue, 'evRev'),
    defaultDir: 'asc',
  },
  {
    key: 'debtToEquity', label: 'D/E%', tooltip: 'Debt/Equity in % (Yahoo format). < 50% = low leverage.',
    fmt: r => r.debtToEquity === null ? '—' : r.debtToEquity.toFixed(0) + '%',
    colorFn: r => metricColor(r.debtToEquity, 'debtEq'),
    defaultDir: 'asc',
  },
  {
    key: 'currentRatio', label: 'Curr Ratio', tooltip: 'Current assets / current liabilities. > 1.5 is healthy.',
    fmt: r => fmtNum(r.currentRatio),
    colorFn: r => metricColor(r.currentRatio, 'current'),
    defaultDir: 'desc',
  },
  {
    key: 'roe', label: 'ROE', tooltip: 'Return on Equity. Buffett target: > 15% consistently.',
    fmt: r => fmtPctPlain(r.roe),
    colorFn: r => metricColor(r.roe, 'roe'),
    defaultDir: 'desc',
  },
  {
    key: 'grossMargin', label: 'Gross Mgn', tooltip: 'Gross Margin % — moat indicator. Buffett loves > 40%.',
    fmt: r => fmtPctPlain(r.grossMargin),
    colorFn: r => metricColor(r.grossMargin, 'margin'),
    defaultDir: 'desc',
  },
  {
    key: 'operatingMargin', label: 'Op Mgn', tooltip: 'Operating Margin %',
    fmt: r => fmtPctPlain(r.operatingMargin),
    colorFn: r => metricColor(r.operatingMargin, 'margin'),
    defaultDir: 'desc',
  },
  {
    key: 'revenueGrowth', label: 'Rev Growth', tooltip: 'YoY Revenue Growth %',
    fmt: r => fmtPct(r.revenueGrowth),
    colorFn: r => metricColor(r.revenueGrowth, 'growth'),
    defaultDir: 'desc',
  },
  {
    key: 'earningsGrowth', label: 'EPS Growth', tooltip: 'YoY Earnings Growth %',
    fmt: r => fmtPct(r.earningsGrowth),
    colorFn: r => metricColor(r.earningsGrowth, 'growth'),
    defaultDir: 'desc',
  },
  {
    key: 'fcfYield', label: 'FCF Yield', tooltip: 'Free Cash Flow / Market Cap. > 5% is attractive.',
    fmt: r => fmtPctPlain(r.fcfYield),
    colorFn: r => metricColor(r.fcfYield, 'fcfYield'),
    defaultDir: 'desc',
  },
  {
    key: 'dividendYield', label: 'Div Yield', tooltip: 'Annual dividend yield %',
    fmt: r => r.dividendYield === null ? '—' : (r.dividendYield * 100).toFixed(2) + '%',
    colorFn: r => metricColor(r.dividendYield, 'divYield'),
    defaultDir: 'desc',
  },
  {
    key: 'beta', label: 'Beta', tooltip: 'Market beta (volatility vs S&P 500)',
    fmt: r => fmtNum(r.beta),
    defaultDir: 'asc',
  },
]

// ─── Score bar component ─────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const { label, color } = getScoreLabel(score)
  const pct = Math.max(0, Math.min(100, score))
  const barColor =
    score >= 70 ? '#16a34a' :
    score >= 55 ? '#65a30d' :
    score >= 40 ? '#d97706' :
    score >= 25 ? '#ea580c' : '#dc2626'

  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  )
}

// ─── Layer badge ─────────────────────────────────────────────────────────────

function LayerBadge({ layer, label }: { layer: number; label: string }) {
  const color = LAYER_COLORS[layer] ?? '#6b7280'
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
      style={{ backgroundColor: color + '18', color }}
    >
      {label}
    </span>
  )
}

// ─── Stats summary cards ──────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 min-w-[130px]">
      <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIStackPage() {
  const [data, setData]         = useState<ValuationMetrics[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [layerFilter, setLayerFilter] = useState<number | null>(null)
  const [sortKey, setSortKey]   = useState<SortKey>('valueScore')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-stack')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ValuationMetrics[] = await res.json()
      setData(json)
      setLastFetch(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (key: SortKey, defaultDir: SortDir = 'desc') => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(defaultDir)
    }
  }

  const filtered = useMemo(() => {
    let rows = [...data]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(r =>
        r.ticker.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.layerLabel.toLowerCase().includes(q) ||
        (r.sublayer ?? '').toLowerCase().includes(q)
      )
    }

    if (layerFilter !== null) {
      rows = rows.filter(r => r.layer === layerFilter)
    }

    rows.sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return rows
  }, [data, search, layerFilter, sortKey, sortDir])

  // Summary stats
  const stats = useMemo(() => {
    if (!data.length) return null
    const valid = data.filter(r => !r.error && r.price !== null)
    const scored = data.filter(r => r.valueScore > 0)
    const undervalued = scored.filter(r => r.valueScore >= 70).length
    const avgScore = scored.length ? Math.round(scored.reduce((s, r) => s + r.valueScore, 0) / scored.length) : 0
    const top5 = [...scored].sort((a, b) => b.valueScore - a.valueScore).slice(0, 5)
    return { total: valid.length, undervalued, avgScore, top5 }
  }, [data])

  const layers = useMemo(() => Array.from(new Set(data.map(r => r.layer))).sort((a, b) => a - b), [data])

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-slate-300 ml-0.5">↕</span>
    return <span className="text-blue-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-[52px]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                The AI Stack — Value Investing Dashboard
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {data.length} companies across 16 layers of the AI infrastructure supply chain.
                Live data from Yahoo Finance. Scored by Warren Buffett-style value metrics.
              </p>
              {lastFetch && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Last updated: {lastFetch.toLocaleTimeString()}
                </p>
              )}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="shrink-0 h-8 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Fetching…</>
              ) : (
                <><span>↻</span> Refresh</>
              )}
            </button>
          </div>

          {/* Stats strip */}
          {stats && !loading && (
            <div className="flex gap-3 mt-4 flex-wrap">
              <StatCard label="Total Tracked" value={stats.total.toString()} sub="public companies" />
              <StatCard label="Avg Score" value={stats.avgScore.toString()} sub="out of 100" />
              <StatCard
                label="Undervalued"
                value={stats.undervalued.toString()}
                sub="score ≥ 70"
              />
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 min-w-[200px]">
                <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Top Picks (by score)</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {stats.top5.map(r => (
                    <Link
                      key={r.ticker}
                      href={`/stock/${r.ticker}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded transition-colors"
                    >
                      {r.ticker}
                      <span className="font-normal opacity-70">{r.valueScore}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 sticky top-[52px] z-20">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-blue-400 transition-colors">
            <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker, company, layer…"
              className="bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none w-48"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            )}
          </div>

          {/* Layer filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setLayerFilter(null)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors ${
                layerFilter === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Layers
            </button>
            {layers.map(layer => (
              <button
                key={layer}
                onClick={() => setLayerFilter(layerFilter === layer ? null : layer)}
                className={`h-7 px-2 text-[10px] font-medium rounded-md transition-colors ${
                  layerFilter === layer
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={layerFilter === layer ? { backgroundColor: LAYER_COLORS[layer] } : {}}
              >
                L{layer}
              </button>
            ))}
          </div>

          <div className="ml-auto text-[12px] text-slate-400">
            {filtered.length} of {data.length} rows
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4 max-w-screen-2xl mx-auto">
        {loading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 gap-4 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
            <div className="text-sm font-medium">Loading {'~'}125 tickers from Yahoo Finance…</div>
            <div className="text-xs text-slate-400">This takes ~15 seconds on first load. Data is cached for 30 minutes.</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40 text-red-500 text-sm">{error}</div>
        ) : (
          <div className="relative overflow-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {/* Sticky cols */}
                  <th className="sticky left-0 bg-slate-50 z-10 text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide w-8 border-r border-slate-200">
                    #
                  </th>
                  <th className="sticky left-8 bg-slate-50 z-10 text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide min-w-[68px] border-r border-slate-200">
                    Ticker
                  </th>
                  <th className="sticky left-[116px] bg-slate-50 z-10 text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide min-w-[160px] border-r border-slate-200">
                    Company
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide min-w-[100px]">
                    Layer
                  </th>
                  {/* Score */}
                  <th
                    className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide cursor-pointer hover:text-blue-600 whitespace-nowrap min-w-[110px]"
                    onClick={() => handleSort('valueScore', 'desc')}
                    title="Composite value investing score 0–100"
                  >
                    Value Score <SortIcon k="valueScore" />
                  </th>
                  {/* Dynamic columns */}
                  {COLUMNS.map(col => (
                    <th
                      key={col.key as string}
                      className="text-right px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide cursor-pointer hover:text-blue-600 whitespace-nowrap"
                      onClick={() => handleSort(col.key, col.defaultDir)}
                      title={col.tooltip}
                    >
                      {col.label} <SortIcon k={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const { label: scoreLabel, color: scoreColor } = getScoreLabel(row.valueScore)
                  return (
                    <tr
                      key={row.ticker}
                      className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors"
                    >
                      {/* Rank */}
                      <td className="sticky left-0 bg-white hover:bg-blue-50/40 z-10 px-3 py-2 text-slate-400 text-[11px] text-center border-r border-slate-100">
                        {idx + 1}
                      </td>
                      {/* Ticker */}
                      <td className="sticky left-8 bg-white hover:bg-blue-50/40 z-10 px-3 py-2 border-r border-slate-100">
                        <Link
                          href={`/stock/${row.ticker}`}
                          className="font-bold text-blue-600 hover:text-blue-800 transition-colors font-mono text-[12px]"
                        >
                          {row.ticker}
                        </Link>
                      </td>
                      {/* Company */}
                      <td className="sticky left-[116px] bg-white hover:bg-blue-50/40 z-10 px-3 py-2 border-r border-slate-100">
                        <div className="text-slate-700 text-[12px] truncate max-w-[155px]" title={row.name}>
                          {row.name}
                        </div>
                        {row.sublayer && (
                          <div className="text-[10px] text-slate-400 truncate">{row.sublayer}</div>
                        )}
                      </td>
                      {/* Layer */}
                      <td className="px-3 py-2">
                        <LayerBadge layer={row.layer} label={LAYER_LABELS[row.layer] ?? `L${row.layer}`} />
                      </td>
                      {/* Score */}
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <ScoreBar score={row.valueScore} />
                          <span className="text-[10px]" style={{ color: scoreColor }}>{scoreLabel}</span>
                        </div>
                      </td>
                      {/* Dynamic cols */}
                      {COLUMNS.map(col => {
                        const val = col.fmt(row)
                        const colorClass = col.colorFn ? col.colorFn(row) : 'text-slate-700'
                        return (
                          <td key={col.key as string} className={`px-3 py-2 text-right tabular-nums ${colorClass}`}>
                            {val}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 5} className="text-center py-12 text-slate-400 text-sm">
                      No results match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Score legend */}
      {!loading && data.length > 0 && (
        <div className="px-6 pb-8 max-w-screen-2xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Value Score Methodology (Buffett / Graham Framework)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: 'PEG Ratio', weight: '16%', desc: 'P/E ÷ growth. < 1 = undervalued (Peter Lynch rule)' },
                { label: 'Price/FCF', weight: '16%', desc: 'Mkt cap ÷ free cash flow. < 15x attractive' },
                { label: 'EV/EBITDA', weight: '13%', desc: 'Enterprise value multiple. < 12x good.' },
                { label: 'Return on Equity', weight: '13%', desc: 'Buffett wants > 15% consistently' },
                { label: 'Debt/Equity', weight: '12%', desc: 'Balance sheet health. < 50% = low leverage' },
                { label: 'Gross Margin', weight: '10%', desc: 'Moat indicator. Buffett loves > 40%' },
                { label: 'Revenue Growth', weight: '8%', desc: 'YoY top-line momentum' },
                { label: 'Price/Book', weight: '7%', desc: 'Graham: buy below or near book value' },
                { label: 'Current Ratio', weight: '5%', desc: 'Liquidity. > 1.5 is healthy' },
              ].map(item => (
                <div key={item.label} className="text-[11px]">
                  <div className="font-semibold text-slate-700">{item.label} <span className="text-slate-400 font-normal">({item.weight})</span></div>
                  <div className="text-slate-500 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 flex-wrap">
              {[
                { score: '70–100', label: 'Undervalued', color: '#16a34a' },
                { score: '55–70', label: 'Fair Value', color: '#65a30d' },
                { score: '40–55', label: 'Fairly Priced', color: '#d97706' },
                { score: '25–40', label: 'Overvalued', color: '#ea580c' },
                { score: '0–25', label: 'Expensive', color: '#dc2626' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 text-[11px]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-700">{item.score}</span>
                  <span className="text-slate-500">= {item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              Data source: Yahoo Finance (live). Scores update every 30 min. Not investment advice — these are screening signals only.
              Green/yellow/red cell colors reflect absolute thresholds; context varies by sector (e.g. tech commands higher P/B than industrials).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
