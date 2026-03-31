'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

interface MarketItem {
  ticker: string
  label: string
  group: string
  price: number
  change: number
  changePct: number
  sparkline: number[]
}

interface MarketData {
  items: MarketItem[]
}

type Period = '1mo' | '3mo' | '1y' | '5y'
const PERIODS: { label: string; value: Period }[] = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
]

// Display order + labels for each group section
const GROUP_ORDER = [
  'Indexes', 'MERVAL', 'Brasil', 'Tech', 'AI', 'Chips',
  'China', 'Rates', 'Energy', 'Metals', 'Agro', 'Crypto', 'FX',
]

const GROUP_LABELS: Record<string, string> = {
  Indexes: 'GLOBAL INDEXES',
  MERVAL:  'MERVAL · ARGENTINA',
  Brasil:  'BRAZIL',
  Tech:    'BIG TECH',
  AI:      'ARTIFICIAL INTELLIGENCE',
  Chips:   'SEMICONDUCTORS',
  China:   'CHINA',
  Rates:   'US TREASURY RATES',
  Energy:  'ENERGY',
  Metals:  'METALS',
  Agro:    'AGRICULTURE',
  Crypto:  'CRYPTO',
  FX:      'FX · CURRENCIES',
}

// Whether items in this group are equities (link to stock page)
const EQUITY_GROUPS = new Set(['MERVAL', 'Brasil', 'Tech', 'AI', 'Chips', 'China'])

// ── Price formatting ──────────────────────────────────────────────────────────
function fmtPrice(price: number, ticker: string): string {
  if (!price) return '—'
  if (ticker === '^TNX' || ticker === '^TYX' || ticker === '^FVX') return price.toFixed(3) + '%'
  if (ticker.endsWith('=X') || ticker === 'DX-Y.NYB') return price.toFixed(4)
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price >= 1000)  return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (price >= 10)    return price.toFixed(2)
  return price.toFixed(4)
}

