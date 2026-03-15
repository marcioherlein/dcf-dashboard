'use client'
import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt } from '@/lib/utils'

const PERIODS = ['1mo', '3mo', '1y', '5y'] as const
type Period = typeof PERIODS[number]

interface Props { ticker: string }

interface Bar { date: string; close: number }

export default function PriceChart({ ticker }: Props) {
  const [period, setPeriod] = useState<Period>('1y')
  const [data, setData] = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/historical?ticker=${ticker}&period=${period}`)
      .then((r) => r.json())
      .then((raw: { date: string; close: number }[]) => {
        setData(raw.map((p) => ({
          date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          close: p.close,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker, period])

  const min = data.length ? Math.min(...data.map((d) => d.close)) * 0.97 : 0
  const max = data.length ? Math.max(...data.map((d) => d.close)) * 1.01 : 0
  const up = data.length >= 2 && data[data.length - 1].close >= data[0].close

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Price Chart</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                period === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-56">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[min, max]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={50} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                formatter={(v) => [`$${fmt(v as number)}`, 'Price']}
              />
              <Area type="monotone" dataKey="close" stroke={up ? '#10b981' : '#ef4444'} fill="url(#grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
