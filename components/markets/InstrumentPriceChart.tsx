'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { HistoryPoint } from '@/app/api/markets/history/route'

const PERIODS = ['5D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'] as const
type Period = typeof PERIODS[number]

interface Props {
  symbol: string
  currency?: string
}

function fmtPrice(v: number, currency = 'USD'): string {
  if (!isFinite(v)) return '—'
  if (currency === 'USD' || currency === '' ) {
    return v >= 1000
      ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '$' + v.toFixed(2)
  }
  return v.toFixed(4)
}

function fmtAxisPrice(v: number): string {
  if (v >= 10000) return '$' + (v / 1000).toFixed(1) + 'k'
  if (v >= 1000)  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 100)   return '$' + v.toFixed(0)
  if (v >= 1)     return '$' + v.toFixed(2)
  return v.toFixed(4)
}

function fmtXDate(d: string, period: Period): string {
  if (!d) return ''
  const date = new Date(d)
  if (period === '5D') return date.toLocaleDateString('en-US', { weekday: 'short' })
  if (period === '1M' || period === '3M')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: any[]; currency: string }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as HistoryPoint
  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl shadow-lg px-3 py-2 text-xs">
      <div className="text-[#566174] font-mono text-[10px] mb-1">{d.date}</div>
      <div className="font-bold text-[#06101F] font-mono tabular-nums">{fmtPrice(d.close, currency)}</div>
      {d.volume != null && (
        <div className="text-[#8A95A6] text-[10px] mt-0.5">
          Vol: {d.volume.toLocaleString('en-US')}
        </div>
      )}
    </div>
  )
}

export default function InstrumentPriceChart({ symbol, currency = 'USD' }: Props) {
  const [period, setPeriod] = useState<Period>('1Y')
  const [data, setData] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&period=${p}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json.points ?? [])
    } catch {
      setData([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  // Thin to at most 250 points
  const displayData = data.length > 250
    ? data.filter((_, i) => i % Math.ceil(data.length / 250) === 0 || i === data.length - 1)
    : data

  const firstClose = displayData[0]?.close ?? null
  const lastClose  = displayData[displayData.length - 1]?.close ?? null
  const isUp       = firstClose != null && lastClose != null && lastClose >= firstClose

  const allCloses  = displayData.map(d => d.close).filter(isFinite)
  const domainMin  = allCloses.length ? Math.min(...allCloses) * 0.998 : 0
  const domainMax  = allCloses.length ? Math.max(...allCloses) * 1.002 : 100

  const upColor   = '#059669'
  const downColor = '#DC2626'
  const lineColor = isUp ? upColor : downColor

  return (
    <div className="rounded-xl card">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-[#E3E1DA] flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#8A95A6] shrink-0">Price Chart</span>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide ml-2">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2 py-2.5 min-h-[44px] text-[11px] font-semibold rounded transition-colors',
                period === p
                  ? 'bg-olive-100 text-olive-700'
                  : 'text-[#566174] hover:text-[#06101F] hover:bg-[#E3E1DA]',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      <div className="px-4 py-3" style={{ height: 'clamp(200px, 35vw, 280px)' }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#8A95A6] motion-safe:animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        ) : error || displayData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-[#8A95A6]">Chart data unavailable for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={lineColor} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={d => fmtXDate(d, period)}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtAxisPrice}
                domain={[domainMin, domainMax]}
                width={58}
              />
              <Tooltip content={<ChartTooltip currency={currency} />} />
              {firstClose != null && (
                <ReferenceLine
                  y={firstClose}
                  stroke="rgba(148,163,184,0.4)"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              )}
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#grad-${symbol})`}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
