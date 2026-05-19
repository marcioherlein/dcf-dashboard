'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ChartPoint } from '@/app/api/markets/chart/route'

const PERIODS = ['5D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'] as const
type Period = typeof PERIODS[number]

const DEFAULT_SERIES = [
  { symbol: '^NDX',  label: 'Nasdaq 100', color: '#6366f1' },
  { symbol: '^GSPC', label: 'S&P 500',    color: '#3b82f6' },
  { symbol: '^DJI',  label: 'Dow Jones',  color: '#f59e0b' },
  { symbol: '^VIX',  label: 'CBOE VIX',   color: '#8b5cf6' },
  { symbol: 'FXI',   label: 'China',      color: '#ef4444' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-float px-3 py-2.5 text-xs min-w-[160px]">
      <div className="text-slate-400 font-mono mb-1.5 text-[10px]">{label}</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-slate-600">{DEFAULT_SERIES.find(s => s.symbol === p.name)?.label ?? p.name}</span>
          </div>
          <span className={cn('font-mono font-bold', p.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function NormalizedPerfChart() {
  const [period, setPeriod] = useState<Period>('YTD')
  const [active, setActive] = useState<Set<string>>(new Set(DEFAULT_SERIES.map(s => s.symbol)))
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const symbols = DEFAULT_SERIES.map(s => s.symbol).join(',')
      const res = await fetch(`/api/markets/chart?symbols=${symbols}&period=${p}`)
      const json = await res.json()
      setData(json.points ?? [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  const toggleSeries = (sym: string) => {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(sym)) { if (next.size > 1) next.delete(sym) }
      else next.add(sym)
      return next
    })
  }

  // Thin the data for display — show at most 200 points
  const displayData = data.length > 200
    ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0 || i === data.length - 1)
    : data

  // Format x-axis date labels
  const fmtDate = (d: string) => {
    if (!d) return ''
    const date = new Date(d)
    if (period === '5D') return date.toLocaleDateString('en-US', { weekday: 'short' })
    if (['1M', '3M'].includes(period)) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  // Compute last values for legend chips
  const lastPoint = displayData[displayData.length - 1]

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Normalized Performance</span>
          <div className="flex gap-0.5">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-semibold rounded transition-colors',
                  period === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {/* Series toggle chips */}
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_SERIES.map(s => {
            const val = lastPoint?.[s.symbol] as number | undefined
            const isOn = active.has(s.symbol)
            return (
              <button
                key={s.symbol}
                onClick={() => toggleSeries(s.symbol)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all',
                  isOn
                    ? 'border-transparent text-white'
                    : 'border-slate-200 bg-white text-slate-400 opacity-50'
                )}
                style={isOn ? { background: s.color } : {}}
              >
                <span>{s.label}</span>
                {val != null && isOn && (
                  <span className="opacity-90">
                    {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 py-3" style={{ height: 280 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtDate}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v >= 0 ? '' : ''}${(v as number).toFixed(0)}%`}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 2" />
              {DEFAULT_SERIES.filter(s => active.has(s.symbol)).map(s => (
                <Line
                  key={s.symbol}
                  type="monotone"
                  dataKey={s.symbol}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
