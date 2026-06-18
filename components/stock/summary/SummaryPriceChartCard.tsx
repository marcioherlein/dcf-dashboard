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
  loading: () => <div className="h-[160px] motion-safe:animate-pulse rounded-xl bg-[#F0F1F6]" />,
})

// ─── Card shell ───────────────────────────────────────────────────────────────

const CARD = 'bg-white border border-[#E5E5E5] rounded-xl shadow-card'

// ─── Footer metric ────────────────────────────────────────────────────────────

function FooterMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2 text-center">
      <p className="text-[10px] font-[600] text-[#6B6B6B] mb-0.5 truncate">{label}</p>
      <p className="text-[12px] font-[700] text-[#111111] tabular-nums whitespace-nowrap">{value}</p>
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
    <div className={cn(CARD, 'flex flex-col overflow-hidden')}>

      {/* Chart — PriceChart renders its own header with title + legend */}
      <div className="flex-1 min-h-[160px] sm:min-h-[220px]">
        <PriceChart
          ticker={ticker}
          isDark={false}
          triangulatedFairValue={fairValue ?? undefined}
          analystTarget={analystTargetMean ?? undefined}
          userModelFairValue={userModelFairValue}
        />
      </div>

      {/* Footer metrics */}
      <div className="border-t border-[#E5E5E5]">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#E5E5E5]">
          <FooterMetric label="52W Low"    value={fmtPrice(low52, currency)} />
          <FooterMetric label="52W High"   value={fmtPrice(high52, currency)} />
          <FooterMetric label="Market Cap" value={fmtLargeCurrency(marketCap, currency)} />
          <FooterMetric label="Beta (1Y)"  value={beta != null ? beta.toFixed(2) : '—'} />
        </div>
      </div>

    </div>
  )
}
