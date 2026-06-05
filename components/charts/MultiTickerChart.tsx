'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'

// ─── Palette ──────────────────────────────────────────────────────────────────
export const PALETTE = [
  '#818cf8', '#34d399', '#fb923c', '#f472b6',
  '#38bdf8', '#fbbf24', '#a78bfa', '#4ade80',
  '#f87171', '#67e8f9',
]

// ─── Periods ──────────────────────────────────────────────────────────────────
export type PeriodKey = '1d' | '5d' | '1m' | '3m' | '6m' | 'ytd' | '1y' | '3y' | '5y' | '10y' | 'max'

const PERIODS: { label: string; value: PeriodKey; api: string }[] = [
  { label: '1D',  value: '1d',  api: '1d'  },
  { label: '5D',  value: '5d',  api: '5d'  },
  { label: '1M',  value: '1m',  api: '1mo' },
  { label: '3M',  value: '3m',  api: '3mo' },
  { label: '6M',  value: '6m',  api: '6mo' },
  { label: 'YTD', value: 'ytd', api: 'ytd' },
  { label: '1Y',  value: '1y',  api: '1y'  },
  { label: '3Y',  value: '3y',  api: '3y'  },
  { label: '5Y',  value: '5y',  api: '5y'  },
  { label: '10Y', value: '10y', api: '10y' },
  { label: 'MAX', value: 'max', api: 'max' },
]

type Metric = 'indexed' | 'absolute'

export interface OHLCV { date: string; close: number }

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  initialTickers?: string[]
  isDark?: boolean
  height?: number
  defaultPeriod?: PeriodKey
  showMetricSelect?: boolean
  className?: string
  onTickersChange?: (tickers: string[]) => void
  onDataReady?: (tickers: string[], data: Map<string, OHLCV[]>) => void
}

// ─── Ticker Tag ───────────────────────────────────────────────────────────────
function TickerTag({ ticker, color, onRemove, canRemove }: {
  ticker: string; color: string; onRemove: () => void; canRemove: boolean
}) {
  return (
    <span
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold select-none"
      style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}
    >
      {ticker}
      {canRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-60 transition-opacity leading-none -mx-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{ color }}
        >
          ×
        </button>
      )}
    </span>
  )
}

