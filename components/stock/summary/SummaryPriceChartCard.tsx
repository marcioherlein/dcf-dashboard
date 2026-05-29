'use client'

import dynamic from 'next/dynamic'
import { fmtPrice, fmtLargeCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryPriceChartCardProps {
  ticker: string
  fairValue: number | null
  analystTargetMean: number | null
  userModelFairValue: number | null
  high52: number
  low52: number
  marketCap: number | null
  beta: number | null
  currency: string
}

// ─── Dynamic import ───────────────────────────────────────────────────────────

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="h-[160px] animate-pulse rounded-xl bg-slate-50" />,
})

// ─── Card shell ───────────────────────────────────────────────────────────────

const CARD = 'bg-white border border-[#E6ECF5] rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]'

// ─── Legend item ──────────────────────────────────────────────────────────────

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-6 h-0 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
      />
      <span className="text-[11px] text-[#64748B]">{label}</span>
    </div>
  )
}

// ─── Footer metric ────────────────────────────────────────────────────────────

function FooterMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-0.5">{label}</p>
      <p className="text-[13px] font-[700] text-[#0F172A] tabular-nums">{value}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SummaryPriceChartCard({
  ticker,
  fairValue,
  analystTargetMean,
  userModelFairValue,
  high52,
  low52,
  marketCap,
  beta,
  currency,
}: SummaryPriceChartCardProps) {
  return (
    <div className={cn(CARD, 'flex flex-col p-5 gap-3')}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[14px] font-[750] text-[#0F172A]">Price Chart</p>
        <div className="flex items-center gap-3 flex-wrap">
          <LegendItem color="#10b981" label="Price" />
          <LegendItem color="#8b5cf6" dashed label="Fair Value" />
          <LegendItem color="#F59E0B" dashed label="Analyst Target" />
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[155px]">
        <PriceChart
          ticker={ticker}
          isDark={false}
          triangulatedFairValue={fairValue ?? undefined}
          analystTarget={analystTargetMean ?? undefined}
          userModelFairValue={userModelFairValue}
        />
      </div>

      {/* Footer metrics */}
      <div className="overflow-x-auto scrollbar-hide border-t border-[#E6ECF5] mt-2">
        <div className="grid grid-cols-5 gap-0 divide-x divide-[#E6ECF5] min-w-[380px]">
          <FooterMetric label="52W Low"       value={fmtPrice(low52, currency)} />
          <FooterMetric label="52W High"      value={fmtPrice(high52, currency)} />
          <FooterMetric label="Market Cap"    value={fmtLargeCurrency(marketCap, currency)} />
          <FooterMetric label="Beta (1Y)"     value={beta != null ? beta.toFixed(2) : '—'} />
          <FooterMetric label="Avg. Vol (3M)" value="—" />
        </div>
      </div>

    </div>
  )
}
