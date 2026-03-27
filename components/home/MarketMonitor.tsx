'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

interface MarketItem {
  ticker: string
  label: string
  price: number
  change: number
  changePct: number
  sparkline: number[]
}

interface HotStock {
  ticker: string
  name: string
  price: number
  changePct: number
}

interface MarketData {
  items: MarketItem[]
  hotStocks: HotStock[]
}

type Period = '1mo' | '3mo' | '1y' | '5y'
const PERIODS: { label: string; value: Period }[] = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
]

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ prices, up, id }: { prices: number[]; up: boolean; id: string }) {
  if (prices.length < 2) return <div className="h-9 w-full" />
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const W = 120, H = 36
  const step = W / (prices.length - 1)
  const pts = prices.map((p, i) => `${(i * step).toFixed(1)},${(H - ((p - min) / range) * H).toFixed(1)}`).join(' ')
  const areaPts = `0,${H} ${pts} ${((prices.length - 1) * step).toFixed(1)},${H}`
  const color = up ? '#22c55e' : '#ef4444'
  const gradId = `sg-${id}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" preserveAspectRatio="none" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gradId})`} />
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Price formatting ──────────────────────────────────────────────────────────
function fmtPrice(price: number, ticker: string): string {
  if (!price) return '—'
  if (ticker === 'EURUSD=X') return price.toFixed(4)
  if (ticker === '^TNX') return price.toFixed(3) + '%'
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (price >= 100) return price.toFixed(2)
  return price.toFixed(4)
}

const ICONS: Record<string, string> = {
  '^GSPC': '📊', '^NDX': '💻', '^DJI': '🏛️', '^TNX': '🏦',
  'CL=F': '🛢️', 'BZ=F': '🛢️', 'GC=F': '🥇',
  'BTC-USD': '₿', 'ETH-USD': 'Ξ', 'EURUSD=X': '🇪🇺',
}

// ── Chart modal (Recharts) ────────────────────────────────────────────────────
interface ChartBar { date: string; price: number }

function ChartModal({ item, onClose }: { item: MarketItem; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('1y')
  const [chartData, setChartData] = useState<ChartBar[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const up = item.changePct >= 0
  const color = up ? '#22c55e' : '#ef4444'
  const gradId = `cg-${item.ticker.replace(/[^a-z0-9]/gi, '')}`

  useEffect(() => {
    setChartLoading(true)
    fetch(`/api/historical?ticker=${encodeURIComponent(item.ticker)}&period=${period}`)
      .then((r) => r.json())
      .then((raw: { date: string; close: number }[]) => {
        setChartData(raw.map((p) => ({
          date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          price: p.close,
        })))
        setChartLoading(false)
      })
      .catch(() => setChartLoading(false))
  }, [item.ticker, period])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f]"
        style={{ height: 'min(88vh, 500px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/8 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-base leading-none">{ICONS[item.ticker] ?? '📈'}</span>
            <span className="text-sm font-bold text-white">{item.label}</span>
            <span className="text-sm font-bold tabular-nums text-white/60">{fmtPrice(item.price, item.ticker)}</span>
            <span className={`text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
              {up ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-lg border border-white/8 bg-white/[0.03] p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    period === p.value
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/35 hover:text-white/70'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/8 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="min-h-0 flex-1 px-2 py-4">
          {chartLoading ? (
            <div className="h-full animate-pulse rounded-xl bg-white/[0.03]" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtPrice(v, item.ticker)}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    fontSize: 12,
                    color: '#fff',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 2 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [fmtPrice(Number(v), item.ticker), item.label]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/20">
              No chart data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/8 bg-[#0f0f0f] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-white/10" />
        <div className="h-3 w-20 rounded bg-white/10" />
      </div>
      <div className="mb-2 h-6 w-28 rounded bg-white/10" />
      <div className="h-9 rounded bg-white/5" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MarketMonitor() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MarketItem | null>(null)

  const closeModal = useCallback(() => setSelected(null), [])

  useEffect(() => {
    fetch('/api/market')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <section className="px-4 pb-20 pt-6">
        <div className="mx-auto max-w-6xl">

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber-400/80">Global Markets</p>
              <p className="mt-0.5 text-[11px] text-white/20">Click any card for price history · Delayed ~15 min</p>
            </div>
          </div>

          {/* Market grid */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : data?.items ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {data.items.map((item) => {
                  const up = item.changePct >= 0
                  const safeId = item.ticker.replace(/[^a-zA-Z0-9]/g, '_')
                  return (
                    <button
                      key={item.ticker}
                      onClick={() => setSelected(item)}
                      className="group cursor-pointer rounded-2xl border border-white/[0.06] bg-[#0f0f0f] p-4 text-left transition-all hover:border-white/15 hover:bg-white/[0.04]"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none">{ICONS[item.ticker] ?? '📈'}</span>
                          <span className="text-[11px] font-medium leading-none text-white/40">{item.label}</span>
                        </div>
                        <span className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {up ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
                        </span>
                      </div>
                      <p className="mb-2 text-lg font-bold leading-none text-white tabular-nums">
                        {fmtPrice(item.price, item.ticker)}
                      </p>
                      <Sparkline prices={item.sparkline} up={up} id={safeId} />
                    </button>
                  )
                })}
              </div>

              {/* Hot movers */}
              {data.hotStocks.length > 0 && (
                <div className="mt-8">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-white/20">
                    <span className="text-amber-400/80">HOT</span> · US Stocks · Major Movement
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {data.hotStocks.map((s, i) => {
                      const up = s.changePct >= 0
                      return (
                        <Link
                          key={s.ticker}
                          href={`/stock/${s.ticker}`}
                          className="flex min-w-[200px] flex-shrink-0 items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#0f0f0f] px-4 py-3 transition-colors hover:border-white/15"
                        >
                          <span className="text-2xl font-bold tabular-nums text-white/10">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">{s.ticker}</p>
                            <p className="truncate text-xs text-white/30">{s.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold tabular-nums text-white">${s.price.toFixed(2)}</p>
                            <p className={`text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                              {up ? '+' : ''}{s.changePct.toFixed(2)}%
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>

      {/* Chart modal */}
      {selected && <ChartModal item={selected} onClose={closeModal} />}
    </>
  )
}
