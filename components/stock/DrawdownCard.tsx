'use client'
import { useState, useEffect } from 'react'
import type { DrawdownResult } from '@/app/api/stock/drawdown/route'

interface Props {
  ticker: string
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] text-[#9B9B9B] leading-tight">{label}</p>
      <p className="text-[18px] font-[800] tabular-nums leading-none" style={{ color: color ?? '#111111' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#9B9B9B] leading-tight">{sub}</p>}
    </div>
  )
}

export default function DrawdownCard({ ticker }: Props) {
  const [data, setData]       = useState<DrawdownResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(false)
    fetch(`/api/stock/drawdown?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then((d: DrawdownResult | { error?: string }) => {
        if ('error' in d) { setError(true); return }
        setData(d as DrawdownResult)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
        <div className="h-4 w-32 rounded bg-[#E5E5E5] animate-pulse mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-[#E5E5E5] animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error || !data) return null

  const ddPct = `${(data.maxDrawdown * 100).toFixed(1)}%`
  const ddColor = data.maxDrawdown > -0.20 ? '#B56A00' : data.maxDrawdown > -0.40 ? '#D83B3B' : '#D83B3B'

  const fmtMonth = (m: number | null) => {
    if (m == null) return '—'
    if (m < 1) return '<1 mo'
    return `${m} mo`
  }

  const recoveryLabel = data.recoveryTime != null
    ? fmtMonth(data.recoveryTime)
    : 'Not yet'
  const recoveryColor = data.recoveryTime != null ? '#11875D' : '#B56A00'

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[13px] font-[700] text-[#111111]">Historical Drawdown</p>
          <p className="text-[11px] text-[#9B9B9B]">
            Worst peak-to-trough over {data.dataYears}Y · what a bad entry looked like
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          label="Max drawdown"
          value={ddPct}
          sub={`Peak ${data.peakDate.slice(0,7)}`}
          color={ddColor}
        />
        <Stat
          label="Time to trough"
          value={fmtMonth(data.drawdownDuration)}
          sub={`Trough ${data.troughDate.slice(0,7)}`}
          color="#566174"
        />
        <Stat
          label="Recovery time"
          value={recoveryLabel}
          sub={data.recoveryDate ? `Recovered ${data.recoveryDate.slice(0,7)}` : 'Still recovering or N/A'}
          color={recoveryColor}
        />
        <Stat
          label="Total downtime"
          value={fmtMonth(data.drawdownDuration + (data.recoveryTime ?? 0))}
          sub="Peak to full recovery"
          color="#566174"
        />
      </div>

      {/* Context note */}
      <p className="text-[10px] text-[#9B9B9B] mt-3 leading-snug">
        This shows the worst sustained decline in {data.dataYears} years — useful for sizing positions and
        setting realistic holding-period expectations. Past drawdowns don&apos;t predict future ones.
      </p>
    </div>
  )
}
