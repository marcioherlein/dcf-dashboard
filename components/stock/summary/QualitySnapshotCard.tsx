'use client'

import { cn } from '@/lib/utils'
import { ShieldCheck } from 'lucide-react'

interface Props {
  revenueGrowth?: number | null   // decimal, e.g. 0.60
  grossMargin?: number | null     // decimal, e.g. 0.741
  fcfMargin?: number | null       // decimal, e.g. 0.45
  roic?: number | null            // decimal, e.g. 1.355
}

// Cap value to [0,1] for bar width where cap is the denominator
function barWidth(val: number | null | undefined, cap: number): number {
  if (val == null || !isFinite(val)) return 0
  return Math.max(0, Math.min(100, (Math.abs(val) / cap) * 100))
}

function QualityRow({
  label, value, pct, last,
}: {
  label: string
  value: string
  pct: number
  last?: boolean
}) {
  return (
    <div className={cn('py-3', !last && 'border-b border-[rgba(15,23,42,0.06)]')}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] text-[#667085]">{label}</span>
        <span className="text-[14px] font-[700] text-[#0f9f69] tabular-nums">{value}</span>
      </div>
      <div className="h-[6px] rounded-full overflow-hidden" style={{ background: '#e8ebe3' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: '#5F790B' }}
        />
      </div>
    </div>
  )
}

export default function QualitySnapshotCard({ revenueGrowth, grossMargin, fcfMargin, roic }: Props) {
  const fmtPct = (v: number | null | undefined) =>
    v != null && isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—'

  return (
    <div
      className="bg-white rounded-2xl p-5"
      style={{
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-7 h-7 rounded-lg bg-[#F1F7E5] flex items-center justify-center shrink-0">
          <ShieldCheck size={14} className="text-[#5F790B]" />
        </div>
        <h3 className="text-[15px] font-[700] text-[#111827]">Quality Snapshot</h3>
      </div>

      <div>
        <QualityRow
          label="Revenue Growth (YoY)"
          value={fmtPct(revenueGrowth)}
          pct={barWidth(revenueGrowth, 0.50)}  // cap at 50%
        />
        <QualityRow
          label="Gross Margin"
          value={fmtPct(grossMargin)}
          pct={barWidth(grossMargin, 1.0)}      // cap at 100%
        />
        <QualityRow
          label="FCF Margin"
          value={fmtPct(fcfMargin)}
          pct={barWidth(fcfMargin, 0.50)}       // cap at 50%
        />
        <QualityRow
          label="ROIC"
          value={fmtPct(roic)}
          pct={barWidth(roic, 0.40)}            // cap at 40%
          last
        />
      </div>
    </div>
  )
}
