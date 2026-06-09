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
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8A95A6' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#8A95A6' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0d1b2e', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', fontSize: '11px', color: '#E3E1DA' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [String(v), 'Value Score']}
            />
            <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={1.5} fill="url(#scoreGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[140px] rounded-lg bg-[#F4F3EF] motion-safe:animate-pulse" /> },
)

export function ETFValuationHistory({ ticker }: Props) {
  const [data, setData] = useState<ScorePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ticker) return
    fetch(`/api/etf/score-history?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: ScorePoint[]) => { setData(d); setLoading(false) })
      .catch(() => { setData([]); setError(true); setLoading(false) })
  }, [ticker])

  if (loading) {
    return (
      <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
        <p className="text-[13px] font-[700] text-[#111111] mb-3">Value Score History</p>
        <div className="h-[140px] bg-[#F4F3EF] rounded-lg motion-safe:animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
      <p className="text-[13px] font-[700] text-[#111111] mb-3">Value Score History</p>
      {data.length < 7 ? (
        <div className="h-[140px] flex flex-col items-center justify-center gap-2 rounded-lg bg-[#F4F3EF] border border-dashed border-[#E3E1DA]">
          {error ? (
            <>
              <p className="text-sm text-[#566174] font-semibold">Score history unavailable.</p>
              <p className="text-xs text-[#8A95A6] text-center max-w-xs">
                Check back later.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#566174] font-semibold">Building history…</p>
              <p className="text-xs text-[#8A95A6] text-center max-w-xs">
                Score history is building — more data points appear each day this ETF is tracked.
              </p>
            </>
          )}
        </div>
      ) : (
        <DynamicChart data={data} />
      )}
    </div>
  )
}
