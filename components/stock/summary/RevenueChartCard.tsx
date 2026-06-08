'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'

// ─── Dynamic recharts import (SSR: false) ─────────────────────────────────────

const BarChartComponents = dynamic(
  () =>
    import('recharts').then((mod) => {
      const { BarChart, Bar, XAxis, CartesianGrid, Cell, LabelList, ResponsiveContainer } = mod
      // Return a wrapper component that receives all needed props
      function RevenueBar({
        data,
        unit,
        height = 180,
      }: {
        data: Array<{ label: string; value: number; isProjected?: boolean }>
        unit: 'B' | 'M'
        height?: number
      }) {
        const divisor = unit === 'B' ? 1e9 : 1e6

        // Custom label rendered above each bar
        function CustomLabel(props: {
          x?: number
          y?: number
          width?: number
          value?: number
        }) {
          const { x = 0, y = 0, width = 0, value } = props
          if (value == null) return null
          const displayVal = (value / divisor).toFixed(1)
          return (
            <text
              x={x + width / 2}
              y={y - 4}
              fill="var(--color-text-secondary)"
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
            >
              {displayVal}
            </text>
          )
        }

        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 4 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#E5E5E5" strokeDasharray="0" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
                <LabelList content={<CustomLabel />} />
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isProjected ? '#A8BD5C' : '#5F790B'}
                    opacity={entry.isProjected ? 0.65 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }

      return RevenueBar
    }),
  { ssr: false }
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statementsData: any
  financialStatements?: Array<{
    year: string
    revenue: number | null
    isProjected: boolean
  }>
  currency?: string
}

type ViewMode = 'annual' | 'quarterly'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive quarter label from an ISO date string.
 * e.g. "2023-06-30" → "Q2 '23"
 */
function quarterLabel(endDate: string): string {
  const d = new Date(endDate)
  if (isNaN(d.getTime())) return endDate.slice(0, 7)
  const month = d.getUTCMonth() + 1 // 1–12
  const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4
  const yr = String(d.getUTCFullYear()).slice(2)
  return `Q${q} '${yr}`
}

function pickUnit(maxValue: number): 'B' | 'M' {
  return maxValue >= 1e9 ? 'B' : 'M'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RevenueChartCard({
  statementsData,
  financialStatements,
  currency = 'USD',
}: Props) {
  const [view, setView] = useState<ViewMode>('annual')

  // ── Annual data ─────────────────────────────────────────────────────────────
  const annualChartData = useMemo(() => {
    const rows = (financialStatements ?? [])
      .filter((r) => r.revenue != null && !r.isProjected)
      .slice(-6)

    return rows.map((r) => ({
      label: String(r.year),
      value: r.revenue as number,
      isProjected: false,
    }))
  }, [financialStatements])

  // ── Quarterly data ───────────────────────────────────────────────────────────
  const quarterlyChartData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = statementsData?.quarterly?.incomeStatement ?? []
    return rows
      .filter((r) => r.totalRevenue != null && (r.totalRevenue as number) > 0)
      .slice(-8)
      .map((r) => ({
        label: quarterLabel(String(r.endDate ?? '')),
        value: r.totalRevenue as number,
        isProjected: false,
      }))
  }, [statementsData])

  // ── Select active dataset ────────────────────────────────────────────────────
  const chartData = view === 'annual' ? annualChartData : quarterlyChartData

  const maxValue = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 0
  const unit = pickUnit(maxValue)
  const currencyCode = (statementsData?.financialCurrency ?? currency ?? 'USD').toUpperCase()
  const unitLabel = `(${unit} ${currencyCode})`

  const hasData = chartData.length > 0

  // ── Pill toggle styles ───────────────────────────────────────────────────────
  function pillCls(active: boolean) {
    return [
      'px-2.5 py-0.5 rounded-full text-[11px] font-semibold leading-none border transition-colors cursor-pointer select-none',
      'min-h-[44px] min-w-[44px] flex items-center justify-center',
      'focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1 focus-visible:outline-none',
      'active:scale-95 active:opacity-90',
      active
        ? 'bg-[#5F790B] text-white border-[#5F790B]'
        : 'bg-white text-text-secondary border-border-warm hover:border-[#5F790B] hover:bg-olive-50 hover:text-olive-600',
    ].join(' ')
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-0.5">
        <div>
          <p className="text-[11px] font-bold text-text-secondary leading-none">
            Revenue
          </p>
          <p className="text-xs text-[#8A95A6] mt-1 leading-none">{unitLabel}</p>
        </div>

        {/* Toggle pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={pillCls(view === 'quarterly')}
            onClick={() => setView('quarterly')}
            aria-pressed={view === 'quarterly'}
            aria-label="Quarterly"
          >
            Q
          </button>
          <button
            type="button"
            className={pillCls(view === 'annual')}
            onClick={() => setView('annual')}
            aria-pressed={view === 'annual'}
            aria-label="Annual"
          >
            Y
          </button>
        </div>
      </div>

      {/* ── Chart ── */}
      {hasData ? (
        <div
          className="mt-2"
          role="img"
          aria-label={`Revenue bar chart, ${view} view, values in ${unitLabel}`}
        >
          <BarChartComponents data={chartData} unit={unit} />
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <div className="flex items-center justify-center h-[180px]">
            <p className="text-[11px] text-[#8A95A6]">No data available</p>
          </div>
        </div>
      )}
    </div>
  )
}
