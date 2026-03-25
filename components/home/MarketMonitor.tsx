'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

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

// ── TradingView symbol map ────────────────────────────────────────────────────
const TV_SYMBOL: Record<string, string> = {
  '^GSPC':    'SP:SPX',
  '^NDX':     'NASDAQ:NDX',
  '^DJI':     'DJ:DJI',
  '^TNX':     'TVC:US10Y',
  'CL=F':     'NYMEX:CL1!',
  'BZ=F':     'TVC:UKOIL',
  'GC=F':     'COMEX:GC1!',
  'BTC-USD':  'BITSTAMP:BTCUSD',
  'ETH-USD':  'BITSTAMP:ETHUSD',
  'EURUSD=X': 'OANDA:EURUSD',
}

const INTERVALS = [
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: 'M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '12M' },
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

// ── Chart modal ───────────────────────────────────────────────────────────────
const CHART_CONTAINER = 'tv_market_chart_modal'

function ChartModal({ item, onClose }: { item: MarketItem; onClose: () => void }) {
  const [interval, setIntervalValue] = useState('D')
  const up = item.changePct >= 0

  useEffect(() => {
    const container = document.getElementById(CHART_CONTAINER)
    if (!container) return
    container.innerHTML = ''

    const createWidget = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).TradingView) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (window as any).TradingView.widget({
        autosize: true,
        symbol: TV_SYMBOL[item.ticker] ?? item.ticker,
        interval,
        theme: 'dark',
        style: '1',
        locale: 'en',
        container_id: CHART_CONTAINER,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        toolbar_bg: '#111111',
        withdateranges: true,
        save_image: false,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).TradingView) {
      createWidget()
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://s3.tradingview.com/tv.js"]')
      if (existing) {
        existing.addEventListener('load', createWidget, { once: true })
      } else {
        const script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/tv.js'
        script.addEventListener('load', createWidget, { once: true })
        document.head.appendChild(script)
      }
    }

    return () => {
      const c = document.getElementById(CHART_CONTAINER)
      if (c) c.innerHTML = ''
    }
  }, [item.ticker, interval])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111]"
        style={{ height: 'min(90vh, 560px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/8 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{ICONS[item.ticker] ?? '📈'}</span>
            <span className="text-sm font-bold text-white">{item.label}</span>
            <span className={`ml-2 text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
              {up ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Timeframe buttons */}
            <div className="flex gap-0.5">
              {INTERVALS.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setIntervalValue(tf.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    interval === tf.value
                      ? 'bg-white text-black'
                      : 'text-white/35 hover:text-white/70'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="ml-1 text-xl leading-none text-white/30 transition-colors hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        {/* TradingView container */}
        <div id={CHART_CONTAINER} className="min-h-0 flex-1" />
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/8 bg-[#111] p-4">
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
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-amber-400">Monitor Global</p>
            <p className="mt-1 text-xs text-white/25">World market indicators · Click any card to expand · Delayed ~15 min</p>
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
                      className="group cursor-pointer rounded-2xl border border-white/8 bg-[#111] p-4 text-left transition-all hover:border-white/20 hover:bg-white/5"
                    >
                      {/* Name row */}
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none">{ICONS[item.ticker] ?? '📈'}</span>
                          <span className="text-[11px] font-medium leading-none text-white/45">{item.label}</span>
                        </div>
                        <span className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {up ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
                        </span>
                      </div>

                      {/* Price */}
                      <p className="mb-2 text-lg font-bold leading-none text-white tabular-nums">
                        {fmtPrice(item.price, item.ticker)}
                      </p>

                      {/* Sparkline */}
                      <Sparkline prices={item.sparkline} up={up} id={safeId} />
                    </button>
                  )
                })}
              </div>

              {/* Hot movers */}
              {data.hotStocks.length > 0 && (
                <div className="mt-6">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-white/30">
                    <span className="text-amber-400">HOT</span>
                    {' '}US Stocks · Major Movement
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {data.hotStocks.map((s, i) => {
                      const up = s.changePct >= 0
                      return (
                        <Link
                          key={s.ticker}
                          href={`/stock/${s.ticker}`}
                          className="flex min-w-[200px] flex-shrink-0 items-center gap-3 rounded-2xl border border-white/8 bg-[#111] px-4 py-3 transition-colors hover:border-white/20"
                        >
                          <span className="text-2xl font-bold tabular-nums text-white/15">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">{s.ticker}</p>
                            <p className="truncate text-xs text-white/35">{s.name}</p>
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