// ── Inline Sparkline ──────────────────────────────────────────────────────────
function Sparkline({ prices, up }: { prices: number[]; up: boolean }) {
  if (prices.length < 2) return <div className="h-8 w-full" />
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const W = 100, H = 32
  const step = W / (prices.length - 1)
  const pts = prices
    .map((p, i) => `${(i * step).toFixed(1)},${(H - ((p - min) / range) * (H - 2) - 1).toFixed(1)}`)
    .join(' ')
  const areaPts = `0,${H} ${pts} ${((prices.length - 1) * step).toFixed(1)},${H}`
  const color = up ? '#3fb950' : '#f85149'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full" preserveAspectRatio="none" fill="none">
      <defs>
        <linearGradient id={`sg-${up}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#sg-${up})`} />
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Chart slide-in panel (same style as ScreenerChart) ───────────────────────
interface ChartBar { date: string; price: number }

function ChartPanel({ item, onClose }: { item: MarketItem; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('3mo')
  const [chartData, setChartData] = useState<ChartBar[]>([])
  const [loading, setLoading] = useState(false)
  const isUp = item.changePct >= 0
  const accentColor = isUp ? '#3fb950' : '#f85149'
  const gradId = `cg-${item.ticker.replace(/[^a-z0-9]/gi, '')}`
  const isEquity = EQUITY_GROUPS.has(item.group)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/historical?ticker=${encodeURIComponent(item.ticker)}&period=${period}`)
      .then((r) => r.json())
      .then((raw: { date: string; close: number }[]) => {
        setChartData(raw.map((p) => ({
          date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          price: p.close,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [item.ticker, period])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const prices = chartData.map((d) => d.price)
  const minP = prices.length ? Math.min(...prices) * 0.97 : 0
  const maxP = prices.length ? Math.max(...prices) * 1.03 : 1
  const periodChange = prices.length >= 2
    ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
    : null

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60" />
      <div
        className="w-[480px] bg-[#0d1117] border-l border-[#30363d] flex flex-col h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#21262d]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-[#e6edf3]">{item.ticker}</span>
              <span className="font-mono text-sm font-semibold" style={{ color: accentColor }}>
                {isUp ? '+' : ''}{item.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#8b949e] mt-0.5">{item.label}</div>
            <div className="font-mono text-xl font-bold text-[#e6edf3] mt-1">{fmtPrice(item.price, item.ticker)}</div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6e7681] hover:text-[#e6edf3] transition-colors mt-0.5 font-mono text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-[#21262d]">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={[
                'px-2.5 py-0.5 font-mono text-[11px] font-semibold rounded transition-colors',
                period === p.value
                  ? 'bg-[#ff6600] text-black'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
          {periodChange !== null && (
            <span
              className="ml-auto font-mono text-[11px] font-semibold"
              style={{ color: periodChange >= 0 ? '#3fb950' : '#f85149' }}
            >
              {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}% period
            </span>
          )}
        </div>

        {/* Chart */}
        <div className="px-2 py-4 flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-[#6e7681] font-mono text-xs">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[#6e7681] font-mono text-xs">No data</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={accentColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[minP, maxP]}
                    tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                    tickLine={false} axisLine={false} width={56}
                    tickFormatter={(v) => fmtPrice(v, item.ticker)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-xs font-mono">
                          <div className="text-[#8b949e] mb-1">{label}</div>
                          <div className="text-[#e6edf3] font-bold">{fmtPrice(payload[0]?.value as number, item.ticker)}</div>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone" dataKey="price"
                    stroke={accentColor} strokeWidth={1.5}
                    fill={`url(#${gradId})`} dot={false} isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Footer CTA — only for equity groups */}
        {isEquity && (
          <div className="px-5 py-3 border-t border-[#21262d]">
            <Link
              href={`/stock/${item.ticker}`}
              className="flex items-center justify-center gap-2 w-full py-2 bg-[#ff6600] hover:bg-[#e55a00] text-black font-mono text-xs font-bold rounded transition-colors"
            >
              Open Full Analysis →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="animate-pulse bg-[#161b22] border border-[#21262d] rounded h-20" />
      ))}
    </div>
  )
}

// ── Market card ───────────────────────────────────────────────────────────────
function MarketCard({ item, onClick }: { item: MarketItem; onClick: () => void }) {
  const isUp = item.changePct >= 0
  const accentColor = isUp ? '#3fb950' : '#f85149'

  return (
    <button
      onClick={onClick}
      className="group flex flex-col bg-[#0d1117] border border-[#21262d] hover:border-[#30363d] hover:bg-[#161b22] transition-colors rounded p-3 text-left w-full"
    >
      <div className="flex items-start justify-between mb-1 gap-1">
        <span className="font-mono text-[10px] font-semibold text-[#8b949e] truncate leading-none">{item.label}</span>
        <span
          className="font-mono text-[10px] font-bold shrink-0 leading-none"
          style={{ color: accentColor }}
        >
          {isUp ? '+' : ''}{item.changePct.toFixed(2)}%
        </span>
      </div>
      <div className="font-mono text-sm font-bold text-[#e6edf3] tabular-nums mb-1">
        {fmtPrice(item.price, item.ticker)}
      </div>
      <div className="mt-auto">
        <Sparkline prices={item.sparkline} up={isUp} />
      </div>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MarketMonitor() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MarketItem | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const closePanel = useCallback(() => setSelected(null), [])

  useEffect(() => {
    fetch('/api/market')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const grouped = GROUP_ORDER.map((name) => ({
    name,
    label: GROUP_LABELS[name] ?? name,
    items: data?.items.filter((i) => i.group === name) ?? [],
  })).filter((g) => g.items.length > 0)

  // Summary KPIs from loaded data
  const allItems = data?.items ?? []
  const advancing = allItems.filter((i) => i.changePct > 0).length
  const declining = allItems.filter((i) => i.changePct < 0).length
  const topMover = allItems.length
    ? allItems.reduce((a, b) => Math.abs(b.changePct) > Math.abs(a.changePct) ? b : a)
    : null
  const avgPct = allItems.length
    ? allItems.reduce((s, i) => s + i.changePct, 0) / allItems.length
    : 0

  const visibleGroups = activeGroup
    ? grouped.filter((g) => g.name === activeGroup)
    : grouped

  return (
    <>
      <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">

        {/* Page header */}
        <div className="px-6 py-4 border-b border-[#21262d] flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#e6edf3] tracking-tight font-mono">Market Monitor</h1>
            <p className="text-[11px] text-[#8b949e] mt-0.5 font-mono">
              Global markets · Equities · Rates · Commodities · Crypto · FX
              <span className="ml-2 text-[#6e7681]">· delayed ~15 min</span>
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetch('/api/market').then((r) => r.json()).then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false)) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#21262d] border border-[#30363d] text-xs font-semibold font-mono text-[#e6edf3] hover:bg-[#30363d] transition-colors"
          >
            <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* KPI summary row */}
        {!loading && allItems.length > 0 && (
          <div className="grid grid-cols-4 gap-px bg-[#21262d] border-b border-[#21262d]">
            <div className="bg-[#0d1117] px-4 py-3">
              <p className="font-mono text-[10px] text-[#6e7681] uppercase tracking-wide">Tracked</p>
              <p className="font-mono text-xl font-bold text-[#e6edf3]">{allItems.length}</p>
            </div>
            <div className="bg-[#0d1117] px-4 py-3">
              <p className="font-mono text-[10px] text-[#6e7681] uppercase tracking-wide">Advancing</p>
              <p className="font-mono text-xl font-bold text-[#3fb950]">{advancing}</p>
            </div>
            <div className="bg-[#0d1117] px-4 py-3">
              <p className="font-mono text-[10px] text-[#6e7681] uppercase tracking-wide">Declining</p>
              <p className="font-mono text-xl font-bold text-[#f85149]">{declining}</p>
            </div>
            <div className="bg-[#0d1117] px-4 py-3">
              <p className="font-mono text-[10px] text-[#6e7681] uppercase tracking-wide">Avg Δ%</p>
              <p className="font-mono text-xl font-bold" style={{ color: avgPct >= 0 ? '#3fb950' : '#f85149' }}>
                {avgPct >= 0 ? '+' : ''}{avgPct.toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {/* Group filter pills */}
        {!loading && (
          <div className="px-6 py-3 border-b border-[#21262d] flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveGroup(null)}
              className={[
                'px-2.5 py-1 rounded font-mono text-[11px] font-semibold transition-colors',
                activeGroup === null
                  ? 'bg-[#388bfd] text-white'
                  : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d]',
              ].join(' ')}
            >
              All
            </button>
            {grouped.map((g) => {
              const groupItems = g.items
              const upCount = groupItems.filter((i) => i.changePct > 0).length
              const allUp = upCount === groupItems.length
              const allDown = upCount === 0
              const accentDot = allUp ? '#3fb950' : allDown ? '#f85149' : '#d2991f'
              return (
                <button
                  key={g.name}
                  onClick={() => setActiveGroup(activeGroup === g.name ? null : g.name)}
                  className={[
                    'flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] font-semibold transition-colors',
                    activeGroup === g.name
                      ? 'bg-[#388bfd] text-white'
                      : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d]',
                  ].join(' ')}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentDot }} />
                  {g.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Top mover banner */}
        {!loading && topMover && (
          <div className="px-6 py-2 border-b border-[#21262d] flex items-center gap-3">
            <span className="font-mono text-[10px] text-[#6e7681] uppercase tracking-widest">Top mover</span>
            <span className="font-mono text-[11px] font-bold text-[#e6edf3]">{topMover.label}</span>
            <span className="font-mono text-[11px] font-bold" style={{ color: topMover.changePct >= 0 ? '#3fb950' : '#f85149' }}>
              {topMover.changePct >= 0 ? '+' : ''}{topMover.changePct.toFixed(2)}%
            </span>
            <span className="font-mono text-[11px] text-[#8b949e]">{fmtPrice(topMover.price, topMover.ticker)}</span>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-5 space-y-8">
          {loading ? (
            <div className="space-y-6">
              {GROUP_ORDER.slice(0, 4).map((g) => (
                <div key={g}>
                  <div className="h-3 w-32 bg-[#21262d] rounded animate-pulse mb-3" />
                  <SkeletonRow />
                </div>
              ))}
            </div>
          ) : (
            visibleGroups.map((group) => (
              <div key={group.name}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-[10px] font-bold text-[#ff6600] uppercase tracking-widest">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-[#21262d]" />
                  <span className="font-mono text-[9px] text-[#6e7681]">{group.items.length} instruments</span>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {group.items.map((item) => (
                    <MarketCard
                      key={item.ticker}
                      item={item}
                      onClick={() => setSelected(item)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 pb-6 font-mono text-[10px] text-[#30363d]">
          Data via Yahoo Finance · ~15 min delay · Click any card for price history
        </div>
      </div>

      {selected && <ChartPanel item={selected} onClose={closePanel} />}
    </>
  )
}
