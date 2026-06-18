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
  label, value, pct, last, negative,
}: {
  label: string
  value: string
  pct: number
  last?: boolean
  negative?: boolean
}) {
  const valueColor = negative ? 'text-[#D83B3B]' : value === '—' ? 'text-[#9B9B9B]' : 'text-[#11875D]'
  const barColor = negative ? '#D83B3B' : '#5F790B'

  return (
    <div className={cn('py-3', !last && 'border-b border-[rgba(15,23,42,0.06)]')}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] text-[#6B6B6B]">{label}</span>
        <span className={cn('text-[14px] font-[700] tabular-nums', valueColor)}>{value}</span>
      </div>
      <div className="h-[6px] rounded-full overflow-hidden" style={{ background: '#e8ebe3' }}>
        {pct > 0 && (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor }}
          />
        )}
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
        <h3 className="text-[15px] font-[700] text-[#111111]">Quality Snapshot</h3>
      </div>

      <div>
        <QualityRow
          label="Revenue Growth (YoY)"
          value={fmtPct(revenueGrowth)}
          pct={barWidth(revenueGrowth, 0.50)}
          negative={(revenueGrowth ?? 0) < 0}
        />
        <QualityRow
          label="Gross Margin"
          value={fmtPct(grossMargin)}
          pct={barWidth(grossMargin, 1.0)}
          negative={(grossMargin ?? 0) < 0}
        />
        <QualityRow
          label="FCF Margin"
          value={fmtPct(fcfMargin)}
          pct={barWidth(fcfMargin, 0.50)}
          negative={(fcfMargin ?? 0) < 0}
        />
        <QualityRow
          label="ROIC"
          value={fmtPct(roic)}
          pct={barWidth(roic, 0.40)}
          negative={(roic ?? 0) < 0}
          last
        />
      </div>
    </div>
  )
}
