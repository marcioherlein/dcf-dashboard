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
  const accentColor = isUp ? '#059669' : '#DC2626'

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
      <div className="flex-1 bg-black/40" />

      {/* Panel */}
      <div
        className="w-[480px] bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto shadow-card-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">{displayTicker}</span>
              <span
                className="text-sm font-semibold"
                style={{ color: accentColor }}
              >
                {isUp ? '+' : ''}{change1DPct.toFixed(2)}%
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[320px]">{name}</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{fmt(price)}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors mt-0.5 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-100">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={[
                'px-2.5 py-0.5 text-[11px] font-semibold rounded transition-colors',
                period === p.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
          {periodChange !== null && (
            <span
              className="ml-auto text-[11px] font-semibold"
              style={{ color: periodChange >= 0 ? '#059669' : '#DC2626' }}
            >
              {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}% period
            </span>
          )}
        </div>

        {/* Chart */}
        <div className="px-2 py-4 flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-xs">
              Loading…
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-xs">
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
                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[minP, maxP]}
                      tick={{ fontSize: 9, fill: '#94A3B8' }}
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
                          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-card-md">
                            <div className="text-slate-400 mb-1">{label}</div>
                            <div className="text-slate-800 font-bold">{fmt(d.close)}</div>
                            {d.sma20 && <div className="text-amber-500">SMA20 {fmt(d.sma20)}</div>}
                            {d.sma50 && <div className="text-blue-500">SMA50 {fmt(d.sma50)}</div>}
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
                    <Line type="monotone" dataKey="sma20" stroke="#F59E0B" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls strokeDasharray="3 2" />
                    <Line type="monotone" dataKey="sma50" stroke="#3B82F6" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls strokeDasharray="3 2" />
                    {/* Current price line */}
                    <ReferenceLine y={price} stroke="#2563EB" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Volume */}
              <div className="h-14 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis
                      tick={{ fontSize: 8, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
                    />
                    <ReBar dataKey="volume" fill="#E2E8F0" isAnimationActive={false} radius={[1, 1, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="text-center text-[9px] text-slate-400 -mt-1">VOLUME</p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-1 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ background: 'repeating-linear-gradient(90deg, #F59E0B 0, #F59E0B 3px, transparent 3px, transparent 5px)' }} />
                  <span className="text-[9px] text-slate-400">SMA 20</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ background: 'repeating-linear-gradient(90deg, #3B82F6 0, #3B82F6 3px, transparent 3px, transparent 5px)' }} />
                  <span className="text-[9px] text-slate-400">SMA 50</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ background: 'repeating-linear-gradient(90deg, #2563EB 0, #2563EB 4px, transparent 4px, transparent 6px)' }} />
                  <span className="text-[9px] text-slate-400">Last price</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer: open full analysis */}
        <div className="px-5 py-3 border-t border-slate-200">
          <a
            href={`/stock/${ticker}`}
            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Open Full Analysis →
          </a>
        </div>
      </div>
    </div>
  )
}
