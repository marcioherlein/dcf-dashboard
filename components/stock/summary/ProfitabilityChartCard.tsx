'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RatioQuarter {
  date: string
  grossProfitMargin?: number | null
  operatingProfitMargin?: number | null
  netProfitMargin?: number | null
  ebitdaMargin?: number | null
}

interface FinancialStatement {
  year: string
  revenue: number | null
  grossProfit: number | null
  operatingIncome: number | null
  netIncome: number | null
  isProjected: boolean
}

interface Props {
  ratiosQuarterly?: RatioQuarter[]
  financialStatements?: FinancialStatement[]
}

// ─── Point shape the chart consumes ──────────────────────────────────────────

interface ChartPoint {
  period: string
  grossMargin: number | null
  ebitMargin: number | null
  netMargin: number | null
}

// ─── Dynamic recharts import ──────────────────────────────────────────────────

const ChartBody = dynamic(() => import('./ProfitabilityChartBody'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] motion-safe:animate-pulse rounded-lg bg-[#F4F3EF]" />
  ),
})

// ─── Data derivation ──────────────────────────────────────────────────────────

function derivePoints(
  ratiosQuarterly?: RatioQuarter[],
  financialStatements?: FinancialStatement[],
): ChartPoint[] {
  // Prefer quarterly ratios — last 12, oldest first
  if (ratiosQuarterly && ratiosQuarterly.length > 0) {
    return [...ratiosQuarterly]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map((r) => ({
        period: r.date.slice(0, 7), // YYYY-MM
        grossMargin: r.grossProfitMargin != null ? r.grossProfitMargin * 100 : null,
        ebitMargin:
          r.operatingProfitMargin != null ? r.operatingProfitMargin * 100 : null,
        netMargin: r.netProfitMargin != null ? r.netProfitMargin * 100 : null,
      }))
  }

  // Annual fallback — filter out projected, last 8, oldest first
  if (financialStatements && financialStatements.length > 0) {
    return [...financialStatements]
      .filter((s) => !s.isProjected)
      .sort((a, b) => a.year.localeCompare(b.year))
      .slice(-8)
      .map((s) => {
        const rev = s.revenue && s.revenue !== 0 ? s.revenue : null
        return {
          period: s.year,
          grossMargin:
            rev != null && s.grossProfit != null
              ? (s.grossProfit / rev) * 100
              : null,
          ebitMargin:
            rev != null && s.operatingIncome != null
              ? (s.operatingIncome / rev) * 100
              : null,
          netMargin:
            rev != null && s.netIncome != null
              ? (s.netIncome / rev) * 100
              : null,
        }
      })
  }

  return []
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function LegendItem({
  label,
  color,
  style,
}: {
  label: string
  color: string
  style: 'solid' | 'dashed' | 'dotted'
}) {
  const dashArray =
    style === 'dashed' ? '6 3' : style === 'dotted' ? '2 3' : undefined

  return (
    <span className="flex items-center gap-1.5">
      <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
        <line
          x1="0"
          y1="6"
          x2="28"
          y2="6"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={dashArray}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[10px] font-[600] text-[#6B6B6B]">{label}</span>
    </span>
  )
}

// ─── Info tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-[#6B6B6B] hover:text-[#111111] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1 rounded min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
      >
        <Info size={13} strokeWidth={1.8} />
      </button>
      {visible && (
        <span
          role="tooltip"
          className="
            absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2
            w-max max-w-[180px] px-2.5 py-1.5
            bg-[#111111] text-white text-[10px] leading-snug
            rounded-md shadow-lg z-50 pointer-events-none
          "
        >
          {text}
        </span>
      )}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfitabilityChartCard({
  ratiosQuarterly,
  financialStatements,
}: Props) {
  const points = useMemo(
    () => derivePoints(ratiosQuarterly, financialStatements),
    [ratiosQuarterly, financialStatements],
  )

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4" aria-label="Profitability margins chart">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#111111]">
            Profitability Chart
          </span>
          <InfoTooltip text="Gross, EBIT and Net profit margins as a % of revenue. Quarterly (last 12Q) or annual (last 8Y) data." />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <LegendItem label="Gross Margin" color="#5F790B" style="solid" />
          <LegendItem label="EBIT Margin"  color="#B56A00" style="dashed" />
          <LegendItem label="Net Margin"   color="#6B6B6B" style="dotted" />
        </div>
      </div>

      {/* Chart */}
      {points.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <span className="text-[12px] text-[#9B9B9B]">No margin data available</span>
        </div>
      ) : (
        <div role="img" aria-label="Profitability margins over time line chart">
          <ChartBody points={points} />
        </div>
      )}
    </div>
  )
}
