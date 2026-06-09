'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { CHART_GRID } from '@/lib/chartTheme'
import { CHART_HEIGHTS, CHART_MOBILE_BREAKPOINT } from '@/lib/chartDimensions'

// ─── Single dynamic import for all Recharts components (avoids per-component chunking) ──

const FCFBar = dynamic(
  () =>
    import('recharts').then((mod) => {
      const { BarChart, Bar, XAxis, CartesianGrid, Cell, LabelList, ResponsiveContainer, ReferenceLine } = mod

      function ValueLabel(props: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const { x, y, width, value, useB } = props
        if (value == null) return null
        const isNeg = (value as number) < 0
        const fmtV = (v: number, useB: boolean) => {
          if (useB) {
            const b = v / 1e9
            return `${b >= 0 ? '' : '-'}${Math.abs(b).toFixed(1)}B`
          }
          const m = v / 1e6
          return `${m >= 0 ? '' : '-'}${Math.abs(m).toFixed(0)}M`
        }
        const text = (isNeg ? '−' : '+') + fmtV(value as number, useB)
        const labelY = isNeg ? y + 14 : y - 5
        return (
          <text
            x={x + width / 2}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontWeight={600}
            fill={isNeg ? '#D83B3B' : '#5F790B'}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {text}
          </text>
        )
      }

      function FCFBarChart({
        points,
        useB,
        hasNeg,
        height = 168,
      }: {
        points: Array<{ label: string; fcf: number }>
        useB: boolean
        hasNeg: boolean
        height?: number
      }) {
        const tickFill   = '#6B6B6B'
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={points}
              margin={{ top: 20, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid {...CHART_GRID} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: tickFill }}
                axisLine={false}
                tickLine={false}
              />
              {hasNeg && (
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" strokeWidth={1} />
              )}
              <Bar dataKey="fcf" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                {points.map((p, i) => (
                  <Cell key={i} fill={p.fcf >= 0 ? '#5F790B' : '#D83B3B'} fillOpacity={0.88} />
                ))}
                <LabelList dataKey="fcf" content={(props) => <ValueLabel {...props} useB={useB} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }

      return FCFBarChart
    }),
  { ssr: false },
)

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface Props {
  statementsData: any // { annual: { cashFlow: Array<{year,operatingCashFlow,capitalExpenditures}> }, quarterly: { cashFlow: Array<{...}> } }
  currency?: string
}

type PeriodTab = 'Q' | 'Y'

interface ChartPoint {
  label: string
  fcf: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveFCF(row: AnyRecord): number | null {
  const opCF = row.operatingCashFlow ?? row.totalCashFromOperatingActivities ?? null
  const capex = row.capitalExpenditures ?? row.capitalExpendituresIncludingFinancedLeases ?? null
  if (opCF == null) return null
  const fcf = opCF - Math.abs(capex ?? 0)
  return fcf
}

function getUnit(maxAbs: number): { useB: boolean; label: string } {
  const useB = maxAbs >= 500e6
  return { useB, label: useB ? '(B USD)' : '(M USD)' }
}

function buildAnnualPoints(statementsData: any): ChartPoint[] {
  const rows: AnyRecord[] = statementsData?.annual?.cashFlow ?? []
  return rows
    .slice(-6)
    .map(row => {
      const fcf = deriveFCF(row)
      if (fcf == null) return null
      const label = String(row.year ?? row.endDate ?? '').slice(0, 4)
      return { label, fcf }
    })
    .filter((p): p is ChartPoint => p !== null)
}

function buildQuarterlyPoints(statementsData: any): ChartPoint[] {
  const rows: AnyRecord[] = statementsData?.quarterly?.cashFlow ?? []
  return rows
    .slice(-8)
    .map(row => {
      const fcf = deriveFCF(row)
      if (fcf == null) return null
      // Build quarter label like "Q2 '24"
      let label = String(row.quarter ?? '')
      if (!label) {
        const date = String(row.endDate ?? row.date ?? '')
        if (date.length >= 7) {
          const yr = date.slice(2, 4)
          const mo = parseInt(date.slice(5, 7), 10)
          const q = Math.ceil(mo / 3)
          label = `Q${q} '${yr}`
        }
      }
      if (!label) label = String(row.year ?? '').slice(0, 4)
      return { label, fcf }
    })
    .filter((p): p is ChartPoint => p !== null)
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FCFChartCard({ statementsData, currency: _currency = 'USD' }: Props) {
  const [period, setPeriod] = useState<PeriodTab>('Y')

  const points = useMemo<ChartPoint[]>(() => {
    if (!statementsData) return []
    if (period === 'Y') return buildAnnualPoints(statementsData)
    return buildQuarterlyPoints(statementsData)
  }, [statementsData, period])

  const { useB, label: unitLabel } = useMemo(() => {
    if (points.length === 0) return { useB: false, label: '(M USD)' }
    const maxAbs = Math.max(...points.map(p => Math.abs(p.fcf)))
    return getUnit(maxAbs)
  }, [points])

  const hasNeg = points.some(p => p.fcf < 0)

  if (!statementsData || points.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4">
        <p className="text-[11px] font-[650] text-[#6B6B6B] mb-2">
          Free cash flow
        </p>
        <p className="text-[12px] text-[#6B6B6B]">No cash flow data available.</p>
      </div>
    )
  }

  const chartHeight = typeof window !== 'undefined' && window.innerWidth < CHART_MOBILE_BREAKPOINT
    ? CHART_HEIGHTS.sm
    : CHART_HEIGHTS.md

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-[650] text-[#6B6B6B]">
            Free Cash Flow {unitLabel}
          </span>
        </div>
        {/* Q / Y toggle */}
        <div
          role="group"
          aria-label="Display period"
          className="flex items-center gap-0.5 bg-[#F5F5F5] rounded-lg p-0.5 shrink-0"
        >
          {(['Q', 'Y'] as PeriodTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setPeriod(tab)}
              aria-pressed={period === tab}
              aria-label={tab === 'Q' ? 'Quarterly view' : 'Annual view'}
              className={[
                'text-[11px] font-[600] min-w-[44px] min-h-[44px] px-2 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1 focus-visible:outline-none',
                period === tab
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#6B6B6B] hover:text-[#111111] active:bg-white/60',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        role="img"
        aria-label={`Free cash flow bar chart, ${period === 'Y' ? 'annual' : 'quarterly'}`}
      >
        <FCFBar points={points} useB={useB} hasNeg={hasNeg} height={chartHeight} />
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-2 sm:gap-4 mt-1 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-[#6B6B6B]">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#5F790B]" />
          Positive FCF
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#6B6B6B]">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#D83B3B]" />
          Negative FCF
        </span>
        <span className="ml-auto text-[10px] text-[#9B9B9B]">
          FCF = Operating CF &minus; |Capex|
        </span>
      </div>
    </div>
  )
}