// ─── Ticker Search Input ──────────────────────────────────────────────────────
function TickerSearch({ onAdd, isDark, disabled }: {
  onAdd: (t: string) => void; isDark?: boolean; disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ symbol: string; shortname?: string; longname?: string }[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setBusy(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setOpen(d.length > 0); setBusy(false) })
        .catch(() => setBusy(false))
    }, 280)
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (symbol: string) => { onAdd(symbol); setQuery(''); setOpen(false) }

  const bg    = 'rgba(255,255,255,0.06)'
  const bdCol = 'rgba(255,255,255,0.12)'
  const txt   = 'rgba(255,255,255,0.55)'
  const ddBg  = '#1e1e2e'

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] cursor-text"
        style={{ background: bg, border: `1px solid ${bdCol}` }}
      >
        <span style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8' }}>+</span>
        <input
          disabled={disabled}
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter' && query.trim()) select(query.trim()) }}
          placeholder={disabled ? 'Max 10' : 'Add ticker…'}
          className="bg-transparent w-20 focus:w-28 focus:outline-none transition-all"
          style={{ color: txt, fontSize: '16px', fontWeight: 500 }}
        />
        {busy && (
          <div className="h-2.5 w-2.5 animate-spin rounded-full border"
            style={{ borderColor: bdCol, borderTopColor: '#818cf8' }} />
        )}
      </div>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-xl shadow-lg overflow-hidden min-w-[200px] max-h-48 overflow-y-auto"
          style={{ background: ddBg, border: `1px solid ${bdCol}` }}
        >
          {results.map(r => (
            <button
              key={r.symbol}
              onMouseDown={() => select(r.symbol)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left"
              style={{ borderBottom: `1px solid ${bdCol}` }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#818cf8', fontSize: 11, fontWeight: 700, width: 56, flexShrink: 0 }}>{r.symbol}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }} className="truncate">
                {r.longname ?? r.shortname}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Custom Crosshair Tooltip ─────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, tickers, metric, isDark: _isDark }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active?: boolean; payload?: any[]; label?: string
  tickers: string[]; metric: Metric; isDark?: boolean
}) {
  if (!active || !payload?.length) return null
  const bg  = 'rgba(10,22,40,0.95)'
  const bd  = 'rgba(59,130,246,0.2)'
  const txt = 'rgba(255,255,255,0.85)'
  const mut = 'rgba(255,255,255,0.35)'
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: '8px 12px', fontSize: 11, color: txt, minWidth: 148, boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}>
      <div style={{ color: mut, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {tickers.map((ticker, i) => {
        const entry = payload.find(p => p.dataKey === ticker)
        if (!entry || entry.value == null) return null
        const color = PALETTE[i % PALETTE.length]
        const v = entry.value as number
        return (
          <div key={ticker} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
            <span style={{ color, fontWeight: 700 }}>{ticker}</span>
            <span style={{ color: txt, fontWeight: 700 }}>
              {metric === 'indexed'
                ? `${v >= 100 ? '+' : ''}${(v - 100).toFixed(2)}%`
                : `$${v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2)}`
              }
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MultiTickerChart({
  initialTickers = ['AAPL'],
  isDark,
  height = 280,
  defaultPeriod = '1y',
  showMetricSelect = true,
  className = '',
  onTickersChange,
  onDataReady,
}: Props) {
  const [tickers, setTickers] = useState<string[]>(initialTickers)
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod)
  const [metric, setMetric] = useState<Metric>('indexed')
  const [tickerData, setTickerData] = useState<Map<string, OHLCV[]>>(new Map())
  const [loading, setLoading] = useState<Set<string>>(new Set())

  const cacheRef = useRef<Map<string, OHLCV[]>>(new Map())
  const onDataReadyRef = useRef(onDataReady)
  const onTickersChangeRef = useRef(onTickersChange)
  useEffect(() => { onDataReadyRef.current = onDataReady })
  useEffect(() => { onTickersChangeRef.current = onTickersChange })

  // Auto-switch to indexed when comparing multiple tickers
  useEffect(() => {
    if (tickers.length >= 2 && metric === 'absolute') setMetric('indexed')
  }, [tickers.length, metric])

  // Notify parent of ticker changes
  useEffect(() => { onTickersChangeRef.current?.(tickers) }, [tickers])

  // Notify parent when data is updated
  useEffect(() => { onDataReadyRef.current?.(tickers, tickerData) }, [tickers, tickerData])

  const fetchTicker = useCallback(async (ticker: string, p: PeriodKey) => {
    const key = `${ticker}::${p}`
    if (cacheRef.current.has(key)) {
      setTickerData(prev => new Map(prev).set(ticker, cacheRef.current.get(key)!))
      return
    }
    setLoading(prev => new Set(prev).add(ticker))
    try {
      const apiPeriod = PERIODS.find(x => x.value === p)?.api ?? '1y'
      const r = await fetch(`/api/historical?ticker=${encodeURIComponent(ticker)}&period=${apiPeriod}`)
      const raw = await r.json()
      if (Array.isArray(raw)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: OHLCV[] = raw.map((pt: any) => ({ date: pt.date.slice(0, 10), close: pt.close }))
        cacheRef.current.set(key, data)
        setTickerData(prev => new Map(prev).set(ticker, data))
      }
    } catch { /* silent */ } finally {
      setLoading(prev => { const n = new Set(prev); n.delete(ticker); return n })
    }
  }, [])

  // Clear tickerData when period changes (cache repopulates instantly if warm)
  const prevPeriodRef = useRef(period)
  useEffect(() => {
    if (prevPeriodRef.current !== period) {
      prevPeriodRef.current = period
      setTickerData(new Map())
    }
  }, [period])

  // Fetch all tickers on change
  useEffect(() => {
    for (const t of tickers) fetchTicker(t, period)
  }, [tickers, period, fetchTicker])

  // Build aligned chart data
  const chartData = useMemo(() => {
    if (!tickers.length) return []
    const allDates = new Set<string>()
    const maps = new Map<string, Map<string, number>>()
    for (const ticker of tickers) {
      const series = tickerData.get(ticker)
      if (!series) continue
      const m = new Map<string, number>()
      for (const pt of series) { allDates.add(pt.date); m.set(pt.date, pt.close) }
      maps.set(ticker, m)
    }
    const sorted = Array.from(allDates).sort()

    // baseline: first date each ticker has data (for indexed mode)
    const baselines = new Map<string, number>()
    for (const ticker of tickers) {
      const m = maps.get(ticker)
      if (!m) continue
      for (const d of sorted) { if (m.has(d)) { baselines.set(ticker, m.get(d)!); break } }
    }

    const longSeries = sorted.length > 365
    return sorted.map(date => {
      const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: '2-digit', ...(longSeries ? { year: '2-digit' } : {}),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = { date: label }
      for (const ticker of tickers) {
        const m = maps.get(ticker)
        if (!m || !m.has(date)) { row[ticker] = null; continue }
        const close = m.get(date)!
        if (metric === 'indexed') {
          const base = baselines.get(ticker)
          row[ticker] = base ? Math.round((close / base) * 10000) / 100 : null
        } else {
          row[ticker] = Math.round(close * 100) / 100
        }
      }
      return row
    })
  }, [tickers, tickerData, metric])

  const addTicker = useCallback((t: string) => {
    const upper = t.toUpperCase().trim()
    if (!upper || tickers.includes(upper) || tickers.length >= 10) return
    setTickers(prev => [...prev, upper])
  }, [tickers])

  const removeTicker = useCallback((t: string) => {
    setTickers(prev => prev.filter(x => x !== t))
    setTickerData(prev => { const n = new Map(prev); n.delete(t); return n })
  }, [])

  const downloadCSV = useCallback(() => {
    if (!chartData.length) return
    const header = ['Date', ...tickers].join(',')
    const rows = chartData.map(row => [row.date, ...tickers.map(t => row[t] ?? '')].join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${tickers.join('_')}_${period}.csv`; a.click()
    URL.revokeObjectURL(url)
  }, [chartData, tickers, period])

  const isLoading = loading.size > 0
  const gridColor = 'rgba(255,255,255,0.04)'
  const tickFill  = 'rgba(255,255,255,0.25)'
  const bg        = 'bg-[#0A1628] border-white/8'

  return (
    <div className={`rounded-xl border ${bg} ${className}`}>
      {/* ── Ticker Tags ── */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4 pb-2">
        {tickers.map((t, i) => (
          <TickerTag
            key={t}
            ticker={t}
            color={PALETTE[i % PALETTE.length]}
            onRemove={() => removeTicker(t)}
            canRemove={tickers.length > 1}
          />
        ))}
        <TickerSearch onAdd={addTicker} isDark={isDark} disabled={tickers.length >= 10} />
        <button
          onClick={downloadCSV}
          disabled={!chartData.length}
          className={[
            'ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-30',
            'bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70',
          ].join(' ')}
        >
          ↓ CSV
        </button>
      </div>

      {/* ── Toolbar: Periods + Metric ── */}
      <div className="flex items-center gap-1 px-4 pb-3 overflow-x-auto -webkit-overflow-scrolling-touch">
        <div className="flex gap-0.5 shrink-0">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={[
                'px-2 py-2.5 min-h-[44px] rounded text-[10px] font-semibold transition-colors whitespace-nowrap',
                period === p.value
                  ? 'bg-indigo-500 text-white'
                  : 'text-white/30 hover:text-white/70 hover:bg-white/8',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>

        {showMetricSelect && (
          <div
            className="ml-auto flex rounded-lg overflow-hidden shrink-0"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {(['indexed', 'absolute'] as Metric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={[
                  'px-3 py-2.5 min-h-[44px] text-[10px] font-semibold transition-colors whitespace-nowrap',
                  metric === m
                    ? 'bg-white/15 text-white'
                    : 'text-white/30 hover:bg-white/8',
                ].join(' ')}
              >
                {m === 'indexed' ? '% Change' : 'Price'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div style={{ height }} className="px-1">
        {isLoading && chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400" />
            <span className="text-xs text-white/25">Loading…</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-white/20">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: tickFill }}
                tickLine={false} axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: tickFill }}
                tickLine={false} axisLine={false}
                width={metric === 'indexed' ? 46 : 56}
                tickFormatter={v =>
                  metric === 'indexed'
                    ? `${v >= 100 ? '+' : ''}${(v - 100).toFixed(0)}%`
                    : v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
                }
              />
              {metric === 'indexed' && (
                <ReferenceLine
                  y={100}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 3"
                />
              )}
              <Tooltip
                content={<ChartTooltip tickers={tickers} metric={metric} isDark={isDark} />}
                cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1, strokeDasharray: '4 3' }}
              />
              {tickers.map((ticker, i) => (
                <Line
                  key={ticker}
                  type="monotone"
                  dataKey={ticker}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subtle loading indicator while refreshing existing chart */}
      {isLoading && chartData.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2 pt-1">
          <div className="h-2 w-2 animate-spin rounded-full border border-white/15 border-t-indigo-400" />
          <span className="text-[10px] text-white/20">Updating…</span>
        </div>
      )}
      <div className="pb-3" />
    </div>
  )
}
