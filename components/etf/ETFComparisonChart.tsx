'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const LINE_COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#8b5cf6']

interface PriceBar {
  date: string
  close: number
}

interface SeriesData {
  ticker: string
  points: Array<{ date: string; value: number }>
  color: string
}

interface Props {
  symbols: string[]
}

// Dynamic recharts import (SSR-safe)
const DynamicChart = dynamic(
  () => import('recharts').then((m) => {
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } = m
    return function Chart({ series }: { series: SeriesData[] }) {
      const allDates = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.date)))).sort()
      const chartData = allDates.map((date) => {
        const row: Record<string, string | number> = { date }
        for (const s of series) {
          const pt = s.points.find((p) => p.date === date)
          if (pt) row[s.ticker] = +pt.value.toFixed(2)
        }
        return row
      })
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(v) => String(v).slice(0, 4)}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Indexed to 100', angle: -90, position: 'insideLeft', offset: 16, style: { fontSize: 9, fill: '#94a3b8' } }}
            />
            <Tooltip
              contentStyle={{ background: '#0d1b2e', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', fontSize: '11px', color: '#e2e8f0' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [String((+v).toFixed(1)), '']}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            {series.map((s) => (
              <Line key={s.ticker} type="monotone" dataKey={s.ticker} stroke={s.color} dot={false} strokeWidth={1.5} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[260px] rounded-xl bg-slate-100 animate-pulse" /> },
)

export function ETFComparisonChart({ symbols }: Props) {
  const [series, setSeries] = useState<SeriesData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (symbols.length === 0) return
    setLoading(true)
    Promise.allSettled(
      symbols.map((ticker) =>
        fetch(`/api/price-history?ticker=${ticker}`)
          .then((r) => r.json())
          .then((bars: PriceBar[]) => ({ ticker, bars }))
          .catch(() => ({ ticker, bars: [] as PriceBar[] })),
      ),
    ).then((results) => {
      const next: SeriesData[] = []
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled' || r.value.bars.length < 2) return
        const bars = r.value.bars
        const base = bars[0].close
        if (!base) return
        next.push({
          ticker: r.value.ticker,
          color: LINE_COLORS[i % LINE_COLORS.length],
          points: bars.map((b) => ({ date: b.date, value: (b.close / base) * 100 })),
        })
      })
      setSeries(next)
      setLoading(false)
    })
  }, [symbols])

  if (loading) return <div className="h-[260px] rounded-xl bg-slate-100 animate-pulse" />
  if (series.length === 0) return <p className="text-sm text-slate-400 py-4">Price history unavailable.</p>

  return <DynamicChart series={series} />
}
