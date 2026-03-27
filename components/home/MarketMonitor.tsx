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

const GROUP_ORDER = ['Índices', 'Tasas', 'Energía', 'Metales', 'Agro', 'Crypto', 'Monedas']

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
  // Treasury yields
  if (ticker === '^TNX' || ticker === '^TYX' || ticker === '^FVX') return price.toFixed(3) + '%'
  // FX pairs — 4 decimal places
  if (ticker.endsWith('=X')) return price.toFixed(4)
  // Large indices / crypto
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  // Commodities, metals, energy — 2 decimal places
  if (price >= 10) return price.toFixed(2)
  // Small crypto / sub-10
  return price.toFixed(4)
}

const ICONS: Record<string, string> = {
  '^GSPC': '📊', '^NDX': '💻', '^DJI': '🏛️',
  '^TNX': '🏦',  '^TYX': '🏦', '^FVX': '🏦',
  'CL=F': '🛢️',  'BZ=F': '🛢️', 'RB=F': '⛽',
  'GC=F': '🥇',  'SI=F': '🥈', 'HG=F': '🔶',
  'ZS=F': '🌱',  'ZW=F': '🌾', 'ZC=F': '🌽',
  'BTC-USD': '₿', 'ETH-USD': 'Ξ', 'AVAX-USD': '🔺',
  'EURUSD=X': '🇪🇺', 'USDMXN=X': '🇲🇽', 'USDBRL=X': '🇧🇷',
}

// ── Chart modal ───────────────────────────────────────────────────────────────
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
                    period === p.value ? 'bg-white text-black shadow-sm' : 'text-white/35 hover:text-white/70'
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
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtPrice(v, item.ticker)} width={60} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 2 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [fmtPrice(Number(v), item.ticker), item.label]}
                />
                <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/20">No chart data available</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonGroup() {
  return (
    <div className="mb-5">
      <div className="mb-2 h-3 w-16 animate-pulse rounded bg-white/8" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-white/8 bg-[#0f0f0f] p-3">
            <div className="mb-2.5 flex items-center gap-1.5">
              <div className="h-3.5 w-3.5 rounded bg-white/10" />
              <div className="h-2.5 w-14 rounded bg-white/10" />
            </div>
            <div className="mb-2 h-5 w-20 rounded bg-white/10" />
            <div className="h-8 rounded bg-white/5" />
          </div>
        ))}
      </div>
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

  const grouped = GROUP_ORDER.map((name) => ({
    name,
    items: data?.items.filter((i) => i.group === name) ?? [],
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <section className="px-4 pb-20 pt-6">
        <div className="mx-auto max-w-6xl">

          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber-400/80">Monitor Global</p>
              <p className="mt-0.5 text-[11px] text-white/20">Click any card for price history · Delayed ~15 min</p>
            </div>
          </div>

          {loading ? (
            <div>
              {GROUP_ORDER.map((g) => <SkeletonGroup key={g} />)}
            </div>
          ) : (
            <div>
              {/* Grouped instrument rows */}
              {grouped.map((group) => (
                <div key={group.name} className="mb-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                    {group.name}
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {group.items.map((item) => {
                      const up = item.changePct >= 0
                      const safeId = item.ticker.replace(/[^a-zA-Z0-9]/g, '_')
                      return (
                        <button
                          key={item.ticker}
                          onClick={() => setSelected(item)}
                          className="group cursor-pointer rounded-xl border border-white/[0.06] bg-[#0f0f0f] p-3 text-left transition-all hover:border-white/15 hover:bg-white/[0.04]"
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs leading-none flex-shrink-0">{ICONS[item.ticker] ?? '📈'}</span>
                              <span className="truncate text-[10px] font-medium leading-none text-white/40">{item.label}</span>
                            </div>
                            <span className={`ml-1.5 flex-shrink-0 text-[10px] font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                              {up ? '▲' : '▼'}{Math.abs(item.changePct).toFixed(2)}%
                            </span>
                          </div>
                          <p className="mb-1.5 text-base font-bold leading-none text-white tabular-nums">
                            {fmtPrice(item.price, item.ticker)}
                          </p>
                          <Sparkline prices={item.sparkline} up={up} id={safeId} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Hot movers */}
              {data?.hotStocks && data.hotStocks.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                    <span className="text-amber-400/80">HOT</span> · Acciones · Mayor movimiento
                  </p>
                  <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {data.hotStocks.map((s, i) => {
                      const up = s.changePct >= 0
                      return (
                        <Link
                          key={s.ticker}
                          href={`/stock/${s.ticker}`}
                          className="flex min-w-[180px] flex-shrink-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f0f] px-4 py-3 transition-colors hover:border-white/15"
                        >
                          <span className="text-xl font-bold tabular-nums text-white/10">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">{s.ticker}</p>
                            <p className="truncate text-[10px] text-white/30">{s.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold tabular-nums text-white">${s.price.toFixed(2)}</p>
                            <p className={`text-[10px] font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                              {up ? '+' : ''}{s.changePct.toFixed(2)}%
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {selected && <ChartModal item={selected} onClose={closeModal} />}
    </>
  )
}
