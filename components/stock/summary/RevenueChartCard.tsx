'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { CHART_GRID } from '@/lib/chartTheme'

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
        periodMode = 'annual',
      }: {
        data: Array<{ label: string; value: number; isProjected?: boolean }>
        unit: 'B' | 'M'
        height?: number
        periodMode?: 'annual' | 'quarterly'
      }) {
        // YoY lookback: 1 for annual, 4 for quarterly (same quarter last year)
        const yoyLookback = periodMode === 'quarterly' ? 4 : 1

        function CustomLabel(props: {
          x?: number
          y?: number
          width?: number
          value?: number
          index?: number
        }) {
          const { x = 0, y = 0, width = 0, value, index = 0 } = props
          if (value == null) return null

          const displayVal = unit === 'B'
            ? `${(value / 1e9).toFixed(1)}B`
            : `${(value / 1e6).toFixed(0)}M`

          // YoY growth
          const prev = data[index - yoyLookback]?.value
          const yoy = (prev != null && prev !== 0)
            ? ((value - prev) / Math.abs(prev)) * 100
            : null
          const yoyText = yoy != null ? `${yoy >= 0 ? '+' : ''}${yoy.toFixed(0)}%` : null
          const yoyColor = yoy == null ? '#9B9B9B' : yoy >= 0 ? '#5F790B' : '#D83B3B'

          return (
            <g>
              {yoyText && (
                <text
                  x={x + width / 2}
                  y={y - 17}
                  fill={yoyColor}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {yoyText}
                </text>
              )}
              <text
                x={x + width / 2}
                y={y - 5}
                fill="#566174"
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {displayVal}
              </text>
            </g>
          )
        }

        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 34, right: 8, left: 8, bottom: 4 }} barCategoryGap="28%">
              <CartesianGrid {...CHART_GRID} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#6B6B6B', fontFamily: 'Inter, system-ui, sans-serif' }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                <LabelList content={(props: any) => <CustomLabel {...props} />} />
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

    if (rows.length > 0) {
      return rows.map((r) => ({
        label: String(r.year),
        value: r.revenue as number,
        isProjected: false,
      }))
    }

    // Fallback for foreign stocks: statementsData.annual.incomeStatement
    const annualRows = (statementsData && statementsData.annual && statementsData.annual.incomeStatement) ? statementsData.annual.incomeStatement : []
    const validAnnual = annualRows.filter(function(r: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const rev = r.totalRevenue != null ? r.totalRevenue : (r.revenue != null ? r.revenue : null)
      return rev != null && rev > 0
    })
    if (validAnnual.length > 0) {
      return validAnnual.slice(-6).map(function(r: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const rev = r.totalRevenue != null ? r.totalRevenue : r.revenue
        const lbl = String(r.year != null ? r.year : (r.endDate != null ? r.endDate : "")).slice(0, 4)
        return { label: lbl, value: rev, isProjected: false }
      })
    }

    return []
  }, [financialStatements, statementsData])

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

  const maxValue = chartData.length > 0 ? Math.max(...chartData.map((d: { value: number }) => d.value)) : 0
  const unit = pickUnit(maxValue)
  const currencyCode = (statementsData?.financialCurrency ?? currency ?? 'USD').toUpperCase()
  const unitLabel = `(${unit} ${currencyCode})`

  const hasData = chartData.length > 0

  // ── Pill toggle styles ───────────────────────────────────────────────────────
  function pillCls(active: boolean) {
    return [
      'text-[11px] font-[600] min-w-[44px] min-h-[44px] px-2 rounded-md transition-colors',
      'focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1 focus-visible:outline-none',
      active
        ? 'bg-white text-[#111111] shadow-sm'
        : 'text-[#6B6B6B] hover:text-[#111111] active:bg-white/60',
    ].join(' ')
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-[13px] font-[700] text-[#111111] leading-tight">Revenue</p>
          <p className="text-[11px] text-[#566174] mt-0.5 leading-none">{unitLabel}</p>
        </div>
        <div
          role="group"
          aria-label="Display period"
          className="flex items-center gap-0.5 bg-[#F5F5F5] rounded-lg p-0.5 shrink-0"
        >
          <button type="button" className={pillCls(view === 'quarterly')} onClick={() => setView('quarterly')} aria-pressed={view === 'quarterly'} aria-label="Quarterly">Q</button>
          <button type="button" className={pillCls(view === 'annual')} onClick={() => setView('annual')} aria-pressed={view === 'annual'} aria-label="Annual">Y</button>
        </div>
      </div>
      {hasData ? (
        <div role="img" aria-label={`Revenue bar chart, ${view} view, values in ${unitLabel}`}>
          <BarChartComponents data={chartData} unit={unit} periodMode={view} />
        </div>
      ) : (
        <div className="flex items-center justify-center h-[180px]">
          <p className="text-[11px] text-[#8A95A6]">No data available</p>
        </div>
      )}
    </div>
  )
}
