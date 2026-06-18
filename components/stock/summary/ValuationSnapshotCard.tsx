'use client'

import { cn } from '@/lib/utils'
import { fmtLargeCurrency } from '@/lib/formatters'
import { DollarSign } from 'lucide-react'

interface Props {
  marketCap?: number | null
  peRatio?: number | null
  forwardPE?: number | null
  pegRatio?: number | null
  beta?: number | null
  evToEbitda?: number | null
  currency?: string
}

function MetricRow({
  label, value, sentiment, last,
}: {
  label: string
  value: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  last?: boolean
}) {
  const valColor =
    sentiment === 'positive' ? 'text-[#11875D]'
    : sentiment === 'negative' ? 'text-[#D83B3B]'
    : 'text-[#111111]'

  return (
    <div className={cn(
      'flex items-center justify-between py-3',
      !last && 'border-b border-[rgba(15,23,42,0.06)]',
    )}>
      <span className="text-[13px] text-[#6B6B6B]">{label}</span>
      <span className={cn('text-[14px] font-[700] tabular-nums', valColor)}>{value}</span>
    </div>
  )
}

export default function ValuationSnapshotCard({
  marketCap, peRatio, forwardPE, pegRatio, beta, evToEbitda, currency = 'USD',
}: Props) {
  // PEG sentiment
  const pegSentiment = pegRatio == null ? 'neutral' : pegRatio < 1.5 ? 'positive' : pegRatio > 2.5 ? 'negative' : 'neutral'

  const fmtPE = (v: number | null | undefined) => v != null && isFinite(v) && v > 0 ? `${v.toFixed(1)}×` : '—'
  const fmtNum = (v: number | null | undefined, dec = 2) => v != null && isFinite(v) ? v.toFixed(dec) : '—'

  return (
    <div
      className="bg-white rounded-2xl p-4"
      style={{
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-7 h-7 rounded-lg bg-[#EEF2FA] flex items-center justify-center shrink-0">
          <DollarSign size={14} className="text-[#5F790B]" />
        </div>
        <h3 className="text-[15px] font-[700] text-[#111111]">Valuation Snapshot</h3>
      </div>

      <div>
        <MetricRow label="Market Cap"    value={marketCap != null ? fmtLargeCurrency(marketCap, currency) : '—'} />
        <MetricRow label="P/E (TTM)"     value={fmtPE(peRatio)} />
        <MetricRow label="Forward P/E"   value={fmtPE(forwardPE)} />
        <MetricRow label="PEG"           value={fmtNum(pegRatio)} sentiment={pegSentiment} />
        {evToEbitda != null && evToEbitda > 0 && (
          <MetricRow label="EV/EBITDA" value={fmtPE(evToEbitda)} />
        )}
        <MetricRow label="Beta"          value={fmtNum(beta)} last />
      </div>
    </div>
  )
}
