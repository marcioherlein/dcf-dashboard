'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Area, ComposedChart, Bar as ReBar, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'

type Period = '1mo' | '3mo' | 'ytd' | '1y'
const PERIODS: { id: Period; label: string }[] = [
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y',  label: '1Y' },
]

interface Bar {
  date: string
  close: number
  volume: number
  high: number
  low: number
}

function calcSMA(closes: number[], p: number) {
  return closes.map((_, i) => {
    if (i < p - 1) return null
    return closes.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p
  })
}

interface Props {
  ticker: string
  displayTicker: string
  name: string
  price: number
  change1DPct: number
  currency: string
  onClose: () => void
}

export default function ScreenerChart({ ticker, displayTicker, name, price, change1DPct, currency, onClose }: Props) {
  const [period, setPeriod] = useState<Period>('3mo')
  const [rawData, setRawData] = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)
  const isUp = change1DPct >= 0
  const accentColor = isUp ? '#3fb950' : '#f85149'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/historical?ticker=${ticker}&period=${period}`)
      .then((r) => r.json())
      .then((raw: {date: string; close: number; volume?: number; high?: number; low?: number}[]) => {
        setRawData(raw.map((p) => ({
          date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          close: p.close,
          volume: p.volume ?? 0,
          high: p.high ?? p.close,
          low: p.low ?? p.close,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker, period])

  const data = useMemo(() => {
    if (!rawData.length) return []
    const closes = rawData.map((d) => d.close)
    const sma20 = calcSMA(closes, 20)
    const sma50 = calcSMA(closes, 50)
    return rawData.map((d, i) => ({ ...d, sma20: sma20[i], sma50: sma50[i] }))
  }, [rawData])

  const closes = data.map((d) => d.close)
  const minP = closes.length ? Math.min(...closes) * 0.97 : 0
  const maxP = closes.length ? Math.max(...closes) * 1.03 : 1
  const periodChange = closes.length >= 2
    ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100
    : null

  const fmt = (v: number) => {
    if (currency === 'ARS') return v >= 1000 ? v.toFixed(0) : v.toFixed(2)
    return `$${v.toFixed(2)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" />

      {/* Panel */}
      <div
        className="w-[480px] bg-[#0d1117] border-l border-[#30363d] flex flex-col h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#21262d]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-[#e6edf3]">{displayTicker}</span>
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: accentColor }}
              >
                {isUp ? '+' : ''}{change1DPct.toFixed(2)}%
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#8b949e] mt-0.5 truncate max-w-[320px]">{name}</div>
            <div className="font-mono text-xl font-bold text-[#e6edf3] mt-1">{fmt(price)}</div>
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
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={[
                'px-2.5 py-0.5 font-mono text-[11px] font-semibold rounded transition-colors',
                period === p.id
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
            <div className="flex items-center justify-center h-48 text-[#6e7681] font-mono text-xs">
              Loading…
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[#6e7681] font-mono text-xs">
              No data available
            </div>
          ) : (
            <>
              {/* Price chart */}
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#21262d" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[minP, maxP]}
                      tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(v) => {
                        if (currency === 'ARS') return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)
                        return `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`
                      }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]?.payload
                        return (
                          <div className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-xs font-mono">
                            <div className="text-[#8b949e] mb-1">{label}</div>
                            <div className="text-[#e6edf3] font-bold">{fmt(d.close)}</div>
                            {d.sma20 && <div className="text-[#f59e0b]">SMA20 {fmt(d.sma20)}</div>}
                            {d.sma50 && <div className="text-[#3b82f6]">SMA50 {fmt(d.sma50)}</div>}
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={accentColor}
                      strokeWidth={1.5}
                      fill={`url(#grad-${ticker})`}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls strokeDasharray="3 2" />
                    <Line type="monotone" dataKey="sma50" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls strokeDasharray="3 2" />
                    {/* Current price line */}
                    <ReferenceLine y={price} stroke="#ff6600" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.6} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Volume */}
              <div className="h-14 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis
                      tick={{ fontSize: 8, fill: '#6e7681' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
                    />
                    <ReBar dataKey="volume" fill="#21262d" isAnimationActive={false} radius={[1, 1, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="text-center font-mono text-[9px] text-[#6e7681] -mt-1">VOLUME</p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-1 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-[#f59e0b]" style={{ background: 'repeating-linear-gradient(90deg, #f59e0b 0, #f59e0b 3px, transparent 3px, transparent 5px)' }} />
                  <span className="font-mono text-[9px] text-[#8b949e]">SMA 20</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 3px, transparent 3px, transparent 5px)' }} />
                  <span className="font-mono text-[9px] text-[#8b949e]">SMA 50</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ background: 'repeating-linear-gradient(90deg, #ff6600 0, #ff6600 4px, transparent 4px, transparent 6px)' }} />
                  <span className="font-mono text-[9px] text-[#8b949e]">Last price</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer: open full analysis */}
        <div className="px-5 py-3 border-t border-[#21262d]">
          <a
            href={`/stock/${ticker}`}
            className="flex items-center justify-center gap-2 w-full py-2 bg-[#ff6600] hover:bg-[#e55a00] text-black font-mono text-xs font-bold rounded transition-colors"
          >
            Open Full Analysis →
          </a>
        </div>
      </div>
    </div>
  )
}
