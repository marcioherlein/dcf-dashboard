'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

interface ScorePoint {
  score: number
  ts: string
}

interface Props {
  ticker: string
}

const DynamicChart = dynamic(
  () => import('recharts').then((m) => {
    const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } = m
    return function Chart({ data }: { data: ScorePoint[] }) {
      const chartData = data.map((d) => ({
        date: d.ts.slice(0, 10),
        score: d.score,
      }))
      return (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0d1b2e', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', fontSize: '11px', color: '#e2e8f0' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [String(v), 'Value Score']}
            />
            <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={1.5} fill="url(#scoreGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[140px] rounded-lg bg-slate-100 animate-pulse" /> },
)

export function ETFValuationHistory({ ticker }: Props) {
  const [data, setData] = useState<ScorePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    fetch(`/api/etf/score-history?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: ScorePoint[]) => { setData(d); setLoading(false) })
      .catch(() => { setData([]); setLoading(false) })
  }, [ticker])

  if (loading) {
    return (
      <div className="glass-card-light rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Value Score History</p>
        <div className="h-[140px] bg-slate-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="glass-card-light rounded-xl p-4">
      <p className="text-sm font-semibold text-slate-700 mb-3">Value Score History</p>
      {data.length < 7 ? (
        <div className="h-[140px] flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 border border-dashed border-slate-200">
          <p className="text-sm text-slate-500 font-semibold">Building history…</p>
          <p className="text-xs text-slate-400 text-center max-w-xs">
            Value Score history populates as more users view this ETF. Check back in a few days.
          </p>
        </div>
      ) : (
        <DynamicChart data={data} />
      )}
    </div>
  )
}
